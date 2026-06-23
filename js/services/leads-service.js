/* Servicio de leads.
   El formulario arma el payload y este archivo lo manda al endpoint real.
   No importa app-config por módulo para evitar mezclas raras de caché entre versiones. */

const DEFAULT_CONFIG = {
  DEMO_MODE: false,
  LEADS_API_URL: '/api/leads',
  LEADS_API_TOKEN: '',
  LEADS_TIMEOUT_MS: 10000,
  LEADS_STORAGE_KEY: 'primoffice_leads_demo',
  LEAD_ORIGIN: 'landing-primoffice',
  LANDING_SOURCE: 'Landing PrimOffice - Test ergonomico',
  INTEGRATION: {
    crm: 'odoo',
    odooEnabled: false,
    payloadSchema: 'v1'
  }
};

function cfg() {
  const runtime = (typeof window !== 'undefined' && window.PrimOfficeConfig)
    ? window.PrimOfficeConfig
    : {};

  const conf = Object.assign({}, DEFAULT_CONFIG, runtime);
  conf.INTEGRATION = Object.assign(
    {},
    DEFAULT_CONFIG.INTEGRATION,
    runtime.INTEGRATION || {}
  );

  return conf;
}

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

async function enviarReal(url, payload, conf, method = 'POST') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), conf.LEADS_TIMEOUT_MS || 10000);

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Si algun dia se usa token, tiene que venir inyectado desde el entorno, no escrito en el repo.
  if (conf.LEADS_API_TOKEN) {
    headers['Authorization'] = `Bearer ${conf.LEADS_API_TOKEN}`;
  }

  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      return {
        ok: false,
        mode: 'real',
        status: resp.status,
        error: `HTTP ${resp.status}`,
        detalle
      };
    }

    const data = await resp.json().catch(() => ({}));
    return {
      ok: true,
      mode: 'real',
      status: resp.status,
      data
    };
  } catch (err) {
    clearTimeout(timeout);
    const abortado = err && err.name === 'AbortError';
    return {
      ok: false,
      mode: 'real',
      error: abortado ? 'timeout' : 'network',
      detalle: String((err && err.message) || err)
    };
  }
}

export async function submitLead(payload) {
  const conf = cfg();
  const url = (conf.LEADS_API_URL || '').trim();

  // En DEMO_MODE, o sin URL, no se toca el endpoint real.
  if (conf.DEMO_MODE === true || !url) {
    const guardado = guardarDemo(payload);
    console.warn(
      '[leads-service] Modo demo o sin endpoint. Guardado local:',
      guardado ? 'localStorage' : 'memoria',
      payload
    );
    return { ok: true, mode: 'demo', stored: guardado };
  }

  const resultado = await enviarReal(url, payload, conf);

  if (!resultado.ok) {
    console.error('[leads-service] Fallo el envio real del lead.', resultado);
  } else {
    console.info('[leads-service] Lead enviado al endpoint.', resultado);
  }

  return resultado;
}

export async function updateLead(payload) {
  const conf = cfg();
  const url = (conf.LEADS_API_URL || '').trim();

  if (conf.DEMO_MODE === true || !url) {
    const guardado = guardarDemo(Object.assign({}, payload, { updateOnly: true }));
    console.warn(
      '[leads-service] Modo demo o sin endpoint. Actualizacion guardada local:',
      guardado ? 'localStorage' : 'memoria',
      payload
    );
    return { ok: true, mode: 'demo', stored: guardado, updated: true };
  }

  const resultado = await enviarReal(url, payload, conf, 'PATCH');

  if (!resultado.ok) {
    console.error('[leads-service] Fallo la actualizacion real del lead.', resultado);
  } else {
    console.info('[leads-service] Lead actualizado en el endpoint.', resultado);
  }

  return resultado;
}

export function getLeadsDemo() {
  try {
    const key = cfg().LEADS_STORAGE_KEY || 'primoffice_leads_demo';
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (err) {
    return [];
  }
}

if (typeof window !== 'undefined') {
  window.PrimOfficeLeads = { submitLead, updateLead, getLeadsDemo };
}

export default { submitLead, updateLead, getLeadsDemo };
