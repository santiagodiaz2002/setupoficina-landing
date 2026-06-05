/* =====================================================================
   PrimOffice · Configurador 3D (Three.js)
   ---------------------------------------------------------------------
   Sustituye el visualizador SVG por una escena 3D real.
   - Sitio 100% estatico (Live Server / GitHub Pages), sin bundlers.
   - Modulos ES + Three.js fijado por import map (ver index.html <head>).
   - Inicializacion diferida (IntersectionObserver) para no penalizar la
     carga inicial de la landing.
   - Arquitectura preparada para reemplazar cada placeholder por modelos
     .glb/.gltf reales (GLTFLoader) y para edicion manual futura
     (TransformControls).

   Separacion de responsabilidades:
     · Capa UI  -> siempre activa (checklist, presets, resumen, WhatsApp).
                   Funciona aunque WebGL no este disponible.
     · Capa 3D  -> diferida y opcional. Si falla, la UI sigue operativa.
   ===================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------
     0. PREFERENCIAS / UTILIDADES
     ------------------------------------------------------------------ */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WHATSAPP = '5491139149688';

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeInCubic = (t) => t * t * t;

  /* ------------------------------------------------------------------
     1. ESTRUCTURA DE DATOS CENTRALIZADA (mantenible)
     Cada producto define: id, nombre, categoria, activo, dependencias,
     exclusiones, posicionInicial, escala, rutaModeloGlb, geometriaPlaceholder.
     'anchor' indica si el objeto se apoya en la superficie del escritorio
     (acompana cambios de altura) o en el piso (la silla).
     Las posiciones estan pensadas para entrar incluso en el escritorio
     compacto, asi todo queda siempre "apoyado" sobre la superficie.
     ------------------------------------------------------------------ */
  const PRODUCTOS = [
    {
      id: 'silla', nombre: 'Silla ergonomica', categoria: 'Ergonomia', activo: true,
      dependencias: [], exclusiones: [], anchor: 'floor',
      posicionInicial: { x: 0, y: 0, z: 0.62 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'silla',
      descripcion: 'Soporte lumbar, altura regulable y ruedas.'
    },
    {
      id: 'monitor', nombre: 'Monitor externo', categoria: 'Pantalla', activo: true,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: 0, y: 0, z: -0.16 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'monitor',
      descripcion: 'Mas espacio de pantalla y mejor ergonomia visual.'
    },
    {
      id: 'soporte', nombre: 'Soporte de monitor', categoria: 'Pantalla', activo: false,
      dependencias: ['monitor'], exclusiones: ['brazo'], anchor: 'surface',
      posicionInicial: { x: 0, y: 0, z: -0.16 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'soporte',
      descripcion: 'Eleva la pantalla a la altura correcta.'
    },
    {
      id: 'brazo', nombre: 'Brazo articulado', categoria: 'Pantalla', activo: true,
      dependencias: ['monitor'], exclusiones: ['soporte'], anchor: 'surface',
      posicionInicial: { x: 0, y: 0, z: -0.31 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'brazo',
      descripcion: 'Maxima flexibilidad de posicion, libera superficie.'
    },
    {
      id: 'luz', nombre: 'Luz de monitor (pLed)', categoria: 'Iluminacion', activo: true,
      dependencias: ['monitor'], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: 0, y: 0, z: -0.15 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'luz',
      descripcion: 'Iluminacion sin reflejos; protege la vista.'
    },
    {
      id: 'notebook', nombre: 'Notebook', categoria: 'Equipo', activo: false,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: -0.46, y: 0, z: 0.04 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'notebook',
      descripcion: 'Equipo principal o secundario sobre el escritorio.'
    },
    {
      id: 'teclado', nombre: 'Teclado', categoria: 'Perifericos', activo: true,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: -0.02, y: 0, z: 0.14 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'teclado',
      descripcion: 'Mecanico compacto o ergonomico (pMechanic).'
    },
    {
      id: 'mouse', nombre: 'Mouse', categoria: 'Perifericos', activo: true,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: 0.26, y: 0, z: 0.15 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'mouse',
      descripcion: 'Mouse vertical ergonomico, posicion natural.'
    },
    {
      id: 'hub', nombre: 'Hub USB-C (pHub)', categoria: 'Conectividad', activo: true,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: 0.45, y: 0, z: -0.08 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'hub',
      descripcion: 'Centraliza perifericos y carga en un punto.'
    },
    {
      id: 'celular', nombre: 'Soporte de celular', categoria: 'Accesorios', activo: false,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: 0.46, y: 0, z: 0.02 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'celular',
      descripcion: 'El telefono a mano y bien posicionado.'
    },
    {
      id: 'cables', nombre: 'Organizador de cables (pBox)', categoria: 'Orden', activo: true,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: 0, y: 0, z: -0.30 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'cables',
      descripcion: 'Escritorio limpio, cables ocultos bajo la superficie.'
    },
    {
      id: 'pad', nombre: 'Pad de escritorio (pMat XL)', categoria: 'Orden', activo: false,
      dependencias: [], exclusiones: [], anchor: 'surface',
      posicionInicial: { x: 0.02, y: 0, z: 0.13 }, escala: 1,
      rutaModeloGlb: null, geometriaPlaceholder: 'pad',
      descripcion: 'Protege la superficie y suma imagen.'
    }
  ];

  const byId = (id) => PRODUCTOS.find((p) => p.id === id);
  const nameOf = (id) => { const p = byId(id); return p ? p.nombre : id; };

  /* Presets: cada uno define productos visibles + tamano + modo.
     'personalizada' = libre (no fuerza cambios). */
  const PRESETS = {
    basica: { size: 'estandar', mode: 'sentado', productos: ['silla', 'monitor', 'soporte', 'teclado', 'mouse', 'hub', 'cables'] },
    pro: { size: 'estandar', mode: 'sentado', productos: ['silla', 'monitor', 'brazo', 'luz', 'teclado', 'mouse', 'hub', 'celular', 'pad', 'cables'] },
    premium: { size: 'amplio', mode: 'standing', productos: ['silla', 'monitor', 'brazo', 'luz', 'notebook', 'teclado', 'mouse', 'hub', 'celular', 'pad', 'cables'] },
    personalizada: null
  };

  const PRESET_LABELS = { basica: 'Basica', pro: 'Pro', premium: 'Premium', personalizada: 'Personalizada' };
  const SIZE_LABELS = { compacto: 'Compacto', estandar: 'Estandar', amplio: 'Amplio' };
  const MODE_LABELS = { sentado: 'Sentado', standing: 'Standing desk' };

  /* Dimensiones del escritorio (metros aprox.) */
  const BASE_W = 1.50, BASE_D = 0.72, DESK_T = 0.04;
  const DESK_SIZES = {
    compacto: { w: 1.16, d: 0.62 },
    estandar: { w: 1.50, d: 0.72 },
    amplio: { w: 1.84, d: 0.82 }
  };
  const DESK_HEIGHTS = { sentado: 0.74, standing: 1.07 };

  /* Iconos SVG (sin emojis, coherentes con el sistema de diseno) */
  const ICONS = {
    silla: '<path d="M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4"/><path d="M3 13a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3z"/><path d="M5 16v3M19 16v3"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    soporte: '<rect x="4" y="3" width="16" height="9" rx="1.5"/><path d="M9 16h6M7 16h10l-1 4H8z"/>',
    brazo: '<circle cx="4" cy="13" r="1.6"/><path d="M4 11V6M5 12l6-3 4 3.5"/><rect x="13" y="8" width="8" height="6" rx="1"/>',
    luz: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    notebook: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 20h20"/>',
    teclado: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
    mouse: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/>',
    hub: '<rect x="4" y="9" width="16" height="6" rx="1.5"/><path d="M8 9V6M16 9V6M9 15v2a3 3 0 0 0 6 0v-2"/>',
    celular: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    cables: '<path d="M4 5v5a4 4 0 0 0 4 4h8a4 4 0 0 1 4 4v1"/><circle cx="4" cy="4" r="1.6"/><circle cx="20" cy="20" r="1.6"/>',
    pad: '<rect x="2" y="6" width="20" height="12" rx="2"/>'
  };
  const iconSvg = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ''}</svg>`;

  /* ------------------------------------------------------------------
     2. ESTADO (fuente de verdad de la UI)
     ------------------------------------------------------------------ */
  const state = {
    preset: 'pro',
    size: PRESETS.pro.size,
    mode: PRESETS.pro.mode,
    active: new Set(PRESETS.pro.productos)
  };

  /* Referencias DOM */
  const $ = (id) => document.getElementById(id);
  const dom = {};

  /* ------------------------------------------------------------------
     3. CAPA UI (siempre activa)
     ------------------------------------------------------------------ */
  function buildChecklist() {
    dom.checklist.innerHTML = '';
    PRODUCTOS.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'config-item';
      btn.dataset.id = p.id;
      btn.setAttribute('aria-pressed', state.active.has(p.id) ? 'true' : 'false');
      const flags = [`<span class="c3d-flag">${p.categoria}</span>`]
        .concat(p.dependencias.map((d) => `<span class="c3d-flag req">Requiere ${nameOf(d)}</span>`))
        .concat(p.exclusiones.map((x) => `<span class="c3d-flag exc">No con ${nameOf(x)}</span>`))
        .join('');
      btn.innerHTML =
        `<span class="config-checkbox"></span>` +
        `<span class="config-item-icon">${iconSvg(p.geometriaPlaceholder)}</span>` +
        `<span class="config-item-text"><b>${p.nombre}</b><span>${p.descripcion}</span><span class="c3d-item-flags">${flags}</span></span>`;
      btn.addEventListener('click', () => toggleProduct(p.id));
      dom.checklist.appendChild(btn);
    });
  }

  function syncUI() {
    // Checklist
    dom.checklist.querySelectorAll('.config-item').forEach((btn) => {
      const on = state.active.has(btn.dataset.id);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.querySelector('.config-checkbox').innerHTML = on ? '&#10003;' : '';
    });
    // Segmentos
    setSegActive(dom.presetGroup, 'preset', state.preset);
    setSegActive(dom.deskSizeGroup, 'size', state.size);
    setSegActive(dom.deskModeGroup, 'mode', state.mode);
    // Resumen / alternativa textual
    dom.sumPreset.textContent = PRESET_LABELS[state.preset];
    dom.sumDesk.textContent = SIZE_LABELS[state.size];
    dom.sumMode.textContent = MODE_LABELS[state.mode];
    const activos = PRODUCTOS.filter((p) => state.active.has(p.id));
    dom.configTags.innerHTML = activos.length
      ? activos.map((p) => `<span class="config-tag">${p.nombre}</span>`).join('')
      : '<span class="c3d-empty">Ningun producto seleccionado aun</span>';
    dom.configCount.textContent = `${state.active.size} de ${PRODUCTOS.length}`;
  }

  function setSegActive(group, key, value) {
    if (!group) return;
    group.querySelectorAll('.c3d-seg-btn').forEach((b) => {
      const on = b.dataset[key] === value;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  /* Reglas logicas de dependencias / exclusiones */
  function toggleProduct(id) {
    const p = byId(id);
    const turningOn = !state.active.has(id);
    const auto = [];

    if (turningOn) {
      state.active.add(id);
      // dependencias: se activan automaticamente
      p.dependencias.forEach((d) => { if (!state.active.has(d)) { state.active.add(d); auto.push(d); } });
      // exclusiones: se desactiva el mutuamente excluyente
      p.exclusiones.forEach((x) => { if (state.active.has(x)) { state.active.delete(x); auto.push(x); } });
    } else {
      state.active.delete(id);
      // si algo dependia de este producto, se desactiva tambien
      PRODUCTOS.forEach((q) => {
        if (q.dependencias.includes(id) && state.active.has(q.id)) { state.active.delete(q.id); auto.push(q.id); }
      });
    }

    // Toda edicion manual pasa el preset a "Personalizada"
    state.preset = 'personalizada';
    syncUI();
    syncScene(true);
    if (auto.length) {
      toast(`Ajustado automaticamente: ${auto.map(nameOf).join(', ')}`);
      flashItems(auto);
    }
  }

  function selectPreset(preset) {
    state.preset = preset;
    if (preset !== 'personalizada' && PRESETS[preset]) {
      const cfg = PRESETS[preset];
      state.active = new Set(cfg.productos);
      const sizeChanged = state.size !== cfg.size;
      const modeChanged = state.mode !== cfg.mode;
      state.size = cfg.size;
      state.mode = cfg.mode;
      syncUI();
      syncScene(true);
      if (sceneReady) {
        if (sizeChanged) setDeskSize(cfg.size, true);
        if (modeChanged) setDeskMode(cfg.mode, true);
      }
    } else {
      syncUI();
    }
  }

  function selectSize(size) {
    if (state.size === size) return;
    state.size = size;
    state.preset = 'personalizada';
    syncUI();
    if (sceneReady) setDeskSize(size, true);
  }

  function selectMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    state.preset = 'personalizada';
    syncUI();
    if (sceneReady) setDeskMode(mode, true);
  }

  function flashItems(ids) {
    if (reduceMotion) return;
    ids.forEach((id) => {
      const btn = dom.checklist.querySelector(`.config-item[data-id="${id}"]`);
      if (btn) { btn.classList.remove('c3d-auto'); void btn.offsetWidth; btn.classList.add('c3d-auto'); }
    });
  }

  let toastTimer = null;
  function toast(msg) {
    if (!dom.toast) {
      dom.toast = document.createElement('div');
      dom.toast.className = 'c3d-toast';
      dom.toast.setAttribute('role', 'status');
      document.body.appendChild(dom.toast);
    }
    dom.toast.innerHTML = msg;
    dom.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), 3200);
  }

  function sendWhatsApp() {
    const activos = PRODUCTOS.filter((p) => state.active.has(p.id)).map((p) => '- ' + p.nombre);
    const lines = [
      'Hola PrimOffice! Arme mi setup con el configurador 3D:',
      '',
      `Configuracion: ${PRESET_LABELS[state.preset]}`,
      `Escritorio: ${SIZE_LABELS[state.size]}`,
      `Modo: ${MODE_LABELS[state.mode]}`,
      '',
      `Productos seleccionados (${state.active.size}):`,
      ...(activos.length ? activos : ['- (ninguno todavia)']),
      '',
      'Me gustaria recibir asesoramiento y precios.'
    ];
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  }

  function wireUI() {
    dom.stage = $('c3dStage');
    dom.canvasHost = $('c3dCanvasHost');
    dom.loader = $('c3dLoader');
    dom.fallback = $('c3dFallback');
    dom.hint = $('c3dHint');
    dom.toolbar = dom.stage ? dom.stage.querySelector('.c3d-toolbar') : null;
    dom.checklist = $('checklist');
    dom.presetGroup = $('presetGroup');
    dom.deskSizeGroup = $('deskSizeGroup');
    dom.deskModeGroup = $('deskModeGroup');
    dom.sumPreset = $('sumPreset');
    dom.sumDesk = $('sumDesk');
    dom.sumMode = $('sumMode');
    dom.configTags = $('configTags');
    dom.configCount = $('configCount');
    dom.whatsapp = $('c3dWhatsapp');

    if (!dom.checklist) return false; // seccion no presente

    buildChecklist();
    syncUI();

    dom.presetGroup && dom.presetGroup.querySelectorAll('.c3d-seg-btn').forEach((b) =>
      b.addEventListener('click', () => selectPreset(b.dataset.preset)));
    dom.deskSizeGroup && dom.deskSizeGroup.querySelectorAll('.c3d-seg-btn').forEach((b) =>
      b.addEventListener('click', () => selectSize(b.dataset.size)));
    dom.deskModeGroup && dom.deskModeGroup.querySelectorAll('.c3d-seg-btn').forEach((b) =>
      b.addEventListener('click', () => selectMode(b.dataset.mode)));
    dom.whatsapp && dom.whatsapp.addEventListener('click', sendWhatsApp);

    // Botones de camara (funcionan tambien antes de que la escena cargue:
    // marcan el estado visual y, cuando hay escena, mueven la camara)
    dom.toolbar && dom.toolbar.querySelectorAll('.c3d-cam-btn').forEach((b) =>
      b.addEventListener('click', () => {
        setToolbarActive(b.dataset.view);
        if (sceneReady) setView(b.dataset.view, true);
      }));

    return true;
  }

  function setToolbarActive(view) {
    if (!dom.toolbar) return;
    const highlight = view === 'reset' ? 'perspectiva' : view;
    dom.toolbar.querySelectorAll('.c3d-cam-btn').forEach((b) => {
      const on = b.dataset.view === highlight;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ==================================================================
     4. CAPA 3D (diferida)
     ================================================================== */
  let THREE, OrbitControls, RoundedBoxGeometry, GLTFLoader;
  let renderer, scene, camera, controls, gltfLoader;
  let surfaceAnchor, tabletop, legL, legR, footL, footR, floor;
  let keyLight, monitorLight;
  let sceneReady = false, initialized = false, running = false, camFlying = false, firstShow = true;
  let visObs = null;

  const objects = {};      // id -> THREE.Group del producto
  const rendered = new Set(); // ids actualmente visibles en 3D
  let curW = BASE_W, curD = BASE_D, curTopY = DESK_HEIGHTS.sentado;

  /* --- Mini motor de tweens (sin librerias externas) --- */
  const tweens = [];
  function addTween(duration, onUpdate, onComplete, ease) {
    if (reduceMotion || !duration) { onUpdate(1); onComplete && onComplete(); return; }
    tweens.push({ start: performance.now(), duration, ease: ease || easeInOutCubic, onUpdate, onComplete });
  }
  function updateTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const p = clamp01((now - tw.start) / tw.duration);
      tw.onUpdate(tw.ease(p));
      if (p >= 1) { tweens.splice(i, 1); tw.onComplete && tw.onComplete(); }
    }
  }

  /* --- Deteccion de WebGL --- */
  function webglAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function showFallback() {
    if (dom.loader) dom.loader.classList.add('is-hidden');
    if (dom.fallback) dom.fallback.hidden = false;
    if (dom.toolbar) dom.toolbar.style.display = 'none';
    if (dom.hint) dom.hint.style.display = 'none';
  }
  function hideLoader() { if (dom.loader) dom.loader.classList.add('is-hidden'); }

  /* --- Materiales / helpers de geometria (creados tras cargar THREE) --- */
  const COL = {
    surface: 0xe7ecf2, metal: 0x39424f, metalLight: 0x8d99a8, dark: 0x232b34,
    accent: 0x17aee6, white: 0xeef2f6, fabric: 0x2c3744, fabricLight: 0x3a4756,
    light: 0xbfeeff, matPad: 0x16243a
  };
  function mat(color, o = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough != null ? o.rough : 0.65, metalness: o.metal != null ? o.metal : 0.05 });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity != null ? o.emissiveIntensity : 1; }
    return m;
  }
  function screenMat() { return new THREE.MeshStandardMaterial({ color: 0x0c1622, emissive: new THREE.Color(0x12506e), emissiveIntensity: 0.7, roughness: 0.35, metalness: 0 }); }
  function emissiveMat(color, intensity) { return new THREE.MeshStandardMaterial({ color: 0x0c0f12, emissive: new THREE.Color(color || COL.light), emissiveIntensity: intensity || 0 }); }
  const RBOX = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 4, r);
  function mesh(geo, material, o = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = o.cast !== false;
    m.receiveShadow = o.receive !== false;
    return m;
  }
  function applyShadows(root) { root.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); }

  /* --- Builders de placeholders (reemplazables por modelos reales) --- */
  const GEOM_BUILDERS = {
    fallback() { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat(COL.accent))); return g; },

    silla() {
      const g = new THREE.Group();
      const fab = mat(COL.fabric, { rough: 0.85 }), fab2 = mat(COL.fabricLight, { rough: 0.8 });
      const met = mat(COL.metal, { rough: 0.4, metal: 0.6 });
      const hub = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 16), met); hub.position.y = 0.11; g.add(hub);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leg = mesh(new THREE.BoxGeometry(0.26, 0.03, 0.05), met);
        leg.position.set(Math.cos(a) * 0.13, 0.05, Math.sin(a) * 0.13); leg.rotation.y = -a; g.add(leg);
        const caster = mesh(new THREE.SphereGeometry(0.03, 12, 10), mat(COL.dark, { rough: 0.5 }));
        caster.position.set(Math.cos(a) * 0.24, 0.03, Math.sin(a) * 0.24); g.add(caster);
      }
      const post = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.30, 14), met); post.position.y = 0.30; g.add(post);
      const seat = mesh(RBOX(0.50, 0.09, 0.48, 0.04), fab); seat.position.set(0, 0.47, 0); g.add(seat);
      const back = new THREE.Group();
      back.add(mesh(RBOX(0.46, 0.54, 0.08, 0.04), fab)); // panel principal (y=0)
      const lumbar = mesh(RBOX(0.40, 0.16, 0.06, 0.03), fab2); lumbar.position.set(0, -0.14, 0.02); back.add(lumbar);
      const head = mesh(RBOX(0.34, 0.16, 0.07, 0.03), fab); head.position.set(0, 0.30, -0.01); back.add(head);
      back.position.set(0, 0.80, 0.22); back.rotation.x = THREE.MathUtils.degToRad(8); g.add(back);
      for (const sx of [-1, 1]) {
        const arm = mesh(RBOX(0.06, 0.05, 0.34, 0.02), mat(COL.dark, { rough: 0.6 })); arm.position.set(sx * 0.28, 0.60, 0.02); g.add(arm);
        const armPost = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), met); armPost.position.set(sx * 0.28, 0.52, 0.02); g.add(armPost);
      }
      return g;
    },

    monitor() {
      const g = new THREE.Group();
      const body = mat(COL.dark, { rough: 0.5, metal: 0.2 });
      const panel = new THREE.Group(); panel.name = 'mon-panel';
      panel.add(mesh(RBOX(0.62, 0.36, 0.035, 0.012), body));
      const screen = mesh(new THREE.PlaneGeometry(0.575, 0.32), screenMat(), { cast: false });
      screen.position.z = 0.019; panel.add(screen);
      panel.position.set(0, 0.11 + 0.18, 0); // y se ajusta en applyArrangement()
      g.add(panel);
      const stand = new THREE.Group(); stand.name = 'mon-stand';
      const neck = mesh(RBOX(0.05, 0.16, 0.05, 0.02), mat(COL.metalLight, { metal: 0.5, rough: 0.4 })); neck.position.y = 0.08; stand.add(neck);
      const base = mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.018, 28), mat(COL.metalLight, { metal: 0.5, rough: 0.4 })); base.position.y = 0.009; stand.add(base);
      g.add(stand);
      return g;
    },

    soporte() {
      const g = new THREE.Group();
      const m = mat(COL.metalLight, { metal: 0.4, rough: 0.45 });
      const top = mesh(RBOX(0.52, 0.022, 0.20, 0.01), m); top.position.y = 0.086; g.add(top);
      for (const sx of [-1, 1]) { const leg = mesh(RBOX(0.03, 0.086, 0.16, 0.008), m); leg.position.set(sx * 0.22, 0.043, 0); g.add(leg); }
      return g;
    },

    brazo() {
      const g = new THREE.Group();
      const m = mat(COL.metal, { metal: 0.7, rough: 0.35 });
      const clamp = mesh(RBOX(0.06, 0.10, 0.07, 0.01), m); clamp.position.y = 0.05; g.add(clamp);
      const pole = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 12), m); pole.position.set(0, 0.21, 0); g.add(pole);
      const arm1 = mesh(RBOX(0.04, 0.03, 0.18, 0.008), m); arm1.position.set(0, 0.36, 0.10); g.add(arm1);
      const joint = mesh(new THREE.SphereGeometry(0.025, 12, 10), m); joint.position.set(0, 0.31, 0.15); g.add(joint);
      return g;
    },

    luz() {
      const g = new THREE.Group();
      g.add(mesh(RBOX(0.46, 0.03, 0.05, 0.012), mat(COL.dark, { rough: 0.5 })));
      const glowMat = emissiveMat(COL.light, 0);
      const glow = mesh(new THREE.BoxGeometry(0.42, 0.012, 0.03), glowMat, { cast: false });
      glow.position.set(0, -0.018, 0.022); g.add(glow);
      g.userData.glowMat = glowMat;
      return g;
    },

    notebook() {
      const g = new THREE.Group();
      const body = mat(COL.metalLight, { metal: 0.6, rough: 0.4 });
      const base = mesh(RBOX(0.34, 0.018, 0.24, 0.01), body); base.position.y = 0.012; g.add(base);
      const deck = mesh(new THREE.PlaneGeometry(0.30, 0.20), mat(0x1b222b, { rough: 0.7 }), { cast: false }); deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.022, 0); g.add(deck);
      const lid = new THREE.Group();
      const lidPanel = mesh(RBOX(0.34, 0.22, 0.012, 0.008), body); lidPanel.position.y = 0.11; lid.add(lidPanel);
      const disp = mesh(new THREE.PlaneGeometry(0.30, 0.185), screenMat(), { cast: false }); disp.position.set(0, 0.11, 0.008); lid.add(disp);
      lid.position.set(0, 0.02, -0.12); lid.rotation.x = THREE.MathUtils.degToRad(-15); g.add(lid);
      return g;
    },

    teclado() {
      const g = new THREE.Group();
      const kbBase = mesh(RBOX(0.40, 0.018, 0.13, 0.008), mat(COL.white, { rough: 0.5 })); kbBase.position.y = 0.009; g.add(kbBase);
      const cols = 14, rows = 4, kw = 0.022, kh = 0.008, kd = 0.022, gap = 0.0045;
      const im = new THREE.InstancedMesh(RBOX(kw, kh, kd, 0.002), mat(0x2a323c, { rough: 0.6 }), cols * rows);
      im.castShadow = true; im.receiveShadow = false;
      const dummy = new THREE.Object3D();
      const startX = -((cols - 1) * (kw + gap)) / 2, startZ = -((rows - 1) * (kd + gap)) / 2;
      let idx = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        dummy.position.set(startX + c * (kw + gap), 0.021, startZ + r * (kd + gap)); dummy.updateMatrix(); im.setMatrixAt(idx++, dummy.matrix);
      }
      g.add(im);
      return g;
    },

    mouse() {
      const g = new THREE.Group();
      const b = mesh(new THREE.SphereGeometry(0.035, 20, 14), mat(COL.accent, { rough: 0.4, metal: 0.1 }));
      b.scale.set(1, 0.55, 1.5); b.position.y = 0.02; g.add(b);
      const wheel = mesh(new THREE.BoxGeometry(0.004, 0.006, 0.014), mat(0xffffff, { rough: 0.4 }), { cast: false }); wheel.position.set(0, 0.045, 0.012); g.add(wheel);
      return g;
    },

    hub() {
      const g = new THREE.Group();
      const hubBase = mesh(RBOX(0.16, 0.022, 0.05, 0.008), mat(COL.metalLight, { metal: 0.6, rough: 0.35 })); hubBase.position.y = 0.011; g.add(hubBase);
      const led = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.005, 8), emissiveMat(COL.accent, 1.4), { cast: false });
      led.rotation.x = Math.PI / 2; led.position.set(-0.06, 0.018, 0.026); g.add(led);
      return g;
    },

    celular() {
      const g = new THREE.Group();
      const m = mat(COL.metal, { metal: 0.6, rough: 0.4 });
      const base = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.012, 24), m); base.position.y = 0.006; g.add(base);
      const armS = mesh(RBOX(0.02, 0.14, 0.02, 0.006), m); armS.position.set(0, 0.08, -0.02); armS.rotation.x = THREE.MathUtils.degToRad(18); g.add(armS);
      const phone = mesh(RBOX(0.075, 0.15, 0.008, 0.01), mat(0x10171f, { rough: 0.4 })); phone.position.set(0, 0.13, 0); phone.rotation.x = THREE.MathUtils.degToRad(-18); g.add(phone);
      const scr = mesh(new THREE.PlaneGeometry(0.06, 0.13), screenMat(), { cast: false }); scr.position.set(0, 0.13, 0.006); scr.rotation.x = THREE.MathUtils.degToRad(-18); g.add(scr);
      return g;
    },

    cables() {
      const g = new THREE.Group();
      const tray = mesh(RBOX(0.40, 0.06, 0.12, 0.02), mat(0x223047, { rough: 0.6 })); tray.position.set(0, -0.09, 0); g.add(tray);
      const c = mat(0x33506e, { rough: 0.6 });
      for (let i = 0; i < 3; i++) { const cab = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.10, 8), c, { cast: false }); cab.position.set(-0.06 + i * 0.06, -0.055, 0.04); cab.rotation.x = THREE.MathUtils.degToRad(30); g.add(cab); }
      return g;
    },

    pad() {
      const g = new THREE.Group();
      const p = mesh(RBOX(0.72, 0.006, 0.30, 0.01), mat(COL.matPad, { rough: 0.85 }), { cast: false }); p.position.y = 0.004; g.add(p);
      return g;
    }
  };

  /* --- Construccion del producto (placeholder ahora, GLB en el futuro) --- */
  function buildProduct(p) {
    const group = new THREE.Group();
    group.name = 'prod-' + p.id;
    group.position.set(p.posicionInicial.x, p.posicionInicial.y, p.posicionInicial.z);
    const placeholder = (GEOM_BUILDERS[p.geometriaPlaceholder] || GEOM_BUILDERS.fallback)();
    group.add(placeholder);
    if (placeholder.userData) Object.assign(group.userData, placeholder.userData);
    const s = p.escala;
    const bs = typeof s === 'number' ? { x: s, y: s, z: s } : Object.assign({ x: 1, y: 1, z: 1 }, s);
    group.userData.baseScale = bs;
    group.scale.set(bs.x, bs.y, bs.z);
    group.visible = false;

    // Arquitectura GLTF lista: si hay ruta, se carga y reemplaza el placeholder.
    if (p.rutaModeloGlb && GLTFLoader) {
      gltfLoader.load(
        p.rutaModeloGlb,
        (gltf) => { group.remove(placeholder); applyShadows(gltf.scene); group.add(gltf.scene); },
        undefined,
        (err) => console.warn('[configurador-3d] No se pudo cargar el modelo de', p.id, '- se usa placeholder.', err)
      );
    }
    return group;
  }

  /* --- Escritorio (no es producto: siempre presente) --- */
  function buildDesk() {
    surfaceAnchor = new THREE.Object3D();
    surfaceAnchor.position.y = curTopY;
    scene.add(surfaceAnchor);

    tabletop = mesh(RBOX(BASE_W, DESK_T, BASE_D, 0.012), mat(COL.surface, { rough: 0.7, metal: 0.05 }));
    tabletop.position.y = -DESK_T / 2; // su cara superior queda en y=0 local (la superficie)
    surfaceAnchor.add(tabletop);

    const legMat = mat(COL.metal, { metal: 0.6, rough: 0.4 });
    legL = mesh(new THREE.BoxGeometry(0.07, 1, 0.07), legMat);
    legR = mesh(new THREE.BoxGeometry(0.07, 1, 0.07), legMat);
    footL = mesh(RBOX(0.08, 0.03, 0.50, 0.01), legMat); footL.position.y = 0.015;
    footR = mesh(RBOX(0.08, 0.03, 0.50, 0.01), legMat); footR.position.y = 0.015;
    scene.add(legL, legR, footL, footR);

    // Luz de monitor (acompana la superficie y la altura del escritorio)
    monitorLight = new THREE.SpotLight(0xcdefff, 0, 3.4, THREE.MathUtils.degToRad(46), 0.9, 1.1);
    monitorLight.position.set(0, 0.62, -0.05);
    surfaceAnchor.add(monitorLight);
    monitorLight.target.position.set(0, 0, 0.18);
    surfaceAnchor.add(monitorLight.target);

    setDeskState(curW, curD, curTopY);
  }

  function setDeskState(w, d, topY) {
    curW = w; curD = d; curTopY = topY;
    surfaceAnchor.position.y = topY;
    tabletop.scale.set(w / BASE_W, 1, d / BASE_D);
    const colH = Math.max(0.05, topY - DESK_T);
    const xx = w / 2 - 0.12;
    legL.scale.y = colH; legR.scale.y = colH;
    legL.position.set(-xx, colH / 2, 0); legR.position.set(xx, colH / 2, 0);
    footL.position.x = -xx; footR.position.x = xx;
  }

  /* --- Disposicion del monitor segun soporte / brazo / luz --- */
  function applyArrangement(animated) {
    const hasMon = rendered.has('monitor');
    const hasSop = rendered.has('soporte') && hasMon;
    const hasArm = rendered.has('brazo') && hasMon;
    const mon = objects.monitor;
    if (!mon) return;
    const panel = mon.getObjectByName('mon-panel');
    const stand = mon.getObjectByName('mon-stand');
    if (stand) stand.visible = hasMon && !hasSop && !hasArm;
    let bottom = 0.11;
    if (hasArm) bottom = 0.22; else if (hasSop) bottom = 0.13;
    const targetY = bottom + 0.18; // centro del panel (alto 0.36)
    if (panel) {
      const fromY = panel.position.y;
      addTween(animated ? 420 : 0, (e) => { panel.position.y = lerp(fromY, targetY, e); positionLuz(); }, null, easeInOutCubic);
      if (reduceMotion || !animated) { panel.position.y = targetY; positionLuz(); }
    }
  }
  function positionLuz() {
    const luz = objects.luz, panel = objects.monitor && objects.monitor.getObjectByName('mon-panel');
    if (luz && panel) luz.position.y = panel.position.y + 0.18 + 0.012;
  }

  /* --- Mostrar / ocultar productos con animacion --- */
  function showProduct(id, animated) {
    const g = objects[id]; if (!g) return;
    g.visible = true;
    const bs = g.userData.baseScale;
    if (reduceMotion || !animated) {
      g.scale.set(bs.x, bs.y, bs.z); setOpacity(g, 1);
    } else {
      setOpacity(g, 0);
      addTween(440, (e) => {
        const k = 0.4 + 0.6 * e;
        g.scale.set(bs.x * k, bs.y * k, bs.z * k);
        setOpacity(g, clamp01(e * 1.4));
      }, () => { g.scale.set(bs.x, bs.y, bs.z); setOpacity(g, 1); }, easeOutBack);
    }
    if (id === 'monitor' || id === 'soporte' || id === 'brazo') applyArrangement(animated);
    if (id === 'luz') turnMonitorLight(true, animated);
  }
  function hideProduct(id, animated) {
    const g = objects[id]; if (!g) return;
    if (id === 'luz') turnMonitorLight(false, animated);
    const bs = g.userData.baseScale;
    const finish = () => { g.visible = false; setOpacity(g, 1); g.scale.set(bs.x, bs.y, bs.z); if (id === 'monitor' || id === 'soporte' || id === 'brazo') applyArrangement(true); };
    if (reduceMotion || !animated) { finish(); return; }
    addTween(300, (e) => {
      const k = 1 - e;
      g.scale.set(bs.x * (0.0001 + k), bs.y * (0.0001 + k), bs.z * (0.0001 + k));
      setOpacity(g, 1 - e);
    }, finish, easeInCubic);
  }
  function setOpacity(g, o) {
    g.traverse((n) => {
      if (n.isMesh || n.isInstancedMesh) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => { m.transparent = o < 0.999; m.opacity = o; m.depthWrite = o >= 0.999; });
      }
    });
  }

  /* --- Luz del monitor: encendido / apagado gradual --- */
  function turnMonitorLight(on, animated) {
    const targetI = on ? 9 : 0, targetG = on ? 1.7 : 0;
    const fromI = monitorLight.intensity;
    const glowMat = objects.luz && objects.luz.userData.glowMat;
    const fromG = glowMat ? glowMat.emissiveIntensity : 0;
    addTween(animated ? 650 : 0, (e) => {
      monitorLight.intensity = lerp(fromI, targetI, e);
      if (glowMat) glowMat.emissiveIntensity = lerp(fromG, targetG, e);
    }, null, easeInOutCubic);
    if (reduceMotion || !animated) { monitorLight.intensity = targetI; if (glowMat) glowMat.emissiveIntensity = targetG; }
  }

  /* --- Sincronizacion productos UI -> escena --- */
  function syncScene(animated) {
    if (!sceneReady) return;
    PRODUCTOS.forEach((p) => {
      const should = state.active.has(p.id);
      const is = rendered.has(p.id);
      if (should && !is) { rendered.add(p.id); showProduct(p.id, animated); }
      else if (!should && is) { rendered.delete(p.id); hideProduct(p.id, animated); }
    });
    applyArrangement(animated);
  }
  function fullSync() {
    rendered.clear();
    PRODUCTOS.forEach((p) => {
      const on = state.active.has(p.id);
      const g = objects[p.id]; const bs = g.userData.baseScale;
      g.visible = on; g.scale.set(bs.x, bs.y, bs.z); setOpacity(g, 1);
      if (on) rendered.add(p.id);
    });
    setDeskState(DESK_SIZES[state.size].w, DESK_SIZES[state.size].d, DESK_HEIGHTS[state.mode]);
    applyArrangement(false);
    turnMonitorLight(rendered.has('luz'), false);
  }

  /* --- Escritorio: tamano y modo (sentado / standing) --- */
  function setDeskSize(size, animated) {
    const t = DESK_SIZES[size]; if (!t) return;
    const fromW = curW, fromD = curD;
    addTween(animated ? 600 : 0, (e) => { setDeskState(lerp(fromW, t.w, e), lerp(fromD, t.d, e), curTopY); }, null, easeInOutCubic);
    if (reduceMotion || !animated) setDeskState(t.w, t.d, curTopY);
  }
  function setDeskMode(mode, animated) {
    const target = DESK_HEIGHTS[mode]; if (target == null) return;
    const fromY = curTopY;
    addTween(animated ? 900 : 0, (e) => {
      const y = lerp(fromY, target, e);
      setDeskState(curW, curD, y);
      if (!camFlying) controls.target.y = y * 0.6; // la camara reencuadra suavemente
    }, () => { if (!camFlying) controls.update(); }, easeInOutCubic);
    if (reduceMotion || !animated) { setDeskState(curW, curD, target); controls.target.y = target * 0.6; controls.update(); }
  }

  /* --- Camara: vistas y transiciones --- */
  function viewSpec(view) {
    const y = curTopY;
    switch (view) {
      case 'frontal': return { pos: new THREE.Vector3(0, y + 0.34, 3.0), tgt: new THREE.Vector3(0, y * 0.62, 0) };
      case 'superior': return { pos: new THREE.Vector3(0.001, y + 3.1, 0.06), tgt: new THREE.Vector3(0, y * 0.15, -0.04) };
      case 'perspectiva':
      case 'reset':
      default: return { pos: new THREE.Vector3(1.95, y + 0.95, 2.15), tgt: new THREE.Vector3(0, y * 0.6, 0) };
    }
  }
  function flyTo(pos, tgt, dur) {
    camFlying = true;
    controls.enabled = false; // evita que el arrastre del usuario pelee con la transicion
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    addTween(dur, (e) => {
      camera.position.lerpVectors(p0, pos, e);
      controls.target.lerpVectors(t0, tgt, e);
      camera.lookAt(controls.target);
    }, () => { camFlying = false; controls.enabled = true; controls.update(); }, easeInOutCubic);
  }
  function setView(view, animated) {
    const s = viewSpec(view);
    if (reduceMotion || !animated) { camera.position.copy(s.pos); controls.target.copy(s.tgt); camFlying = false; controls.update(); return; }
    flyTo(s.pos, s.tgt, 900);
  }

  /* --- Bucle de render (se pausa fuera de viewport) --- */
  function loop() {
    const now = performance.now();
    updateTweens(now);
    if (!camFlying) controls.update();
    renderer.render(scene, camera);
  }

  function entryAnimation() {
    const persp = viewSpec('perspectiva');
    hideLoader();
    if (reduceMotion) { camera.position.copy(persp.pos); controls.target.copy(persp.tgt); controls.update(); return; }
    camera.position.set(2.7, curTopY + 1.7, 2.95);
    controls.target.copy(persp.tgt); controls.update();
    flyTo(persp.pos, persp.tgt, 1400);
    // Oculta la pista de ayuda tras unos segundos
    setTimeout(() => dom.hint && dom.hint.classList.add('is-hidden'), 5200);
  }

  /* --- Construccion de la escena completa --- */
  function buildScene() {
    const host = dom.canvasHost;
    const w = host.clientWidth || 600, h = host.clientHeight || 450;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0c1a30, 6, 14);

    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    const persp = (() => { const y = DESK_HEIGHTS[state.mode]; return { pos: new THREE.Vector3(2.7, y + 1.7, 2.95), tgt: new THREE.Vector3(0, y * 0.6, 0) }; })();
    camera.position.copy(persp.pos);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 1.45;
    controls.maxDistance = 4.8;
    controls.minPolarAngle = THREE.MathUtils.degToRad(12);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(87);
    controls.target.copy(persp.tgt);
    controls.update();

    gltfLoader = new GLTFLoader();

    // --- Iluminacion (valores pensados para iluminacion fisica de three r160) ---
    scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x0a1424, 1.25));
    scene.add(new THREE.AmbientLight(0x6f93b5, 0.55));
    keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(2.6, 4.2, 2.4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    const sc = keyLight.shadow.camera; sc.near = 0.5; sc.far = 14; sc.left = -2.4; sc.right = 2.4; sc.top = 2.4; sc.bottom = -2.4; sc.updateProjectionMatrix();
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 0.8); rim.position.set(-3, 2.4, -2.5); scene.add(rim);

    // --- Piso que solo recibe sombras (deja ver el degradado de fondo CSS) ---
    floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    buildDesk();

    // Productos
    PRODUCTOS.forEach((p) => {
      const g = buildProduct(p);
      objects[p.id] = g;
      (p.anchor === 'floor' ? scene : surfaceAnchor).add(g);
    });

    sceneReady = true;
    fullSync();

    // Resize adaptativo
    const ro = new ResizeObserver(() => {
      const cw = host.clientWidth, ch = host.clientHeight;
      if (cw && ch) { renderer.setSize(cw, ch, false); camera.aspect = cw / ch; camera.updateProjectionMatrix(); }
    });
    ro.observe(host);

    // Pausa/reanuda el render segun visibilidad (rendimiento)
    visObs = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e.isIntersecting) {
        running = true; renderer.setAnimationLoop(loop);
        if (firstShow) { firstShow = false; entryAnimation(); }
      } else { running = false; renderer.setAnimationLoop(null); }
    }, { threshold: 0.01 });
    visObs.observe(dom.stage);

    // Oculta la pista al primer arrastre
    renderer.domElement.addEventListener('pointerdown', () => dom.hint && dom.hint.classList.add('is-hidden'), { once: true });

    // API publica para futura edicion manual (TransformControls) y depuracion
    window.PrimOfficeConfigurador3D = {
      state, objects, PRODUCTOS,
      getObject: (id) => objects[id],
      setView, setDeskSize, setDeskMode,
      enableManualPlacement
    };
  }

  /* Arquitectura lista para mover accesorios manualmente en el futuro.
     Carga TransformControls solo cuando se solicita (no penaliza la carga). */
  async function enableManualPlacement(id) {
    if (!sceneReady) return null;
    const obj = objects[id];
    if (!obj) return null;
    const mod = await import('three/addons/controls/TransformControls.js');
    const tc = new mod.TransformControls(camera, renderer.domElement);
    tc.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
    tc.attach(obj);
    scene.add(tc);
    return tc;
  }

  /* --- Inicializacion diferida de la capa 3D --- */
  async function init3D() {
    if (initialized) return;
    initialized = true;
    if (!webglAvailable()) { showFallback(); return; }
    try {
      THREE = await import('three');
      ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
      ({ RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js'));
      ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
    } catch (err) {
      console.error('[configurador-3d] No se pudo cargar Three.js desde el CDN.', err);
      showFallback();
      return;
    }
    try {
      buildScene();
    } catch (err) {
      console.error('[configurador-3d] Error al construir la escena 3D.', err);
      showFallback();
    }
  }

  /* ------------------------------------------------------------------
     5. ARRANQUE
     ------------------------------------------------------------------ */
  function start() {
    if (!wireUI()) return; // la seccion del configurador no existe en esta pagina

    const section = document.getElementById('configurador');
    if (!section) return;

    // Carga la escena 3D cuando la seccion se acerca al viewport.
    if ('IntersectionObserver' in window) {
      const lazyObs = new IntersectionObserver((entries, obs) => {
        if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); init3D(); }
      }, { rootMargin: '300px 0px' });
      lazyObs.observe(section);
    } else {
      init3D();
    }
  }

  // El script es type="module" (diferido): el DOM ya esta disponible.
  start();
})();
