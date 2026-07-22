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
(function () {
  'use strict';
  var reduce = false, fine = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { fine = window.matchMedia('(pointer:fine)').matches && window.innerWidth >= 992; } catch (e) {}

  function run() { initBackground(); setupReveal(); }

  /* ==================================================================
     ATMÓSFERA GLOBAL (canvas)
     ================================================================== */
  function initBackground() {
    var bg = document.createElement('div');
    bg.id = 'pv-bg'; bg.setAttribute('aria-hidden', 'true');
    var cv = document.createElement('canvas'); cv.id = 'pv-canvas';
    bg.appendChild(cv);
    document.body.insertBefore(bg, document.body.firstChild);

    var ctx = cv.getContext('2d');
    if (!ctx) { return; }

    var mobile = window.innerWidth < 768;
    var DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    var COUNT = mobile ? 58 : 190;
    var NEB = mobile ? 2 : 4;
    var PARA = 26; // amplitud parallax (px lógicos)

    var W = 0, H = 0;
    var sprCyan = makeSprite('56,189,248'), sprSky = makeSprite('125,211,252'), sprWhite = makeSprite('226,242,255');
    var sprites = [sprCyan, sprCyan, sprSky, sprWhite];

    var parts = [], nebula = [];
    var mx = 0, my = 0, cx = 0, cy = 0;           // cursor objetivo / suavizado
    var intensity = 0.85, targetI = 1;
    var darkEls = [];
    var raf = null, last = 0;

    function makeSprite(rgb) {
      var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
      var x = c.getContext('2d');
      var g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(' + rgb + ',0.95)');
      g.addColorStop(0.22, 'rgba(' + rgb + ',0.45)');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      return c;
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function newPart() {
  var z = rnd(0.22, 1);

  return {
    x: Math.random() * W,
    y: Math.random() * H,
    z: z,

    r: rnd(0.75, 2.35) * (0.62 + z),

    // Movimiento base CONSTANTE: nunca se frena aunque el mouse quede quieto.
    baseVx: rnd(-0.028, 0.028) * (0.55 + z),
    baseVy: rnd(-0.075, -0.022) * (0.55 + z),

    // Oscilaciones orgánicas independientes.
    drift: rnd(0.7, 1.8),
    drift2: rnd(0.6, 1.5),
    phase: rnd(0, Math.PI * 2),
    phase2: rnd(0, Math.PI * 2),

    a: rnd(0.18, 0.74),
    tw: Math.random() * Math.PI * 2,
    tws: rnd(0.7, 1.9),

    spr: sprites[(Math.random() * sprites.length) | 0]
  };
}
    function resize() {
      W = cv.width = Math.floor(window.innerWidth * DPR);
      H = cv.height = Math.floor(window.innerHeight * DPR);
      cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
    }
    function build() {
      resize();
      parts = []; for (var i = 0; i < COUNT; i++) parts.push(newPart());
      nebula = [];
      for (var n = 0; n < NEB; n++) nebula.push({
        x: Math.random(), y: Math.random(), r: rnd(0.35, 0.6),
        hue: n % 2 ? '14,165,233' : '56,189,248', ph: Math.random() * 6.28, sp: rnd(0.06, 0.13)
      });
    }

    function draw(t) {
      var dt = Math.min((t - last) || 16, 40); last = t;
      intensity += (targetI - intensity) * 0.04;
      cx += (mx - cx) * 0.06; cy += (my - cy) * 0.06;
      ctx.clearRect(0, 0, W, H);

      // Nebulosas suaves (profundidad), muy tenues y en movimiento
      ctx.globalCompositeOperation = 'lighter';
      for (var n = 0; n < nebula.length; n++) {
        var ne = nebula[n]; ne.ph += ne.sp * dt * 0.0006;
        var nx = (ne.x + Math.sin(ne.ph) * 0.06) * W;
        var ny = (ne.y + Math.cos(ne.ph * 0.8) * 0.05) * H + cy * 8 * DPR;
        var nr = ne.r * Math.min(W, H);
        var g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        g.addColorStop(0, 'rgba(' + ne.hue + ',' + (0.05 * intensity).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + ne.hue + ',0)');
        ctx.fillStyle = g; ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
      }
      // Partículas con profundidad + flujo + parallax
      var time = t * 0.001;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var flowX =
     Math.sin(time * 1.05 * p.drift + p.phase + p.y * 0.0012) * 0.018 * (0.45 + p.z);
  var flowY = Math.cos(time * 0.82 * p.drift2 + p.phase2 + p.x * 0.0010) * 0.010 * (0.45 + p.z);

// Movimiento autónomo continuo.
// El mouse solamente agrega parallax visual más abajo.
p.x += (p.baseVx + flowX) * dt * DPR;
p.y += (p.baseVy + flowY) * dt * DPR;
        p.tw += p.tws * dt * 0.0015;
        // wrap
        if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
        if (p.y < -30) p.y = H + 30; else if (p.y > H + 30) p.y = -30;
        var twinkle = 0.7 + 0.3 * Math.sin(p.tw);
        var dx = p.x + cx * p.z * PARA * DPR;
        var dy = p.y + cy * p.z * PARA * DPR;
        var size = p.r * (0.6 + p.z * 1.1) * 7 * DPR;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.a * twinkle * intensity));
        ctx.drawImage(p.spr, dx - size / 2, dy - size / 2, size, size);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    }

    function drawStatic() { // prefers-reduced-motion: un solo frame sin animación
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], size = p.r * (0.6 + p.z * 1.1) * 7 * DPR;
        ctx.globalAlpha = p.a * 0.8;
        ctx.drawImage(p.spr, p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    /* intensidad según sección (oscura ~1 / clara ~0.6) */
    function refreshDarkEls() { darkEls = Array.prototype.slice.call(document.querySelectorAll('.hero,.quiz-section,.cta-section,footer')); }
    function updateIntensity() {
      var mid = window.innerHeight * 0.5, onDark = false;
      for (var i = 0; i < darkEls.length; i++) { var r = darkEls[i].getBoundingClientRect(); if (r.top < mid && r.bottom > mid) { onDark = true; break; } }
      targetI = onDark ? 1 : 0.6;
    }

    build(); refreshDarkEls(); updateIntensity();

    var rzT = null;
    window.addEventListener('resize', function () {
      clearTimeout(rzT); rzT = setTimeout(function () { mobile = window.innerWidth < 768; build(); refreshDarkEls(); updateIntensity(); if (reduce) drawStatic(); }, 200);
    }, { passive: true });

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { updateIntensity(); ticking = false; }); }
    }, { passive: true });

    if (fine && !reduce) {
      window.addEventListener('mousemove', function (e) {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    if (reduce) { drawStatic(); return; }

    raf = requestAnimationFrame(draw);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); }
    });
  }

  /* ==================================================================
     SCROLL REVEAL (único sistema, repetible)
     ================================================================== */
  function isCard(el) {
    return el.classList && (el.classList.contains('pain-card') || el.classList.contains('combo-card') || el.classList.contains('benefit-card'));
  }
  function setupReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var SEL = '.hero__badge,.hero__title,.hero__subtitle,.hero__actions,.hero__stats,.section__label,.section__title,.section__sub,.pain-card,.combo-card,.benefit-card';
    var els = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(function (el) {
      return !el.closest('#pqLead,#quiz-result,.cart-wrapper,.navbar');
    });
    els.forEach(function (el) {
      el.classList.add('pv-rv');
      var d = 0;
      if (isCard(el)) { var sibs = Array.prototype.slice.call(el.parentNode.children).filter(isCard); d = Math.min(sibs.indexOf(el), 4) * 80; }
      el.setAttribute('data-pv-delay', d);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var el = e.target;
        if (e.intersectionRatio >= 0.12) {
          el.style.removeProperty('opacity'); el.style.removeProperty('transform'); el.style.removeProperty('transition');
          el.style.transitionDelay = (el.getAttribute('data-pv-delay') || 0) + 'ms';
          el.classList.add('pv-in');
        } else if (e.intersectionRatio <= 0.02) {
          el.style.removeProperty('opacity'); el.style.removeProperty('transform'); el.style.removeProperty('transition');
          el.style.transitionDelay = '0ms';
          el.classList.remove('pv-in');
        }
      });
    }, { threshold: [0, 0.12, 0.4], rootMargin: '-2% 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
