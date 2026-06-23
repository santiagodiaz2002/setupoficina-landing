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

const PRIMOFFICE_ORIGIN_TAG = 'Test - Landing';
const PRIMOFFICE_TIER_TAGS = Object.freeze(['Setup Starter', 'Setup Pro', 'Setup Epic']);
const PRIMOFFICE_CHANNEL_TAGS = Object.freeze(['WhatsApp', 'Email']);
const PRIMOFFICE_MANAGED_TAG_NAMES = Object.freeze([
  PRIMOFFICE_ORIGIN_TAG,
  ...PRIMOFFICE_TIER_TAGS,
  ...PRIMOFFICE_CHANNEL_TAGS
]);

function normalizeTierKey(value) {
  return safeString(value, 80)
    .replace(/\s+/g, ' ')
    .replace(/^setup\s+/i, '')
    .trim()
    .toLowerCase();
}

function tierFromScore(score) {
  const totalScore = Number(score);
  if (!Number.isFinite(totalScore)) return '';
  if (totalScore <= 8) return 'Setup Starter';
  if (totalScore <= 13) return 'Setup Pro';
  return 'Setup Epic';
}

function normalizeRecommendedTierValue(value, totalScore) {
  const raw = safeString(value, 80);
  const key = normalizeTierKey(raw);

  if (!key) return { value: tierFromScore(totalScore) };
  if (key === 'starter') return { value: 'Setup Starter' };
  if (key === 'pro') return { value: 'Setup Pro' };
  if (key === 'epic') return { value: 'Setup Epic' };

  return { error: `Nivel recomendado invalido: ${raw}.` };
}

function normalizeRecommendedTier(value, totalScore) {
  const result = normalizeRecommendedTierValue(value, totalScore);
  return result.error ? '' : result.value;
}

function presetFromTier(tier) {
  const key = normalizeTierKey(tier);
  if (key === 'starter') return 'starter';
  if (key === 'pro') return 'pro';
  if (key === 'epic') return 'epic';
  return '';
}

function normalizeRecommendedPresetValue(value, tier) {
  const raw = safeString(value, 40);
  const key = normalizeTierKey(raw);

  if (!key) return { value: presetFromTier(tier) };
  if (key === 'starter') return { value: 'starter' };
  if (key === 'pro') return { value: 'pro' };
  if (key === 'epic') return { value: 'epic' };

  return { error: `Preset recomendado invalido: ${raw}.` };
}

function channelTag(value) {
  const channel = safeString(value, 30).toLowerCase();
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'email') return 'Email';
  return '';
}

function normalizePayloadContact(payload) {
  const normalized = { ...(payload || {}) };
  const contact = { ...((payload && payload.contact) || {}) };
  contact.whatsapp = normalizeArgentinaPhone(contact.whatsapp);
  normalized.contact = contact;
  return normalized;
}

function normalizeLeadPayload(payload) {
  const normalized = normalizePayloadContact(payload);
  const diagnosis = { ...((normalized && normalized.diagnosis) || {}) };
  const tierResult = normalizeRecommendedTierValue(diagnosis.recommendedTier, diagnosis.totalScore);
  if (tierResult.error) return { error: tierResult.error, status: 400 };

  const tier = tierResult.value;
  const presetResult = normalizeRecommendedPresetValue(diagnosis.recommendedPreset, tier);
  if (presetResult.error) return { error: presetResult.error, status: 400 };

  const preset = presetResult.value;
  const expectedPreset = presetFromTier(tier);
  if (preset && expectedPreset && preset !== expectedPreset) {
    return {
      error: `Preset recomendado incompatible con el nivel normalizado: ${preset}.`,
      status: 400
    };
  }

  if (tier) diagnosis.recommendedTier = tier;
  if (preset) diagnosis.recommendedPreset = preset;

  normalized.diagnosis = diagnosis;
  return { payload: normalized };
}

function getLeadTagNames(payload) {
  const contact = (payload && payload.contact) || {};
  const diagnosis = (payload && payload.diagnosis) || {};

  const tier = normalizeRecommendedTier(diagnosis.recommendedTier, diagnosis.totalScore);

  return [...new Set([
    PRIMOFFICE_ORIGIN_TAG,
    tier,
    channelTag(contact.preferredChannel)
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

function findXmlElement(xml, tag, fromIndex = 0) {
  const source = String(xml || '');
  const pattern = new RegExp(`<\\/?${tag}(?:\\s[^>]*)?>`, 'ig');
  pattern.lastIndex = fromIndex;

  let match;
  while ((match = pattern.exec(source))) {
    if (match[0][1] === '/') continue;

    const start = match.index;
    const openEnd = pattern.lastIndex;
    let depth = 1;

    while ((match = pattern.exec(source))) {
      depth += match[0][1] === '/' ? -1 : 1;

      if (depth === 0) {
        return {
          start,
          end: pattern.lastIndex,
          inner: source.slice(openEnd, match.index),
          whole: source.slice(start, pattern.lastIndex)
        };
      }
    }

    return null;
  }

  return null;
}

function getXmlElements(xml, tag) {
  const elements = [];
  let cursor = 0;
  let element;

  while ((element = findXmlElement(xml, tag, cursor))) {
    elements.push(element);
    cursor = element.end;
  }

  return elements;
}

function isWholeXmlElement(element, xml) {
  return Boolean(element && element.whole.trim() === String(xml || '').trim());
}

function parseXmlRpcTypedValue(xml) {
  const trimmed = String(xml || '').trim();
  const valueElement = findXmlElement(trimmed, 'value');
  if (isWholeXmlElement(valueElement, trimmed)) return parseXmlRpcTypedValue(valueElement.inner);

  const arrayElement = findXmlElement(trimmed, 'array');
  if (isWholeXmlElement(arrayElement, trimmed)) {
    const dataElement = findXmlElement(arrayElement.inner, 'data');
    const dataXml = dataElement ? dataElement.inner : arrayElement.inner;
    return getXmlElements(dataXml, 'value').map((item) => parseXmlRpcTypedValue(item.whole));
  }

  const structElement = findXmlElement(trimmed, 'struct');
  if (isWholeXmlElement(structElement, trimmed)) {
    const out = {};

    getXmlElements(structElement.inner, 'member').forEach((member) => {
      const nameElement = findXmlElement(member.inner, 'name');
      const memberValue = findXmlElement(member.inner, 'value');
      if (!nameElement) return;
      out[decodeXml(nameElement.inner)] = memberValue ? parseXmlRpcTypedValue(memberValue.whole) : '';
    });

    return out;
  }

  const intElement = findXmlElement(trimmed, 'int') || findXmlElement(trimmed, 'i4');
  if (isWholeXmlElement(intElement, trimmed)) return Number(intElement.inner);

  const doubleElement = findXmlElement(trimmed, 'double');
  if (isWholeXmlElement(doubleElement, trimmed)) return Number(doubleElement.inner);

  const boolElement = findXmlElement(trimmed, 'boolean');
  if (isWholeXmlElement(boolElement, trimmed)) return boolElement.inner === '1';

  const stringElement = findXmlElement(trimmed, 'string');
  if (isWholeXmlElement(stringElement, trimmed)) return decodeXml(stringElement.inner);

  if (/^<nil\s*\/>$/i.test(trimmed)) return null;

  const raw = trimmed.replace(/<[^>]+>/g, '').trim();
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return decodeXml(raw);
}

function parseXmlRpcValue(xml) {
  const valueElement = findXmlElement(xml, 'value');
  return parseXmlRpcTypedValue(valueElement ? valueElement.whole : xml);
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
  const tier = normalizeRecommendedTier(diagnosis.recommendedTier, diagnosis.totalScore);

  const estimatedTotal = Number(configuration.estimatedTotal || 0);
  const currency = safeString(configuration.currency, 10) || 'ARS';

  const eventType = safeString(payload.eventType, 80);
  const eventLabel = eventType === 'whatsapp_click'
  ? 'Selección final confirmada'
  : (eventType === 'cart_change'
      ? 'Selección actualizada'
      : 'Diagnóstico recibido');
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
    `<p><strong>Recomendación:</strong> ${htmlEscape(tier || '-')}<br>`,
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

function uniqueNumberIds(ids) {
  return [...new Set((ids || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0))];
}

async function findNamedRecordId(session, model, name) {
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
    return Number(found[0]) || null;
  }

  return null;
}

async function findOrCreateNamedRecord(session, model, name) {
  const cleanName = safeString(name, 120);
  if (!cleanName) return null;

  const found = await findNamedRecordId(session, model, cleanName);
  if (found) return found;

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
      return Number(retry[0]) || null;
    }

    throw error;
  }
}

async function resolveRequiredLeadTags(session, payload) {
  const tagNames = getLeadTagNames(payload);

  if (tagNames.length !== 3) {
    throw new Error(`No se pudieron determinar las tres etiquetas requeridas del lead: ${tagNames.join(', ') || 'sin etiquetas'}.`);
  }

  const tagIdsByName = {};

  for (const tagName of tagNames) {
    let tagId;

    try {
      tagId = await findOrCreateNamedRecord(session, 'crm.tag', tagName);
    } catch (error) {
      const detail = safeString(error && error.message ? error.message : error, 300);
      throw new Error(`No se pudo resolver la etiqueta de Odoo "${tagName}": ${detail || 'error desconocido'}.`);
    }

    if (!tagId) {
      throw new Error(`No se pudo resolver la etiqueta de Odoo "${tagName}".`);
    }

    tagIdsByName[tagName] = tagId;
  }

  const tagIds = uniqueNumberIds(Object.values(tagIdsByName));
  if (tagIds.length !== tagNames.length) {
    throw new Error(`No se pudieron resolver las tres etiquetas requeridas del lead: ${tagNames.join(', ')}.`);
  }

  return {
    tagNames,
    tagIdsByName,
    tagIds
  };
}

async function resolveManagedLeadTagIds(session, knownTagIdsByName = {}) {
  const tagIdsByName = { ...knownTagIdsByName };

  for (const tagName of PRIMOFFICE_MANAGED_TAG_NAMES) {
    if (tagIdsByName[tagName]) continue;

    try {
      const tagId = await findNamedRecordId(session, 'crm.tag', tagName);
      if (tagId) tagIdsByName[tagName] = tagId;
    } catch (error) {
      const detail = safeString(error && error.message ? error.message : error, 300);
      throw new Error(`No se pudo revisar la etiqueta administrada de Odoo "${tagName}": ${detail || 'error desconocido'}.`);
    }
  }

  return uniqueNumberIds(Object.values(tagIdsByName));
}

async function readOdooLeadTagIds(session, odooLeadId) {
  const id = Number(odooLeadId || 0);
  if (!id || !Number.isFinite(id)) return [];

  const records = await odooExecuteKw(
    session,
    'crm.lead',
    'read',
    [[id]],
    { fields: ['tag_ids'] }
  );

  const record = Array.isArray(records) ? records[0] : null;
  if (!record || typeof record !== 'object') {
    throw new Error(`No se pudieron leer las etiquetas actuales del lead Odoo ${id}.`);
  }

  return uniqueNumberIds(record.tag_ids);
}

async function buildOdooTagCommand(payload, session, odooLeadId = null) {
  const required = await resolveRequiredLeadTags(session, payload);

  if (!odooLeadId) {
    return [[6, 0, required.tagIds]];
  }

  const currentTagIds = await readOdooLeadTagIds(session, odooLeadId);
  const managedTagIds = new Set(await resolveManagedLeadTagIds(session, required.tagIdsByName));
  const externalTagIds = currentTagIds.filter((id) => !managedTagIds.has(id));
  const finalTagIds = uniqueNumberIds([...externalTagIds, ...required.tagIds]);

  return [[6, 0, finalTagIds]];
}

async function buildOdooLead(payload, requestInfo, session, options = {}) {
  const contact = payload.contact || {};
  const diagnosis = payload.diagnosis || {};
  const configuration = payload.configuration || {};

  const name = safeString(contact.name, 120);
  const tier = normalizeRecommendedTier(diagnosis.recommendedTier, diagnosis.totalScore) || 'Setup recomendado';
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

  fields.tag_ids = await buildOdooTagCommand(payload, session, options.odooLeadId);

  return fields;
}

function odooD1State(odooResult, fallbackOdooLeadId = null, syncedAt = '') {
  const result = odooResult || {};

  if (result.ok) {
    return {
      status: 'synced',
      id: result.id || fallbackOdooLeadId || null,
      error: null,
      syncedAt: syncedAt || new Date().toISOString()
    };
  }

  if (result.skipped) {
    return {
      status: 'pending',
      id: fallbackOdooLeadId || null,
      error: safeString(result.error || 'Sincronizacion con Odoo omitida.', 1000),
      syncedAt: null
    };
  }

  return {
    status: 'error',
    id: result.id || fallbackOdooLeadId || null,
    error: safeString(result.error || 'Error sincronizando con Odoo.', 1000),
    syncedAt: null
  };
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
  const id = Number(odooLeadId || 0);
  if (!id || !Number.isFinite(id)) return { ok: false, skipped: true, error: 'No hay odooLeadId para actualizar.' };

  const session = await getOdooSession(env);
  if (!session.ok) return session;

  const fields = await buildOdooLead(payload, requestInfo, session, { odooLeadId: id });
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

  const normalized = normalizeLeadPayload(payload);
  if (normalized.error) return normalized;

  return normalized;
}

export async function onRequestPatch({ request, env }) {
  if (!env.LEADS_DB) {
    return json({ ok: false, error: 'D1 binding LEADS_DB no configurado.' }, 500, request);
  }

  const parsed = await readValidatedPayload(request);
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status || 400, request);

  const payload = parsed.payload;
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

  const odooLeadId = Number(existing.odoo_lead_id || 0);
  let odooResult = { ok: false, skipped: true, error: 'No ejecutado.' };

  try {
    odooResult = await updateOdooLead({ ...payload, updatedAt }, env, requestInfo, odooLeadId);
  } catch (err) {
    const message = safeString(err && err.message ? err.message : err, 1000);
    odooResult = { ok: false, error: message };
    console.error('[PrimOffice Leads API] Error actualizando Odoo:', err);
  }

  const odooState = odooD1State(odooResult, odooLeadId, now);

  try {
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET name = ?, preferred_channel = ?, email = ?, whatsapp = ?,
          recommended_tier = ?, recommended_preset = ?, total_score = ?,
          estimated_total = ?, currency = ?, products_json = ?, payload_json = ?,
          odoo_status = ?, odoo_lead_id = ?,
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
      odooState.status,
      odooState.id,
      odooState.error,
      odooState.syncedAt,
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
      id: odooState.id,
      error: odooState.error
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

  const normalized = normalizeLeadPayload(payload);
  if (normalized.error) return json({ ok: false, error: normalized.error }, normalized.status || 400, request);

  payload = normalized.payload;
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

    const odooState = odooD1State(odooResult, null, new Date().toISOString());
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET odoo_status = ?, odoo_lead_id = ?, odoo_error = ?, odoo_synced_at = ?
      WHERE lead_id = ?
    `).bind(
      odooState.status,
      odooState.id,
      odooState.error,
      odooState.syncedAt,
      leadId
    ).run();
  } catch (err) {
    const message = safeString(err && err.message ? err.message : err, 1000);
    odooResult = { ok: false, error: message };
    const odooState = odooD1State(odooResult, null, null);

    console.error('[PrimOffice Leads API] Error enviando a Odoo:', err);
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET odoo_status = ?, odoo_lead_id = ?, odoo_error = ?, odoo_synced_at = ?
      WHERE lead_id = ?
    `).bind(
      odooState.status,
      odooState.id,
      odooState.error,
      odooState.syncedAt,
      leadId
    ).run();
  }

  const responseOdooState = odooD1State(odooResult, null, null);

  return json({
    ok: true,
    mode: 'real',
    stored: true,
    leadId,
    odoo: {
      enabled: odooEnabled(env),
      synced: !!odooResult.ok,
      id: responseOdooState.id,
      error: responseOdooState.error
    }
  }, 201, request);
}
