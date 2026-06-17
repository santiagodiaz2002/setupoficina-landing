/* =====================================================================
   PrimOffice · Endpoint de leads
   Ruta pública: /api/leads
   Plataforma: Cloudflare Pages Functions + D1

   Objetivo:
   - Recibir el payload del test ergonómico.
   - Validar datos mínimos.
   - Guardar respaldo real en Cloudflare D1.
   - Dejar preparada la salida futura hacia Odoo sin exponer credenciales.
   ===================================================================== */

const ALLOWED_ORIGINS = new Set([
  'https://setupoficina.com.ar',
  'https://www.setupoficina.com.ar',
  'https://setupoficina-landing.pages.dev',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://setupoficina.com.ar';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(request ? corsHeaders(request) : {})
    }
  });
}

function safeString(value, max = 500) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function safeJson(value) {
  try { return JSON.stringify(value || null); }
  catch (_) { return 'null'; }
}

function pickProducts(payload) {
  const cfg = payload && payload.configuration ? payload.configuration : {};
  const selected = Array.isArray(cfg.selectedProducts) ? cfg.selectedProducts : [];
  const extras = Array.isArray(cfg.selectedExtras) ? cfg.selectedExtras : [];
  const recommended = Array.isArray(cfg.recommendedProducts) ? cfg.recommendedProducts : [];
  return { selected, extras, recommended };
}

function validatePayload(payload) {
  const contact = payload && payload.contact ? payload.contact : {};
  const diagnosis = payload && payload.diagnosis ? payload.diagnosis : {};

  if (!payload || typeof payload !== 'object') return 'Payload inválido.';
  if (!safeString(contact.name, 120)) return 'Falta el nombre del contacto.';
  if (!contact.consent) return 'Falta el consentimiento del contacto.';

  const channel = safeString(contact.preferredChannel, 30);
  if (!['email', 'whatsapp'].includes(channel)) return 'Canal de contacto inválido.';

  if (channel === 'email' && !safeString(contact.email, 180)) return 'Falta el email.';
  if (channel === 'whatsapp' && !safeString(contact.whatsapp, 80)) return 'Falta el WhatsApp.';

  const totalScore = Number(diagnosis.totalScore);
  if (!Number.isFinite(totalScore)) return 'Falta el puntaje del diagnóstico.';

  return '';
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestGet({ request }) {
  return json({
    ok: true,
    service: 'PrimOffice Leads API',
    status: 'ready',
    method: 'POST'
  }, 200, request);
}

export async function onRequestPost({ request, env }) {
  if (!env.LEADS_DB) {
    return json({ ok: false, error: 'D1 binding LEADS_DB no configurado.' }, 500, request);
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 100_000) {
    return json({ ok: false, error: 'Payload demasiado grande.' }, 413, request);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ ok: false, error: 'JSON inválido.' }, 400, request);
  }

  const error = validatePayload(payload);
  if (error) return json({ ok: false, error }, 400, request);

  const contact = payload.contact || {};
  const diagnosis = payload.diagnosis || {};
  const configuration = payload.configuration || {};
  const products = pickProducts(payload);

  const leadId = safeString(payload.leadId, 80) || `lead_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = safeString(payload.createdAt, 40) || new Date().toISOString();
  const name = safeString(contact.name, 120);
  const preferredChannel = safeString(contact.preferredChannel, 30);
  const email = safeString(contact.email, 180);
  const whatsapp = safeString(contact.whatsapp, 80);
  const source = safeString(payload.source, 120) || 'landing-primoffice';
  const recommendedTier = safeString(diagnosis.recommendedTier, 80);
  const recommendedPreset = safeString(diagnosis.recommendedPreset, 40);
  const totalScore = Number(diagnosis.totalScore || 0);
  const estimatedTotal = Number(configuration.estimatedTotal || 0);
  const currency = safeString(configuration.currency, 10) || 'ARS';
  const userAgent = safeString(request.headers.get('User-Agent'), 500);
  const ip = safeString(request.headers.get('CF-Connecting-IP'), 80);
  const country = safeString(request.cf && request.cf.country, 10);

  try {
    await env.LEADS_DB.prepare(`
      INSERT INTO leads (
        lead_id, created_at, source, name, preferred_channel, email, whatsapp,
        consent, recommended_tier, recommended_preset, total_score,
        estimated_total, currency, products_json, utm_json, payload_json,
        user_agent, ip, country
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      createdAt,
      source,
      name,
      preferredChannel,
      email,
      whatsapp,
      contact.consent ? 1 : 0,
      recommendedTier,
      recommendedPreset,
      Number.isFinite(totalScore) ? totalScore : 0,
      Number.isFinite(estimatedTotal) ? estimatedTotal : 0,
      currency,
      safeJson(products),
      safeJson(payload.utm || {}),
      safeJson(payload),
      userAgent,
      ip,
      country
    ).run();

    return json({
      ok: true,
      mode: 'real',
      stored: true,
      leadId
    }, 201, request);
  } catch (err) {
    console.error('[PrimOffice Leads API] Error insertando lead:', err);
    return json({
      ok: false,
      mode: 'real',
      stored: false,
      error: 'No se pudo guardar el lead.'
    }, 500, request);
  }
}
