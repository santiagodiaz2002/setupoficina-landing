import { getOdooSession, odooExecuteKw } from './odoo.mjs';
import { CORPORATE_RECORD_START, CORPORATE_RECORD_END, createCorporateRecord, parseCorporateRecord, serializeCorporateRecord } from './corporate-record.mjs';

export const CORPORATE_TAG = 'Empresas - Landing';
const PROJECTS = new Set([
  'Kits de bienvenida', 'Regalos corporativos', 'Regalos de fin de año',
  'Productos con branding', 'Acciones corporativas', 'Proyecto especial',
  'Visita al showroom', 'Todavía no lo tengo definido'
]);
const LIMITS = {
  nombre: 120, empresa: 180, email: 180, phone: 40, tipo: 80, cantidad: 12, fecha: 10, detalle: 4000,
  gclid: 512, gbraid: 512, wbraid: 512,
  utm_source: 512, utm_medium: 512, utm_campaign: 512, utm_term: 512, utm_content: 512,
  landing_url: 2048, referrer: 2048, submission_id: 36
};
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export function validateCorporatePayload(payload, today = new Date()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'Consulta inválida.' };
  const data = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const value = payload[key] ?? '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      return { error: `El campo ${key} es inválido o demasiado largo.` };
    }
    data[key] = value.trim();
  }
  if (!data.nombre || !data.empresa || !data.email || !data.phone || !data.cantidad || !data.fecha) return { error: 'Completá nombre, empresa, email, WhatsApp, cantidad y fecha objetivo.' };
  if (!PROJECTS.has(data.tipo)) return { error: 'Elegí un tipo de proyecto válido.' };
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  const digits = data.phone.replace(/\D/g, '');
  const isPhone = /^\+?[\d\s().-]+$/.test(data.phone) && digits.length >= 8 && digits.length <= 15;
  if (!isEmail || !isPhone) return { error: 'Ingresá un email y un WhatsApp válidos.' };
  if (data.cantidad && (!/^\d+$/.test(data.cantidad) || !Number.isSafeInteger(Number(data.cantidad)) || Number(data.cantidad) < 1)) {
    return { error: 'La cantidad debe ser un número entero mayor que cero.' };
  }
  const date = new Date(`${data.fecha}T12:00:00Z`);
  const argentinaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data.fecha || data.fecha < argentinaToday) {
    return { error: 'Ingresá una fecha objetivo válida, desde hoy en adelante.' };
  }
  for (const key of ['landing_url', 'referrer']) {
    if (!data[key]) continue;
    try {
      const url = new URL(data[key]);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('url');
    } catch { return { error: `El campo ${key} es inválido.` }; }
  }
  // Old, already-open frontends remain accepted during the backend-first rollout.
  if (data.submission_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submission_id)) {
    return { error: 'El identificador de envío es inválido.' };
  }
  data.submission_id = data.submission_id.toLowerCase();
  return { data };
}

async function resolveCorporateTag(session) {
  const find = () => odooExecuteKw(session, 'crm.tag', 'search', [[['name', '=', CORPORATE_TAG]]], { limit: 1 });
  const found = await find();
  if (Array.isArray(found) && Number.isInteger(found[0]) && found[0] > 0) return found[0];
  try {
    const id = await odooExecuteKw(session, 'crm.tag', 'create', [{ name: CORPORATE_TAG }]);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid tag');
    return id;
  } catch (error) {
    const retry = await find();
    if (Array.isArray(retry) && Number.isInteger(retry[0]) && retry[0] > 0) return retry[0];
    throw error;
  }
}

const readFields = ['id', 'description', 'create_date'];

async function findSubmission(session, tagId, submissionId) {
  for (let offset = 0; ; offset += 20) {
    const leads = await odooExecuteKw(session, 'crm.lead', 'search_read', [[
      ['tag_ids', 'in', [tagId]], ['description', 'ilike', submissionId]
    ]], { fields: readFields, context: { active_test: false }, order: 'id asc', limit: 20, offset });
    if (!Array.isArray(leads)) throw new Error('Invalid submission search');
    for (const lead of leads) {
      const record = parseCorporateRecord(lead.description);
      if (record?.submission_id === submissionId) return lead;
    }
    if (leads.length < 20) return null;
  }
}

function creationTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(value)) throw new Error('Missing Odoo creation time');
  const date = new Date(value.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== value.slice(0, 19).replace(' ', 'T')) throw new Error('Invalid Odoo creation time');
  return date.toISOString();
}

async function completeMetadata(session, lead, submissionId) {
  if (!Number.isInteger(lead?.id) || lead.id <= 0) throw new Error('Invalid lead');
  const record = parseCorporateRecord(lead.description);
  if (!record || record.submission_id !== submissionId) throw new Error('Missing submission record');
  const createdAt = creationTime(lead.create_date);
  if (record.lead_id === lead.id && record.created_at === createdAt) return { id: lead.id };
  const start = lead.description.lastIndexOf(CORPORATE_RECORD_START) + CORPORATE_RECORD_START.length;
  const end = lead.description.indexOf(CORPORATE_RECORD_END, start);
  if (start < CORPORATE_RECORD_START.length || end < start) throw new Error('Missing record delimiters');
  // Replace only the JSON inside the authoritative block, retaining human HTML.
  const description = lead.description.slice(0, start) + '\n' +
    escapeHtml(serializeCorporateRecord({ ...record, lead_id: lead.id, created_at: createdAt })) + '\n' + lead.description.slice(end);
  const written = await odooExecuteKw(session, 'crm.lead', 'write', [[lead.id], { description }]);
  if (written !== true) throw new Error('Metadata write failed');
  const [persisted] = await odooExecuteKw(session, 'crm.lead', 'read', [[lead.id]], { fields: readFields });
  const confirmed = parseCorporateRecord(persisted?.description);
  if (persisted?.id !== lead.id || confirmed?.submission_id !== submissionId || confirmed.lead_id !== lead.id || confirmed.created_at !== createdAt) throw new Error('Metadata not persisted');
  return { id: lead.id };
}

export async function createCorporateLead(payload, env) {
  const validated = validateCorporatePayload(payload);
  if (validated.error) return validated;
  const { data } = validated;
  const session = await getOdooSession(env);
  // Consultar el modelo real antes de usar incluso campos opcionales como partner_name.
  const fields = await odooExecuteKw(session, 'crm.lead', 'fields_get', [], { attributes: ['type'] });
  const required = { name: 'char', contact_name: 'char', email_from: 'char', phone: 'char', description: 'html', tag_ids: 'many2many', create_date: 'datetime' };
  for (const [name, type] of Object.entries(required)) {
    if (fields?.[name]?.type !== type) throw new Error('Unsupported CRM schema');
  }
  const tagId = await resolveCorporateTag(session);
  if (data.submission_id) {
    const existing = await findSubmission(session, tagId, data.submission_id);
    if (existing) return completeMetadata(session, existing, data.submission_id);
  } else {
    data.submission_id = crypto.randomUUID();
  }
  const labels = { nombre: 'Contacto', empresa: 'Empresa', email: 'Email corporativo', phone: 'WhatsApp', tipo: 'Tipo de proyecto', cantidad: 'Cantidad aproximada', fecha: 'Fecha objetivo', detalle: 'Detalle' };
  const description = '<div><p><strong>Consulta corporativa — PrimOffice Empresas</strong></p>' +
    Object.entries(labels).map(([key, label]) => `<p><strong>${label}:</strong> ${escapeHtml(data[key] || 'Sin especificar').replace(/\r?\n/g, '<br>')}</p>`).join('') + '</div>' +
    `<pre>${CORPORATE_RECORD_START}\n${escapeHtml(createCorporateRecord(data))}\n${CORPORATE_RECORD_END}</pre>`;
  const values = {
    name: `${data.empresa} — ${data.tipo}`,
    contact_name: data.nombre,
    description,
    tag_ids: [[6, 0, [tagId]]]
  };
  if (data.email) values.email_from = data.email;
  if (data.phone) values.phone = data.phone;
  if (fields.partner_name?.type === 'char') values.partner_name = data.empresa;
  if (fields.type?.type === 'selection') values.type = 'opportunity';
  const id = await odooExecuteKw(session, 'crm.lead', 'create', [values]);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid lead');
  const [lead] = await odooExecuteKw(session, 'crm.lead', 'read', [[id]], { fields: readFields });
  if (lead?.id !== id) throw new Error('Created lead not readable');
  return completeMetadata(session, lead, data.submission_id);
}
