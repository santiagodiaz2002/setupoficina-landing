import { getOdooSession, odooExecuteKw } from './odoo.mjs';
import { CORPORATE_RECORD_START, CORPORATE_RECORD_END, createCorporateRecord } from './corporate-record.mjs';

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
  landing_url: 2048, referrer: 2048
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

export async function createCorporateLead(payload, env) {
  const validated = validateCorporatePayload(payload);
  if (validated.error) return validated;
  const { data } = validated;
  const session = await getOdooSession(env);
  // Consultar el modelo real antes de usar incluso campos opcionales como partner_name.
  const fields = await odooExecuteKw(session, 'crm.lead', 'fields_get', [], { attributes: ['type'] });
  const required = { name: 'char', contact_name: 'char', email_from: 'char', phone: 'char', description: 'html', tag_ids: 'many2many' };
  for (const [name, type] of Object.entries(required)) {
    if (fields?.[name]?.type !== type) throw new Error('Unsupported CRM schema');
  }
  const tagId = await resolveCorporateTag(session);
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
  return { id };
}
