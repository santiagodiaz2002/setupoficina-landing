import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TiendanubeApiError,
  TiendanubeClient,
  availableStock,
  currentPrice
} from '../functions/_lib/tiendanube/client.mjs';

function client(fetchImpl, overrides = {}) {
  return new TiendanubeClient({
    storeId: '12345',
    accessToken: 'token-for-tests',
    userAgent: 'setupoficina (tests@example.com)',
    timeoutMs: 100,
    maxRetries: 1,
    fetchImpl,
    sleepImpl: async () => {},
    ...overrides
  });
}

test('cliente usa API 2025-03, Bearer y User-Agent configurado', async () => {
  let captured;
  const api = client(async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ id: 99 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  await api.getProduct(99);
  assert.equal(captured.url, 'https://api.tiendanube.com/2025-03/12345/products/99');
  assert.equal(captured.options.headers.Authorization, 'Bearer token-for-tests');
  assert.equal(captured.options.headers['User-Agent'], 'setupoficina (tests@example.com)');
  assert.throws(() => new TiendanubeClient({
    storeId: '12345',
    accessToken: 'token-for-tests'
  }), (error) => error.code === 'client_configuration_invalid');
});

test('reintenta 429 y 5xx solo para lecturas seguras', async () => {
  const statuses = [429, 500, 200];
  let readCalls = 0;
  const readClient = client(async () => {
    const status = statuses[readCalls++];
    return new Response(status === 200 ? '{"ok":true}' : '{}', {
      status,
      headers: status === 429
        ? { 'Retry-After': '0' }
        : status === 200 ? { 'Content-Type': 'application/json' } : {}
    });
  }, { maxRetries: 2 });
  assert.deepEqual(await readClient.request('/products/1'), { ok: true });
  assert.equal(readCalls, 3);

  let writeCalls = 0;
  const writeClient = client(async () => {
    writeCalls += 1;
    return new Response('{}', { status: 500 });
  }, { maxRetries: 3 });
  await assert.rejects(
    writeClient.request('/scripts', { method: 'POST', body: '{}' }),
    (error) => error instanceof TiendanubeApiError && error.status === 500
  );
  assert.equal(writeCalls, 1);
});

for (const [status, code] of [
  [401, 'unauthorized'],
  [403, 'forbidden'],
  [404, 'not_found'],
  [409, 'conflict'],
  [422, 'unprocessable_entity'],
  [429, 'rate_limited'],
  [503, 'upstream_error']
]) {
  test(`clasifica respuesta Tiendanube ${status}`, async () => {
    let calls = 0;
    const api = client(async () => {
      calls += 1;
      return new Response('{}', { status });
    });
    await assert.rejects(
      api.getProduct(1),
      (error) => error instanceof TiendanubeApiError && error.status === status && error.code === code
    );
    assert.equal(calls, status === 429 || status >= 500 ? 2 : 1);
  });
}

test('aplica timeout y no expone el token en el error', async () => {
  const api = client((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted token-for-tests');
      error.name = 'AbortError';
      reject(error);
    });
  }), { timeoutMs: 5 });
  await assert.rejects(api.getProduct(1), (error) => {
    assert.equal(error.code, 'timeout');
    assert.doesNotMatch(error.message, /token-for-tests/);
    return true;
  });

  const stalledBody = client(async (_url, options) => new Response(new ReadableStream({
    start(controller) {
      options.signal.addEventListener('abort', () => {
        const error = new Error('body aborted token-for-tests');
        error.name = 'AbortError';
        controller.error(error);
      });
    }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }), {
    timeoutMs: 5,
    maxRetries: 0
  });
  await assert.rejects(stalledBody.getProduct(1), (error) => {
    assert.equal(error.code, 'timeout');
    assert.doesNotMatch(error.message, /token-for-tests/);
    return true;
  });
});

test('respeta Retry-After y valida content-type y tamaño antes de parsear JSON', async () => {
  const delays = [];
  let calls = 0;
  const retrying = client(async () => {
    calls += 1;
    if (calls === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '3' } });
    return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, { sleepImpl: async (delay) => delays.push(delay) });
  assert.deepEqual(await retrying.getProduct(1), { ok: true });
  assert.deepEqual(delays, [3000]);

  await assert.rejects(
    client(async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'text/html' } })).getProduct(1),
    (error) => error.code === 'invalid_content_type'
  );
  await assert.rejects(
    client(async () => new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Length': '999' }
    }), { maxResponseBytes: 20 }).getProduct(1),
    (error) => error.code === 'response_too_large'
  );
});

test('inventory_levels tiene prioridad sobre stock y soporta inventario infinito', () => {
  assert.equal(availableStock({
    stock_management: true,
    stock: 99,
    inventory_levels: [{ stock: 0 }, { stock: 3 }]
  }), 3);
  assert.equal(availableStock({ stock_management: false, stock: 0, inventory_levels: [] }), Number.POSITIVE_INFINITY);
  assert.equal(availableStock({ stock_management: true, inventory_levels: [{ stock: '' }] }), Number.POSITIVE_INFINITY);
  assert.equal(availableStock({ stock_management: true, stock: 4 }), 4);
});

test('precio promocional real prevalece y precios invalidos se descartan', () => {
  assert.equal(currentPrice({ price: '100.00', promotional_price: '80.50' }), '80.50');
  assert.equal(currentPrice({ price: '100.00', promotional_price: '' }), '100.00');
  assert.equal(currentPrice({ price: 'gratis' }), '');
});
