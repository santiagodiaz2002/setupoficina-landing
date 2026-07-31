import {
  COMMERCIAL_TO_VISUAL,
  SETUP_LAYER_MANIFEST,
  SETUP_LAYER_ORDER,
  VISUAL_PRODUCT_IDS,
  getSetupLayerLayout,
  deriveVisibleSetupLayers
} from './setup-visual-config.js?v=layout-by-desk-2';
import {
  createSetupCalibrationController,
  isSetupCalibrationEnabled,
  logicalPointToTransform,
  resolveLayerPosition
} from './setup-visual-calibration.js';

/* Compositor fotográfico 2D. El estado comercial permanece en index.html. */
(function () {
  'use strict';

  var BEFORE_SCENE = Object.freeze({
    src: './assets/images/comparacion/setup-antes.webp',
    width: 900,
    height: 1200,
    alt: 'Referencia ambiental de un espacio de trabajo antes de optimizarlo'
  });

  var VALID_PRESETS = Object.freeze({ starter: true, pro: true, epic: true });

  var PRODUCT_PRESENTATION = Object.freeze({
    soporte_notebook: Object.freeze({ short: 'pNotebook', panel: 'pNotebook · soporte de notebook', icon: 'notebook' }),
    soporte_monitor: Object.freeze({ short: 'pArm', panel: 'pArm · brazo de monitor', icon: 'monitor' }),
    teclado_mec: Object.freeze({ short: 'pMechanic', panel: 'pMechanic · teclado mecánico', icon: 'keyboard' }),
    mouse_vertical: Object.freeze({ short: 'pMouseProV', panel: 'pMouseProV · mouse vertical', icon: 'mouse' }),
    mousepad_xxl: Object.freeze({ short: 'pMat', panel: 'pMat · pad XL', icon: 'pad' }),
    hub_usb: Object.freeze({ short: 'pHub', panel: 'pHub · hub USB-C', icon: 'hub' }),
    organizador_prem: Object.freeze({ short: 'pBox', panel: 'pBox · organizador de cables', icon: 'organizer' }),
    luz_led: Object.freeze({ short: 'pGlow', panel: 'pGlow · barra de luz', icon: 'light' }),
    standing_desk: Object.freeze({ short: 'pStanding', panel: 'pStanding · escritorio regulable', icon: 'desk' })
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
  var layerElements = Object.create(null);
  var visibleLayerKeys = [];
  var calibration = null;
  var calibrationPresetSelection = null;
  var calibrationPresetName = '';
  var assetErrors = [];

  function byId(id) { return document.getElementById(id); }

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
    var match = tier && tier.textContent ? tier.textContent.match(/\b(Starter|Pro|Epic)\b/i) : null;
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

  function visualSelection() {
    return calibrationPresetSelection ||
      (commercialState && commercialState.selected ? commercialState.selected : {});
  }

  function isVisuallyIncluded(id) {
    return !!visualSelection()[id];
  }

  function isKnownVisualProduct(id) {
    return VISUAL_PRODUCT_IDS.indexOf(id) !== -1 &&
      !!(commercialState && commercialState.productIds && commercialState.productIds.indexOf(id) !== -1);
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
      desk: '<path d="M3 9h18M5 9v11m14-11v11"></path><path d="M8 5h8"></path>',
      generic: '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v8m-4-4h8"></path>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (paths[name] || paths.generic) + '</svg>';
  }

  function showAssetErrors() {
    var fallback = byId('setupSceneFallback');
    if (!fallback) return;
    if (!assetErrors.length) {
      fallback.hidden = true;
      fallback.textContent = '';
      return;
    }
    fallback.textContent = 'No se pudieron cargar estas capas: ' + assetErrors.join(', ') + '.';
    fallback.hidden = false;
  }

  function registerAssetError(key) {
    if (assetErrors.indexOf(key) === -1) assetErrors.push(key);
    showAssetErrors();
  }

  function createLayerStack() {
    var host = byId('setupSceneLayers');
    if (!host || host.childElementCount) return;

    var fragment = document.createDocumentFragment();
    SETUP_LAYER_ORDER.forEach(function (key, index) {
      var layer = SETUP_LAYER_MANIFEST[key];
      var image = document.createElement('img');
      image.className = 'setup-scene__layer';
      image.id = 'setupLayer' + key.charAt(0).toUpperCase() + key.slice(1);
      image.dataset.setupLayer = key;
      image.width = layer.width;
      image.height = layer.height;
      image.alt = '';
      image.hidden = true;
      image.decoding = 'async';
      image.loading = 'eager';
      image.setAttribute('aria-hidden', 'true');
      image.style.zIndex = String(index + 2);
      image.style.transform = logicalPointToTransform(resolveLayerPosition(key, null, 'standard'));
      image.addEventListener('error', function () {
        registerAssetError(key);
      }, { once: true });
      image.src = layer.src;
      layerElements[key] = image;
      fragment.appendChild(image);
    });
    host.appendChild(fragment);
  }

  function setLayerVisible(key, visible) {
    var layer = layerElements[key];
    if (layer) layer.hidden = !visible;
  }

  function resolveVisibleLayerForProduct(productId, visibleSet) {
    var activeLayers = visibleSet || new Set(visibleLayerKeys);
    var key = productId === 'standing_desk'
      ? (activeLayers.has('standingDesk') ? 'standingDesk' : 'standardDesk')
      : COMMERCIAL_TO_VISUAL[productId];
    return key && activeLayers.has(key) ? key : '';
  }

  function setupSceneAlt() {
    var selectedNames = VISUAL_PRODUCT_IDS.filter(isVisuallyIncluded).map(function (id) {
      return presentationFor(id).panel;
    });
    return selectedNames.length
      ? 'Setup PrimOffice con ' + selectedNames.join(', ')
      : 'Ambiente PrimOffice con escritorio estándar';
  }

  function renderScene() {
    var frame = byId('setupScene');
    var base = byId('setupSceneImage');
    var beforeImage = byId('setupBeforeImage');
    var legend = byId('setupSceneLegend');
    var context = byId('setupSceneContext');
    var beforeButton = byId('setupBeforeToggle');
    if (!frame || !base || !beforeImage) return;

    var selected = visualSelection();
    var deskType = selected.standing_desk ? 'standing' : 'standard';
    var visibleLayers = beforeMode ? [] : deriveVisibleSetupLayers(selected);
    var sceneKey = (beforeMode ? 'before' : 'setup') + ':' + deskType + ':' + visibleLayers.join('|');
    visibleLayerKeys = visibleLayers.slice();

    frame.dataset.mode = beforeMode ? 'before' : 'setup';
    frame.dataset.visibleLayers = visibleLayers.join(',');
    root.dataset.presentedPreset = presentedPreset || '';
    root.dataset.presentedDeskType = deskType;
    base.alt = beforeMode ? '' : setupSceneAlt();
    base.setAttribute('aria-hidden', beforeMode ? 'true' : 'false');
    beforeImage.hidden = !beforeMode;

    if (legend) {
      legend.textContent = beforeMode
        ? 'Referencia visual: antes de optimizar'
        : 'Composición fotográfica por capas oficiales';
    }
    if (context) {
      context.textContent = beforeMode
        ? 'Volvé al setup para revisar tu selección.'
        : 'La escena refleja la misma selección que tu carrito.';
    }
    if (beforeButton) {
      beforeButton.textContent = beforeMode ? 'Volver al setup' : 'Ver antes';
      beforeButton.setAttribute('aria-pressed', beforeMode ? 'true' : 'false');
    }

    if (sceneKey !== lastSceneKey) {
      SETUP_LAYER_ORDER.forEach(function (key) {
        setLayerVisible(key, visibleLayers.indexOf(key) !== -1);
      });
      lastSceneKey = sceneKey;
    }
    if (calibration) {
      calibration.setPreset(presentedPreset);
      calibration.setDeskType(deskType);
      calibration.syncVisibleLayers(visibleLayers);
    } else {
      var layout = getSetupLayerLayout(deskType);
      SETUP_LAYER_ORDER.forEach(function (key) {
        if (layerElements[key]) layerElements[key].style.transform = logicalPointToTransform(layout[key]);
      });
    }
  }

  function visualProductIds() {
    return VISUAL_PRODUCT_IDS.filter(function (id) {
      return commercialState && commercialState.productIds && commercialState.productIds.indexOf(id) !== -1;
    });
  }

  function renderRail() {
    var rail = byId('setupProductRail');
    if (!rail || !commercialState || !commercialState.productIds) return;
    var ids = visualProductIds();
    var key = ids.join('|');
    if (key === lastRailKey) return;

    rail.innerHTML = ids.map(function (id) {
      var present = presentationFor(id);
      return '<div class="setup-product-bar__item" role="listitem">' +
        '<button type="button" class="setup-product-chip" data-rail-product="' + escapeHtml(id) + '" aria-pressed="false">' +
        '<span class="setup-product-chip__icon">' + iconSvg(present.icon) + '</span>' +
        '<span class="setup-product-chip__name">' + escapeHtml(present.short) + '</span>' +
        '<span class="setup-product-chip__mark" aria-hidden="true"></span>' +
        '</button></div>';
    }).join('');
    lastRailKey = key;
  }

  function updateMiniPanel() {
    var panel = byId('setupProductMiniPanel');
    if (!panel || !focusedProductId || !isKnownVisualProduct(focusedProductId)) {
      if (panel) panel.innerHTML = '';
      return;
    }

    var present = presentationFor(focusedProductId);
    var included = isIncluded(focusedProductId);
    if (calibration) {
      var layer = resolveVisibleLayerForProduct(focusedProductId);
      panel.innerHTML =
        '<div class="setup-product-bar__selection">' +
        '<strong>' + escapeHtml(layer || present.panel) + '</strong>' +
        '<span class="setup-product-bar__state">' + (layer ? 'Capa visible' : 'Capa oculta') + '</span>' +
        '</div>' +
        '<span class="setup-product-bar__hint">' +
        (layer ? 'Seleccioná para calibrar; no cambia el carrito.' : 'Cambiá de preset para hacer visible esta capa.') +
        '</span>';
      return;
    }

    panel.innerHTML =
      '<div class="setup-product-bar__selection">' +
      '<strong>' + escapeHtml(present.panel) + '</strong>' +
      '<span class="setup-product-bar__state">' + (included ? 'Incluido' : 'No incluido') + '</span>' +
      '</div>' +
      '<span class="setup-product-bar__hint">Click, Enter o Espacio para ' + (included ? 'quitarlo' : 'agregarlo') + '.</span>';
  }

  function updateInteractiveStates() {
    if (!root) return;

    root.querySelectorAll('[data-rail-product]').forEach(function (button) {
      var id = button.getAttribute('data-rail-product');
      var focused = id === focusedProductId;
      var included = calibration ? isVisuallyIncluded(id) : isIncluded(id);
      var present = presentationFor(id);
      var mark = button.querySelector('.setup-product-chip__mark');
      var name = button.querySelector('.setup-product-chip__name');

      if (calibration) {
        var layer = resolveVisibleLayerForProduct(id);
        var selected = !!layer && calibration.getSelectedLayer() === layer;
        button.disabled = !layer;
        button.classList.toggle('is-focused', selected);
        button.classList.toggle('is-included', included);
        button.classList.toggle('is-calibration-unavailable', !layer);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.setAttribute('aria-label', layer
          ? layer + ', capa visible. Seleccionar para calibrar.'
          : present.panel + ', capa oculta. Cambiá de preset para calibrarla.');
        if (name) name.textContent = layer || present.short;
        if (mark) mark.textContent = selected ? '\u25cf' : (layer ? '\u2194' : '\u2014');
        return;
      }

      var action = included ? 'quitar' : 'agregar';
      button.disabled = false;
      button.classList.toggle('is-focused', focused);
      button.classList.toggle('is-included', included);
      button.classList.remove('is-calibration-unavailable');
      button.setAttribute('aria-pressed', included ? 'true' : 'false');
      button.setAttribute('aria-label', present.panel + ', ' +
        (included ? 'incluido' : 'no incluido') + '. Click, Enter o Espacio para ' + action + '.');
      if (name) name.textContent = present.short;
      if (mark) mark.textContent = included ? '\u2713' : '+';
    });

    updateMiniPanel();
  }

  function chooseInitialProduct() {
    var ids = visualProductIds();
    var included = ids.find(isIncluded);
    return included || ids[0] || '';
  }

  function toggleProduct(id, source) {
    if (!isKnownVisualProduct(id) || !bridge || typeof bridge.setProductSelection !== 'function') return false;
    focusedProductId = id;
    beforeMode = false;
    return bridge.setProductSelection(id, !isIncluded(id), {
      source: source || 'visual_click'
    });
  }

  function setComparison(mode) {
    if (mode !== 'current' && mode !== 'primoffice') return false;
    beforeMode = mode === 'current';
    renderScene();
    return true;
  }

  function setCalibrationPresetButtonState(name) {
    var preview = root && root.closest('.desk-preview');
    if (!preview) return;
    preview.querySelectorAll('.setup-visual-header [data-combo-preset]').forEach(function (button) {
      var active = button.getAttribute('data-combo-preset') === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function syncPresentedPresetFromButtons() {
    if (calibration && calibrationPresetName) {
      presentedPreset = calibrationPresetName;
      setCalibrationPresetButtonState(calibrationPresetName);
      if (root) root.dataset.presentedPreset = presentedPreset;
      return;
    }
    var activeButton = document.querySelector('.combo-preset__btn.is-active[data-combo-preset]');
    presentedPreset = activeButton
      ? normalizePreset(activeButton.getAttribute('data-combo-preset'))
      : '';
    if (root) root.dataset.presentedPreset = presentedPreset;
  }

  function handleCalibrationPresetClick(event) {
    var button = event.target.closest('[data-combo-preset]');
    if (!button || !calibration || !bridge || typeof bridge.getPresetSelection !== 'function') return;
    var name = normalizePreset(button.getAttribute('data-combo-preset'));
    if (!name) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    calibrationPresetSelection = bridge.getPresetSelection(name);
    calibrationPresetName = name;
    presentedPreset = name;
    beforeMode = false;
    setCalibrationPresetButtonState(name);
    renderScene();
    updateInteractiveStates();
  }

  function sync(payload) {
    if (!root || !bridge || typeof bridge.getState !== 'function') return false;
    commercialState = bridge.getState();
    if (!commercialState || !Array.isArray(commercialState.productIds)) return false;

    var requestedPreset = payload && payload.change ? normalizePreset(payload.change.preset) : '';
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
    if (!isKnownVisualProduct(focusedProductId)) focusedProductId = chooseInitialProduct();
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
    if (!id) return;
    event.preventDefault();
    if (calibration) {
      focusedProductId = id;
      calibration.handleRailSelection(id);
      updateInteractiveStates();
      return;
    }
    toggleProduct(id, 'visual_rail_click');
  }

  function handleRootKeydown(event) {
    var id = productIdFromInteractive(event.target);
    if (calibration && calibration.handleKeydown(event, id)) {
      if (id) focusedProductId = id;
      updateInteractiveStates();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    if (!id) return;
    event.preventDefault();
    toggleProduct(id, event.key === 'Enter' ? 'visual_keyboard_enter' : 'visual_keyboard_space');
  }

  function init(options) {
    if (root) return true;
    root = byId('setupVisualHybrid');
    bridge = options || window.PrimOfficeHybridBridge || null;
    if (!root || !bridge) return false;

    createLayerStack();
    if (isSetupCalibrationEnabled(window.location.search)) {
      var calibrationStorage = null;
      try { calibrationStorage = window.localStorage; } catch (error) { calibrationStorage = null; }
      calibration = createSetupCalibrationController({
        root: root,
        sceneMedia: root.querySelector('.setup-scene__media'),
        layerElements: layerElements,
        resolveLayerForProduct: resolveVisibleLayerForProduct,
        storage: calibrationStorage
      });
      var preview = root.closest('.desk-preview');
      var presetGroup = preview && preview.querySelector('.setup-visual-header .combo-preset__buttons');
      if (presetGroup) presetGroup.addEventListener('click', handleCalibrationPresetClick, true);
    }
    root.addEventListener('click', handleRootClick);
    root.addEventListener('keydown', handleRootKeydown);

    var base = byId('setupSceneImage');
    var beforeImage = byId('setupBeforeImage');
    if (base) {
      base.addEventListener('error', function () {
        registerAssetError('base');
      }, { once: true });
      if (base.complete && !base.naturalWidth) registerAssetError('base');
    }
    if (beforeImage) {
      beforeImage.addEventListener('error', function () {
        registerAssetError('before');
      }, { once: true });
      beforeImage.src = BEFORE_SCENE.src;
      beforeImage.width = BEFORE_SCENE.width;
      beforeImage.height = BEFORE_SCENE.height;
      beforeImage.alt = BEFORE_SCENE.alt;
      if (beforeImage.complete && !beforeImage.naturalWidth) registerAssetError('before');
    }

    return sync();
  }

  window.SetupVisualHybrid = {
    init: init,
    sync: sync,
    setComparison: setComparison,
    deriveVisibleSetupLayers: deriveVisibleSetupLayers,
    manifest: SETUP_LAYER_MANIFEST,
    commercialToVisual: COMMERCIAL_TO_VISUAL,
    layerOrder: SETUP_LAYER_ORDER,
    calibrationActive: function () { return !!calibration; }
  };

  function autoInit() { init(window.PrimOfficeHybridBridge); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
})();
