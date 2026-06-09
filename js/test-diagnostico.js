/* =====================================================================
   PrimOffice · Test ergonómico de setup (módulo ES)
   ---------------------------------------------------------------------
   Flujo: wizard 6 pasos → teaser parcial → captura OBLIGATORIA de lead →
          resultado completo → precarga del configurador 3D → WhatsApp.

   - Sitio estático (Live Server / GitHub Pages), sin bundler.
   - Accesible: roles ARIA, navegación por teclado, foco visible, errores
     con aria-live, respeta prefers-reduced-motion.
   - Persistencia desacoplada vía services/leads-service.js (modo demo si
     no hay endpoint). Payload anidado preparado para Odoo CRM
     (ver docs/INTEGRACION_ODOO_CRM.md).

   Las 6 preguntas son EXACTAMENTE las definidas por PrimOffice. No se
   recuperan las 8 preguntas de la landing anterior.
   ===================================================================== */

import { submitLead } from './services/leads-service.js';
import { APP_CONFIG } from './config/app-config.js';
import { CATALOGO, precioDe, formatARS } from './config/catalogo-precios.js';

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CFG = Object.assign({}, APP_CONFIG, window.PrimOfficeConfig || {});
  const WHATSAPP = CFG.WHATSAPP_NUMBER || '5491139149688';
  const AUTO_MS = reduceMotion ? 120 : 460; // breve transición antes de autoavanzar

  function track(nombre, datos) {
    try { if (typeof window.trackEvent === 'function') window.trackEvent(nombre, datos); } catch (e) { /* noop */ }
  }

  /* ==================================================================
     1. LAS 6 PREGUNTAS (texto literal de PrimOffice)
     Ajustes de copy documentados en el reporte:
       · Se agregó tilde a “Cómo” / “Cuál” / “Qué” donde faltaba.
       · No se alteró el sentido de ninguna pregunta.
     Todas son de selección única → permiten autoavance accesible.
     ================================================================== */
  const QUESTIONS = [
    {
      id: 'horas', categoria: 'Uso diario',
      titulo: '¿Cuántas horas por día trabajás frente a la computadora?',
      opciones: [
        { value: 'menos4', label: 'Menos de 4 horas' },
        { value: '4a6', label: 'Entre 4 y 6 horas' },
        { value: '6a8', label: 'Entre 6 y 8 horas' },
        { value: 'mas8', label: 'Más de 8 horas' }
      ]
    },
    {
      id: 'dolor', categoria: 'Ergonomía',
      titulo: '¿Terminás el día con dolor de cuello, espalda o muñecas?',
      opciones: [
        { value: 'nunca', label: 'Casi nunca' },
        { value: 'aveces', label: 'A veces' },
        { value: 'frecuente', label: 'Seguido' },
        { value: 'siempre', label: 'Casi todos los días' }
      ]
    },
    {
      id: 'modo', categoria: 'Equipo',
      titulo: '¿Cómo trabajás habitualmente con tu computadora?',
      opciones: [
        { value: 'notebook', label: 'Sólo con la notebook' },
        { value: 'notebook_monitor', label: 'Notebook + monitor externo' },
        { value: 'pc', label: 'PC de escritorio con monitor' },
        { value: 'dual', label: 'Con dos monitores o más' }
      ]
    },
    {
      id: 'escritorio', categoria: 'Orden',
      titulo: '¿Cómo describirías el estado de tu escritorio?',
      opciones: [
        { value: 'ordenado', label: 'Ordenado y despejado' },
        { value: 'normal', label: 'Normal, podría mejorar' },
        { value: 'cables', label: 'Con cables a la vista' },
        { value: 'saturado', label: 'Saturado, sin espacio libre' }
      ]
    },
    {
      id: 'silla', categoria: 'Mobiliario',
      titulo: '¿Qué silla usás para trabajar?',
      opciones: [
        { value: 'ergonomica', label: 'Una silla ergonómica' },
        { value: 'oficina', label: 'Una silla de oficina común' },
        { value: 'comedor', label: 'Una silla de comedor o cualquiera' },
        { value: 'variable', label: 'Cambio de lugar (sillón, cama…)' }
      ]
    },
    {
      id: 'queja', categoria: 'Productividad',
      titulo: '¿Cuál es tu mayor queja de productividad?',
      opciones: [
        { value: 'cansancio', label: 'Me canso o me duele el cuerpo' },
        { value: 'desorden', label: 'El desorden me distrae' },
        { value: 'cables', label: 'Pelear con cables y adaptadores' },
        { value: 'pantalla', label: 'Poca pantalla / vista cansada' }
      ]
    }
  ];

  /* ==================================================================
     2. SISTEMA DE PUNTUACIÓN
     Reutiliza las categorías del scoring previo como punto de partida.
     'yaTengo' no existe como pregunta: lo que el usuario ya tiene se
     infiere de "silla" (ergonómica) y "modo" (tiene monitor).
     ================================================================== */
  const CATEGORIAS = ['ergonomia', 'conectividad', 'iluminacion', 'orden', 'superficieTrabajo', 'mobiliario', 'usoCorporativo'];

  const CATEGORIA_LABEL = {
    ergonomia: 'Ergonomía',
    conectividad: 'Conectividad',
    iluminacion: 'Iluminación',
    orden: 'Orden y cables',
    superficieTrabajo: 'Espacio de trabajo',
    mobiliario: 'Mobiliario',
    usoCorporativo: 'Equipamiento corporativo'
  };

  const SCORING = {
    horas: {
      menos4: { ergonomia: 1 },
      '4a6': { ergonomia: 2 },
      '6a8': { ergonomia: 3, mobiliario: 1 },
      mas8: { ergonomia: 4, mobiliario: 2 }
    },
    dolor: {
      nunca: {},
      aveces: { ergonomia: 2 },
      frecuente: { ergonomia: 4 },
      siempre: { ergonomia: 5, mobiliario: 1 }
    },
    modo: {
      notebook: { ergonomia: 2, superficieTrabajo: 1, conectividad: 1 },
      notebook_monitor: { conectividad: 2, superficieTrabajo: 1 },
      pc: { superficieTrabajo: 1 },
      dual: { superficieTrabajo: 2, conectividad: 2 }
    },
    escritorio: {
      ordenado: {},
      normal: { orden: 1 },
      cables: { orden: 3, conectividad: 2 },
      saturado: { orden: 3, superficieTrabajo: 2 }
    },
    silla: {
      ergonomica: {},
      oficina: { ergonomia: 1, mobiliario: 1 },
      comedor: { ergonomia: 3, mobiliario: 2 },
      variable: { ergonomia: 3, mobiliario: 2, superficieTrabajo: 1 }
    },
    queja: {
      cansancio: { ergonomia: 3 },
      desorden: { orden: 3 },
      cables: { conectividad: 3, orden: 1 },
      pantalla: { superficieTrabajo: 2, iluminacion: 2 }
    }
  };

  /* Productos base por preset (ids del configurador 3D). */
  const PRESET_PRODUCTS = {
    basica: ['silla', 'monitor', 'soporte', 'teclado', 'mouse', 'hub', 'cables'],
    pro: ['silla', 'monitor', 'brazo', 'luz', 'teclado', 'mouse', 'hub', 'celular', 'pad', 'cables'],
    premium: ['silla', 'monitor', 'brazo', 'luz', 'notebook', 'teclado', 'mouse', 'hub', 'celular', 'pad', 'cables']
  };

  const PRODUCT_NAMES_FALLBACK = {
    silla: 'Silla ergonómica', monitor: 'Monitor externo', soporte: 'Soporte de monitor',
    brazo: 'Brazo articulado', luz: 'Luz de monitor (pLed)', notebook: 'Notebook',
    teclado: 'Teclado', mouse: 'Mouse', hub: 'Hub USB-C (pHub)', celular: 'Soporte de celular',
    cables: 'Organizador de cables (pBox)', pad: 'Pad de escritorio (pMat XL)'
  };

  const PRESET_LABEL = { basica: 'Essential', pro: 'Pro', premium: 'Executive' };
  const SIZE_LABEL = { compacto: 'Compacto', estandar: 'Estándar', amplio: 'Amplio' };
  const MODE_LABEL = { sentado: 'Sentado', standing: 'Standing desk' };

  function productName(id) {
    const api = window.PrimOfficeConfigurador3D;
    if (api && Array.isArray(api.PRODUCTOS)) {
      const p = api.PRODUCTOS.find((x) => x.id === id);
      if (p) return p.nombre;
    }
    return PRODUCT_NAMES_FALLBACK[id] || id;
  }

  function computeScores(answers) {
    const scores = {};
    CATEGORIAS.forEach((c) => { scores[c] = 0; });
    Object.keys(SCORING).forEach((stepId) => {
      const tabla = SCORING[stepId];
      const val = answers[stepId];
      if (val == null) return;
      const aporte = tabla[val];
      if (aporte) Object.keys(aporte).forEach((cat) => { scores[cat] += aporte[cat]; });
    });
    return scores;
  }

  /* Genera la recomendación completa a partir de respuestas + puntajes. */
  function derivarRecomendacion(answers) {
    const scores = computeScores(answers);
    const totalScore = CATEGORIAS.reduce((s, c) => s + scores[c], 0);

    // Categorías prioritarias (puntaje > 0, top 3)
    const ordenadas = Object.keys(scores)
      .map((k) => [k, scores[k]])
      .filter((e) => e[1] > 0)
      .sort((a, b) => b[1] - a[1]);
    const categoriasPrioritarias = ordenadas.slice(0, 3).map((e) => e[0]);
    const areasMejora = Math.min(Math.max(ordenadas.length, 1), 6);

    // Nivel → preset (horas + dolor + silla)
    const horasW = { menos4: 1, '4a6': 2, '6a8': 3, mas8: 4 }[answers.horas] || 2;
    const dolorW = { nunca: 0, aveces: 1, frecuente: 2, siempre: 3 }[answers.dolor] || 0;
    const sillaW = { ergonomica: 0, oficina: 1, comedor: 2, variable: 2 }[answers.silla] || 0;
    const nivel = horasW + dolorW + sillaW;
    const preset = nivel <= 3 ? 'basica' : nivel <= 6 ? 'pro' : 'premium';

    // Tamaño y modo de escritorio
    let tamano = preset === 'premium' ? 'amplio' : 'estandar';
    if (answers.escritorio === 'saturado') tamano = 'amplio';
    let modo = 'sentado';
    if (answers.horas === 'mas8' && (answers.dolor === 'frecuente' || answers.dolor === 'siempre')) modo = 'standing';

    // Setup completo (ids del configurador)
    const setup = new Set(PRESET_PRODUCTS[preset]);
    if (answers.queja === 'pantalla') { setup.add('monitor'); setup.add('luz'); }
    if (answers.escritorio === 'cables' || answers.queja === 'cables') { setup.add('hub'); setup.add('cables'); }
    if (answers.escritorio === 'saturado') { setup.add('pad'); setup.add('cables'); }
    if (answers.modo === 'notebook') setup.add('notebook'); // sigue usando su notebook

    // Coherencia monitor / soporte / brazo / luz
    if (setup.has('monitor')) {
      if (preset === 'basica') { setup.add('soporte'); setup.delete('brazo'); }
      else { setup.add('brazo'); setup.delete('soporte'); }
    } else {
      setup.delete('soporte'); setup.delete('brazo'); setup.delete('luz');
    }

    const productosSetup = Array.from(setup);

    // Lo que el usuario ya tiene (inferido)
    const yaTiene = new Set();
    if (answers.silla === 'ergonomica') yaTiene.add('silla');
    if (answers.modo !== 'notebook') yaTiene.add('monitor'); // ya usa monitor
    if (answers.modo === 'notebook') yaTiene.add('notebook'); // ya tiene la notebook

    const productosRecomendados = productosSetup.filter((id) => !yaTiene.has(id));

    // Total estimado (precios de referencia)
    const estimatedTotal = productosSetup.reduce((s, id) => s + precioDe(id), 0);

    return {
      scores, totalScore,
      categoriasPrioritarias,
      categoriasPrioritariasLabels: categoriasPrioritarias.map((c) => CATEGORIA_LABEL[c]),
      areasMejora,
      tamano, modo, preset,
      productosSetup,
      productosRecomendados,
      yaTiene: Array.from(yaTiene),
      estimatedTotal,
      explicacion: explicar(categoriasPrioritarias[0], preset, modo, answers)
    };
  }

  function explicar(catPrincipal, preset, modo, answers) {
    const frases = {
      ergonomia: 'cuidar tu postura y reducir las molestias al final del día',
      conectividad: 'simplificar la conectividad y dejar de pelear con cables y adaptadores',
      iluminacion: 'mejorar la iluminación y descansar la vista',
      orden: 'ordenar el escritorio y ocultar los cables para despejar la superficie',
      superficieTrabajo: 'ganar espacio de pantalla y de escritorio',
      mobiliario: 'renovar el mobiliario base para trabajar más cómodo',
      usoCorporativo: 'estandarizar varios puestos con una propuesta a medida'
    };
    const base = frases[catPrincipal] || 'mejorar la organización general de tu puesto';
    const extra = modo === 'standing'
      ? ' Como pasás muchas horas, sumamos la opción de standing desk para alternar entre estar sentado y de pie.'
      : '';
    return `Por cómo trabajás, lo más importante es ${base}. Armamos una configuración ${PRESET_LABEL[preset]} como punto de partida, que podés ajustar libremente en el configurador 3D.${extra}`;
  }

  /* ==================================================================
     3. ESTADO + REFERENCIAS DOM
     ================================================================== */
  const state = { paso: 0, answers: {}, diagnostico: null, lead: null, iniciado: false, autoTimer: null };
  const $ = (id) => document.getElementById(id);
  const dom = {};

  function cacheDom() {
    dom.section = $('test');
    dom.shell = $('testShell');
    dom.wizard = $('testWizard');
    dom.steps = $('testSteps');
    dom.stepNum = $('testStepNum');
    dom.stepCat = $('testStepCat');
    dom.progressBar = $('testProgressBar');
    dom.progressFill = $('testProgressFill');
    dom.error = $('testError');
    dom.prev = $('testPrev');
    dom.next = $('testNext');
    dom.teaser = $('testTeaser');
    dom.lead = $('testLead');
    dom.leadForm = $('testLeadForm');
    dom.result = $('testResult');
    return !!(dom.section && dom.steps && dom.next);
  }

  /* ==================================================================
     4. RENDER DEL WIZARD
     ================================================================== */
  function buildSteps() {
    dom.steps.innerHTML = '';
    QUESTIONS.forEach((q, idx) => {
      const fs = document.createElement('fieldset');
      fs.className = 'test-step';
      fs.dataset.step = String(idx);
      fs.hidden = idx !== 0;

      const legend = document.createElement('legend');
      legend.className = 'test-step-title';
      legend.id = 'testStepTitle-' + q.id;
      legend.textContent = q.titulo;
      fs.appendChild(legend);

      if (q.ayuda) {
        const help = document.createElement('p');
        help.className = 'test-step-help';
        help.textContent = q.ayuda;
        fs.appendChild(help);
      }

      const group = document.createElement('div');
      group.className = 'test-options';
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-labelledby', legend.id);
      group.dataset.tipo = 'single';
      group.dataset.step = q.id;

      q.opciones.forEach((op) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'test-option';
        btn.dataset.value = op.value;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', 'false');
        btn.tabIndex = -1;
        btn.innerHTML =
          '<span class="test-option-mark" aria-hidden="true"></span>' +
          '<span class="test-option-label">' + op.label + '</span>';
        btn.addEventListener('click', () => onOptionActivate(q, btn, true));
        group.appendChild(btn);
      });

      const first = group.querySelector('.test-option');
      if (first) first.tabIndex = 0;

      group.addEventListener('keydown', (e) => onGroupKeydown(q, group, e));
      fs.appendChild(group);
      dom.steps.appendChild(fs);
    });
  }

  function currentQuestion() { return QUESTIONS[state.paso]; }
  function currentGroup() {
    const fs = dom.steps.querySelector('.test-step[data-step="' + state.paso + '"]');
    return fs ? fs.querySelector('.test-options') : null;
  }

  /* advance=true → además de seleccionar, autoavanza (click / Enter / Espacio).
     advance=false → sólo selecciona (navegación con flechas, patrón WAI-ARIA). */
  function onOptionActivate(q, btn, advance) {
    if (!state.iniciado) { state.iniciado = true; track('diagnostico_iniciado', {}); }
    const value = btn.dataset.value;
    state.answers[q.id] = value;
    const group = btn.parentElement;
    group.querySelectorAll('.test-option').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    moveFocus(group, btn);
    clearError();

    if (advance) {
      clearTimeout(state.autoTimer);
      group.classList.add('is-locking'); // micro feedback (CSS)
      state.autoTimer = setTimeout(() => {
        group.classList.remove('is-locking');
        if (state.paso === QUESTIONS.length - 1) finalizar();
        else showStep(state.paso + 1, true);
      }, AUTO_MS);
    }
  }

  function moveFocus(group, btn) {
    group.querySelectorAll('.test-option').forEach((b) => { b.tabIndex = -1; });
    btn.tabIndex = 0;
  }

  function onGroupKeydown(q, group, e) {
    const opts = Array.from(group.querySelectorAll('.test-option'));
    const i = opts.indexOf(document.activeElement);
    let target = null;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': target = opts[(i + 1) % opts.length]; break;
      case 'ArrowLeft': case 'ArrowUp': target = opts[(i - 1 + opts.length) % opts.length]; break;
      case 'Home': target = opts[0]; break;
      case 'End': target = opts[opts.length - 1]; break;
      case ' ': case 'Enter':
        e.preventDefault();
        if (document.activeElement && document.activeElement.classList.contains('test-option')) {
          onOptionActivate(q, document.activeElement, true);
        }
        return;
      default: return;
    }
    if (target) {
      e.preventDefault();
      moveFocus(group, target);
      target.focus();
      onOptionActivate(q, target, false); // selecciona sin autoavanzar
    }
  }

  function stepIsValid(q) { return !!state.answers[q.id]; }

  function showStep(n, dir) {
    clearTimeout(state.autoTimer);
    const total = QUESTIONS.length;
    state.paso = Math.max(0, Math.min(n, total - 1));
    dom.steps.querySelectorAll('.test-step').forEach((fs) => {
      const on = Number(fs.dataset.step) === state.paso;
      fs.hidden = !on;
      if (on && !reduceMotion) { fs.classList.remove('is-in'); void fs.offsetWidth; fs.classList.add('is-in'); }
    });
    const q = currentQuestion();
    dom.stepNum.textContent = 'Paso ' + (state.paso + 1) + ' de ' + total;
    if (dom.stepCat) dom.stepCat.textContent = q.categoria || '';
    const pct = Math.round(((state.paso + 1) / total) * 100);
    dom.progressFill.style.width = pct + '%';
    dom.progressBar.setAttribute('aria-valuenow', String(state.paso + 1));
    dom.progressBar.setAttribute('aria-valuetext', 'Paso ' + (state.paso + 1) + ' de ' + total);

    dom.prev.disabled = state.paso === 0;
    dom.next.textContent = state.paso === total - 1 ? 'Ver mi adelanto' : 'Siguiente';
    clearError();

    const group = currentGroup();
    if (group) {
      const sel = group.querySelector('.test-option.is-selected') || group.querySelector('.test-option');
      group.querySelectorAll('.test-option').forEach((b) => { b.tabIndex = -1; });
      if (sel) { sel.tabIndex = 0; if (dir) sel.focus(); }
    }
  }

  function next() {
    const q = currentQuestion();
    if (!stepIsValid(q)) {
      showError('Elegí una opción para continuar.');
      const group = currentGroup();
      const first = group && group.querySelector('.test-option');
      if (first) { first.tabIndex = 0; first.focus(); }
      return;
    }
    track('diagnostico_paso_completado', { paso: state.paso + 1, pregunta: q.id });
    if (state.paso === QUESTIONS.length - 1) finalizar();
    else showStep(state.paso + 1, true);
  }

  function prev() { if (state.paso > 0) showStep(state.paso - 1, true); }

  function showError(msg) { dom.error.textContent = msg; dom.error.hidden = false; }
  function clearError() { dom.error.hidden = true; dom.error.textContent = ''; }

  /* ==================================================================
     5. TEASER (adelanto parcial · sin precios ni listado completo)
     ================================================================== */
  function finalizar() {
    clearTimeout(state.autoTimer);
    state.diagnostico = derivarRecomendacion(state.answers);
    track('diagnostico_finalizado', {
      preset: state.diagnostico.preset,
      categorias: state.diagnostico.categoriasPrioritarias,
      totalScore: state.diagnostico.totalScore
    });
    renderTeaser();
  }

  function renderTeaser() {
    const d = state.diagnostico;
    const cat0 = d.categoriasPrioritariasLabels[0] || 'tu organización';
    const cat1 = d.categoriasPrioritariasLabels[1];
    const prioridadTxt = cat1 ? (cat0 + ' y ' + cat1) : cat0;

    dom.teaser.innerHTML =
      '<div class="test-teaser-card">' +
        '<div class="test-teaser-main">' +
          '<span class="pill">Adelanto de tu diagnóstico</span>' +
          '<h3 class="test-teaser-head">Detectamos ' + d.areasMejora + ' ' +
            (d.areasMejora === 1 ? 'oportunidad' : 'oportunidades') + ' de mejora en tu setup.</h3>' +
          '<p class="test-teaser-sub">Tu prioridad principal está en <strong>' + prioridadTxt + '</strong>.</p>' +
          '<div class="test-teaser-metrics">' +
            metric('Áreas de mejora', String(d.areasMejora)) +
            metric('Prioridad principal', d.categoriasPrioritariasLabels[0] || '—') +
            metric('Nivel aproximado', PRESET_LABEL[d.preset]) +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-lg" id="testTeaserCta">Desbloquear mi recomendación</button>' +
          '<p class="test-teaser-note">Te pedimos sólo un medio de contacto para mostrarte el setup completo y guardar tu configuración.</p>' +
        '</div>' +
        '<div class="test-teaser-locked" aria-hidden="true">' +
          '<div class="test-teaser-preview">' + miniDesk() + '</div>' +
          '<div class="test-teaser-lock">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '<span>Tu setup recomendado<br>en 3D</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    switchPanel(dom.teaser);
    const cta = $('testTeaserCta');
    cta && cta.addEventListener('click', mostrarLeadForm);
    focusHeading(dom.teaser);
  }

  /* Mini escritorio decorativo (se muestra borroso/bloqueado en el teaser). */
  function miniDesk() {
    return '<div class="md-scene"><div class="md-monitor"></div><div class="md-arm"></div>' +
           '<div class="md-desk"></div><div class="md-kb"></div><div class="md-mouse"></div>' +
           '<div class="md-chair"></div><div class="md-glow"></div></div>';
  }

  function metric(k, v) {
    return '<div class="test-metric"><span class="test-metric-k">' + k + '</span><span class="test-metric-v">' + v + '</span></div>';
  }

  /* ==================================================================
     6. CAPTURA OBLIGATORIA DE LEAD
     El formulario es estático en el HTML; acá se cablea su lógica
     condicional, validación accesible y envío.
     ================================================================== */
  function mostrarLeadForm() {
    switchPanel(dom.lead);
    track('lead_form_mostrado', { preset: state.diagnostico.preset });
    focusHeading(dom.lead);
    const nombre = $('leadNombre');
    if (nombre) { try { nombre.focus({ preventScroll: true }); } catch (e) { nombre.focus(); } }
  }

  function wireLeadForm() {
    if (!dom.leadForm) return;
    const radios = dom.leadForm.querySelectorAll('input[name="canal"]');
    radios.forEach((r) => r.addEventListener('change', updateCanalFields));
    updateCanalFields();
    dom.leadForm.addEventListener('submit', onLeadSubmit);
    const back = $('testLeadBack');
    back && back.addEventListener('click', () => { switchPanel(dom.teaser); focusHeading(dom.teaser); });
  }

  function getCanal() {
    const checked = dom.leadForm.querySelector('input[name="canal"]:checked');
    return checked ? checked.value : '';
  }

  function updateCanalFields() {
    const canal = getCanal();
    toggleField('leadEmailField', 'leadEmail', canal === 'email');
    toggleField('leadWhatsappField', 'leadWhatsapp', canal === 'whatsapp');
  }
  function toggleField(wrapId, inputId, visible) {
    const wrap = $(wrapId), input = $(inputId);
    if (!wrap || !input) return;
    wrap.hidden = !visible;
    input.disabled = !visible;
    input.required = visible;
    if (!visible) clearFieldError(inputId);
  }

  function onLeadSubmit(e) {
    e.preventDefault();
    const errores = validarLead();
    if (errores.length) {
      const primero = $(errores[0].id);
      if (primero) { try { primero.focus({ preventScroll: false }); } catch (er) { primero.focus(); } }
      return;
    }
    enviarLead();
  }

  function validarLead() {
    const errores = [];
    const nombre = $('leadNombre');
    const canal = getCanal();
    const consent = $('leadConsent');
    clearAllFieldErrors();

    if (!nombre.value.trim()) errores.push(fieldError('leadNombre', 'Ingresá tu nombre.'));
    if (!canal) errores.push(fieldError('leadCanalEmail', 'Elegí cómo querés recibir el diagnóstico.', 'leadCanalError'));

    if (canal === 'email') {
      const email = $('leadEmail');
      if (!email.value.trim()) errores.push(fieldError('leadEmail', 'Ingresá tu email.'));
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) errores.push(fieldError('leadEmail', 'Revisá el formato del email.'));
    }
    if (canal === 'whatsapp') {
      const wa = $('leadWhatsapp');
      const limpio = wa.value.replace(/[\s()\-]/g, '');
      if (!wa.value.trim()) errores.push(fieldError('leadWhatsapp', 'Ingresá tu WhatsApp.'));
      else if (!/^\+?\d{8,15}$/.test(limpio)) errores.push(fieldError('leadWhatsapp', 'Ingresá un número válido (sólo dígitos).'));
    }
    if (consent && !consent.checked) errores.push(fieldError('leadConsent', 'Necesitamos tu consentimiento para continuar.', 'leadConsentError'));
    return errores;
  }

  function fieldError(inputId, msg, errorId) {
    const input = $(inputId);
    const errEl = $(errorId || (inputId + 'Error'));
    if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    if (input) input.setAttribute('aria-invalid', 'true');
    return { id: inputId, msg };
  }
  function clearFieldError(inputId, errorId) {
    const input = $(inputId);
    const errEl = $(errorId || (inputId + 'Error'));
    if (errEl) { errEl.textContent = ''; errEl.hidden = true; }
    if (input) input.removeAttribute('aria-invalid');
  }
  function clearAllFieldErrors() {
    ['leadNombre', 'leadEmail', 'leadWhatsapp'].forEach((id) => clearFieldError(id));
    clearFieldError('leadCanalEmail', 'leadCanalError');
    clearFieldError('leadConsent', 'leadConsentError');
  }

  function leerUTM() {
    const utm = {};
    try {
      const params = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
        const v = params.get(k);
        if (v) utm[k] = v;
      });
    } catch (e) { /* noop */ }
    return utm;
  }

  function generarLeadId() {
    const rnd = Math.random().toString(36).slice(2, 8);
    return 'lead_' + Date.now() + '_' + rnd;
  }

  /* Payload ANIDADO (esquema v1, preparado para Odoo CRM). */
  function construirPayload() {
    const d = state.diagnostico;
    const canal = getCanal();
    const nombre = $('leadNombre').value.trim();
    const email = canal === 'email' ? ($('leadEmail').value.trim()) : '';
    const whatsapp = canal === 'whatsapp' ? ($('leadWhatsapp').value.trim()) : '';

    return {
      leadId: generarLeadId(),
      createdAt: new Date().toISOString(),
      source: CFG.LEAD_ORIGIN || 'landing-primoffice',
      utm: leerUTM(),
      contact: {
        name: nombre,
        preferredChannel: canal || 'email',
        email: email,
        whatsapp: whatsapp,
        consent: !!($('leadConsent') && $('leadConsent').checked)
      },
      diagnosis: {
        rawAnswers: Object.assign({}, state.answers),
        totalScore: d.totalScore,
        scoresByCategory: Object.assign({}, d.scores),
        recommendedTier: PRESET_LABEL[d.preset],
        recommendedPreset: d.preset
      },
      configuration: {
        recommendedProducts: d.productosRecomendados.slice(),
        selectedProducts: d.productosSetup.slice(),
        selectedExtras: [],
        estimatedTotal: d.estimatedTotal,
        currency: CATALOGO.MONEDA || 'ARS',
        pricesConfirmed: !!CATALOGO.PRECIOS_CONFIRMADOS
      }
    };
  }

  async function enviarLead() {
    const submitBtn = dom.leadForm.querySelector('[type="submit"]');
    const payload = construirPayload();
    state.lead = payload;

    let textoPrevio = '';
    if (submitBtn) {
      textoPrevio = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      submitBtn.innerHTML = '<span class="test-btn-spinner" aria-hidden="true"></span> Procesando…';
    }

    let resultado = { ok: true, mode: 'demo' };
    try {
      resultado = await submitLead(payload);
    } catch (err) {
      console.error('[test-diagnostico] Error inesperado al enviar el lead.', err);
      resultado = { ok: false, mode: 'error', error: String(err) };
    }

    track('lead_enviado', { modo: resultado.mode, canal: payload.contact.preferredChannel });

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      submitBtn.innerHTML = textoPrevio;
    }

    // Siempre se revela el resultado, aunque falle la persistencia.
    renderResultado(resultado);
  }

  /* ==================================================================
     7. RESULTADO COMPLETO + PRECARGA 3D + WHATSAPP
     ================================================================== */
  function renderResultado(resultadoEnvio) {
    const d = state.diagnostico;
    const nombre = (state.lead && state.lead.contact && state.lead.contact.name) ? state.lead.contact.name : '';
    const prioridades = d.categoriasPrioritariasLabels.slice(0, 3);
    const aSumar = d.productosRecomendados.map(productName);

    const prioridadesHtml = prioridades.map((p, i) =>
      '<li class="test-priority"><span class="test-priority-rank">' + (i + 1) + '</span>' + p + '</li>').join('');

    const productosHtml = aSumar.length
      ? aSumar.map((n) => '<li class="test-prod"><span class="test-prod-check" aria-hidden="true">✓</span>' + n + '</li>').join('')
      : '<li class="test-prod test-prod-empty">Ya contás con buena parte del equipamiento. Te ayudamos a optimizar lo que tenés.</li>';

    dom.result.innerHTML =
      '<div class="test-result-card">' +
        '<span class="pill">Tu diagnóstico</span>' +
        '<h3 class="test-result-head">' + (nombre ? ('¡Listo, ' + escapeHtml(nombre) + '! ') : '') + 'Esta es tu recomendación.</h3>' +
        '<p class="test-result-sub">' + d.explicacion + '</p>' +
        '<div class="test-result-grid">' +
          '<div class="test-result-col">' +
            '<h4 class="test-result-label">Tus prioridades</h4>' +
            '<ul class="test-priorities">' + prioridadesHtml + '</ul>' +
            '<div class="test-reco-meta">' +
              metric('Nivel', PRESET_LABEL[d.preset]) +
              metric('Escritorio', SIZE_LABEL[d.tamano]) +
              metric('Modo', MODE_LABEL[d.modo]) +
            '</div>' +
          '</div>' +
          '<div class="test-result-col">' +
            '<h4 class="test-result-label">Te sugerimos sumar</h4>' +
            '<ul class="test-prods">' + productosHtml + '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="test-result-ctas">' +
          '<button type="button" class="btn btn-primary btn-lg" id="testGoConfig">Ajustar en el configurador 3D</button>' +
          '<button type="button" class="btn btn-wa btn-lg" id="testGoWa" data-track="whatsapp" data-context="resultado-test">' +
            waIcon() + 'Pedir asesoramiento por WhatsApp</button>' +
        '</div>' +
        demoNota(resultadoEnvio) +
      '</div>';

    switchPanel(dom.result);
    track('resultado_mostrado', { preset: d.preset, tamano: d.tamano, modo: d.modo });

    precargarConfigurador();
    $('testGoConfig') && $('testGoConfig').addEventListener('click', irAlConfigurador);
    $('testGoWa') && $('testGoWa').addEventListener('click', enviarWhatsApp);
    focusHeading(dom.result);
  }

  function demoNota(resultadoEnvio) {
    if (resultadoEnvio && resultadoEnvio.mode === 'demo') {
      return '<p class="test-result-note" role="note">Estás viendo una vista previa funcional. La conexión con el CRM de PrimOffice todavía está pendiente, así que por ahora tu consulta se completa por WhatsApp. <span class="test-todo">TODO: validar con PrimOffice</span></p>';
    }
    if (resultadoEnvio && resultadoEnvio.ok === false) {
      return '<p class="test-result-note" role="note">No pudimos registrar tu solicitud automáticamente. Podés enviarnos tu diagnóstico por WhatsApp y te respondemos.</p>';
    }
    return '';
  }

  function precargarConfigurador() {
    const d = state.diagnostico;
    waitForConfigurador().then((api) => {
      if (!api || typeof api.applyRecommendation !== 'function') return;
      try {
        api.applyRecommendation({
          preset: d.preset,
          products: d.productosSetup,
          deskSize: d.tamano,
          deskMode: d.modo
        });
      } catch (err) {
        console.warn('[test-diagnostico] No se pudo precargar el configurador 3D.', err);
      }
    });
  }

  function waitForConfigurador(timeout) {
    const api = window.PrimOfficeConfigurador3D;
    if (api && api.applyRecommendation) return Promise.resolve(api);
    return new Promise((resolve) => {
      let listo = false;
      const finish = () => { if (listo) return; listo = true; resolve(window.PrimOfficeConfigurador3D || null); };
      document.addEventListener('primoffice:configurador-listo', finish, { once: true });
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (window.PrimOfficeConfigurador3D && window.PrimOfficeConfigurador3D.applyRecommendation) { clearInterval(iv); finish(); }
        else if (Date.now() - t0 > (timeout || 4000)) { clearInterval(iv); finish(); }
      }, 120);
    });
  }

  function irAlConfigurador() {
    const target = document.getElementById('configurador');
    if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function enviarWhatsApp() {
    const d = state.diagnostico;
    const lead = (state.lead && state.lead.contact) ? state.lead.contact : {};
    const api = window.PrimOfficeConfigurador3D;
    const conf = (api && typeof api.getCurrentConfiguration === 'function') ? api.getCurrentConfiguration() : null;

    const productos = conf ? conf.productNames : d.productosSetup.map(productName);
    const extras = (conf && conf.extraNames && conf.extraNames.length) ? conf.extraNames : [];
    const total = conf && typeof conf.estimatedTotal === 'number' ? conf.estimatedTotal : d.estimatedTotal;

    const lines = [
      'Hola PrimOffice 👋',
      '',
      'Completé el test ergonómico desde la landing y quiero consultar por mi setup personalizado.',
      '',
      'Nombre: ' + (lead.name || '—'),
      'Recomendación: ' + PRESET_LABEL[d.preset],
      '',
      'Productos seleccionados:',
      ...(productos.length ? productos.map((n) => '✅ ' + n) : ['✅ (a definir)'])
    ];
    if (extras.length) { lines.push('', 'Extras:', ...extras.map((n) => '➕ ' + n)); }
    lines.push('', 'Total estimado: ' + formatARS(total) + (CATALOGO.PRECIOS_CONFIRMADOS ? '' : ' (de referencia, a confirmar)'));
    lines.push('', '¿Me pueden confirmar disponibilidad y entrega en 24hs? Gracias.');

    track('whatsapp_clicked', { contexto: 'resultado-test' });
    window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  }

  /* ==================================================================
     8. UTILIDADES DE PANEL / FOCO
     ================================================================== */
  function switchPanel(panel) {
    [dom.wizard, dom.teaser, dom.lead, dom.result].forEach((p) => { if (p) p.hidden = (p !== panel); });
    if (panel && !reduceMotion) { panel.classList.remove('is-in'); void panel.offsetWidth; panel.classList.add('is-in'); }
    if (dom.section) {
      const top = dom.section.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) {
        dom.section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }

  function focusHeading(panel) {
    const h = panel.querySelector('h3, h4, [tabindex]');
    if (h) {
      h.setAttribute('tabindex', '-1');
      try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function waIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2c-5.523 0-9.999 4.478-9.999 10 0 1.762.458 3.418 1.262 4.855L2 22l5.266-1.258A9.954 9.954 0 0012 22c5.523 0 10-4.477 10-10S17.522 2 11.999 2z"/></svg>';
  }

  /* ==================================================================
     9. ARRANQUE
     ================================================================== */
  function start() {
    if (!cacheDom()) return;
    buildSteps();
    showStep(0, false);
    dom.next.addEventListener('click', next);
    dom.prev.addEventListener('click', prev);
    wireLeadForm();

    // CTA del hero que dispara el test: scroll suave + foco al primer paso.
    document.querySelectorAll('[data-test-start]').forEach((el) => {
      el.addEventListener('click', () => {
        setTimeout(() => {
          const group = currentGroup();
          const first = group && group.querySelector('.test-option');
          if (first && !reduceMotion) first.focus({ preventScroll: true });
        }, 600);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
