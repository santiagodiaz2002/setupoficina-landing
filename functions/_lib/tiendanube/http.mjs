export class HttpError extends Error {
  constructor(status, code, message, details = null, headers = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

export function parseOriginList(value) {
  const values = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!values.length) throw new HttpError(503, 'origin_allowlist_missing', 'Lista de origenes no configurada.');
  const origins = new Set();

  for (const entry of values) {
    try {
      const url = new URL(entry);
      if (
        url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.pathname !== '/' || url.search || url.hash
      ) throw new Error('invalid_origin');
      origins.add(url.origin);
    } catch (_) {
      throw new HttpError(503, 'origin_allowlist_invalid', 'Lista de origenes invalida.');
    }
  }

  return origins;
}

export function setupOrigins(env = {}) {
  return parseOriginList(env.TIENDANUBE_ALLOWED_SETUP_ORIGINS);
}

export function storefrontOrigins(env = {}) {
  return parseOriginList(env.TIENDANUBE_ALLOWED_STOREFRONT_ORIGINS);
}

export function requestOrigin(request) {
  return String(request.headers.get('Origin') || '').trim();
}

export function assertAllowedOrigin(request, allowedOrigins) {
  const origin = requestOrigin(request);
  if (!origin || !allowedOrigins.has(origin)) {
    throw new HttpError(403, 'origin_not_allowed', 'Origen no permitido.');
  }
  return origin;
}

export function corsHeaders(request, allowedOrigins) {
  const origin = requestOrigin(request);
  if (!origin || !allowedOrigins.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

export function jsonResponse(data, status = 200, request = null, allowedOrigins = null, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(request && allowedOrigins ? corsHeaders(request, allowedOrigins) : {}),
      ...extraHeaders
    }
  });
}

export function errorResponse(error, request = null, allowedOrigins = null) {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  const body = {
    ok: false,
    error: known ? error.code : 'internal_error',
    message: known ? error.message : 'Error interno.'
  };
  if (known && error.details !== null) body.details = error.details;
  return jsonResponse(body, status, request, allowedOrigins, known ? error.headers : {});
}

export function optionsResponse(request, allowedOrigins) {
  assertAllowedOrigin(request, allowedOrigins);
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, allowedOrigins),
      'Cache-Control': 'no-store'
    }
  });
}

export async function readJsonBody(request, maxBytes = 32 * 1024) {
  const contentType = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new HttpError(415, 'unsupported_media_type', 'Se requiere application/json.');
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, 'payload_too_large', 'El cuerpo excede el limite permitido.');
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, 'payload_too_large', 'El cuerpo excede el limite permitido.');
  }

  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new HttpError(400, 'invalid_json', 'JSON invalido.');
  }
}

export function assertPlainObject(value, code = 'invalid_payload') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, code, 'Payload invalido.');
  }
  return value;
}

export function assertOnlyKeys(value, allowedKeys, code = 'invalid_payload') {
  const allowed = new Set(allowedKeys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length) {
    throw new HttpError(400, code, 'El payload contiene campos no permitidos.', { fields: extras });
  }
}
