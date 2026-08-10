// HttpError permite expresar fallas criptográficas y de validación sin filtrar excepciones nativas.
import { HttpError } from './http.mjs';

// Nombres normalizados que nunca deben ser aceptados desde el navegador.
// Los IDs comerciales y precios se resuelven exclusivamente desde D1 y Tiendanube.
const FORBIDDEN_INPUT_KEYS = new Set([
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
  'productid',
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
  'variantid',
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
  'sku',
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
  'price',
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
  'unitprice',
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
  'promotionalprice'
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
]);

// Selecciona Web Crypto real o una implementación inyectada por pruebas deterministas.
function cryptoApi(cryptoImpl) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const api = cryptoImpl || globalThis.crypto;
  // subtle cubre hash/HMAC y getRandomValues garantiza entropía criptográfica.
  if (!api || !api.subtle || !api.getRandomValues) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(500, 'crypto_unavailable', 'Criptografia no disponible.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Entrega el valor ya validado al llamador y termina esta rama.
  return api;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Codifica bytes como hexadecimal minúsculo, formato usado por hashes persistidos en D1.
export function bytesToHex(bytes) {
  // padStart conserva dos dígitos incluso para bytes menores que 16.
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Decodifica únicamente un digest SHA-256 hexadecimal canónico.
export function hexToBytes(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const input = String(value || '').trim().toLowerCase();
  // Rechazar longitud/alfabeto incorrectos antes de reservar el buffer simplifica el HMAC.
  if (!/^[a-f0-9]{64}$/.test(input)) return null;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const bytes = new Uint8Array(input.length / 2);
  // Cada par de caracteres representa exactamente un byte.
  for (let index = 0; index < input.length; index += 2) {
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
    bytes[index / 2] = Number.parseInt(input.slice(index, index + 2), 16);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Entrega el valor ya validado al llamador y termina esta rama.
  return bytes;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Compara buffers acumulando diferencias, sin cortar al encontrar el primer byte distinto.
export function timingSafeEqual(left, right) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const a = left instanceof Uint8Array ? left : new Uint8Array(left || []);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const b = right instanceof Uint8Array ? right : new Uint8Array(right || []);
  // La longitud también forma parte del resultado y no se decide con un retorno temprano.
  let mismatch = a.length ^ b.length;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const length = Math.max(a.length, b.length);
  // El recorrido completo reduce señales temporales sobre la posición de una diferencia.
  for (let index = 0; index < length; index += 1) {
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
    mismatch |= (a[index % (a.length || 1)] || 0) ^ (b[index % (b.length || 1)] || 0);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Entrega el valor ya validado al llamador y termina esta rama.
  return mismatch === 0;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Calcula SHA-256 sobre texto UTF-8 o bytes y entrega un digest apto para D1.
export async function sha256Hex(value, cryptoImpl) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const api = cryptoApi(cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  // digest es asíncrono porque delega la operación criptográfica a la plataforma.
  const digest = await api.subtle.digest('SHA-256', bytes);
// Entrega el valor ya validado al llamador y termina esta rama.
  return bytesToHex(new Uint8Array(digest));
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Genera 32 bytes aleatorios y los representa como base64url sin padding.
export function randomTicket(cryptoImpl) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const api = cryptoApi(cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const bytes = new Uint8Array(32);
  // Nunca se usa Math.random para credenciales o estados de un solo uso.
  api.getRandomValues(bytes);
// Reserva estado mutable porque se completa durante la validación o el recorrido.
  let binary = '';
  // btoa recibe una cadena binaria; cada carácter conserva el valor de un byte.
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // El reemplazo produce un token seguro para query strings sin necesidad de escapar +, / o =.
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  // Se conservan token y bytes para que las pruebas puedan verificar formato/entropía sin persistirlos.
  return { token: encoded, bytes };
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Verifica el HMAC enviado por Tiendanube sobre los bytes crudos exactos del webhook.
export async function verifyWebhookHmac(rawBody, providedHeader, secret, cryptoImpl) {
  // Sin secreto no es seguro aceptar ni siquiera un payload bien formado.
  if (!secret) throw new HttpError(503, 'webhook_secret_missing', 'Secreto de webhook no configurado.');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const provided = hexToBytes(providedHeader);
  // Una firma con formato distinto al digest esperado se rechaza sin lanzar detalles.
  if (!provided) return false;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const api = cryptoApi(cryptoImpl);
  // importKey crea una clave HMAC no exportable y limitada a la operación de firma.
  const key = await api.subtle.importKey(
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
    'raw',
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
    new TextEncoder().encode(String(secret)),
// Continúa una expresión agrupada con sus argumentos o condiciones explícitos.
    { name: 'HMAC', hash: 'SHA-256' },
// Completa la etapa actual de seguridad criptográfica y payloads sin introducir un efecto adicional.
    false,
// Continúa una expresión agrupada con sus argumentos o condiciones explícitos.
    ['sign']
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  );
  // Firmar localmente el cuerpo equivale a calcular el valor esperado.
  const signature = await api.subtle.sign('HMAC', key, rawBody);
  // La comparación no revela en qué byte difiere la firma proporcionada.
  return timingSafeEqual(new Uint8Array(signature), provided);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Recorre recursivamente el JSON para detectar intentos de inyectar datos comerciales confiables.
export function assertNoCommerceFields(value, path = '$') {
  // Primitivos y null no contienen claves que revisar.
  if (!value || typeof value !== 'object') return;
// Recorre una colección acotada y valida o transforma cada elemento.
  for (const [key, child] of Object.entries(value)) {
    // Normalizar mayúsculas y separadores cubre variantes habituales del mismo nombre prohibido.
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
// Comprueba una precondición de seguridad criptográfica y payloads y detiene el flujo cuando no se cumple.
    if (FORBIDDEN_INPUT_KEYS.has(normalized)) {
      // path identifica el campo rechazado sin incluir su valor potencialmente sensible.
      throw new HttpError(400, 'forbidden_commerce_field', 'No se aceptan IDs ni precios de Tiendanube desde el cliente.', {
// Define un campo del resultado o de la configuración con un valor ya controlado.
        field: `${path}.${key}`
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
      });
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
    }
    // La recursión incluye objetos y elementos de arrays porque Object.entries cubre ambos.
    assertNoCommerceFields(child, `${path}.${key}`);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Valida la representación base64url exacta de un token aleatorio de 32 bytes.
export function assertTicket(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const token = String(value || '').trim();
// Comprueba una precondición de seguridad criptográfica y payloads y detiene el flujo cuando no se cumple.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, 'invalid_ticket', 'Ticket invalido.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Entrega el valor ya validado al llamador y termina esta rama.
  return token;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// El feature flag requiere el texto explícito true; cualquier ausencia o typo queda deshabilitado.
export function isFeatureEnabled(env = {}) {
// Entrega el valor ya validado al llamador y termina esta rama.
  return String(env.TIENDANUBE_ENABLED || '').trim().toLowerCase() === 'true';
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}
