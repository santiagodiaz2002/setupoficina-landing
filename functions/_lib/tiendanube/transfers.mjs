// Este módulo implementa el ciclo completo del puente de carrito: preparar, consumir y completar una transferencia.
// El navegador envía solo identificadores internos; el servidor resuelve producto, variante, disponibilidad y valor actual mediante catálogo D1 y API.
// Los tickets y credenciales de procesamiento se persisten resumidos, tienen vencimiento y cambian de estado mediante actualizaciones condicionales.
// Importa una dependencia compartida para reutilizar validaciones y mantener un único contrato.
import {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  HttpError,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertAllowedOrigin,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertOnlyKeys,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertPlainObject,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  errorResponse,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  jsonResponse,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  optionsResponse,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  readJsonBody,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  setupOrigins,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  storefrontOrigins
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
} from './http.mjs';
// Importa una dependencia compartida para reutilizar validaciones y mantener un único contrato.
import {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertNoCommerceFields,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertTicket,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  isFeatureEnabled,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  randomTicket,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  sha256Hex
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
} from './security.mjs';
// Importa una dependencia compartida para reutilizar validaciones y mantener un único contrato.
import { enforceRateLimit } from './rate-limit.mjs';
// Importa una dependencia compartida para reutilizar validaciones y mantener un único contrato.
import {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  TiendanubeApiError,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  availableStock,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  clientFromEnv,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  currentPrice,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  localizedText,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  variantLabel
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
} from './client.mjs';

// Calcula y conserva un dato inmutable dentro de este alcance.
const TICKET_TTL_SECONDS = 10 * 60;
// Calcula y conserva un dato inmutable dentro de este alcance.
const PROCESSING_LEASE_SECONDS = 90;
// Calcula y conserva un dato inmutable dentro de este alcance.
const INTERNAL_ID_PATTERN = /^[a-z0-9_ñ-]{1,64}$/u;
// Calcula y conserva un dato inmutable dentro de este alcance.
const CLIENT_REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Resuelve el reloj inyectado o real en segundos para controlar vencimientos y pruebas.
function nowSeconds(deps) {
// Entrega el resultado ya validado y termina esta rama.
  return Number(deps.now ?? Math.floor(Date.now() / 1000));
// Cierra el bloque o la estructura y delimita su alcance.
}

// Obtiene el binding D1 del puente y falla con un error estable cuando no está disponible.
function database(env) {
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
// Entrega el resultado ya validado y termina esta rama.
  return env.LEADS_DB;
// Cierra el bloque o la estructura y delimita su alcance.
}

// Exige una tienda decimal configurada para impedir que el cliente elija el destino.
function configuredStoreId(env) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const value = String(env.TIENDANUBE_STORE_ID || '').trim();
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (!/^\d+$/.test(value)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'store_not_configured', 'Store ID de Tiendanube no configurado.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Entrega el resultado ya validado y termina esta rama.
  return value;
// Cierra el bloque o la estructura y delimita su alcance.
}

// Aplica la bandera de habilitación antes de cualquier operación con catálogo o tickets.
function requireTransferFeature(env) {
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (!isFeatureEnabled(env)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'feature_disabled', 'La transferencia a Tiendanube esta deshabilitada.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Cierra el bloque o la estructura y delimita su alcance.
}

// Normaliza la tienda recibida y la compara con la única tienda configurada.
function normalizeStoreId(value, env) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeId = String(value ?? '').trim();
// Exige una tienda decimal configurada para impedir que el cliente elija el destino.
  if (!/^\d+$/.test(storeId) || storeId !== configuredStoreId(env)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(403, 'store_mismatch', 'La tienda no coincide con el ticket.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Entrega el resultado ya validado y termina esta rama.
  return storeId;
// Cierra el bloque o la estructura y delimita su alcance.
}

// Valida forma, claves, cantidades e identificador idempotente sin aceptar datos comerciales del cliente.
export function normalizeSelectionPayload(payload) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertPlainObject(payload);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertOnlyKeys(payload, ['clientRequestId', 'items']);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertNoCommerceFields(payload);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const clientRequestId = String(payload.clientRequestId || '').trim();
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (!CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, 'invalid_client_request_id', 'clientRequestId invalido.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 25) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, 'invalid_items', 'Se requieren entre 1 y 25 productos.');
// Cierra el bloque o la estructura y delimita su alcance.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const seen = new Set();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const items = payload.items.map((rawItem) => {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const item = assertPlainObject(rawItem, 'invalid_item');
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    assertOnlyKeys(item, ['internalId', 'quantity'], 'invalid_item');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const internalId = String(item.internalId || '').trim();
// Calcula y conserva un dato inmutable dentro de este alcance.
    const quantity = Number(item.quantity);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!INTERNAL_ID_PATTERN.test(internalId)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(400, 'invalid_internal_id', 'ID interno invalido.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(400, 'invalid_quantity', 'Cantidad invalida.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (seen.has(internalId)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(400, 'duplicate_internal_id', 'No se permiten IDs internos duplicados.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    seen.add(internalId);
// Devuelve un objeto normalizado que forma parte del contrato interno.
    return { internalId, quantity };
// Cierra el bloque o la estructura y delimita su alcance.
  });

// Devuelve un objeto normalizado que forma parte del contrato interno.
  return { clientRequestId, items };
// Cierra el bloque o la estructura y delimita su alcance.
}

// Consulta únicamente los artículos internos solicitados, habilitados y pertenecientes a la tienda.
async function loadAuthorizedCatalog(db, storeId, items) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const placeholders = items.map(() => '?').join(', ');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const result = await db.prepare(`
    SELECT internal_id, product_id, variant_id, max_quantity
    FROM tiendanube_catalog
    WHERE store_id = ? AND enabled = 1 AND internal_id IN (${placeholders})
  `).bind(storeId, ...items.map((item) => item.internalId)).all();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const rows = Array.isArray(result && result.results) ? result.results : [];
// Calcula y conserva un dato inmutable dentro de este alcance.
  const byId = new Map(rows.map((row) => [String(row.internal_id), row]));
// Calcula y conserva un dato inmutable dentro de este alcance.
  const rejected = items.filter((item) => !byId.has(item.internalId)).map((item) => item.internalId);

// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (rejected.length) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(422, 'catalog_rejected', 'La seleccion contiene productos no autorizados.', {
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      internalIds: rejected
// Cierra el bloque o la estructura y delimita su alcance.
    });
// Cierra el bloque o la estructura y delimita su alcance.
  }

// Recorre una colección previamente limitada y procesa cada elemento una vez.
  for (const item of items) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const row = byId.get(item.internalId);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (item.quantity > Number(row.max_quantity || 1)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(422, 'quantity_exceeds_catalog_limit', 'La cantidad supera el limite autorizado.', {
// Define un campo explícito del objeto que pasa a la siguiente etapa.
        internalId: item.internalId,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
        maxQuantity: Number(row.max_quantity || 1)
// Cierra el bloque o la estructura y delimita su alcance.
      });
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Cierra el bloque o la estructura y delimita su alcance.
  }

// Entrega el resultado ya validado y termina esta rama.
  return items.map((item) => ({ ...item, ...byId.get(item.internalId) }));
// Cierra el bloque o la estructura y delimita su alcance.
}

// Traduce fallos de la API externa a errores internos sin propagar mensajes sensibles.
function upstreamError(error) {
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (!(error instanceof TiendanubeApiError)) return error;
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (error.status === 429) {
// Entrega el resultado ya validado y termina esta rama.
    return new HttpError(503, 'tiendanube_rate_limited', 'Tiendanube aplico rate limiting.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (error.status === 401 || error.status === 403) {
// Entrega el resultado ya validado y termina esta rama.
    return new HttpError(502, 'tiendanube_authorization_error', 'Tiendanube rechazo la autorizacion de la aplicacion.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (error.code === 'timeout') {
// Entrega el resultado ya validado y termina esta rama.
    return new HttpError(504, 'tiendanube_timeout', 'Tiendanube no respondio a tiempo.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Entrega el resultado ya validado y termina esta rama.
  return new HttpError(502, `tiendanube_${error.code}`, 'No se pudo validar el catalogo en Tiendanube.');
// Cierra el bloque o la estructura y delimita su alcance.
}

// Construye una causa pública y mínima para un artículo que no puede transferirse.
function unavailableItem(row, product, reason, availableQuantity = null) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const item = {
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    internalId: row.internalId,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    quantity: row.quantity,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    name: localizedText(product && product.name) || row.internalId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    reason
// Cierra el bloque o la estructura y delimita su alcance.
  };
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (availableQuantity !== null && Number.isFinite(availableQuantity)) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    item.availableQuantity = Math.max(0, Math.floor(availableQuantity));
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Entrega el resultado ya validado y termina esta rama.
  return item;
// Cierra el bloque o la estructura y delimita su alcance.
}

// Verifica cada fila contra producto y variante remotos, acumula disponibles y explica descartes.
export async function resolveCatalogSelection(rows, client) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const productRequests = new Map();
// Recorre una colección previamente limitada y procesa cada elemento una vez.
  for (const row of rows) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const productId = Number(row.product_id);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!productRequests.has(productId)) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      productRequests.set(productId, client.getProduct(productId).catch((error) => {
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
        if (error instanceof TiendanubeApiError && error.status === 404) return null;
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
        throw upstreamError(error);
// Cierra el bloque o la estructura y delimita su alcance.
      }));
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Cierra el bloque o la estructura y delimita su alcance.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const available = [];
// Calcula y conserva un dato inmutable dentro de este alcance.
  const unavailable = [];
// Recorre una colección previamente limitada y procesa cada elemento una vez.
  for (const row of rows) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const product = await productRequests.get(Number(row.product_id));
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!product) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, null, 'product_not_found'));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Calcula y conserva un dato inmutable dentro de este alcance.
    const visibility = typeof product.visibility === 'string'
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      ? product.visibility.trim().toLowerCase()
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      : '';
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (visibility === 'hidden') {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, product, 'product_hidden'));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (visibility && visibility !== 'visible' && visibility !== 'unlisted') {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, product, 'product_visibility_invalid'));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!visibility && product.published === false) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, product, 'product_unpublished_legacy'));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }

// Calcula y conserva un dato inmutable dentro de este alcance.
    const variants = Array.isArray(product.variants) ? product.variants : [];
// Calcula y conserva un dato inmutable dentro de este alcance.
    const variant = variants.find((candidate) => Number(candidate.id) === Number(row.variant_id));
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!variant) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, product, 'variant_not_found'));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (variant.visible === false) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, product, 'variant_hidden'));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }

// Calcula y conserva un dato inmutable dentro de este alcance.
    const stock = availableStock(variant);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (stock < row.quantity) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, product, 'insufficient_stock', stock));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }

// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!currentPrice(variant)) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      unavailable.push(unavailableItem(row, product, 'price_unavailable'));
// Omite el resto de esta iteración porque el elemento ya quedó clasificado.
      continue;
// Cierra el bloque o la estructura y delimita su alcance.
    }

// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    available.push({
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      internalId: row.internalId,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      productId: Number(row.product_id),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      variantId: Number(row.variant_id),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      quantity: row.quantity,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      name: localizedText(product.name) || row.internalId,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      variantName: variantLabel(variant)
// Cierra el bloque o la estructura y delimita su alcance.
    });
// Cierra el bloque o la estructura y delimita su alcance.
  }

// Devuelve un objeto normalizado que forma parte del contrato interno.
  return { available, unavailable };
// Cierra el bloque o la estructura y delimita su alcance.
}

// Valida que el destino sea seguro, sin credenciales ni fragmentos, y pertenezca al dominio esperado.
function configuredStorefrontUrl(env) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const allowedOrigins = storefrontOrigins(env);
// Reserva estado mutable porque el valor se completa durante el flujo.
  let url;
// Aísla una operación que puede fallar por entrada, red o persistencia.
  try {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    url = new URL(String(env.TIENDANUBE_STOREFRONT_URL || ''));
// Captura el fallo y lo traduce sin revelar material sensible.
  } catch (_) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'storefront_url_invalid', 'URL del storefront invalida.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    url.protocol !== 'https:' || url.username || url.password || url.port ||
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    url.pathname !== '/' || !allowedOrigins.has(url.origin)
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  ) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'storefront_url_not_allowed', 'URL del storefront fuera de la lista permitida.');
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  url.search = '';
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  url.hash = '';
// Entrega el resultado ya validado y termina esta rama.
  return url;
// Cierra el bloque o la estructura y delimita su alcance.
}

// Añade el ticket opaco a la URL ya validada sin reemplazar sus otros parámetros.
function storefrontRedirectWithTicket(configuredUrl, ticket) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const url = new URL(configuredUrl.toString());
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  url.searchParams.set('setupoficina_ticket', assertTicket(ticket));
// Entrega el resultado ya validado y termina esta rama.
  return url.toString();
// Cierra el bloque o la estructura y delimita su alcance.
}

// Expone la construcción de redirección después de validar la configuración de destino.
export function buildStorefrontRedirect(env, ticket) {
// Entrega el resultado ya validado y termina esta rama.
  return storefrontRedirectWithTicket(configuredStorefrontUrl(env), ticket);
// Cierra el bloque o la estructura y delimita su alcance.
}

// Persiste una transferencia pendiente con resumen del ticket y devuelve conflicto idempotente cuando corresponde.
async function insertTransfer(db, data, deps) {
// Recorre una colección previamente limitada y procesa cada elemento una vez.
  for (let attempt = 0; attempt < 3; attempt += 1) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const generated = (deps.randomTicket || randomTicket)(deps.cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const ticketHash = await sha256Hex(generated.token, deps.cryptoImpl);
// Aísla una operación que puede fallar por entrada, red o persistencia.
    try {
// Prepara una sentencia D1 sin interpolar datos procedentes de la petición.
      await db.prepare(`
        INSERT INTO tiendanube_cart_transfers (
          ticket_hash, store_id, client_request_id, selection_json,
          resolved_items_json, unavailable_items_json, status, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        ticketHash,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        data.storeId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        data.clientRequestId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        JSON.stringify(data.selection),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        JSON.stringify(data.available),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        JSON.stringify(data.unavailable),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        data.createdAt,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        data.expiresAt
// Ejecuta la mutación preparada y conserva metadatos para comprobar el cambio.
      ).run();
// Entrega el resultado ya validado y termina esta rama.
      return generated.token;
// Captura el fallo y lo traduce sin revelar material sensible.
    } catch (error) {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const message = String(error && error.message || '');
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
      if (/ticket_hash/i.test(message) && /unique|constraint/i.test(message)) continue;
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
      if (/client_request_id/i.test(message) && /unique|constraint/i.test(message)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
        throw new HttpError(409, 'duplicate_client_request', 'clientRequestId ya utilizado.');
// Cierra el bloque o la estructura y delimita su alcance.
      }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(500, 'ticket_persistence_failed', 'No se pudo crear el ticket.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
  throw new HttpError(500, 'ticket_collision', 'No se pudo generar un ticket unico.');
// Cierra el bloque o la estructura y delimita su alcance.
}

// Atiende la preparación: valida origen y frecuencia, resuelve catálogo, crea ticket y devuelve la redirección.
export async function handleCartTransfer({ request, env }, deps = {}) {
// Reserva estado mutable porque el valor se completa durante el flujo.
  let origins = new Set();
// Aísla una operación que puede fallar por entrada, red o persistencia.
  try {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    origins = setupOrigins(env);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    assertAllowedOrigin(request, origins);
// Aplica la bandera de habilitación antes de cualquier operación con catálogo o tickets.
    requireTransferFeature(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const db = database(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const storeId = configuredStoreId(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const storefrontUrl = configuredStorefrontUrl(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const payload = normalizeSelectionPayload(await readJsonBody(request));
// Espera la promesa para mantener el orden de validación y persistencia.
    await enforceRateLimit(db, request, 'tiendanube:prepare', { limit: 10, windowSeconds: 60, ...(deps.rateLimit || {}) });

// Calcula y conserva un dato inmutable dentro de este alcance.
    const duplicate = await db.prepare(`
      SELECT status FROM tiendanube_cart_transfers
      WHERE store_id = ? AND client_request_id = ?
      LIMIT 1
    `).bind(storeId, payload.clientRequestId).first();
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (duplicate) throw new HttpError(409, 'duplicate_client_request', 'clientRequestId ya utilizado.');

// Calcula y conserva un dato inmutable dentro de este alcance.
    const catalogRows = await loadAuthorizedCatalog(db, storeId, payload.items);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const client = deps.client || await clientFromEnv(env, deps.clientOptions || {});
// Calcula y conserva un dato inmutable dentro de este alcance.
    const resolved = await resolveCatalogSelection(catalogRows, client);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const createdAt = nowSeconds(deps);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const expiresAt = createdAt + TICKET_TTL_SECONDS;
// Calcula y conserva un dato inmutable dentro de este alcance.
    const ticket = await insertTransfer(db, {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      storeId,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      clientRequestId: payload.clientRequestId,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      selection: payload.items,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      available: resolved.available,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      unavailable: resolved.unavailable,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      createdAt,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      expiresAt
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    }, deps);

// Entrega el resultado ya validado y termina esta rama.
    return jsonResponse({
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      ok: true,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      redirectUrl: storefrontRedirectWithTicket(storefrontUrl, ticket),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      expiresAt: new Date(expiresAt * 1000).toISOString(),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      available: resolved.available.map(({ productId: _productId, variantId: _variantId, ...item }) => item),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      unavailable: resolved.unavailable
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    }, 201, request, origins);
// Captura el fallo y lo traduce sin revelar material sensible.
  } catch (error) {
// Entrega el resultado ya validado y termina esta rama.
    return errorResponse(error, request, origins);
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Cierra el bloque o la estructura y delimita su alcance.
}

// Valida ticket y tienda recibidos desde la aplicación embebida sin admitir campos comerciales.
function consumePayload(payload, env) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertPlainObject(payload);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertOnlyKeys(payload, ['ticket', 'storeId']);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertNoCommerceFields(payload);
// Devuelve un objeto normalizado que forma parte del contrato interno.
  return {
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    ticket: assertTicket(payload.ticket),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    storeId: normalizeStoreId(payload.storeId, env)
// Cierra el bloque o la estructura y delimita su alcance.
  };
// Cierra el bloque o la estructura y delimita su alcance.
}

// Lee el estado mínimo necesario para explicar por qué una transición condicional no avanzó.
async function ticketState(db, ticketHash, storeId) {
// Prepara una sentencia D1 sin interpolar datos procedentes de la petición.
  return db.prepare(`
    SELECT status, expires_at, processing_lease_expires_at FROM tiendanube_cart_transfers
    WHERE ticket_hash = ? AND store_id = ?
    LIMIT 1
  `).bind(ticketHash, storeId).first();
// Cierra el bloque o la estructura y delimita su alcance.
}

// Reclama un ticket pendiente o vencido en procesamiento y entrega una credencial temporal de finalización.
export async function handleCartTransferConsume({ request, env }, deps = {}) {
// Reserva estado mutable porque el valor se completa durante el flujo.
  let origins = new Set();
// Aísla una operación que puede fallar por entrada, red o persistencia.
  try {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    origins = storefrontOrigins(env);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    assertAllowedOrigin(request, origins);
// Aplica la bandera de habilitación antes de cualquier operación con catálogo o tickets.
    requireTransferFeature(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const db = database(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const payload = consumePayload(await readJsonBody(request), env);
// Espera la promesa para mantener el orden de validación y persistencia.
    await enforceRateLimit(db, request, 'tiendanube:consume', { limit: 30, windowSeconds: 60, ...(deps.rateLimit || {}) });
// Calcula y conserva un dato inmutable dentro de este alcance.
    const ticketHash = await sha256Hex(payload.ticket, deps.cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const now = nowSeconds(deps);

// Prepara una sentencia D1 sin interpolar datos procedentes de la petición.
    await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'expired', processing_started_at = NULL,
          processing_lease_expires_at = NULL, processing_token_hash = NULL
      WHERE ticket_hash = ? AND store_id = ?
        AND status IN ('pending', 'processing') AND expires_at <= ?
    `).bind(ticketHash, payload.storeId, now).run();

// Calcula y conserva un dato inmutable dentro de este alcance.
    const generatedProcessingToken = (deps.randomProcessingToken || randomTicket)(deps.cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const processingToken = assertTicket(generatedProcessingToken.token);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const processingTokenHash = await sha256Hex(processingToken, deps.cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const leaseExpiresAt = now + PROCESSING_LEASE_SECONDS;

// Calcula y conserva un dato inmutable dentro de este alcance.
    const transfer = await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'processing', processing_started_at = ?,
          processing_lease_expires_at = MIN(expires_at, ?), processing_token_hash = ?
      WHERE ticket_hash = ? AND store_id = ? AND expires_at > ?
        AND (status = 'pending' OR (status = 'processing' AND processing_lease_expires_at <= ?))
      RETURNING selection_json, resolved_items_json, unavailable_items_json, expires_at
    `).bind(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      now,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      leaseExpiresAt,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      processingTokenHash,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      ticketHash,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      payload.storeId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      now,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      now
// Recupera como máximo una fila porque la clave consultada debe ser única.
    ).first();

// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!transfer) {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const state = await ticketState(db, ticketHash, payload.storeId);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
      if (!state) throw new HttpError(404, 'ticket_not_found', 'Ticket inexistente.');
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
      if (state.status === 'expired' || Number(state.expires_at) <= now) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
        throw new HttpError(410, 'ticket_expired', 'El ticket expiro.');
// Cierra el bloque o la estructura y delimita su alcance.
      }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
      if (state.status === 'processing' && Number(state.processing_lease_expires_at) > now) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
        throw new HttpError(409, 'ticket_processing', 'El ticket ya esta siendo procesado.');
// Cierra el bloque o la estructura y delimita su alcance.
      }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(409, 'ticket_already_used', 'El ticket ya fue utilizado.');
// Cierra el bloque o la estructura y delimita su alcance.
    }

// Entrega el resultado ya validado y termina esta rama.
    return jsonResponse({
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      ok: true,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      processingToken,
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      items: JSON.parse(transfer.resolved_items_json || '[]'),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
      unavailable: JSON.parse(transfer.unavailable_items_json || '[]')
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    }, 200, request, origins);
// Captura el fallo y lo traduce sin revelar material sensible.
  } catch (error) {
// Entrega el resultado ya validado y termina esta rama.
    return errorResponse(error, request, origins);
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Cierra el bloque o la estructura y delimita su alcance.
}

// Valida el resultado informado por la aplicación y limita cantidades, claves y tamaños.
function normalizeCompletionResult(payload, env) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertPlainObject(payload);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertOnlyKeys(payload, ['ticket', 'processingToken', 'storeId', 'result']);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertNoCommerceFields(payload);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const result = assertPlainObject(payload.result, 'invalid_result');
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertOnlyKeys(result, ['added', 'failed'], 'invalid_result');
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
  if (!Array.isArray(result.added) || !Array.isArray(result.failed) || result.added.length + result.failed.length > 50) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, 'invalid_result', 'Resultado invalido.');
// Cierra el bloque o la estructura y delimita su alcance.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const added = result.added.map((raw) => {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const item = assertPlainObject(raw, 'invalid_result_item');
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    assertOnlyKeys(item, ['internalId', 'quantity'], 'invalid_result_item');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const internalId = String(item.internalId || '').trim();
// Calcula y conserva un dato inmutable dentro de este alcance.
    const quantity = Number(item.quantity);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!INTERNAL_ID_PATTERN.test(internalId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(400, 'invalid_result_item', 'Producto agregado invalido.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Devuelve un objeto normalizado que forma parte del contrato interno.
    return { internalId, quantity };
// Cierra el bloque o la estructura y delimita su alcance.
  });
// Calcula y conserva un dato inmutable dentro de este alcance.
  const failed = result.failed.map((raw) => {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const item = assertPlainObject(raw, 'invalid_result_item');
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    assertOnlyKeys(item, ['internalId', 'reason'], 'invalid_result_item');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const internalId = String(item.internalId || '').trim();
// Calcula y conserva un dato inmutable dentro de este alcance.
    const reason = String(item.reason || 'cart_add_failed').trim().slice(0, 160);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!INTERNAL_ID_PATTERN.test(internalId)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(400, 'invalid_result_item', 'Producto fallido invalido.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Devuelve un objeto normalizado que forma parte del contrato interno.
    return { internalId, reason };
// Cierra el bloque o la estructura y delimita su alcance.
  });

// Devuelve un objeto normalizado que forma parte del contrato interno.
  return {
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    ticket: assertTicket(payload.ticket),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    processingToken: assertTicket(payload.processingToken),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    storeId: normalizeStoreId(payload.storeId, env),
// Define un campo explícito del objeto que pasa a la siguiente etapa.
    result: { added, failed }
// Cierra el bloque o la estructura y delimita su alcance.
  };
// Cierra el bloque o la estructura y delimita su alcance.
}

// Comprueba ticket y credencial, cierra una única transferencia y evita reenvíos o carreras.
export async function handleCartTransferComplete({ request, env }, deps = {}) {
// Reserva estado mutable porque el valor se completa durante el flujo.
  let origins = new Set();
// Aísla una operación que puede fallar por entrada, red o persistencia.
  try {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    origins = storefrontOrigins(env);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    assertAllowedOrigin(request, origins);
// Aplica la bandera de habilitación antes de cualquier operación con catálogo o tickets.
    requireTransferFeature(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const db = database(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const payload = normalizeCompletionResult(await readJsonBody(request), env);
// Espera la promesa para mantener el orden de validación y persistencia.
    await enforceRateLimit(db, request, 'tiendanube:complete', { limit: 30, windowSeconds: 60, ...(deps.rateLimit || {}) });
// Calcula y conserva un dato inmutable dentro de este alcance.
    const ticketHash = await sha256Hex(payload.ticket, deps.cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const processingTokenHash = await sha256Hex(payload.processingToken, deps.cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const now = nowSeconds(deps);
// Prepara una sentencia D1 sin interpolar datos procedentes de la petición.
    await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'expired', processing_started_at = NULL,
          processing_lease_expires_at = NULL, processing_token_hash = NULL
      WHERE ticket_hash = ? AND store_id = ? AND status = 'processing' AND expires_at <= ?
    `).bind(ticketHash, payload.storeId, now).run();
// Calcula y conserva un dato inmutable dentro de este alcance.
    const transfer = await db.prepare(`
      SELECT status, expires_at, processing_token_hash,
             resolved_items_json, unavailable_items_json
      FROM tiendanube_cart_transfers
      WHERE ticket_hash = ? AND store_id = ?
      LIMIT 1
    `).bind(ticketHash, payload.storeId).first();
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (!transfer) throw new HttpError(404, 'ticket_not_found', 'Ticket inexistente.');
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (transfer.status === 'expired' || Number(transfer.expires_at) <= now) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(410, 'ticket_expired', 'El ticket expiro.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (transfer.status !== 'processing' || transfer.processing_token_hash !== processingTokenHash) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(409, 'ticket_not_processing', 'El ticket no esta disponible para completar.');
// Cierra el bloque o la estructura y delimita su alcance.
    }

// Calcula y conserva un dato inmutable dentro de este alcance.
    const resolved = JSON.parse(transfer.resolved_items_json || '[]');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const unavailable = JSON.parse(transfer.unavailable_items_json || '[]');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const resolvedById = new Map(resolved.map((item) => [String(item.internalId), item]));
// Calcula y conserva un dato inmutable dentro de este alcance.
    const unavailableById = new Map(unavailable.map((item) => [String(item.internalId), item]));
// Calcula y conserva un dato inmutable dentro de este alcance.
    const allowed = new Set([...resolvedById.keys(), ...unavailableById.keys()]);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const reported = [...payload.result.added, ...payload.result.failed];
// Calcula y conserva un dato inmutable dentro de este alcance.
    const outside = reported.filter((item) => !allowed.has(item.internalId)).map((item) => item.internalId);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (outside.length) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(422, 'result_not_in_transfer', 'El resultado contiene productos ajenos al ticket.', { internalIds: outside });
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Calcula y conserva un dato inmutable dentro de este alcance.
    const reportedIds = reported.map((item) => item.internalId);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (new Set(reportedIds).size !== reportedIds.length || reportedIds.length !== allowed.size) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(422, 'result_incomplete', 'El resultado no coincide con los productos entregados por el ticket.');
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Recorre una colección previamente limitada y procesa cada elemento una vez.
    for (const item of payload.result.added) {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const expected = resolvedById.get(item.internalId);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
      if (!expected || item.quantity !== Number(expected.quantity)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
        throw new HttpError(422, 'result_quantity_mismatch', 'El resultado agregado no coincide con el ticket.');
// Cierra el bloque o la estructura y delimita su alcance.
      }
// Cierra el bloque o la estructura y delimita su alcance.
    }
// Recorre una colección previamente limitada y procesa cada elemento una vez.
    for (const item of payload.result.failed) {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const expectedUnavailable = unavailableById.get(item.internalId);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
      if (expectedUnavailable && item.reason !== String(expectedUnavailable.reason)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
        throw new HttpError(422, 'result_reason_mismatch', 'El resultado no coincide con la indisponibilidad validada.');
// Cierra el bloque o la estructura y delimita su alcance.
      }
// Cierra el bloque o la estructura y delimita su alcance.
    }

// Calcula y conserva un dato inmutable dentro de este alcance.
    const completedAt = now;
// Calcula y conserva un dato inmutable dentro de este alcance.
    const result = await db.prepare(`
      UPDATE tiendanube_cart_transfers
      SET status = 'completed', completed_at = ?, completion_json = ?
      WHERE ticket_hash = ? AND store_id = ? AND status = 'processing'
        AND processing_token_hash = ? AND expires_at > ?
    `).bind(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      completedAt,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      JSON.stringify(payload.result),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      ticketHash,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      payload.storeId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      processingTokenHash,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      now
// Ejecuta la mutación preparada y conserva metadatos para comprobar el cambio.
    ).run();
// Calcula y conserva un dato inmutable dentro de este alcance.
    const changes = Number(result && result.meta && result.meta.changes || 0);
// Evalúa una precondición y corta el flujo ante estado inválido o no autorizado.
    if (changes !== 1) throw new HttpError(409, 'ticket_already_completed', 'El ticket ya fue completado.');

// Entrega el resultado ya validado y termina esta rama.
    return jsonResponse({ ok: true }, 200, request, origins);
// Captura el fallo y lo traduce sin revelar material sensible.
  } catch (error) {
// Entrega el resultado ya validado y termina esta rama.
    return errorResponse(error, request, origins);
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Cierra el bloque o la estructura y delimita su alcance.
}

// Responde la negociación CORS del alcance solicitado usando la misma lista de orígenes.
export function handleCartTransferOptions({ request, env }, scope) {
// Reserva estado mutable porque el valor se completa durante el flujo.
  let origins = new Set();
// Aísla una operación que puede fallar por entrada, red o persistencia.
  try {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    origins = scope === 'setup' ? setupOrigins(env) : storefrontOrigins(env);
// Entrega el resultado ya validado y termina esta rama.
    return optionsResponse(request, origins);
// Captura el fallo y lo traduce sin revelar material sensible.
  } catch (error) {
// Entrega el resultado ya validado y termina esta rama.
    return errorResponse(error, request, origins);
// Cierra el bloque o la estructura y delimita su alcance.
  }
// Cierra el bloque o la estructura y delimita su alcance.
}
