// Los errores de configuración se convierten en respuestas controladas por la capa HTTP.
import { HttpError } from './http.mjs';

// Una clave de 32 bytes codificada en base64 canónico ocupa 44 caracteres y termina en padding.
const KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
// El contexto separa este uso criptográfico de cualquier otro ciphertext asociado al mismo Store ID.
const TOKEN_CONTEXT = 'setupoficina:tiendanube:';

// Obtiene Web Crypto de producción o el doble inyectado por las pruebas.
function cryptoApi(cryptoImpl) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const api = cryptoImpl || globalThis.crypto;
  // AES-GCM necesita subtle y la creación de IV necesita un generador criptográfico.
  if (!api || !api.subtle || !api.getRandomValues) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(500, 'crypto_unavailable', 'Criptografia no disponible.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Entrega el valor ya validado al llamador y termina esta rama.
  return api;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Convierte bytes en base64 estándar para almacenarlos como TEXT en D1.
function bytesToBase64(bytes) {
// Reserva estado mutable porque se completa durante la validación o el recorrido.
  let binary = '';
  // Cada carácter intermedio representa un byte, no texto Unicode de usuario.
  for (const byte of bytes) binary += String.fromCharCode(byte);
// Entrega el valor ya validado al llamador y termina esta rama.
  return btoa(binary);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Decodifica base64 y traduce cualquier formato inválido a un error seguro de configuración.
function base64ToBytes(value, code) {
// Aísla una conversión o API que puede rechazar datos externos.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const binary = atob(String(value || ''));
// Entrega el valor ya validado al llamador y termina esta rama.
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
// Captura el fallo y lo traduce a un error estable sin revelar el dato sensible.
  } catch (_) {
    // El mensaje no incluye el material recibido para evitar filtrarlo en logs o respuestas.
    throw new HttpError(503, code, 'Configuracion criptografica invalida.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Valida sintaxis, longitud decodificada y representación canónica de la clave AES-256.
export function decodeEncryptionKey(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const encoded = String(value || '').trim();
// Comprueba una precondición de cifrado del acceso y detiene el flujo cuando no se cumple.
  if (!KEY_PATTERN.test(encoded)) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'token_encryption_key_invalid', 'Clave de cifrado no configurada.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const bytes = base64ToBytes(encoded, 'token_encryption_key_invalid');
  // Volver a codificar impide aceptar variantes no canónicas de la misma secuencia de bytes.
  if (bytes.byteLength !== 32 || bytesToBase64(bytes) !== encoded) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'token_encryption_key_invalid', 'Clave de cifrado no configurada.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Entrega el valor ya validado al llamador y termina esta rama.
  return bytes;
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Importa la clave como no exportable y restringida a una sola operación.
async function encryptionKey(encodedKey, usage, cryptoImpl) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const api = cryptoApi(cryptoImpl);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const key = await api.subtle.importKey(
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
    'raw',
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
    decodeEncryptionKey(encodedKey),
// Continúa una expresión agrupada con sus argumentos o condiciones explícitos.
    { name: 'AES-GCM' },
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
    false,
// Continúa una expresión agrupada con sus argumentos o condiciones explícitos.
    [usage]
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  );
  // Devolver api y key evita seleccionar dos implementaciones criptográficas distintas en una operación.
  return { api, key };
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Construye authenticated additional data que liga el ciphertext a su Store ID.
function additionalData(storeId) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const value = String(storeId || '').trim();
  // El Store ID nunca entra al cifrado si no tiene el formato numérico esperado.
  if (!/^\d+$/.test(value)) throw new HttpError(500, 'store_id_invalid', 'Store ID invalido.');
// Entrega el valor ya validado al llamador y termina esta rama.
  return new TextEncoder().encode(`${TOKEN_CONTEXT}${value}`);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Cifra un access token con AES-256-GCM y un IV independiente por instalación.
export async function encryptAccessToken(accessToken, encodedKey, storeId, cryptoImpl) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const token = String(accessToken || '');
  // Se rechazan tokens vacíos o anormalmente grandes antes de cualquier operación criptográfica.
  if (!token || token.length > 4096) throw new HttpError(502, 'oauth_token_invalid', 'Token OAuth invalido.');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const { api, key } = await encryptionKey(encodedKey, 'encrypt', cryptoImpl);
  // Doce bytes es el tamaño recomendado para el nonce de GCM.
  const iv = new Uint8Array(12);
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
  api.getRandomValues(iv);
  // GCM cifra y autentica token más contexto; tagLength fija un tag de 128 bits.
  const ciphertext = await api.subtle.encrypt(
// Continúa una expresión agrupada con sus argumentos o condiciones explícitos.
    { name: 'AES-GCM', iv, additionalData: additionalData(storeId), tagLength: 128 },
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
    key,
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
    new TextEncoder().encode(token)
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  );
  // Sólo ciphertext autenticado e IV salen de esta función; nunca la clave ni el token plano.
  return {
// Define un campo del resultado o de la configuración con un valor ya controlado.
    encryptedAccessToken: bytesToBase64(new Uint8Array(ciphertext)),
// Define un campo del resultado o de la configuración con un valor ya controlado.
    encryptionIv: bytesToBase64(iv)
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  };
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Descifra una fila D1 y verifica automáticamente tag GCM y Store ID asociado.
export async function decryptAccessToken(row, encodedKey, storeId, cryptoImpl) {
// Aísla una conversión o API que puede rechazar datos externos.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const { api, key } = await encryptionKey(encodedKey, 'decrypt', cryptoImpl);
    // Los nombres coinciden con las columnas persistidas por installations.mjs.
    const iv = base64ToBytes(row && row.encryption_iv, 'token_ciphertext_invalid');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const ciphertext = base64ToBytes(row && row.encrypted_access_token, 'token_ciphertext_invalid');
    // El ciphertext mínimo contiene al menos un byte de token más el tag de autenticación.
    if (iv.byteLength !== 12 || ciphertext.byteLength < 17) throw new Error('invalid_ciphertext');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const plaintext = await api.subtle.decrypt(
// Continúa una expresión agrupada con sus argumentos o condiciones explícitos.
      { name: 'AES-GCM', iv, additionalData: additionalData(storeId), tagLength: 128 },
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
      key,
// Completa la etapa actual de cifrado del acceso sin introducir un efecto adicional.
      ciphertext
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
    );
// Calcula y conserva un dato inmutable dentro de este alcance.
    const token = new TextDecoder().decode(plaintext);
    // Tras descifrar se repite el contrato de tamaño para detectar datos corruptos.
    if (!token || token.length > 4096) throw new Error('invalid_token');
// Entrega el valor ya validado al llamador y termina esta rama.
    return token;
// Captura el fallo y lo traduce a un error estable sin revelar el dato sensible.
  } catch (error) {
    // Una clave ausente conserva su código operativo; otros fallos se agrupan para no dar oráculos.
    if (error instanceof HttpError && error.code === 'token_encryption_key_invalid') throw error;
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'token_decryption_failed', 'No se pudo cargar la instalacion OAuth.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}
