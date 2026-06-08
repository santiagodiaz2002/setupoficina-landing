/* =====================================================================
   PrimOffice · Configuración central de la app (estática)
   ---------------------------------------------------------------------
   Punto único para parámetros configurables del sitio.
   - Sitio 100% estático (Live Server / GitHub Pages), sin bundler.
   - NO incluir secretos ni credenciales acá: este archivo es público.
   - El endpoint real de leads se completa cuando PrimOffice lo provea
     (ver docs/INTEGRACION_BASE_DATOS.md).

   Se exporta como módulo ES y, además, se publica en `window.PrimOfficeConfig`
   para consumidores que no usan módulos (depuración / scripts clásicos).
   ===================================================================== */

export const APP_CONFIG = {
  /* ------------------------------------------------------------------
     LEADS / PERSISTENCIA
     ------------------------------------------------------------------ */

  /* URL del endpoint que recibe los leads por POST.
     Mientras esté vacío (''), el servicio funciona en MODO DEMO:
     guarda el lead en localStorage y deja la integración real pendiente.
     Para conectar el backend real, completar esta URL (o sobreescribir
     window.PrimOfficeConfig.LEADS_API_URL antes de cargar el sitio). */
  LEADS_API_URL: '',

  /* Token opcional para el endpoint. NO hardcodear secretos reales:
     dejar vacío y, si el backend lo requiere, inyectarlo en runtime
     desde un entorno seguro. Ver docs/INTEGRACION_BASE_DATOS.md. */
  LEADS_API_TOKEN: '',

  /* Tiempo máximo de espera (ms) para la request de leads. */
  LEADS_TIMEOUT_MS: 10000,

  /* Clave de localStorage donde el modo demo acumula los leads. */
  LEADS_STORAGE_KEY: 'primoffice_leads_demo',

  /* ------------------------------------------------------------------
     CONTACTO / CANALES
     ------------------------------------------------------------------ */

  /* Número de WhatsApp en formato internacional sin '+' (wa.me). */
  WHATSAPP_NUMBER: '5491139149688',

  /* ------------------------------------------------------------------
     ANALÍTICA
     ------------------------------------------------------------------ */

  /* Prefijo opcional para nombrar eventos de analítica. */
  ANALYTICS_PREFIX: '',

  /* Origen declarado en cada lead (trazabilidad). */
  LEAD_ORIGIN: 'landing-setup-oficina'
};

/* Permite override en runtime sin tocar el archivo (ej.: una variable
   global definida por el hosting o un <script> previo) y publica el
   objeto en window para consumidores no-módulo. */
if (typeof window !== 'undefined') {
  window.PrimOfficeConfig = Object.assign({}, APP_CONFIG, window.PrimOfficeConfig || {});
}

export default APP_CONFIG;
