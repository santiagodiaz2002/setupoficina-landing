// Esta Pages Function atiende la API de leads y es consumida por el servicio de leads del frontend.
// Los métodos de lectura, creación, actualización y negociación CORS comparten serialización y validaciones defensivas.
// D1 conserva el lead y el estado de sincronización; Odoo se integra por XML RPC después de validar y normalizar el payload.
// CORS decide qué origen de navegador puede leer la respuesta, pero este archivo no implementa autenticación ni rate limiting.
// Si falta un bloque de validación, persistencia o traducción de errores, el flujo puede aceptar datos incoherentes o perder trazabilidad entre D1 y Odoo.
// Calcula y conserva un dato inmutable dentro de este alcance.
const ALLOWED_ORIGINS = new Set([
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  'https://setupoficina.com.ar',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  'https://www.setupoficina.com.ar',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  'https://setupoficina-landing.pages.dev',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  'http://127.0.0.1:5500',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  'http://localhost:5500'
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
]);

// Construye encabezados CORS y refleja solo un origen conocido; el valor de respaldo no autentica al solicitante.
function corsHeaders(request) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const origin = request.headers.get('Origin') || '';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://setupoficina.com.ar';
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'Access-Control-Allow-Origin': allowOrigin,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'Vary': 'Origin'
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Serializa una respuesta JSON y adjunta CORS cuando dispone de la petición original.
function json(data, status = 200, request) {
// Construye una respuesta HTTP explícita con estado, cuerpo y encabezados controlados.
  return new Response(JSON.stringify(data), {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    status,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    headers: {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      'Content-Type': 'application/json; charset=utf-8',
// Copia propiedades existentes para crear una nueva representación sin mutar el origen.
      ...(request ? corsHeaders(request) : {})
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  });
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Convierte un valor en texto recortado y limita su longitud antes de persistirlo o mostrarlo.
function safeString(value, max = 500) {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (value === null || value === undefined) return '';
// Entrega el valor ya procesado y termina esta rama.
  return String(value).trim().slice(0, max);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Serializa datos defensivamente y usa un nulo representable cuando aparece una estructura no serializable.
function safeJson(value) {
// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try { return JSON.stringify(value || null); }
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  catch (_) { return 'null'; }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Escapa caracteres con significado HTML antes de formar descripciones enriquecidas.
function htmlEscape(value) {
// Entrega el valor ya procesado y termina esta rama.
  return String(value ?? '')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/&/g, '&amp;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/</g, '&lt;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/>/g, '&gt;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/"/g, '&quot;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/'/g, '&#39;');
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Canoniza teléfonos argentinos cuando reconoce formas habituales y conserva con cautela otros números plausibles.
function normalizeArgentinaPhone(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const raw = safeString(value, 80);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!raw) return '';

// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let digits = raw.replace(/\D/g, '');
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!digits) return '';
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.startsWith('00')) digits = digits.slice(2);

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.startsWith('549') && digits.length === 13) {
// Entrega el valor ya procesado y termina esta rama.
    return `+${digits}`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.startsWith('54')) {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    digits = digits.slice(2);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.startsWith('0')) {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    digits = digits.slice(1);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

  // Formato local frecuente en AMBA: 011 15 xxxx xxxx.
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.startsWith('1115') && digits.length === 12) {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    digits = `11${digits.slice(4)}`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.startsWith('9') && digits.length === 11) {
// Entrega el valor ya procesado y termina esta rama.
    return `+54${digits}`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.length === 10) {
// Entrega el valor ya procesado y termina esta rama.
    return `+549${digits}`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

  // Fallback conservador: conserva números internacionales válidos.
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (digits.length >= 11 && digits.length <= 15) {
// Entrega el valor ya procesado y termina esta rama.
    return `+${digits}`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return raw;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Calcula y conserva un dato inmutable dentro de este alcance.
const PRIMOFFICE_ORIGIN_TAG = 'Test - Landing';
// Calcula y conserva un dato inmutable dentro de este alcance.
const PRIMOFFICE_TIER_TAGS = Object.freeze(['Setup Starter', 'Setup Pro', 'Setup Epic']);
// Calcula y conserva un dato inmutable dentro de este alcance.
const PRIMOFFICE_CHANNEL_TAGS = Object.freeze(['WhatsApp', 'Email']);
// Calcula y conserva un dato inmutable dentro de este alcance.
const PRIMOFFICE_MANAGED_TAG_NAMES = Object.freeze([
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  PRIMOFFICE_ORIGIN_TAG,
// Copia propiedades existentes para crear una nueva representación sin mutar el origen.
  ...PRIMOFFICE_TIER_TAGS,
// Copia propiedades existentes para crear una nueva representación sin mutar el origen.
  ...PRIMOFFICE_CHANNEL_TAGS
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
]);

// Reduce distintas formas del nivel recomendado a una clave comparable.
function normalizeTierKey(value) {
// Entrega el valor ya procesado y termina esta rama.
  return safeString(value, 80)
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/\s+/g, ' ')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/^setup\s+/i, '')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .trim()
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .toLowerCase();
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Deriva el nivel comercial a partir de un puntaje numérico finito.
function tierFromScore(score) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const totalScore = Number(score);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!Number.isFinite(totalScore)) return '';
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (totalScore <= 8) return 'Setup Starter';
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (totalScore <= 13) return 'Setup Pro';
// Entrega el valor ya procesado y termina esta rama.
  return 'Setup Epic';
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Valida el nivel recibido o lo deriva del puntaje y devuelve error explícito ante valores desconocidos.
function normalizeRecommendedTierValue(value, totalScore) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const raw = safeString(value, 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const key = normalizeTierKey(raw);

// Deriva el nivel comercial a partir de un puntaje numérico finito.
  if (!key) return { value: tierFromScore(totalScore) };
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'starter') return { value: 'Setup Starter' };
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'pro') return { value: 'Setup Pro' };
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'epic') return { value: 'Setup Epic' };

// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return { error: `Nivel recomendado invalido: ${raw}.` };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Ofrece la versión tolerante de la normalización para consumidores que necesitan texto o vacío.
function normalizeRecommendedTier(value, totalScore) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const result = normalizeRecommendedTierValue(value, totalScore);
// Entrega el valor ya procesado y termina esta rama.
  return result.error ? '' : result.value;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Relaciona cada nivel normalizado con el preset interno correspondiente.
function presetFromTier(tier) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const key = normalizeTierKey(tier);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'starter') return 'starter';
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'pro') return 'pro';
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'epic') return 'epic';
// Entrega el valor ya procesado y termina esta rama.
  return '';
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Valida el preset o lo deriva del nivel para mantener coherencia entre ambos campos.
function normalizeRecommendedPresetValue(value, tier) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const raw = safeString(value, 40);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const key = normalizeTierKey(raw);

// Relaciona cada nivel normalizado con el preset interno correspondiente.
  if (!key) return { value: presetFromTier(tier) };
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'starter') return { value: 'starter' };
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'pro') return { value: 'pro' };
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (key === 'epic') return { value: 'epic' };

// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return { error: `Preset recomendado invalido: ${raw}.` };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Traduce el canal preferido a la etiqueta administrada que se aplicará en Odoo.
function channelTag(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const channel = safeString(value, 30).toLowerCase();
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (channel === 'whatsapp') return 'WhatsApp';
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (channel === 'email') return 'Email';
// Entrega el valor ya procesado y termina esta rama.
  return '';
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Clona el payload y normaliza el teléfono sin mutar el objeto recibido.
function normalizePayloadContact(payload) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const normalized = { ...(payload || {}) };
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contact = { ...((payload && payload.contact) || {}) };
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  contact.whatsapp = normalizeArgentinaPhone(contact.whatsapp);
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  normalized.contact = contact;
// Entrega el valor ya procesado y termina esta rama.
  return normalized;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Normaliza contacto, nivel y preset, y rechaza combinaciones comerciales incompatibles.
function normalizeLeadPayload(payload) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const normalized = normalizePayloadContact(payload);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosis = { ...((normalized && normalized.diagnosis) || {}) };
// Calcula y conserva un dato inmutable dentro de este alcance.
  const tierResult = normalizeRecommendedTierValue(diagnosis.recommendedTier, diagnosis.totalScore);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (tierResult.error) return { error: tierResult.error, status: 400 };

// Calcula y conserva un dato inmutable dentro de este alcance.
  const tier = tierResult.value;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const presetResult = normalizeRecommendedPresetValue(diagnosis.recommendedPreset, tier);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (presetResult.error) return { error: presetResult.error, status: 400 };

// Calcula y conserva un dato inmutable dentro de este alcance.
  const preset = presetResult.value;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const expectedPreset = presetFromTier(tier);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (preset && expectedPreset && preset !== expectedPreset) {
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
    return {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      error: `Preset recomendado incompatible con el nivel normalizado: ${preset}.`,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      status: 400
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (tier) diagnosis.recommendedTier = tier;
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (preset) diagnosis.recommendedPreset = preset;

// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  normalized.diagnosis = diagnosis;
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return { payload: normalized };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Compone el conjunto deduplicado de etiquetas administradas según origen, nivel y canal.
function getLeadTagNames(payload) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contact = (payload && payload.contact) || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosis = (payload && payload.diagnosis) || {};

// Calcula y conserva un dato inmutable dentro de este alcance.
  const tier = normalizeRecommendedTier(diagnosis.recommendedTier, diagnosis.totalScore);

// Entrega el valor ya procesado y termina esta rama.
  return [...new Set([
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    PRIMOFFICE_ORIGIN_TAG,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    tier,
// Traduce el canal preferido a la etiqueta administrada que se aplicará en Odoo.
    channelTag(contact.preferredChannel)
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  ].filter(Boolean))];
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Extrae las tres colecciones de productos sin asumir que el cliente envió arreglos válidos.
function pickProducts(payload) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const cfg = payload && payload.configuration ? payload.configuration : {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const selected = Array.isArray(cfg.selectedProducts) ? cfg.selectedProducts : [];
// Calcula y conserva un dato inmutable dentro de este alcance.
  const extras = Array.isArray(cfg.selectedExtras) ? cfg.selectedExtras : [];
// Calcula y conserva un dato inmutable dentro de este alcance.
  const recommended = Array.isArray(cfg.recommendedProducts) ? cfg.recommendedProducts : [];
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return { selected, extras, recommended };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Comprueba identidad, consentimiento, canal, dato de contacto y puntaje antes de cualquier escritura.
function validatePayload(payload) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contact = payload && payload.contact ? payload.contact : {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosis = payload && payload.diagnosis ? payload.diagnosis : {};

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!payload || typeof payload !== 'object') return 'Payload invalido.';
// Convierte un valor en texto recortado y limita su longitud antes de persistirlo o mostrarlo.
  if (!safeString(contact.name, 120)) return 'Falta el nombre del contacto.';
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!contact.consent) return 'Falta el consentimiento del contacto.';

// Calcula y conserva un dato inmutable dentro de este alcance.
  const channel = safeString(contact.preferredChannel, 30);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!['email', 'whatsapp'].includes(channel)) return 'Canal de contacto invalido.';

// Convierte un valor en texto recortado y limita su longitud antes de persistirlo o mostrarlo.
  if (channel === 'email' && !safeString(contact.email, 180)) return 'Falta el email.';
// Convierte un valor en texto recortado y limita su longitud antes de persistirlo o mostrarlo.
  if (channel === 'whatsapp' && !safeString(contact.whatsapp, 80)) return 'Falta el WhatsApp.';

// Calcula y conserva un dato inmutable dentro de este alcance.
  const totalScore = Number(diagnosis.totalScore);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!Number.isFinite(totalScore)) return 'Falta el puntaje del diagnostico.';

// Entrega el valor ya procesado y termina esta rama.
  return '';
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Interpreta la bandera explícita que permite intentar la sincronización externa.
function odooEnabled(env) {
// Entrega el valor ya procesado y termina esta rama.
  return String(env.ODOO_ENABLED || '').toLowerCase() === 'true';
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Comprueba que estén presentes todas las credenciales y coordenadas necesarias del servicio externo.
function odooConfigured(env) {
// Entrega el valor ya procesado y termina esta rama.
  return Boolean(env.ODOO_URL && env.ODOO_DB && env.ODOO_USERNAME && env.ODOO_API_KEY);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Normaliza la base del servidor remoto para concatenar rutas sin barras duplicadas.
function cleanOdooUrl(value) {
// Entrega el valor ya procesado y termina esta rama.
  return safeString(value, 300).replace(/\/+$/, '');
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Escapa texto que se insertará en XML y evita alterar la estructura del mensaje.
function xmlEscape(value) {
// Entrega el valor ya procesado y termina esta rama.
  return String(value)
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/&/g, '&amp;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/</g, '&lt;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/>/g, '&gt;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/"/g, '&quot;')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/'/g, '&apos;');
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Codifica valores de JavaScript en las formas tipadas aceptadas por XML RPC.
function xmlValue(value) {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (Array.isArray(value)) {
// Entrega el valor ya procesado y termina esta rama.
    return `<value><array><data>${value.map(xmlValue).join('')}</data></array></value>`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (value && typeof value === 'object') {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const members = Object.entries(value).map(([key, val]) => {
// Entrega el valor ya procesado y termina esta rama.
      return `<member><name>${xmlEscape(key)}</name>${xmlValue(val)}</member>`;
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    }).join('');
// Entrega el valor ya procesado y termina esta rama.
    return `<value><struct>${members}</struct></value>`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (typeof value === 'number' && Number.isInteger(value)) {
// Entrega el valor ya procesado y termina esta rama.
    return `<value><int>${value}</int></value>`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (typeof value === 'number' && Number.isFinite(value)) {
// Entrega el valor ya procesado y termina esta rama.
    return `<value><double>${value}</double></value>`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (typeof value === 'boolean') {
// Entrega el valor ya procesado y termina esta rama.
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return `<value><string>${xmlEscape(value ?? '')}</string></value>`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Revierte entidades XML conocidas después de aislar el contenido textual.
function decodeXml(value) {
// Entrega el valor ya procesado y termina esta rama.
  return String(value)
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/&lt;/g, '<')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/&gt;/g, '>')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/&quot;/g, '"')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/&apos;/g, "'")
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/&amp;/g, '&');
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Obtiene el contenido de una etiqueta simple sin exponer el resto del documento.
function getTag(xml, tag) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const match = xml.match(re);
// Entrega el valor ya procesado y termina esta rama.
  return match ? match[1] : '';
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Localiza un elemento XML completo respetando anidamiento y devuelve sus límites.
function findXmlElement(xml, tag, fromIndex = 0) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const source = String(xml || '');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const pattern = new RegExp(`<\\/?${tag}(?:\\s[^>]*)?>`, 'ig');
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  pattern.lastIndex = fromIndex;

// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let match;
// Recorre una colección o fragmento de entrada con límites definidos por el dato recibido.
  while ((match = pattern.exec(source))) {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
    if (match[0][1] === '/') continue;

// Calcula y conserva un dato inmutable dentro de este alcance.
    const start = match.index;
// Calcula y conserva un dato inmutable dentro de este alcance.
    const openEnd = pattern.lastIndex;
// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
    let depth = 1;

// Recorre una colección o fragmento de entrada con límites definidos por el dato recibido.
    while ((match = pattern.exec(source))) {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      depth += match[0][1] === '/' ? -1 : 1;

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
      if (depth === 0) {
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
        return {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
          start,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
          end: pattern.lastIndex,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
          inner: source.slice(openEnd, match.index),
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
          whole: source.slice(start, pattern.lastIndex)
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
        };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
      }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }

// Entrega el valor ya procesado y termina esta rama.
    return null;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return null;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Recorre el documento y reúne todas las apariciones completas de una etiqueta.
function getXmlElements(xml, tag) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const elements = [];
// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let cursor = 0;
// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let element;

// Localiza un elemento XML completo respetando anidamiento y devuelve sus límites.
  while ((element = findXmlElement(xml, tag, cursor))) {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    elements.push(element);
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    cursor = element.end;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return elements;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Verifica que un fragmento represente un elemento completo y no texto parcial.
function isWholeXmlElement(element, xml) {
// Entrega el valor ya procesado y termina esta rama.
  return Boolean(element && element.whole.trim() === String(xml || '').trim());
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Convierte un valor tipado del protocolo en número, booleano, arreglo, estructura o texto.
function parseXmlRpcTypedValue(xml) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const trimmed = String(xml || '').trim();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const valueElement = findXmlElement(trimmed, 'value');
// Verifica que un fragmento represente un elemento completo y no texto parcial.
  if (isWholeXmlElement(valueElement, trimmed)) return parseXmlRpcTypedValue(valueElement.inner);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const arrayElement = findXmlElement(trimmed, 'array');
// Verifica que un fragmento represente un elemento completo y no texto parcial.
  if (isWholeXmlElement(arrayElement, trimmed)) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const dataElement = findXmlElement(arrayElement.inner, 'data');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const dataXml = dataElement ? dataElement.inner : arrayElement.inner;
// Entrega el valor ya procesado y termina esta rama.
    return getXmlElements(dataXml, 'value').map((item) => parseXmlRpcTypedValue(item.whole));
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const structElement = findXmlElement(trimmed, 'struct');
// Verifica que un fragmento represente un elemento completo y no texto parcial.
  if (isWholeXmlElement(structElement, trimmed)) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const out = {};

// Recorre el documento y reúne todas las apariciones completas de una etiqueta.
    getXmlElements(structElement.inner, 'member').forEach((member) => {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const nameElement = findXmlElement(member.inner, 'name');
// Calcula y conserva un dato inmutable dentro de este alcance.
      const memberValue = findXmlElement(member.inner, 'value');
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
      if (!nameElement) return;
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      out[decodeXml(nameElement.inner)] = memberValue ? parseXmlRpcTypedValue(memberValue.whole) : '';
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    });

// Entrega el valor ya procesado y termina esta rama.
    return out;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const intElement = findXmlElement(trimmed, 'int') || findXmlElement(trimmed, 'i4');
// Verifica que un fragmento represente un elemento completo y no texto parcial.
  if (isWholeXmlElement(intElement, trimmed)) return Number(intElement.inner);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const doubleElement = findXmlElement(trimmed, 'double');
// Verifica que un fragmento represente un elemento completo y no texto parcial.
  if (isWholeXmlElement(doubleElement, trimmed)) return Number(doubleElement.inner);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const boolElement = findXmlElement(trimmed, 'boolean');
// Verifica que un fragmento represente un elemento completo y no texto parcial.
  if (isWholeXmlElement(boolElement, trimmed)) return boolElement.inner === '1';

// Calcula y conserva un dato inmutable dentro de este alcance.
  const stringElement = findXmlElement(trimmed, 'string');
// Revierte entidades XML conocidas después de aislar el contenido textual.
  if (isWholeXmlElement(stringElement, trimmed)) return decodeXml(stringElement.inner);

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (/^<nil\s*\/>$/i.test(trimmed)) return null;

// Calcula y conserva un dato inmutable dentro de este alcance.
  const raw = trimmed.replace(/<[^>]+>/g, '').trim();
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (/^-?\d+$/.test(raw)) return Number(raw);
// Entrega el valor ya procesado y termina esta rama.
  return decodeXml(raw);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Extrae el nodo de valor y delega la conversión según su tipo XML.
function parseXmlRpcValue(xml) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const valueElement = findXmlElement(xml, 'value');
// Entrega el valor ya procesado y termina esta rama.
  return parseXmlRpcTypedValue(valueElement ? valueElement.whole : xml);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Construye la llamada XML RPC, impone tiempo máximo, ejecuta la red y traduce fallos del protocolo.
async function xmlRpcCall(endpoint, methodName, params, timeoutMs = 15000) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const body = `<?xml version="1.0"?>\n<methodCall><methodName>${xmlEscape(methodName)}</methodName><params>${params.map((param) => `<param>${xmlValue(param)}</param>`).join('')}</params></methodCall>`;

// Calcula y conserva un dato inmutable dentro de este alcance.
  const controller = new AbortController();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const resp = await fetch(endpoint, {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      method: 'POST',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      headers: { 'Content-Type': 'text/xml' },
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      body,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      signal: controller.signal
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    });

// Calcula y conserva un dato inmutable dentro de este alcance.
    const text = await resp.text();
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
    if (!resp.ok) throw new Error(`Odoo HTTP ${resp.status}: ${text.slice(0, 300)}`);

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
    if (/<fault>/i.test(text)) {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const faultString = getTag(text, 'string') || text.replace(/<[^>]+>/g, ' ').trim();
// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
      throw new Error(`Odoo fault: ${decodeXml(faultString).slice(0, 500)}`);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }

// Entrega el valor ya procesado y termina esta rama.
    return parseXmlRpcValue(getTag(text, 'param') || text);
// Libera recursos temporales incluso si la llamada anterior produjo una excepción.
  } finally {
// Cancela el temporizador una vez que la red terminó y evita trabajo residual.
    clearTimeout(timeout);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Elimina campos vacíos de un objeto antes de enviarlo al servicio externo.
function compactObject(obj) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const out = {};
// Aplica una operación estructural sin mutar datos fuera del alcance.
  Object.entries(obj).forEach(([key, value]) => {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
    if (value !== '' && value !== null && value !== undefined) out[key] = value;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  });
// Entrega el valor ya procesado y termina esta rama.
  return out;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}


// Calcula y conserva un dato inmutable dentro de este alcance.
const PRODUCT_LABELS = {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  silla: 'Silla ergonómica',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  silla_ergonomica: 'Silla ergonómica',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  soporte_notebook: 'Soporte para notebook',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  soporte_monitor: 'Soporte para monitor',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  soporte_dual: 'Soporte dual para monitor',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  monitor_24: 'Monitor 24 pulgadas',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  monitor_27: 'Monitor 27 pulgadas',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  teclado: 'Teclado inalámbrico',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  teclado_mec: 'Teclado mecánico',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  mouse_ergo: 'Mouse ergonómico',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  mouse_vertical: 'Mouse vertical ergonómico',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  mouse_trackball: 'Mouse trackball ergonómico',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  mousepad_xxl: 'Mousepad XXL',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  hub_usb: 'Hub USB-C',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  hub_usb_pro: 'Hub USB-C Pro',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  organizador: 'Organizador de cables',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  organizador_prem: 'Organizador premium',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  luz_led: 'Barra de luz LED',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  webcam: 'Webcam HD',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  auriculares: 'Auriculares con micrófono',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  asesoria: 'Asesoría personalizada',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  standing_desk: 'Escritorio regulable / standing desk',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  almohadilla: 'Almohadilla lumbar',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  reposamuñecas: 'Reposamuñecas',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  guia: 'Guía de ergonomía digital',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  notebook: 'Notebook',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  brazo_monitor: 'Brazo articulado para monitor',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  bandeja_teclado: 'Bandeja para teclado',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  pad: 'Pad ergonómico',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
  cable_management: 'Organización de cables'
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
};

// Selecciona y limpia una etiqueta de producto legible a partir de distintas formas de entrada.
function formatProductName(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const raw = safeString(value, 120);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!raw) return '';

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (PRODUCT_LABELS[raw]) return PRODUCT_LABELS[raw];

// Entrega el valor ya procesado y termina esta rama.
  return raw
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/[_-]+/g, ' ')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/\s+/g, ' ')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .trim()
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/\bUsb\b/g, 'USB')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/\bXxl\b/g, 'XXL')
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .replace(/\bLed\b/g, 'LED');
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Convierte una colección de productos en texto plano apto para registro comercial.
function formatProductList(items) {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!Array.isArray(items) || !items.length) return [];
// Entrega el valor ya procesado y termina esta rama.
  return [...new Set(items.map(formatProductName).filter(Boolean))];
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Convierte una colección de productos en marcado escapado para la descripción del lead.
function formatProductListHtml(items) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const products = formatProductList(items);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!products.length) return '<p>Sin productos.</p>';
// Entrega el valor ya procesado y termina esta rama.
  return `<ul>${products.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>`;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Presenta una fecha válida con zona de negocio y conserva la entrada cuando no puede interpretarse.
function formatBusinessDate(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const raw = safeString(value, 80);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!raw) return '';

// Calcula y conserva un dato inmutable dentro de este alcance.
  const date = new Date(raw);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (Number.isNaN(date.getTime())) return raw;

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Entrega el valor ya procesado y termina esta rama.
    return new Intl.DateTimeFormat('es-AR', {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      timeZone: 'America/Argentina/Buenos_Aires',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      day: '2-digit',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      month: '2-digit',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      year: 'numeric',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      hour: '2-digit',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      minute: '2-digit',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      hour12: false
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    }).format(date);
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (_) {
// Entrega el valor ya procesado y termina esta rama.
    return raw;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Construye el resumen HTML del diagnóstico, selección, contacto y contexto de la petición.
function leadDescription(payload, requestInfo) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contact = payload.contact || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosis = payload.diagnosis || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const configuration = payload.configuration || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const products = pickProducts(payload);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const tier = normalizeRecommendedTier(diagnosis.recommendedTier, diagnosis.totalScore);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const estimatedTotal = Number(configuration.estimatedTotal || 0);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const currency = safeString(configuration.currency, 10) || 'ARS';

// Calcula y conserva un dato inmutable dentro de este alcance.
  const eventType = safeString(payload.eventType, 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const eventLabel = eventType === 'whatsapp_click'
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  ? 'Selección final confirmada'
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  : (eventType === 'cart_change'
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      ? 'Selección actualizada'
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      : 'Diagnóstico recibido');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contactLines = [
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    `<strong>Nombre:</strong> ${htmlEscape(safeString(contact.name, 120) || '-')}`,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    contact.email ? `<strong>Email:</strong> ${htmlEscape(safeString(contact.email, 180))}` : '',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    contact.whatsapp ? `<strong>WhatsApp:</strong> ${htmlEscape(normalizeArgentinaPhone(contact.whatsapp))}` : ''
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  ].filter(Boolean).join('<br>');

// Calcula y conserva un dato inmutable dentro de este alcance.
  const updatedDate = formatBusinessDate(payload.updatedAt || payload.createdAt);

// Entrega el valor ya procesado y termina esta rama.
  return [
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<div>',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<p><strong>Resumen del test y configuración</strong></p>',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<hr>',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<h3>Estado</h3>',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    `<p><strong>${htmlEscape(eventLabel)}</strong>${updatedDate ? `<br><span>Actualizado: ${htmlEscape(updatedDate)} h</span>` : ''}</p>`,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<h3>Contacto</h3>',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    `<p>${contactLines}</p>`,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<h3>Resultado</h3>',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    `<p><strong>Recomendación:</strong> ${htmlEscape(tier || '-')}<br>`,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    `<strong>Puntaje:</strong> ${htmlEscape(String(Number(diagnosis.totalScore || 0)))}/18<br>`,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    `<strong>Total estimado:</strong> $${htmlEscape(Number.isFinite(estimatedTotal) ? estimatedTotal.toLocaleString('es-AR') : '0')} ${htmlEscape(currency)}</p>`,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<h3>Productos recomendados</h3>',
// Convierte una colección de productos en marcado escapado para la descripción del lead.
    formatProductListHtml(products.recommended),
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '<h3>Productos seleccionados</h3>',
// Convierte una colección de productos en marcado escapado para la descripción del lead.
    formatProductListHtml(products.selected),
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    products.extras.length ? '<h3>Extras</h3>' : '',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    products.extras.length ? formatProductListHtml(products.extras) : '',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    '</div>'
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  ].filter(Boolean).join('');
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Invoca un método de modelo mediante XML RPC reutilizando la sesión autenticada.
async function odooExecuteKw(session, model, method, args = [], kwargs = null) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const params = [
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.db,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.uid,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.apiKey,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    model,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    method,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    args
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  ];

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (kwargs && Object.keys(kwargs).length) params.push(kwargs);
// Entrega el valor ya procesado y termina esta rama.
  return xmlRpcCall(`${session.url}/xmlrpc/2/object`, 'execute_kw', params);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Normaliza identificadores numéricos positivos y elimina duplicados.
function uniqueNumberIds(ids) {
// Entrega el valor ya procesado y termina esta rama.
  return [...new Set((ids || [])
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .map((id) => Number(id))
// Continúa la transformación encadenada manteniendo intacta la entrada original.
    .filter((id) => Number.isFinite(id) && id > 0))];
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Busca un registro por nombre exacto y devuelve su identificador si existe.
async function findNamedRecordId(session, model, name) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const cleanName = safeString(name, 120);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!cleanName) return null;

// Calcula y conserva un dato inmutable dentro de este alcance.
  const found = await odooExecuteKw(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    model,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'search',
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
    [[['name', '=', cleanName]]],
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
    { limit: 1 }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  );

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (Array.isArray(found) && found.length) {
// Entrega el valor ya procesado y termina esta rama.
    return Number(found[0]) || null;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return null;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Busca primero una etiqueta y la crea solo si todavía no existe.
async function findOrCreateNamedRecord(session, model, name) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const cleanName = safeString(name, 120);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!cleanName) return null;

// Calcula y conserva un dato inmutable dentro de este alcance.
  const found = await findNamedRecordId(session, model, cleanName);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (found) return found;

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const created = await odooExecuteKw(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      session,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      model,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      'create',
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
      [{ name: cleanName }]
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    );

// Entrega el valor ya procesado y termina esta rama.
    return Number(created) || null;
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (error) {
    // Puede haber sido creada por otra solicitud al mismo tiempo.
// Calcula y conserva un dato inmutable dentro de este alcance.
    const retry = await odooExecuteKw(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      session,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      model,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      'search',
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
      [[['name', '=', cleanName]]],
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
      { limit: 1 }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    );

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
    if (Array.isArray(retry) && retry.length) {
// Entrega el valor ya procesado y termina esta rama.
      return Number(retry[0]) || null;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }

// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
    throw error;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Resuelve en Odoo todas las etiquetas requeridas para este lead y conserva su correspondencia.
async function resolveRequiredLeadTags(session, payload) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const tagNames = getLeadTagNames(payload);

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (tagNames.length !== 3) {
// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
    throw new Error(`No se pudieron determinar las tres etiquetas requeridas del lead: ${tagNames.join(', ') || 'sin etiquetas'}.`);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const tagIdsByName = {};

// Recorre una colección o fragmento de entrada con límites definidos por el dato recibido.
  for (const tagName of tagNames) {
// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
    let tagId;

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
    try {
// Espera la promesa antes de usar el resultado y evita responder con trabajo pendiente.
      tagId = await findOrCreateNamedRecord(session, 'crm.tag', tagName);
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
    } catch (error) {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const detail = safeString(error && error.message ? error.message : error, 300);
// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
      throw new Error(`No se pudo resolver la etiqueta de Odoo "${tagName}": ${detail || 'error desconocido'}.`);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
    if (!tagId) {
// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
      throw new Error(`No se pudo resolver la etiqueta de Odoo "${tagName}".`);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }

// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    tagIdsByName[tagName] = tagId;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const tagIds = uniqueNumberIds(Object.values(tagIdsByName));
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (tagIds.length !== tagNames.length) {
// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
    throw new Error(`No se pudieron resolver las tres etiquetas requeridas del lead: ${tagNames.join(', ')}.`);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return {
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    tagNames,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    tagIdsByName,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    tagIds
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Reúne los identificadores de todas las etiquetas que esta integración administra.
async function resolveManagedLeadTagIds(session, knownTagIdsByName = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const tagIdsByName = { ...knownTagIdsByName };

// Recorre una colección o fragmento de entrada con límites definidos por el dato recibido.
  for (const tagName of PRIMOFFICE_MANAGED_TAG_NAMES) {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
    if (tagIdsByName[tagName]) continue;

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
    try {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const tagId = await findNamedRecordId(session, 'crm.tag', tagName);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
      if (tagId) tagIdsByName[tagName] = tagId;
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
    } catch (error) {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const detail = safeString(error && error.message ? error.message : error, 300);
// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
      throw new Error(`No se pudo revisar la etiqueta administrada de Odoo "${tagName}": ${detail || 'error desconocido'}.`);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return uniqueNumberIds(Object.values(tagIdsByName));
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Lee las etiquetas actuales de un lead remoto antes de calcular el reemplazo.
async function readOdooLeadTagIds(session, odooLeadId) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const id = Number(odooLeadId || 0);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!id || !Number.isFinite(id)) return [];

// Calcula y conserva un dato inmutable dentro de este alcance.
  const records = await odooExecuteKw(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'crm.lead',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'read',
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
    [[id]],
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
    { fields: ['tag_ids'] }
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  );

// Calcula y conserva un dato inmutable dentro de este alcance.
  const record = Array.isArray(records) ? records[0] : null;
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!record || typeof record !== 'object') {
// Interrumpe la operación para que el handler registre o traduzca el fallo de forma consistente.
    throw new Error(`No se pudieron leer las etiquetas actuales del lead Odoo ${id}.`);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return uniqueNumberIds(record.tag_ids);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Conserva etiquetas ajenas, reemplaza las administradas y forma el comando relacional de Odoo.
async function buildOdooTagCommand(payload, session, odooLeadId = null) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const required = await resolveRequiredLeadTags(session, payload);

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!odooLeadId) {
// Entrega el valor ya procesado y termina esta rama.
    return [[6, 0, required.tagIds]];
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const currentTagIds = await readOdooLeadTagIds(session, odooLeadId);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const managedTagIds = new Set(await resolveManagedLeadTagIds(session, required.tagIdsByName));
// Calcula y conserva un dato inmutable dentro de este alcance.
  const externalTagIds = currentTagIds.filter((id) => !managedTagIds.has(id));
// Calcula y conserva un dato inmutable dentro de este alcance.
  const finalTagIds = uniqueNumberIds([...externalTagIds, ...required.tagIds]);

// Entrega el valor ya procesado y termina esta rama.
  return [[6, 0, finalTagIds]];
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Mapea el payload validado al esquema de oportunidades y añade etiquetas y descripción.
async function buildOdooLead(payload, requestInfo, session, options = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contact = payload.contact || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosis = payload.diagnosis || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const configuration = payload.configuration || {};

// Calcula y conserva un dato inmutable dentro de este alcance.
  const name = safeString(contact.name, 120);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const tier = normalizeRecommendedTier(diagnosis.recommendedTier, diagnosis.totalScore) || 'Setup recomendado';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const whatsapp = normalizeArgentinaPhone(contact.whatsapp);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const email = safeString(contact.email, 180);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const estimatedRevenue = Number(configuration.estimatedTotal || 0);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const fields = compactObject({
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    name: name.slice(0, 200),
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    contact_name: name,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    email_from: email,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    phone: whatsapp,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    mobile: whatsapp,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    expected_revenue: Number.isFinite(estimatedRevenue) && estimatedRevenue > 0 ? estimatedRevenue : undefined,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    description: leadDescription(payload, requestInfo)
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  });

// Espera la promesa antes de usar el resultado y evita responder con trabajo pendiente.
  fields.tag_ids = await buildOdooTagCommand(payload, session, options.odooLeadId);

// Entrega el valor ya procesado y termina esta rama.
  return fields;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Reduce el resultado externo a estado, identificador, error acotado y momento que D1 puede persistir.
function odooD1State(odooResult, fallbackOdooLeadId = null, syncedAt = '') {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const result = odooResult || {};

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (result.ok) {
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
    return {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      status: 'synced',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      id: result.id || fallbackOdooLeadId || null,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      error: null,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      syncedAt: syncedAt || new Date().toISOString()
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (result.skipped) {
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
    return {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      status: 'pending',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      id: fallbackOdooLeadId || null,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      error: safeString(result.error || 'Sincronizacion con Odoo omitida.', 1000),
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      syncedAt: null
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    status: 'error',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    id: result.id || fallbackOdooLeadId || null,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    error: safeString(result.error || 'Error sincronizando con Odoo.', 1000),
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    syncedAt: null
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Autentica contra el servicio común y devuelve la sesión mínima para operaciones de modelo.
async function getOdooSession(env) {
// Interpreta la bandera explícita que permite intentar la sincronización externa.
  if (!odooEnabled(env)) return { ok: false, skipped: true, error: 'Odoo desactivado.' };
// Comprueba que estén presentes todas las credenciales y coordenadas necesarias del servicio externo.
  if (!odooConfigured(env)) return { ok: false, skipped: true, error: 'Faltan variables de Odoo.' };

// Calcula y conserva un dato inmutable dentro de este alcance.
  const url = cleanOdooUrl(env.ODOO_URL);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const db = safeString(env.ODOO_DB, 120);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const username = safeString(env.ODOO_USERNAME, 180);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const apiKey = safeString(env.ODOO_API_KEY, 300);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const uid = await xmlRpcCall(`${url}/xmlrpc/2/common`, 'authenticate', [db, username, apiKey, {}]);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!uid || typeof uid !== 'number') throw new Error('Odoo no autentico el usuario. Revisar base, usuario o API key.');

// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return { ok: true, url, db, uid, apiKey };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Crea una nueva oportunidad remota cuando la integración está habilitada y configurada.
async function sendToOdoo(payload, env, requestInfo) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const session = await getOdooSession(env);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!session.ok) return session;

// Calcula y conserva un dato inmutable dentro de este alcance.
  const fields = await buildOdooLead(payload, requestInfo, session);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const odooLeadId = await xmlRpcCall(`${session.url}/xmlrpc/2/object`, 'execute_kw', [
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.db,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.uid,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.apiKey,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'crm.lead',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'create',
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
    [fields]
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  ]);

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!odooLeadId || typeof odooLeadId !== 'number') throw new Error('Odoo no devolvio ID del lead creado.');
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return { ok: true, id: odooLeadId };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Actualiza una oportunidad existente y exige confirmación positiva del servicio remoto.
async function updateOdooLead(payload, env, requestInfo, odooLeadId) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const id = Number(odooLeadId || 0);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!id || !Number.isFinite(id)) return { ok: false, skipped: true, error: 'No hay odooLeadId para actualizar.' };

// Calcula y conserva un dato inmutable dentro de este alcance.
  const session = await getOdooSession(env);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!session.ok) return session;

// Calcula y conserva un dato inmutable dentro de este alcance.
  const fields = await buildOdooLead(payload, requestInfo, session, { odooLeadId: id });
// Calcula y conserva un dato inmutable dentro de este alcance.
  const updated = await xmlRpcCall(`${session.url}/xmlrpc/2/object`, 'execute_kw', [
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.db,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.uid,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    session.apiKey,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'crm.lead',
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    'write',
// Continúa una expresión agrupada para hacer explícitos sus argumentos o condiciones.
    [[id], fields]
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  ]);

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (updated !== true) throw new Error('Odoo no confirmo la actualizacion del lead.');
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
  return { ok: true, id, updated: true };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Responde la negociación previa con cuerpo vacío y los encabezados CORS definidos para esta ruta.
export async function onRequestOptions({ request }) {
// Construye una respuesta HTTP explícita con estado, cuerpo y encabezados controlados.
  return new Response(null, { status: 204, headers: corsHeaders(request) });
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Devuelve un diagnóstico público de disponibilidad y configuración, sin revelar credenciales.
export async function onRequestGet({ request, env }) {
// Entrega el valor ya procesado y termina esta rama.
  return json({
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    ok: true,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    service: 'PrimOffice Leads API',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    status: 'ready',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    method: 'POST, PATCH',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    odoo: {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      enabled: odooEnabled(env),
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      configured: odooConfigured(env)
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  }, 200, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Limita tamaño, interpreta JSON y centraliza validación y normalización para la actualización.
async function readValidatedPayload(request) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contentLength = Number(request.headers.get('Content-Length') || 0);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (contentLength > 100_000) {
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
    return { error: 'Payload demasiado grande.', status: 413 };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let payload;
// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Espera la promesa antes de usar el resultado y evita responder con trabajo pendiente.
    payload = await request.json();
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (_) {
// Devuelve un objeto normalizado que documenta el contrato interno de esta etapa.
    return { error: 'JSON invalido.', status: 400 };
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const validationError = validatePayload(payload);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (validationError) return { error: validationError, status: 400 };

// Calcula y conserva un dato inmutable dentro de este alcance.
  const normalized = normalizeLeadPayload(payload);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (normalized.error) return normalized;

// Entrega el valor ya procesado y termina esta rama.
  return normalized;
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Actualiza un lead existente en Odoo y D1 usando el identificador interno enviado y validado.
export async function onRequestPatch({ request, env }) {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!env.LEADS_DB) {
// Entrega el valor ya procesado y termina esta rama.
    return json({ ok: false, error: 'D1 binding LEADS_DB no configurado.' }, 500, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const parsed = await readValidatedPayload(request);
// Serializa una respuesta JSON y adjunta CORS cuando dispone de la petición original.
  if (parsed.error) return json({ ok: false, error: parsed.error }, parsed.status || 400, request);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const payload = parsed.payload;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contact = payload.contact || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosis = payload.diagnosis || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const configuration = payload.configuration || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const products = pickProducts(payload);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const leadId = safeString(payload.leadId, 80);
// Serializa una respuesta JSON y adjunta CORS cuando dispone de la petición original.
  if (!leadId) return json({ ok: false, error: 'Falta leadId para actualizar.' }, 400, request);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const now = new Date().toISOString();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const updatedAt = safeString(payload.updatedAt, 40) || now;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const name = safeString(contact.name, 120);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const preferredChannel = safeString(contact.preferredChannel, 30);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const email = safeString(contact.email, 180);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const whatsapp = safeString(contact.whatsapp, 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const recommendedTier = safeString(diagnosis.recommendedTier, 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const recommendedPreset = safeString(diagnosis.recommendedPreset, 40);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const totalScore = Number(diagnosis.totalScore || 0);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const estimatedTotal = Number(configuration.estimatedTotal || 0);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const currency = safeString(configuration.currency, 10) || 'ARS';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const ip = safeString(request.headers.get('CF-Connecting-IP'), 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const country = safeString(request.cf && request.cf.country, 10);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const requestInfo = { ip, country };

// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let existing;
// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Prepara una sentencia D1 y mantiene los valores externos fuera del texto SQL.
    existing = await env.LEADS_DB.prepare(`
      SELECT odoo_lead_id
      FROM leads
      WHERE lead_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).bind(leadId).first();
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (err) {
// Registra el fallo para observabilidad del servidor; el cliente recibe un mensaje más acotado.
    console.error('[PrimOffice Leads API] Error buscando lead en D1:', err);
// Entrega el valor ya procesado y termina esta rama.
    return json({ ok: false, error: 'No se pudo buscar el lead para actualizar.' }, 500, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!existing) {
// Entrega el valor ya procesado y termina esta rama.
    return json({ ok: false, error: 'No existe un lead previo con ese leadId.' }, 404, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const odooLeadId = Number(existing.odoo_lead_id || 0);
// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let odooResult = { ok: false, skipped: true, error: 'No ejecutado.' };

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Espera la promesa antes de usar el resultado y evita responder con trabajo pendiente.
    odooResult = await updateOdooLead({ ...payload, updatedAt }, env, requestInfo, odooLeadId);
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (err) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const message = safeString(err && err.message ? err.message : err, 1000);
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    odooResult = { ok: false, error: message };
// Registra el fallo para observabilidad del servidor; el cliente recibe un mensaje más acotado.
    console.error('[PrimOffice Leads API] Error actualizando Odoo:', err);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const odooState = odooD1State(odooResult, odooLeadId, now);

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Prepara una sentencia D1 y mantiene los valores externos fuera del texto SQL.
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET name = ?, preferred_channel = ?, email = ?, whatsapp = ?,
          recommended_tier = ?, recommended_preset = ?, total_score = ?,
          estimated_total = ?, currency = ?, products_json = ?, payload_json = ?,
          odoo_status = ?, odoo_lead_id = ?,
          odoo_error = ?, odoo_synced_at = ?
      WHERE lead_id = ?
    `).bind(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      name,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      preferredChannel,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      email,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      whatsapp,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      recommendedTier,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      recommendedPreset,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      Number.isFinite(totalScore) ? totalScore : 0,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      Number.isFinite(estimatedTotal) ? estimatedTotal : 0,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      currency,
// Serializa datos defensivamente y usa un nulo representable cuando aparece una estructura no serializable.
      safeJson(products),
// Serializa datos defensivamente y usa un nulo representable cuando aparece una estructura no serializable.
      safeJson({ ...payload, updatedAt }),
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.status,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.id,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.error,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.syncedAt,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      leadId
// Ejecuta la escritura preparada y espera su finalización antes de responder.
    ).run();
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (err) {
// Registra el fallo para observabilidad del servidor; el cliente recibe un mensaje más acotado.
    console.error('[PrimOffice Leads API] Error actualizando D1:', err);
// Entrega el valor ya procesado y termina esta rama.
    return json({ ok: false, error: 'No se pudo actualizar el lead en D1.' }, 500, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Entrega el valor ya procesado y termina esta rama.
  return json({
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    ok: true,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    mode: 'real',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    stored: true,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    updated: true,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    leadId,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    odoo: {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      enabled: odooEnabled(env),
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      synced: !!odooResult.ok,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      id: odooState.id,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      error: odooState.error
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  }, 200, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}

// Persiste un lead nuevo en D1, intenta sincronizarlo con Odoo y registra el resultado de ambos pasos.
export async function onRequestPost({ request, env }) {
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (!env.LEADS_DB) {
// Entrega el valor ya procesado y termina esta rama.
    return json({ ok: false, error: 'D1 binding LEADS_DB no configurado.' }, 500, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const contentLength = Number(request.headers.get('Content-Length') || 0);
// Evalúa una precondición y evita continuar con datos faltantes, incoherentes o no configurados.
  if (contentLength > 100_000) {
// Entrega el valor ya procesado y termina esta rama.
    return json({ ok: false, error: 'Payload demasiado grande.' }, 413, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let payload;
// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Espera la promesa antes de usar el resultado y evita responder con trabajo pendiente.
    payload = await request.json();
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (_) {
// Entrega el valor ya procesado y termina esta rama.
    return json({ ok: false, error: 'JSON invalido.' }, 400, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const error = validatePayload(payload);
// Serializa una respuesta JSON y adjunta CORS cuando dispone de la petición original.
  if (error) return json({ ok: false, error }, 400, request);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const normalized = normalizeLeadPayload(payload);
// Serializa una respuesta JSON y adjunta CORS cuando dispone de la petición original.
  if (normalized.error) return json({ ok: false, error: normalized.error }, normalized.status || 400, request);

// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  payload = normalized.payload;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const contact = payload.contact || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const diagnosis = payload.diagnosis || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const configuration = payload.configuration || {};
// Calcula y conserva un dato inmutable dentro de este alcance.
  const products = pickProducts(payload);

// Calcula y conserva un dato inmutable dentro de este alcance.
  const leadId = safeString(payload.leadId, 80) || `lead_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const createdAt = safeString(payload.createdAt, 40) || new Date().toISOString();
// Calcula y conserva un dato inmutable dentro de este alcance.
  const name = safeString(contact.name, 120);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const preferredChannel = safeString(contact.preferredChannel, 30);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const email = safeString(contact.email, 180);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const whatsapp = safeString(contact.whatsapp, 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const source = safeString(payload.source, 120) || 'landing-primoffice';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const recommendedTier = safeString(diagnosis.recommendedTier, 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const recommendedPreset = safeString(diagnosis.recommendedPreset, 40);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const totalScore = Number(diagnosis.totalScore || 0);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const estimatedTotal = Number(configuration.estimatedTotal || 0);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const currency = safeString(configuration.currency, 10) || 'ARS';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const userAgent = safeString(request.headers.get('User-Agent'), 500);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const ip = safeString(request.headers.get('CF-Connecting-IP'), 80);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const country = safeString(request.cf && request.cf.country, 10);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const requestInfo = { ip, country };

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Prepara una sentencia D1 y mantiene los valores externos fuera del texto SQL.
    await env.LEADS_DB.prepare(`
      INSERT INTO leads (
        lead_id, created_at, source, name, preferred_channel, email, whatsapp,
        consent, recommended_tier, recommended_preset, total_score,
        estimated_total, currency, products_json, utm_json, payload_json,
        user_agent, ip, country
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      leadId,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      createdAt,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      source,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      name,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      preferredChannel,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      email,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      whatsapp,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      contact.consent ? 1 : 0,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      recommendedTier,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      recommendedPreset,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      Number.isFinite(totalScore) ? totalScore : 0,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      Number.isFinite(estimatedTotal) ? estimatedTotal : 0,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      currency,
// Serializa datos defensivamente y usa un nulo representable cuando aparece una estructura no serializable.
      safeJson(products),
// Serializa datos defensivamente y usa un nulo representable cuando aparece una estructura no serializable.
      safeJson(payload.utm || {}),
// Serializa datos defensivamente y usa un nulo representable cuando aparece una estructura no serializable.
      safeJson(payload),
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      userAgent,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      ip,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      country
// Ejecuta la escritura preparada y espera su finalización antes de responder.
    ).run();
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (err) {
// Registra el fallo para observabilidad del servidor; el cliente recibe un mensaje más acotado.
    console.error('[PrimOffice Leads API] Error guardando en D1:', err);
// Entrega el valor ya procesado y termina esta rama.
    return json({
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      ok: false,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      mode: 'real',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      stored: false,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      error: 'No se pudo guardar el lead.'
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    }, 500, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Reserva estado mutable porque el dato se completa durante el recorrido o la llamada remota.
  let odooResult = { ok: false, skipped: true, error: 'No ejecutado.' };

// Aísla una operación que puede fallar al serializar, interpretar, persistir o llamar al servicio externo.
  try {
// Espera la promesa antes de usar el resultado y evita responder con trabajo pendiente.
    odooResult = await sendToOdoo({ ...payload, leadId, createdAt }, env, requestInfo);

// Calcula y conserva un dato inmutable dentro de este alcance.
    const odooState = odooD1State(odooResult, null, new Date().toISOString());
// Prepara una sentencia D1 y mantiene los valores externos fuera del texto SQL.
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET odoo_status = ?, odoo_lead_id = ?, odoo_error = ?, odoo_synced_at = ?
      WHERE lead_id = ?
    `).bind(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.status,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.id,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.error,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.syncedAt,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      leadId
// Ejecuta la escritura preparada y espera su finalización antes de responder.
    ).run();
// Captura el fallo y lo convierte en estado controlado sin incluir credenciales en la respuesta.
  } catch (err) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const message = safeString(err && err.message ? err.message : err, 1000);
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    odooResult = { ok: false, error: message };
// Calcula y conserva un dato inmutable dentro de este alcance.
    const odooState = odooD1State(odooResult, null, null);

// Registra el fallo para observabilidad del servidor; el cliente recibe un mensaje más acotado.
    console.error('[PrimOffice Leads API] Error enviando a Odoo:', err);
// Prepara una sentencia D1 y mantiene los valores externos fuera del texto SQL.
    await env.LEADS_DB.prepare(`
      UPDATE leads
      SET odoo_status = ?, odoo_lead_id = ?, odoo_error = ?, odoo_synced_at = ?
      WHERE lead_id = ?
    `).bind(
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.status,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.id,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.error,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      odooState.syncedAt,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
      leadId
// Ejecuta la escritura preparada y espera su finalización antes de responder.
    ).run();
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const responseOdooState = odooD1State(odooResult, null, null);

// Entrega el valor ya procesado y termina esta rama.
  return json({
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    ok: true,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    mode: 'real',
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    stored: true,
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
    leadId,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
    odoo: {
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      enabled: odooEnabled(env),
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      synced: !!odooResult.ok,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      id: responseOdooState.id,
// Define un campo concreto del objeto que se persistirá, enviará o devolverá.
      error: responseOdooState.error
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
    }
// Completa esta etapa concreta de normalización, mapeo, persistencia o respuesta.
  }, 201, request);
// Cierra el bloque o la estructura y delimita el alcance de sus datos temporales.
}
