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
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeArgentinaPhone(value) {
  const raw = safeString(value, 80);
  if (!raw) return '';

  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('549') && digits.length === 13) {
    return `+${digits}`;
  }

  if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Formato local frecuente en AMBA: 011 15 xxxx xxxx.
  if (digits.startsWith('1115') && digits.length === 12) {
    digits = `11${digits.slice(4)}`;
  }

  if (digits.startsWith('9') && digits.length === 11) {
    return `+54${digits}`;
  }

  if (digits.length === 10) {
    return `+549${digits}`;
  }

  // Fallback conservador: conserva números internacionales válidos.
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return raw;
}

function normalizePayloadContact(payload) {
  const normalized = { ...(payload || {}) };
  const contact = { ...((payload && payload.contact) || {}) };
  contact.whatsapp = normalizeArgentinaPhone(contact.whatsapp);
  normalized.contact = contact;
  return normalized;
}

function getLeadSourceName(payload) {
  const explicit = safeString(payload && payload.landingSource, 120);
  if (explicit) return explicit;

  const source = safeString(payload && payload.source, 120);
  if (!source || source === 'landing-primoffice') {
    return 'Test - Landing';
  }

  return source
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getLeadTagNames(payload) {
  const contact = (payload && payload.contact) || {};
  const diagnosis = (payload && payload.diagnosis) || {};

  const tier = safeString(diagnosis.recommendedTier, 80);
  const channel = safeString(contact.preferredChannel, 30).toLowerCase();

  return [...new Set([
    'Test - Landing',
    tier,
    channel === 'whatsapp'
      ? 'WhatsApp'
      : (channel === 'email' ? 'Email' : '')
  ].filter(Boolean))];
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
  const arrayXml = getTag(valueXml, 'array');

  if (arrayXml !== '') {
    const dataXml = getTag(arrayXml, 'data');
    const intValues = [...dataXml.matchAll(/<(?:int|i4)>(-?\d+)<\/(?:int|i4)>/gi)]
      .map((match) => Number(match[1]));
    if (intValues.length) return intValues;

    return [...dataXml.matchAll(/<string>([\s\S]*?)<\/string>/gi)]
      .map((match) => decodeXml(match[1]));
  }

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


const PRODUCT_LABELS = {
  silla: 'Silla ergonómica',
  silla_ergonomica: 'Silla ergonómica',
  soporte_notebook: 'Soporte para notebook',
  soporte_monitor: 'Soporte para monitor',
  soporte_dual: 'Soporte dual para monitor',
  monitor_24: 'Monitor 24 pulgadas',
  monitor_27: 'Monitor 27 pulgadas',
  teclado: 'Teclado inalámbrico',
  teclado_mec: 'Teclado mecánico',
  mouse_ergo: 'Mouse ergonómico',
  mouse_vertical: 'Mouse vertical ergonómico',
  mouse_trackball: 'Mouse trackball ergonómico',
  mousepad_xxl: 'Mousepad XXL',
  hub_usb: 'Hub USB-C',
  hub_usb_pro: 'Hub USB-C Pro',
  organizador: 'Organizador de cables',
  organizador_prem: 'Organizador premium',
  luz_led: 'Barra de luz LED',
  webcam: 'Webcam HD',
  auriculares: 'Auriculares con micrófono',
  asesoria: 'Asesoría personalizada',
  standing_desk: 'Escritorio regulable / standing desk',
  almohadilla: 'Almohadilla lumbar',
  reposamuñecas: 'Reposamuñecas',
  guia: 'Guía de ergonomía digital',
  notebook: 'Notebook',
  brazo_monitor: 'Brazo articulado para monitor',
  bandeja_teclado: 'Bandeja para teclado',
  pad: 'Pad ergonómico',
  cable_management: 'Organización de cables'
};

function formatProductName(value) {
  const raw = safeString(value, 120);
  if (!raw) return '';

  if (PRODUCT_LABELS[raw]) return PRODUCT_LABELS[raw];

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bUsb\b/g, 'USB')
    .replace(/\bXxl\b/g, 'XXL')
    .replace(/\bLed\b/g, 'LED');
}

function formatProductList(items) {
  if (!Array.isArray(items) || !items.length) return [];
  return [...new Set(items.map(formatProductName).filter(Boolean))];
}

function formatProductListHtml(items) {
  const products = formatProductList(items);
  if (!products.length) return '<p>Sin productos.</p>';
  return `<ul>${products.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>`;
}

function formatBusinessDate(value) {
  const raw = safeString(value, 80);
  if (!raw) return '';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch (_) {
    return raw;
  }
}

function leadDescription(payload, requestInfo) {
  const contact = payload.contact || {};
  const diagnosis = payload.diagnosis || {};
  const configuration = payload.configuration || {};
  const products = pickProducts(payload);

  const estimatedTotal = Number(configuration.estimatedTotal || 0);
  const currency = safeString(configuration.currency, 10) || 'ARS';

  const eventType = safeString(payload.eventType, 80);
  const eventLabel = eventType === 'whatsapp_click'
    ? 'Selección final confirmada desde WhatsApp'
    : (eventType === 'cart_change' ? 'Selección actualizada desde el carrito' : 'Diagnóstico recibido');

  const contactLines = [
    `<strong>Nombre:</strong> ${htmlEscape(safeString(contact.name, 120) || '-')}`,
    contact.email ? `<strong>Email:</strong> ${htmlEscape(safeString(contact.email, 180))}` : '',
    contact.whatsapp ? `<strong>WhatsApp:</strong> ${htmlEscape(normalizeArgentinaPhone(contact.whatsapp))}` : ''
  ].filter(Boolean).join('<br>');

  const updatedDate = formatBusinessDate(payload.updatedAt || payload.createdAt);

  return [
    '<div>',
    '<p><strong>Resumen del test y configuración</strong></p>',
    '<hr>',
    '<h3>Estado</h3>',
    `<p><strong>${htmlEscape(eventLabel)}</strong>${updatedDate ? `<br><span>Actualizado: ${htmlEscape(updatedDate)} h</span>` : ''}</p>`,
    '<h3>Contacto</h3>',
    `<p>${contactLines}</p>`,
    '<h3>Resultado</h3>',
    `<p><strong>Recomendación:</strong> ${htmlEscape(safeString(diagnosis.recommendedTier, 80) || '-')}<br>`,
    `<strong>Puntaje:</strong> ${htmlEscape(String(Number(diagnosis.totalScore || 0)))}/18<br>`,
    `<strong>Total estimado:</strong> $${htmlEscape(Number.isFinite(estimatedTotal) ? estimatedTotal.toLocaleString('es-AR') : '0')} ${htmlEscape(currency)}</p>`,
    '<h3>Productos recomendados</h3>',
    formatProductListHtml(products.recommended),
    '<h3>Productos seleccionados</h3>',
    formatProductListHtml(products.selected),
    products.extras.length ? '<h3>Extras</h3>' : '',
    products.extras.length ? formatProductListHtml(products.extras) : '',
    '</div>'
  ].filter(Boolean).join('');
}

async function odooExecuteKw(session, model, method, args = [], kwargs = null) {
  const params = [
    session.db,
    session.uid,
    session.apiKey,
    model,
    method,
    args
  ];

  if (kwargs && Object.keys(kwargs).length) params.push(kwargs);
  return xmlRpcCall(`${session.url}/xmlrpc/2/object`, 'execute_kw', params);
}

async function findOrCreateNamedRecord(session, model, name) {
  const cleanName = safeString(name, 120);
  if (!cleanName) return null;

  const found = await odooExecuteKw(
    session,
    model,
    'search',
    [[['name', '=', cleanName]]],
    { limit: 1 }
  );

  if (Array.isArray(found) && found.length) {
    return Number(found[0]);
  }

  try {
    const created = await odooExecuteKw(
      session,
      model,
      'create',
      [{ name: cleanName }]
    );

    return Number(created) || null;
  } catch (error) {
    // Puede haber sido creada por otra solicitud al mismo tiempo.
    const retry = await odooExecuteKw(
      session,
      model,
      'search',
      [[['name', '=', cleanName]]],
      { limit: 1 }
    );

    if (Array.isArray(retry) && retry.length) {
      return Number(retry[0]);
    }

    throw error;
  }
}

async function buildOdooLead(payload, requestInfo, session) {
  const contact = payload.contact || {};
  const diagnosis = payload.diagnosis || {};
  const configuration = payload.configuration || {};

  const name = safeString(contact.name, 120);
  const tier = safeString(diagnosis.recommendedTier, 80) || 'Setup recomendado';
  const whatsapp = normalizeArgentinaPhone(contact.whatsapp);
  const email = safeString(contact.email, 180);
  const estimatedRevenue = Number(configuration.estimatedTotal || 0);

  const fields = compactObject({
    name: `${name} - ${tier}`.slice(0, 200),
    contact_name: name,
    email_from: email,
    phone: whatsapp,
    mobile: whatsapp,
    expected_revenue: Number.isFinite(estimatedRevenue) && estimatedRevenue > 0 ? estimatedRevenue : undefined,
    description: leadDescription(payload, requestInfo)
  });

  // Etiquetas y origen se agregan como mejora comercial, pero nunca bloquean el lead.
const tagIds = [];

for (const tagName of getLeadTagNames(payload)) {
  try {
    const tagId = await findOrCreateNamedRecord(
      session,
      'crm.tag',
      tagName
    );

    if (tagId) {
      tagIds.push(tagId);
    }
  } catch (error) {
    console.warn(
      `[PrimOffice Leads API] No se pudo resolver la etiqueta "${tagName}":`,
      error
    );
  }
}

if (tagIds.length) {
  fields.tag_ids = [[6, 0, [...new Set(tagIds)]]];
}

  return fields;
}

async function getOdooSession(env) {
  if (!odooEnabled(env)) return { ok: false, skipped: true, error: 'Odoo desactivado.' };
  if (!odooConfigured(env)) return { ok: false, skipped: true, error: 'Faltan variables de Odoo.' };

  const url = cleanOdooUrl(env.ODOO_URL);
  const db = safeString(env.ODOO_DB, 120);
  const username = safeString(env.ODOO_USERNAME, 180);
  const apiKey = safeString(env.ODOO_API_KEY, 300);

  const uid = await xmlRpcCall(`${url}/xmlrpc/2/common`, 'authenticate', [db, username, apiKey, {}]);
  if (!uid || typeof uid !== 'number') throw new Error('Odoo no autentico el usuario. Revisar base, usuario o API key.');

  return { ok: true, url, db, uid, apiKey };
}

async function sendToOdoo(payload, env, requestInfo) {
  const session = await getOdooSession(env);
  if (!session.ok) return session;

  const fields = await buildOdooLead(payload, requestInfo, session);
  const odooLeadId = await xmlRpcCall(`${session.url}/xmlrpc/2/object`, 'execute_kw', [
    session.db,
    session.uid,
    session.apiKey,
    'crm.lead',
    'create',
    [fields]
  ]);

  if (!odooLeadId || typeof odooLeadId !== 'number') throw new Error('Odoo no devolvio ID del lead creado.');
  return { ok: true, id: odooLeadId };
}

async function updateOdooLead(payload, env, requestInfo, odooLeadId) {
  const id = Number(odooLeadId || payload.odooLeadId || 0);
  if (!id || !Number.isFinite(id)) return { ok: false, skipped: true, error: 'No hay odooLeadId para actualizar.' };

  const session = await getOdooSession(env);
  if (!session.ok) return session;

  const fields = await buildOdooLead(payload, requestInfo, session);
  const updated = await xmlRpcCall(`${session.url}/xmlrpc/2/object`, 'execute_kw', [
    session.db,
    session.uid,
    session.apiKey,
    'crm.lead',
    'write',
    [[id], fields]
  ]);

  if (updated !== true) throw new Error('Odoo no confirmo la actualizacion del lead.');
  return { ok: true, id, updated: true };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestGet({ request, env }) {
  return json({
    ok: true,
    service: 'PrimOffice Leads API',
    status: 'ready',
    method: 'POST, PATCH',
    odoo: {
      enabled: odooEnabled(env),
      configured: odooConfigured(env)
    }
  }, 200, request);
}

async function readValidatedPayload(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 100_000) {
    return { error: 'Payload demasiado grande.', status: 413 };
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return { error: 'JSON invalido.', status: 400 };
  }

  const validationError = validatePayload(payload);
  if (validationError) return { error: validationError, status: 400 };

  return { payload };
}

export async function onRequestPatch({ request, env }) {
  if (!env.LEADS_DB) {
    return json({ ok: false, error: 'D1 binding LEADS_DB no configurado.' }, 500, request);
  }

  const parsed = await readValidatedPayload(request);
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status || 400, request);

  const payload = normalizePayloadContact(parsed.payload);
  const contact = payload.contact || {};
  const diagnosis = payload.diagnosis || {};
  const configuration = payload.configuration || {};
  const products = pickProducts(payload);

  const leadId = safeString(payload.leadId, 80);
  if (!leadId) return json({ ok: false, error: 'Falta leadId para actualizar.' }, 400, request);

  const now = new Date().toISOString();
  const updatedAt = safeString(payload.updatedAt, 40) || now;
  const name = safeString(contact.name, 120);
  const preferredChannel = safeString(contact.preferredChannel, 30);
  const email = safeString(contact.email, 180);
  const whatsapp = safeString(contact.whatsapp, 80);
  const recommendedTier = safeString(diagnosis.recommendedTier, 80);
  const recommendedPreset = safeString(diagnosis.recommendedPreset, 40);
  const totalScore = Number(diagnosis.totalScore || 0);
  const estimatedTotal = Number(configuration.estimatedTotal || 0);
  const currency = safeString(configuration.currency, 10) || 'ARS';
  const ip = safeString(request.headers.get('CF-Connecting-IP'), 80);
  const country = safeString(request.cf && request.cf.country, 10);
  const requestInfo = { ip, country };

  let existing;
  try {
    existing = await env.LEADS_DB.prepare(`
      SELECT odoo_lead_id
      FROM leads
      WHERE lead_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).bind(leadId).first();
  } catch (err) {
    console.error('[PrimOffice Leads API] Error buscando lead en D1:', err);
    return json({ ok: false, error: 'No se pudo buscar el lead para actualizar.' }, 500, request);
  }

  if (!existing) {
    return json({ ok: false, error: 'No existe un lead previo con ese leadId.' }, 404, request);
  }

  const odooLeadId = Number(payload.odooLeadId || existing.odoo_lead_id || 0);
  let odooResult = { ok: false, skipped: true, error: 'No ejecutado.' };

  try {
    odooResult = await updateOdooLead({ ...payload, updatedAt }, env, requestInfo, odooLeadId);
  } catch (err) {
    const message = safeString(err && err.message ? err.message : err, 1000);
    odooResult = { ok: false, error: message };
    console.error('[PrimOffice Leads API] Error actualizando Odoo:', err);
  }

  try {
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET name = ?, preferred_channel = ?, email = ?, whatsapp = ?,
          recommended_tier = ?, recommended_preset = ?, total_score = ?,
          estimated_total = ?, currency = ?, products_json = ?, payload_json = ?,
          odoo_status = ?, odoo_lead_id = COALESCE(?, odoo_lead_id),
          odoo_error = ?, odoo_synced_at = ?
      WHERE lead_id = ?
    `).bind(
      name,
      preferredChannel,
      email,
      whatsapp,
      recommendedTier,
      recommendedPreset,
      Number.isFinite(totalScore) ? totalScore : 0,
      Number.isFinite(estimatedTotal) ? estimatedTotal : 0,
      currency,
      safeJson(products),
      safeJson({ ...payload, updatedAt }),
      odooResult.ok ? 'synced' : (odooResult.skipped ? 'pending' : 'error'),
      odooResult.id || null,
      odooResult.ok ? null : safeString(odooResult.error, 1000),
      odooResult.ok ? now : null,
      leadId
    ).run();
  } catch (err) {
    console.error('[PrimOffice Leads API] Error actualizando D1:', err);
    return json({ ok: false, error: 'No se pudo actualizar el lead en D1.' }, 500, request);
  }

  return json({
    ok: true,
    mode: 'real',
    stored: true,
    updated: true,
    leadId,
    odoo: {
      enabled: odooEnabled(env),
      synced: !!odooResult.ok,
      id: odooResult.id || odooLeadId || null,
      error: odooResult.ok ? null : (odooResult.error || null)
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

  payload = normalizePayloadContact(payload);
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
