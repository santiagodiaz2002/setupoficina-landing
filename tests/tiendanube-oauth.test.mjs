// Esta suite recorre OAuth con D1, criptografía, reloj y transporte inyectados para no usar credenciales ni red reales.
// Comprueba estado de un solo uso, cookie segura, límites, entorno, tienda, dominio, permisos, cifrado y proyección pública.
// Los escenarios adversos verifican además que códigos, acceso y secretos nunca aparezcan en HTML, JSON o errores.
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import test from 'node:test';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import assert from 'node:assert/strict';

// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { clientFromEnv } from '../functions/_lib/tiendanube/client.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { accessTokenForEnvironment } from '../functions/_lib/tiendanube/installations.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { REQUIRED_TIENDANUBE_SCOPES, validateGrantedScopes } from '../functions/_lib/tiendanube/scopes.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  handleOAuthCallback,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  handleOAuthStart,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  handleOAuthStatus
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
} from '../functions/_lib/tiendanube/oauth.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { decryptAccessToken, encryptAccessToken } from '../functions/_lib/tiendanube/token-crypto.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { MemoryD1, envFor } from './helpers/tiendanube-d1.mjs';

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const TOKEN_FIXTURE = 'oauth-token-only-for-tests';
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const CODE_FIXTURE = 'authorization-code-only-for-tests';

// Construye una petición local con encabezados y cuerpo controlados para el handler.
function request(url, cookie = '') {
// Construye una petición simulada; no sale del proceso de pruebas.
  return new Request(url, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: {
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
      ...(cookie ? { Cookie: cookie } : {}),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'CF-Connecting-IP': '203.0.113.80',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'User-Agent': 'oauth-test-agent'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un transporte HTTP simulado que registra entradas y devuelve respuestas deterministas.
function tokenAndStoreFetch(options = {}) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const calls = [];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const fetchImpl = async (url, init = {}) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    calls.push({ url: String(url), init });
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (String(url) === 'https://www.tiendanube.com/apps/authorize/token') {
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (options.exchangeThrows) throw new Error(`network ${TOKEN_FIXTURE}`);
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
      return new Response(JSON.stringify(options.tokenPayload ?? {
// Define un campo del fixture que representa una entrada o respuesta específica.
        access_token: TOKEN_FIXTURE,
// Define un campo del fixture que representa una entrada o respuesta específica.
        token_type: 'bearer',
// Define un campo del fixture que representa una entrada o respuesta específica.
        scope: 'read_products,write_scripts',
// Define un campo del fixture que representa una entrada o respuesta específica.
        user_id: '12345'
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      }), {
// Define un campo del fixture que representa una entrada o respuesta específica.
        status: options.exchangeStatus ?? 200,
// Define un campo del fixture que representa una entrada o respuesta específica.
        headers: { 'Content-Type': 'application/json' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (String(url) === 'https://api.tiendanube.com/2025-03/12345/store') {
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
      if (options.storeInvalidJson) return new Response('{', { status: 200 });
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
      return new Response(JSON.stringify(options.storePayload ?? {
// Define un campo del fixture que representa una entrada o respuesta específica.
        id: 12345,
// Define un campo del fixture que representa una entrada o respuesta específica.
        name: { es: 'PrimOffice Demo' },
// Define un campo del fixture que representa una entrada o respuesta específica.
        original_domain: 'primoffice2.mitiendanube.com',
// Define un campo del fixture que representa una entrada o respuesta específica.
        domains: ['primoffice2.mitiendanube.com']
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      }), { status: options.storeStatus ?? 200, headers: { 'Content-Type': 'application/json' } });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
    throw new Error(`URL inesperada: ${url}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { fetchImpl, calls };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Construye un doble de persistencia cuyos cambios quedan disponibles para las aserciones.
async function begin(db, env = envFor(db), now = 1000) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handleOAuthStart({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { now });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 302);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const location = new URL(response.headers.get('Location'));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const state = location.searchParams.get('state');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const cookie = response.headers.get('Set-Cookie').split(';')[0];
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { response, state, cookie };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Construye un doble de persistencia cuyos cambios quedan disponibles para las aserciones.
async function callback(db, flow, options = {}) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const env = options.env || envFor(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const upstream = options.upstream || tokenAndStoreFetch(options);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const code = options.code === undefined ? CODE_FIXTURE : options.code;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const state = options.state === undefined ? flow.state : options.state;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const url = new URL(env.TIENDANUBE_OAUTH_REDIRECT_URL);
// Selecciona la respuesta del doble o valida una precondición del escenario.
  if (code !== null) url.searchParams.set('code', code);
// Selecciona la respuesta del doble o valida una precondición del escenario.
  if (state !== null) url.searchParams.set('state', state);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handleOAuthCallback({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request(url.toString(), options.cookie === undefined ? flow.cookie : options.cookie),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { now: options.now ?? 1001, fetchImpl: upstream.fetchImpl, sleepImpl: async () => {} });
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { response, upstream };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('OAuth start guarda solo hash, asocia entorno y crea cookie segura', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const flow = await begin(db);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(flow.state, /^[A-Za-z0-9_-]{43}$/);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.oauthStates.size, 1);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const stored = [...db.oauthStates.values()][0];
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(stored.state_hash, flow.state);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(stored.environment, 'production');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(stored.expires_at - stored.created_at, 600);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const cookie = flow.response.headers.get('Set-Cookie');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(cookie, /HttpOnly/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(cookie, /Secure/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(cookie, /SameSite=Lax/);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(flow.response.headers.get('Cache-Control'), 'no-store');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const authorize = new URL(flow.response.headers.get('Location'));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(authorize.origin, 'https://www.tiendanube.com');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(authorize.pathname, '/apps/38321/authorize');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual([...authorize.searchParams.keys()], ['state']);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('OAuth usa solo el origen configurado y asocia el state al ambiente', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const invalidDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const invalidEnv = envFor(invalidDb, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://attacker.example/api/tiendanube/oauth/callback'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const invalidStart = await handleOAuthStart({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://attacker.example/api/tiendanube/oauth/start'),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: invalidEnv
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(invalidStart.status, 503);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(invalidDb.oauthStates.size, 0);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const appDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const wrongApp = await handleOAuthStart({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: envFor(appDb, { TIENDANUBE_APP_ID: '99999' })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(wrongApp.status, 503);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(appDb.oauthStates.size, 0);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const originDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const wrongOrigin = await handleOAuthStart({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://attacker.example/api/tiendanube/oauth/start'),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: envFor(originDb)
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(wrongOrigin.status, 403);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(originDb.oauthStates.size, 0);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const environmentDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const flow = await begin(environmentDb);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const previewEnv = envFor(environmentDb, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ENV: 'preview',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://demo-123.setupoficina-landing.pages.dev/api/tiendanube/oauth/callback'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const upstream = tokenAndStoreFetch();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const rejected = await callback(environmentDb, flow, { env: previewEnv, upstream });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(rejected.response.status, 400);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(upstream.calls.length, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('OAuth start aplica rate limiting sin exponer state en errores', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const env = envFor(db);
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (let index = 0; index < 10; index += 1) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const response = await handleOAuthStart({
// Define un campo del fixture que representa una entrada o respuesta específica.
      request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    }, { now: 1000 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.status, 302);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const limited = await handleOAuthStart({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { now: 1000 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(limited.status, 429);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(limited.headers.get('Retry-After'), '60');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(await limited.text(), /Instalacion fallida/);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.oauthStates.size, 10);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('callback valido consume state, valida dominio y cifra la instalacion', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const flow = await begin(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { response, upstream } = await callback(db, flow);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 200);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const html = await response.text();
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /Instalacion exitosa/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /PrimOffice Demo/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /12345/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /primoffice2\.mitiendanube\.com/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /read_products, write_scripts/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(html, new RegExp(TOKEN_FIXTURE));
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(html, new RegExp(CODE_FIXTURE));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal([...db.oauthStates.values()][0].consumed_at, 1001);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const installation = db.installations.get('12345');
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(installation);
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(installation.encrypted_access_token, TOKEN_FIXTURE);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(installation.store_domain, 'primoffice2.mitiendanube.com');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const exchangeBody = JSON.parse(upstream.calls[0].init.body);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(exchangeBody, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client_id: '38321',
// Define un campo del fixture que representa una entrada o respuesta específica.
    client_secret: 'test-client-secret',
// Define un campo del fixture que representa una entrada o respuesta específica.
    grant_type: 'authorization_code',
// Define un campo del fixture que representa una entrada o respuesta específica.
    code: CODE_FIXTURE
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(upstream.calls[0].url, 'https://www.tiendanube.com/apps/authorize/token');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(upstream.calls[0].init.method, 'POST');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(upstream.calls[0].init.headers['Content-Type'], 'application/json');
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(upstream.calls.every((call) => !call.url.includes(TOKEN_FIXTURE) && !call.url.includes(CODE_FIXTURE)));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(upstream.calls[1].init.headers.Authorization, `Bearer ${TOKEN_FIXTURE}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('primera instalacion descubre y guarda store ID sin configuracion previa', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const env = envFor(db, { TIENDANUBE_STORE_ID: '' });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const flow = await begin(db, env);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const installed = await callback(db, flow, { env });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(installed.response.status, 200);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.installations.get('12345').store_domain, 'primoffice2.mitiendanube.com');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal([...db.oauthStates.values()][0].store_id, '12345');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const status = await handleOAuthStatus({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/status'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(status.status, 200);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(await status.json(), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    installed: false,
// Define un campo del fixture que representa una entrada o respuesta específica.
    storeId: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
    storeDomain: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
    scopes: [],
// Define un campo del fixture que representa una entrada o respuesta específica.
    installedAt: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
    configurationReady: false
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('OAuth exige exactamente read_products y write_scripts antes de cifrar', async () => {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(validateGrantedScopes('write_scripts,read_products'), [...REQUIRED_TIENDANUBE_SCOPES]);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(validateGrantedScopes(['read_products', 'write_scripts']), [...REQUIRED_TIENDANUBE_SCOPES]);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(validateGrantedScopes({ scopes: 'read_products write_scripts' }), [...REQUIRED_TIENDANUBE_SCOPES]);

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const scope of [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'read_products',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'read_products,write_scripts,read_orders',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    ['read_products', 42],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { unexpected: ['read_products', 'write_scripts'] },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'read_products,read_products,write_scripts'
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ]) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const flow = await begin(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const result = await callback(db, flow, {
// Define un campo del fixture que representa una entrada o respuesta específica.
      tokenPayload: { access_token: TOKEN_FIXTURE, user_id: '12345', scope }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(result.response.status, 403);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(db.installations.size, 0);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(await result.response.text(), new RegExp(TOKEN_FIXTURE));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('OAuth start bloquea cualquier instalacion activa antes de crear state, cookie o redireccion', async () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const configuredStoreId of ['12345', '']) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const db = new MemoryD1();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    db.installations.set('99999', {
// Define un campo del fixture que representa una entrada o respuesta específica.
      store_id: '99999',
// Define un campo del fixture que representa una entrada o respuesta específica.
      store_domain: 'tienda-activa.mitiendanube.com',
// Define un campo del fixture que representa una entrada o respuesta específica.
      encrypted_access_token: 'ciphertext-fixture',
// Define un campo del fixture que representa una entrada o respuesta específica.
      encryption_iv: 'AAAAAAAAAAAAAAAA',
// Define un campo del fixture que representa una entrada o respuesta específica.
      scopes_json: '["read_products","write_scripts"]',
// Define un campo del fixture que representa una entrada o respuesta específica.
      installed_at: 900,
// Define un campo del fixture que representa una entrada o respuesta específica.
      updated_at: 900,
// Define un campo del fixture que representa una entrada o respuesta específica.
      revoked_at: null
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Reserva estado mutable para registrar llamadas o simular una transición.
    let tokenEndpointCalls = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const response = await handleOAuthStart({
// Define un campo del fixture que representa una entrada o respuesta específica.
      request: request('https://setupoficina.com.ar/api/tiendanube/oauth/start'),
// Define un campo del fixture que representa una entrada o respuesta específica.
      env: envFor(db, { TIENDANUBE_STORE_ID: configuredStoreId })
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    }, {
// Define un campo del fixture que representa una entrada o respuesta específica.
      now: 1000,
// Define un campo del fixture que representa una entrada o respuesta específica.
      fetchImpl: async () => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        tokenEndpointCalls += 1;
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
        throw new Error('El endpoint de tokens no debe ejecutarse.');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.status, 409);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(db.oauthStates.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(db.rates.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.headers.get('Set-Cookie'), null);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.headers.get('Location'), null);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(tokenEndpointCalls, 0);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
    assert.match(await response.text(), /Instalacion fallida/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('callback rechaza state o code faltante y cookie faltante', async () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const scenario of [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { code: null, expected: 400 },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { state: null, expected: 400 },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { cookie: '', expected: 400 },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { cookie: 'setupoficina_oauth_state=invalid', expected: 400 }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ]) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const flow = await begin(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const { response } = await callback(db, flow, scenario);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.status, scenario.expected);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
    assert.match(await response.text(), /Instalacion fallida/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('callback rechaza state invalido o inexistente', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const flow = await begin(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const otherState = 'B'.repeat(43);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const mismatched = await callback(db, flow, { state: otherState });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(mismatched.response.status, 400);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const nonexistent = await callback(new MemoryD1(), { state: otherState, cookie: `setupoficina_oauth_state=${otherState}` });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(nonexistent.response.status, 400);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('callback rechaza state vencido y reutilizado atomicamente', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const expiredDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const expiredFlow = await begin(expiredDb);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await callback(expiredDb, expiredFlow, { now: 1600 })).response.status, 410);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const reusedDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const reusedFlow = await begin(reusedDb);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await callback(reusedDb, reusedFlow)).response.status, 200);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const secondUpstream = tokenAndStoreFetch();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const reused = await callback(reusedDb, reusedFlow, { upstream: secondUpstream, now: 1002 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(reused.response.status, 409);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(secondUpstream.calls.length, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('errores de intercambio o respuestas invalidas no exponen credenciales', async () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const options of [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { exchangeStatus: 500 },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { exchangeThrows: true },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { tokenPayload: { user_id: '12345' } },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { storeInvalidJson: true }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ]) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const flow = await begin(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const { response } = await callback(db, flow, options);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.status, 502);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const html = await response.text();
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
    assert.match(html, /Instalacion fallida/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(html, new RegExp(TOKEN_FIXTURE));
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(html, /test-client-secret/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(html, new RegExp(CODE_FIXTURE));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('dominio esperado instala y dominio no autorizado se rechaza', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const allowedDb = new MemoryD1();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await callback(allowedDb, await begin(allowedDb))).response.status, 200);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const rejectedDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const rejected = await callback(rejectedDb, await begin(rejectedDb), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    storePayload: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      id: 12345,
// Define un campo del fixture que representa una entrada o respuesta específica.
      name: { es: 'Otra tienda' },
// Define un campo del fixture que representa una entrada o respuesta específica.
      original_domain: 'otra-tienda.mitiendanube.com',
// Define un campo del fixture que representa una entrada o respuesta específica.
      domains: ['otra-tienda.example.com']
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(rejected.response.status, 403);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(rejectedDb.installations.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal([...rejectedDb.oauthStates.values()][0].store_id, null);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(await rejected.response.text(), /Otra tienda/);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const wrongStoreDb = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const wrongStore = await callback(wrongStoreDb, await begin(wrongStoreDb), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    tokenPayload: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      access_token: TOKEN_FIXTURE,
// Define un campo del fixture que representa una entrada o respuesta específica.
      scope: 'read_products write_scripts',
// Define un campo del fixture que representa una entrada o respuesta específica.
      user_id: '99999'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(wrongStore.response.status, 403);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(wrongStoreDb.installations.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(wrongStore.upstream.calls.length, 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('callback escapa el nombre de tienda antes de generar HTML', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const result = await callback(db, await begin(db), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    storePayload: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      id: 12345,
// Define un campo del fixture que representa una entrada o respuesta específica.
      name: { es: '<script>alert("x")</script>' },
// Define un campo del fixture que representa una entrada o respuesta específica.
      original_domain: 'primoffice2.mitiendanube.com',
// Define un campo del fixture que representa una entrada o respuesta específica.
      domains: []
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(result.response.status, 200);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const html = await result.response.text();
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(html, /<script>/i);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('AES-256-GCM cifra y descifra y rechaza clave invalida', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const encrypted = await encryptAccessToken(TOKEN_FIXTURE, TEST_KEY, '12345');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const encryptedAgain = await encryptAccessToken(TOKEN_FIXTURE, TEST_KEY, '12345');
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(encrypted.encryptedAccessToken, TOKEN_FIXTURE);
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(encrypted.encryptionIv, encryptedAgain.encryptionIv);
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(encrypted.encryptedAccessToken, encryptedAgain.encryptedAccessToken);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(await decryptAccessToken({
// Define un campo del fixture que representa una entrada o respuesta específica.
    encrypted_access_token: encrypted.encryptedAccessToken,
// Define un campo del fixture que representa una entrada o respuesta específica.
    encryption_iv: encrypted.encryptionIv
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, TEST_KEY, '12345'), TOKEN_FIXTURE);
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(encryptAccessToken(TOKEN_FIXTURE, 'invalid-key', '12345'), (error) => {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(error.code, 'token_encryption_key_invalid');
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(error.message, new RegExp(TOKEN_FIXTURE));
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('status devuelve solo campos publicos y no permite elegir otra tienda', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const flow = await begin(db);
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await callback(db, flow);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const env = envFor(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handleOAuthStatus({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/status'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 200);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const body = await response.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(Object.keys(body).sort(), ['configurationReady', 'installed', 'installedAt', 'scopes', 'storeDomain', 'storeId']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.installed, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.configurationReady, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(body.storeId, '12345');
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(JSON.stringify(body), /token|cipher|secret|iv/i);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const enumeration = await handleOAuthStatus({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: request('https://setupoficina.com.ar/api/tiendanube/oauth/status?storeId=999'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(enumeration.status, 400);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(Object.keys(await enumeration.json()).sort(), Object.keys(body).sort());
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del flujo OAuth y aísla el estado o la credencial necesarios para observar una transición concreta.
test('cliente carga token cifrado de D1 y fallback plano solo funciona en Preview', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await callback(db, await begin(db));
// Reserva estado mutable para registrar llamadas o simular una transición.
  let authorization = '';
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const api = await clientFromEnv(envFor(db), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    storeId: '99999',
// Define un campo del fixture que representa una entrada o respuesta específica.
    accessToken: 'caller-supplied-token-must-be-ignored',
// Define un campo del fixture que representa una entrada o respuesta específica.
    fetchImpl: async (_url, options) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      authorization = options.headers.Authorization;
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
      return new Response('{"id":1}', { status: 200, headers: { 'Content-Type': 'application/json' } });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await api.getProduct(1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(api.storeId, '12345');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(authorization, `Bearer ${TOKEN_FIXTURE}`);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const production = envFor(new MemoryD1(), { TIENDANUBE_ACCESS_TOKEN: 'development-only-token' });
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(accessTokenForEnvironment(production), (error) => error.code === 'oauth_installation_missing');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const preview = envFor(new MemoryD1(), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ACCESS_TOKEN: 'development-only-token',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ENV: 'preview',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://demo-123.setupoficina-landing.pages.dev/api/tiendanube/oauth/callback'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const fallback = await accessTokenForEnvironment(preview);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(fallback.source, 'preview_fallback');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(fallback.accessToken, 'development-only-token');

// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    accessTokenForEnvironment(envFor(new MemoryD1(), { TIENDANUBE_STORE_ID: '' })),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    (error) => error.code === 'store_not_configured'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});
