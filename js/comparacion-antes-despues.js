/* ════════════════════════════════════════════════════════
   COMPARACIÓN ANTES / DESPUÉS · vanilla JS, sin dependencias
   - Animación automática al entrar en viewport (una sola vez)
   - Luego queda draggable (pointer events) + accesible (teclado)
   - Scoped: solo opera sobre #ba-compare
   ════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.getElementById('ba-compare');
  if (!root) return;

  var MIN = 2, MAX = 98, REST = 50;       // posiciones en %
  var pos = 100;                          // arranca mostrando "antes"
  var animating = false;
  var dragging = false;
  var rafId = null;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setPos(p) {
    pos = Math.min(MAX, Math.max(MIN, p));
    root.style.setProperty('--ba-pos', pos + '%');
    root.setAttribute('aria-valuenow', Math.round(pos));
    root.classList.toggle('ba-hide-antes', pos < 12);
    root.classList.toggle('ba-hide-despues', pos > 88);
  }

  /* ── Animación de entrada: barrido "antes" → "después" y vuelta al centro ── */
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function tween(from, to, dur, done) {
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts - start) / dur, 1);
      setPos(from + (to - from) * easeInOutCubic(t));
      if (t < 1) { rafId = requestAnimationFrame(frame); }
      else if (done) { done(); }
    }
    rafId = requestAnimationFrame(frame);
  }

  function finish() {
    animating = false;
    root.classList.add('ba-ready');
  }

  function playIntro() {
    if (animating) return;
    animating = true;
    // 100% (antes) → 6% (revela después) → 50% (reposo interactivo)
    tween(100, 6, 1400, function () {
      tween(6, REST, 700, finish);
    });
  }

  setPos(100);

  if (reduceMotion || !('IntersectionObserver' in window)) {
    setPos(REST);
    finish();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          io.unobserve(root);
          setTimeout(playIntro, 250);
        }
      });
    }, { threshold: 0.45 });
    io.observe(root);
  }

  /* ── Drag con pointer events ── */
  function posFromEvent(ev) {
    var r = root.getBoundingClientRect();
    return ((ev.clientX - r.left) / r.width) * 100;
  }

  function cancelIntro() {
    if (animating) {
      if (rafId) cancelAnimationFrame(rafId);
      finish();
    }
  }

  root.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    cancelIntro();
    dragging = true;
    root.classList.add('ba-dragging');
    try { root.setPointerCapture(ev.pointerId); } catch (e) {}
    setPos(posFromEvent(ev));
  });

  root.addEventListener('pointermove', function (ev) {
    if (dragging) setPos(posFromEvent(ev));
  });

  function endDrag() {
    dragging = false;
    root.classList.remove('ba-dragging');
  }
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);

  /* ── Accesibilidad: teclado ── */
  root.addEventListener('keydown', function (ev) {
    var step = ev.shiftKey ? 10 : 4;
    if (ev.key === 'ArrowLeft') { cancelIntro(); setPos(pos - step); ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { cancelIntro(); setPos(pos + step); ev.preventDefault(); }
    else if (ev.key === 'Home') { cancelIntro(); setPos(MIN); ev.preventDefault(); }
    else if (ev.key === 'End') { cancelIntro(); setPos(MAX); ev.preventDefault(); }
  });
})();
