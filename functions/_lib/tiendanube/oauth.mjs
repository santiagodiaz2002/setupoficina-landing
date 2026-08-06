import {
  TiendanubeClient,
  apiBaseFromEnv,
  localizedText,
  readBoundedResponseText,
  userAgentFromEnv
} from './client.mjs';
import { HttpError, jsonResponse } from './http.mjs';
import {
  hasAnyActiveInstallation,
  installationPublicStatus,
  loadActiveInstallation,
  optionalConfiguredStoreId,
  saveInstallation
} from './installations.mjs';
import {
  assertConfiguredOAuthRequest,
  configuredAppId,
  expectedStoreDomains,
  normalizeStoreDomain,
  OAUTH_CALLBACK_PATH,
  oauthRedirectConfig
} from './oauth-config.mjs';
import { enforceRateLimit } from './rate-limit.mjs';
import { validateGrantedScopes } from './scopes.mjs';
import { randomTicket, sha256Hex, timingSafeEqual } from './security.mjs';

const AUTHORIZE_URL = 'https://www.tiendanube.com/apps';
const TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';
const STATE_COOKIE = 'setupoficina_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const OAUTH_START_PATH = '/api/tiendanube/oauth/start';
const OAUTH_STATUS_PATH = '/api/tiendanube/oauth/status';
const OAUTH_RESPONSE_MAX_BYTES = 64 * 1024;

function database(env) {
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
  return env.LEADS_DB;
}

function nowSeconds(deps) {
  return Number(deps.now ?? Math.floor(Date.now() / 1000));
}

function stateCookie(value, maxAge = STATE_TTL_SECONDS) {
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; Path=${OAUTH_CALLBACK_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function cookieValue(request, name) {
  const cookies = String(request.headers.get('Cookie') || '').split(';');
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(cookie.slice(separator + 1).trim()); } catch (_) { return ''; }
  }
  return '';
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function oauthHtmlResponse(success, details = {}, status = 200, clearCookie = false, extraHeaders = {}) {
  const outcome = success ? 'Instalacion exitosa' : 'Instalacion fallida';
  const storeName = details.storeName || 'No disponible';
  const storeId = details.storeId || 'No disponible';
  const storeDomain = details.storeDomain || 'No disponible';
  const scopes = Array.isArray(details.scopes) && details.scopes.length ? details.scopes.join(', ') : 'Ninguno';
  const body = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${outcome}</title></head><body><main><h1>${outcome}</h1><dl><dt>Nombre de la tienda</dt><dd>${htmlEscape(storeName)}</dd><dt>Store ID</dt><dd>${htmlEscape(storeId)}</dd><dt>Dominio</dt><dd>${htmlEscape(storeDomain)}</dd><dt>Scopes concedidos</dt><dd>${htmlEscape(scopes)}</dd></dl></main></body></html>`;
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
      ...(clearCookie ? { 'Set-Cookie': stateCookie('', 0) } : {})
    }
  });
}

function safeStatus(error) {
  return error instanceof HttpError ? error.status : 500;
}

function oauthFailure(error, clearCookie = false) {
  const headers = error instanceof HttpError ? error.headers : {};
  return oauthHtmlResponse(false, {}, safeStatus(error), clearCookie, headers);
}

async function insertOAuthState(db, environment, now, deps) {
  await db.prepare('DELETE FROM tiendanube_oauth_states WHERE expires_at <= ?').bind(now).run();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = deps.randomState ? String(deps.randomState()) : randomTicket(deps.cryptoImpl).token;
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new HttpError(500, 'oauth_state_generation_failed', 'No se pudo iniciar OAuth.');
    const stateHash = await sha256Hex(state, deps.cryptoImpl);
    try {
      await db.prepare(`
        INSERT INTO tiendanube_oauth_states (
          state_hash, environment, created_at, expires_at, consumed_at
        ) VALUES (?, ?, ?, ?, NULL)
      `).bind(stateHash, environment, now, now + STATE_TTL_SECONDS).run();
      return state;
    } catch (error) {
      if (!String(error && error.message || '').toLowerCase().includes('unique')) throw error;
    }
  }
  throw new HttpError(500, 'oauth_state_collision', 'No se pudo iniciar OAuth.');
}

async function consumeOAuthState(db, state, environment, now, deps) {
  const stateHash = await sha256Hex(state, deps.cryptoImpl);
  const consumed = await db.prepare(`
    UPDATE tiendanube_oauth_states
    SET consumed_at = ?
    WHERE state_hash = ? AND environment = ?
      AND consumed_at IS NULL AND expires_at > ?
    RETURNING state_hash
  `).bind(now, stateHash, environment, now).first();
  if (consumed) return stateHash;

  const existing = await db.prepare(`
    SELECT expires_at, consumed_at
    FROM tiendanube_oauth_states
    WHERE state_hash = ? AND environment = ?
    LIMIT 1
  `).bind(stateHash, environment).first();
  if (!existing) throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
  if (existing.consumed_at !== null && existing.consumed_at !== undefined) {
    throw new HttpError(409, 'oauth_state_reused', 'Autorizacion OAuth ya utilizada.');
  }
  throw new HttpError(410, 'oauth_state_expired', 'Autorizacion OAuth vencida.');
}

async function associateOAuthState(db, stateHash, environment, storeId) {
  await db.prepare(`
    UPDATE tiendanube_oauth_states
    SET store_id = ?
    WHERE state_hash = ? AND environment = ? AND consumed_at IS NOT NULL
  `).bind(storeId, stateHash, environment).run();
}

function requiredQueryValue(url, name, code) {
  const value = String(url.searchParams.get(name) || '').trim();
  if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new HttpError(400, code, 'Callback OAuth invalido.');
  }
  return value;
}

async function exchangeAuthorizationCode(env, code, deps) {
  const clientSecret = String(env.TIENDANUBE_CLIENT_SECRET || '');
  if (!clientSecret) throw new HttpError(503, 'oauth_client_secret_missing', 'OAuth no configurado.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await (deps.fetchImpl || fetch)(TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: configuredAppId(env),
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code
      }),
      signal: controller.signal
    });
  } catch (_) {
    throw new HttpError(502, 'oauth_exchange_failed', 'No se pudo completar OAuth.');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new HttpError(502, 'oauth_exchange_failed', 'No se pudo completar OAuth.');
  const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
  const declaredLength = Number(response.headers.get('Content-Length') || 0);
  if (
    !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType) ||
    (Number.isFinite(declaredLength) && declaredLength > OAUTH_RESPONSE_MAX_BYTES)
  ) {
    throw new HttpError(502, 'oauth_response_invalid', 'Respuesta OAuth invalida.');
  }
  let payload;
  try {
    const raw = await readBoundedResponseText(response, OAUTH_RESPONSE_MAX_BYTES);
    payload = JSON.parse(raw);
  } catch (_) { throw new HttpError(502, 'oauth_response_invalid', 'Respuesta OAuth invalida.'); }
  const accessToken = String(payload && payload.access_token || '');
  const storeId = String(payload && (payload.user_id ?? payload.store_id) || '').trim();
  if (!accessToken || accessToken.length > 4096 || !/^\d+$/.test(storeId)) {
    throw new HttpError(502, 'oauth_response_invalid', 'Respuesta OAuth invalida.');
  }
  const configuredId = optionalConfiguredStoreId(env);
  if (configuredId && storeId !== configuredId) throw new HttpError(403, 'store_mismatch', 'Tienda OAuth no autorizada.');
  return { accessToken, storeId, scopes: validateGrantedScopes(payload.scope ?? payload.scopes) };
}

async function fetchAndValidateStore(env, token, deps) {
  const client = new TiendanubeClient({
    storeId: token.storeId,
    accessToken: token.accessToken,
    apiBase: apiBaseFromEnv(env),
    userAgent: userAgentFromEnv(env),
    timeoutMs: env.TIENDANUBE_API_TIMEOUT_MS,
    maxRetries: env.TIENDANUBE_API_MAX_RETRIES,
    fetchImpl: deps.fetchImpl || fetch,
    sleepImpl: deps.sleepImpl
  });
  let store;
  try { store = await client.getStore(); } catch (_) { throw new HttpError(502, 'oauth_store_validation_failed', 'No se pudo validar la tienda.'); }
  if (!store || String(store.id) !== token.storeId) throw new HttpError(502, 'oauth_store_invalid', 'Respuesta de tienda invalida.');

  const candidates = [store.original_domain, ...(Array.isArray(store.domains) ? store.domains : [])]
    .map(normalizeStoreDomain)
    .filter(Boolean);
  const expected = expectedStoreDomains(env);
  const storeDomain = candidates.find((domain) => expected.has(domain));
  if (!storeDomain) throw new HttpError(403, 'store_domain_not_allowed', 'Dominio de tienda no autorizado.');
  return { store, storeDomain, storeName: localizedText(store.name) || storeDomain };
}

export async function handleOAuthStart({ request, env }, deps = {}) {
  try {
    const redirect = oauthRedirectConfig(env);
    assertConfiguredOAuthRequest(request, redirect, OAUTH_START_PATH);
    const db = database(env);
    if (await hasAnyActiveInstallation(env)) {
      throw new HttpError(409, 'oauth_installation_active', 'Ya existe una instalacion OAuth activa.');
    }
    const appId = configuredAppId(env);
    const now = nowSeconds(deps);
    await enforceRateLimit(db, request, 'tiendanube:oauth:start', {
      limit: 10,
      windowSeconds: 60,
      now,
      ...(deps.rateLimit || {})
    });
    const state = await insertOAuthState(db, redirect.environment, now, deps);
    const authorize = new URL(`${AUTHORIZE_URL}/${encodeURIComponent(appId)}/authorize`);
    authorize.searchParams.set('state', state);
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorize.toString(),
        'Set-Cookie': stateCookie(state),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer'
      }
    });
  } catch (error) {
    return oauthFailure(error);
  }
}

export async function handleOAuthCallback({ request, env }, deps = {}) {
  try {
    const redirect = oauthRedirectConfig(env);
    const url = assertConfiguredOAuthRequest(request, redirect, OAUTH_CALLBACK_PATH);
    const db = database(env);
    const now = nowSeconds(deps);
    await enforceRateLimit(db, request, 'tiendanube:oauth:callback', {
      limit: 30,
      windowSeconds: 60,
      now,
      ...(deps.rateLimit || {})
    });
    const code = requiredQueryValue(url, 'code', 'oauth_code_missing');
    const state = requiredQueryValue(url, 'state', 'oauth_state_missing');
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
    const cookieState = cookieValue(request, STATE_COOKIE);
    if (!cookieState) throw new HttpError(400, 'oauth_cookie_missing', 'Cookie OAuth ausente.');
    if (!/^[A-Za-z0-9_-]{43}$/.test(cookieState)) throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
    if (!timingSafeEqual(new TextEncoder().encode(state), new TextEncoder().encode(cookieState))) {
      throw new HttpError(400, 'oauth_state_invalid', 'Autorizacion OAuth invalida.');
    }

    const stateHash = await consumeOAuthState(db, state, redirect.environment, now, deps);
    const token = await exchangeAuthorizationCode(env, code, deps);
    const validated = await fetchAndValidateStore(env, token, deps);
    await associateOAuthState(db, stateHash, redirect.environment, token.storeId);
    const installation = await saveInstallation(env, {
      storeId: token.storeId,
      storeDomain: validated.storeDomain,
      accessToken: token.accessToken,
      scopes: token.scopes
    }, { cryptoImpl: deps.cryptoImpl, now });
    return oauthHtmlResponse(true, {
      storeName: validated.storeName,
      storeId: installation.storeId,
      storeDomain: installation.storeDomain,
      scopes: installation.scopes
    }, 200, true);
  } catch (error) {
    return oauthFailure(error, true);
  }
}

export async function handleOAuthStatus({ request, env }, deps = {}) {
  let configuredId = null;
  let configurationError = null;
  try { configuredId = optionalConfiguredStoreId(env); } catch (error) { configurationError = error; }
  const empty = {
    installed: false,
    storeId: configuredId,
    storeDomain: null,
    scopes: [],
    installedAt: null,
    configurationReady: false
  };
  try {
    const redirect = oauthRedirectConfig(env);
    const url = assertConfiguredOAuthRequest(request, redirect, OAUTH_STATUS_PATH);
    if (url.search) return jsonResponse(empty, 400);
    const db = database(env);
    await enforceRateLimit(db, request, 'tiendanube:oauth:status', {
      limit: 60,
      windowSeconds: 60,
      ...(deps.rateLimit || {})
    });
    if (configurationError) throw configurationError;
    if (!configuredId) return jsonResponse(empty);
    const row = await loadActiveInstallation(env, configuredId);
    return jsonResponse(installationPublicStatus(row, configuredId));
  } catch (error) {
    return jsonResponse(
      empty,
      safeStatus(error),
      null,
      null,
      error instanceof HttpError ? error.headers : {}
    );
  }
}
