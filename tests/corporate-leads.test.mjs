import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/corporate-leads.js';
const worker = { fetch: (request, env) => onRequest({request, env}) };
import { createCorporateLead, validateCorporatePayload } from '../functions/_lib/corporate/corporate-leads.mjs';

const valid = { nombre: 'Contacto de prueba', empresa: '[PRUEBA] PrimOffice Empresas', contacto: 'prueba@example.com', tipo: 'Kits de bienvenida', cantidad: '80', fecha: '2099-12-10', detalle: 'Prueba controlada <script>alert(1)</script>\nSegunda línea' };
const env = { ODOO_ENABLED: 'true', ODOO_URL: 'https://odoo.example.test', ODOO_DB: 'test-db', ODOO_USERNAME: 'test-user', ODOO_API_KEY: 'test-only-key' };
const schema = { name: { type: 'char' }, contact_name: { type: 'char' }, partner_name: { type: 'char' }, email_from: { type: 'char' }, phone: { type: 'char' }, description: { type: 'html' }, tag_ids: { type: 'many2many' }, type: { type: 'selection' } };
const escape = (x) => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function value(x) {
  if (Array.isArray(x)) return `<value><array><data>${x.map(value).join('')}</data></array></value>`;
  if (x && typeof x === 'object') return `<value><struct>${Object.entries(x).map(([k,v])=>`<member><name>${k}</name>${value(v)}</member>`).join('')}</struct></value>`;
  if (typeof x === 'number') return `<value><int>${x}</int></value>`;
  return `<value><string>${escape(x)}</string></value>`;
}
function rpcMock(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, body: options.body });
    assert.ok(responses.length, 'Llamada RPC inesperada');
    const result = responses.shift();
    if (result instanceof Error) throw result;
    return new Response(`<?xml version="1.0"?><methodResponse><params><param>${value(result)}</param></params></methodResponse>`);
  });
  return calls;
}
function request(payload = valid, options = {}) {
  return new Request('https://empresas.primoffice.com.ar/api/corporate-leads', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://empresas.primoffice.com.ar' }, body: JSON.stringify(payload), ...options
  });
}

test('validación: requeridos, email/teléfono, fecha real, cantidad y límites', () => {
  assert.ok(validateCorporatePayload(valid).data);
  assert.equal(validateCorporatePayload({ ...valid, contacto: '+54 9 11 1234-5678' }).data.phone, '+54 9 11 1234-5678');
  assert.ok(validateCorporatePayload({ ...valid, cantidad: '', detalle: '' }).data);
  for (const key of ['nombre', 'empresa', 'contacto', 'tipo', 'fecha']) assert.ok(validateCorporatePayload({ ...valid, [key]: '' }).error, key);
  for (const patch of [{ contacto: 'no-es-contacto' }, { contacto: '123' }, { contacto: 'x@x' }, { tipo: 'Setup Epic' }, { cantidad: '-1' }, { cantidad: '1.2' }, { cantidad: '1e3' }, { fecha: '2099-02-30' }, { fecha: '2020-01-01' }, { detalle: 'x'.repeat(4001) }, { nombre: {} }]) assert.ok(validateCorporatePayload({ ...valid, ...patch }).error, JSON.stringify(patch).slice(0,100));
  for (const bad of [null, [], 'text', 42]) assert.ok(validateCorporatePayload(bad).error);
});

test('crea oportunidad corporativa con etiqueta exclusiva y HTML escapado', async (t) => {
  const calls = rpcMock(t, [7, schema, [], 19, 123]);
  assert.deepEqual(await createCorporateLead(valid, env), { id: 123 });
  assert.equal(calls.length, 5);
  assert.match(calls[0].url, /\/xmlrpc\/2\/common$/);
  assert.match(calls[1].body, /fields_get/);
  assert.match(calls[2].body, /Empresas - Landing/);
  assert.match(calls[3].body, /crm.tag/);
  const lead = calls[4].body;
  assert.match(lead, /\[PRUEBA\] PrimOffice Empresas — Kits de bienvenida/);
  for (const field of ['contact_name', 'partner_name', 'email_from', 'description', 'tag_ids']) assert.ok(lead.includes(`<name>${field}</name>`));
  assert.ok(lead.includes('&amp;lt;script&amp;gt;'));
  assert.ok(lead.includes('Cantidad aproximada'));
  assert.ok(lead.includes('2099-12-10'));
  assert.ok(lead.includes('<value><int>19</int></value>'));
  assert.doesNotMatch(lead, /Test - Landing|Setup Starter|Setup Pro|Setup Epic|totalScore|expected_revenue/);
});

test('sin partner_name en modelo: empresa preservada en título y descripción; teléfono', async (t) => {
  const { partner_name, ...withoutCompany } = schema;
  const calls = rpcMock(t, [7, withoutCompany, [19], 124]);
  await createCorporateLead({ ...valid, contacto: '+54 9 11 1234-5678' }, env);
  const lead = calls.at(-1).body;
  assert.doesNotMatch(lead, /<name>partner_name<\/name>|<name>email_from<\/name>/);
  assert.match(lead, /<name>phone<\/name>/);
  assert.match(lead, /Empresa:/);
});

test('etiqueta creada concurrentemente: resuelve la existente sin reintentar el lead', async (t) => {
  const calls = rpcMock(t, [7, schema, [], new Error('conflict'), [19], 125]);
  assert.equal((await createCorporateLead(valid, env)).id, 125);
  assert.equal(calls.filter(c => c.body.includes('<string>crm.lead</string>') && c.body.includes('<string>create</string>')).length, 1);
});

test('schema incompatible nunca crea registros', async (t) => {
  const calls = rpcMock(t, [7, {}]);
  await assert.rejects(createCorporateLead(valid, env));
  assert.equal(calls.length, 2);
});

test('CORS habilita preflight de Empresas y bloquea otros sitios', async () => {
  for (const origin of ['https://empresas.primoffice.com.ar', 'https://primoffice-empresas.primoffice.workers.dev']) {
    const response = await worker.fetch(new Request('https://setupoficina.com.ar/api/corporate-leads', { method: 'OPTIONS', headers: { Origin: origin } }), {});
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  }
  const denied = await worker.fetch(new Request('https://setupoficina.com.ar/api/corporate-leads', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), {});
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('endpoint: 201 únicamente después de la creación; devuelve ID creado sin credenciales', async (t) => {
  rpcMock(t, [7, schema, [19], 123]);
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, id: 123 });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://empresas.primoffice.com.ar');
});

test('endpoint rechaza método, origen, tipo, JSON, exceso de tamaño y datos inválidos antes de Odoo', async (t) => {
  const calls = rpcMock(t, []);
  const cases = [
    [new Request('https://empresas.primoffice.com.ar/api/corporate-leads'), 405],
    [request(valid, { headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' } }), 403],
    [request(valid, { headers: { 'Content-Type': 'text/plain' } }), 415],
    [request(valid, { body: '{' }), 400],
    [request(valid, { body: 'x'.repeat(17000) }), 413],
    [request(valid, { headers: { 'Content-Type': 'application/json', 'Content-Length': '17000' } }), 413],
    [request({}), 400]
  ];
  for (const [req, status] of cases) assert.equal((await worker.fetch(req, env)).status, status);
  assert.equal(calls.length, 0);
});

test('fallo Odoo o falta de secretos: 503 sin filtración y sin falso éxito', async (t) => {
  t.mock.method(console, 'error', () => {});
  const calls = rpcMock(t, [new Error('secret information test-only-key')]);
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret information|test-only-key/);
  assert.equal(calls.length, 1);
  assert.equal((await worker.fetch(request(), {})).status, 503);
});
