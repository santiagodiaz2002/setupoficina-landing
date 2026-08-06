import { accessTokenForEnvironment } from './installations.mjs';

export const TIENDANUBE_API_VERSION = '2025-03';
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export class TiendanubeApiError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message);
    this.name = 'TiendanubeApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response, attempt) {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return Math.min(1000, 150 * (2 ** attempt));
}

function contentLength(response) {
  const declared = Number(response.headers.get('Content-Length') || 0);
  return Number.isFinite(declared) && declared > 0 ? declared : 0;
}

export async function readBoundedResponseText(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error('response_too_large');
    return raw;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error('response_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function boundedJson(response, maxBytes) {
  const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new TiendanubeApiError(response.status, 'invalid_content_type', 'Tiendanube devolvio un tipo de contenido invalido.', false);
  }
  if (contentLength(response) > maxBytes) {
    throw new TiendanubeApiError(response.status, 'response_too_large', 'Tiendanube devolvio una respuesta demasiado grande.', false);
  }
  let raw;
  try {
    raw = await readBoundedResponseText(response, maxBytes);
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw new TiendanubeApiError(response.status, 'response_too_large', 'Tiendanube devolvio una respuesta demasiado grande.', false);
  }
  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new TiendanubeApiError(response.status, 'invalid_json', 'Tiendanube devolvio JSON invalido.', false);
  }
}

function classifyError(status) {
  if (status === 401) return ['unauthorized', 'Tiendanube rechazo el token.', false];
  if (status === 403) return ['forbidden', 'Tiendanube rechazo los permisos.', false];
  if (status === 404) return ['not_found', 'El recurso no existe en Tiendanube.', false];
  if (status === 409) return ['conflict', 'Tiendanube informo un conflicto.', false];
  if (status === 422) return ['unprocessable_entity', 'Tiendanube rechazo la solicitud.', false];
  if (status === 429) return ['rate_limited', 'Tiendanube aplico rate limiting.', true];
  if (status >= 500) return ['upstream_error', 'Tiendanube no esta disponible.', true];
  return ['http_error', `Tiendanube respondio HTTP ${status}.`, false];
}

export class TiendanubeClient {
  constructor(options) {
    this.storeId = String(options.storeId || '');
    this.accessToken = String(options.accessToken || '');
    this.userAgent = String(options.userAgent || '');
    if (!/^\d+$/.test(this.storeId) || !this.accessToken || !this.userAgent.trim()) {
      throw new TiendanubeApiError(0, 'client_configuration_invalid', 'Cliente Tiendanube no configurado.', false);
    }
    this.apiBase = String(options.apiBase || `https://api.tiendanube.com/${TIENDANUBE_API_VERSION}`).replace(/\/+$/, '');
    this.timeoutMs = positiveInteger(options.timeoutMs, 5000);
    this.maxRetries = Math.min(3, nonNegativeInteger(options.maxRetries, 2));
    this.maxResponseBytes = positiveInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES);
    this.fetchImpl = options.fetchImpl || fetch;
    this.sleepImpl = options.sleepImpl || sleep;
  }

  async request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const safeRead = method === 'GET' || method === 'HEAD';
    const maxAttempts = safeRead ? this.maxRetries + 1 : 1;
    const url = `${this.apiBase}/${encodeURIComponent(this.storeId)}${path}`;
    const extraHeaders = { ...(options.headers || {}) };
    delete extraHeaders.Authorization;
    delete extraHeaders.authorization;
    delete extraHeaders['User-Agent'];
    delete extraHeaders['user-agent'];

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'User-Agent': this.userAgent,
            ...extraHeaders
          },
          body: options.body,
          signal: controller.signal
        });

        if (response.ok) {
          if (response.status === 204) return null;
          return await boundedJson(response, positiveInteger(options.maxResponseBytes, this.maxResponseBytes));
        }

        const [code, message, retryable] = classifyError(response.status);
        if (safeRead && retryable && attempt + 1 < maxAttempts) {
          clearTimeout(timer);
          await this.sleepImpl(retryDelay(response, attempt));
          continue;
        }
        throw new TiendanubeApiError(response.status, code, message, retryable);
      } catch (error) {
        if (error instanceof TiendanubeApiError) throw error;
        const timedOut = error && error.name === 'AbortError';
        if (safeRead && attempt + 1 < maxAttempts) {
          clearTimeout(timer);
          await this.sleepImpl(Math.min(1000, 150 * (2 ** attempt)));
          continue;
        }
        throw new TiendanubeApiError(0, timedOut ? 'timeout' : 'network_error', timedOut ? 'Timeout de Tiendanube.' : 'Error de red con Tiendanube.', true);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new TiendanubeApiError(0, 'unexpected_error', 'Fallo inesperado de Tiendanube.', false);
  }

  getProduct(productId) {
    return this.request(`/products/${encodeURIComponent(String(productId))}`);
  }

  getStore() {
    return this.request('/store');
  }
}

export function apiBaseFromEnv(env = {}) {
  const version = String(env.TIENDANUBE_API_VERSION || '').trim();
  if (version !== TIENDANUBE_API_VERSION) {
    throw new TiendanubeApiError(0, 'api_version_invalid', 'Version de API Tiendanube no configurada.', false);
  }
  return `https://api.tiendanube.com/${TIENDANUBE_API_VERSION}`;
}

export function userAgentFromEnv(env = {}) {
  const userAgent = String(env.TIENDANUBE_USER_AGENT || '').trim();
  if (!userAgent || userAgent.length > 255 || /[\u0000-\u001f\u007f]/u.test(userAgent)) {
    throw new TiendanubeApiError(0, 'user_agent_invalid', 'User-Agent Tiendanube no configurado.', false);
  }
  return userAgent;
}

export async function clientFromEnv(env, overrides = {}) {
  const credentials = await accessTokenForEnvironment(env, { cryptoImpl: overrides.cryptoImpl });
  const {
    cryptoImpl: _cryptoImpl,
    storeId: _ignoredStoreId,
    accessToken: _ignoredAccessToken,
    ...clientOverrides
  } = overrides;
  return new TiendanubeClient({
    ...clientOverrides,
    storeId: credentials.storeId,
    accessToken: credentials.accessToken,
    apiBase: apiBaseFromEnv(env),
    userAgent: userAgentFromEnv(env),
    timeoutMs: env.TIENDANUBE_API_TIMEOUT_MS,
    maxRetries: env.TIENDANUBE_API_MAX_RETRIES
  });
}

export function localizedText(value, preferred = 'es') {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  if (typeof value[preferred] === 'string' && value[preferred].trim()) return value[preferred].trim();
  const first = Object.values(value).find((entry) => typeof entry === 'string' && entry.trim());
  return first ? first.trim() : '';
}

export function availableStock(variant) {
  if (variant && variant.stock_management === false) return Number.POSITIVE_INFINITY;
  const levels = variant && Array.isArray(variant.inventory_levels) ? variant.inventory_levels : [];
  if (levels.length) {
    if (levels.some((level) => level && (level.stock === '' || level.stock === null))) {
      return Number.POSITIVE_INFINITY;
    }
    return levels.reduce((total, level) => {
      const stock = Number(level && level.stock);
      return total + (Number.isFinite(stock) && stock > 0 ? stock : 0);
    }, 0);
  }
  if (variant && (variant.stock === '' || variant.stock === null) && variant.stock_management !== true) {
    return Number.POSITIVE_INFINITY;
  }
  const stock = Number(variant && variant.stock);
  return Number.isFinite(stock) && stock > 0 ? stock : 0;
}

export function currentPrice(variant) {
  const promotional = variant && variant.promotional_price;
  const value = promotional !== null && promotional !== undefined && String(promotional).trim() !== ''
    ? promotional
    : variant && variant.price;
  const text = String(value ?? '').trim();
  return /^\d+(?:\.\d+)?$/.test(text) ? text : '';
}

export function variantLabel(variant) {
  const values = variant && Array.isArray(variant.values) ? variant.values : [];
  return values.map((entry) => localizedText(entry)).filter(Boolean).join(' / ');
}
