import test from 'node:test';
import assert from 'node:assert/strict';

import { clientFromEnv } from '../functions/_lib/tiendanube/client.mjs';
import { accessTokenForEnvironment } from '../functions/_lib/tiendanube/installations.mjs';
import { REQUIRED_TIENDANUBE_SCOPES, validateGrantedScopes } from '../functions/_lib/tiendanube/scopes.mjs';
import {
  handleOAuthCallback,
  handleOAuthStart,
  handleOAuthStatus
} from '../functions/_lib/tiendanube/oauth.mjs';
import { decryptAccessToken, encryptAccessToken } from '../functions/_lib/tiendanube/token-crypto.mjs';
import { MemoryD1, envFor } from './helpers/tiendanube-d1.mjs';

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const TOKEN_FIXTURE = 'oauth-token-only-for-tests';
const CODE_FIXTURE = 'authorization-code-only-for-tests';

function request(url, cookie = '') {
  return new Request(url, {
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      'CF-Connecting-IP': '203.0.113.80',
      'User-Agent': 'oauth-test-agent'
    }
  });
}

function tokenAndStoreFetch(options = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === 'https://www.tiendanube.com/apps/authorize/token') {
      if (options.exchangeThrows) throw new Error(`network ${TOKEN_FIXTURE}`);
      return new Response(JSON.stringify(options.tokenPayload ?? {
        access_token: TOKEN_FIXTURE,
        token_type: 'bearer',
        scope: 'read_products,write_scripts',
        user_id: '12345'
      }), {
        status: options.exchangeStatus ?? 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (String(url) === 'https://api.tiendanube.com/2025-03/12345/store') {
      if (options.storeInvalidJson) return new Response('{', { status: 200 });
      return new Response(JSON.stringify(options.storePayload ?? {
        id: 12345,
        name: { es: 'PrimOffice Demo' },
        original_domain: 'primoffice2.mitiendanube.com',
        domains: ['primoffice2.mitiendanube.com']
      }), { status: options.storeStatus ?? 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  return { fetchImpl, calls };
}

async function begin(db, env = envFor(db), now = 1000) {
  const response = await handleOAuthStart({
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
    env
  }, { now });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  const state = location.searchParams.get('state');
  const cookie = response.headers.get('Set-Cookie').split(';')[0];
  return { response, state, cookie };
}

async function callback(db, flow, options = {}) {
  const env = options.env || envFor(db);
  const upstream = options.upstream || tokenAndStoreFetch(options);
  const code = options.code === undefined ? CODE_FIXTURE : options.code;
  const state = options.state === undefined ? flow.state : options.state;
  const url = new URL(env.TIENDANUBE_OAUTH_REDIRECT_URL);
  if (code !== null) url.searchParams.set('code', code);
  if (state !== null) url.searchParams.set('state', state);
  const response = await handleOAuthCallback({
    request: request(url.toString(), options.cookie === undefined ? flow.cookie : options.cookie),
    env
  }, { now: options.now ?? 1001, fetchImpl: upstream.fetchImpl, sleepImpl: async () => {} });
  return { response, upstream };
}

test('OAuth start guarda solo hash, asocia entorno y crea cookie segura', async () => {
  const db = new MemoryD1();
  const flow = await begin(db);
  assert.match(flow.state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(db.oauthStates.size, 1);
  const stored = [...db.oauthStates.values()][0];
  assert.notEqual(stored.state_hash, flow.state);
  assert.equal(stored.environment, 'production');
  assert.equal(stored.expires_at - stored.created_at, 600);
  const cookie = flow.response.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(flow.response.headers.get('Cache-Control'), 'no-store');
  const authorize = new URL(flow.response.headers.get('Location'));
  assert.equal(authorize.origin, 'https://www.tiendanube.com');
  assert.equal(authorize.pathname, '/apps/38321/authorize');
  assert.deepEqual([...authorize.searchParams.keys()], ['state']);
});

test('OAuth usa solo el origen configurado y asocia el state al ambiente', async () => {
  const invalidDb = new MemoryD1();
  const invalidEnv = envFor(invalidDb, {
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://attacker.example/api/tiendanube/oauth/callback'
  });
  const invalidStart = await handleOAuthStart({
    request: request('https://attacker.example/api/tiendanube/oauth/start'),
    env: invalidEnv
  });
  assert.equal(invalidStart.status, 503);
  assert.equal(invalidDb.oauthStates.size, 0);

  const appDb = new MemoryD1();
  const wrongApp = await handleOAuthStart({
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
    env: envFor(appDb, { TIENDANUBE_APP_ID: '99999' })
  });
  assert.equal(wrongApp.status, 503);
  assert.equal(appDb.oauthStates.size, 0);

  const originDb = new MemoryD1();
  const wrongOrigin = await handleOAuthStart({
    request: request('https://attacker.example/api/tiendanube/oauth/start'),
    env: envFor(originDb)
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal(originDb.oauthStates.size, 0);

  const environmentDb = new MemoryD1();
  const flow = await begin(environmentDb);
  const previewEnv = envFor(environmentDb, {
    TIENDANUBE_ENV: 'preview',
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://demo-123.setupoficina-landing.pages.dev/api/tiendanube/oauth/callback'
  });
  const upstream = tokenAndStoreFetch();
  const rejected = await callback(environmentDb, flow, { env: previewEnv, upstream });
  assert.equal(rejected.response.status, 400);
  assert.equal(upstream.calls.length, 0);
});

test('OAuth start aplica rate limiting sin exponer state en errores', async () => {
  const db = new MemoryD1();
  const env = envFor(db);
  for (let index = 0; index < 10; index += 1) {
    const response = await handleOAuthStart({
      request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
      env
    }, { now: 1000 });
    assert.equal(response.status, 302);
  }
  const limited = await handleOAuthStart({
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
    env
  }, { now: 1000 });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.match(await limited.text(), /Instalacion fallida/);
  assert.equal(db.oauthStates.size, 10);
});

test('callback valido consume state, valida dominio y cifra la instalacion', async () => {
  const db = new MemoryD1();
  const flow = await begin(db);
  const { response, upstream } = await callback(db, flow);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Instalacion exitosa/);
  assert.match(html, /PrimOffice Demo/);
  assert.match(html, /12345/);
  assert.match(html, /primoffice2\.mitiendanube\.com/);
  assert.match(html, /read_products, write_scripts/);
  assert.doesNotMatch(html, new RegExp(TOKEN_FIXTURE));
  assert.doesNotMatch(html, new RegExp(CODE_FIXTURE));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal([...db.oauthStates.values()][0].consumed_at, 1001);
  const installation = db.installations.get('12345');
  assert.ok(installation);
  assert.notEqual(installation.encrypted_access_token, TOKEN_FIXTURE);
  assert.equal(installation.store_domain, 'primoffice2.mitiendanube.com');
  const exchangeBody = JSON.parse(upstream.calls[0].init.body);
  assert.deepEqual(exchangeBody, {
    client_id: '38321',
    client_secret: 'test-client-secret',
    grant_type: 'authorization_code',
    code: CODE_FIXTURE
  });
  assert.equal(upstream.calls[0].url, 'https://www.tiendanube.com/apps/authorize/token');
  assert.equal(upstream.calls[0].init.method, 'POST');
  assert.equal(upstream.calls[0].init.headers['Content-Type'], 'application/json');
  assert.ok(upstream.calls.every((call) => !call.url.includes(TOKEN_FIXTURE) && !call.url.includes(CODE_FIXTURE)));
  assert.equal(upstream.calls[1].init.headers.Authorization, `Bearer ${TOKEN_FIXTURE}`);
});

test('primera instalacion descubre y guarda store ID sin configuracion previa', async () => {
  const db = new MemoryD1();
  const env = envFor(db, { TIENDANUBE_STORE_ID: '' });
  const flow = await begin(db, env);
  const installed = await callback(db, flow, { env });
  assert.equal(installed.response.status, 200);
  assert.equal(db.installations.get('12345').store_domain, 'primoffice2.mitiendanube.com');
  assert.equal([...db.oauthStates.values()][0].store_id, '12345');

  const status = await handleOAuthStatus({
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/status'),
    env
  });
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), {
    installed: false,
    storeId: null,
    storeDomain: null,
    scopes: [],
    installedAt: null,
    configurationReady: false
  });
});

test('OAuth exige exactamente read_products y write_scripts antes de cifrar', async () => {
  assert.deepEqual(validateGrantedScopes('write_scripts,read_products'), [...REQUIRED_TIENDANUBE_SCOPES]);
  assert.deepEqual(validateGrantedScopes(['read_products', 'write_scripts']), [...REQUIRED_TIENDANUBE_SCOPES]);
  assert.deepEqual(validateGrantedScopes({ scopes: 'read_products write_scripts' }), [...REQUIRED_TIENDANUBE_SCOPES]);

  for (const scope of [
    'read_products',
    'read_products,write_scripts,read_orders',
    ['read_products', 42],
    { unexpected: ['read_products', 'write_scripts'] },
    'read_products,read_products,write_scripts'
  ]) {
    const db = new MemoryD1();
    const flow = await begin(db);
    const result = await callback(db, flow, {
      tokenPayload: { access_token: TOKEN_FIXTURE, user_id: '12345', scope }
    });
    assert.equal(result.response.status, 403);
    assert.equal(db.installations.size, 0);
    assert.doesNotMatch(await result.response.text(), new RegExp(TOKEN_FIXTURE));
  }
});

test('OAuth start bloquea cualquier instalacion activa antes de crear state, cookie o redireccion', async () => {
  for (const configuredStoreId of ['12345', '']) {
    const db = new MemoryD1();
    db.installations.set('99999', {
      store_id: '99999',
      store_domain: 'tienda-activa.mitiendanube.com',
      encrypted_access_token: 'ciphertext-fixture',
      encryption_iv: 'AAAAAAAAAAAAAAAA',
      scopes_json: '["read_products","write_scripts"]',
      installed_at: 900,
      updated_at: 900,
      revoked_at: null
    });
    let tokenEndpointCalls = 0;
    const response = await handleOAuthStart({
      request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
      env: envFor(db, { TIENDANUBE_STORE_ID: configuredStoreId })
    }, {
      now: 1000,
      fetchImpl: async () => {
        tokenEndpointCalls += 1;
        throw new Error('El endpoint de tokens no debe ejecutarse.');
      }
    });

    assert.equal(response.status, 409);
    assert.equal(db.oauthStates.size, 0);
    assert.equal(db.rates.size, 0);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(response.headers.get('Location'), null);
    assert.equal(tokenEndpointCalls, 0);
    assert.match(await response.text(), /Instalacion fallida/);
  }
});

test('callback rechaza state o code faltante y cookie faltante', async () => {
  for (const scenario of [
    { code: null, expected: 400 },
    { state: null, expected: 400 },
    { cookie: '', expected: 400 },
    { cookie: 'setupoficina_oauth_state=invalid', expected: 400 }
  ]) {
    const db = new MemoryD1();
    const flow = await begin(db);
    const { response } = await callback(db, flow, scenario);
    assert.equal(response.status, scenario.expected);
    assert.match(await response.text(), /Instalacion fallida/);
  }
});

test('callback rechaza state invalido o inexistente', async () => {
  const db = new MemoryD1();
  const flow = await begin(db);
  const otherState = 'B'.repeat(43);
  const mismatched = await callback(db, flow, { state: otherState });
  assert.equal(mismatched.response.status, 400);

  const nonexistent = await callback(new MemoryD1(), { state: otherState, cookie: `setupoficina_oauth_state=${otherState}` });
  assert.equal(nonexistent.response.status, 400);
});

test('callback rechaza state vencido y reutilizado atomicamente', async () => {
  const expiredDb = new MemoryD1();
  const expiredFlow = await begin(expiredDb);
  assert.equal((await callback(expiredDb, expiredFlow, { now: 1600 })).response.status, 410);

  const reusedDb = new MemoryD1();
  const reusedFlow = await begin(reusedDb);
  assert.equal((await callback(reusedDb, reusedFlow)).response.status, 200);
  const secondUpstream = tokenAndStoreFetch();
  const reused = await callback(reusedDb, reusedFlow, { upstream: secondUpstream, now: 1002 });
  assert.equal(reused.response.status, 409);
  assert.equal(secondUpstream.calls.length, 0);
});

test('errores de intercambio o respuestas invalidas no exponen credenciales', async () => {
  for (const options of [
    { exchangeStatus: 500 },
    { exchangeThrows: true },
    { tokenPayload: { user_id: '12345' } },
    { storeInvalidJson: true }
  ]) {
    const db = new MemoryD1();
    const flow = await begin(db);
    const { response } = await callback(db, flow, options);
    assert.equal(response.status, 502);
    const html = await response.text();
    assert.match(html, /Instalacion fallida/);
    assert.doesNotMatch(html, new RegExp(TOKEN_FIXTURE));
    assert.doesNotMatch(html, /test-client-secret/);
    assert.doesNotMatch(html, new RegExp(CODE_FIXTURE));
  }
});

test('dominio esperado instala y dominio no autorizado se rechaza', async () => {
  const allowedDb = new MemoryD1();
  assert.equal((await callback(allowedDb, await begin(allowedDb))).response.status, 200);

  const rejectedDb = new MemoryD1();
  const rejected = await callback(rejectedDb, await begin(rejectedDb), {
    storePayload: {
      id: 12345,
      name: { es: 'Otra tienda' },
      original_domain: 'otra-tienda.mitiendanube.com',
      domains: ['otra-tienda.example.com']
    }
  });
  assert.equal(rejected.response.status, 403);
  assert.equal(rejectedDb.installations.size, 0);
  assert.equal([...rejectedDb.oauthStates.values()][0].store_id, null);
  assert.doesNotMatch(await rejected.response.text(), /Otra tienda/);

  const wrongStoreDb = new MemoryD1();
  const wrongStore = await callback(wrongStoreDb, await begin(wrongStoreDb), {
    tokenPayload: {
      access_token: TOKEN_FIXTURE,
      scope: 'read_products write_scripts',
      user_id: '99999'
    }
  });
  assert.equal(wrongStore.response.status, 403);
  assert.equal(wrongStoreDb.installations.size, 0);
  assert.equal(wrongStore.upstream.calls.length, 1);
});

test('callback escapa el nombre de tienda antes de generar HTML', async () => {
  const db = new MemoryD1();
  const result = await callback(db, await begin(db), {
    storePayload: {
      id: 12345,
      name: { es: '<script>alert("x")</script>' },
      original_domain: 'primoffice2.mitiendanube.com',
      domains: []
    }
  });
  assert.equal(result.response.status, 200);
  const html = await result.response.text();
  assert.doesNotMatch(html, /<script>/i);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});

test('AES-256-GCM cifra y descifra y rechaza clave invalida', async () => {
  const encrypted = await encryptAccessToken(TOKEN_FIXTURE, TEST_KEY, '12345');
  const encryptedAgain = await encryptAccessToken(TOKEN_FIXTURE, TEST_KEY, '12345');
  assert.notEqual(encrypted.encryptedAccessToken, TOKEN_FIXTURE);
  assert.notEqual(encrypted.encryptionIv, encryptedAgain.encryptionIv);
  assert.notEqual(encrypted.encryptedAccessToken, encryptedAgain.encryptedAccessToken);
  assert.equal(await decryptAccessToken({
    encrypted_access_token: encrypted.encryptedAccessToken,
    encryption_iv: encrypted.encryptionIv
  }, TEST_KEY, '12345'), TOKEN_FIXTURE);
  await assert.rejects(encryptAccessToken(TOKEN_FIXTURE, 'invalid-key', '12345'), (error) => {
    assert.equal(error.code, 'token_encryption_key_invalid');
    assert.doesNotMatch(error.message, new RegExp(TOKEN_FIXTURE));
    return true;
  });
});

test('status devuelve solo campos publicos y no permite elegir otra tienda', async () => {
  const db = new MemoryD1();
  const flow = await begin(db);
  await callback(db, flow);
  const env = envFor(db);
  const response = await handleOAuthStatus({
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/status'),
    env
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['configurationReady', 'installed', 'installedAt', 'scopes', 'storeDomain', 'storeId']);
  assert.equal(body.installed, true);
  assert.equal(body.configurationReady, true);
  assert.equal(body.storeId, '12345');
  assert.doesNotMatch(JSON.stringify(body), /token|cipher|secret|iv/i);

  const enumeration = await handleOAuthStatus({
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/status?storeId=999'),
    env
  });
  assert.equal(enumeration.status, 400);
  assert.deepEqual(Object.keys(await enumeration.json()).sort(), Object.keys(body).sort());
});

test('cliente carga token cifrado de D1 y fallback plano solo funciona en Preview', async () => {
  const db = new MemoryD1();
  await callback(db, await begin(db));
  let authorization = '';
  const api = await clientFromEnv(envFor(db), {
    storeId: '99999',
    accessToken: 'caller-supplied-token-must-be-ignored',
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return new Response('{"id":1}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  await api.getProduct(1);
  assert.equal(api.storeId, '12345');
  assert.equal(authorization, `Bearer ${TOKEN_FIXTURE}`);

  const production = envFor(new MemoryD1(), { TIENDANUBE_ACCESS_TOKEN: 'development-only-token' });
  await assert.rejects(accessTokenForEnvironment(production), (error) => error.code === 'oauth_installation_missing');

  const preview = envFor(new MemoryD1(), {
    TIENDANUBE_ACCESS_TOKEN: 'development-only-token',
    TIENDANUBE_ENV: 'preview',
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://demo-123.setupoficina-landing.pages.dev/api/tiendanube/oauth/callback'
  });
  const fallback = await accessTokenForEnvironment(preview);
  assert.equal(fallback.source, 'preview_fallback');
  assert.equal(fallback.accessToken, 'development-only-token');

  await assert.rejects(
    accessTokenForEnvironment(envFor(new MemoryD1(), { TIENDANUBE_STORE_ID: '' })),
    (error) => error.code === 'store_not_configured'
  );
});
