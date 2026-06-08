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
      window.dataLayer.push(payload);
    } catch (e) { /* noop */ }
    try {
      document.dispatchEvent(new CustomEvent('primoffice:track', { detail: payload }));
    } catch (e) { /* noop */ }
    // Traza ligera en desarrollo; no rompe si la consola no existe.
    try { console.debug('[trackEvent]', evento, datos || {}); } catch (e) { /* noop */ }
  }
  window.trackEvent = trackEvent;

  /* ------------------------------------------------------------------
     NAVEGACIÓN
     ------------------------------------------------------------------ */
  var hamburger = document.getElementById('hamburger');
  var mobileNav = document.getElementById('mobileNav');
  var mobileClose = document.getElementById('mobileClose');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () { mobileNav.classList.add('open'); });
  }
  if (mobileClose && mobileNav) {
    mobileClose.addEventListener('click', function () { mobileNav.classList.remove('open'); });
  }
  if (mobileNav) {
    mobileNav.addEventListener('click', function (e) { if (e.target === mobileNav) mobileNav.classList.remove('open'); });
  }
  document.querySelectorAll('.ml').forEach(function (l) {
    l.addEventListener('click', function () { mobileNav && mobileNav.classList.remove('open'); });
  });

  var header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.style.boxShadow = window.scrollY > 20 ? '0 8px 32px rgba(7,17,31,.10)' : 'none';
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     WIRING GENÉRICO DE ANALÍTICA (WhatsApp / Catálogo)
     Delegación de eventos: cubre enlaces presentes y futuros.
     ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute && a.getAttribute('href');

    // WhatsApp: cualquier enlace a wa.me o marcado con data-track="whatsapp"
    if ((href && href.indexOf('wa.me') !== -1) || (a.dataset && a.dataset.track === 'whatsapp')) {
      trackEvent('whatsapp_clicked', { contexto: (a.dataset && a.dataset.context) || 'generico' });
      return;
    }
    // Catálogo: enlaces a la tienda o marcados con data-track="catalogo"
    if ((href && href.indexOf('primoffice.com.ar/productos') !== -1) || (a.dataset && a.dataset.track === 'catalogo')) {
      trackEvent('catalogo_clicked', { contexto: (a.dataset && a.dataset.context) || 'generico' });
    }
  }, { passive: true });

  /* ------------------------------------------------------------------
     FORMULARIO DE CONTACTO / ASESORAMIENTO (secundario al test)
     Arma un mensaje de WhatsApp con lo ingresado. No publica datos
     comerciales no validados ni promete plazos.
     ------------------------------------------------------------------ */
  function handleLead(event) {
    event.preventDefault();
    var data = new FormData(event.target);
    var nombre = data.get('nombre') || '';
    var contacto = data.get('contacto') || '';
    var setup = data.get('setup') || '';
    var comentario = data.get('comentario') || '';
    var wa = CFG.WHATSAPP_NUMBER || '5491139149688';
    var lines = [
      'Hola PrimOffice, quiero asesoramiento para mejorar mi setup.',
      '',
      'Nombre: ' + nombre,
      'Contacto: ' + contacto,
      'Interes: ' + setup,
      comentario ? 'Comentario: ' + comentario : ''
    ].filter(Boolean);
    trackEvent('contacto_enviado', { interes: setup });
    window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  }
  // Expuesto globalmente para el atributo onsubmit del formulario de contacto.
  window.handleLead = handleLead;
})();
