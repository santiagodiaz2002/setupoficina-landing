import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createLazySequentialCartAdder,
  createSequentialCartAdder
} from '../tiendanube-script/src/transfer-core.mjs';
import {
  RESULT_ROUTE,
  RESULT_STORAGE_KEY,
  createLocationCoordinator,
  displayStoredResult,
  isResultLocation,
  persistResultAndNavigate,
  summarizeDisplayResult
} from '../tiendanube-script/src/storefront-flow.mjs';
import {
  PRODUCTION_BACKEND_URL,
  resolveBackendUrl,
  validateBackendUrl
} from '../tiendanube-script/build/backend-url.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbiddenEdgeSlot = ['edge', 'bottom', 'center'].join('_');

function nubeHarness(outcomes) {
  const listeners = new Map();
  const sent = [];
  const cart = [{ product_id: 999, variant_id: 9991, quantity: 2, name: 'Producto previo' }];
  let index = 0;
  const nube = {
    on(event, handler) { listeners.set(event, handler); },
    off(event, handler) { if (listeners.get(event) === handler) listeners.delete(event); },
    send(event, modifier) {
      const state = modifier();
      sent.push({ event, state });
      const item = state.cart.items[0];
      const outcome = outcomes[index++];
      queueMicrotask(() => {
        if (outcome === 'success') {
          cart.push({ ...item, name: `Producto ${item.product_id}` });
          listeners.get('cart:add:success')?.({ eventPayload: { ...item, name: `Producto ${item.product_id}` } });
        } else {
          listeners.get('cart:add:fail')?.({ eventPayload: null });
        }
      });
    }
  };
  return { nube, sent, cart, listeners };
}

const ITEMS = [
  { internalId: 'soporte_notebook', productId: 10, variantId: 101, quantity: 1, name: 'Soporte' },
  { internalId: 'hub_usb', productId: 20, variantId: 201, quantity: 2, name: 'Hub' }
];

function browserHarness(initialValue = null) {
  let value = initialValue;
  const calls = [];
  const browser = {
    asyncSessionStorage: {
      async getItem(key) {
        calls.push(['get', key]);
        return value;
      },
      async setItem(key, nextValue, ttl) {
        calls.push(['set', key, ttl]);
        value = nextValue;
      },
      async removeItem(key) {
        calls.push(['remove', key]);
        value = null;
      }
    },
    navigate(route) { calls.push(['navigate', route]); }
  };
  return { browser, calls, value: () => value };
}

function state(url, queries = {}) {
  return { location: { url, queries }, store: { id: 1234 } };
}

test('NubeSDK agrega secuencialmente y conserva el carrito previo', async () => {
  const harness = nubeHarness(['success', 'success']);
  const adder = createSequentialCartAdder(harness.nube, { timeoutMs: 100 });
  const results = await adder.addSequentially(ITEMS);
  adder.dispose();
  assert.deepEqual(results.map((result) => result.ok), [true, true]);
  assert.deepEqual(harness.sent.map((entry) => entry.event), ['cart:add', 'cart:add']);
  assert.equal(harness.cart[0].name, 'Producto previo');
  assert.equal(harness.cart[0].quantity, 2);
  assert.equal(harness.cart.length, 3);
  assert.equal(harness.listeners.size, 0);
});

test('incorporacion parcial continua despues de cart:add:fail', async () => {
  const harness = nubeHarness(['success', 'fail']);
  const adder = createSequentialCartAdder(harness.nube, { timeoutMs: 100 });
  const results = await adder.addSequentially(ITEMS);
  adder.dispose();
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(results[1].reason, 'cart_add_failed');
  assert.equal(harness.sent.length, 2);
  assert.equal(harness.cart.some((item) => item.product_id === 999), true);
});

test('cart:add con timeout falla y el mismo adder conserva un unico juego de listeners', async () => {
  const listeners = new Map();
  const sent = [];
  const nube = {
    on(event, handler) { listeners.set(event, handler); },
    off(event, handler) { if (listeners.get(event) === handler) listeners.delete(event); },
    send(event, modifier) { sent.push({ event, state: modifier() }); }
  };
  const adder = createSequentialCartAdder(nube, { timeoutMs: 1 });
  assert.equal(listeners.size, 2);
  const first = await adder.addSequentially([ITEMS[0]]);
  const second = await adder.addSequentially([ITEMS[1]]);
  assert.deepEqual([first[0].reason, second[0].reason], ['cart_add_timeout', 'cart_add_timeout']);
  assert.equal(sent.length, 2);
  assert.equal(listeners.size, 2);
  adder.dispose();
  assert.equal(listeners.size, 0);
});

test('una visita sin ticket no registra listeners de carrito y el adder se inicia una sola vez al usarlo', async () => {
  const harness = nubeHarness(['success', 'success']);
  const adder = createLazySequentialCartAdder(harness.nube, { timeoutMs: 100 });
  assert.equal(harness.listeners.size, 0);
  await adder.addSequentially([ITEMS[0]]);
  assert.equal(harness.listeners.size, 2);
  await adder.addSequentially([ITEMS[1]]);
  assert.equal(harness.listeners.size, 2);
  adder.dispose();
  assert.equal(harness.listeners.size, 0);
});

test('script cumple el contrato NubeSDK sin DOM y escucha navegacion interna', async () => {
  const main = await readFile(path.join(root, 'tiendanube-script/src/main.tsx'), 'utf8');
  const core = await readFile(path.join(root, 'tiendanube-script/src/transfer-core.mjs'), 'utf8');
  const flow = await readFile(path.join(root, 'tiendanube-script/src/storefront-flow.mjs'), 'utf8');
  const source = `${main}\n${core}\n${flow}`;
  assert.match(flow, /setupoficina_ticket/);
  assert.match(flow, /String\(state\.store\.id\)/);
  assert.match(main, /cart-transfer\/consume/);
  assert.match(main, /cart-transfer\/complete/);
  assert.match(main, /processingToken: consumed\.processingToken/);
  assert.match(core, /nube\.on\('cart:add:success'/);
  assert.match(core, /nube\.on\('cart:add:fail'/);
  assert.match(core, /nube\.send\('cart:add'/);
  assert.match(main, /nube\.on\('location:updated'/);
  assert.doesNotMatch(source, /\bwindow\b|\bdocument\b|\blocalStorage\b|\bsessionStorage\b|jQuery|cart:remove/);
});

test('resultado se guarda antes de navegar al carrito con el marcador', async () => {
  const harness = browserHarness();
  const result = { added: [], failed: [], preservedExistingCart: true };
  await persistResultAndNavigate(harness.browser, result);
  assert.deepEqual(harness.calls.map((call) => call[0]), ['set', 'navigate']);
  assert.equal(harness.calls[0][1], RESULT_STORAGE_KEY);
  assert.equal(harness.calls[1][1], '/cart?setupoficina_result=1');
  assert.equal(RESULT_ROUTE, '/cart?setupoficina_result=1');
});

test('al entrar al carrito recupera, muestra y elimina el resultado', async () => {
  const stored = JSON.stringify({
    added: [{ name: 'Soporte' }],
    failed: [{ name: 'Luz', reason: 'insufficient_stock' }],
    preservedExistingCart: true
  });
  const harness = browserHarness(stored);
  const shown = [];
  const coordinator = createLocationCoordinator({
    async transfer() { throw new Error('No debe transferir en el carrito.'); },
    displayResult: () => displayStoredResult(harness.browser, async (result) => {
      shown.push(result);
      return true;
    })
  });
  await coordinator.handle(state('https://primoffice.com.ar/cart?setupoficina_result=1', { setupoficina_result: '1' }));
  assert.equal(shown.length, 1);
  assert.deepEqual(harness.calls.map((call) => call[0]), ['get', 'remove']);
  assert.equal(harness.value(), null);
});

test('una recarga posterior no vuelve a mostrar un resultado consumido', async () => {
  const harness = browserHarness(JSON.stringify({ added: [], failed: [] }));
  let renderCalls = 0;
  const render = async () => { renderCalls += 1; return true; };
  assert.equal(await displayStoredResult(harness.browser, render), true);
  assert.equal(await displayStoredResult(harness.browser, render), false);
  assert.equal(renderCalls, 1);
  assert.equal(harness.calls.filter((call) => call[0] === 'remove').length, 1);
});

test('visita normal sin ticket ni marcador no modifica la tienda', async () => {
  const calls = [];
  const coordinator = createLocationCoordinator({
    async transfer() { calls.push('transfer'); },
    async displayResult() { calls.push('display'); return true; }
  });
  await coordinator.handle(state('https://primoffice.com.ar/products', {}));
  assert.deepEqual(calls, []);
  assert.equal(isResultLocation(state('https://primoffice.com.ar/products?setupoficina_result=1', { setupoficina_result: '1' }).location), false);
});

test('resultado parcial distingue agregados, sin stock y otros fallos', () => {
  const summary = summarizeDisplayResult({
    added: [{ name: 'Soporte' }],
    failed: [
      { name: 'Luz', reason: 'insufficient_stock' },
      { name: 'Hub', reason: 'cart_add_failed' }
    ]
  });
  assert.deepEqual(summary.addedNames, ['Soporte']);
  assert.deepEqual(summary.outOfStockNames, ['Luz']);
  assert.deepEqual(summary.failedNames, ['Hub']);
  assert.match(summary.preservedMessage, /Conservamos los productos/);
  assert.equal(summary.variant, 'warning');
});

test('usa slots oficiales comprobados y Toast en corner_top_right', async () => {
  const main = await readFile(path.join(root, 'tiendanube-script/src/main.tsx'), 'utf8');
  assert.match(main, /RESULT_SLOT_IDS = \['corner_top_right', 'modal_content'\]/);
  assert.match(main, /nube\.api\.getAvailableSlots\(\)\.getStatic\(\)/);
  assert.match(main, /slot\.slotId === 'corner_top_right'/);
  assert.match(main, /<Toast\.Root/);
  assert.doesNotMatch(main, /edge_[a-z_]+/);
});

test('documentacion conserva onfirstinteraction y explica la primera interaccion', async () => {
  const docs = await readFile(path.join(root, 'docs/tiendanube-cart-bridge.md'), 'utf8');
  const readme = await readFile(path.join(root, 'tiendanube-script/README.md'), 'utf8');
  const text = `${docs}\n${readme}`;
  assert.match(text, /onfirstinteraction/);
  assert.match(text, /clic, toque o desplazamiento/);
  assert.match(text, /No cambiar el evento a\s*`onload`/);
  assert.match(text, /aprobación previa/);
});

test('backend del script acepta produccion y previews del proyecto, no URLs arbitrarias', () => {
  assert.equal(resolveBackendUrl(undefined), PRODUCTION_BACKEND_URL);
  assert.equal(
    validateBackendUrl('https://branch-123.setupoficina-landing.pages.dev'),
    'https://branch-123.setupoficina-landing.pages.dev'
  );
  assert.throws(() => validateBackendUrl('https://evil.example'), /solo admite/);
  assert.throws(() => validateBackendUrl('http://branch.setupoficina-landing.pages.dev'), /solo admite/);
  assert.throws(() => validateBackendUrl('https://branch.setupoficina-landing.pages.dev/path'), /solo admite/);
});

test('el build publico NubeSDK existe en la salida estatica versionada', async () => {
  await access(path.join(root, 'assets/tiendanube/main.min.js'));
  const artifact = await readFile(path.join(root, 'assets/tiendanube/main.min.js'), 'utf8');
  const buildConfig = await readFile(path.join(root, 'tiendanube-script/tsup.config.js'), 'utf8');
  assert.match(artifact, /setupoficina_cart_transfer_result/);
  assert.match(buildConfig, /outDir:\s*'\.\.\/assets\/tiendanube'/);
  const backend = artifact.match(/https:\/\/(?:setupoficina\.com\.ar|[a-z0-9-]+\.setupoficina-landing\.pages\.dev)/i)?.[0];
  assert.ok(backend, 'El bundle debe contener un backend permitido');
  assert.equal(validateBackendUrl(backend), backend);
  assert.equal(artifact.includes(forbiddenEdgeSlot), false);
  assert.match(artifact, /corner_top_right/);
});
