import { getOdooSession, odooExecuteKw } from './odoo.mjs';
import { CORPORATE_RECORD_START, CORPORATE_RECORD_END, parseCorporateRecord, serializeCorporateRecord } from './corporate-record.mjs';

// Neither the request payload nor the saved message can override this recipient.
const RECIPIENT = 'info@primoffice.com.ar';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Resend retains keys for 24h. Stop uncertain retries early instead of duplicating mail.
const SAFE_RETRY_MS = 23 * 60 * 60 * 1000;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

class NotificationError extends Error {
  constructor(code, failure, httpStatus) {
    super(code);
    this.code = code;
    this.failure = failure;
    this.httpStatus = httpStatus;
  }
}
const fail = (code, failure, httpStatus) => { throw new NotificationError(code, failure, httpStatus); };

function configuration(env) {
  const apiKey = typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  const from = typeof env.CORPORATE_NOTIFICATION_FROM === 'string' ? env.CORPORATE_NOTIFICATION_FROM.trim() : '';
  if (!apiKey || !from) fail('configuration_missing');
  // Accept a mailbox or "PrimOffice <mailbox>"; no header injection or address list.
  if (/[\r\n]/.test(from) || !/^(?:[^<>@,]+ <)?[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+>?$/.test(from) ||
      from.includes('<') !== from.endsWith('>') || /\s/.test(apiKey)) fail('configuration_invalid');
  return { apiKey, from };
}

function message(record, from) {
  const labels = { nombre: 'Contacto', empresa: 'Empresa', email: 'Email', phone: 'WhatsApp / teléfono', tipo: 'Tipo de proyecto', cantidad: 'Cantidad', fecha: 'Fecha objetivo', detalle: 'Detalle', lead_id: 'ID del lead' };
  const rows = Object.entries(labels).map(([key, label]) => [label, record[key] || 'Sin especificar']);
  return {
    from,
    subject: `Nueva consulta corporativa — ${record.empresa.replace(/[\r\n]+/g, ' ')}`,
    reply_to: record.email,
    text: rows.map(([label, value]) => `${label}: ${value}`).join('\n'),
    html: '<h1>Nueva consulta corporativa</h1>' + rows.map(([label, value]) =>
      `<p><strong>${label}:</strong> ${escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>')}</p>`).join('')
  };
}

async function readLead(session, id) {
  const [lead] = await odooExecuteKw(session, 'crm.lead', 'read', [[id]], { fields: ['id', 'description'] });
  const record = parseCorporateRecord(lead?.description);
  if (lead?.id !== id || record?.lead_id !== id || !UUID.test(record?.submission_id) ||
      !Number.isFinite(Date.parse(record?.created_at))) fail('lead_unconfirmed');
  return { lead, record };
}

async function saveNotification(session, id, submissionId, notification) {
  // Re-read to retain current CRM notes/metadata rather than overwriting an old description.
  const { lead, record } = await readLead(session, id);
  if (record.submission_id !== submissionId) fail('state_invalid');
  if (record.notification?.status === 'sent') return record.notification;
  // Reuse another request's already-persisted attempt and immutable message.
  if (notification.status === 'pending' && record.notification) return record.notification;
  const start = lead.description.lastIndexOf(CORPORATE_RECORD_START) + CORPORATE_RECORD_START.length;
  const end = lead.description.indexOf(CORPORATE_RECORD_END, start);
  if (start < CORPORATE_RECORD_START.length || end < start) fail('state_invalid');
  const description = lead.description.slice(0, start) + '\n' +
    escapeHtml(serializeCorporateRecord({ ...record, notification })) + '\n' + lead.description.slice(end);
  if (await odooExecuteKw(session, 'crm.lead', 'write', [[id], { description }]) !== true) fail('state_not_saved');
  const confirmed = await readLead(session, id);
  if (JSON.stringify(confirmed.record.notification) !== JSON.stringify(notification)) fail('state_not_saved');
  return notification;
}

async function send(apiKey, body, key) {
  const controller = new AbortController();
  // Resend gets its own bounded request budget, independent of elapsed Odoo work.
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ ...body, to: [RECIPIENT] })
    });
    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* Keep the HTTP diagnostic; never read the body. */ }
      fail('provider_failed', 'http', response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) fail('provider_invalid_response');
    let text = '', size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) { await reader.cancel(); fail('provider_invalid_response'); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    let result;
    try { result = JSON.parse(text); } catch { fail('provider_invalid_response'); }
    if (!UUID.test(result?.id) || result.error || result.name) fail('provider_invalid_response');
    return result.id;
  } catch (error) {
    if (error instanceof NotificationError) throw error;
    // Never retain provider response bodies, URLs, credentials or exception messages.
    fail('provider_failed', controller.signal.aborted ? 'timeout' : 'transport');
  } finally { clearTimeout(timeout); }
}

// Called only after createCorporateLead has created/recovered and verified the lead.
// The registration response remains {ok:true,id}, even if notification is unavailable.
export async function notifyCorporateLead(id, env) {
  try {
    const { apiKey, from } = configuration(env);
    const session = await getOdooSession(env);
    const { record } = await readLead(session, id);
    const key = `corporate-lead/${record.submission_id}`;
    let notification = record.notification;
    if (!notification) {
      notification = await saveNotification(session, id, record.submission_id, {
        status: 'pending', key, first_attempt_at: new Date().toISOString(), message: message(record, from)
      });
    }
    if (notification.key !== key) fail('state_invalid');
    if (notification.status === 'sent' && UUID.test(notification.provider_id)) return 'already_sent';
    if (notification.status !== 'pending' || !notification.message) fail('state_invalid');
    const age = Date.now() - Date.parse(notification.first_attempt_at);
    if (!Number.isFinite(age) || age < 0 || age >= SAFE_RETRY_MS) fail('requires_review');
    const providerId = await send(apiKey, notification.message, key);
    await saveNotification(session, id, record.submission_id, {
      ...notification, status: 'sent', provider_id: providerId, accepted_at: new Date().toISOString()
    });
    console.info('corporate_notification_sent', { lead_id: id });
    return 'sent';
  } catch (error) {
    const code = error instanceof NotificationError ? error.code : 'storage_failed';
    const diagnostic = { lead_id: id };
    if (error instanceof NotificationError && error.failure) diagnostic.failure = error.failure;
    if (error instanceof NotificationError && Number.isInteger(error.httpStatus)) diagnostic.http_status = error.httpStatus;
    console.error(`corporate_notification_${code}`, diagnostic);
    return code;
  }
}
