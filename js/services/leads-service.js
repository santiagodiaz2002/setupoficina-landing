/* Servicio de leads.
   La landing arma el payload y este archivo lo manda al endpoint real.
   Si el endpoint no está configurado, queda el guardado local para pruebas. */

import { APP_CONFIG } from '../config/app-config.js';

/* Toma la config del archivo como principal.
   Si quedó una config vieja en window por caché, no pisa DEMO_MODE ni LEADS_API_URL. */
function cfg() {
  const runtime = (typeof window !== 'undefined' && window.PrimOfficeConfig) ? window.PrimOfficeConfig : {};
  const conf = Object.assign({}, runtime, APP_CONFIG);

  conf.INTEGRATION = Object.assign(
    {},
    runtime.INTEGRATION || {},
    APP_CONFIG.INTEGRATION || {}
  );

  // Si algún día se inyecta un token seguro desde Cloudflare, se respeta.
  if (runtime.LEADS_API_TOKEN && !APP_CONFIG.LEADS_API_TOKEN) {
    conf.LEADS_API_TOKEN = runtime.LEADS_API_TOKEN;
  }

  return conf;
}

/* Guardado local para pruebas, por si el endpoint no está activo. */
function guardarDemo(payload) {
  try {
    const key = cfg().LEADS_STORAGE_KEY || 'primoffice_leads_demo';
    const previos = JSON.parse(localStorage.getItem(key) || '[]');
    previos.push(payload);
    localStorage.setItem(key, JSON.stringify(previos));
    return true;
  } catch (err) {
    console.warn('[leads-service] No se pudo guardar el lead en localStorage.', err);
    return false;
  }
}

/* Envío real al endpoint con timeout. */
async function enviarReal(url, payload, conf) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), conf.LEADS_TIMEOUT_MS || 10000);

  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  /* El token no se escribe en el repo. Si existe, viene inyectado desde el entorno. */
  if (conf.LEADS_API_TOKEN) headers['Authorization'] = `Bearer ${conf.LEADS_API_TOKEN}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      return { ok: false, mode: 'real', status: resp.status, error: `HTTP ${resp.status}`, detalle };
    }

    const data = await resp.json().catch(() => ({}));
    return { ok: true, mode: 'real', status: resp.status, data };
  } catch (err) {
    clearTimeout(timeout);
    const abortado = err && err.name === 'AbortError';
    return { ok: false, mode: 'real', error: abortado ? 'timeout' : 'network', detalle: String(err && err.message || err) };
  }
}

/* Punto de entrada que usa el formulario.
   Real: POST a /api/leads.
   Demo: localStorage para probar sin backend. */
export async function submitLead(payload) {
  const conf = cfg();
  const url = (conf.LEADS_API_URL || '').trim();
  /* Si falta endpoint o está activado el modo demo, no intenta enviar nada afuera. */
  const esDemo = conf.DEMO_MODE === true || !url;

  if (esDemo) {
    const guardado = guardarDemo(payload);
    console.warn(
      '[leads-service] Modo demo: no se envió al endpoint. ' +
      'Guardado: ' + (guardado ? 'localStorage' : 'memoria') + '.',
      payload
    );
    return { ok: true, mode: 'demo', stored: guardado };
  }

  const resultado = await enviarReal(url, payload, conf);
  if (!resultado.ok) {
    console.error('[leads-service] Falló el envío real del lead.', resultado);
  }
  return resultado;
}

/* Para revisar rápido los leads guardados en modo demo. */
export function getLeadsDemo() {
  try {
    const key = cfg().LEADS_STORAGE_KEY || 'primoffice_leads_demo';
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (err) {
    return [];
  }
}

/* Lo dejo disponible en window para que el form inline pueda usarlo. */
if (typeof window !== 'undefined') {
  window.PrimOfficeLeads = { submitLead, getLeadsDemo };
}

export default { submitLead, getLeadsDemo };
