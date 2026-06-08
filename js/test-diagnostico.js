/* =====================================================================
   PrimOffice · Test diagnóstico de setup (módulo ES)
   ---------------------------------------------------------------------
   Flujo: wizard 8 pasos → teaser → captura de lead → resultado →
          precarga del configurador 3D → WhatsApp con la configuración.

   - Sitio estático (Live Server / GitHub Pages), sin bundler.
   - Accesible: roles ARIA, navegación por teclado, foco visible, errores
     con aria-live, respeta prefers-reduced-motion.
   - Persistencia desacoplada vía services/leads-service.js (modo demo si
     no hay endpoint configurado).
   ===================================================================== */

import { submitLead } from './services/leads-service.js';
import { APP_CONFIG } from './config/app-config.js';

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CFG = Object.assign({}, APP_CONFIG, window.PrimOfficeConfig || {});
  const WHATSAPP = CFG.WHATSAPP_NUMBER || '5491139149688';

  function track(nombre, datos) {
    try { if (typeof window.trackEvent === 'function') window.trackEvent(nombre, datos); } catch (e) { /* noop */ }
  }

  /* ==================================================================
     1. DATOS DEL TEST (preguntas y opciones)
     ================================================================== */
  const QUESTIONS = [
    {
      id: 'lugar', tipo: 'single', categoria: 'Lugar de trabajo',
      titulo: '¿Dónde utilizás principalmente tu espacio de trabajo?',
      opciones: [
        { value: 'casa', label: 'Casa' },
        { value: 'oficina', label: 'Oficina' },
        { value: 'hibrida', label: 'Modalidad híbrida' }
      ]
    },
    {
      id: 'horas', tipo: 'single', categoria: 'Uso diario',
      titulo: '¿Cuántas horas por día utilizás el escritorio?',
      opciones: [
        { value: 'menos4', label: 'Menos de 4 horas' },
        { value: '4a6', label: 'Entre 4 y 6 horas' },
        { value: '6a8', label: 'Entre 6 y 8 horas' },
        { value: 'mas8', label: 'Más de 8 horas' }
      ]
    },
    {
      id: 'dispositivos', tipo: 'multi', min: 1, categoria: 'Dispositivos',
      titulo: '¿Qué dispositivos utilizás habitualmente?',
      ayuda: 'Podés elegir varios.',
      opciones: [
        { value: 'notebook', label: 'Notebook' },
        { value: 'monitor', label: 'Monitor externo' },
        { value: 'celular', label: 'Celular' },
        { value: 'teclado', label: 'Teclado externo' },
        { value: 'mouse', label: 'Mouse' },
        { value: 'otros', label: 'Otros' }
      ]
    },
    {
      id: 'mejorar', tipo: 'multi', min: 1, categoria: 'Objetivos',
      titulo: '¿Qué aspectos querés mejorar?',
      ayuda: 'Elegí todo lo que aplique.',
      opciones: [
        { value: 'comodidad', label: 'Comodidad' },
        { value: 'postura', label: 'Postura' },
        { value: 'orden', label: 'Orden' },
        { value: 'cables', label: 'Cables' },
        { value: 'iluminacion', label: 'Iluminación' },
        { value: 'conectividad', label: 'Conectividad' },
        { value: 'espacio', label: 'Espacio disponible' },
        { value: 'estetica', label: 'Estética' }
      ]
    },
    {
      id: 'yaTengo', tipo: 'multi', min: 1, categoria: 'Lo que ya tenés', exclusivo: 'ninguno',
      titulo: '¿Qué elementos ya tenés?',
      ayuda: 'Nos ayuda a no recomendarte algo que ya tengas.',
      opciones: [
        { value: 'silla', label: 'Silla ergonómica' },
        { value: 'monitor', label: 'Monitor' },
        { value: 'soporte', label: 'Soporte de monitor' },
        { value: 'brazo', label: 'Brazo articulado' },
        { value: 'luz', label: 'Luz de monitor' },
        { value: 'notebook', label: 'Notebook' },
        { value: 'teclado', label: 'Teclado externo' },
        { value: 'mouse', label: 'Mouse ergonómico' },
        { value: 'hub', label: 'Hub USB-C' },
        { value: 'celular', label: 'Soporte de celular' },
        { value: 'cables', label: 'Organizador de cables' },
        { value: 'pad', label: 'Pad de escritorio' },
        { value: 'standing', label: 'Standing desk' },
        { value: 'ninguno', label: 'Ninguno' }
      ]
    },
    {
      id: 'espacio', tipo: 'single', categoria: 'Espacio',
      titulo: '¿Cuánto espacio tenés disponible?',
      opciones: [
        { value: 'compacto', label: 'Compacto' },
        { value: 'estandar', label: 'Estándar' },
        { value: 'amplio', label: 'Amplio' }
      ]
    },
    {
      id: 'prioridad', tipo: 'single', categoria: 'Prioridad',
      titulo: '¿Qué querés priorizar?',
      opciones: [
        { value: 'comodidad', label: 'Comodidad' },
        { value: 'productividad', label: 'Productividad' },
        { value: 'estetica', label: 'Estética' },
        { value: 'completa', label: 'Solución completa' }
      ]
    },
    {
      id: 'paraQuien', tipo: 'single', categoria: 'Alcance',
      titulo: '¿Para quién es el setup?',
      opciones: [
        { value: 'personal', label: 'Uso personal' },
        { value: 'empresa', label: 'Varios puestos para una empresa' }
      ]
    }
  ];

  /* ==================================================================
     2. SISTEMA DE PUNTUACIÓN (FASE 6)
     Estructura central, legible y configurable. Cada respuesta suma
     puntajes explícitos por categoría. 'yaTengo' no puntúa: se usa para
     filtrar productos y evitar recomendar compras innecesarias.
     ================================================================== */
  const CATEGORIAS = ['ergonomia', 'conectividad', 'iluminacion', 'orden', 'superficieTrabajo', 'mobiliario', 'usoCorporativo'];

  const CATEGORIA_LABEL = {
    ergonomia: 'Ergonomía',
    conectividad: 'Conectividad',
    iluminacion: 'Iluminación',
    orden: 'Orden y cables',
    superficieTrabajo: 'Superficie de trabajo',
    mobiliario: 'Mobiliario',
    usoCorporativo: 'Equipamiento corporativo'
  };

  const SCORING = {
    lugar: {
      casa: { mobiliario: 2, ergonomia: 1 },
      oficina: { orden: 1, usoCorporativo: 1 },
      hibrida: { conectividad: 2, mobiliario: 1 }
    },
    horas: {
      menos4: { ergonomia: 1 },
      '4a6': { ergonomia: 2 },
      '6a8': { ergonomia: 3, mobiliario: 1 },
      mas8: { ergonomia: 4, mobiliario: 2 }
    },
    dispositivos: {
      notebook: { ergonomia: 1, conectividad: 1 },
      monitor: { superficieTrabajo: 1, ergonomia: 1 },
      celular: { orden: 1 },
      teclado: { superficieTrabajo: 1 },
      mouse: { ergonomia: 1 },
      otros: { conectividad: 1 }
    },
    mejorar: {
      comodidad: { ergonomia: 3 },
      postura: { ergonomia: 3 },
      orden: { orden: 3 },
      cables: { orden: 2, conectividad: 2 },
      iluminacion: { iluminacion: 3 },
      conectividad: { conectividad: 3 },
      espacio: { superficieTrabajo: 3 },
      estetica: { orden: 1, mobiliario: 1 }
    },
    espacio: {
      compacto: { superficieTrabajo: 1 },
      estandar: {},
      amplio: { mobiliario: 1 }
    },
    prioridad: {
      comodidad: { ergonomia: 2 },
      productividad: { conectividad: 2, superficieTrabajo: 1 },
      estetica: { orden: 2, iluminacion: 1 },
      completa: { ergonomia: 1, conectividad: 1, iluminacion: 1, orden: 1, superficieTrabajo: 1, mobiliario: 1 }
    },
    paraQuien: {
      personal: {},
      empresa: { usoCorporativo: 5 }
    }
  };

  /* Productos base por preset (ids del configurador 3D). */
  const PRESET_PRODUCTS = {
    basica: ['silla', 'monitor', 'soporte', 'teclado', 'mouse', 'hub', 'cables'],
    pro: ['silla', 'monitor', 'brazo', 'luz', 'teclado', 'mouse', 'hub', 'celular', 'pad', 'cables'],
    premium: ['silla', 'monitor', 'brazo', 'luz', 'notebook', 'teclado', 'mouse', 'hub', 'celular', 'pad', 'cables']
  };

  /* Nombres de producto (respaldo si el configurador aún no expuso PRODUCTOS). */
  const PRODUCT_NAMES_FALLBACK = {
    silla: 'Silla ergonómica', monitor: 'Monitor externo', soporte: 'Soporte de monitor',
    brazo: 'Brazo articulado', luz: 'Luz de monitor (pLed)', notebook: 'Notebook',
    teclado: 'Teclado', mouse: 'Mouse', hub: 'Hub USB-C (pHub)', celular: 'Soporte de celular',
    cables: 'Organizador de cables (pBox)', pad: 'Pad de escritorio (pMat XL)'
  };

  const PRESET_LABEL = { basica: 'Básica', pro: 'Pro', premium: 'Premium' };
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
      const resp = answers[stepId];
      if (resp == null) return;
      const valores = Array.isArray(resp) ? resp : [resp];
      valores.forEach((val) => {
        const aporte = tabla[val];
        if (aporte) Object.keys(aporte).forEach((cat) => { scores[cat] += aporte[cat]; });
      });
    });
    return scores;
  }

  /* Genera la recomendación completa a partir de respuestas + puntajes. */
  function derivarRecomendacion(answers) {
    const scores = computeScores(answers);

    // Categorías prioritarias (con puntaje > 0, top 3)
    const ordenadas = Object.keys(scores)
      .map((k) => [k, scores[k]])
      .filter((e) => e[1] > 0)
      .sort((a, b) => b[1] - a[1]);
    const categoriasPrioritarias = ordenadas.slice(0, 3).map((e) => e[0]);
    const areasMejora = Math.min(Math.max(ordenadas.length, 1), 6);

    // Tamaño (de la pregunta de espacio)
    const tamano = answers.espacio || 'estandar';

    // Nivel → preset
    const horasMap = { menos4: 1, '4a6': 2, '6a8': 3, mas8: 4 };
    let nivel = horasMap[answers.horas] || 2;
    nivel += (answers.mejorar ? answers.mejorar.length : 0);
    if (answers.prioridad === 'completa') nivel += 3;
    else if (answers.prioridad === 'productividad') nivel += 1;
    if (answers.paraQuien === 'empresa') nivel += 2;
    const preset = nivel <= 4 ? 'basica' : nivel <= 7 ? 'pro' : 'premium';

    // Modo (sentado / standing)
    const yaTengo = answers.yaTengo || [];
    const quiereMovilidad = (answers.mejorar || []).includes('postura') || (answers.mejorar || []).includes('comodidad');
    let modo = 'sentado';
    if (yaTengo.includes('standing')) modo = 'standing';
    else if (answers.horas === 'mas8' && answers.espacio !== 'compacto' && quiereMovilidad) modo = 'standing';

    // Setup completo (ids del configurador)
    const setup = new Set(PRESET_PRODUCTS[preset]);
    const mejorar = answers.mejorar || [];
    const disp = answers.dispositivos || [];
    if (mejorar.includes('iluminacion')) setup.add('luz');
    if (mejorar.includes('orden') || mejorar.includes('cables')) { setup.add('cables'); setup.add('pad'); }
    if (mejorar.includes('conectividad')) setup.add('hub');
    if (disp.includes('notebook')) setup.add('notebook');
    if (disp.includes('monitor')) setup.add('monitor');

    // Reglas de coherencia (soporte/brazo excluyentes; luz depende de monitor)
    if (setup.has('monitor')) {
      if (preset === 'basica') { setup.add('soporte'); setup.delete('brazo'); }
      else { setup.add('brazo'); setup.delete('soporte'); }
    } else {
      setup.delete('soporte'); setup.delete('brazo'); setup.delete('luz');
    }
    if (!setup.has('monitor')) setup.delete('luz');

    const productosSetup = Array.from(setup);

    // Productos a sumar = setup - lo que ya tiene (evita compras innecesarias)
    const yaSet = new Set(yaTengo.filter((x) => x !== 'ninguno'));
    const productosRecomendados = productosSetup.filter((id) => !yaSet.has(id));

    return {
      scores,
      categoriasPrioritarias,
      categoriasPrioritariasLabels: categoriasPrioritarias.map((c) => CATEGORIA_LABEL[c]),
      areasMejora,
      tamano,
      modo,
      preset,
      productosSetup,
      productosRecomendados,
      yaTiene: Array.from(yaSet),
      tipoUsuario: answers.paraQuien === 'empresa' ? 'empresa' : 'personal',
      explicacion: explicar(categoriasPrioritarias[0], preset, modo)
    };
  }

  function explicar(catPrincipal, preset, modo) {
    const frases = {
      ergonomia: 'priorizar la comodidad y la alternancia de posturas durante la jornada',
      conectividad: 'simplificar la conectividad y reducir la fricción con cables y puertos',
      iluminacion: 'mejorar la iluminación del puesto para una experiencia de trabajo más cuidada',
      orden: 'ordenar el escritorio y ocultar los cables para despejar la superficie',
      superficieTrabajo: 'aprovechar mejor el espacio disponible sobre el escritorio',
      mobiliario: 'renovar el mobiliario base para un puesto más cómodo',
      usoCorporativo: 'estandarizar varios puestos con una propuesta a medida'
    };
    const base = frases[catPrincipal] || 'mejorar la organización general del puesto';
    const extra = modo === 'standing' ? ' Sumamos la opción de standing desk para alternar entre estar sentado y de pie.' : '';
    return `Según tus respuestas, conviene ${base}. Preparamos una configuración ${PRESET_LABEL[preset]} como punto de partida, que podés ajustar libremente en el configurador 3D.${extra}`;
  }

  /* ==================================================================
     3. ESTADO + REFERENCIAS DOM
     ================================================================== */
  const state = {
    paso: 0,
    answers: {},
    diagnostico: null,
    lead: null,
    iniciado: false
  };

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
      group.setAttribute('role', q.tipo === 'single' ? 'radiogroup' : 'group');
      group.setAttribute('aria-labelledby', legend.id);
      group.dataset.tipo = q.tipo;
      group.dataset.step = q.id;

      q.opciones.forEach((op) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'test-option';
        btn.dataset.value = op.value;
        btn.setAttribute('role', q.tipo === 'single' ? 'radio' : 'checkbox');
        btn.setAttribute('aria-checked', 'false');
        btn.tabIndex = -1; // gestionado por roving tabindex
        btn.innerHTML =
          '<span class="test-option-mark" aria-hidden="true"></span>' +
          '<span class="test-option-label">' + op.label + '</span>';
        btn.addEventListener('click', () => onOptionActivate(q, btn));
        group.appendChild(btn);
      });

      // Primer opción enfocable
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

  function onOptionActivate(q, btn) {
    if (!state.iniciado) { state.iniciado = true; track('diagnostico_iniciado', {}); }
    const value = btn.dataset.value;
    if (q.tipo === 'single') {
      state.answers[q.id] = value;
      const group = btn.parentElement;
      group.querySelectorAll('.test-option').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      moveFocus(group, btn);
    } else {
      let arr = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
      const group = btn.parentElement;
      // Opción exclusiva (ej. "Ninguno"): al activarla limpia el resto y viceversa
      if (q.exclusivo && value === q.exclusivo) {
        arr = arr.includes(value) ? [] : [value];
      } else {
        if (q.exclusivo) arr = arr.filter((v) => v !== q.exclusivo);
        arr = arr.includes(value) ? arr.filter((v) => v !== value) : arr.concat(value);
      }
      state.answers[q.id] = arr;
      group.querySelectorAll('.test-option').forEach((b) => {
        const on = arr.includes(b.dataset.value);
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      moveFocus(group, btn);
    }
    clearError();
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
          onOptionActivate(q, document.activeElement);
        }
        return;
      default: return;
    }
    if (target) {
      e.preventDefault();
      moveFocus(group, target);
      target.focus();
      // En radiogroup, las flechas también seleccionan (patrón WAI-ARIA)
      if (q.tipo === 'single') onOptionActivate(q, target);
    }
  }

  function stepIsValid(q) {
    const resp = state.answers[q.id];
    if (q.tipo === 'single') return !!resp;
    return Array.isArray(resp) && resp.length >= (q.min || 1);
  }

  function showStep(n, dir) {
    const total = QUESTIONS.length;
    state.paso = Math.max(0, Math.min(n, total - 1));
    dom.steps.querySelectorAll('.test-step').forEach((fs) => {
      fs.hidden = Number(fs.dataset.step) !== state.paso;
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

    // Foco al primer control del paso (sin romper reduced-motion)
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
      showError(q.tipo === 'single'
        ? 'Elegí una opción para continuar.'
        : 'Elegí al menos una opción para continuar.');
      const group = currentGroup();
      const first = group && group.querySelector('.test-option');
      if (first) { first.tabIndex = 0; first.focus(); }
      return;
    }
    track('diagnostico_paso_completado', { paso: state.paso + 1, pregunta: q.id });
    if (state.paso === QUESTIONS.length - 1) {
      finalizar();
    } else {
      showStep(state.paso + 1, true);
    }
  }

  function prev() {
    if (state.paso > 0) showStep(state.paso - 1, true);
  }

  function showError(msg) {
    dom.error.textContent = msg;
    dom.error.hidden = false;
  }
  function clearError() { dom.error.hidden = true; dom.error.textContent = ''; }

  /* ==================================================================
     5. TEASER (FASE 7)
     ================================================================== */
  function finalizar() {
    state.diagnostico = derivarRecomendacion(state.answers);
    track('diagnostico_finalizado', {
      preset: state.diagnostico.preset,
      categorias: state.diagnostico.categoriasPrioritarias,
      puntajes: state.diagnostico.scores
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
        '<span class="pill">Adelanto de tu diagnóstico</span>' +
        '<h3 class="test-teaser-head">Detectamos ' + d.areasMejora + ' ' +
          (d.areasMejora === 1 ? 'oportunidad' : 'oportunidades') + ' de mejora.</h3>' +
        '<p class="test-teaser-sub">Tu prioridad principal está en <strong>' + prioridadTxt + '</strong>.</p>' +
        '<div class="test-teaser-metrics">' +
          metric('Áreas de mejora', String(d.areasMejora)) +
          metric('Prioridad principal', d.categoriasPrioritariasLabels[0] || '—') +
          metric('Nivel recomendado', PRESET_LABEL[d.preset]) +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-lg" id="testTeaserCta">Ver mi diagnóstico completo</button>' +
        '<p class="test-teaser-note">Te pedimos sólo unos datos para enviártelo y armar la recomendación.</p>' +
      '</div>';

    switchPanel(dom.teaser);
    const cta = $('testTeaserCta');
    cta && cta.addEventListener('click', mostrarLeadForm);
    focusHeading(dom.teaser);
  }

  function metric(k, v) {
    return '<div class="test-metric"><span class="test-metric-k">' + k + '</span><span class="test-metric-v">' + v + '</span></div>';
  }

  /* ==================================================================
     6. CAPTURA DE LEAD (FASE 8)
     El formulario es estático en index.html; acá se cablea su lógica
     condicional, validación accesible y envío.
     ================================================================== */
  function mostrarLeadForm() {
    // Empresa visible si el test indicó varios puestos
    const empresaField = $('leadEmpresaField');
    if (empresaField) empresaField.hidden = state.diagnostico.tipoUsuario !== 'empresa';

    switchPanel(dom.lead);
    track('lead_form_mostrado', { tipoUsuario: state.diagnostico.tipoUsuario });
    focusHeading(dom.lead);
  }

  function wireLeadForm() {
    if (!dom.leadForm) return;
    const radios = dom.leadForm.querySelectorAll('input[name="canal"]');
    radios.forEach((r) => r.addEventListener('change', updateCanalFields));
    updateCanalFields();
    dom.leadForm.addEventListener('submit', onLeadSubmit);
  }

  function getCanal() {
    const checked = dom.leadForm.querySelector('input[name="canal"]:checked');
    return checked ? checked.value : '';
  }

  /* Muestra/oculta y habilita/inhabilita los campos condicionales.
     Los campos ocultos quedan disabled para no validarse ni recibir foco. */
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
    if (!visible) { clearFieldError(inputId); }
  }

  function onLeadSubmit(e) {
    e.preventDefault();
    const errores = validarLead();
    if (errores.length) {
      // Foco al primer campo inválido (focus-management)
      const primero = $(errores[0].id);
      if (primero) primero.focus();
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
    const eId = errorId || (inputId + 'Error');
    const errEl = $(eId);
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

  function construirPayload() {
    const d = state.diagnostico;
    const canal = getCanal();
    const nombre = $('leadNombre').value.trim();
    const email = canal === 'email' ? ($('leadEmail').value.trim()) : '';
    const whatsapp = canal === 'whatsapp' ? ($('leadWhatsapp').value.trim()) : '';
    const empresaEl = $('leadEmpresa');
    const empresa = (d.tipoUsuario === 'empresa' && empresaEl) ? empresaEl.value.trim() : '';

    return {
      nombre: nombre,
      canalPreferido: canal || 'email',
      email: email,
      whatsapp: whatsapp,
      empresa: empresa,
      tipoUsuario: d.tipoUsuario,
      respuestasTest: Object.assign({}, state.answers),
      puntajes: {
        ergonomia: d.scores.ergonomia,
        conectividad: d.scores.conectividad,
        iluminacion: d.scores.iluminacion,
        orden: d.scores.orden,
        superficieTrabajo: d.scores.superficieTrabajo,
        mobiliario: d.scores.mobiliario,
        usoCorporativo: d.scores.usoCorporativo
      },
      categoriasPrioritarias: d.categoriasPrioritarias.slice(),
      presetRecomendado: d.preset,
      tamanoEscritorio: d.tamano,
      modoEscritorio: d.modo,
      productosRecomendados: d.productosRecomendados.slice(),
      productosFinales: d.productosSetup.slice(),
      origen: CFG.LEAD_ORIGIN || 'landing-setup-oficina',
      utm: leerUTM(),
      fechaIso: new Date().toISOString()
    };
  }

  async function enviarLead() {
    const submitBtn = dom.leadForm.querySelector('[type="submit"]');
    const payload = construirPayload();
    state.lead = payload;

    // Estado de carga del botón (loading-buttons)
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

    track('lead_enviado', { modo: resultado.mode, canal: payload.canalPreferido, tipoUsuario: payload.tipoUsuario });

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      submitBtn.innerHTML = textoPrevio;
    }

    // Siempre permitimos continuar al resultado (no bloqueamos por persistencia).
    renderResultado(resultado);
  }

  /* ==================================================================
     7. RESULTADO PERSONALIZADO (FASE 10) + PRECARGA 3D (FASE 3) + WA (FASE 11)
     ================================================================== */
  function renderResultado(resultadoEnvio) {
    const d = state.diagnostico;
    const nombre = (state.lead && state.lead.nombre) ? state.lead.nombre : '';
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

    // Precarga del configurador 3D según el diagnóstico (FASE 3)
    precargarConfigurador();

    $('testGoConfig') && $('testGoConfig').addEventListener('click', irAlConfigurador);
    $('testGoWa') && $('testGoWa').addEventListener('click', enviarWhatsApp);
    focusHeading(dom.result);
  }

  /* Nota honesta: en modo demo no afirmamos persistencia real. */
  function demoNota(resultadoEnvio) {
    if (resultadoEnvio && resultadoEnvio.mode === 'demo') {
      return '<p class="test-result-note" role="note">Estás viendo una vista previa funcional. La conexión con la base de datos de PrimOffice todavía está pendiente, así que por ahora tu consulta se completa por WhatsApp. <span class="test-todo">TODO: validar con PrimOffice</span></p>';
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

  /* Espera a que el configurador exponga su API (módulo deferido). */
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
    const lead = state.lead || {};
    const api = window.PrimOfficeConfigurador3D;
    const conf = (api && typeof api.getCurrentConfiguration === 'function') ? api.getCurrentConfiguration() : null;

    const recomendadosNombres = d.productosRecomendados.map(productName);
    const finalesNombres = conf ? conf.productNames : d.productosSetup.map(productName);

    const lines = [
      'Hola PrimOffice! Soy ' + (lead.nombre || '') + ' y completé el test de diagnóstico.',
      '',
      'Prioridades: ' + (d.categoriasPrioritariasLabels.join(', ') || '—'),
      'Nivel recomendado: ' + PRESET_LABEL[d.preset],
      'Escritorio: ' + SIZE_LABEL[d.tamano] + ' · Modo: ' + MODE_LABEL[d.modo],
      '',
      'Productos recomendados inicialmente: ' + (recomendadosNombres.join(', ') || '—'),
      'Mi configuración final' + (conf ? ' (' + conf.count + ')' : '') + ': ' + (finalesNombres.join(', ') || '—'),
      '',
      'Canal preferido: ' + (lead.canalPreferido === 'whatsapp' ? 'WhatsApp' : 'Email'),
      'Me gustaría recibir asesoramiento y precios.'
    ];
    track('whatsapp_clicked', { contexto: 'resultado-test' });
    window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  }

  /* ==================================================================
     8. UTILIDADES DE PANEL / FOCO
     ================================================================== */
  function switchPanel(panel) {
    [dom.wizard, dom.teaser, dom.lead, dom.result].forEach((p) => { if (p) p.hidden = (p !== panel); });
    // Scroll suave al inicio de la sección si el panel queda fuera de vista
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
      // Evita scroll brusco: foco sin desplazamiento adicional
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
    if (!cacheDom()) return; // la sección del test no existe en esta página
    buildSteps();
    showStep(0, false);
    dom.next.addEventListener('click', next);
    dom.prev.addEventListener('click', prev);
    wireLeadForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
