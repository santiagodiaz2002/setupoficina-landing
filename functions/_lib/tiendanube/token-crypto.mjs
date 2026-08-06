import { HttpError } from './http.mjs';

const KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const TOKEN_CONTEXT = 'setupoficina:tiendanube:';

function cryptoApi(cryptoImpl) {
  const api = cryptoImpl || globalThis.crypto;
  if (!api || !api.subtle || !api.getRandomValues) {
    throw new HttpError(500, 'crypto_unavailable', 'Criptografia no disponible.');
  }
  return api;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value, code) {
  try {
    const binary = atob(String(value || ''));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (_) {
    throw new HttpError(503, code, 'Configuracion criptografica invalida.');
  }
}

export function decodeEncryptionKey(value) {
  const encoded = String(value || '').trim();
  if (!KEY_PATTERN.test(encoded)) {
    throw new HttpError(503, 'token_encryption_key_invalid', 'Clave de cifrado no configurada.');
  }
  const bytes = base64ToBytes(encoded, 'token_encryption_key_invalid');
  if (bytes.byteLength !== 32 || bytesToBase64(bytes) !== encoded) {
    throw new HttpError(503, 'token_encryption_key_invalid', 'Clave de cifrado no configurada.');
  }
  return bytes;
}

async function encryptionKey(encodedKey, usage, cryptoImpl) {
  const api = cryptoApi(cryptoImpl);
  const key = await api.subtle.importKey(
    'raw',
    decodeEncryptionKey(encodedKey),
    { name: 'AES-GCM' },
    false,
    [usage]
  );
  return { api, key };
}

function additionalData(storeId) {
  const value = String(storeId || '').trim();
  if (!/^\d+$/.test(value)) throw new HttpError(500, 'store_id_invalid', 'Store ID invalido.');
  return new TextEncoder().encode(`${TOKEN_CONTEXT}${value}`);
}

export async function encryptAccessToken(accessToken, encodedKey, storeId, cryptoImpl) {
  const token = String(accessToken || '');
  if (!token || token.length > 4096) throw new HttpError(502, 'oauth_token_invalid', 'Token OAuth invalido.');
  const { api, key } = await encryptionKey(encodedKey, 'encrypt', cryptoImpl);
  const iv = new Uint8Array(12);
  api.getRandomValues(iv);
  const ciphertext = await api.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(storeId), tagLength: 128 },
    key,
    new TextEncoder().encode(token)
  );
  return {
    encryptedAccessToken: bytesToBase64(new Uint8Array(ciphertext)),
    encryptionIv: bytesToBase64(iv)
  };
}

export async function decryptAccessToken(row, encodedKey, storeId, cryptoImpl) {
  try {
    const { api, key } = await encryptionKey(encodedKey, 'decrypt', cryptoImpl);
    const iv = base64ToBytes(row && row.encryption_iv, 'token_ciphertext_invalid');
    const ciphertext = base64ToBytes(row && row.encrypted_access_token, 'token_ciphertext_invalid');
    if (iv.byteLength !== 12 || ciphertext.byteLength < 17) throw new Error('invalid_ciphertext');
    const plaintext = await api.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(storeId), tagLength: 128 },
      key,
      ciphertext
    );
    const token = new TextDecoder().decode(plaintext);
    if (!token || token.length > 4096) throw new Error('invalid_token');
    return token;
  } catch (error) {
    if (error instanceof HttpError && error.code === 'token_encryption_key_invalid') throw error;
    throw new HttpError(503, 'token_decryption_failed', 'No se pudo cargar la instalacion OAuth.');
  }
}
