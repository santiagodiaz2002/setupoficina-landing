// Error de dominio HTTP: transporta status, código estable, detalle opcional y headers de control.
// Centralizar esta forma evita que cada endpoint exponga accidentalmente excepciones internas.
export class HttpError extends Error {
  // status decide el código HTTP; code es legible por máquinas; message es seguro para el cliente.
  constructor(status, code, message, details = null, headers = {}) {
    // Error inicializa message y stack de la plataforma.
    super(message);
    // Un nombre propio facilita distinguir este error en logs y depuradores.
    this.name = 'HttpError';
    // Estas propiedades se leen luego en errorResponse para construir una respuesta uniforme.
    this.status = status;
// Completa la etapa actual de HTTP y CORS sin introducir un efecto adicional.
    this.code = code;
// Completa la etapa actual de HTTP y CORS sin introducir un efecto adicional.
    this.details = details;
// Completa la etapa actual de HTTP y CORS sin introducir un efecto adicional.
    this.headers = headers;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Convierte una variable CSV de orígenes en un Set normalizado y validado.
// Falla de forma cerrada: una lista ausente o mal formada deshabilita el flujo cross-origin.
export function parseOriginList(value) {
  // String tolera undefined; split separa entradas; trim y filter eliminan ruido y vacíos.
  const values = String(value || '')
// Continúa una transformación encadenada sin mutar la entrada original.
    .split(',')
// Continúa una transformación encadenada sin mutar la entrada original.
    .map((entry) => entry.trim())
// Continúa una transformación encadenada sin mutar la entrada original.
    .filter(Boolean);
  // Sin allowlist no existe una decisión segura sobre a quién reflejar en CORS.
  if (!values.length) throw new HttpError(503, 'origin_allowlist_missing', 'Lista de origenes no configurada.');
  // Set elimina duplicados y permite consultas O(1) por origen exacto.
  const origins = new Set();

  // Cada valor se interpreta con URL para evitar comparaciones parciales de hosts.
  for (const entry of values) {
// Aísla una conversión o API que puede rechazar datos externos.
    try {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const url = new URL(entry);
      // Sólo se admite un origen HTTPS puro: sin credenciales, puerto explícito, path, query ni hash.
      if (
// Define un campo del resultado o de la configuración con un valor ya controlado.
        url.protocol !== 'https:' || url.username || url.password || url.port ||
// Completa la etapa actual de HTTP y CORS sin introducir un efecto adicional.
        url.pathname !== '/' || url.search || url.hash
// Completa la etapa actual de HTTP y CORS sin introducir un efecto adicional.
      ) throw new Error('invalid_origin');
      // URL.origin entrega esquema, host y puerto ya canonicalizados por la plataforma.
      origins.add(url.origin);
// Captura el fallo y lo traduce a un error estable sin revelar el dato sensible.
    } catch (_) {
      // No se devuelve la entrada inválida para no reflejar configuración sensible en la respuesta.
      throw new HttpError(503, 'origin_allowlist_invalid', 'Lista de origenes invalida.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
    }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }

  // El llamador conserva el Set durante el request para validar y generar headers coherentes.
  return origins;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Lee la lista de orígenes autorizados para solicitudes originadas en la landing.
export function setupOrigins(env = {}) {
// Entrega el valor ya validado al llamador y termina esta rama.
  return parseOriginList(env.TIENDANUBE_ALLOWED_SETUP_ORIGINS);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Lee una lista independiente para el script que corre dentro del storefront.
export function storefrontOrigins(env = {}) {
// Entrega el valor ya validado al llamador y termina esta rama.
  return parseOriginList(env.TIENDANUBE_ALLOWED_STOREFRONT_ORIGINS);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Extrae Origin sin inferirlo desde Host o Referer, que tienen semánticas distintas.
export function requestOrigin(request) {
// Entrega el valor ya validado al llamador y termina esta rama.
  return String(request.headers.get('Origin') || '').trim();
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Autoriza por igualdad exacta; CORS por sí solo no sustituye esta validación en el servidor.
export function assertAllowedOrigin(request, allowedOrigins) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const origin = requestOrigin(request);
  // También se rechazan solicitudes sin Origin en estas rutas destinadas a navegador.
  if (!origin || !allowedOrigins.has(origin)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(403, 'origin_not_allowed', 'Origen no permitido.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
  // Devolver el valor evita releer el header si otra capa necesita auditarlo.
  return origin;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Construye headers CORS únicamente cuando el origen ya pertenece a la allowlist.
export function corsHeaders(request, allowedOrigins) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const origin = requestOrigin(request);
  // Una respuesta sin coincidencia omite CORS: el navegador no concede acceso al cuerpo.
  if (!origin || !allowedOrigins.has(origin)) return {};
// Devuelve un objeto normalizado que forma parte del contrato compartido.
  return {
    // Se refleja el origen exacto validado; nunca se usa comodín.
    'Access-Control-Allow-Origin': origin,
    // Estas APIs sólo aceptan mutaciones POST y su negociación OPTIONS.
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Content-Type habilita application/json sin abrir headers arbitrarios.
    'Access-Control-Allow-Headers': 'Content-Type',
    // Diez minutos reducen preflights sin hacer permanente un cambio de configuración.
    'Access-Control-Max-Age': '600',
    // Evita que una caché comparta una variante autorizada con otro Origin.
    Vary: 'Origin'
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  };
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Serializa un valor a JSON y aplica headers comunes de seguridad y caché.
export function jsonResponse(data, status = 200, request = null, allowedOrigins = null, extraHeaders = {}) {
// Construye la respuesta HTTP con estado, cuerpo y encabezados explícitos.
  return new Response(JSON.stringify(data), {
// Completa la etapa actual de HTTP y CORS sin introducir un efecto adicional.
    status,
// Define un campo del resultado o de la configuración con un valor ya controlado.
    headers: {
// Define un campo del resultado o de la configuración con un valor ya controlado.
      'Content-Type': 'application/json; charset=utf-8',
      // Tickets, estados y errores de configuración no deben quedar en caches intermedias.
      'Cache-Control': 'no-store',
      // CORS sólo se agrega cuando el endpoint entregó request y la lista ya validada.
      ...(request && allowedOrigins ? corsHeaders(request, allowedOrigins) : {}),
      // Retry-After u otros headers controlados pueden complementar la respuesta base.
      ...extraHeaders
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
    }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  });
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Traduce excepciones conocidas sin filtrar stack, objetos upstream ni secretos.
export function errorResponse(error, request = null, allowedOrigins = null) {
  // instanceof distingue fallas esperadas de bugs o errores de infraestructura.
  const known = error instanceof HttpError;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const status = known ? error.status : 500;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const body = {
// Define un campo del resultado o de la configuración con un valor ya controlado.
    ok: false,
// Define un campo del resultado o de la configuración con un valor ya controlado.
    error: known ? error.code : 'internal_error',
// Define un campo del resultado o de la configuración con un valor ya controlado.
    message: known ? error.message : 'Error interno.'
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  };
  // details sólo aparece cuando el productor lo marcó expresamente como seguro.
  if (known && error.details !== null) body.details = error.details;
  // Los headers del error permiten, por ejemplo, informar el tiempo de reintento.
  return jsonResponse(body, status, request, allowedOrigins, known ? error.headers : {});
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Responde la negociación CORS sin ejecutar ninguna mutación de negocio.
export function optionsResponse(request, allowedOrigins) {
  // Validar antes de responder impide confirmar capacidades a un origen ajeno.
  assertAllowedOrigin(request, allowedOrigins);
// Construye la respuesta HTTP con estado, cuerpo y encabezados explícitos.
  return new Response(null, {
    // 204 indica éxito sin cuerpo.
    status: 204,
// Define un campo del resultado o de la configuración con un valor ya controlado.
    headers: {
// Incorpora encabezados o propiedades previamente validados en una nueva estructura.
      ...corsHeaders(request, allowedOrigins),
// Define un campo del resultado o de la configuración con un valor ya controlado.
      'Cache-Control': 'no-store'
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
    }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  });
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Lee y parsea un cuerpo JSON pequeño con validación de tipo y tamaño declarado/real.
export async function readJsonBody(request, maxBytes = 32 * 1024) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contentType = String(request.headers.get('Content-Type') || '').toLowerCase();
  // La expresión admite parámetros como charset pero rechaza tipos ambiguos.
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(415, 'unsupported_media_type', 'Se requiere application/json.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }

  // El tamaño declarado permite cortar temprano cuando el navegador lo informa correctamente.
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
// Comprueba una precondición de HTTP y CORS y detiene el flujo cuando no se cumple.
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(413, 'payload_too_large', 'El cuerpo excede el limite permitido.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }

  // text() resuelve una promesa y consume el stream una sola vez; después no puede releerse.
  const raw = await request.text();
  // TextEncoder cuenta bytes UTF-8 reales, no sólo unidades UTF-16 de string.length.
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(413, 'payload_too_large', 'El cuerpo excede el limite permitido.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }

// Aísla una conversión o API que puede rechazar datos externos.
  try {
    // JSON.parse produce estructuras sin métodos, adecuadas para las validaciones posteriores.
    return JSON.parse(raw);
// Captura el fallo y lo traduce a un error estable sin revelar el dato sensible.
  } catch (_) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, 'invalid_json', 'JSON invalido.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Exige un objeto JSON no nulo y excluye arrays para evitar formas de payload ambiguas.
export function assertPlainObject(value, code = 'invalid_payload') {
// Comprueba una precondición de HTTP y CORS y detiene el flujo cuando no se cumple.
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, code, 'Payload invalido.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Entrega el valor ya validado al llamador y termina esta rama.
  return value;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Aplica una allowlist de propiedades y devuelve cuáles sobran sólo como detalle seguro.
export function assertOnlyKeys(value, allowedKeys, code = 'invalid_payload') {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const allowed = new Set(allowedKeys);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  // Rechazar campos desconocidos evita que el cliente crea que el servidor los aplicó.
  if (extras.length) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, code, 'El payload contiene campos no permitidos.', { fields: extras });
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}
