/* Config general de la landing.
   Acá van datos públicos: WhatsApp, endpoint de leads y flags simples.
   No poner contraseñas ni claves reales en este archivo. */

export const APP_CONFIG = {
  /* WhatsApp comercial en formato internacional, sin el '+'. */
  WHATSAPP_NUMBER: '5491139149688',

  /* Leads:
     false + /api/leads = envía el formulario al endpoint de Cloudflare.
     true o URL vacía = queda en localStorage para pruebas. */
  DEMO_MODE: false,
  LEADS_API_URL: '/api/leads',

  /* Si algún día hace falta token, tiene que venir desde el entorno.
     No hardcodear secretos en el repo. */
  LEADS_API_TOKEN: '',

  /* Tiempo máximo de espera del envío. */
  LEADS_TIMEOUT_MS: 10000,

  /* Clave usada solo cuando se prueba en modo demo. */
  LEADS_STORAGE_KEY: 'primoffice_leads_demo',

  /* Datos útiles para saber de dónde vino el lead. */
  LEAD_ORIGIN: 'landing-primoffice',
  LANDING_SOURCE: 'Landing PrimOffice · Test ergonómico',

  /* Odoo se conecta después desde el backend, no desde el navegador. */
  INTEGRATION: {
    crm: 'odoo',
    odooEnabled: false,
    payloadSchema: 'v1'
  },

  ANALYTICS_PREFIX: ''
};

/* Publico la config para scripts clásicos.
   El archivo manda sobre cualquier config vieja que haya quedado cacheada. */
if (typeof window !== 'undefined') {
  const runtime = window.PrimOfficeConfig || {};
  window.PrimOfficeConfig = Object.assign({}, runtime, APP_CONFIG, {
    INTEGRATION: Object.assign(
      {},
      runtime.INTEGRATION || {},
      APP_CONFIG.INTEGRATION || {}
    )
  });
}

export default APP_CONFIG;
