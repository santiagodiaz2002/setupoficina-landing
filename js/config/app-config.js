// GUÍA EDUCATIVA: módulo de configuración pública cargado antes de los servicios que la consumen.
// Publica la configuración en el ámbito global porque el IIFE de index.html y los servicios se comunican mediante esa interfaz.
/* Config general de la landing.
   Acá van datos públicos: WhatsApp, endpoint de leads y flags simples.
   No poner contraseñas ni claves reales en este archivo. */

// Declara y exporta la constante APP_CONFIG; otros módulos leen su valor sin reasignar esta referencia.
export const APP_CONFIG = {
  /* WhatsApp comercial en formato internacional, sin el '+'. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  WHATSAPP_NUMBER: '5491139149688',

  /* Leads:
     false + /api/leads = envía el formulario al endpoint de Cloudflare.
     true o URL vacía = queda en localStorage para pruebas. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  DEMO_MODE: false,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_API_URL: '/api/leads',

  /* Si algún día hace falta token, tiene que venir desde el entorno.
     No hardcodear secretos en el repo. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_API_TOKEN: '',

  /* Tiempo máximo de espera del envío. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_TIMEOUT_MS: 10000,

  /* Clave usada solo cuando se prueba en modo demo. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEADS_STORAGE_KEY: 'primoffice_leads_demo',

  /* Puente al carrito nativo. Se habilita explicitamente luego de configurar
     D1, los secretos y el script NubeSDK. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_ENABLED: false,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_CART_TRANSFER_URL: '/api/tiendanube/cart-transfer',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_TRANSFER_TIMEOUT_MS: 10000,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_STOREFRONT_ORIGINS: [
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'https://primoffice2.mitiendanube.com',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'https://primoffice.com.ar',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'https://www.primoffice.com.ar'
  ],

  /* Datos útiles para saber de dónde vino el lead. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LEAD_ORIGIN: 'landing-primoffice',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  LANDING_SOURCE: 'Landing PrimOffice · Test ergonómico',

  /* Odoo se conecta después desde el backend, no desde el navegador. */
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  INTEGRATION: {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    crm: 'odoo',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    odooEnabled: false,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    payloadSchema: 'v1'
  },

  // Define una entrada del objeto de configuración o estado que está construyéndose.
  ANALYTICS_PREFIX: ''
};

/* Publico la config para scripts clásicos.
   El archivo manda sobre cualquier config vieja que haya quedado cacheada. */
// Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
if (typeof window !== 'undefined') {
  // Declara referencias estables para runtime; la inicialización aporta los datos que consumirá el bloque siguiente.
  const runtime = window.PrimOfficeConfig || {};
  // Publica una API controlada en el ámbito global para que el script inline pueda consumirla.
  window.PrimOfficeConfig = Object.assign({}, runtime, APP_CONFIG, {
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    INTEGRATION: Object.assign(
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      {},
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      runtime.INTEGRATION || {},
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      APP_CONFIG.INTEGRATION || {}
    )
  });
}

// Publica la API principal como exportación predeterminada para consumidores que prefieren un único objeto.
export default APP_CONFIG;
