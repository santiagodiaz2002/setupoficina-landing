import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REDIRECT_TICKET = 'A'.repeat(43);

async function importService() {
  const source = await readFile(path.join(root, 'js/services/tiendanube-cart-transfer.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function config(overrides = {}) {
  return {
    TIENDANUBE_ENABLED: true,
    TIENDANUBE_CART_TRANSFER_URL: '/api/tiendanube/cart-transfer',
    TIENDANUBE_TRANSFER_TIMEOUT_MS: 1000,
    TIENDANUBE_STOREFRONT_ORIGINS: ['https://primoffice2.mitiendanube.com'],
    ...overrides
  };
}

function uiHarness() {
  const attributes = new Map();
  const button = {
    disabled: false,
    hidden: false,
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); }
  };
  const statusAttributes = new Set(['hidden']);
  const status = {
    textContent: '',
    dataset: {},
    setAttribute(name) { statusAttributes.add(name); },
    removeAttribute(name) { statusAttributes.delete(name); }
  };
  const documentImpl = {
    querySelectorAll(selector) { return selector === '[data-tiendanube-only]' ? [button] : [button]; },
    getElementById(id) { return id === 'tiendanube-transfer-status' ? status : null; }
  };
  return { button, status, attributes, statusAttributes, documentImpl };
}

function comboPurchaseHarness(html, enabled) {
  const start = html.indexOf('var PRIMOFFICE_COMBO_URLS=');
  const assignment = 'window.buyComboInPrimOffice=buyComboInPrimOffice;';
  const end = html.indexOf(assignment, start) + assignment.length;
  assert.ok(start >= 0 && end >= assignment.length, 'No se encontro el flujo comercial en index.html');
  const calls = { bridge: 0, opened: [], prepared: [], leads: [] };
  const context = {
    window: {
      PrimOfficeConfig: { TIENDANUBE_ENABLED: enabled },
      open: (...args) => calls.opened.push(args)
    },
    COMBO_PRESETS: { starter: [], pro: [], epic: [] },
    prepareComboPreset: (comboId) => calls.prepared.push(comboId),
    startTiendanubeCartTransfer: () => { calls.bridge += 1; return Promise.resolve({ ok: true }); },
    clearTimeout: () => {},
    pqLeadSession: { cartUpdateTimer: null },
    submitLeadUpdate: (event) => calls.leads.push(event),
    Promise
  };
  vm.runInNewContext(html.slice(start, end), context);
  return { calls, buy: context.window.buyComboInPrimOffice };
}

test('servicio envia solo IDs internos, cantidades y crypto.randomUUID', async () => {
  const service = await importService();
  let request;
  const result = await service.prepareCartTransfer([
    { internalId: 'soporte_notebook', quantity: 2, productId: 999, variant_id: 888, price: 1 }
  ], {
    config: config(),
    cryptoImpl: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        ok: true,
        redirectUrl: `https://primoffice2.mitiendanube.com/?setupoficina_ticket=${REDIRECT_TICKET}`,
        unavailable: []
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  });
  assert.equal(result.ok, true);
  assert.equal(request.url, '/api/tiendanube/cart-transfer');
  assert.deepEqual(JSON.parse(request.options.body), {
    clientRequestId: '123e4567-e89b-42d3-a456-426614174000',
    items: [{ internalId: 'soporte_notebook', quantity: 2 }]
  });
  assert.doesNotMatch(request.options.body, /productId|variant|sku|price/i);
});

test('doble clic dispara una sola solicitud y deshabilita el boton', async () => {
  const service = await importService();
  const ui = uiHarness();
  const assigned = [];
  let resolveFetch;
  let fetchCalls = 0;
  const fetchImpl = () => {
    fetchCalls += 1;
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  const options = {
    config: config(),
    documentImpl: ui.documentImpl,
    locationImpl: { assign: (url) => assigned.push(url) },
    cryptoImpl: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174001' },
    fetchImpl
  };
  const first = service.transferSelection([{ internalId: 'hub_usb', quantity: 1 }], options);
  const second = await service.transferSelection([{ internalId: 'hub_usb', quantity: 1 }], options);
  assert.deepEqual(second, { ok: false, skipped: true, reason: 'in_flight' });
  assert.equal(fetchCalls, 1);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.attributes.get('aria-busy'), 'true');

  resolveFetch(new Response(JSON.stringify({
    ok: true,
    redirectUrl: `https://primoffice2.mitiendanube.com/?setupoficina_ticket=${REDIRECT_TICKET}`,
    unavailable: []
  }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
  await first;
  assert.deepEqual(assigned, [`https://primoffice2.mitiendanube.com/?setupoficina_ticket=${REDIRECT_TICKET}`]);
});

test('rechaza redireccion externa y conserva la configuracion ante error', async () => {
  const service = await importService();
  const ui = uiHarness();
  const assigned = [];
  const items = [{ internalId: 'mouse_vertical', quantity: 1 }];
  const snapshot = JSON.stringify(items);
  await assert.rejects(service.transferSelection(items, {
    config: config(),
    documentImpl: ui.documentImpl,
    locationImpl: { assign: (url) => assigned.push(url) },
    cryptoImpl: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174002' },
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      redirectUrl: 'https://evil.example/steal',
      unavailable: []
    }), { status: 201, headers: { 'Content-Type': 'application/json' } })
  }), /destino no permitido/);
  assert.deepEqual(assigned, []);
  assert.equal(JSON.stringify(items), snapshot);
  assert.equal(ui.button.disabled, false);
  assert.match(ui.status.textContent, /destino no permitido/);
});

test('feature flag false conserva botones principales utilizables y oculta la accion exclusiva del puente', async () => {
  const service = await importService();
  const ui = uiHarness();
  service.syncTiendanubeTransferUi({
    documentImpl: ui.documentImpl,
    config: config({ TIENDANUBE_ENABLED: false })
  });
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.button.hidden, true);
  const result = await service.transferSelection([{ internalId: 'hub_usb', quantity: 1 }], {
    documentImpl: ui.documentImpl,
    config: config({ TIENDANUBE_ENABLED: false })
  });
  assert.equal(result.reason, 'disabled');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.status.textContent, '');
  assert.equal(ui.statusAttributes.has('hidden'), true);
});

test('feature flag true habilita y muestra la accion del nuevo puente', async () => {
  const service = await importService();
  const ui = uiHarness();
  service.syncTiendanubeTransferUi({ documentImpl: ui.documentImpl, config: config() });
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.button.hidden, false);
});

test('feature flag false abre las URLs historicas de Starter, Pro y Epic', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const harness = comboPurchaseHarness(html, false);
  for (const [combo, url] of [
    ['starter', 'https://www.primoffice.com.ar/combo-starter/'],
    ['pro', 'https://www.primoffice.com.ar/combo-pro/'],
    ['epic', 'https://www.primoffice.com.ar/combo-epic/']
  ]) {
    harness.buy(combo);
    assert.deepEqual(harness.calls.opened.at(-1), [url, '_blank', 'noopener']);
  }
  assert.equal(harness.calls.bridge, 0);
  assert.deepEqual(harness.calls.leads, ['purchase_click', 'purchase_click', 'purchase_click']);
});

test('feature flag true enruta los combos por el nuevo puente sin abrir fallback', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const harness = comboPurchaseHarness(html, true);
  await harness.buy('starter');
  assert.equal(harness.calls.bridge, 1);
  assert.deepEqual(harness.calls.opened, []);
});

test('HTML conserva fallback comercial sin exponer catalogo Tiendanube', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const appConfig = await readFile(path.join(root, 'js/config/app-config.js'), 'utf8');
  assert.match(html, /tiendanube-cart-transfer-button/);
  assert.match(html, /data-tiendanube-only hidden/);
  assert.match(html, /js\/services\/tiendanube-cart-transfer\.js/);
  assert.match(html, /selectedTiendanubeTransferItems/);
  assert.doesNotMatch(html, /PRIMOFFICE_STORE_PRODUCTS/);
  assert.match(html, /starter:'https:\/\/www\.primoffice\.com\.ar\/combo-starter\/'/);
  assert.match(html, /pro:'https:\/\/www\.primoffice\.com\.ar\/combo-pro\/'/);
  assert.match(html, /epic:'https:\/\/www\.primoffice\.com\.ar\/combo-epic\/'/);
  assert.match(html, /if\(tiendanubeCartBridgeEnabled\(\)\)return startTiendanubeCartTransfer\(\)/);
  assert.match(html, /var url=PRIMOFFICE_COMBO_URLS\[comboId\]/);
  assert.match(html, /window\.open\(url,'_blank','noopener'\)/);
  assert.doesNotMatch(html, /variantId:554959249|sku:'PNOTEBOOKGE'/);
  assert.doesNotMatch(html, /data-combo-action="purchase"[^>]*disabled/);
  assert.match(appConfig, /TIENDANUBE_ENABLED:\s*false/);
});
