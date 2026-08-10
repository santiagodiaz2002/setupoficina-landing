// Este módulo encapsula las solicitudes salientes a la API de Tiendanube con tiempo máximo, reintentos acotados y lectura limitada.
// Lo usan el flujo OAuth para verificar la tienda y el puente de carrito para resolver catálogo; sin él cada consumidor duplicaría autenticación y manejo de fallos.
// Las credenciales se toman de la instalación cifrada o de la excepción controlada de vista previa, nunca de la entrada del navegador.
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { accessTokenForEnvironment } from './installations.mjs';

// Publica una constante canónica que otros módulos deben reutilizar.
export const TIENDANUBE_API_VERSION = '2025-03';
// Calcula y conserva un dato inmutable dentro de este alcance.
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

// Define el error tipado que conserva estado, código seguro y posibilidad de reintento sin exponer el token.
export class TiendanubeApiError extends Error {
// Valida las opciones obligatorias e instala dependencias inyectables para producción o pruebas.
  constructor(status, code, message, retryable = false) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    super(message);
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.name = 'TiendanubeApiError';
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.status = status;
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.code = code;
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.retryable = retryable;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Convierte una opción en entero positivo y usa un valor de respaldo cuando la entrada no sirve.
function positiveInteger(value, fallback) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const parsed = Number.parseInt(String(value || ''), 10);
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Normaliza contadores que admiten cero para que los límites no reciban fracciones ni valores negativos.
function nonNegativeInteger(value, fallback) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const parsed = Number.parseInt(String(value ?? ''), 10);
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Representa la pausa asincrónica inyectable entre reintentos y devuelve una promesa.
function sleep(ms) {
// Devuelve la respuesta final y cede el control al runtime de Pages.
  return new Promise((resolve) => setTimeout(resolve, ms));
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Calcula la espera de reintento respetando la cabecera del servidor y aplicando un crecimiento acotado.
function retryDelay(response, attempt) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const retryAfter = response.headers.get('Retry-After');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (retryAfter) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const seconds = Number(retryAfter);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const dateDelay = Date.parse(retryAfter) - Date.now();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return Math.min(1000, 150 * (2 ** attempt));
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Interpreta el tamaño declarado de la respuesta y distingue encabezados ausentes o inválidos.
function contentLength(response) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const declared = Number(response.headers.get('Content-Length') || 0);
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return Number.isFinite(declared) && declared > 0 ? declared : 0;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Lee el cuerpo por flujo, suma bytes y cancela la lectura cuando excede el máximo permitido.
export async function readBoundedResponseText(response, maxBytes) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!response.body || typeof response.body.getReader !== 'function') {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const raw = await response.text();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error('response_too_large');
// Entrega el valor ya comprobado al llamador y termina esta rama.
    return raw;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const reader = response.body.getReader();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const chunks = [];
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let total = 0;
// Recorre una colección acotada para validar o transformar cada elemento.
  while (true) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const { done, value } = await reader.read();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (done) break;
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    total += value.byteLength;
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (total > maxBytes) {
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
      await reader.cancel().catch(() => {});
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new Error('response_too_large');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    chunks.push(value);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const bytes = new Uint8Array(total);
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let offset = 0;
// Recorre una colección acotada para validar o transformar cada elemento.
  for (const chunk of chunks) {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    bytes.set(chunk, offset);
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    offset += chunk.byteLength;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Devuelve la respuesta final y cede el control al runtime de Pages.
  return new TextDecoder().decode(bytes);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Verifica tipo, tamaño y sintaxis antes de convertir una respuesta externa en datos de aplicación.
async function boundedJson(response, maxBytes) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new TiendanubeApiError(response.status, 'invalid_content_type', 'Tiendanube devolvio un tipo de contenido invalido.', false);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Interpreta el tamaño declarado de la respuesta y distingue encabezados ausentes o inválidos.
  if (contentLength(response) > maxBytes) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new TiendanubeApiError(response.status, 'response_too_large', 'Tiendanube devolvio una respuesta demasiado grande.', false);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let raw;
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
    raw = await readBoundedResponseText(response, maxBytes);
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (error) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (error && error.name === 'AbortError') throw error;
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new TiendanubeApiError(response.status, 'response_too_large', 'Tiendanube devolvio una respuesta demasiado grande.', false);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Entrega el valor ya comprobado al llamador y termina esta rama.
    return JSON.parse(raw);
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (_) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new TiendanubeApiError(response.status, 'invalid_json', 'Tiendanube devolvio JSON invalido.', false);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Traduce estados remotos a códigos internos estables e indica cuáles permiten un nuevo intento.
function classifyError(status) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (status === 401) return ['unauthorized', 'Tiendanube rechazo el token.', false];
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (status === 403) return ['forbidden', 'Tiendanube rechazo los permisos.', false];
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (status === 404) return ['not_found', 'El recurso no existe en Tiendanube.', false];
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (status === 409) return ['conflict', 'Tiendanube informo un conflicto.', false];
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (status === 422) return ['unprocessable_entity', 'Tiendanube rechazo la solicitud.', false];
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (status === 429) return ['rate_limited', 'Tiendanube aplico rate limiting.', true];
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (status >= 500) return ['upstream_error', 'Tiendanube no esta disponible.', true];
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return ['http_error', `Tiendanube respondio HTTP ${status}.`, false];
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Agrupa configuración, autenticación y transporte para que todas las llamadas compartan las mismas defensas.
export class TiendanubeClient {
// Valida las opciones obligatorias e instala dependencias inyectables para producción o pruebas.
  constructor(options) {
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.storeId = String(options.storeId || '');
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.accessToken = String(options.accessToken || '');
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.userAgent = String(options.userAgent || '');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!/^\d+$/.test(this.storeId) || !this.accessToken || !this.userAgent.trim()) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw new TiendanubeApiError(0, 'client_configuration_invalid', 'Cliente Tiendanube no configurado.', false);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Guarda o utiliza estado propio de la instancia después de validarlo.
    this.apiBase = String(options.apiBase || `https://api.tiendanube.com/${TIENDANUBE_API_VERSION}`).replace(/\/+$/, '');
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    this.timeoutMs = positiveInteger(options.timeoutMs, 5000);
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    this.maxRetries = Math.min(3, nonNegativeInteger(options.maxRetries, 2));
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    this.maxResponseBytes = positiveInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES);
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    this.fetchImpl = options.fetchImpl || fetch;
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    this.sleepImpl = options.sleepImpl || sleep;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }

// Ejecuta la operación HTTP común con autenticación, cancelación, reintentos seguros y respuesta acotada.
  async request(path, options = {}) {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
    const method = String(options.method || 'GET').toUpperCase();
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
    const safeRead = method === 'GET' || method === 'HEAD';
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
    const maxAttempts = safeRead ? this.maxRetries + 1 : 1;
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
    const url = `${this.apiBase}/${encodeURIComponent(this.storeId)}${path}`;
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
    const extraHeaders = { ...(options.headers || {}) };
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    delete extraHeaders.Authorization;
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    delete extraHeaders.authorization;
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    delete extraHeaders['User-Agent'];
// Ajusta la configuración efectiva y evita que opciones externas reemplacen encabezados protegidos.
    delete extraHeaders['user-agent'];

// Repite como máximo la cantidad de intentos calculada, nunca un ciclo sin límite.
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
      const controller = new AbortController();
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
// Aísla la solicitud y el análisis de respuesta para traducir cualquier fallo.
      try {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
        const response = await this.fetchImpl(url, {
// Completa la construcción, validación o traducción correspondiente a esta línea.
          method,
// Define un campo del pedido o de la configuración enviada al transporte.
          headers: {
// Define un campo del pedido o de la configuración enviada al transporte.
            Accept: 'application/json',
// Define un campo del pedido o de la configuración enviada al transporte.
            Authorization: `Bearer ${this.accessToken}`,
// Define un campo del pedido o de la configuración enviada al transporte.
            'User-Agent': this.userAgent,
// Incorpora únicamente las opciones restantes después de retirar las sobrescrituras sensibles.
            ...extraHeaders
// Cierra el bloque o la estructura y acota el alcance de sus datos.
          },
// Define un campo del pedido o de la configuración enviada al transporte.
          body: options.body,
// Define un campo del pedido o de la configuración enviada al transporte.
          signal: controller.signal
// Cierra el bloque o la estructura y acota el alcance de sus datos.
        });

// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
        if (response.ok) {
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
          if (response.status === 204) return null;
// Espera la promesa antes de decidir el siguiente estado del flujo.
          return await boundedJson(response, positiveInteger(options.maxResponseBytes, this.maxResponseBytes));
// Cierra el bloque o la estructura y acota el alcance de sus datos.
        }

// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
        const [code, message, retryable] = classifyError(response.status);
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
        if (safeRead && retryable && attempt + 1 < maxAttempts) {
// Completa la construcción, validación o traducción correspondiente a esta línea.
          clearTimeout(timer);
// Espera la promesa antes de decidir el siguiente estado del flujo.
          await this.sleepImpl(retryDelay(response, attempt));
// Inicia el siguiente intento después de cumplir la espera calculada.
          continue;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
        }
// Propaga un error tipado y seguro en lugar del detalle bruto de la red.
        throw new TiendanubeApiError(response.status, code, message, retryable);
// Distingue errores ya clasificados de fallos de red o cancelación.
      } catch (error) {
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
        if (error instanceof TiendanubeApiError) throw error;
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
        const timedOut = error && error.name === 'AbortError';
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
        if (safeRead && attempt + 1 < maxAttempts) {
// Completa la construcción, validación o traducción correspondiente a esta línea.
          clearTimeout(timer);
// Espera la promesa antes de decidir el siguiente estado del flujo.
          await this.sleepImpl(Math.min(1000, 150 * (2 ** attempt)));
// Inicia el siguiente intento después de cumplir la espera calculada.
          continue;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
        }
// Propaga un error tipado y seguro en lugar del detalle bruto de la red.
        throw new TiendanubeApiError(0, timedOut ? 'timeout' : 'network_error', timedOut ? 'Timeout de Tiendanube.' : 'Error de red con Tiendanube.', true);
// Limpia siempre el temporizador para no dejar tareas pendientes.
      } finally {
// Completa la construcción, validación o traducción correspondiente a esta línea.
        clearTimeout(timer);
// Cierra el bloque o la estructura y acota el alcance de sus datos.
      }
// Cierra el bloque o la estructura y acota el alcance de sus datos.
    }

// Propaga un error tipado y seguro en lugar del detalle bruto de la red.
    throw new TiendanubeApiError(0, 'unexpected_error', 'Fallo inesperado de Tiendanube.', false);
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }

// Delega la lectura de un producto al transporte común y devuelve su promesa.
  getProduct(productId) {
// Entrega el resultado normalizado al consumidor y termina esta rama.
    return this.request(`/products/${encodeURIComponent(String(productId))}`);
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }

// Delega la lectura de la tienda autenticada al transporte común y devuelve su promesa.
  getStore() {
// Entrega el resultado normalizado al consumidor y termina esta rama.
    return this.request('/store');
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}

// Expone una transformación o fábrica validada para los módulos consumidores.
export function apiBaseFromEnv(env = {}) {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const version = String(env.TIENDANUBE_API_VERSION || '').trim();
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (version !== TIENDANUBE_API_VERSION) {
// Propaga un error tipado y seguro en lugar del detalle bruto de la red.
    throw new TiendanubeApiError(0, 'api_version_invalid', 'Version de API Tiendanube no configurada.', false);
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }
// Entrega el resultado normalizado al consumidor y termina esta rama.
  return `https://api.tiendanube.com/${TIENDANUBE_API_VERSION}`;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}

// Expone una transformación o fábrica validada para los módulos consumidores.
export function userAgentFromEnv(env = {}) {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const userAgent = String(env.TIENDANUBE_USER_AGENT || '').trim();
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (!userAgent || userAgent.length > 255 || /[\u0000-\u001f\u007f]/u.test(userAgent)) {
// Propaga un error tipado y seguro en lugar del detalle bruto de la red.
    throw new TiendanubeApiError(0, 'user_agent_invalid', 'User-Agent Tiendanube no configurado.', false);
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }
// Entrega el resultado normalizado al consumidor y termina esta rama.
  return userAgent;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}

// Expone una transformación o fábrica validada para los módulos consumidores.
export async function clientFromEnv(env, overrides = {}) {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const credentials = await accessTokenForEnvironment(env, { cryptoImpl: overrides.cryptoImpl });
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const {
// Define un campo del pedido o de la configuración enviada al transporte.
    cryptoImpl: _cryptoImpl,
// Define un campo del pedido o de la configuración enviada al transporte.
    storeId: _ignoredStoreId,
// Define un campo del pedido o de la configuración enviada al transporte.
    accessToken: _ignoredAccessToken,
// Incorpora únicamente las opciones restantes después de retirar las sobrescrituras sensibles.
    ...clientOverrides
// Completa la construcción, validación o traducción correspondiente a esta línea.
  } = overrides;
// Devuelve una instancia configurada con credenciales ya obtenidas y límites validados.
  return new TiendanubeClient({
// Incorpora únicamente las opciones restantes después de retirar las sobrescrituras sensibles.
    ...clientOverrides,
// Define un campo del pedido o de la configuración enviada al transporte.
    storeId: credentials.storeId,
// Define un campo del pedido o de la configuración enviada al transporte.
    accessToken: credentials.accessToken,
// Define un campo del pedido o de la configuración enviada al transporte.
    apiBase: apiBaseFromEnv(env),
// Define un campo del pedido o de la configuración enviada al transporte.
    userAgent: userAgentFromEnv(env),
// Define un campo del pedido o de la configuración enviada al transporte.
    timeoutMs: env.TIENDANUBE_API_TIMEOUT_MS,
// Define un campo del pedido o de la configuración enviada al transporte.
    maxRetries: env.TIENDANUBE_API_MAX_RETRIES
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  });
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}

// Expone una transformación o fábrica validada para los módulos consumidores.
export function localizedText(value, preferred = 'es') {
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (typeof value === 'string') return value.trim();
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (!value || typeof value !== 'object') return '';
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (typeof value[preferred] === 'string' && value[preferred].trim()) return value[preferred].trim();
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const first = Object.values(value).find((entry) => typeof entry === 'string' && entry.trim());
// Entrega el resultado normalizado al consumidor y termina esta rama.
  return first ? first.trim() : '';
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}

// Expone una transformación o fábrica validada para los módulos consumidores.
export function availableStock(variant) {
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (variant && variant.stock_management === false) return Number.POSITIVE_INFINITY;
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const levels = variant && Array.isArray(variant.inventory_levels) ? variant.inventory_levels : [];
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (levels.length) {
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
    if (levels.some((level) => level && (level.stock === '' || level.stock === null))) {
// Entrega el resultado normalizado al consumidor y termina esta rama.
      return Number.POSITIVE_INFINITY;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
    }
// Entrega el resultado normalizado al consumidor y termina esta rama.
    return levels.reduce((total, level) => {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
      const stock = Number(level && level.stock);
// Entrega el resultado normalizado al consumidor y termina esta rama.
      return total + (Number.isFinite(stock) && stock > 0 ? stock : 0);
// Completa la construcción, validación o traducción correspondiente a esta línea.
    }, 0);
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }
// Evalúa el estado de la respuesta o la posibilidad segura de reintentar.
  if (variant && (variant.stock === '' || variant.stock === null) && variant.stock_management !== true) {
// Entrega el resultado normalizado al consumidor y termina esta rama.
    return Number.POSITIVE_INFINITY;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
  }
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const stock = Number(variant && variant.stock);
// Entrega el resultado normalizado al consumidor y termina esta rama.
  return Number.isFinite(stock) && stock > 0 ? stock : 0;
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}

// Expone una transformación o fábrica validada para los módulos consumidores.
export function currentPrice(variant) {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const promotional = variant && variant.promotional_price;
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const value = promotional !== null && promotional !== undefined && String(promotional).trim() !== ''
// Completa la construcción, validación o traducción correspondiente a esta línea.
    ? promotional
// Completa la construcción, validación o traducción correspondiente a esta línea.
    : variant && variant.price;
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const text = String(value ?? '').trim();
// Entrega el resultado normalizado al consumidor y termina esta rama.
  return /^\d+(?:\.\d+)?$/.test(text) ? text : '';
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}

// Expone una transformación o fábrica validada para los módulos consumidores.
export function variantLabel(variant) {
// Calcula y conserva un dato inmutable que usa el resto de esta etapa.
  const values = variant && Array.isArray(variant.values) ? variant.values : [];
// Entrega el resultado normalizado al consumidor y termina esta rama.
  return values.map((entry) => localizedText(entry)).filter(Boolean).join(' / ');
// Cierra el bloque o la estructura y acota el alcance de sus datos.
}
