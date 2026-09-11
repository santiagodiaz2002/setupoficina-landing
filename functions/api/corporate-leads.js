import { createCorporateLead } from '../_lib/corporate/corporate-leads.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://empresas.primoffice.com.ar',
  'https://primoffice-empresas.primoffice.workers.dev',
  'http://127.0.0.1:8787',
  'http://localhost:8787'
]);

const MAX_BODY_BYTES = 16384;

function json(data, status, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

async function readPayload(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    throw new RangeError('body');
  }
  if (!request.body) throw new SyntaxError('body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError('body');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export async function onRequest({ request, env }) {
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: 'Origen no permitido.' }, 403);
    const cors = { Vary: 'Origin' };
    if (origin) cors['Access-Control-Allow-Origin'] = origin;
    const reply = (data, status, headers = {}) => json(data, status, { ...cors, ...headers });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
    }
    if (request.method !== 'POST') return reply({ ok: false, error: 'Método no permitido.' }, 405, { Allow: 'POST, OPTIONS' });
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return reply({ ok: false, error: 'Se requiere JSON.' }, 415);
    }
    let payload;
    try {
      payload = await readPayload(request);
    } catch (error) {
      return reply({ ok: false, error: 'Consulta inválida.' }, error instanceof RangeError ? 413 : 400);
    }
    try {
      const result = await createCorporateLead(payload, env);
      if (result.error) return reply({ ok: false, error: result.error }, 400);
      return reply({ ok: true, id: result.id }, 201);
    } catch {
      // No registrar payload, credenciales ni respuestas de Odoo en los logs públicos.
      console.error('corporate_lead_registration_failed');
      return reply({ ok: false, error: 'No pudimos registrar la consulta. Podés continuar por WhatsApp.' }, 503);
    }
}
