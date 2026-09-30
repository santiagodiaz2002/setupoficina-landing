import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corporateOdoo } from './helpers/corporate-odoo.mjs';
import { parseCorporateRecord } from '../functions/_lib/corporate/corporate-record.mjs';

// Point CORPORATE_RUNTIME_DIR at an existing Wrangler installation (no production secrets).
// Example: $env:CORPORATE_RUNTIME_DIR='../primoffice-empresas'
const runtimeRequire = createRequire(resolve(process.env.CORPORATE_RUNTIME_DIR || '.', 'package.json'));
const { Miniflare, convertV4MiniflareOptions } = runtimeRequire('miniflare');
const { build } = runtimeRequire('esbuild');
const root = fileURLToPath(new URL('..', import.meta.url));

test('workerd: envía sin redirect incompatible; rechaza 302 sin seguirlo y retry conserva un lead y un email', async () => {
  const env = { ODOO_ENABLED: 'true', ODOO_URL: 'https://odoo.example.test', ODOO_DB: 'test-db', ODOO_USERNAME: 'test-user', ODOO_API_KEY: 'odoo-test-secret', RESEND_API_KEY: 'resend-test-secret', CORPORATE_NOTIFICATION_FROM: 'PrimOffice <avisos@example.com>' };
  const submission = '09f48484-38e4-4d32-8d28-44c9316371cb';
  const payload = { nombre: 'Prueba local', empresa: '[PRUEBA] Runtime', email: 'persona@example.com', phone: '+54 9 11 1234-5678', tipo: 'Kits de bienvenida', cantidad: '80', fecha: '2099-12-10', detalle: '<prueba> & datos', submission_id: submission };
  const odoo = corporateOdoo(), emails = [], unexpected = [];
  let providerStatus = 302, accepted = 0;
  const bundle = await build({
    stdin: { contents: "import { onRequest } from './functions/api/corporate-leads.js'; export default { fetch: (request, env) => onRequest({ request, env }) };", resolveDir: root },
    bundle: true, format: 'esm', write: false
  });
  const options = {
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-06-12', cf: false, bindings: env,
    outboundService: async request => {
      if (request.url === 'https://api.resend.com/emails') {
        emails.push({ key: request.headers.get('Idempotency-Key'), body: await request.text() });
        if (providerStatus === 302) return new Response(null, { status: 302, headers: { Location: 'https://redirect.example.test/forbidden' } });
        accepted++;
        return Response.json({ id: 'ea349b6c-0182-49f7-84f2-6c853390a6bb' });
      }
      if (request.url.startsWith('https://odoo.example.test/xmlrpc/2/')) {
        return odoo.fetch(request.url, { body: await request.text() });
      }
      unexpected.push(request.url);
      throw new Error('External network forbidden');
    }
  };
  const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
  const submit = () => mf.dispatchFetch('https://setupoficina.com.ar/api/corporate-leads', {
    method: 'POST', headers: { Origin: 'https://empresas.primoffice.com.ar', 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  try {
    const first = await submit();
    assert.equal(first.status, 201);
    assert.deepEqual(await first.json(), { ok: true, id: 1 });
    assert.equal(emails.length, 1, 'workerd must reach the provider instead of rejecting RequestInit');
    assert.equal(accepted, 0, '302 is not accepted as a sent email');
    assert.deepEqual(unexpected, [], 'redirect destination is never called');
    assert.equal(parseCorporateRecord(odoo.records[0].description).notification.status, 'pending');
    providerStatus = 200;
    const retry = await submit();
    assert.equal(retry.status, 201);
    assert.deepEqual(await retry.json(), { ok: true, id: 1 });
    assert.equal(emails.length, 2);
    assert.equal(emails[0].key, `corporate-lead/${submission}`);
    assert.deepEqual(emails[1], emails[0], 'same key and immutable body on retry');
    const body = JSON.parse(emails[1].body);
    assert.deepEqual(body.to, ['info@primoffice.com.ar']);
    assert.equal(body.from, env.CORPORATE_NOTIFICATION_FROM);
    assert.equal(body.reply_to, payload.email);
    assert.equal(body.subject, `Nueva consulta corporativa — ${payload.empresa}`);
    assert.ok(body.html.includes('&lt;prueba&gt; &amp; datos'));
    assert.equal(parseCorporateRecord(odoo.records[0].description).notification.status, 'sent');
    assert.deepEqual(await (await submit()).json(), { ok: true, id: 1 });
    assert.equal(emails.length, 2, 'no provider call after sent is persisted');
    assert.equal(accepted, 1);
    assert.equal(odoo.records.length, 1);
    assert.equal(odoo.calls.filter(call => call.method === 'create').length, 1);
    assert.deepEqual(unexpected, []);
  } finally { await mf.dispose(); }
});
