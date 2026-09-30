import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/corporate-leads.js';
import { createCorporateLead } from '../functions/_lib/corporate/corporate-leads.mjs';
import { notifyCorporateLead } from '../functions/_lib/corporate/corporate-notification.mjs';
import { CORPORATE_RECORD_START, CORPORATE_RECORD_END, parseCorporateRecord, serializeCorporateRecord } from '../functions/_lib/corporate/corporate-record.mjs';
import { corporateOdoo } from './helpers/corporate-odoo.mjs';

const submission = '09f48484-38e4-4d32-8d28-44c9316371cb';
const providerId = 'ea349b6c-0182-49f7-84f2-6c853390a6bb';
const payload = { nombre: 'Contacto de prueba', empresa: '[PRUEBA] Empresa', email: 'persona@example.com', phone: '+54 9 11 1234-5678', tipo: 'Kits de bienvenida', cantidad: '80', fecha: '2099-12-10', detalle: 'Logo y packaging\nEntrega acordada', submission_id: submission };
const env = { ODOO_ENABLED: 'true', ODOO_URL: 'https://odoo.example.test', ODOO_DB: 'test-db', ODOO_USERNAME: 'test-user', ODOO_API_KEY: 'odoo-test-secret', RESEND_API_KEY: 'resend-test-secret', CORPORATE_NOTIFICATION_FROM: 'PrimOffice <avisos@example.com>' };
const request = (data = payload) => new Request('https://setupoficina.com.ar/api/corporate-leads', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://empresas.primoffice.com.ar' }, body: JSON.stringify(data)
});

function fixture(t, options) {
  const odoo = corporateOdoo(options), emails = [], accepted = new Map(), logs = [];
  const state = { odoo, emails, accepted, logs, provider: null, odooHook: null };
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(console, 'info', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url !== 'https://api.resend.com/emails') {
      if (state.odooHook) await state.odooHook(url, init);
      return odoo.fetch(url, init); // fixture rejects every other external URL
    }
    const email = { url, init, body: JSON.parse(init.body), key: init.headers['Idempotency-Key'] };
    emails.push(email);
    const record = parseCorporateRecord(odoo.records.at(-1)?.description);
    assert.equal(record.lead_id, odoo.records.at(-1).id, 'real lead ID confirmed before mail');
    assert.equal(record.created_at, '2026-09-18T13:25:42.000Z');
    assert.equal(record.notification.status, 'pending', 'attempt persisted before Resend');
    assert.equal(record.notification.key, email.key);
    const accept = () => {
      if (accepted.has(email.key)) assert.equal(accepted.get(email.key), init.body, 'retry body must be identical');
      else accepted.set(email.key, init.body);
      return Response.json({ id: providerId });
    };
    return state.provider ? state.provider(email, accept) : accept();
  });
  state.submit = (data = payload, configuration = env) => onRequest({ request: request(data), env: configuration });
  return state;
}

function updateRecord(odoo, update) {
  const lead = odoo.records[0];
  const record = parseCorporateRecord(lead.description);
  const start = lead.description.lastIndexOf(CORPORATE_RECORD_START) + CORPORATE_RECORD_START.length;
  const end = lead.description.indexOf(CORPORATE_RECORD_END, start);
  const escaped = serializeCorporateRecord(update(record)).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  lead.description = lead.description.slice(0, start) + '\n' + escaped + '\n' + lead.description.slice(end);
}

test('lead confirmado notifica: destinatario fijo, asunto, Reply-To, todos los datos y respuesta anterior', async t => {
  const s = fixture(t);
  const response = await s.submit({ ...payload, to: 'attacker@example.com', recipient: 'attacker@example.com', notification: { status: 'sent' }, RESEND_API_KEY: 'browser-key' });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, id: 1 });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://empresas.primoffice.com.ar');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(s.emails.length, 1);
  const { body, init, key } = s.emails[0];
  assert.deepEqual(body.to, ['info@primoffice.com.ar']);
  assert.equal(body.from, env.CORPORATE_NOTIFICATION_FROM);
  assert.equal(body.subject, `Nueva consulta corporativa — ${payload.empresa}`);
  assert.equal(body.reply_to, payload.email);
  assert.equal(key, `corporate-lead/${submission}`);
  assert.equal(init.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`);
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  for (const field of ['nombre', 'empresa', 'email', 'phone', 'tipo', 'cantidad', 'fecha', 'detalle']) assert.ok(body.text.includes(payload[field]), field);
  assert.match(body.text, /ID del lead: 1/);
  assert.match(body.html, /<strong>ID del lead:<\/strong> 1/);
  assert.doesNotMatch(JSON.stringify(body), /attacker|browser-key/);
  const record = parseCorporateRecord(s.odoo.records[0].description);
  assert.equal(record.notification.status, 'sent');
  assert.equal(record.notification.provider_id, providerId);
  assert.equal(record.status, 'new');
  assert.equal(record.won_value, null);
  assert.equal(record.email, payload.email);
  assert.ok(s.logs.some(([code]) => code === 'corporate_notification_sent'));
});

test('HTML escapa todos los datos; conserva Unicode, entidades literales y saltos; asunto sin CR/LF', async t => {
  const s = fixture(t);
  const data = { ...payload, nombre: `María <img src=x onerror=alert(1)> & " '`, empresa: 'Empresa\r\nBcc: injected', detalle: `<script>alert('x')</script>\n& < > " ' &lt; 😀 ${CORPORATE_RECORD_START}` };
  assert.equal((await s.submit(data)).status, 201);
  const { html, text, subject } = s.emails[0].body;
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;<br>/);
  assert.ok(html.includes('&amp; &lt; &gt; &quot; &#39; &amp;lt; 😀'));
  assert.ok(text.includes(data.nombre));
  assert.ok(text.includes(data.detalle));
  assert.equal(subject, 'Nueva consulta corporativa — Empresa Bcc: injected');
});

test('detalle opcional vacío sigue notificando', async t => {
  const s = fixture(t);
  assert.equal((await s.submit({ ...payload, detalle: '' })).status, 201);
  assert.match(s.emails[0].body.text, /Detalle: Sin especificar/);
});

test('no notifica mientras Odoo todavía no confirmó el lead', async t => {
  const s = fixture(t);
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { entered = resolve; });
  s.odooHook = async (_, init) => {
    if (init.body.includes('<string>crm.lead</string>') && init.body.includes('<string>create</string>')) { entered(); await blocked; }
  };
  const pending = s.submit();
  await waiting;
  assert.equal(s.emails.length, 0);
  release();
  assert.equal((await pending).status, 201);
  assert.equal(s.emails.length, 1);
});

test('Pages waitUntil conserva confirmación inmediata; tarea supervisada termina el correo', async t => {
  const s = fixture(t), work = [];
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { entered = resolve; });
  s.provider = async (_, accept) => { entered(); await blocked; return accept(); };
  const context = { request: request(), env, waitUntil(promise) {
    assert.equal(this, context, 'conserva receptor del método de Pages');
    work.push(promise);
  } };
  const response = await onRequest(context);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, id: 1 });
  assert.equal(work.length, 1);
  await waiting;
  assert.equal(s.accepted.size, 0, 'frontend no espera al proveedor');
  release();
  await Promise.all(work);
  assert.equal(s.accepted.size, 1);
  assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification.status, 'sent');
});

test('retries concurrentes de un lead existente comparten clave y no duplican correo', async t => {
  const s = fixture(t);
  await createCorporateLead(payload, env);
  const responses = await Promise.all([s.submit(), s.submit()]);
  assert.ok(responses.every(response => response.status === 201));
  assert.equal(s.odoo.records.length, 1);
  assert.equal(s.accepted.size, 1);
});

for (const failure of ['failCreate', 'loseCreateResponse', 'failWrite', 'loseWriteResponse']) {
  test(`${failure}: no email antes de confirmar; retry recupera un solo lead`, async t => {
    const s = fixture(t, { [failure]: true });
    assert.equal((await s.submit()).status, 503);
    assert.equal(s.emails.length, 0);
    assert.equal((await s.submit()).status, 201);
    assert.equal(s.odoo.records.length, 1);
    assert.equal(s.accepted.size, 1);
  });
}

test('201 perdido y retry, incluso días después: un lead y una notificación persistida', async t => {
  const s = fixture(t);
  const first = await s.submit(); // simulate losing this response at the browser
  assert.equal(first.status, 201);
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 3 * 24 * 60 * 60 * 1000);
  assert.deepEqual(await (await s.submit()).json(), { ok: true, id: 1 });
  assert.equal(s.odoo.records.length, 1);
  assert.equal(s.emails.length, 1);
  assert.equal(s.accepted.size, 1);
  assert.equal(s.odoo.calls.filter(c => c.method === 'create').length, 1);
});

test('otro submission_id con mismo contacto crea otra consulta y otra clave de notificación', async t => {
  const s = fixture(t);
  await s.submit();
  await s.submit({ ...payload, submission_id: '09f48484-38e4-4d32-8d28-44c9316371cc' });
  assert.equal(s.odoo.records.length, 2);
  assert.equal(s.accepted.size, 2);
  assert.notEqual(s.emails[0].key, s.emails[1].key);
});

for (const status of [401, 429, 503]) {
  test(`Resend HTTP ${status}: conserva 201 del lead; retry seguro con los datos originales`, async t => {
    const s = fixture(t);
    s.provider = () => Response.json({ error: `private ${env.RESEND_API_KEY}` }, { status });
    assert.deepEqual(await (await s.submit()).json(), { ok: true, id: 1 });
    assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification.status, 'pending');
    assert.ok(s.logs.some(([code]) => code === 'corporate_notification_provider_failed'));
    s.provider = null;
    assert.equal((await s.submit({ ...payload, empresa: 'Changed in browser', email: 'different@example.com' }, { ...env, CORPORATE_NOTIFICATION_FROM: 'New <new@example.com>' })).status, 201);
    assert.equal(s.odoo.records.length, 1);
    assert.equal(s.accepted.size, 1);
    assert.equal(s.emails[0].init.body, s.emails[1].init.body);
    assert.equal(s.emails[0].key, s.emails[1].key);
  });
}

test('Resend acepta pero pierde respuesta: retry usa misma clave/cuerpo sin segundo email', async t => {
  const s = fixture(t);
  s.provider = (_, accept) => { accept(); throw new Error(`network ${env.RESEND_API_KEY}`); };
  assert.equal((await s.submit()).status, 201);
  assert.equal(s.accepted.size, 1);
  s.provider = null;
  await s.submit();
  assert.equal(s.emails.length, 2);
  assert.equal(s.accepted.size, 1);
  assert.equal(s.odoo.records.length, 1);
  assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification.status, 'sent');
});

test('respuesta inválida nunca marca sent; logs/respuestas/metadata no revelan secretos del proveedor', async t => {
  const s = fixture(t);
  const replies = ['not JSON', '{}', '{"id":null}', '{"id":42}', '{"id":"not-an-id"}', JSON.stringify({ id: providerId, error: env.RESEND_API_KEY }), 'x'.repeat(16385)];
  for (const reply of replies) {
    s.provider = () => new Response(reply);
    const response = await s.submit();
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true, id: 1 });
    assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification.status, 'pending');
    assert.equal(s.logs.at(-1)[0], 'corporate_notification_provider_invalid_response');
  }
  s.provider = () => { throw new Error(`${env.RESEND_API_KEY} ${env.ODOO_API_KEY}`); };
  const text = await (await s.submit()).text();
  for (const secret of [env.RESEND_API_KEY, env.ODOO_API_KEY]) {
    assert.ok(!text.includes(secret));
    assert.ok(!JSON.stringify(s.logs).includes(secret));
    assert.ok(!s.odoo.records[0].description.includes(secret));
  }
  assert.equal(s.odoo.records.length, 1);
});

test('timeout aborta el fetch y conserva lead confirmado', async t => {
  const s = fixture(t);
  const originalSetTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => originalSetTimeout(callback, delay === 8000 ? 1 : delay, ...args));
  s.provider = ({ init }) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  assert.equal((await s.submit()).status, 201);
  assert.equal(s.emails[0].init.signal.aborted, true);
  assert.equal(s.logs.at(-1)[0], 'corporate_notification_provider_failed');
});

test('falta/configuración inválida explícita: no toca Resend ni convierte lead válido en error', async t => {
  const s = fixture(t);
  for (const patch of [{ RESEND_API_KEY: '' }, { CORPORATE_NOTIFICATION_FROM: '' }, { RESEND_API_KEY: undefined }, { CORPORATE_NOTIFICATION_FROM: 'a@example.com\r\nBcc: b@example.com' }, { CORPORATE_NOTIFICATION_FROM: 'invalid' }]) {
    assert.equal((await s.submit(payload, { ...env, ...patch })).status, 201);
    assert.match(s.logs.at(-1)[0], /^corporate_notification_configuration_(missing|invalid)$/);
    assert.equal(s.emails.length, 0);
  }
  assert.equal(s.odoo.records.length, 1);
  assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification, undefined);
  await s.submit(); // repair configuration; same lead can be notified
  assert.equal(s.accepted.size, 1);
  assert.equal(s.odoo.records.length, 1);
});

test('no se envía si no puede persistir el intento; fallo posterior a aceptación usa idempotencia', async t => {
  const s = fixture(t);
  await createCorporateLead(payload, env);
  s.odoo.failWrite = true;
  assert.equal((await s.submit()).status, 201);
  assert.equal(s.emails.length, 0);
  s.provider = (_, accept) => { s.odoo.failWrite = true; return accept(); };
  await s.submit();
  assert.equal(s.accepted.size, 1);
  assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification.status, 'pending');
  s.provider = null;
  s.odoo.records[0].description = '<p>Nota del vendedor</p>' + s.odoo.records[0].description;
  await s.submit();
  assert.equal(s.accepted.size, 1);
  assert.equal(s.odoo.records.length, 1);
  assert.match(s.odoo.records[0].description, /^<p>Nota del vendedor<\/p>/);
  assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification.status, 'sent');
});

test('sent guardado con respuesta Odoo perdida se recupera sin llamar otra vez a Resend', async t => {
  const s = fixture(t);
  s.provider = (_, accept) => { s.odoo.loseWriteResponse = true; return accept(); };
  await s.submit();
  assert.equal(parseCorporateRecord(s.odoo.records[0].description).notification.status, 'sent');
  await s.submit();
  assert.equal(s.emails.length, 1);
});

test('intento incierto fuera de ventana segura exige revisión; no reenvía tras expirar idempotencia', async t => {
  const s = fixture(t);
  s.provider = (_, accept) => { accept(); throw new Error('response lost'); };
  await s.submit();
  updateRecord(s.odoo, r => ({ ...r, notification: { ...r.notification, first_attempt_at: '2000-01-01T00:00:00.000Z' } }));
  s.provider = null;
  await s.submit();
  assert.equal(s.logs.at(-1)[0], 'corporate_notification_requires_review');
  assert.equal(s.emails.length, 1);
  assert.equal(s.accepted.size, 1);
});

test('no envía con registro sin metadata confirmada, aunque se invoque el helper directamente', async t => {
  const s = fixture(t);
  await createCorporateLead(payload, env);
  updateRecord(s.odoo, r => ({ ...r, lead_id: null }));
  assert.equal(await notifyCorporateLead(1, env), 'lead_unconfirmed');
  assert.equal(s.emails.length, 0);
});

test('payload inválido y preflight no invocan correo', async t => {
  const s = fixture(t);
  assert.equal((await s.submit({})).status, 400);
  assert.equal((await onRequest({ request: new Request('https://setupoficina.com.ar/api/corporate-leads', { method: 'OPTIONS' }), env })).status, 204);
  assert.equal(s.odoo.calls.length, 0);
  assert.equal(s.emails.length, 0);
});
