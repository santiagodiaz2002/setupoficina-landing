import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readRepoFile(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

let moduleCounter = 0;
async function importRepoModule(relativePath) {
  const source = await readRepoFile(relativePath);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#test-${moduleCounter++}`;
  return import(url);
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `No se encontro ${name}`);
  const start = match.index;

  const braceStart = source.indexOf('{', start);
  let depth = 0;

  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }

  throw new Error(`No se pudo extraer ${name}`);
}

function extractVarLiteral(source, name) {
  const marker = `var ${name}=`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `No se encontro ${name}`);

  const equals = source.indexOf('=', start);
  const rest = source.slice(equals + 1);
  const firstLiteral = rest.search(/[\[{]/);
  assert.notEqual(firstLiteral, -1, `No se encontro literal para ${name}`);
  const openStart = equals + 1 + firstLiteral;
  const open = source[openStart];
  const close = open === '[' ? ']' : '}';
  let depth = 0;

  for (let i = openStart; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    if (source[i] === close) depth -= 1;
    if (depth === 0) return source.slice(start, i + 2);
  }

  throw new Error(`No se pudo extraer ${name}`);
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

function createSubmitHarness({ submitLead }) {
  const html = createSubmitHarness.html;
  const button = { disabled: false, innerHTML: 'Enviar' };
  const submitError = {
    textContent: '',
    hidden: true,
    focused: false,
    setAttribute(name) {
      if (name === 'hidden') this.hidden = true;
    },
    removeAttribute(name) {
      if (name === 'hidden') this.hidden = false;
    },
    focus() {
      this.focused = true;
    }
  };
  const pqLead = { hidden: false };
  const calls = { hide: 0, showResult: 0 };
  const payload = {
    leadId: 'lead_front_1',
    contact: { name: 'Santi', preferredChannel: 'email', email: 'santi@example.com', consent: true },
    diagnosis: { totalScore: 10, recommendedTier: 'Setup Pro', recommendedPreset: 'pro' },
    configuration: { selectedProducts: ['silla'], selectedExtras: [], estimatedTotal: 180000, currency: 'ARS' }
  };

  const context = {
    console,
    localStorage: createStorage(),
    window: { PrimOfficeLeads: { submitLead } },
    pqLead,
    pqLeadSession: {
      basePayload: null,
      leadId: '',
      odooLeadId: null,
      cartUpdateTimer: 0,
      lastUpdateAt: '',
      lastCartSignature: ''
    },
    document: {
      querySelector(selector) {
        return selector === '#pqLeadForm [type=submit]' ? button : null;
      },
      getElementById(id) {
        return id === 'pqSubmitError' ? submitError : null;
      }
    },
    pqValidate() {
      return true;
    },
    pqPayload() {
      return payload;
    },
    pqHide(el) {
      calls.hide += 1;
      if (el) el.hidden = true;
    },
    showResult() {
      calls.showResult += 1;
    }
  };

  vm.createContext(context);
  vm.runInContext([
    extractFunction(html, 'clonePayload'),
    extractFunction(html, 'readOdooLeadId'),
    extractFunction(html, 'storeLeadSession'),
    extractFunction(html, 'pqClearSubmitErr'),
    extractFunction(html, 'pqSubmitErr'),
    extractFunction(html, 'pqLeadSubmitError'),
    extractFunction(html, 'pqSubmit'),
    'this.pqSubmit = pqSubmit;'
  ].join('\n'), context);

  return { button, calls, context, payload, pqLead, submitError };
}

function createTimerHarness() {
  const html = createTimerHarness.html;
  let nextTimerId = 1;
  const timers = new Map();
  const calls = {
    clearTimeout: [],
    presets: [],
    setCart: [],
    updateLead: [],
    updatePreview: 0,
    updateTotal: 0,
    updatePresetButtons: []
  };

  const cartState = {};
  const context = {
    console,
    window: {
      PrimOfficeLeads: {
        updateLead(payload) {
          calls.updateLead.push(payload);
          return Promise.resolve({ ok: true, data: { odoo: { id: payload.odooLeadId || 222 } } });
        }
      }
    },
    pqLeadSession: {
      basePayload: null,
      leadId: '',
      odooLeadId: null,
      cartUpdateTimer: 0,
      lastUpdateAt: '',
      lastCartSignature: ''
    },
    cartState,
    extrasState: {},
    setTimeout(fn, delay) {
      const id = nextTimerId++;
      timers.set(id, { fn, delay, cleared: false });
      return id;
    },
    clearTimeout(id) {
      calls.clearTimeout.push(id);
      if (timers.has(id)) timers.get(id).cleared = true;
    },
    getCurrentCartConfiguration() {
      const selectedProducts = Object.keys(cartState).filter((id) => cartState[id]);
      const estimatedTotal = selectedProducts.length * 1000;
      return {
        selectedProducts,
        selectedProductNames: selectedProducts,
        selectedExtras: [],
        selectedExtraNames: [],
        estimatedTotal,
        currency: 'ARS'
      };
    },
    setCartRowState(id, on) {
      cartState[id] = !!on;
      calls.setCart.push({ id, on: !!on });
    },
    updateTotal() {
      calls.updateTotal += 1;
    },
    updatePreview() {
      calls.updatePreview += 1;
    },
    updatePresetButtons(name) {
      calls.updatePresetButtons.push(name);
    }
  };

  vm.createContext(context);
  vm.runInContext([
    extractVarLiteral(html, 'FULL_CART_IDS'),
    extractVarLiteral(html, 'COMBO_PRESETS'),
    extractFunction(html, 'clonePayload'),
    extractFunction(html, 'readOdooLeadId'),
    extractFunction(html, 'storeLeadSession'),
    extractFunction(html, 'buildLeadUpdatePayload'),
    extractFunction(html, 'getCartUpdateSignature'),
    extractFunction(html, 'submitLeadUpdate'),
    extractFunction(html, 'scheduleLeadCartUpdate'),
    extractFunction(html, 'applyComboPreset'),
    'this.storeLeadSession = storeLeadSession;',
    'this.scheduleLeadCartUpdate = scheduleLeadCartUpdate;',
    'this.applyComboPreset = applyComboPreset;'
  ].join('\n'), context);

  async function runActiveTimers() {
    for (const timer of timers.values()) {
      if (!timer.cleared) {
        timer.cleared = true;
        timer.fn();
      }
    }
    await Promise.resolve();
  }

  return { calls, context, runActiveTimers, timers };
}

function xmlResponse(valueXml) {
  return new Response(`<?xml version="1.0"?><methodResponse><params><param><value>${valueXml}</value></param></params></methodResponse>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  });
}

function xmlArrayInts(ids) {
  return `<array><data>${ids.map((id) => `<value><int>${id}</int></value>`).join('')}</data></array>`;
}

function xmlArrayStructTagIds(ids) {
  return `<array><data><value><struct><member><name>tag_ids</name><value>${xmlArrayInts(ids)}</value></member></struct></value></data></array>`;
}

function createPatchD1(existing) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              calls.push({ type: 'first', sql, args });
              return existing;
            },
            async run() {
              calls.push({ type: 'run', sql, args });
              return { success: true };
            }
          };
        }
      };
    }
  };
}

function patchPayload(overrides = {}) {
  return {
    leadId: 'lead_patch_1',
    odooLeadId: 999,
    updatedAt: '2026-06-23T12:00:00.000Z',
    contact: {
      name: 'Santi',
      preferredChannel: 'email',
      email: 'santi@example.com',
      whatsapp: '',
      consent: true
    },
    diagnosis: {
      totalScore: 10,
      recommendedTier: 'Setup Pro',
      recommendedPreset: 'pro'
    },
    configuration: {
      recommendedProducts: ['soporte_notebook'],
      selectedProducts: ['silla', 'monitor_27'],
      selectedExtras: ['hub_usb_pro'],
      estimatedTotal: 321000,
      currency: 'ARS'
    },
    ...overrides
  };
}

async function patchRequest(payload) {
  return new Request('https://setupoficina.com.ar/api/leads', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

createSubmitHarness.html = await readRepoFile('index.html');
createTimerHarness.html = createSubmitHarness.html;

test('POST exitoso inicial guarda sesion y muestra resultado', async () => {
  const harness = createSubmitHarness({
    submitLead: async () => ({ ok: true, data: { odoo: { id: 333 } } })
  });

  harness.context.pqSubmit({ preventDefault() {} });
  await flushPromises();

  assert.equal(harness.calls.showResult, 1);
  assert.equal(harness.calls.hide, 1);
  assert.equal(harness.pqLead.hidden, true);
  assert.equal(harness.context.pqLeadSession.leadId, harness.payload.leadId);
  assert.equal(harness.context.pqLeadSession.odooLeadId, 333);
  assert.equal(harness.button.disabled, false);
  assert.equal(harness.submitError.hidden, true);
});

test('POST fallido o con excepcion no crea sesion falsa ni oculta el formulario', async () => {
  for (const submitLead of [
    async () => ({ ok: false, error: 'HTTP 500' }),
    async () => { throw new Error('network'); }
  ]) {
    const harness = createSubmitHarness({ submitLead });

    harness.context.pqSubmit({ preventDefault() {} });
    await flushPromises();

    assert.equal(harness.calls.showResult, 0);
    assert.equal(harness.calls.hide, 0);
    assert.equal(harness.pqLead.hidden, false);
    assert.equal(harness.context.pqLeadSession.leadId, '');
    assert.equal(harness.context.pqLeadSession.basePayload, null);
    assert.equal(harness.button.disabled, false);
    assert.equal(harness.submitError.hidden, false);
    assert.match(harness.submitError.textContent, /No pudimos guardar/);
  }
});

test('despues de POST exitoso, un cambio de carrito genera PATCH con el mismo lead', async () => {
  const harness = createTimerHarness();
  const basePayload = patchPayload({ leadId: 'lead_cart_1', odooLeadId: null });

  harness.context.storeLeadSession(basePayload, { ok: true, data: { odoo: { id: 222 } } });
  harness.context.cartState.silla = true;
  harness.context.scheduleLeadCartUpdate('cart_change');
  await harness.runActiveTimers();

  assert.equal(harness.calls.updateLead.length, 1);
  assert.equal(harness.calls.updateLead[0].leadId, 'lead_cart_1');
  assert.equal(harness.calls.updateLead[0].odooLeadId, 222);
  assert.equal(harness.calls.updateLead[0].eventType, 'cart_change');
  assert.deepEqual(harness.calls.updateLead[0].configuration.selectedProducts, ['silla']);
});

test('varios clics rapidos conservan debounce de 1000 ms y disparan un solo PATCH', async () => {
  const harness = createTimerHarness();
  const basePayload = patchPayload({ leadId: 'lead_debounce_1' });

  harness.context.storeLeadSession(basePayload, { ok: true, data: { odoo: { id: 222 } } });
  harness.context.cartState.silla = true;
  harness.context.scheduleLeadCartUpdate('cart_change');
  harness.context.cartState.monitor_27 = true;
  harness.context.scheduleLeadCartUpdate('cart_change');
  harness.context.cartState.hub_usb_pro = true;
  harness.context.scheduleLeadCartUpdate('cart_change');

  assert.deepEqual([...harness.timers.values()].map((timer) => timer.delay), [1000, 1000, 1000]);
  assert.equal(harness.calls.clearTimeout.length, 3);

  await harness.runActiveTimers();

  assert.equal(harness.calls.updateLead.length, 1);
  assert.deepEqual(harness.calls.updateLead[0].configuration.selectedProducts.sort(), ['hub_usb_pro', 'monitor_27', 'silla']);
});

test('presets Starter, Pro y Epic siguen llamando actualizacion', () => {
  const harness = createTimerHarness();
  harness.context.pqLeadSession.leadId = 'lead_presets_1';

  for (const name of ['starter', 'pro', 'epic']) {
    harness.context.applyComboPreset(name);
  }

  assert.equal(harness.calls.updateTotal, 3);
  assert.equal(harness.calls.updatePreview, 3);
  assert.deepEqual(harness.calls.updatePresetButtons, ['starter', 'pro', 'epic']);
  assert.deepEqual([...harness.timers.values()].map((timer) => timer.delay), [1000, 1000, 1000]);
});

test('PATCH usa odoo_lead_id de D1, actualiza productos y total', async () => {
  const mod = await importRepoModule('functions/api/leads.js');
  const d1 = createPatchD1({ odoo_lead_id: 111 });
  const objectResponses = [
    xmlArrayInts([10]),
    xmlArrayInts([20]),
    xmlArrayInts([30]),
    xmlArrayStructTagIds([900, 44, 10]),
    xmlArrayInts([11]),
    xmlArrayInts([33]),
    xmlArrayInts([44]),
    '<boolean>1</boolean>'
  ];
  const fetchCalls = [];
  let objectIndex = 0;

  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, body: options.body });
    if (String(url).includes('/xmlrpc/2/common')) return xmlResponse('<int>42</int>');
    const response = objectResponses[objectIndex++];
    assert.ok(response, `Respuesta XML mock faltante para llamada ${objectIndex}`);
    return xmlResponse(response);
  };

  const response = await mod.onRequestPatch({
    request: await patchRequest(patchPayload()),
    env: {
      LEADS_DB: d1,
      ODOO_ENABLED: 'true',
      ODOO_URL: 'https://odoo.invalid',
      ODOO_DB: 'primoffice',
      ODOO_USERNAME: 'user@example.com',
      ODOO_API_KEY: 'secret'
    }
  });
  const body = await response.json();
  const updateCall = d1.calls.find((call) => call.type === 'run' && /UPDATE leads/.test(call.sql));
  const writeCall = fetchCalls.find((call) => call.body.includes('<string>write</string>'));

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.odoo.synced, true);
  assert.equal(body.odoo.id, 111);
  assert.ok(writeCall.body.includes('<int>111</int>'));
  assert.ok(!writeCall.body.includes('<int>999</int>'));
  assert.ok(writeCall.body.includes('<name>expected_revenue</name>'));
  assert.ok(writeCall.body.includes('<int>321000</int>'));
  assert.equal(updateCall.args[7], 321000);
  assert.equal(updateCall.args[12], 111);
  assert.deepEqual(JSON.parse(updateCall.args[9]), {
    selected: ['silla', 'monitor_27'],
    extras: ['hub_usb_pro'],
    recommended: ['soporte_notebook']
  });
});

test('Odoo skipped conserva el ID existente', async () => {
  const mod = await importRepoModule('functions/api/leads.js');
  const d1 = createPatchD1({ odoo_lead_id: 555 });
  globalThis.fetch = async () => {
    throw new Error('No deberia llamarse Odoo cuando esta desactivado');
  };

  const response = await mod.onRequestPatch({
    request: await patchRequest(patchPayload({ odooLeadId: 999 })),
    env: {
      LEADS_DB: d1,
      ODOO_ENABLED: 'false'
    }
  });
  const body = await response.json();
  const updateCall = d1.calls.find((call) => call.type === 'run' && /UPDATE leads/.test(call.sql));

  assert.equal(response.status, 200);
  assert.equal(body.odoo.id, 555);
  assert.equal(body.odoo.synced, false);
  assert.equal(updateCall.args[11], 'pending');
  assert.equal(updateCall.args[12], 555);
});

test('DEMO_MODE false usa /api/leads para POST y PATCH', async () => {
  const mod = await importRepoModule('js/services/leads-service.js');
  const fetchCalls = [];
  globalThis.localStorage = createStorage();
  globalThis.window = {
    PrimOfficeConfig: {
      DEMO_MODE: false,
      LEADS_API_URL: '/api/leads',
      LEADS_TIMEOUT_MS: 1000
    }
  };
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, method: options.method });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const post = await mod.submitLead(patchPayload());
  const patch = await mod.updateLead(patchPayload());

  assert.equal(post.ok, true);
  assert.equal(patch.ok, true);
  assert.deepEqual(fetchCalls, [
    { url: '/api/leads', method: 'POST' },
    { url: '/api/leads', method: 'PATCH' }
  ]);
});

test('DEMO_MODE true guarda local y no realiza fetch', async () => {
  const mod = await importRepoModule('js/services/leads-service.js');
  const storage = createStorage();
  globalThis.localStorage = storage;
  globalThis.window = {
    PrimOfficeConfig: {
      DEMO_MODE: true,
      LEADS_API_URL: '/api/leads',
      LEADS_STORAGE_KEY: 'primoffice_test_leads'
    }
  };
  globalThis.fetch = async () => {
    throw new Error('fetch no debe ejecutarse en DEMO_MODE');
  };

  const post = await mod.submitLead(patchPayload());
  const patch = await mod.updateLead(patchPayload());
  const stored = JSON.parse(storage.getItem('primoffice_test_leads'));

  assert.equal(post.mode, 'demo');
  assert.equal(patch.mode, 'demo');
  assert.equal(stored.length, 2);
  assert.equal(stored[1].updateOnly, true);
});
