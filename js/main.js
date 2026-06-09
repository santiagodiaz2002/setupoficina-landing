/* =====================================================================
   PrimOffice · main.js
   ---------------------------------------------------------------------
   Script clásico (no módulo) que se carga ANTES de los módulos ES.
   Responsable de:
     · Analítica central: window.trackEvent (dataLayer + CustomEvent).
     · Navegación (menú móvil, sombra del header al hacer scroll).
     · Formulario de contacto/asesoramiento (WhatsApp).
     · Wiring genérico de eventos de WhatsApp y catálogo.
   La lógica del configurador vive en js/configurador-3d.js y la del test
   diagnóstico en js/test-diagnostico.js.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     ANALÍTICA (FASE 12)
     Función central, sin dependencia de un proveedor externo todavía.
     - Empuja a window.dataLayer si existe (GTM-friendly).
     - Emite un CustomEvent('primoffice:track') para escuchas internas.
     ------------------------------------------------------------------ */
  var CFG = (window.PrimOfficeConfig || {});
  var PREFIX = CFG.ANALYTICS_PREFIX || '';

  function trackEvent(nombre, datos) {
    var evento = PREFIX ? PREFIX + nombre : nombre;
    var payload = Object.assign({ event: evento, ts: Date.now() }, datos || {});
    try {
      window.dataLayer = window.dataLayer || [];
      window