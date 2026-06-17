/* =====================================================================
   PrimOffice · Configuración central de la app (estática)
   ---------------------------------------------------------------------
   Punto ÚNICO para parámetros configurables del sitio.

   - Sitio 100% estático (Live Server / GitHub Pages), sin bundler.
   - NO incluir secretos ni credenciales acá: este archivo es PÚBLICO y
     viaja al navegador. Para Odoo CRM nunca se envían credenciales desde
     el front (ver docs/INTEGRACION_ODOO_CRM.md).
   - El número de WhatsApp se centraliza acá y se consume desde
     main.js, test-diagnostico.js y configurador-3d.js (no se hardcodea
     en cada script).

   Se exporta como módulo ES y, además, se publica en
   `window.PrimOfficeConfig` para consumidores que no usan módulos
   (depuración / scripts clásicos como main.js).
   ===================================================================== */

export const APP_CONFIG = {
  /* ==================================================================
     CONTACTO / CANALES
     ================================================================== */

  /* Número de WhatsApp comercial confirmado, en formato internacional
     sin '+' (para construir enlaces wa.me).  +54 11 3914-9688 */
  WHATSAPP_NUMBER: '5491139149688',

  /* ==================================================================
     LEADS / PERSISTENCIA  (preparado para Odoo CRM)
     ================================================================== */

  /* Los leads ya no quedan solo en localStorage.
     Ahora se mandan a un endpoint propio de Cloudflare.
     Primero se guardan en D1 y más adelante desde ahí se conectan con Odoo,
     sin poner credenciales visibles en el navegador. */
  DEMO_MODE: false,

  /* Endpoint interno de la landing para recibir los registros del test. */
  LEADS_API_URL: '/api/leads',

  /* Token opcional para el endpoint propio. NO hardcodear secretos reales:
     dejar vacío y, si hace falta, inyectarlo en runtime desde un entorno
     seguro (window.PrimOfficeConfig.LEADS_API_TOKEN). */
  LEADS_API_TOKEN: '',

  /* Tiempo máximo de espera (ms) para la request de leads. */
  LEADS_TIMEOUT_MS: 10000,

  /* Clave de localStorage donde el modo demo acumula los leads. */
  LEADS_STORAGE_KEY: 'primoffice_leads_demo',

  /* ==================================================================
     ORIGEN / TRAZABILIDAD
     ================================================================== */

  /* Origen declarado en cada lead (campo `source` del payload). */
  LEAD_ORIGIN: 'landing-primoffice',

  /* Nombre legible de la landing (útil para Odoo / analítica). */
  LANDING_SOURCE: 'Landing PrimOffice · Test ergonómico',

  /* ==================================================================
     FLAGS DE INTEGRACIÓN
     ================================================================== */

  INTEGRATION: {
    /* Proveedor de CRM objetivo (documentación / futuro). */
    crm: 'odoo',
    /* Cuando el backend propio esté listo, poner en true para activar el
       POST real (junto con DEMO_MODE:false y LEADS_API_URL completo). */
    odooEnabled: false,
    /* Versión del esquema de payload (por si Odoo pide cambios de mapeo). */
    payloadSchema: 'v1'
  },

  /* ==================================================================
     ANALÍTICA
     ================================================================== */

  /* Prefijo opcional para nombrar eventos de analítica. */
  ANALYTICS_PREFIX: ''
};

/* Permite override en runtime sin tocar el archivo (ej.: una variable
   global definida por el hosting o un <script> previo) y publica el objeto
   en window para consumidores no-módulo. El merge es superficial: los
   objetos anidados (INTEGRATION) se reemplazan completos si se sobreescriben. */
if (typeof window !== 'undefined') {
  window.PrimOfficeConfig = Object.assign({}, APP_CONFIG, window.PrimOfficeConfig || {});
}

export default APP_CONFIG;
