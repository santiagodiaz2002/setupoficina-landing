/* =====================================================================
   PrimOffice · Servicio de Leads (adaptador desacoplado)
   ---------------------------------------------------------------------
   Capa única responsable de "enviar" un lead. La landing no conoce el
   backend: sólo llama a submitLead(payload) y reacciona al resultado.

   Estados:
     · MODO REAL  -> si APP_CONFIG.LEADS_API_URL tiene una URL, hace POST.
     · MODO DEMO  -> si la URL está vacía, guarda en localStorage, registra
                     en consola que la integración real está pendiente y
                     resuelve con { mode: 'demo' } (sin simular una
                     confirmación de persistencia real).

   El contrato esperado del endpoint está documentado en
   docs/INTEGRACION_BASE_DATOS.md.
   ===================================================================== */

import { APP_CONFIG } from '../config/app-config.js';

/* Lee la config vigente combinando defaults + overrides de runtime. */
function cfg() {
  if (typeof window !== 'undefined' && window.PrimOfficeConfig) {
    return Object.assign({}, APP_CONFIG, window.PrimOfficeConfig);
  }
  return APP_CONFIG;
}

/* Guarda el lead en localStorage (modo demo). Tolerante a errores
   (modo incógnito, almacenamiento lleno, etc.). */
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

/* POST real con timeout (AbortController) y manejo de errores explícito. */
async function enviarReal(url, payload, conf) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), conf.LEADS_TIMEOUT_MS || 10000);

  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  /* El token, si existe, se envía como Bearer. NO debe hardcodearse en el
     repositorio: se inyecta en runtime desde un entorno seguro. */
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

/**
 * Envía un lead al backend (modo real) o lo persiste localmente (modo demo).
 *
 * @param {Object} payload  Lead completo (ver esquema en INTEGRACION_BASE_DATOS.md).
 * @returns {Promise<{ok:boolean, mode:'real'|'demo', status?:number, data?:any, error?:string, detalle?:string}>}
 *
 * Importante: en modo demo `ok` es true (el flujo puede continuar al
 * resultado) pero `mode` es 'demo' para que la UI sea honesta y NO muestre
 * una confirmación de persistencia real.
 */
export async function submitLead(payload) {
  const conf = cfg();
  const url = (conf.LEADS_API_URL || '').trim();

  if (!url) {
    const guardado = guardarDemo(payload);
    console.warn(
      '[leads-service] MODO DEMO activo: la integración real con la base de datos está PENDIENTE.\n' +
      'El lead se guardó ' + (guardado ? 'en localStorage' : 'SÓLO en memoria (localStorage no disponible)') +
      '. Configurá APP_CONFIG.LEADS_API_URL para habilitar el envío real.\n' +
      'Contrato esperado: docs/INTEGRACION_BASE_DATOS.md',
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

/* Utilidad de soporte: devuelve los leads acumulados en modo demo
   (útil para depurar o exportar manualmente mientras no hay backend). */
export function getLeadsDemo() {
  try {
    const key = cfg().LEADS_STORAGE_KEY || 'primoffice_leads_demo';
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (err) {
    return [];
  }
}

/* Publicado también en window para consumidores no-módulo / depuración. */
if (typeof window !== 'undefined') {
  window.PrimOfficeLeads = { submitLead, getLeadsDemo };
}

export default { submitLead, getLeadsDemo };
