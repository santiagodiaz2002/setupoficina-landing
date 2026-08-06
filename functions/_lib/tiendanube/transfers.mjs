import {
  HttpError,
  assertAllowedOrigin,
  assertOnlyKeys,
  assertPlainObject,
  errorResponse,
  jsonResponse,
  optionsResponse,
  readJsonBody,
  setupOrigins,
  storefrontOrigins
} from './http.mjs';
import {
  assertNoCommerceFields,
  assertTicket,
  isFeatureEnabled,
  randomTicket,
  sha256Hex
} from './security.mjs';
import { enforceRateLimit } from './rate-limit.mjs';
import {
  TiendanubeApiError,
  availableStock,
  clientFromEnv,
  currentPrice,
  localizedText,
  variantLabel
} from './client.mjs';

const TICKET_TTL_SECONDS = 10 * 60;
const PROCESSING_LEASE_SECONDS = 90;
const INTERNAL_ID_PATTERN = /^[a-z0-9_ñ-]{1,64}$/u;
const CLIENT_REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nowSeconds(deps) {
  return Number(deps.now ?? Math.floor(Date.now() / 1000));
}

function database(env) {
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
  return env.LEADS_DB;
}

function configuredStoreId(env) {
  const value = String(env.TIENDANUBE_STORE_ID || '').trim();
  if (!/^\d+$/.test(value)) {
    throw new HttpError(503, 'store_not_configured', 'Store ID de Tiendanube no configurado.');
  }
  return value;
}

function requireTransferFeature(env) {
  if (!isFeatureEnabled(env)) {
    throw new HttpError(503, 'feature_disabled', 'La transferencia a Tiendanube esta deshabilitada.');
  }
}

function normalizeStoreId(value, env) {
  const storeId = String(value ?? '').trim();
  if (!/^\d+$/.test(storeId) || storeId !== configuredStoreId(env)) {
    throw new HttpError(403, 'store_mismatch', 'La tienda no coincide con el ticket.');
  }
  return storeId;
}

export function normalizeSelectionPayload(payload) {
  assertPlainObject(payload);
  assertOnlyKeys(payload, ['clientRequestId', 'items']);
  assertNoCommerceFields(payload);

  const clientRequestId = String(payload.clientRequestId || '').trim();
  if (!CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
    throw new HttpError(400, 'invalid_client_request_id', 'clientRequestId invalido.');
  }
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 25) {
    throw new HttpError(400, 'invalid_items', 'Se requieren entre 1 y 25 productos.');
  }

  const seen = new Set();
  const items = payload.items.map((rawItem) => {
    const item = assertPlainObject(rawItem, 'invalid_item');
    assertOnlyKeys(item, ['internalId', 'quantity'], 'invalid_item');
    const internalId = String(item.internalId || '').trim();
    const quantity = Number(item.quantity);
    if (!INTERNAL_ID_PATTERN.test(internalId)) {
      throw new HttpError(400, 'invalid_internal_id', 'ID interno invalido.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new HttpError(400, 'invalid_quantity', 'Cantidad invalida.');
    }
    if (seen.has(internalId)) {
      throw new HttpError(400, 'duplicate_internal_id', 'No se permiten IDs internos duplicados.');
    }
    seen.add(internalId);
    return { internalId, quantity };
  });

  return { clientRequestId, items };
}

async function loadAuthorizedCatalog(db, storeId, items) {
  const placeholders = items.map(() => '?').join(', ');
  const result = await db.prepare(`
    SELECT internal_id, product_id, variant_id, max_quantity
    FROM tiendanube_catalog
    WHERE store_id = ? AND enabled = 1 AND internal_id IN (${placeholders})
  `).bind(storeId, ...items.map((item) => item.internalId)).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  const byId = new Map(rows.map((row) => [String(row.internal_id), row]));
  const rejected = items.filter((item) => !byId.has(item.internalId)).map((item) => item.internalId);

  if (rejected.length) {
    throw new HttpError(422, 'catalog_rejected', 'La seleccion contiene productos no autorizados.', {
      internalIds: rejected
    });
  }

  for (const item of items) {
    const row = byId.get(item.internalId);
    if (item.quantity > Number(row.max_quantity || 1)) {
      throw new HttpError(422, 'quantity_exceeds_catalog_limit', 'La cantidad supera el limite autorizado.', {
        internalId: item.internalId,
        maxQuantity: Number(row.max_quantity || 1)
      });
    }
  }

  return items.map((item) => ({ ...item, ...byId.get(item.internalId) }));
}

function upstreamError(error) {
  if (!(error instanceof TiendanubeApiError)) return error;
  if (error.status === 429) {
    return new HttpError(503, 'tiendanube_rate_limited', 'Tiendanube aplico rate limiting.');
  }
  if (error.status === 401 || error.status === 403) {
    return new HttpError(502, 'tiendanube_authorization_error', 'Tiendanube rechazo la autorizacion de la aplicacion.');
  }
  if (error.code === 'timeout') {
    return new HttpError(504, 'tiendanube_timeout', 'Tiendanube no respondio a tiempo.');
  }
  return new HttpError(502, `tiendanube_${error.code}`, 'No se pudo validar el catalogo en Tiendanube.');
}

function unavailableItem(row, product, reason, availableQuantity = null) {
  const item = {
    internalId: row.internalId,
    quantity: row.quantity,
    name: localizedText(product && product.name) || row.internalId,
    reason
  };
  if (availableQuantity !== null && Number.isFinite(availableQuantity)) {
    item.availableQuantity = Math.max(0, Math.floor(availableQuantity));
  }
  return item;
}

export async function resolveCatalogSelection(rows, client) {
  const productRequests = new Map();
  for (const row of rows) {
    const productId = Number(row.product_id);
    if (!productRequests.has(productId)) {
      productRequests.set(productId, client.getProduct(productId).catch((error) => {
        if (error instanceof TiendanubeApiError && error.status === 404) return null;
        throw upstreamError(error);
      }));
    }
  }

  const available = [];
  const unavailable = [];
  for (const row of rows) {
    const product = await productRequests.get(Number(row.product_id));
    if (!product) {
      unavailable.push(unavailableItem(row, null, 'product_not_found'));
      continue;
    }
    const visibility = typeof product.visibility === 'string'
      ? product.visibility.trim().toLowerCase()
      : '';
    if (visibility === 'hidden') {
      unavailable.push(unavailableItem(row, product, 'product_hidden'));
      continue;
    }
    if (visibility && visibility !== 'visible' && visibility !== 'unlisted') {
      unavailable.push(unavailableItem(row, product, 'product_visibility_invalid'));
      continue;
    }
    if (!visibility && product.published === false) {
      unavailable.push(unavailableItem(row, product, 'product_unpublished_legacy'));
      continue;
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variant = variants.find((candidate) => Number(candidate.id) === Number(row.variant_id));
    if (!variant) {
      unavailable.push(unavailableItem(row, product, 'variant_not_found'));
      continue;
    }
    if (variant.visible === false) {
      unavailable.push(unavailableItem(row, product, 'variant_hidden'));
      continue;
    }

    const stock = availableStock(variant);
    if (stock < row.quantity) {
      unavailable.push(unavailableItem(row, product, 'insufficient_stock', stock));
      continue;
    }

    if (!currentPrice(variant)) {
      unavailable.push(unavailableItem(row, product, 'price_unavailable'));
      continue;
    }

    available.push({
      internalId: row.internalId,
      productId: Number(row.product_id),
      variantId: Number(row.variant_id),
      quantity: row.quantity,
      name: localizedText(product.name) || row.internalId,
      variantName: variantLabel(variant)
    });
  }

  return { available, unavailable };
}

function configuredStorefrontUrl(env) {
  const allowedOrigins = storefrontOrigins(env);
  let url;
  try {
    url = new URL(String(env.TIENDANUBE_STOREFRONT_URL || ''));
  } catch (_) {
    throw new HttpError(503, 'storefront_url_invalid', 'URL del storefront invalida.');
  }
  if (
    url.protocol !== 'https:' || url.username || url.password || url.port ||
    url.pathname !== '/' || !allowedOrigins.has(url.origin)
  ) {
    throw new HttpError(503, 'storefront_url_not_allowed', 'URL del storefront fuera de la lista permitida.');
  }
  url.search = '';
  url.hash = '';
  return url;
}

function storefrontRedirectWithTicket(configuredUrl, ticket) {
  const url = new URL(configuredUrl.toString());
  url.searchParams.set('setupoficina_ticket', assertTicket(ticket));
  return url.toString();
}

export function buildStorefrontRedirect(env, ticket) {
  return storefrontRedirectWithTicket(configuredStorefrontUrl(env), ticket);
}

async function insertTransfer(db, data, deps) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const generated = (deps.randomTicket || randomTicket)(deps.cryptoImpl);
    const ticketHash = await sha256Hex(generated.token, deps.cryptoImpl);
    try {
      await db.prepare(`
        INSERT INTO tiendanube_cart_transfers (
          ticket_hash, store_id, client_request_id, selection_json,
          resolved_items_json, unavailable_items_json, status, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(
        ticketHash,
        data.storeId,
        data.clientRequestId,
        JSON.stringify(data.selection),
        JSON.stringify(data.available),
        JSON.stringify(data.unavailable),
        data.createdAt,
        data.expiresAt
      ).run();
      return generated.token;
    } catch (error) {
      const message = String(error && error.message || '');
      if (/ticket_hash/i.test(message) && /unique|constraint/i.test(message)) continue;
      if (/client_request_id/i.test(message) && /unique|constraint/i.test(message)) {
        throw new HttpError(409, 'duplicate_client_request', 'clientRequestId ya utilizado.');
      }
      throw new HttpError(500, 'ticket_persistence_failed', 'No se pudo crear el ticket.');
    }
  }
  throw new HttpError(500, 'ticket_collision', 'No se pudo generar un ticket unico.');
}

export async function handleCartTransfer({ request, env }, deps = {}) {
  let origins = new Set();
  try {
    origins = setupOrigins(env);
    assertAllowedOrigin(request, origins);
    requireTransferFeature(env);
    const db = database(env);
    const storeId = configuredStoreId(env);
    const storefrontUrl = configuredStorefrontUrl(env);
    const payload = normalizeSelectionPayload(await readJsonBody(request));
    await enforceRateLimit(db, request, 'tiendanube:prepare', { limit: 10, windowSeconds: 60, ...(deps.rateLimit || {}) });

    const duplicate = await db.prepare(`
      SELECT status FROM tiendanube_cart_transfers
      WHERE store_id = ? AND client_request_id = ?
      LIMIT 1
    `).bind(storeId, payload.clientRequestId).first();
    if (duplicate) throw new HttpError(409, 'duplicate_client_request', 'clientRequestId ya utilizado.');

    const catalogRows = await loadAuthorizedCatalog(db, storeId, payload.items);
    const client = deps.client || await clientFromEnv(env, deps.clientOptions || {});
    const resolved = await resolveCatalogSelection(catalogRows, client);
    const createdAt = nowSeconds(deps);
    const expiresAt = createdAt + TICKET_TTL_SECONDS;
    const ticket = await insertTransfer(db, {
      storeId,
      clientRequestId: payload.clientRequestId,
      selection: payload.items,
      available: resolved.available,
      unavailable: resolved.unavailable,
      createdAt,
      expiresAt
    }, deps);

    return jsonResponse({
      ok: true,
      redirectUrl: storefrontRedirectWithTicket(storefrontUrl, ticket),
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      available: resolved.available.map(({ productId: _productId, variantId: _variantId, ...item }) => item),
      unavailable: resolved.unavailable
    }, 201, request, origins);
  } catch (error) {
    return errorResponse(error, request, origins);
  }
}

function consumePayload(payload, env) {
  assertPlainObject(payload);
  assertOnlyKeys(payload, ['ticket', 'storeId']);
  assertNoCommerceFields(payload);
  return {
    ticket: assertTicket(payload.ticket),
    storeId: normalizeStoreId(payload.storeId, env)
  };
}

async function ticketState(db, ticketHash, storeId) {
  return db.prepare(`
    SELECT status, expires_at, processing_lease_expires_at FROM tiendanube_cart_transfers
    WHERE ticket_hash = ? AND store_id = ?
    LIMIT 1
  `).bind(ticketHash, storeId).first();
}

export async function handleCartTransferConsume({ request, env }, deps = {}) {
  let origins = new Set();
  try {
    origins = storefrontOrigins(env);
    assertAllowedOrigin(request, origins);
    requireTransferFeature(env);
    const db = database(env);
    const payload = consumePayload(await readJsonBody(request), env);
    await enforceRateLimit(db, request, 'tiendanube:consume', { limit: 30, windowSeconds: 60, ...(deps.rateLimit || {}) });
    const ticketHash = await sha256Hex(payload.ticket, deps.cryptoImpl);
    const now = nowSeconds(deps);

    await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'expired', processing_started_at = NULL,
          processing_lease_expires_at = NULL, processing_token_hash = NULL
      WHERE ticket_hash = ? AND store_id = ?
        AND status IN ('pending', 'processing') AND expires_at <= ?
    `).bind(ticketHash, payload.storeId, now).run();

    const generatedProcessingToken = (deps.randomProcessingToken || randomTicket)(deps.cryptoImpl);
    const processingToken = assertTicket(generatedProcessingToken.token);
    const processingTokenHash = await sha256Hex(processingToken, deps.cryptoImpl);
    const leaseExpiresAt = now + PROCESSING_LEASE_SECONDS;

    const transfer = await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'processing', processing_started_at = ?,
          processing_lease_expires_at = MIN(expires_at, ?), processing_token_hash = ?
      WHERE ticket_hash = ? AND store_id = ? AND expires_at > ?
        AND (status = 'pending' OR (status = 'processing' AND processing_lease_expires_at <= ?))
      RETURNING selection_json, resolved_items_json, unavailable_items_json, expires_at
    `).bind(
      now,
      leaseExpiresAt,
      processingTokenHash,
      ticketHash,
      payload.storeId,
      now,
      now
    ).first();

    if (!transfer) {
      const state = await ticketState(db, ticketHash, payload.storeId);
      if (!state) throw new HttpError(404, 'ticket_not_found', 'Ticket inexistente.');
      if (state.status === 'expired' || Number(state.expires_at) <= now) {
        throw new HttpError(410, 'ticket_expired', 'El ticket expiro.');
      }
      if (state.status === 'processing' && Number(state.processing_lease_expires_at) > now) {
        throw new HttpError(409, 'ticket_processing', 'El ticket ya esta siendo procesado.');
      }
      throw new HttpError(409, 'ticket_already_used', 'El ticket ya fue utilizado.');
    }

    return jsonResponse({
      ok: true,
      processingToken,
      items: JSON.parse(transfer.resolved_items_json || '[]'),
      unavailable: JSON.parse(transfer.unavailable_items_json || '[]')
    }, 200, request, origins);
  } catch (error) {
    return errorResponse(error, request, origins);
  }
}

function normalizeCompletionResult(payload, env) {
  assertPlainObject(payload);
  assertOnlyKeys(payload, ['ticket', 'processingToken', 'storeId', 'result']);
  assertNoCommerceFields(payload);
  const result = assertPlainObject(payload.result, 'invalid_result');
  assertOnlyKeys(result, ['added', 'failed'], 'invalid_result');
  if (!Array.isArray(result.added) || !Array.isArray(result.failed) || result.added.length + result.failed.length > 50) {
    throw new HttpError(400, 'invalid_result', 'Resultado invalido.');
  }

  const added = result.added.map((raw) => {
    const item = assertPlainObject(raw, 'invalid_result_item');
    assertOnlyKeys(item, ['internalId', 'quantity'], 'invalid_result_item');
    const internalId = String(item.internalId || '').trim();
    const quantity = Number(item.quantity);
    if (!INTERNAL_ID_PATTERN.test(internalId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new HttpError(400, 'invalid_result_item', 'Producto agregado invalido.');
    }
    return { internalId, quantity };
  });
  const failed = result.failed.map((raw) => {
    const item = assertPlainObject(raw, 'invalid_result_item');
    assertOnlyKeys(item, ['internalId', 'reason'], 'invalid_result_item');
    const internalId = String(item.internalId || '').trim();
    const reason = String(item.reason || 'cart_add_failed').trim().slice(0, 160);
    if (!INTERNAL_ID_PATTERN.test(internalId)) {
      throw new HttpError(400, 'invalid_result_item', 'Producto fallido invalido.');
    }
    return { internalId, reason };
  });

  return {
    ticket: assertTicket(payload.ticket),
    processingToken: assertTicket(payload.processingToken),
    storeId: normalizeStoreId(payload.storeId, env),
    result: { added, failed }
  };
}

export async function handleCartTransferComplete({ request, env }, deps = {}) {
  let origins = new Set();
  try {
    origins = storefrontOrigins(env);
    assertAllowedOrigin(request, origins);
    requireTransferFeature(env);
    const db = database(env);
    const payload = normalizeCompletionResult(await readJsonBody(request), env);
    await enforceRateLimit(db, request, 'tiendanube:complete', { limit: 30, windowSeconds: 60, ...(deps.rateLimit || {}) });
    const ticketHash = await sha256Hex(payload.ticket, deps.cryptoImpl);
    const processingTokenHash = await sha256Hex(payload.processingToken, deps.cryptoImpl);
    const now = nowSeconds(deps);
    await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'expired', processing_started_at = NULL,
          processing_lease_expires_at = NULL, processing_token_hash = NULL
      WHERE ticket_hash = ? AND store_id = ? AND status = 'processing' AND expires_at <= ?
    `).bind(ticketHash, payload.storeId, now).run();
    const transfer = await db.prepare(`
      SELECT status, expires_at, processing_token_hash,
             resolved_items_json, unavailable_items_json
      FROM tiendanube_cart_transfers
      WHERE ticket_hash = ? AND store_id = ?
      LIMIT 1
    `).bind(ticketHash, payload.storeId).first();
    if (!transfer) throw new HttpError(404, 'ticket_not_found', 'Ticket inexistente.');
    if (transfer.status === 'expired' || Number(transfer.expires_at) <= now) {
      throw new HttpError(410, 'ticket_expired', 'El ticket expiro.');
    }
    if (transfer.status !== 'processing' || transfer.processing_token_hash !== processingTokenHash) {
      throw new HttpError(409, 'ticket_not_processing', 'El ticket no esta disponible para completar.');
    }

    const resolved = JSON.parse(transfer.resolved_items_json || '[]');
    const unavailable = JSON.parse(transfer.unavailable_items_json || '[]');
    const resolvedById = new Map(resolved.map((item) => [String(item.internalId), item]));
    const unavailableById = new Map(unavailable.map((item) => [String(item.internalId), item]));
    const allowed = new Set([...resolvedById.keys(), ...unavailableById.keys()]);
    const reported = [...payload.result.added, ...payload.result.failed];
    const outside = reported.filter((item) => !allowed.has(item.internalId)).map((item) => item.internalId);
    if (outside.length) {
      throw new HttpError(422, 'result_not_in_transfer', 'El resultado contiene productos ajenos al ticket.', { internalIds: outside });
    }
    const reportedIds = reported.map((item) => item.internalId);
    if (new Set(reportedIds).size !== reportedIds.length || reportedIds.length !== allowed.size) {
      throw new HttpError(422, 'result_incomplete', 'El resultado no coincide con los productos entregados por el ticket.');
    }
    for (const item of payload.result.added) {
      const expected = resolvedById.get(item.internalId);
      if (!expected || item.quantity !== Number(expected.quantity)) {
        throw new HttpError(422, 'result_quantity_mismatch', 'El resultado agregado no coincide con el ticket.');
      }
    }
    for (const item of payload.result.failed) {
      const expectedUnavailable = unavailableById.get(item.internalId);
      if (expectedUnavailable && item.reason !== String(expectedUnavailable.reason)) {
        throw new HttpError(422, 'result_reason_mismatch', 'El resultado no coincide con la indisponibilidad validada.');
      }
    }

    const completedAt = now;
    const result = await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'completed', completed_at = ?, completion_json = ?
      WHERE ticket_hash = ? AND store_id = ? AND status = 'processing'
        AND processing_token_hash = ? AND expires_at > ?
    `).bind(
      completedAt,
      JSON.stringify(payload.result),
      ticketHash,
      payload.storeId,
      processingTokenHash,
      now
    ).run();
    const changes = Number(result && result.meta && result.meta.changes || 0);
    if (changes !== 1) throw new HttpError(409, 'ticket_already_completed', 'El ticket ya fue completado.');

    return jsonResponse({ ok: true }, 200, request, origins);
  } catch (error) {
    return errorResponse(error, request, origins);
  }
}

export function handleCartTransferOptions({ request, env }, scope) {
  let origins = new Set();
  try {
    origins = scope === 'setup' ? setupOrigins(env) : storefrontOrigins(env);
    return optionsResponse(request, origins);
  } catch (error) {
    return errorResponse(error, request, origins);
  }
}
