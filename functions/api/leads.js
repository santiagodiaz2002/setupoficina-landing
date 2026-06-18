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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  if (!payload || typeof payload !== 'object') return 'Payload invalido.';
  if (!safeString(contact.name, 120)) return 'Falta el nombre del contacto.';
  if (!contact.consent) return 'Falta el consentimiento del contacto.';

  const channel = safeString(contact.preferredChannel, 30);
  if (!['email', 'whatsapp'].includes(channel)) return 'Canal de contacto invalido.';

  if (channel === 'email' && !safeString(contact.email, 180)) return 'Falta el email.';
  if (channel === 'whatsapp' && !safeString(contact.whatsapp, 80)) return 'Falta el WhatsApp.';

  const totalScore = Number(diagnosis.totalScore);
  if (!Number.isFinite(totalScore)) return 'Falta el puntaje del diagnostico.';

  return '';
}

function odooEnabled(env) {
  return String(env.ODOO_ENABLED || '').toLowerCase() === 'true';
}

function odooConfigured(env) {
  return Boolean(env.ODOO_URL && env.ODOO_DB && env.ODOO_USERNAME && env.ODOO_API_KEY);
}

function cleanOdooUrl(value) {
  return safeString(value, 300).replace(/\/+$/, '');
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlValue(value) {
  if (Array.isArray(value)) {
    return `<value><array><data>${value.map(xmlValue).join('')}</data></array></value>`;
  }

  if (value && typeof value === 'object') {
    const members = Object.entries(value).map(([key, val]) => {
      return `<member><name>${xmlEscape(key)}</name>${xmlValue(val)}</member>`;
    }).join('');
    return `<value><struct>${members}</struct></value>`;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return `<value><int>${value}</int></value>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<value><double>${value}</double></value>`;
  }

  if (typeof value === 'boolean') {
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  }

  return `<value><string>${xmlEscape(value ?? '')}</string></value>`;
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? match[1] : '';
}

function parseXmlRpcValue(xml) {
  const valueXml = getTag(xml, 'value') || xml;
  const intValue = getTag(valueXml, 'int') || getTag(valueXml, 'i4');
  if (intValue !== '') return Number(intValue);

  const doubleValue = getTag(valueXml, 'double');
  if (doubleValue !== '') return Number(doubleValue);

  const boolValue = getTag(valueXml, 'boolean');
  if (boolValue !== '') return boolValue === '1';

  const stringValue = getTag(valueXml, 'string');
  if (stringValue !== '') return decodeXml(stringValue);

  const raw = valueXml.replace(/<[^>]+>/g, '').trim();
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return decodeXml(raw);
}

async function xmlRpcCall(endpoint, methodName, params, timeoutMs = 15000) {
  const body = `<?xml version="1.0"?>\n<methodCall><methodName>${xmlEscape(methodName)}</methodName><params>${params.map((param) => `<param>${xmlValue(param)}</param>`).join('')}</params></methodCall>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body,
      signal: controller.signal
    });

    const text = await resp.text();
    if (!resp.ok) throw new Error(`Odoo HTTP ${resp.status}: ${text.slice(0, 300)}`);

    if (/<fault>/i.test(text)) {
      const faultString = getTag(text, 'string') || text.replace(/<[^>]+>/g, ' ').trim();
      throw new Error(`Odoo fault: ${decodeXml(faultString).slice(0, 500)}`);
    }

    return parseXmlRpcValue(getTag(text, 'param') || text);
  } finally {
    clearTimeout(timeout);
  }
}

function compactObject(obj) {
  const out = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) out[key] = value;
  });
  return out;
}

function formatProductName(productId) {
  const productNames = {
    silla: 'Silla ergonomica',
    silla_ergonomica: 'Silla ergonomica',
    monitor_27: 'Monitor 27 pulgadas',
    soporte_monitor: 'Soporte para monitor',
    teclado: 'Teclado mecanico',
    teclado_mec: 'Teclado mecanico',
    mouse_vertical: 'Mouse vertical ergonomico',
    hub_usb: 'Hub USB',
    hub_usb_pro: 'Hub USB Pro',
    luz_led: 'Barra de luz LED',
    mousepad_xxl: 'Mousepad XXL',
    organizador_prem: 'Organizador premium',
    asesoria: 'Asesoria ergonomica',
    standing_desk: 'Escritorio regulable'
  };
  const cleanId = safeString(productId, 120);
  if (!cleanId) return '';

  return productNames[cleanId] || cleanId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatProductList(items) {
  if (!Array.isArray(items) || !items.length) return '-';

  return items
    .map(formatProductName)
    .filter(Boolean)
    .map((name) => `- ${name}`)
    .join('\n');
}

function leadDescription(payload, requestInfo) {
  const contact = payload.contact || {};
  const diagnosis = payload.diagnosis || {};
  const configuration = payload.configuration || {};
  const products = pickProducts(payload);

  const currency = safeString(configuration.currency, 10) || 'ARS';
  const estimatedTotal = Number(configuration.estimatedTotal || 0);

  const lines = [
    'Lead generado desde setupoficina.com.ar',
    '',
    'CONTACTO',
    `Nombre: ${safeString(contact.name, 120)}`,
    `Canal elegido: ${safeString(contact.preferredChannel, 30)}`,
    contact.email ? `Email: ${safeString(contact.email, 180)}` : '',
    contact.whatsapp ? `WhatsApp: ${safeString(contact.whatsapp, 80)}` : '',
    '',
    'DIAGNOSTICO',
    `Resultado: ${safeString(diagnosis.recommendedTier, 80)}`,
    `Preset: ${safeString(diagnosis.recommendedPreset, 40)}`,
    `Puntaje: ${Number(diagnosis.totalScore || 0)}/18`,
    `Total estimado: $${estimatedTotal.toLocaleString('es-AR')} ${currency}`,
    '',
    'PRODUCTOS RECOMENDADOS',
    formatProductList(products.recommended),
    '',
    'PRODUCTOS SELECCIONADOS',
    formatProductList(products.selected),
    products.extras.length ? '' : '',
    products.extras.length ? 'EXTRAS' : '',
    products.extras.length ? formatProductList(products.extras) : '',
    '',
    'DATOS TECNICOS',
    `Lead ID: ${safeString(payload.leadId, 80)}`,
    `Fecha: ${safeString(payload.createdAt, 40)}`,
    `IP: ${requestInfo.ip || '-'}`,
    `Pais: ${requestInfo.country || '-'}`
  ];

  return lines.filter(Boolean).join('\n').slice(0, 6000);
}

function buildOdooLead(payload, requestInfo) {
  const contact = payload.contact || {};
  const diagnosis = payload.diagnosis || {};
  const configuration = payload.configuration || {};

  const name = safeString(contact.name, 120);
  const tier = safeString(diagnosis.recommendedTier, 80) || 'Setup recomendado';
  const whatsapp = safeString(contact.whatsapp, 80);
  const email = safeString(contact.email, 180);
  const estimatedRevenue = Number(configuration.estimatedTotal || 0);

  return compactObject({
    name: `${name} - ${tier}`.slice(0, 200),
    contact_name: name,
    email_from: email,
    phone: whatsapp,
    mobile: whatsapp,
    expected_revenue: Number.isFinite(estimatedRevenue) && estimatedRevenue > 0 ? estimatedRevenue : undefined,
    description: leadDescription(payload, requestInfo)
  });
}

async function sendToOdoo(payload, env, requestInfo) {
  if (!odooEnabled(env)) return { ok: false, skipped: true, error: 'Odoo desactivado.' };
  if (!odooConfigured(env)) return { ok: false, skipped: true, error: 'Faltan variables de Odoo.' };

  const url = cleanOdooUrl(env.ODOO_URL);
  const db = safeString(env.ODOO_DB, 120);
  const username = safeString(env.ODOO_USERNAME, 180);
  const apiKey = safeString(env.ODOO_API_KEY, 300);

  const uid = await xmlRpcCall(`${url}/xmlrpc/2/common`, 'authenticate', [db, username, apiKey, {}]);
  if (!uid || typeof uid !== 'number') throw new Error('Odoo no autentico el usuario. Revisar base, usuario o API key.');

  const fields = buildOdooLead(payload, requestInfo);
  const odooLeadId = await xmlRpcCall(`${url}/xmlrpc/2/object`, 'execute_kw', [
    db,
    uid,
    apiKey,
    'crm.lead',
    'create',
    [fields]
  ]);

  if (!odooLeadId || typeof odooLeadId !== 'number') throw new Error('Odoo no devolvio ID del lead creado.');
  return { ok: true, id: odooLeadId };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestGet({ request, env }) {
  return json({
    ok: true,
    service: 'PrimOffice Leads API',
    status: 'ready',
    method: 'POST',
    odoo: {
      enabled: odooEnabled(env),
      configured: odooConfigured(env)
    }
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
    return json({ ok: false, error: 'JSON invalido.' }, 400, request);
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
  const requestInfo = { ip, country };

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
  } catch (err) {
    console.error('[PrimOffice Leads API] Error guardando en D1:', err);
    return json({
      ok: false,
      mode: 'real',
      stored: false,
      error: 'No se pudo guardar el lead.'
    }, 500, request);
  }

  let odooResult = { ok: false, skipped: true, error: 'No ejecutado.' };

  try {
    odooResult = await sendToOdoo({ ...payload, leadId, createdAt }, env, requestInfo);

    if (odooResult.ok) {
      await env.LEADS_DB.prepare(`
        UPDATE leads
        SET odoo_status = ?, odoo_lead_id = ?, odoo_error = NULL, odoo_synced_at = ?
        WHERE lead_id = ?
      `).bind('synced', odooResult.id, new Date().toISOString(), leadId).run();
    } else if (!odooResult.skipped) {
      await env.LEADS_DB.prepare(`
        UPDATE leads
        SET odoo_status = ?, odoo_error = ?
        WHERE lead_id = ?
      `).bind('error', safeString(odooResult.error, 1000), leadId).run();
    }
  } catch (err) {
    const message = safeString(err && err.message ? err.message : err, 1000);
    odooResult = { ok: false, error: message };

    console.error('[PrimOffice Leads API] Error enviando a Odoo:', err);
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET odoo_status = ?, odoo_error = ?
      WHERE lead_id = ?
    `).bind('error', message, leadId).run();
  }

  return json({
    ok: true,
    mode: 'real',
    stored: true,
    leadId,
    odoo: {
      enabled: odooEnabled(env),
      synced: !!odooResult.ok,
      id: odooResult.id || null,
      error: odooResult.ok ? null : (odooResult.error || null)
    }
  }, 201, request);
}
