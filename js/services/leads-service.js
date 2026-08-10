// GUÍA EDUCATIVA: servicio de envío y actualización de leads; lee la configuración global y publica su API para index.html.
// En entorno local usa almacenamiento del navegador; fuera de él envía solicitudes al endpoint configurado.
/* Servicio de leads.
   El formulario arma el payload y este archivo lo manda al endpoint real.
   No importa app-config por módulo para evitar mezclas raras de caché entre versiones. */

// Declara referencias estables para DEFAULT_CONFIG; la inicialización aporta los datos que consumirá el bloque siguiente.
const DEFAULT_CONFIG = {
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  DEMO_MODE: false,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_API_URL: '/api/leads',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_API_TOKEN: '',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_TIMEOUT_MS: 10000,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_STORAGE_KEY: 'primoffice_leads_demo',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEAD_ORIGIN: 'landing-primoffice',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LANDING_SOURCE: 'Landing PrimOffice - Test ergonomico',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  INTEGRATION: {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    crm: 'odoo',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    odooEnabled: false,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    payloadSchema: 'v1'
  }
};

// Declara la función cfg; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function cfg() {
  // Declara referencias estables para runtime; la inicialización aporta los datos que consumirá el bloque siguiente.
  const runtime = (typeof window !== 'undefined' && window.PrimOfficeConfig)
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    ? window.PrimOfficeConfig
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    : {};

  // Declara referencias estables para conf; la inicialización aporta los datos que consumirá el bloque siguiente.
  const conf = Object.assign({}, DEFAULT_CONFIG, runtime);
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  conf.INTEGRATION = Object.assign(
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    {},
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    DEFAULT_CONFIG.INTEGRATION,
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    runtime.INTEGRATION || {}
  );

  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return conf;
}

// Declara la función esEntornoLocal; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function esEntornoLocal() {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (typeof window === 'undefined' || !window.location) return false;
  // Declara referencias estables para host; la inicialización aporta los datos que consumirá el bloque siguiente.
  const host = String(window.location.hostname || '').toLowerCase();
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0';
}

// Declara la función usarModoDemo; recibe conf, url y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function usarModoDemo(conf, url) {
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return conf.DEMO_MODE === true || !url || esEntornoLocal();
}

// Declara la función guardarDemo; recibe payload y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function guardarDemo(payload) {
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try {
    // Declara referencias estables para key; la inicialización aporta los datos que consumirá el bloque siguiente.
    const key = cfg().LEADS_STORAGE_KEY || 'primoffice_leads_demo';
    // Declara referencias estables para previos; la inicialización aporta los datos que consumirá el bloque siguiente.
    const previos = JSON.parse(localStorage.getItem(key) || '[]');
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    previos.push(payload);
    // Lee o persiste el estado local previsto; la operación está protegida porque el almacenamiento puede no estar disponible.
    localStorage.setItem(key, JSON.stringify(previos));
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return true;
  // Captura el error de la operación protegida y ejecuta la recuperación definida.
  } catch (err) {
    // Lee o persiste el estado local previsto; la operación está protegida porque el almacenamiento puede no estar disponible.
    console.warn('[leads-service] No se pudo guardar el lead en localStorage.', err);
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return false;
  }
}

// Declara la función enviarReal; recibe url, payload, conf, method = 'POST' y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
async function enviarReal(url, payload, conf, method = 'POST') {
  // Declara referencias estables para controller; la inicialización aporta los datos que consumirá el bloque siguiente.
  const controller = new AbortController();
  // Declara referencias estables para timeout; la inicialización aporta los datos que consumirá el bloque siguiente.
  const timeout = setTimeout(() => controller.abort(), conf.LEADS_TIMEOUT_MS || 10000);

  // Declara referencias estables para headers; la inicialización aporta los datos que consumirá el bloque siguiente.
  const headers = {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'Content-Type': 'application/json',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'Accept': 'application/json'
  };

  // Si algun dia se usa token, tiene que venir inyectado desde el entorno, no escrito en el repo.
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (conf.LEADS_API_TOKEN) {
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    headers['Authorization'] = `Bearer ${conf.LEADS_API_TOKEN}`;
  }

  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try {
    // Declara referencias estables para resp; la inicialización aporta los datos que consumirá el bloque siguiente.
    const resp = await fetch(url, {
      // Incorpora este símbolo a la declaración multilineal que lo contiene.
      method,
      // Incorpora este símbolo a la declaración multilineal que lo contiene.
      headers,
      // Convierte entre objetos y texto JSON para transportar o persistir una copia independiente.
      body: JSON.stringify(payload),
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      signal: controller.signal
    });

    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    clearTimeout(timeout);

    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!resp.ok) {
      // Declara referencias estables para detalle; la inicialización aporta los datos que consumirá el bloque siguiente.
      const detalle = await resp.text().catch(() => '');
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return {
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        ok: false,
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        mode: 'real',
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        status: resp.status,
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        error: `HTTP ${resp.status}`,
        // Incorpora este símbolo a la declaración multilineal que lo contiene.
        detalle
      };
    }

    // Declara referencias estables para data; la inicialización aporta los datos que consumirá el bloque siguiente.
    const data = await resp.json().catch(() => ({}));
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return {
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      ok: true,
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      mode: 'real',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      status: resp.status,
      // Incorpora este símbolo a la declaración multilineal que lo contiene.
      data
    };
  // Captura el error de la operación protegida y ejecuta la recuperación definida.
  } catch (err) {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    clearTimeout(timeout);
    // Declara referencias estables para abortado; la inicialización aporta los datos que consumirá el bloque siguiente.
    const abortado = err && err.name === 'AbortError';
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return {
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      ok: false,
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      mode: 'real',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      error: abortado ? 'timeout' : 'network',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      detalle: String((err && err.message) || err)
    };
  }
}

// Declara y exporta la función submitLead; recibe payload y entrega el valor determinado por sus retornos.
export async function submitLead(payload) {
  // Declara referencias estables para conf; la inicialización aporta los datos que consumirá el bloque siguiente.
  const conf = cfg();
  // Declara referencias estables para url; la inicialización aporta los datos que consumirá el bloque siguiente.
  const url = (conf.LEADS_API_URL || '').trim();

  // En Live Server/local, DEMO_MODE o sin URL, no se toca Cloudflare.
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (usarModoDemo(conf, url)) {
    // Declara referencias estables para guardado; la inicialización aporta los datos que consumirá el bloque siguiente.
    const guardado = guardarDemo(payload);
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    console.warn(
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '[leads-service] Modo local/demo. Guardado local:',
      // Lee o persiste el estado local previsto; la operación está protegida porque el almacenamiento puede no estar disponible.
      guardado ? 'localStorage' : 'memoria',
      // Incorpora este símbolo a la declaración multilineal que lo contiene.
      payload
    );
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return { ok: true, mode: 'demo', stored: guardado };
  }

  // Declara referencias estables para resultado; la inicialización aporta los datos que consumirá el bloque siguiente.
  const resultado = await enviarReal(url, payload, conf);

  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!resultado.ok) {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    console.error('[leads-service] Fallo el envio real del lead.', resultado);
  // Define la alternativa que se ejecuta cuando la condición previa resulta falsa.
  } else {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    console.info('[leads-service] Lead enviado al endpoint.', resultado);
  }

  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return resultado;
}

// Declara y exporta la función updateLead; recibe payload y entrega el valor determinado por sus retornos.
export async function updateLead(payload) {
  // Declara referencias estables para conf; la inicialización aporta los datos que consumirá el bloque siguiente.
  const conf = cfg();
  // Declara referencias estables para url; la inicialización aporta los datos que consumirá el bloque siguiente.
  const url = (conf.LEADS_API_URL || '').trim();

  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (usarModoDemo(conf, url)) {
    // Declara referencias estables para guardado; la inicialización aporta los datos que consumirá el bloque siguiente.
    const guardado = guardarDemo(Object.assign({}, payload, { updateOnly: true }));
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    console.warn(
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '[leads-service] Modo local/demo. Actualizacion guardada local:',
      // Lee o persiste el estado local previsto; la operación está protegida porque el almacenamiento puede no estar disponible.
      guardado ? 'localStorage' : 'memoria',
      // Incorpora este símbolo a la declaración multilineal que lo contiene.
      payload
    );
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return { ok: true, mode: 'demo', stored: guardado, updated: true };
  }

  // Declara referencias estables para resultado; la inicialización aporta los datos que consumirá el bloque siguiente.
  const resultado = await enviarReal(url, payload, conf, 'PATCH');

  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!resultado.ok) {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    console.error('[leads-service] Fallo la actualizacion real del lead.', resultado);
  // Define la alternativa que se ejecuta cuando la condición previa resulta falsa.
  } else {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    console.info('[leads-service] Lead actualizado en el endpoint.', resultado);
  }

  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return resultado;
}

// Declara y exporta la función getLeadsDemo; recibe ningún argumento y entrega el valor determinado por sus retornos.
export function getLeadsDemo() {
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try {
    // Declara referencias estables para key; la inicialización aporta los datos que consumirá el bloque siguiente.
    const key = cfg().LEADS_STORAGE_KEY || 'primoffice_leads_demo';
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return JSON.parse(localStorage.getItem(key) || '[]');
  // Captura el error de la operación protegida y ejecuta la recuperación definida.
  } catch (err) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return [];
  }
}

// Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
if (typeof window !== 'undefined') {
  // Publica una API controlada en el ámbito global para que el script inline pueda consumirla.
  window.PrimOfficeLeads = { submitLead, updateLead, getLeadsDemo };
}

// Publica la API principal como exportación predeterminada para consumidores que prefieren un único objeto.
export default { submitLead, updateLead, getLeadsDemo };
