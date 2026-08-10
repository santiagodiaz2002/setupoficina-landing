// GUÍA EDUCATIVA: script clásico diferido que crea el fondo atmosférico y el sistema visual de aparición al hacer scroll.
// No modifica quiz, leads ni carrito; index.html lo carga después de parsear el documento.
/* =====================================================================
   PrimOffice · Fondo atmosférico continuo + scroll reveal (decorativo)
   ---------------------------------------------------------------------
   - UNA atmósfera global animada en un <canvas> liviano (partículas con
     profundidad, flujo suave, parallax de cursor en desktop, intensidad
     por sección). Reemplaza el viejo fondo por secciones (auras): NO MÁS.
   - Un único sistema de scroll-reveal (repetible).
   - Respeta prefers-reduced-motion, mobile y dispositivos táctiles.
   - No toca copy, layout, test, lead, carrito, configurador ni WhatsApp.
   Autocontenido (se enlaza con <script defer>).
   ===================================================================== */
// Abre una función autoejecutable que mantiene privado el estado interno y evita colisiones con otros archivos.
(function () {
  // Activa el modo estricto para detectar asignaciones accidentales y aplicar reglas más seguras del lenguaje.
  'use strict';
  // Declara estado mutable para reduce, fine; la inicialización aporta los datos que consumirá el bloque siguiente.
  var reduce = false, fine = false;
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try { fine = window.matchMedia('(pointer:fine)').matches && window.innerWidth >= 992; } catch (e) {}

  // Declara la función run; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function run() { initBackground(); setupReveal(); }

  /* ==================================================================
     ATMÓSFERA GLOBAL (canvas)
     ================================================================== */
  // Declara la función initBackground; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function initBackground() {
    // Declara estado mutable para bg; la inicialización aporta los datos que consumirá el bloque siguiente.
    var bg = document.createElement('div');
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    bg.id = 'pv-bg'; bg.setAttribute('aria-hidden', 'true');
    // Declara estado mutable para cv; la inicialización aporta los datos que consumirá el bloque siguiente.
    var cv = document.createElement('canvas'); cv.id = 'pv-canvas';
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    bg.appendChild(cv);
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    document.body.insertBefore(bg, document.body.firstChild);

    // Declara estado mutable para ctx; la inicialización aporta los datos que consumirá el bloque siguiente.
    var ctx = cv.getContext('2d');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!ctx) { return; }

    // Declara estado mutable para mobile; la inicialización aporta los datos que consumirá el bloque siguiente.
    var mobile = window.innerWidth < 768;
    // Declara estado mutable para DPR; la inicialización aporta los datos que consumirá el bloque siguiente.
    var DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    // Declara estado mutable para COUNT; la inicialización aporta los datos que consumirá el bloque siguiente.
    var COUNT = mobile ? 58 : 190;
    // Declara estado mutable para NEB; la inicialización aporta los datos que consumirá el bloque siguiente.
    var NEB = mobile ? 2 : 4;
    // Declara estado mutable para PARA; la inicialización aporta los datos que consumirá el bloque siguiente.
    var PARA = 26; // amplitud parallax (px lógicos)

    // Declara estado mutable para W, H; la inicialización aporta los datos que consumirá el bloque siguiente.
    var W = 0, H = 0;
    // Declara estado mutable para sprCyan, sprSky, sprWhite; la inicialización aporta los datos que consumirá el bloque siguiente.
    var sprCyan = makeSprite('56,189,248'), sprSky = makeSprite('125,211,252'), sprWhite = makeSprite('226,242,255');
    // Declara estado mutable para sprites; la inicialización aporta los datos que consumirá el bloque siguiente.
    var sprites = [sprCyan, sprCyan, sprSky, sprWhite];

    // Declara estado mutable para parts, nebula; la inicialización aporta los datos que consumirá el bloque siguiente.
    var parts = [], nebula = [];
    // Declara estado mutable para mx, my, cx, cy; la inicialización aporta los datos que consumirá el bloque siguiente.
    var mx = 0, my = 0, cx = 0, cy = 0;           // cursor objetivo / suavizado
    // Declara estado mutable para intensity, targetI; la inicialización aporta los datos que consumirá el bloque siguiente.
    var intensity = 0.85, targetI = 1;
    // Declara estado mutable para darkEls; la inicialización aporta los datos que consumirá el bloque siguiente.
    var darkEls = [];
    // Declara estado mutable para raf, last; la inicialización aporta los datos que consumirá el bloque siguiente.
    var raf = null, last = 0;

    // Declara la función makeSprite; recibe rgb y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function makeSprite(rgb) {
      // Declara estado mutable para s, c; la inicialización aporta los datos que consumirá el bloque siguiente.
      var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
      // Declara estado mutable para x; la inicialización aporta los datos que consumirá el bloque siguiente.
      var x = c.getContext('2d');
      // Declara estado mutable para g; la inicialización aporta los datos que consumirá el bloque siguiente.
      var g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      g.addColorStop(0, 'rgba(' + rgb + ',0.95)');
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      g.addColorStop(0.22, 'rgba(' + rgb + ',0.45)');
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return c;
    }
    // Declara la función rnd; recibe a, b y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function rnd(a, b) { return a + Math.random() * (b - a); }
    // Declara la función newPart; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function newPart() {
  // Declara estado mutable para z; la inicialización aporta los datos que consumirá el bloque siguiente.
  var z = rnd(0.22, 1);

  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    x: Math.random() * W,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    y: Math.random() * H,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    z: z,

    // Define una entrada del objeto de configuración o estado que está construyéndose.
    r: rnd(0.75, 2.35) * (0.62 + z),

    // Movimiento base CONSTANTE: nunca se frena aunque el mouse quede quieto.
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    baseVx: rnd(-0.028, 0.028) * (0.55 + z),
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    baseVy: rnd(-0.075, -0.022) * (0.55 + z),

    // Oscilaciones orgánicas independientes.
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    drift: rnd(0.7, 1.8),
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    drift2: rnd(0.6, 1.5),
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    phase: rnd(0, Math.PI * 2),
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    phase2: rnd(0, Math.PI * 2),

    // Define una entrada del objeto de configuración o estado que está construyéndose.
    a: rnd(0.18, 0.74),
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    tw: Math.random() * Math.PI * 2,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    tws: rnd(0.7, 1.9),

    // Define una entrada del objeto de configuración o estado que está construyéndose.
    spr: sprites[(Math.random() * sprites.length) | 0]
  };
}
    // Declara la función resize; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function resize() {
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      W = cv.width = Math.floor(window.innerWidth * DPR);
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      H = cv.height = Math.floor(window.innerHeight * DPR);
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
    }
    // Declara la función build; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function build() {
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      resize();
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      parts = []; for (var i = 0; i < COUNT; i++) parts.push(newPart());
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      nebula = [];
      // Repite el bloque mientras se mantenga la condición y actualiza el estado de cada iteración.
      for (var n = 0; n < NEB; n++) nebula.push({
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        x: Math.random(), y: Math.random(), r: rnd(0.35, 0.6),
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        hue: n % 2 ? '14,165,233' : '56,189,248', ph: Math.random() * 6.28, sp: rnd(0.06, 0.13)
      });
    }

    // Declara la función draw; recibe t y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function draw(t) {
      // Declara estado mutable para dt; la inicialización aporta los datos que consumirá el bloque siguiente.
      var dt = Math.min((t - last) || 16, 40); last = t;
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      intensity += (targetI - intensity) * 0.04;
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      cx += (mx - cx) * 0.06; cy += (my - cy) * 0.06;
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      ctx.clearRect(0, 0, W, H);

      // Nebulosas suaves (profundidad), muy tenues y en movimiento
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      ctx.globalCompositeOperation = 'lighter';
      // Repite el bloque mientras se mantenga la condición y actualiza el estado de cada iteración.
      for (var n = 0; n < nebula.length; n++) {
        // Declara estado mutable para ne; la inicialización aporta los datos que consumirá el bloque siguiente.
        var ne = nebula[n]; ne.ph += ne.sp * dt * 0.0006;
        // Declara estado mutable para nx; la inicialización aporta los datos que consumirá el bloque siguiente.
        var nx = (ne.x + Math.sin(ne.ph) * 0.06) * W;
        // Declara estado mutable para ny; la inicialización aporta los datos que consumirá el bloque siguiente.
        var ny = (ne.y + Math.cos(ne.ph * 0.8) * 0.05) * H + cy * 8 * DPR;
        // Declara estado mutable para nr; la inicialización aporta los datos que consumirá el bloque siguiente.
        var nr = ne.r * Math.min(W, H);
        // Declara estado mutable para g; la inicialización aporta los datos que consumirá el bloque siguiente.
        var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        g.addColorStop(0, 'rgba(' + ne.hue + ',' + (0.05 * intensity).toFixed(3) + ')');
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        g.addColorStop(1, 'rgba(' + ne.hue + ',0)');
        // Actualiza el estado con el valor calculado a la derecha de la asignación.
        ctx.fillStyle = g; ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
      }
      // Partículas con profundidad + flujo + parallax
      // Declara estado mutable para time; la inicialización aporta los datos que consumirá el bloque siguiente.
      var time = t * 0.001;
      // Repite el bloque mientras se mantenga la condición y actualiza el estado de cada iteración.
      for (var i = 0; i < parts.length; i++) {
        // Declara estado mutable para p; la inicialización aporta los datos que consumirá el bloque siguiente.
        var p = parts[i];
        // Declara estado mutable para flowX; la inicialización aporta los datos que consumirá el bloque siguiente.
        var flowX =
     // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
     Math.sin(time * 1.05 * p.drift + p.phase + p.y * 0.0012) * 0.018 * (0.45 + p.z);
  // Declara estado mutable para flowY; la inicialización aporta los datos que consumirá el bloque siguiente.
  var flowY = Math.cos(time * 0.82 * p.drift2 + p.phase2 + p.x * 0.0010) * 0.010 * (0.45 + p.z);

// Movimiento autónomo continuo.
// El mouse solamente agrega parallax visual más abajo.
// Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
p.x += (p.baseVx + flowX) * dt * DPR;
// Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
p.y += (p.baseVy + flowY) * dt * DPR;
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        p.tw += p.tws * dt * 0.0015;
        // wrap
        // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
        if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
        // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
        if (p.y < -30) p.y = H + 30; else if (p.y > H + 30) p.y = -30;
        // Declara estado mutable para twinkle; la inicialización aporta los datos que consumirá el bloque siguiente.
        var twinkle = 0.7 + 0.3 * Math.sin(p.tw);
        // Declara estado mutable para dx; la inicialización aporta los datos que consumirá el bloque siguiente.
        var dx = p.x + cx * p.z * PARA * DPR;
        // Declara estado mutable para dy; la inicialización aporta los datos que consumirá el bloque siguiente.
        var dy = p.y + cy * p.z * PARA * DPR;
        // Declara estado mutable para size; la inicialización aporta los datos que consumirá el bloque siguiente.
        var size = p.r * (0.6 + p.z * 1.1) * 7 * DPR;
        // Actualiza el estado con el valor calculado a la derecha de la asignación.
        ctx.globalAlpha = Math.max(0, Math.min(1, p.a * twinkle * intensity));
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        ctx.drawImage(p.spr, dx - size / 2, dy - size / 2, size, size);
      }
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // Coordina el trabajo visual con el próximo ciclo de pintado del navegador.
      raf = requestAnimationFrame(draw);
    }

    // Declara la función drawStatic; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function drawStatic() { // prefers-reduced-motion: un solo frame sin animación
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
      // Repite el bloque mientras se mantenga la condición y actualiza el estado de cada iteración.
      for (var i = 0; i < parts.length; i++) {
        // Declara estado mutable para p, size; la inicialización aporta los datos que consumirá el bloque siguiente.
        var p = parts[i], size = p.r * (0.6 + p.z * 1.1) * 7 * DPR;
        // Actualiza el estado con el valor calculado a la derecha de la asignación.
        ctx.globalAlpha = p.a * 0.8;
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        ctx.drawImage(p.spr, p.x - size / 2, p.y - size / 2, size, size);
      }
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    /* intensidad según sección (oscura ~1 / clara ~0.6) */
    // Declara la función refreshDarkEls; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function refreshDarkEls() { darkEls = Array.prototype.slice.call(document.querySelectorAll('.hero,.quiz-section,.cta-section,footer')); }
    // Declara la función updateIntensity; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
    function updateIntensity() {
      // Declara estado mutable para mid, onDark; la inicialización aporta los datos que consumirá el bloque siguiente.
      var mid = window.innerHeight * 0.5, onDark = false;
      // Repite el bloque mientras se mantenga la condición y actualiza el estado de cada iteración.
      for (var i = 0; i < darkEls.length; i++) { var r = darkEls[i].getBoundingClientRect(); if (r.top < mid && r.bottom > mid) { onDark = true; break; } }
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      targetI = onDark ? 1 : 0.6;
    }

    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    build(); refreshDarkEls(); updateIntensity();

    // Declara estado mutable para rzT; la inicialización aporta los datos que consumirá el bloque siguiente.
    var rzT = null;
    // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
    window.addEventListener('resize', function () {
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      clearTimeout(rzT); rzT = setTimeout(function () { mobile = window.innerWidth < 768; build(); refreshDarkEls(); updateIntensity(); if (reduce) drawStatic(); }, 200);
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    }, { passive: true });

    // Declara estado mutable para ticking; la inicialización aporta los datos que consumirá el bloque siguiente.
    var ticking = false;
    // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
    window.addEventListener('scroll', function () {
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (!ticking) { ticking = true; requestAnimationFrame(function () { updateIntensity(); ticking = false; }); }
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    }, { passive: true });

    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (fine && !reduce) {
      // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
      window.addEventListener('mousemove', function (e) {
        // Actualiza el estado con el valor calculado a la derecha de la asignación.
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        // Actualiza el estado con el valor calculado a la derecha de la asignación.
        my = (e.clientY / window.innerHeight - 0.5) * 2;
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      }, { passive: true });
    }

    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (reduce) { drawStatic(); return; }

    // Coordina el trabajo visual con el próximo ciclo de pintado del navegador.
    raf = requestAnimationFrame(draw);
    // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
    document.addEventListener('visibilitychange', function () {
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
      // Prueba una condición alternativa sólo cuando las ramas anteriores no se cumplieron.
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); }
    });
  }

  /* ==================================================================
     SCROLL REVEAL (único sistema, repetible)
     ================================================================== */
  // Declara la función isCard; recibe el y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function isCard(el) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return el.classList && (el.classList.contains('pain-card') || el.classList.contains('combo-card') || el.classList.contains('benefit-card'));
  }
  // Declara la función setupReveal; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setupReveal() {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (reduce || !('IntersectionObserver' in window)) return;
    // Declara estado mutable para SEL; la inicialización aporta los datos que consumirá el bloque siguiente.
    var SEL = '.hero__badge,.hero__title,.hero__subtitle,.hero__actions,.hero__stats,.section__label,.section__title,.section__sub,.pain-card,.combo-card,.benefit-card';
    // Declara estado mutable para els; la inicialización aporta los datos que consumirá el bloque siguiente.
    var els = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(function (el) {
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return !el.closest('#pqLead,#quiz-result,.cart-wrapper,.navbar');
    });
    // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
    els.forEach(function (el) {
      // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
      el.classList.add('pv-rv');
      // Declara estado mutable para d; la inicialización aporta los datos que consumirá el bloque siguiente.
      var d = 0;
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (isCard(el)) { var sibs = Array.prototype.slice.call(el.parentNode.children).filter(isCard); d = Math.min(sibs.indexOf(el), 4) * 80; }
      // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
      el.setAttribute('data-pv-delay', d);
    });
    // Declara estado mutable para io; la inicialización aporta los datos que consumirá el bloque siguiente.
    var io = new IntersectionObserver(function (entries) {
      // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
      entries.forEach(function (e) {
        // Declara estado mutable para el; la inicialización aporta los datos que consumirá el bloque siguiente.
        var el = e.target;
        // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
        if (e.intersectionRatio >= 0.12) {
          // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
          el.style.removeProperty('opacity'); el.style.removeProperty('transform'); el.style.removeProperty('transition');
          // Actualiza el estado con el valor calculado a la derecha de la asignación.
          el.style.transitionDelay = (el.getAttribute('data-pv-delay') || 0) + 'ms';
          // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
          el.classList.add('pv-in');
        // Prueba una condición alternativa sólo cuando las ramas anteriores no se cumplieron.
        } else if (e.intersectionRatio <= 0.02) {
          // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
          el.style.removeProperty('opacity'); el.style.removeProperty('transform'); el.style.removeProperty('transition');
          // Actualiza el estado con el valor calculado a la derecha de la asignación.
          el.style.transitionDelay = '0ms';
          // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
          el.classList.remove('pv-in');
        }
      });
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    }, { threshold: [0, 0.12, 0.4], rootMargin: '-2% 0px -8% 0px' });
    // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
    els.forEach(function (el) { io.observe(el); });
  }

  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  // Define la alternativa que se ejecuta cuando la condición previa resulta falsa.
  else run();
})();
