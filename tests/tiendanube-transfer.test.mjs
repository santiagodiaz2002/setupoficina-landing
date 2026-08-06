import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  handleCartTransfer,
  handleCartTransferComplete,
  handleCartTransferConsume,
  handleCartTransferOptions,
  normalizeSelectionPayload
} from '../functions/_lib/tiendanube/transfers.mjs';
import { handlePrivacyWebhook } from '../functions/_lib/tiendanube/privacy.mjs';
import { enforceRateLimit } from '../functions/_lib/tiendanube/rate-limit.mjs';
import { timingSafeEqual, verifyWebhookHmac } from '../functions/_lib/tiendanube/security.mjs';
import { TiendanubeApiError } from '../functions/_lib/tiendanube/client.mjs';
import {
  FakeTiendanubeClient,
  MemoryD1,
  PRODUCT_IDS,
  catalogRows,
  envFor,
  jsonRequest,
  productFor,
  productsFor
} from './helpers/tiendanube-d1.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESETS = Object.freeze({
  starter: ['soporte_notebook', 'mouse_vertical', 'mousepad_xxl'],
  pro: ['soporte_notebook', 'soporte_monitor', 'teclado_mec', 'mouse_vertical', 'mousepad_xxl', 'hub_usb', 'organizador_prem', 'luz_led'],
  epic: ['standing_desk', 'soporte_notebook', 'soporte_monitor', 'teclado_mec', 'mouse_vertical', 'mousepad_xxl', 'hub_usb', 'organizador_prem', 'luz_led'],
  personalizada: ['soporte_notebook', 'hub_usb', 'reposamuñecas']
});

function transferPayload(ids, requestId = '123e4567-e89b-42d3-a456-426614174000') {
  return {
    clientRequestId: requestId,
    items: ids.map((internalId) => ({ internalId, quantity: 1 }))
  };
}

async function prepare(ids, options = {}) {
  const db = options.db || new MemoryD1(catalogRows());
  const client = options.client || new FakeTiendanubeClient(productsFor(Object.keys(PRODUCT_IDS)));
  const env = envFor(db, options.env || {});
  const response = await handleCartTransfer({
    request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(ids, options.requestId)),
    env
  }, { client, now: options.now || 1000 });
  return { response, db, client, env };
}

for (const [name, ids] of Object.entries(PRESETS)) {
  test(`crea ticket para seleccion ${name} usando solo IDs internos`, async () => {
    const { response, db } = await prepare(ids);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.available.length, ids.length);
    const redirect = new URL(body.redirectUrl);
    assert.equal(redirect.origin, 'https://primoffice2.mitiendanube.com');
    const ticket = redirect.searchParams.get('setupoficina_ticket');
    assert.match(ticket, /^[A-Za-z0-9_-]{43}$/);

    const [stored] = db.transfers.values();
    assert.match(stored.ticket_hash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(stored).includes(ticket), false);
    assert.doesNotMatch(stored.resolved_items_json, /"price"/i);
    assert.equal(stored.expires_at - stored.created_at, 600);
    assert.deepEqual(JSON.parse(stored.selection_json), transferPayload(ids).items);
  });
}

test('rechaza IDs fuera del catalogo antes de consultar Tiendanube', async () => {
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
  const client = new FakeTiendanubeClient(productsFor(['soporte_notebook']));
  const response = await handleCartTransfer({
    request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(['producto_inventado'])),
    env: envFor(db)
  }, { client, now: 1000 });
  assert.equal(response.status, 422);
  assert.equal(client.calls.length, 0);
  assert.equal(db.transfers.size, 0);
});

test('producto 404 queda informado como no disponible y 401 corta la transferencia', async () => {
  const missing = await prepare(['soporte_notebook'], {
    client: {
      async getProduct() {
        throw new TiendanubeApiError(404, 'not_found', 'missing');
      }
    }
  });
  assert.equal(missing.response.status, 201);
  const missingBody = await missing.response.json();
  assert.equal(missingBody.available.length, 0);
  assert.equal(missingBody.unavailable[0].reason, 'product_not_found');

  const unauthorized = await prepare(['soporte_notebook'], {
    requestId: '123e4567-e89b-42d3-a456-426614174099',
    client: {
      async getProduct() {
        throw new TiendanubeApiError(401, 'unauthorized', 'secret must not leak');
      }
    }
  });
  assert.equal(unauthorized.response.status, 502);
  const unauthorizedBody = await unauthorized.response.json();
  assert.equal(unauthorizedBody.error, 'tiendanube_authorization_error');
  assert.doesNotMatch(JSON.stringify(unauthorizedBody), /secret must not leak/);
});

test('visibility acepta visible y unlisted, rechaza hidden y conserva el fallback legacy', async () => {
  for (const visibility of ['visible', 'unlisted']) {
    const accepted = await prepare(['soporte_notebook'], {
      client: new FakeTiendanubeClient({
        [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
          visibility,
          published: false
        })
      })
    });
    const body = await accepted.response.json();
    assert.equal(body.available.length, 1);
    assert.equal(body.unavailable.length, 0);
  }

  const hidden = await prepare(['soporte_notebook'], {
    client: new FakeTiendanubeClient({
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', { visibility: 'hidden' })
    })
  });
  assert.equal((await hidden.response.json()).unavailable[0].reason, 'product_hidden');

  const unpublishedLegacy = await prepare(['soporte_notebook'], {
    client: new FakeTiendanubeClient({
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', { published: false })
    })
  });
  assert.equal((await unpublishedLegacy.response.json()).unavailable[0].reason, 'product_unpublished_legacy');
});

test('despues de visibility se siguen validando variante, stock y precio', async () => {
  const hiddenVariant = await prepare(['soporte_notebook'], {
    client: new FakeTiendanubeClient({
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
        visibility: 'visible',
        variant: { visible: false }
      })
    })
  });
  assert.equal((await hiddenVariant.response.json()).unavailable[0].reason, 'variant_hidden');

  const missingVariant = await prepare(['soporte_notebook'], {
    client: new FakeTiendanubeClient({
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
        visibility: 'visible',
        variants: []
      })
    })
  });
  assert.equal((await missingVariant.response.json()).unavailable[0].reason, 'variant_not_found');

  const noStock = await prepare(['soporte_notebook'], {
    client: new FakeTiendanubeClient({
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
        visibility: 'unlisted',
        variant: { stock: 0, inventory_levels: [{ location_id: 'loc-1', stock: 0 }] }
      })
    })
  });
  assert.equal((await noStock.response.json()).unavailable[0].reason, 'insufficient_stock');

  const noPrice = await prepare(['soporte_notebook'], {
    client: new FakeTiendanubeClient({
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
        visibility: 'visible',
        variant: { price: '', promotional_price: null }
      })
    })
  });
  assert.equal((await noPrice.response.json()).unavailable[0].reason, 'price_unavailable');
});

test('feature flag backend permanece apagado por defecto', async () => {
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
  const response = await handleCartTransfer({
    request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(['soporte_notebook'])),
    env: envFor(db, { TIENDANUBE_ENABLED: 'false' })
  }, { client: new FakeTiendanubeClient(productsFor(['soporte_notebook'])), now: 1000 });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'feature_disabled');
  assert.equal(db.transfers.size, 0);
});

test('no acepta product_id, variant_id, SKU ni precio desde el frontend', () => {
  for (const extra of [
    { product_id: 1 },
    { variantId: 2 },
    { SKU: 'ABC' },
    { price: 10 }
  ]) {
    assert.throws(() => normalizeSelectionPayload({
      ...transferPayload(['soporte_notebook']),
      items: [{ internalId: 'soporte_notebook', quantity: 1, ...extra }]
    }), /IDs ni precios|campos no permitidos/);
  }
});

test('transferencia exige un Content-Type JSON valido', async () => {
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
  const request = new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-malformed',
      Origin: 'https://setupoficina.com.ar'
    },
    body: JSON.stringify(transferPayload(['soporte_notebook']))
  });
  const response = await handleCartTransfer({ request, env: envFor(db) }, {
    client: new FakeTiendanubeClient(productsFor(['soporte_notebook'])),
    now: 1000
  });
  assert.equal(response.status, 415);
  assert.equal(db.transfers.size, 0);
});

test('incorporacion parcial conserva disponibles e informa faltantes', async () => {
  const ids = ['soporte_notebook', 'organizador_prem'];
  const products = productsFor(ids);
  products[String(PRODUCT_IDS.organizador_prem[0])] = productFor('organizador_prem', {
    variant: { inventory_levels: [{ location_id: 'loc-1', stock: 0 }], stock: 99 }
  });
  const { response, db } = await prepare(ids, {
    client: new FakeTiendanubeClient(products)
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.deepEqual(body.available.map((item) => item.internalId), ['soporte_notebook']);
  assert.deepEqual(body.unavailable.map((item) => [item.internalId, item.reason]), [
    ['organizador_prem', 'insufficient_stock']
  ]);
  const [stored] = db.transfers.values();
  assert.equal(JSON.parse(stored.resolved_items_json).length, 1);
  assert.equal(JSON.parse(stored.unavailable_items_json).length, 1);
});

test('ticket se consume una sola vez y luego se completa una sola vez', async () => {
  const { response, db, env } = await prepare(PRESETS.starter);
  const prepared = await response.json();
  const ticket = new URL(prepared.redirectUrl).searchParams.get('setupoficina_ticket');
  const consumeRequest = () => jsonRequest(
    'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
    { ticket, storeId: '12345' },
    'https://primoffice2.mitiendanube.com'
  );

  const first = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1010 });
  assert.equal(first.status, 200);
  const consumed = await first.json();
  assert.equal(consumed.items.length, PRESETS.starter.length);
  assert.match(consumed.processingToken, /^[A-Za-z0-9_-]{43}$/);

  const reused = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1011 });
  assert.equal(reused.status, 409);
  assert.equal((await reused.json()).error, 'ticket_processing');

  const result = {
    added: PRESETS.starter.map((internalId) => ({ internalId, quantity: 1 })),
    failed: []
  };
  const completeRequest = () => jsonRequest(
    'https://setupoficina.com.ar/api/tiendanube/cart-transfer/complete',
    { ticket, processingToken: consumed.processingToken, storeId: '12345', result },
    'https://primoffice2.mitiendanube.com'
  );
  const completed = await handleCartTransferComplete({ request: completeRequest(), env }, { now: 1020 });
  assert.equal(completed.status, 200);
  const repeatedCompletion = await handleCartTransferComplete({ request: completeRequest(), env }, { now: 1021 });
  assert.equal(repeatedCompletion.status, 409);
  assert.equal([...db.transfers.values()][0].status, 'completed');
});

test('processing abandonado se recupera con lease y token de procesamiento nuevo', async () => {
  const { response, db, env } = await prepare(['soporte_notebook']);
  const ticket = new URL((await response.json()).redirectUrl).searchParams.get('setupoficina_ticket');
  const consumeRequest = () => jsonRequest(
    'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
    { ticket, storeId: '12345' },
    'https://primoffice2.mitiendanube.com'
  );
  const first = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1010 });
  const firstBody = await first.json();
  assert.equal((await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1099 })).status, 409);
  const recovered = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1100 });
  assert.equal(recovered.status, 200);
  const recoveredBody = await recovered.json();
  assert.notEqual(recoveredBody.processingToken, firstBody.processingToken);

  const staleCompletion = await handleCartTransferComplete({
    request: jsonRequest(
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/complete',
      {
        ticket,
        processingToken: firstBody.processingToken,
        storeId: '12345',
        result: { added: [{ internalId: 'soporte_notebook', quantity: 1 }], failed: [] }
      },
      'https://primoffice2.mitiendanube.com'
    ),
    env
  }, { now: 1101 });
  assert.equal(staleCompletion.status, 409);
  assert.equal([...db.transfers.values()][0].status, 'processing');
});

test('complete acepta solo el conjunto y cantidades entregados por consume', async () => {
  const ids = ['soporte_notebook', 'organizador_prem'];
  const products = productsFor(ids);
  products[String(PRODUCT_IDS.organizador_prem[0])] = productFor('organizador_prem', {
    variant: { inventory_levels: [{ stock: 0 }], stock: 0 }
  });
  const { response, env } = await prepare(ids, { client: new FakeTiendanubeClient(products) });
  const ticket = new URL((await response.json()).redirectUrl).searchParams.get('setupoficina_ticket');
  const consumed = await handleCartTransferConsume({
    request: jsonRequest(
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
      { ticket, storeId: '12345' },
      'https://primoffice2.mitiendanube.com'
    ),
    env
  }, { now: 1010 });
  const consumeBody = await consumed.json();
  const malicious = await handleCartTransferComplete({
    request: jsonRequest(
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/complete',
      {
        ticket,
        processingToken: consumeBody.processingToken,
        storeId: '12345',
        result: {
          added: [{ internalId: 'organizador_prem', quantity: 1 }],
          failed: [{ internalId: 'soporte_notebook', reason: 'cart_add_failed' }]
        }
      },
      'https://primoffice2.mitiendanube.com'
    ),
    env
  }, { now: 1020 });
  assert.equal(malicious.status, 422);
});

test('ticket pendiente expira exactamente a los diez minutos', async () => {
  const { response, env } = await prepare(['soporte_notebook'], { now: 5000 });
  const ticket = new URL((await response.json()).redirectUrl).searchParams.get('setupoficina_ticket');
  const consume = await handleCartTransferConsume({
    request: jsonRequest(
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
      { ticket, storeId: '12345' },
      'https://primoffice2.mitiendanube.com'
    ),
    env
  }, { now: 5600 });
  assert.equal(consume.status, 410);
  assert.equal((await consume.json()).error, 'ticket_expired');
});

test('CORS usa lista cerrada para landing y storefront', async () => {
  const db = new MemoryD1(catalogRows());
  const env = envFor(db);
  const allowed = handleCartTransferOptions({
    request: new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
      method: 'OPTIONS',
      headers: { Origin: 'https://setupoficina.com.ar' }
    }),
    env
  }, 'setup');
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://setupoficina.com.ar');

  const rejected = handleCartTransferOptions({
    request: new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' }
    }),
    env
  }, 'setup');
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
  assert.notEqual(allowed.headers.get('Access-Control-Allow-Origin'), '*');

  const missingConfig = handleCartTransferOptions({
    request: new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
      method: 'OPTIONS',
      headers: { Origin: 'https://setupoficina.com.ar' }
    }),
    env: envFor(db, { TIENDANUBE_ALLOWED_SETUP_ORIGINS: '' })
  }, 'setup');
  assert.equal(missingConfig.status, 503);
  assert.equal(missingConfig.headers.get('Access-Control-Allow-Origin'), null);
});

test('storefront faltante o fuera de allowlist falla antes de crear el ticket', async () => {
  for (const storefrontUrl of ['', 'https://evil.example/']) {
    const db = new MemoryD1(catalogRows(['soporte_notebook']));
    const client = new FakeTiendanubeClient(productsFor(['soporte_notebook']));
    const response = await handleCartTransfer({
      request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(['soporte_notebook'])),
      env: envFor(db, { TIENDANUBE_STOREFRONT_URL: storefrontUrl })
    }, { client, now: 1000 });
    assert.equal(response.status, 503);
    assert.equal(db.transfers.size, 0);
    assert.equal(client.calls.length, 0);
  }
});

test('rate limit D1 bloquea al superar la ventana', async () => {
  const db = new MemoryD1();
  const request = new Request('https://setupoficina.com.ar/api/test', {
    headers: { Origin: 'https://setupoficina.com.ar', 'CF-Connecting-IP': '203.0.113.40' }
  });
  await enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 100 });
  await enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 101 });
  await assert.rejects(
    enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 102 }),
    (error) => error.status === 429 && error.code === 'rate_limited'
  );
  const reset = await enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 300 });
  assert.equal(reset.count, 1);
  assert.equal(db.rates.size, 1);
});

test('webhooks verifican HMAC SHA-256 sobre el cuerpo crudo', async () => {
  const raw = new TextEncoder().encode('{"store_id":12345, "spacing": true}');
  const signature = createHmac('sha256', 'test-client-secret').update(raw).digest('hex');
  assert.equal(await verifyWebhookHmac(raw, signature, 'test-client-secret'), true);
  assert.equal(await verifyWebhookHmac(new TextEncoder().encode('{"store_id":12345}'), signature, 'test-client-secret'), false);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3])), false);
});

test('webhooks rechazan firma faltante antes de procesar el payload', async () => {
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
  const request = new Request('https://setupoficina.com.ar/api/tiendanube/privacy/store-redact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: 12345 })
  });
  const response = await handlePrivacyWebhook({ request, env: envFor(db) }, 'store-redact');
  assert.equal(response.status, 401);
  assert.equal(db.catalog.size, 1);
});

test('rutas de privacidad exponen exclusivamente el handler POST', async () => {
  for (const route of [
    '../functions/api/tiendanube/privacy/store-redact.js',
    '../functions/api/tiendanube/privacy/customers-redact.js',
    '../functions/api/tiendanube/privacy/customers-data-request.js'
  ]) {
    const module = await import(route);
    assert.deepEqual(Object.keys(module), ['onRequestPost']);
  }
});

async function signedWebhook(type, payload, db, secret = 'test-client-secret', envOverrides = {}) {
  const raw = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  const request = new Request(`https://setupoficina.com.ar/api/tiendanube/privacy/${type}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-linkedstore-hmac-sha256': signature,
      'CF-Connecting-IP': '198.51.100.10',
      'User-Agent': 'tiendanube-webhook'
    },
    body: raw
  });
  return handlePrivacyWebhook({ request, env: envFor(db, envOverrides) }, type, { rateLimit: { now: 2000 } });
}

test('store-redact elimina solo datos del puente y es idempotente', async () => {
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
  db.transfers.set('hash', { store_id: '12345' });
  db.oauthStates.set('state-hash', { environment: 'production', store_id: '12345', expires_at: 9999, consumed_at: 1900 });
  db.installations.set('12345', { store_id: '12345', revoked_at: null });
  const first = await signedWebhook(
    'store-redact',
    { store_id: 12345 },
    db,
    'test-client-secret',
    { TIENDANUBE_STORE_ID: '' }
  );
  assert.equal(first.status, 200);
  assert.equal(db.catalog.size, 0);
  assert.equal(db.transfers.size, 0);
  assert.equal(db.oauthStates.size, 0);
  assert.equal(db.installations.size, 0);
  const second = await signedWebhook('store-redact', { store_id: 12345 }, db);
  assert.equal(second.status, 200);
});

test('webhook invalido no procesa PII y endpoints de cliente informan que no se almacena', async () => {
  const db = new MemoryD1();
  const bad = await signedWebhook('customers-redact', { store_id: 12345, customer: { email: 'persona@example.com' } }, db, 'wrong-secret');
  assert.equal(bad.status, 401);

  const redact = await signedWebhook('customers-redact', { store_id: 12345, customer: { id: 9 } }, db);
  assert.deepEqual(await redact.json(), { ok: true, redacted: false, reason: 'no_customer_data_stored' });
  const dataRequest = await signedWebhook('customers-data-request', { store_id: 12345, customer: { id: 9 } }, db);
  assert.deepEqual(await dataRequest.json(), { ok: true, data: [], reason: 'no_customer_data_stored' });
});

test('migracion crea las cinco tablas Tiendanube y no altera leads', async () => {
  const sql = await readFile(path.join(root, 'db/migrations/0001_tiendanube_cart_bridge.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_catalog/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_cart_transfers/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_rate_limits/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_oauth_states/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_installations/);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+leads/i);
  assert.doesNotMatch(sql, /DROP\s+TABLE/i);
});
