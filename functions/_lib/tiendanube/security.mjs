import { HttpError } from './http.mjs';

const FORBIDDEN_INPUT_KEYS = new Set([
  'productid',
  'variantid',
  'sku',
  'price',
  'unitprice',
  'promotionalprice'
]);

function cryptoApi(cryptoImpl) {
  const api = cryptoImpl || globalThis.crypto;
  if (!api || !api.subtle || !api.getRandomValues) {
    throw new HttpError(500, 'crypto_unavailable', 'Criptografia no disponible.');
  }
  return api;
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(value) {
  const input = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(input)) return null;
  const bytes = new Uint8Array(input.length / 2);
  for (let index = 0; index < input.length; index += 2) {
    bytes[index / 2] = Number.parseInt(input.slice(index, index + 2), 16);
  }
  return bytes;
}

export function timingSafeEqual(left, right) {
  const a = left instanceof Uint8Array ? left : new Uint8Array(left || []);
  const b = right instanceof Uint8Array ? right : new Uint8Array(right || []);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index % (a.length || 1)] || 0) ^ (b[index % (b.length || 1)] || 0);
  }
  return mismatch === 0;
}

export async function sha256Hex(value, cryptoImpl) {
  const api = cryptoApi(cryptoImpl);
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await api.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

export function randomTicket(cryptoImpl) {
  const api = cryptoApi(cryptoImpl);
  const bytes = new Uint8Array(32);
  api.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return { token: encoded, bytes };
}

export async function verifyWebhookHmac(rawBody, providedHeader, secret, cryptoImpl) {
  if (!secret) throw new HttpError(503, 'webhook_secret_missing', 'Secreto de webhook no configurado.');
  const provided = hexToBytes(providedHeader);
  if (!provided) return false;
  const api = cryptoApi(cryptoImpl);
  const key = await api.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await api.subtle.sign('HMAC', key, rawBody);
  return timingSafeEqual(new Uint8Array(signature), provided);
}

export function assertNoCommerceFields(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_INPUT_KEYS.has(normalized)) {
      throw new HttpError(400, 'forbidden_commerce_field', 'No se aceptan IDs ni precios de Tiendanube desde el cliente.', {
        field: `${path}.${key}`
      });
    }
    assertNoCommerceFields(child, `${path}.${key}`);
  }
}

export function assertTicket(value) {
  const token = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new HttpError(400, 'invalid_ticket', 'Ticket invalido.');
  }
  return token;
}

export function isFeatureEnabled(env = {}) {
  return String(env.TIENDANUBE_ENABLED || '').trim().toLowerCase() === 'true';
}
