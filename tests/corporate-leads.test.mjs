import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/corporate-leads.js';
const worker = { fetch: (request, env) => onRequest({request, env}) };
import { createCorporateLead, validateCorporatePayload } from '../functions/_lib/corporate/corporate-leads.mjs';
import { CORPORATE_RECORD_START, CORPORATE_RECORD_END, CORPORATE_STATUSES, createCorporateRecord, serializeCorporateRecord, parseCorporateRecord } from '../functions/_lib/corporate/corporate-record.mjs';

const valid = { nombre: 'Contacto de prueba', empresa: '[PRUEBA] PrimOffice Empresas', email: 'prueba@example.com', phone: '+54 9 11 1234-5678', tipo: 'Kits de bienvenida', cantidad: '80', fecha: '2099-12-10', detalle: 'Prueba controlada <script>alert(1)</script>\nSegunda línea' };
const env = { ODOO_ENABLED: 'true', ODOO_URL: 'https://odoo.example.test', ODOO_DB: 'test-db', ODOO_USERNAME: 'test-user', ODOO_API_KEY: 'test-only-key' };
const schema = { name: { type: 'char' }, contact_name: { type: 'char' }, partner_name: { type: 'char' }, email_from: { type: 'char' }, phone: { type: 'char' }, description: { type: 'html' }, tag_ids: { type: 'many2many' }, type: { type: 'selection' } };
const escape = (x) => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function value(x) {
  if (Array.isArray(x)) return `<value><array><data>${x.map(value).join('')}</data></array></value>`;
  if (x && typeof x === 'object') return `<value><struct>${Object.entries(x).map(([k,v])=>`<member><name>${k}</name>${value(v)}</member>`).join('')}</struct></value>`;
  if (typeof x === 'number') return `<value><int>${x}</int></value>`;
  if (typeof x === 'boolean') return `<value><boolean>${x ? 1 : 0}</boolean></value>`;
  return `<value><string>${escape(x)}</string></value>`;
}
function rpcMock(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.doesNotMatch(options.body, /ir\.model|x_corporate_data/, 'Sin acceso al esquema administrativo ni campo personalizado');
    calls.push({ url, body: options.body });
    assert.ok(responses.length, 'Llamada RPC inesperada');
    const next = responses.shift();
    const result = await (typeof next === 'function' ? next() : next);
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
  assert.equal(validateCorporatePayload(valid).data.phone, '+54 9 11 1234-5678');
  assert.ok(validateCorporatePayload({ ...valid, email: 'persona@gmail.com', detalle: '' }).data);
  for (const key of ['nombre', 'empresa', 'email', 'phone', 'cantidad', 'tipo', 'fecha']) assert.ok(validateCorporatePayload({ ...valid, [key]: '' }).error, key);
  for (const patch of [{ email: 'no-es-contacto' }, { phone: '123' }, { email: 'x@x' }, { tipo: 'Setup Epic' }, { cantidad: '-1' }, { cantidad: '1.2' }, { cantidad: '1e3' }, { fecha: '2099-02-30' }, { fecha: '2020-01-01' }, { detalle: 'x'.repeat(4001) }, { nombre: {} }, { gclid: {} }, { utm_source: 'x'.repeat(513) }, { landing_url: 'javascript:alert(1)' }, { referrer: 'https://user:pass@example.com/' }]) assert.ok(validateCorporatePayload({ ...valid, ...patch }).error, JSON.stringify(patch).slice(0,100));
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
  for (const field of ['contact_name', 'partner_name', 'email_from', 'phone', 'description', 'tag_ids']) assert.ok(lead.includes(`<name>${field}</name>`));
  assert.equal(storedText(lead, 'email_from'), valid.email);
  assert.equal(storedText(lead, 'phone'), valid.phone);
  assert.ok(lead.includes('&amp;lt;script&amp;gt;'));
  assert.ok(lead.includes('Cantidad aproximada'));
  assert.ok(lead.includes('2099-12-10'));
  assert.ok(lead.includes('<value><int>19</int></value>'));
  assert.doesNotMatch(lead, /Test - Landing|Setup Starter|Setup Pro|Setup Epic|totalScore|expected_revenue/);
});

test('sin partner_name en modelo: empresa preservada en título y descripción; teléfono', async (t) => {
  const { partner_name, ...withoutCompany } = schema;
  const calls = rpcMock(t, [7, withoutCompany, [19], 124]);
  await createCorporateLead(valid, env);
  const lead = calls.at(-1).body;
  assert.doesNotMatch(lead, /<name>partner_name<\/name>/);
  assert.match(lead, /<name>email_from<\/name>/);
  assert.match(lead, /<name>phone<\/name>/);
  assert.match(lead, /Empresa:/);
});

test('etiqueta creada concurrentemente: resuelve la existente sin reintentar el lead', async (t) => {
  const calls = rpcMock(t, [7, schema, [], new Error('conflict'), [19], 125]);
  assert.equal((await createCorporateLead(valid, env)).id, 125);
  assert.equal(calls.filter(c => c.body.includes('<string>crm.lead</string>') && c.body.includes('<string>create</string>')).length, 1);
});

test('sin description nativo nunca crea registros ni pierde metadata silenciosamente', async (t) => {
  const { description, ...withoutDescription } = schema;
  const calls = rpcMock(t, [7, withoutDescription]);
  await assert.rejects(createCorporateLead(valid, env));
  assert.equal(calls.length, 2);
});

const decode = text => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');
function storedText(body, field = 'description') {
  const match = body.match(new RegExp(`<name>${field}</name><value><string>([\\s\\S]*?)</string></value>`));
  assert.ok(match, `${field} guardado en el mismo crm.lead`);
  return decode(match[1]);
}

test('persistencia Odoo: payload completo, atribución, timestamp del servidor, new y valores null', async (t) => {
  const attribution = Object.fromEntries(['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].map(key => [key, `${key}-original`]));
  Object.assign(attribution, { landing_url: 'https://empresas.primoffice.com.ar/?gclid=original', referrer: 'https://www.google.com/' });
  const calls = rpcMock(t, [7, schema, [19], 321]);
  const before = Date.now();
  const response = await worker.fetch(request({ ...valid, ...attribution, status: 'won', captured_at: 'fake', estimated_value: 5000, quoted_value: 4000, final_sale_value: 100000, ODOO_API_KEY: 'must-not-be-stored' }), env);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, id: 321 });
  // The same successful create contains native fields, human text and Ads JSON.
  const description = storedText(calls.at(-1).body);
  const stored = parseCorporateRecord(description);
  assert.ok(description.indexOf('Consulta corporativa') < description.indexOf(CORPORATE_RECORD_START));
  assert.match(description, /<strong>Empresa:<\/strong> \[PRUEBA\] PrimOffice Empresas/);
  assert.match(description, /Prueba controlada &lt;script&gt;alert\(1\)&lt;\/script&gt;<br>Segunda línea/);
  assert.doesNotMatch(description, /must-not-be-stored|<script>/);
  for (const [key, val] of Object.entries({ ...valid, ...attribution })) assert.equal(stored[key], val);
  assert.ok(Date.parse(stored.captured_at) >= before && Date.parse(stored.captured_at) <= Date.now());
  assert.equal(stored.status, 'new');
  for (const key of ['estimated_value', 'quoted_value', 'final_sale_value']) assert.equal(stored[key], null);
  for (const status of CORPORATE_STATUSES) {
    const evolved = JSON.parse(serializeCorporateRecord({ ...stored, status, estimated_value: 5000, quoted_value: 4000, final_sale_value: 0 }));
    assert.equal(evolved.status, status);
    assert.equal(evolved.final_sale_value, 0);
  }
  assert.throws(() => serializeCorporateRecord({ ...stored, status: 'unknown' }));
  assert.throws(() => serializeCorporateRecord({ ...stored, final_sale_value: -1 }));
});

test('endpoint nunca confirma si Odoo devuelve ID inválido o create falla', async (t) => {
  t.mock.method(console, 'error', () => {});
  rpcMock(t, [7, schema, [19], 0, 7, schema, [19], new Error('create failed')]);
  for (let i = 0; i < 2; i++) {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  }
});

test('sin custom field ni migración: crea una vez usando únicamente crm.lead y crm.tag', async (t) => {
  const calls = rpcMock(t, [7, schema, [19], 99]);
  assert.deepEqual(await createCorporateLead(valid, env), { id: 99 });
  assert.equal(calls.length, 4);
  assert.equal(calls.filter(c => c.body.includes('<string>create</string>')).length, 1);
  assert.ok(calls.every(c => !c.body.includes('<string>write</string>') && !c.body.includes('<string>unlink</string>')));
  assert.equal(parseCorporateRecord(storedText(calls.at(-1).body)).status, 'new');
});

test('bloque recuperable con entidades, Unicode, saltos, tags y delimitadores ingresados por el cliente', async (t) => {
  const tricky = `á & <b>texto</b> "comillas" 'simple' &lt; &#39; 😀\n${CORPORATE_RECORD_START}\n{}\n${CORPORATE_RECORD_END}`;
  const data = { ...valid, detalle: tricky, gclid: tricky, gbraid: 'B+/%&=---', wbraid: 'W-ñ_123' };
  const calls = rpcMock(t, [7, schema, [19], 100]);
  await createCorporateLead(data, env);
  const description = storedText(calls.at(-1).body);
  const stored = parseCorporateRecord(description);
  for (const key of ['detalle', 'gclid', 'gbraid', 'wbraid']) assert.equal(stored[key], data[key]);
  // A sanitizer can normalize quote entities and wrappers without losing JSON.
  const normalized = description.replaceAll('&quot;', '&#34;').replaceAll('&#39;', '&#x27;').replace('<pre>', '<div><pre>').replace('</pre>', '</pre></div>');
  assert.deepEqual(parseCorporateRecord(normalized), stored);
  assert.equal(parseCorporateRecord('<p>Lead comercial anterior sin bloque</p>'), null);
  assert.throws(() => parseCorporateRecord(description.slice(0, description.lastIndexOf(CORPORATE_RECORD_END))));
});

test('serialización determinista, recuperable y validación de importes futuros', () => {
  const data = validateCorporatePayload(valid).data;
  const now = new Date('2026-09-17T12:00:00.000Z');
  const forward = createCorporateRecord(data, now);
  const reversed = createCorporateRecord(Object.fromEntries(Object.entries(data).reverse()), now);
  assert.equal(forward, reversed);
  const record = JSON.parse(forward);
  assert.equal(record.captured_at, now.toISOString());
  for (const key of ['estimated_value', 'quoted_value', 'final_sale_value']) {
    for (const invalid of [-1, NaN, Infinity, '100', undefined]) assert.throws(() => serializeCorporateRecord({ ...record, [key]: invalid }));
  }
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

test('la respuesta espera el commit simulado de Odoo', async (t) => {
  let release;
  let entered;
  const committed = new Promise(resolve => { release = resolve; });
  const creating = new Promise(resolve => { entered = resolve; });
  rpcMock(t, [7, schema, [19], () => { entered(); return committed; }]);
  let replied = false;
  const pending = worker.fetch(request(), env).then(response => { replied = true; return response; });
  await creating;
  assert.equal(replied, false);
  release(456);
  assert.deepEqual(await (await pending).json(), { ok: true, id: 456 });
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
