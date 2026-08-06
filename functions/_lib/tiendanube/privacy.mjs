import { HttpError, errorResponse, jsonResponse } from './http.mjs';
import { enforceRateLimit } from './rate-limit.mjs';
import { optionalConfiguredStoreId } from './installations.mjs';
import { verifyWebhookHmac } from './security.mjs';

const WEBHOOK_TYPES = new Set(['store-redact', 'customers-redact', 'customers-data-request']);

function database(env) {
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
  return env.LEADS_DB;
}

async function rawWebhookBody(request, maxBytes = 64 * 1024) {
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, 'payload_too_large', 'Webhook demasiado grande.');
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > maxBytes) throw new HttpError(413, 'payload_too_large', 'Webhook demasiado grande.');
  return body;
}

function parseWebhookJson(rawBody) {
  try {
    const payload = JSON.parse(new TextDecoder().decode(rawBody));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid');
    return payload;
  } catch (_) {
    throw new HttpError(400, 'invalid_webhook_json', 'JSON de webhook invalido.');
  }
}

async function deleteStoreData(db, storeId, now) {
  const statements = [
    db.prepare('DELETE FROM tiendanube_cart_transfers WHERE store_id = ?').bind(storeId),
    db.prepare('DELETE FROM tiendanube_installations WHERE store_id = ?').bind(storeId),
    db.prepare('DELETE FROM tiendanube_oauth_states WHERE store_id = ? OR expires_at <= ?').bind(storeId, now),
    db.prepare('DELETE FROM tiendanube_catalog WHERE store_id = ?').bind(storeId),
    db.prepare("DELETE FROM tiendanube_rate_limits WHERE route LIKE 'tiendanube:%'")
  ];
  if (typeof db.batch === 'function') {
    await db.batch(statements);
    return;
  }
  for (const statement of statements) await statement.run();
}

export async function handlePrivacyWebhook({ request, env }, type, deps = {}) {
  try {
    if (!WEBHOOK_TYPES.has(type)) throw new HttpError(404, 'webhook_not_found', 'Webhook inexistente.');
    const rawBody = await rawWebhookBody(request);
    const signature = request.headers.get('x-linkedstore-hmac-sha256') || '';
    const verified = await verifyWebhookHmac(rawBody, signature, env.TIENDANUBE_CLIENT_SECRET, deps.cryptoImpl);
    if (!verified) throw new HttpError(401, 'invalid_webhook_signature', 'Firma de webhook invalida.');

    const payload = parseWebhookJson(rawBody);
    const storeId = String(payload.store_id ?? '').trim();
    if (!/^\d+$/.test(storeId)) throw new HttpError(400, 'invalid_store_id', 'Webhook invalido.');
    const configuredId = optionalConfiguredStoreId(env);
    if (configuredId && storeId !== configuredId) throw new HttpError(403, 'store_mismatch', 'Tienda no autorizada.');
    const db = database(env);
    await enforceRateLimit(db, request, `tiendanube:privacy:${type}`, {
      limit: 120,
      windowSeconds: 60,
      ...(deps.rateLimit || {})
    });

    if (type === 'store-redact') {
      await deleteStoreData(db, storeId, Number(deps.now ?? Math.floor(Date.now() / 1000)));
      return jsonResponse({ ok: true, redacted: true }, 200);
    }

    // La aplicacion no solicita scopes de clientes/pedidos y no persiste PII.
    if (type === 'customers-redact') {
      return jsonResponse({ ok: true, redacted: false, reason: 'no_customer_data_stored' }, 200);
    }
    return jsonResponse({ ok: true, data: [], reason: 'no_customer_data_stored' }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
