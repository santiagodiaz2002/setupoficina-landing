import { HttpError } from './http.mjs';

export const PRODUCTION_SETUP_ORIGIN = 'https://setupoficina.com.ar';
export const OAUTH_CALLBACK_PATH = '/api/tiendanube/oauth/callback';
export const SETUPOFICINA_APP_ID = '38321';

const PREVIEW_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.setupoficina-landing\.pages\.dev$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function configuredTiendanubeEnvironment(env = {}) {
  const environment = String(env.TIENDANUBE_ENV || '').trim().toLowerCase();
  if (!['production', 'preview'].includes(environment)) {
    throw new HttpError(503, 'tiendanube_environment_invalid', 'Entorno Tiendanube no configurado.');
  }
  return environment;
}

export function oauthRedirectConfig(env = {}) {
  const raw = String(env.TIENDANUBE_OAUTH_REDIRECT_URL || '').trim();
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new HttpError(503, 'oauth_redirect_invalid', 'Callback OAuth no configurado.');
  }
  const isProduction = url.origin === PRODUCTION_SETUP_ORIGIN;
  const isPreview = PREVIEW_HOST_PATTERN.test(url.hostname);
  const configuredEnvironment = configuredTiendanubeEnvironment(env);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== OAUTH_CALLBACK_PATH ||
    url.search ||
    url.hash ||
    (!isProduction && !isPreview)
  ) {
    throw new HttpError(503, 'oauth_redirect_invalid', 'Callback OAuth fuera de los origenes permitidos.');
  }
  if (
    (configuredEnvironment === 'production' && !isProduction) ||
    (configuredEnvironment === 'preview' && !isPreview)
  ) {
    throw new HttpError(503, 'oauth_environment_mismatch', 'Callback OAuth no coincide con el entorno configurado.');
  }
  return {
    redirectUrl: url.toString(),
    origin: url.origin,
    environment: isProduction ? 'production' : `preview:${url.origin}`,
    isPreview
  };
}

export function assertConfiguredOAuthRequest(request, redirect, expectedPath) {
  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    throw new HttpError(403, 'oauth_origin_not_allowed', 'Origen OAuth no permitido.');
  }
  if (url.origin !== redirect.origin || url.pathname !== expectedPath) {
    throw new HttpError(403, 'oauth_origin_not_allowed', 'Origen OAuth no permitido.');
  }
  return url;
}

export function configuredAppId(env = {}) {
  const appId = String(env.TIENDANUBE_APP_ID || '').trim();
  if (appId !== SETUPOFICINA_APP_ID) {
    throw new HttpError(503, 'oauth_app_invalid', 'App ID OAuth no configurado.');
  }
  return appId;
}

export function expectedStoreDomains(env = {}) {
  const entries = String(env.TIENDANUBE_EXPECTED_STORE_DOMAINS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length || entries.some((entry) => !DOMAIN_PATTERN.test(entry))) {
    throw new HttpError(503, 'expected_store_domains_invalid', 'Dominios esperados no configurados.');
  }
  return new Set(entries);
}

export function normalizeStoreDomain(value) {
  const domain = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  return DOMAIN_PATTERN.test(domain) ? domain : '';
}

export function isPreviewOAuthEnvironment(env = {}) {
  try {
    return oauthRedirectConfig(env).isPreview;
  } catch (_) {
    return false;
  }
}
