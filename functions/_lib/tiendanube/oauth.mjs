// Este módulo implementa inicio, retorno y consulta de estado del OAuth de Tiendanube para Pages Functions.
// Coordina estado de un solo uso en D1, cookie segura, intercambio de código, validación de tienda y persistencia cifrada.
// Sin sus comprobaciones de origen, caducidad, permisos y dominio, un retorno externo podría instalar una tienda no autorizada.
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  TiendanubeClient,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  apiBaseFromEnv,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  localizedText,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  readBoundedResponseText,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  userAgentFromEnv
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
} from './client.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { HttpError, jsonResponse } from './http.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  hasAnyActiveInstallation,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  installationPublicStatus,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  loadActiveInstallation,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  optionalConfiguredStoreId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  saveInstallation
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
} from './installations.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  assertConfiguredOAuthRequest,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  configuredAppId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  expectedStoreDomains,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  normalizeStoreDomain,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  OAUTH_CALLBACK_PATH,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  oauthRedirectConfig
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
} from './oauth-config.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { enforceRateLimit } from './rate-limit.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { validateGrantedScopes } from './scopes.mjs';
import { ensureTiendanubeSchema } from './schema.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { randomTicket, sha256Hex, timingSafeEqual } from './security.mjs';

// Calcula y conserva un dato inmutable dentro de este alcance.
const AUTHORIZE_URL = 'https://www.tiendanube.com/apps';
// Calcula y conserva un dato inmutable dentro de este alcance.
const TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';
// Calcula y conserva un dato inmutable dentro de este alcance.
const STATE_COOKIE = 'setupoficina_oauth_state';
// Calcula y conserva un dato inmutable dentro de este alcance.
const STATE_TTL_SECONDS = 10 * 60;
// Calcula y conserva un dato inmutable dentro de este alcance.
const OAUTH_START_PATH = '/api/tiendanube/oauth/start';
// Calcula y conserva un dato inmutable dentro de este alcance.
const OAUTH_STATUS_PATH = '/api/tiendanube/oauth/status';
// Calcula y conserva un dato inmutable dentro de este alcance.
const OAUTH_RESPONSE_MAX_BYTES = 64 * 1024;

// Obtiene el binding D1 usado para estado e instalaciones y detiene el flujo si falta.
function database(env) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return env.LEADS_DB;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Resuelve el reloj inyectado o el tiempo actual en segundos para pruebas deterministas y caducidad.
function nowSeconds(deps) {
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return Number(deps.now ?? Math.floor(Date.now() / 1000));
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Construye la cookie temporal con atributos que restringen script, transporte y envío entre sitios.
function stateCookie(value, maxAge = STATE_TTL_SECONDS) {
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; Path=${OAUTH_CALLBACK_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Extrae una cookie concreta sin asumir que el encabezado existe ni que todos sus fragmentos son válidos.
function cookieValue(request, name) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const cookies = String(request.headers.get('Cookie') || '').split(';');
// Recorre una colección acotada para validar o transformar cada elemento.
  for (const cookie of cookies) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const separator = cookie.indexOf('=');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
// Aísla una operación que puede fallar por datos externos, red o persistencia.
    try { return decodeURIComponent(cookie.slice(separator + 1).trim()); } catch (_) { return ''; }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return '';
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Escapa contenido dinámico antes de insertarlo en la página de resultado y evita interpretar marcado.
function htmlEscape(value) {
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return String(value ?? '')
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    .replaceAll('&', '&amp;')
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    .replaceAll('<', '&lt;')
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    .replaceAll('>', '&gt;')
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    .replaceAll('"', '&quot;')
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    .replaceAll("'", '&#39;');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Construye la respuesta HTML final con política de contenido restrictiva y limpieza opcional de cookie.
function oauthHtmlResponse(success, details = {}, status = 200, clearCookie = false, extraHeaders = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const outcome = success ? 'Instalacion exitosa' : 'Instalacion fallida';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeName = details.storeName || 'No disponible';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeId = details.storeId || 'No disponible';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeDomain = details.storeDomain || 'No disponible';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const scopes = Array.isArray(details.scopes) && details.scopes.length ? details.scopes.join(', ') : 'Ninguno';
// Expone solo un código estable y no sensible para diagnosticar el punto de fallo sin revelar credenciales ni excepciones internas.
  const diagnosticCode = String(details.diagnosticCode || '').trim();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosticHtml = diagnosticCode ? `<dt>Codigo de diagnostico</dt><dd>${htmlEscape(diagnosticCode)}</dd>` : '';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const body = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${outcome}</title></head><body><main><h1>${outcome}</h1><dl><dt>Nombre de la tienda</dt><dd>${htmlEscape(storeName)}</dd><dt>Store ID</dt><dd>${htmlEscape(storeId)}</dd><dt>Dominio</dt><dd>${htmlEscape(storeDomain)}</dd><dt>Scopes concedidos</dt><dd>${htmlEscape(scopes)}</dd>${diagnosticHtml}</dl></main></body></html>`;
// Construye una respuesta HTTP explícita con estado, cuerpo y encabezados controlados.
  return new Response(body, {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    status,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    headers: {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      'Content-Type': 'text/html; charset=utf-8',
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      'Cache-Control': 'no-store',
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      'Referrer-Policy': 'no-referrer',
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      'X-Content-Type-Options': 'nosniff',
// Incorpora propiedades ya validadas en el nuevo objeto sin modificar el original.
      ...extraHeaders,
// Incorpora propiedades ya validadas en el nuevo objeto sin modificar el original.
      ...(clearCookie ? { 'Set-Cookie': stateCookie('', 0) } : {})
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  });
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Limita el estado de error a un rango HTTP visible y usa un valor seguro para fallos internos.
function safeStatus(error) {
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return error instanceof HttpError ? error.status : 500;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Transforma cualquier excepción del flujo en una página estable que no revela credenciales ni códigos.
function oauthFailure(error, clearCookie = false) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const headers = error instanceof HttpError ? error.headers : {};
// El código es deliberadamente estable y no contiene mensajes, stack traces ni valores de configuración.
  const diagnosticCode = error instanceof HttpError ? error.code : 'oauth_internal_error';
// Devuelve la respuesta final y cede el control al runtime de Pages.
  return oauthHtmlResponse(false, { diagnosticCode }, safeStatus(error), clearCookie, headers);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Traduce fallos inesperados de infraestructura a un código estable por etapa; conserva HttpError ya sanitizados.
function oauthStageError(error, code, message) {
  if (error instanceof HttpError) return error;
  return new HttpError(500, code, message);
}

// Genera entropía, persiste solo su resumen y devuelve el valor opaco que viaja por navegador.
async function insertOAuthState(db, environment, now, deps) {
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
  await db.prepare('DELETE FROM tiendanube_oauth_states WHERE expires_at <= ?').bind(now).run();
// Recorre una colección acotada para validar o transformar cada elemento.
  for (let attempt = 0; attempt < 3; attempt += 1) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const state = deps.randomState ? String(deps.randomState()) : randomTicket(deps.cryptoImpl).token;
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new HttpError(500, 'oauth_state_generation_failed', 'No se pudo iniciar OAuth.');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const stateHash = await sha256Hex(state, deps.cryptoImpl);
// Aísla una operación que puede fallar por datos externos, red o persistencia.
    try {
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
      await db.prepare(`
        INSERT INTO tiendanube_oauth_states (
          state_hash, environment, created_at, expires_at, consumed_at
        ) VALUES (?, ?, ?, ?, NULL)
      `).bind(stateHash, environment, now, now + STATE_TTL_SECONDS).run();
// Entrega el valor ya comprobado al llamador y termina esta rama.
      return state;
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
    } catch (error) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
      if (!String(error && error.message || '').toLowerCase().includes('unique')) throw error;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
  throw new HttpError(500, 'oauth_state_collision', 'No se pudo iniciar OAuth.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Valida, consume de forma condicional y distingue estado inexistente, usado o vencido.
async function consumeOAuthState(db, state, environment, now, deps) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const stateHash = await sha256Hex(state, deps.cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const consumed = await db.prepare(`
    UPDATE tiendanube_oauth_states
    SET consumed_at = ?
    WHERE state_hash = ? AND environment = ?
      AND consumed_at IS NULL AND expires_at > ?
    RETURNING state_hash
  `).bind(now, stateHash, environment, now).first();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (consumed) return stateHash;

// Calcula y conserva un dato inmutable dentro de este alcance.
  const existing = await db.prepare(`
    SELECT expires_at, consumed_at
    FROM tiendanube_oauth_states
    WHERE state_hash = ? AND environment = ?
    LIMIT 1
  `).bind(stateHash, environment).first();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!existing) throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (existing.consumed_at !== null && existing.consumed_at !== undefined) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(409, 'oauth_state_reused', 'Autorizacion OAuth ya utilizada.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
  throw new HttpError(410, 'oauth_state_expired', 'Autorizacion OAuth vencida.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Vincula el estado consumido con la tienda confirmada para mantener trazabilidad sin conservar el código.
async function associateOAuthState(db, stateHash, environment, storeId) {
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
  await db.prepare(`
    UPDATE tiendanube_oauth_states
    SET store_id = ?
    WHERE state_hash = ? AND environment = ? AND consumed_at IS NOT NULL
  `).bind(storeId, stateHash, environment).run();
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Exige un parámetro de consulta no vacío y asigna un código de error específico al dato faltante.
function requiredQueryValue(url, name, code) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const value = String(url.searchParams.get(name) || '').trim();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/u.test(value)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, code, 'Callback OAuth invalido.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return value;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Canjea el código una sola vez, limita la respuesta y valida acceso, tienda y permisos recibidos.
async function exchangeAuthorizationCode(env, code, deps) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const clientSecret = String(env.TIENDANUBE_CLIENT_SECRET || '');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!clientSecret) throw new HttpError(503, 'oauth_client_secret_missing', 'OAuth no configurado.');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const controller = new AbortController();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const timeout = setTimeout(() => controller.abort(), 8000);
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let response;
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
    response = await (deps.fetchImpl || fetch)(TOKEN_URL, {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      method: 'POST',
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      body: JSON.stringify({
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
        client_id: configuredAppId(env),
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
        client_secret: clientSecret,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
        grant_type: 'authorization_code',
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        code
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
      }),
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      signal: controller.signal
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    });
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (_) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(502, 'oauth_exchange_failed', 'No se pudo completar OAuth.');
// Ejecuta la limpieza aun cuando la operación anterior haya fallado.
  } finally {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    clearTimeout(timeout);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!response.ok) throw new HttpError(502, 'oauth_exchange_failed', 'No se pudo completar OAuth.');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const declaredLength = Number(response.headers.get('Content-Length') || 0);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType) ||
// Continúa una expresión agrupada para hacer explícitas sus condiciones o argumentos.
    (Number.isFinite(declaredLength) && declaredLength > OAUTH_RESPONSE_MAX_BYTES)
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
  ) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(502, 'oauth_response_invalid', 'Respuesta OAuth invalida.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let payload;
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const raw = await readBoundedResponseText(response, OAUTH_RESPONSE_MAX_BYTES);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    payload = JSON.parse(raw);
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (_) { throw new HttpError(502, 'oauth_response_invalid', 'Respuesta OAuth invalida.'); }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const accessToken = String(payload && payload.access_token || '');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeId = String(payload && (payload.user_id ?? payload.store_id) || '').trim();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!accessToken || accessToken.length > 4096 || !/^\d+$/.test(storeId)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(502, 'oauth_response_invalid', 'Respuesta OAuth invalida.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const configuredId = optionalConfiguredStoreId(env);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (configuredId && storeId !== configuredId) throw new HttpError(403, 'store_mismatch', 'Tienda OAuth no autorizada.');
// Devuelve un objeto normalizado que forma parte del contrato interno del módulo.
  return { accessToken, storeId, scopes: validateGrantedScopes(payload.scope ?? payload.scopes) };
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Consulta la tienda autenticada y la compara con la lista exacta de dominios permitidos.
async function fetchAndValidateStore(env, token, deps) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const client = new TiendanubeClient({
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    storeId: token.storeId,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    accessToken: token.accessToken,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    apiBase: apiBaseFromEnv(env),
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    userAgent: userAgentFromEnv(env),
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    timeoutMs: env.TIENDANUBE_API_TIMEOUT_MS,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    maxRetries: env.TIENDANUBE_API_MAX_RETRIES,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    fetchImpl: deps.fetchImpl || fetch,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    sleepImpl: deps.sleepImpl
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  });
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let store;
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try { store = await client.getStore(); } catch (_) { throw new HttpError(502, 'oauth_store_validation_failed', 'No se pudo validar la tienda.'); }
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!store || String(store.id) !== token.storeId) throw new HttpError(502, 'oauth_store_invalid', 'Respuesta de tienda invalida.');

// Calcula y conserva un dato inmutable dentro de este alcance.
  const candidates = [store.original_domain, ...(Array.isArray(store.domains) ? store.domains : [])]
// Continúa una transformación encadenada sin alterar la colección original.
    .map(normalizeStoreDomain)
// Continúa una transformación encadenada sin alterar la colección original.
    .filter(Boolean);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const expected = expectedStoreDomains(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeDomain = candidates.find((domain) => expected.has(domain));
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!storeDomain) throw new HttpError(403, 'store_domain_not_allowed', 'Dominio de tienda no autorizado.');
// Devuelve un objeto normalizado que forma parte del contrato interno del módulo.
  return { store, storeDomain, storeName: localizedText(store.name) || storeDomain };
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Atiende el inicio: valida origen, limita frecuencia, crea estado y redirige al proveedor.
export async function handleOAuthStart({ request, env }, deps = {}) {
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const redirect = oauthRedirectConfig(env);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    assertConfiguredOAuthRequest(request, redirect, OAUTH_START_PATH);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const db = database(env);
    await ensureTiendanubeSchema(db);
// Consulta la instalación activa en una etapa identificable para distinguir un fallo de esquema D1 de otros errores OAuth.
    let activeInstallation = false;
    try {
      activeInstallation = await hasAnyActiveInstallation(env);
    } catch (error) {
      throw oauthStageError(error, 'oauth_installation_lookup_failed', 'No se pudo consultar la instalacion OAuth.');
    }
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (activeInstallation) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(409, 'oauth_installation_active', 'Ya existe una instalacion OAuth activa.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Calcula y conserva un dato inmutable dentro de este alcance.
    const appId = configuredAppId(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const now = nowSeconds(deps);
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
    try {
      await enforceRateLimit(db, request, 'tiendanube:oauth:start', {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
        limit: 10,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
        windowSeconds: 60,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        now,
// Incorpora propiedades ya validadas en el nuevo objeto sin modificar el original.
        ...(deps.rateLimit || {})
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
      });
    } catch (error) {
      throw oauthStageError(error, 'oauth_rate_limit_storage_failed', 'No se pudo registrar el limite de OAuth.');
    }
// Calcula y conserva un dato inmutable dentro de este alcance.
    let state;
    try {
      state = await insertOAuthState(db, redirect.environment, now, deps);
    } catch (error) {
      throw oauthStageError(error, 'oauth_state_storage_failed', 'No se pudo persistir el estado OAuth.');
    }
// Calcula y conserva un dato inmutable dentro de este alcance.
    const authorize = new URL(`${AUTHORIZE_URL}/${encodeURIComponent(appId)}/authorize`);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    authorize.searchParams.set('state', state);
// Construye una respuesta HTTP explícita con estado, cuerpo y encabezados controlados.
    return new Response(null, {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      status: 302,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      headers: {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
        Location: authorize.toString(),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        'Set-Cookie': stateCookie(state),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        'Cache-Control': 'no-store',
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        'Referrer-Policy': 'no-referrer'
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
      }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    });
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (error) {
// Entrega el valor ya comprobado al llamador y termina esta rama.
    return oauthFailure(error);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Atiende el retorno: coteja cookie y consulta, consume estado, instala la tienda y muestra el resultado.
export async function handleOAuthCallback({ request, env }, deps = {}) {
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const redirect = oauthRedirectConfig(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const url = assertConfiguredOAuthRequest(request, redirect, OAUTH_CALLBACK_PATH);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const db = database(env);
    await ensureTiendanubeSchema(db);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const now = nowSeconds(deps);
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
    await enforceRateLimit(db, request, 'tiendanube:oauth:callback', {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      limit: 30,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      windowSeconds: 60,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      now,
// Incorpora propiedades ya validadas en el nuevo objeto sin modificar el original.
      ...(deps.rateLimit || {})
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    });
// Calcula y conserva un dato inmutable dentro de este alcance.
    const code = requiredQueryValue(url, 'code', 'oauth_code_missing');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const state = requiredQueryValue(url, 'state', 'oauth_state_missing');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const cookieState = cookieValue(request, STATE_COOKIE);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!cookieState) throw new HttpError(400, 'oauth_cookie_missing', 'Cookie OAuth ausente.');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!/^[A-Za-z0-9_-]{43}$/.test(cookieState)) throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!timingSafeEqual(new TextEncoder().encode(state), new TextEncoder().encode(cookieState))) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }

// Calcula y conserva un dato inmutable dentro de este alcance.
    const stateHash = await consumeOAuthState(db, state, redirect.environment, now, deps);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const token = await exchangeAuthorizationCode(env, code, deps);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const validated = await fetchAndValidateStore(env, token, deps);
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
    await associateOAuthState(db, stateHash, redirect.environment, token.storeId);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const installation = await saveInstallation(env, {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      storeId: token.storeId,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      storeDomain: validated.storeDomain,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      accessToken: token.accessToken,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      scopes: token.scopes
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    }, { cryptoImpl: deps.cryptoImpl, now });
// Devuelve la respuesta final y cede el control al runtime de Pages.
    return oauthHtmlResponse(true, {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      storeName: validated.storeName,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      storeId: installation.storeId,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      storeDomain: installation.storeDomain,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      scopes: installation.scopes
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    }, 200, true);
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (error) {
// Entrega el valor ya comprobado al llamador y termina esta rama.
    return oauthFailure(error, true);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Atiende una consulta de estado y devuelve solo la proyección pública de la instalación.
export async function handleOAuthStatus({ request, env }, deps = {}) {
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let configuredId = null;
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let configurationError = null;
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try { configuredId = optionalConfiguredStoreId(env); } catch (error) { configurationError = error; }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const empty = {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    installed: false,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    storeId: configuredId,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    storeDomain: null,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    scopes: [],
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    installedAt: null,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    configurationReady: false
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  };
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const redirect = oauthRedirectConfig(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const url = assertConfiguredOAuthRequest(request, redirect, OAUTH_STATUS_PATH);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (url.search) return jsonResponse(empty, 400);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const db = database(env);
    await ensureTiendanubeSchema(db);
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
    await enforceRateLimit(db, request, 'tiendanube:oauth:status', {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      limit: 60,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      windowSeconds: 60,
// Incorpora propiedades ya validadas en el nuevo objeto sin modificar el original.
      ...(deps.rateLimit || {})
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    });
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (configurationError) throw configurationError;
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!configuredId) return jsonResponse(empty);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const row = await loadActiveInstallation(env, configuredId);
// Devuelve la respuesta final y cede el control al runtime de Pages.
    return jsonResponse(installationPublicStatus(row, configuredId));
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (error) {
// Devuelve la respuesta final y cede el control al runtime de Pages.
    return jsonResponse(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      empty,
// Limita el estado de error a un rango HTTP visible y usa un valor seguro para fallos internos.
      safeStatus(error),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      null,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      null,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      error instanceof HttpError ? error.headers : {}
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    );
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}
