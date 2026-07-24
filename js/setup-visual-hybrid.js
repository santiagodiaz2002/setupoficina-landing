/* Visualizador 2D con una fotografía oficial. El estado comercial permanece en index.html. */
(function () {
  'use strict';

  var OFFICIAL_SCENE = Object.freeze({
    src: './assets/images/scene/setup-pro-base.webp',
    width: 1024,
    height: 1024,
    alt: 'Ambiente PrimOffice con escritorio de madera, silla negra, monitor y notebook'
  });

  var BEFORE_SCENE = Object.freeze({
    src: './assets/images/comparacion/setup-antes.webp',
    width: 900,
    height: 1200,
    alt: 'Referencia ambiental de un espacio de trabajo antes de optimizarlo'
  });

  var VALID_PRESETS = Object.freeze({
    starter: true,
    pro: true,
    epic: true
  });

  var PRODUCT_PRESENTATION = Object.freeze({
    soporte_notebook: Object.freeze({ short: 'Notebook', panel: 'Soporte de notebook', icon: 'notebook' }),
    soporte_monitor: Object.freeze({ short: 'Monitor', panel: 'Brazo de monitor', icon: 'monitor' }),
    teclado_mec: Object.freeze({ short: 'Teclado', panel: 'Teclado mec\u00e1nico', icon: 'keyboard' }),
    mouse_vertical: Object.freeze({ short: 'Mouse', panel: 'Mouse vertical', icon: 'mouse' }),
    mousepad_xxl: Object.freeze({ short: 'Mousepad', panel: 'Mousepad XXL', icon: 'pad' }),
    hub_usb: Object.freeze({ short: 'Hub', panel: 'Hub USB-C', icon: 'hub' }),
    organizador_prem: Object.freeze({ short: 'Orden', panel: 'Organizador de cables', icon: 'organizer' }),
    luz_led: Object.freeze({ short: 'Luz', panel: 'Barra de luz', icon: 'light' }),
    'reposamu\u00f1ecas': Object.freeze({ short: 'Mu\u00f1eca', panel: 'Reposamu\u00f1ecas', icon: 'wrist' }),
    almohadilla: Object.freeze({ short: 'Lumbar', panel: 'Soporte lumbar', icon: 'lumbar' }),
    standing_desk: Object.freeze({ short: 'Escritorio', panel: 'Escritorio regulable', icon: 'desk' })
  });

  var root = null;
  var bridge = null;
  var commercialState = null;
  var presentedPreset = 'pro';
  var focusedProductId = '';
  var beforeMode = false;
  var lastSceneKey = '';
  var lastRailKey = '';
  var lastResultTier = '';

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizePreset(value) {
    var preset = String(value || '').toLowerCase();
    return VALID_PRESETS[preset] ? preset : '';
  }

  function inferPresetFromResult() {
    var tier = byId('result-tier');
    var match = tier && tier.textContent
      ? tier.textContent.match(/\b(Starter|Pro|Epic)\b/i)
      : null;
    return normalizePreset(match && match[1]) || 'pro';
  }

  function presentationFor(id) {
    return PRODUCT_PRESENTATION[id] || {
      short: id,
      panel: commercialState && commercialState.products && commercialState.products[id]
        ? commercialState.products[id].name
        : id,
      icon: 'generic'
    };
  }

  function isIncluded(id) {
    return !!(commercialState && commercialState.selected && commercialState.selected[id]);
  }

  function isKnownProduct(id) {
    return !!(commercialState && commercialState.productIds &&
      commercialState.productIds.indexOf(id) !== -1);
  }

  function iconSvg(name) {
    var paths = {
      notebook: '<rect x="4" y="5" width="16" height="11" rx="1.5"></rect><path d="M2.5 19h19"></path>',
      monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"></rect><path d="M12 16v4m-4 0h8"></path>',
      keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"></rect><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"></path>',
      mouse: '<rect x="7" y="3" width="10" height="18" rx="5"></rect><path d="M12 3v6"></path>',
      pad: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 15h7"></path>',
      hub: '<rect x="3" y="7" width="18" height="10" rx="2"></rect><path d="M7 11v2m4-2v2m4-2v2m4-2v2"></path>',
      organizer: '<path d="M4 8h16l-1 10H5L4 8Z"></path><path d="M8 8V5h8v3"></path>',
      light: '<path d="M9 18h6m-5 3h4"></path><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.5 15.2 14 16 14 18h-4c0-2-.5-2.8-1.5-3.5Z"></path>',
      wrist: '<path d="M4 15c4-5 12-5 16 0"></path><path d="M5 18h14"></path>',
      lumbar: '<path d="M9 3c5 3 5 15 0 18"></path><path d="M15 3c-5 3-5 15 0 18"></path>',
      desk: '<path d="M3 9h18M5 9v11m14-11v11"></path><path d="M8 5h8"></path>',
      generic: '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v8m-4-4h8"></path>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (paths[name] || paths.generic) + '</svg>';
  }

  function setSceneSource(scene) {
    var image = byId('setupSceneImage');
    var frame = byId('setupScene');
    var fallback = byId('setupSceneFallback');
    if (!image || !frame) return;

    image.width = scene.width;
    image.height = scene.height;
    image.alt = scene.alt;

    if (image.getAttribute('src') !== scene.src) {
      frame.classList.add('is-changing');
      if (fallback) fallback.hidden = true;
      image.setAttribute('src', scene.src);
    }
  }

  function renderScene() {
    var scene = beforeMode ? BEFORE_SCENE : OFFICIAL_SCENE;
    var frame = byId('setupScene');
    var legend = byId('setupSceneLegend');
    var context = byId('setupSceneContext');
    var beforeButton = byId('setupBeforeToggle');
    var sceneKey = (beforeMode ? 'before:' : 'setup:') + scene.src;
    if (!frame) return;

    frame.dataset.mode = beforeMode ? 'before' : 'setup';
    root.dataset.presentedPreset = presentedPreset || '';
    if (legend) {
      legend.textContent = beforeMode
        ? 'Referencia visual: antes de optimizar'
        : 'Vista orientativa del ambiente PrimOffice';
    }
    if (context) {
      context.textContent = beforeMode
        ? 'Volv\u00e9 al setup para revisar tu selecci\u00f3n.'
        : 'Los productos seleccionados se detallan debajo y en tu carrito.';
    }
    if (beforeButton) {
      beforeButton.textContent = beforeMode ? 'Volver al setup' : 'Ver antes';
      beforeButton.setAttribute('aria-pressed', beforeMode ? 'true' : 'false');
    }

    if (sceneKey !== lastSceneKey) {
      setSceneSource(scene);
      lastSceneKey = sceneKey;
    }
  }

  function renderRail() {
    var rail = byId('setupProductRail');
    if (!rail || !commercialState || !commercialState.productIds) return;
    var key = commercialState.productIds.join('|');
    if (key === lastRailKey) return;

    rail.innerHTML = commercialState.productIds.map(function (id) {
      var present = presentationFor(id);
      return '<div class="setup-product-bar__item" role="listitem">' +
        '<button type="button" class="setup-product-chip" data-rail-product="' + escapeHtml(id) + '"' +
        ' aria-pressed="false">' +
        '<span class="setup-product-chip__icon">' + iconSvg(present.icon) + '</span>' +
        '<span class="setup-product-chip__name">' + escapeHtml(present.short) + '</span>' +
        '<span class="setup-product-chip__mark" aria-hidden="true"></span>' +
        '</button></div>';
    }).join('');
    lastRailKey = key;
  }

  function updateMiniPanel() {
    var panel = byId('setupProductMiniPanel');
    if (!panel || !focusedProductId || !isKnownProduct(focusedProductId)) {
      if (panel) panel.innerHTML = '';
      return;
    }

    var present = presentationFor(focusedProductId);
    var included = isIncluded(focusedProductId);
    panel.innerHTML =
      '<div class="setup-product-bar__selection">' +
      '<strong>' + escapeHtml(present.panel) + '</strong>' +
      '<span class="setup-product-bar__state">' + (included ? 'Incluido' : 'No incluido') + '</span>' +
      '</div>' +
      '<span class="setup-product-bar__hint">Doble click para cambiarlo. Enter o Espacio desde el teclado.</span>';
  }

  function updateInteractiveStates() {
    if (!root) return;

    root.querySelectorAll('[data-rail-product]').forEach(function (button) {
      var id = button.getAttribute('data-rail-product');
      var focused = id === focusedProductId;
      var included = isIncluded(id);
      var present = presentationFor(id);
      var action = included ? 'quitar' : 'agregar';
      button.classList.toggle('is-focused', focused);
      button.classList.toggle('is-included', included);
      button.setAttribute('aria-pressed', included ? 'true' : 'false');
      button.setAttribute('aria-label', present.panel + ', ' +
        (included ? 'incluido' : 'no incluido') + '. Click para enfocar. Doble click, Enter o Espacio para ' + action + '.');
      var mark = button.querySelector('.setup-product-chip__mark');
      if (mark) mark.textContent = included ? '\u2713' : '+';
    });

    updateMiniPanel();
  }

  function chooseInitialProduct() {
    var included = commercialState.productIds.find(isIncluded);
    return included || commercialState.productIds[0] || '';
  }

  function selectProduct(id) {
    if (!isKnownProduct(id)) return false;
    focusedProductId = id;
    updateInteractiveStates();
    return true;
  }

  function toggleProduct(id, source) {
    if (!isKnownProduct(id) || !bridge || typeof bridge.setProductSelection !== 'function') return false;
    focusedProductId = id;
    return bridge.setProductSelection(id, !isIncluded(id), {
      source: source || 'visual_double_click'
    });
  }

  function setComparison(mode) {
    if (mode !== 'current' && mode !== 'primoffice') return false;
    beforeMode = mode === 'current';
    renderScene();
    return true;
  }

  function syncPresentedPresetFromButtons() {
    var activeButton = document.querySelector('.combo-preset__btn.is-active[data-combo-preset]');
    if (activeButton) presentedPreset = normalizePreset(activeButton.getAttribute('data-combo-preset'));
    else presentedPreset = '';
    if (root) root.dataset.presentedPreset = presentedPreset;
  }

  function sync(payload) {
    if (!root || !bridge || typeof bridge.getState !== 'function') return false;
    commercialState = bridge.getState();
    if (!commercialState || !Array.isArray(commercialState.productIds)) return false;

    var requestedPreset = payload && payload.change
      ? normalizePreset(payload.change.preset)
      : '';
    var tierNode = byId('result-tier');
    var currentResultTier = tierNode ? tierNode.textContent.trim() : '';
    if (requestedPreset) {
      presentedPreset = requestedPreset;
      beforeMode = false;
    } else if (!lastRailKey || currentResultTier !== lastResultTier) {
      presentedPreset = inferPresetFromResult();
      beforeMode = false;
    }
    lastResultTier = currentResultTier;

    renderRail();
    if (!isKnownProduct(focusedProductId)) focusedProductId = chooseInitialProduct();
    renderScene();
    updateInteractiveStates();
    queueMicrotask(syncPresentedPresetFromButtons);
    return true;
  }

  function productIdFromInteractive(target) {
    var railButton = target.closest('[data-rail-product]');
    if (railButton && root.contains(railButton)) return railButton.getAttribute('data-rail-product');
    return '';
  }

  function handleRootClick(event) {
    var beforeButton = event.target.closest('[data-scene-before]');
    if (beforeButton && root.contains(beforeButton)) {
      setComparison(beforeMode ? 'primoffice' : 'current');
      return;
    }

    var id = productIdFromInteractive(event.target);
    if (id) selectProduct(id);
  }

  function handleRootDoubleClick(event) {
    var id = productIdFromInteractive(event.target);
    if (!id) return;
    event.preventDefault();
    toggleProduct(id, 'visual_rail_double_click');
  }

  function handleRootKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    var id = productIdFromInteractive(event.target);
    if (!id) return;
    event.preventDefault();
    toggleProduct(id, event.key === 'Enter' ? 'visual_keyboard_enter' : 'visual_keyboard_space');
  }

  function init(options) {
    if (root) return true;
    root = byId('setupVisualHybrid');
    bridge = options || window.PrimOfficeHybridBridge || null;
    if (!root || !bridge) return false;

    root.addEventListener('click', handleRootClick);
    root.addEventListener('dblclick', handleRootDoubleClick);
    root.addEventListener('keydown', handleRootKeydown);

    var image = byId('setupSceneImage');
    var frame = byId('setupScene');
    var fallback = byId('setupSceneFallback');
    if (image && frame) {
      image.addEventListener('load', function () {
        frame.classList.remove('is-changing');
        if (fallback) fallback.hidden = true;
      });
      image.addEventListener('error', function () {
        frame.classList.remove('is-changing');
        if (fallback) fallback.hidden = false;
      });
    }

    return sync();
  }

  window.SetupVisualHybrid = {
    init: init,
    sync: sync,
    selectProduct: selectProduct,
    setComparison: setComparison,
    scene: OFFICIAL_SCENE
  };

  function autoInit() {
    init(window.PrimOfficeHybridBridge);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
})();
