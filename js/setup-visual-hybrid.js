// GUÍA EDUCATIVA: compositor fotográfico que importa configuración y calibración, pero delega el estado comercial al puente de index.html.
// Publica una API global para que carrito, presets y comparación sincronicen las capas visibles.
// Inicia la lista de símbolos que se obtienen del módulo indicado al cerrar esta declaración.
import {
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  COMMERCIAL_TO_VISUAL,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  SETUP_LAYER_MANIFEST,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  SETUP_LAYER_ORDER,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  VISUAL_PRODUCT_IDS,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  getSetupLayerLayout,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  deriveVisibleSetupLayers
// Cierra la lista de importación e identifica el archivo que provee esos símbolos.
} from './setup-visual-config.js?v=layout-by-desk-2';
// Inicia la lista de símbolos que se obtienen del módulo indicado al cerrar esta declaración.
import {
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  createSetupCalibrationController,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  isSetupCalibrationEnabled,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  logicalPointToTransform,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  resolveLayerPosition
// Cierra la lista de importación e identifica el archivo que provee esos símbolos.
} from './setup-visual-calibration.js';

/* Compositor fotográfico 2D. El estado comercial permanece en index.html. */
// Abre una función autoejecutable que mantiene privado el estado interno y evita colisiones con otros archivos.
(function () {
  // Activa el modo estricto para detectar asignaciones accidentales y aplicar reglas más seguras del lenguaje.
  'use strict';

  // Declara estado mutable para BEFORE_SCENE; la inicialización aporta los datos que consumirá el bloque siguiente.
  var BEFORE_SCENE = Object.freeze({
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    src: './assets/images/comparacion/setup-antes.webp',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    width: 900,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    height: 1200,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    alt: 'Referencia ambiental de un espacio de trabajo antes de optimizarlo'
  });

  // Declara estado mutable para VALID_PRESETS; la inicialización aporta los datos que consumirá el bloque siguiente.
  var VALID_PRESETS = Object.freeze({ starter: true, pro: true, epic: true });

  // Declara estado mutable para PRODUCT_PRESENTATION; la inicialización aporta los datos que consumirá el bloque siguiente.
  var PRODUCT_PRESENTATION = Object.freeze({
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    soporte_notebook: Object.freeze({ short: 'pNotebook', panel: 'pNotebook · soporte de notebook', icon: 'notebook' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    soporte_monitor: Object.freeze({ short: 'pArm', panel: 'pArm · brazo de monitor', icon: 'monitor' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    teclado_mec: Object.freeze({ short: 'pMechanic', panel: 'pMechanic · teclado mecánico', icon: 'keyboard' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    mouse_vertical: Object.freeze({ short: 'pMouseProV', panel: 'pMouseProV · mouse vertical', icon: 'mouse' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    mousepad_xxl: Object.freeze({ short: 'pMat', panel: 'pMat · pad XL', icon: 'pad' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    hub_usb: Object.freeze({ short: 'pHub', panel: 'pHub · hub USB-C', icon: 'hub' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    organizador_prem: Object.freeze({ short: 'pBox', panel: 'pBox · organizador de cables', icon: 'organizer' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    luz_led: Object.freeze({ short: 'pGlow', panel: 'pGlow · barra de luz', icon: 'light' }),
    // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
    standing_desk: Object.freeze({ short: 'pStanding', panel: 'pStanding · escritorio regulable', icon: 'desk' })
  });

  // Declara estado mutable para root; la inicialización aporta los datos que consumirá el bloque siguiente.
  var root = null;
  // Declara estado mutable para bridge; la inicialización aporta los datos que consumirá el bloque siguiente.
  var bridge = null;
  // Declara estado mutable para commercialState; la inicialización aporta los datos que consumirá el bloque siguiente.
  var commercialState = null;
  // Declara estado mutable para presentedPreset; la inicialización aporta los datos que consumirá el bloque siguiente.
  var presentedPreset = 'pro';
  // Declara estado mutable para focusedProductId; la inicialización aporta los datos que consumirá el bloque siguiente.
  var focusedProductId = '';
  // Declara estado mutable para beforeMode; la inicialización aporta los datos que consumirá el bloque siguiente.
  var beforeMode = false;
  // Declara estado mutable para lastSceneKey; la inicialización aporta los datos que consumirá el bloque siguiente.
  var lastSceneKey = '';
  // Declara estado mutable para lastRailKey; la inicialización aporta los datos que consumirá el bloque siguiente.
  var lastRailKey = '';
  // Declara estado mutable para lastResultTier; la inicialización aporta los datos que consumirá el bloque siguiente.
  var lastResultTier = '';
  // Declara estado mutable para layerElements; la inicialización aporta los datos que consumirá el bloque siguiente.
  var layerElements = Object.create(null);
  // Declara estado mutable para visibleLayerKeys; la inicialización aporta los datos que consumirá el bloque siguiente.
  var visibleLayerKeys = [];
  // Declara estado mutable para calibration; la inicialización aporta los datos que consumirá el bloque siguiente.
  var calibration = null;
  // Declara estado mutable para calibrationPresetSelection; la inicialización aporta los datos que consumirá el bloque siguiente.
  var calibrationPresetSelection = null;
  // Declara estado mutable para calibrationPresetName; la inicialización aporta los datos que consumirá el bloque siguiente.
  var calibrationPresetName = '';
  // Declara estado mutable para assetErrors; la inicialización aporta los datos que consumirá el bloque siguiente.
  var assetErrors = [];

  // Declara la función byId; recibe id y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function byId(id) { return document.getElementById(id); }

  // Declara la función escapeHtml; recibe value y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function escapeHtml(value) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return String(value == null ? '' : value)
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      .replace(/&/g, '&amp;')
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      .replace(/</g, '&lt;')
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      .replace(/>/g, '&gt;')
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      .replace(/"/g, '&quot;')
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      .replace(/'/g, '&#039;');
  }

  // Declara la función normalizePreset; recibe value y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function normalizePreset(value) {
    // Declara estado mutable para preset; la inicialización aporta los datos que consumirá el bloque siguiente.
    var preset = String(value || '').toLowerCase();
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return VALID_PRESETS[preset] ? preset : '';
  }

  // Declara la función inferPresetFromResult; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function inferPresetFromResult() {
    // Declara estado mutable para tier; la inicialización aporta los datos que consumirá el bloque siguiente.
    var tier = byId('result-tier');
    // Declara estado mutable para match; la inicialización aporta los datos que consumirá el bloque siguiente.
    var match = tier && tier.textContent ? tier.textContent.match(/\b(Starter|Pro|Epic)\b/i) : null;
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return normalizePreset(match && match[1]) || 'pro';
  }

  // Declara la función presentationFor; recibe id y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function presentationFor(id) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return PRODUCT_PRESENTATION[id] || {
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      short: id,
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      panel: commercialState && commercialState.products && commercialState.products[id]
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        ? commercialState.products[id].name
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        : id,
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      icon: 'generic'
    };
  }

  // Declara la función isIncluded; recibe id y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function isIncluded(id) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return !!(commercialState && commercialState.selected && commercialState.selected[id]);
  }

  // Declara la función visualSelection; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function visualSelection() {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return calibrationPresetSelection ||
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      (commercialState && commercialState.selected ? commercialState.selected : {});
  }

  // Declara la función isVisuallyIncluded; recibe id y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function isVisuallyIncluded(id) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return !!visualSelection()[id];
  }

  // Declara la función isKnownVisualProduct; recibe id y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function isKnownVisualProduct(id) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return VISUAL_PRODUCT_IDS.indexOf(id) !== -1 &&
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      !!(commercialState && commercialState.productIds && commercialState.productIds.indexOf(id) !== -1);
  }

  // Declara la función iconSvg; recibe name y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function iconSvg(name) {
    // Declara estado mutable para paths; la inicialización aporta los datos que consumirá el bloque siguiente.
    var paths = {
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      notebook: '<rect x="4" y="5" width="16" height="11" rx="1.5"></rect><path d="M2.5 19h19"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"></rect><path d="M12 16v4m-4 0h8"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"></rect><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      mouse: '<rect x="7" y="3" width="10" height="18" rx="5"></rect><path d="M12 3v6"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      pad: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 15h7"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      hub: '<rect x="3" y="7" width="18" height="10" rx="2"></rect><path d="M7 11v2m4-2v2m4-2v2m4-2v2"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      organizer: '<path d="M4 8h16l-1 10H5L4 8Z"></path><path d="M8 8V5h8v3"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      light: '<path d="M9 18h6m-5 3h4"></path><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.5 15.2 14 16 14 18h-4c0-2-.5-2.8-1.5-3.5Z"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      desk: '<path d="M3 9h18M5 9v11m14-11v11"></path><path d="M8 5h8"></path>',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      generic: '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v8m-4-4h8"></path>'
    };
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      (paths[name] || paths.generic) + '</svg>';
  }

  // Declara la función showAssetErrors; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function showAssetErrors() {
    // Declara estado mutable para fallback; la inicialización aporta los datos que consumirá el bloque siguiente.
    var fallback = byId('setupSceneFallback');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!fallback) return;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!assetErrors.length) {
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      fallback.hidden = true;
      // Actualiza el contenido visible con datos derivados del estado actual.
      fallback.textContent = '';
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return;
    }
    // Actualiza el contenido visible con datos derivados del estado actual.
    fallback.textContent = 'No se pudieron cargar estas capas: ' + assetErrors.join(', ') + '.';
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    fallback.hidden = false;
  }

  // Declara la función registerAssetError; recibe key y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function registerAssetError(key) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (assetErrors.indexOf(key) === -1) assetErrors.push(key);
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    showAssetErrors();
  }

  // Declara la función createLayerStack; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function createLayerStack() {
    // Declara estado mutable para host; la inicialización aporta los datos que consumirá el bloque siguiente.
    var host = byId('setupSceneLayers');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!host || host.childElementCount) return;

    // Declara estado mutable para fragment; la inicialización aporta los datos que consumirá el bloque siguiente.
    var fragment = document.createDocumentFragment();
    // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
    SETUP_LAYER_ORDER.forEach(function (key, index) {
      // Declara estado mutable para layer; la inicialización aporta los datos que consumirá el bloque siguiente.
      var layer = SETUP_LAYER_MANIFEST[key];
      // Declara estado mutable para image; la inicialización aporta los datos que consumirá el bloque siguiente.
      var image = document.createElement('img');
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.className = 'setup-scene__layer';
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.id = 'setupLayer' + key.charAt(0).toUpperCase() + key.slice(1);
      // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
      image.dataset.setupLayer = key;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.width = layer.width;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.height = layer.height;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.alt = '';
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.hidden = true;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.decoding = 'async';
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.loading = 'eager';
      // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
      image.setAttribute('aria-hidden', 'true');
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.style.zIndex = String(index + 2);
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.style.transform = logicalPointToTransform(resolveLayerPosition(key, null, 'standard'));
      // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
      image.addEventListener('error', function () {
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        registerAssetError(key);
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      }, { once: true });
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      image.src = layer.src;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      layerElements[key] = image;
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      fragment.appendChild(image);
    });
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    host.appendChild(fragment);
  }

  // Declara la función setLayerVisible; recibe key, visible y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setLayerVisible(key, visible) {
    // Declara estado mutable para layer; la inicialización aporta los datos que consumirá el bloque siguiente.
    var layer = layerElements[key];
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (layer) layer.hidden = !visible;
  }

  // Declara la función resolveVisibleLayerForProduct; recibe productId, visibleSet y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function resolveVisibleLayerForProduct(productId, visibleSet) {
    // Declara estado mutable para activeLayers; la inicialización aporta los datos que consumirá el bloque siguiente.
    var activeLayers = visibleSet || new Set(visibleLayerKeys);
    // Declara estado mutable para key; la inicialización aporta los datos que consumirá el bloque siguiente.
    var key = productId === 'standing_desk'
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      ? (activeLayers.has('standingDesk') ? 'standingDesk' : 'standardDesk')
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      : COMMERCIAL_TO_VISUAL[productId];
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return key && activeLayers.has(key) ? key : '';
  }

  // Declara la función setupSceneAlt; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setupSceneAlt() {
    // Declara estado mutable para selectedNames; la inicialización aporta los datos que consumirá el bloque siguiente.
    var selectedNames = VISUAL_PRODUCT_IDS.filter(isVisuallyIncluded).map(function (id) {
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return presentationFor(id).panel;
    });
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return selectedNames.length
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      ? 'Setup PrimOffice con ' + selectedNames.join(', ')
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      : 'Ambiente PrimOffice con escritorio estándar';
  }

  // Declara la función renderScene; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function renderScene() {
    // Declara estado mutable para frame; la inicialización aporta los datos que consumirá el bloque siguiente.
    var frame = byId('setupScene');
    // Declara estado mutable para base; la inicialización aporta los datos que consumirá el bloque siguiente.
    var base = byId('setupSceneImage');
    // Declara estado mutable para beforeImage; la inicialización aporta los datos que consumirá el bloque siguiente.
    var beforeImage = byId('setupBeforeImage');
    // Declara estado mutable para legend; la inicialización aporta los datos que consumirá el bloque siguiente.
    var legend = byId('setupSceneLegend');
    // Declara estado mutable para context; la inicialización aporta los datos que consumirá el bloque siguiente.
    var context = byId('setupSceneContext');
    // Declara estado mutable para beforeButton; la inicialización aporta los datos que consumirá el bloque siguiente.
    var beforeButton = byId('setupBeforeToggle');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!frame || !base || !beforeImage) return;

    // Declara estado mutable para selected; la inicialización aporta los datos que consumirá el bloque siguiente.
    var selected = visualSelection();
    // Declara estado mutable para deskType; la inicialización aporta los datos que consumirá el bloque siguiente.
    var deskType = selected.standing_desk ? 'standing' : 'standard';
    // Declara estado mutable para visibleLayers; la inicialización aporta los datos que consumirá el bloque siguiente.
    var visibleLayers = beforeMode ? [] : deriveVisibleSetupLayers(selected);
    // Declara estado mutable para sceneKey; la inicialización aporta los datos que consumirá el bloque siguiente.
    var sceneKey = (beforeMode ? 'before' : 'setup') + ':' + deskType + ':' + visibleLayers.join('|');
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    visibleLayerKeys = visibleLayers.slice();

    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    frame.dataset.mode = beforeMode ? 'before' : 'setup';
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    frame.dataset.visibleLayers = visibleLayers.join(',');
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    root.dataset.presentedPreset = presentedPreset || '';
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    root.dataset.presentedDeskType = deskType;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    base.alt = beforeMode ? '' : setupSceneAlt();
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    base.setAttribute('aria-hidden', beforeMode ? 'true' : 'false');
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    beforeImage.hidden = !beforeMode;

    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (legend) {
      // Actualiza el contenido visible con datos derivados del estado actual.
      legend.textContent = beforeMode
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        ? 'Referencia visual: antes de optimizar'
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        : 'Composición fotográfica por capas oficiales';
    }
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (context) {
      // Actualiza el contenido visible con datos derivados del estado actual.
      context.textContent = beforeMode
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        ? 'Volvé al setup para revisar tu selección.'
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        : 'La escena refleja la misma selección que tu carrito.';
    }
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (beforeButton) {
      // Actualiza el contenido visible con datos derivados del estado actual.
      beforeButton.textContent = beforeMode ? 'Volver al setup' : 'Ver antes';
      // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
      beforeButton.setAttribute('aria-pressed', beforeMode ? 'true' : 'false');
    }

    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (sceneKey !== lastSceneKey) {
      // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
      SETUP_LAYER_ORDER.forEach(function (key) {
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        setLayerVisible(key, visibleLayers.indexOf(key) !== -1);
      });
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      lastSceneKey = sceneKey;
    }
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (calibration) {
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      calibration.setPreset(presentedPreset);
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      calibration.setDeskType(deskType);
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      calibration.syncVisibleLayers(visibleLayers);
    // Define la alternativa que se ejecuta cuando la condición previa resulta falsa.
    } else {
      // Declara estado mutable para layout; la inicialización aporta los datos que consumirá el bloque siguiente.
      var layout = getSetupLayerLayout(deskType);
      // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
      SETUP_LAYER_ORDER.forEach(function (key) {
        // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
        if (layerElements[key]) layerElements[key].style.transform = logicalPointToTransform(layout[key]);
      });
    }
  }

  // Declara la función visualProductIds; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function visualProductIds() {
    // Conserva únicamente los elementos que satisfacen el predicado proporcionado.
    return VISUAL_PRODUCT_IDS.filter(function (id) {
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return commercialState && commercialState.productIds && commercialState.productIds.indexOf(id) !== -1;
    });
  }

  // Declara la función renderRail; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function renderRail() {
    // Declara estado mutable para rail; la inicialización aporta los datos que consumirá el bloque siguiente.
    var rail = byId('setupProductRail');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!rail || !commercialState || !commercialState.productIds) return;
    // Declara estado mutable para ids; la inicialización aporta los datos que consumirá el bloque siguiente.
    var ids = visualProductIds();
    // Declara estado mutable para key; la inicialización aporta los datos que consumirá el bloque siguiente.
    var key = ids.join('|');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (key === lastRailKey) return;

    // Transforma cada elemento y construye una colección nueva con los valores devueltos.
    rail.innerHTML = ids.map(function (id) {
      // Declara estado mutable para present; la inicialización aporta los datos que consumirá el bloque siguiente.
      var present = presentationFor(id);
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return '<div class="setup-product-bar__item" role="listitem">' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<button type="button" class="setup-product-chip" data-rail-product="' + escapeHtml(id) + '" aria-pressed="false">' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<span class="setup-product-chip__icon">' + iconSvg(present.icon) + '</span>' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<span class="setup-product-chip__name">' + escapeHtml(present.short) + '</span>' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<span class="setup-product-chip__mark" aria-hidden="true"></span>' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '</button></div>';
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    }).join('');
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    lastRailKey = key;
  }

  // Declara la función updateMiniPanel; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function updateMiniPanel() {
    // Declara estado mutable para panel; la inicialización aporta los datos que consumirá el bloque siguiente.
    var panel = byId('setupProductMiniPanel');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!panel || !focusedProductId || !isKnownVisualProduct(focusedProductId)) {
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (panel) panel.innerHTML = '';
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return;
    }

    // Declara estado mutable para present; la inicialización aporta los datos que consumirá el bloque siguiente.
    var present = presentationFor(focusedProductId);
    // Declara estado mutable para included; la inicialización aporta los datos que consumirá el bloque siguiente.
    var included = isIncluded(focusedProductId);
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (calibration) {
      // Declara estado mutable para layer; la inicialización aporta los datos que consumirá el bloque siguiente.
      var layer = resolveVisibleLayerForProduct(focusedProductId);
      // Actualiza el contenido visible con datos derivados del estado actual.
      panel.innerHTML =
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<div class="setup-product-bar__selection">' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<strong>' + escapeHtml(layer || present.panel) + '</strong>' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<span class="setup-product-bar__state">' + (layer ? 'Capa visible' : 'Capa oculta') + '</span>' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '</div>' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '<span class="setup-product-bar__hint">' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        (layer ? 'Seleccioná para calibrar; no cambia el carrito.' : 'Cambiá de preset para hacer visible esta capa.') +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        '</span>';
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return;
    }

    // Actualiza el contenido visible con datos derivados del estado actual.
    panel.innerHTML =
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<div class="setup-product-bar__selection">' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<strong>' + escapeHtml(present.panel) + '</strong>' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<span class="setup-product-bar__state">' + (included ? 'Incluido' : 'No incluido') + '</span>' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '</div>' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<span class="setup-product-bar__hint">Click, Enter o Espacio para ' + (included ? 'quitarlo' : 'agregarlo') + '.</span>';
  }

  // Declara la función updateInteractiveStates; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function updateInteractiveStates() {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!root) return;

    // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
    root.querySelectorAll('[data-rail-product]').forEach(function (button) {
      // Declara estado mutable para id; la inicialización aporta los datos que consumirá el bloque siguiente.
      var id = button.getAttribute('data-rail-product');
      // Declara estado mutable para focused; la inicialización aporta los datos que consumirá el bloque siguiente.
      var focused = id === focusedProductId;
      // Declara estado mutable para included; la inicialización aporta los datos que consumirá el bloque siguiente.
      var included = calibration ? isVisuallyIncluded(id) : isIncluded(id);
      // Declara estado mutable para present; la inicialización aporta los datos que consumirá el bloque siguiente.
      var present = presentationFor(id);
      // Declara estado mutable para mark; la inicialización aporta los datos que consumirá el bloque siguiente.
      var mark = button.querySelector('.setup-product-chip__mark');
      // Declara estado mutable para name; la inicialización aporta los datos que consumirá el bloque siguiente.
      var name = button.querySelector('.setup-product-chip__name');

      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (calibration) {
        // Declara estado mutable para layer; la inicialización aporta los datos que consumirá el bloque siguiente.
        var layer = resolveVisibleLayerForProduct(id);
        // Declara estado mutable para selected; la inicialización aporta los datos que consumirá el bloque siguiente.
        var selected = !!layer && calibration.getSelectedLayer() === layer;
        // Actualiza el estado con el valor calculado a la derecha de la asignación.
        button.disabled = !layer;
        // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
        button.classList.toggle('is-focused', selected);
        // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
        button.classList.toggle('is-included', included);
        // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
        button.classList.toggle('is-calibration-unavailable', !layer);
        // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
        button.setAttribute('aria-label', layer
          // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
          ? layer + ', capa visible. Seleccionar para calibrar.'
          // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
          : present.panel + ', capa oculta. Cambiá de preset para calibrarla.');
        // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
        if (name) name.textContent = layer || present.short;
        // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
        if (mark) mark.textContent = selected ? '\u25cf' : (layer ? '\u2194' : '\u2014');
        // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
        return;
      }

      // Declara estado mutable para action; la inicialización aporta los datos que consumirá el bloque siguiente.
      var action = included ? 'quitar' : 'agregar';
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      button.disabled = false;
      // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
      button.classList.toggle('is-focused', focused);
      // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
      button.classList.toggle('is-included', included);
      // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
      button.classList.remove('is-calibration-unavailable');
      // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
      button.setAttribute('aria-pressed', included ? 'true' : 'false');
      // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
      button.setAttribute('aria-label', present.panel + ', ' +
        // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
        (included ? 'incluido' : 'no incluido') + '. Click, Enter o Espacio para ' + action + '.');
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (name) name.textContent = present.short;
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (mark) mark.textContent = included ? '\u2713' : '+';
    });

    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    updateMiniPanel();
  }

  // Declara la función chooseInitialProduct; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function chooseInitialProduct() {
    // Declara estado mutable para ids; la inicialización aporta los datos que consumirá el bloque siguiente.
    var ids = visualProductIds();
    // Declara estado mutable para included; la inicialización aporta los datos que consumirá el bloque siguiente.
    var included = ids.find(isIncluded);
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return included || ids[0] || '';
  }

  // Declara la función toggleProduct; recibe id, source y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function toggleProduct(id, source) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!isKnownVisualProduct(id) || !bridge || typeof bridge.setProductSelection !== 'function') return false;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    focusedProductId = id;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    beforeMode = false;
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return bridge.setProductSelection(id, !isIncluded(id), {
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      source: source || 'visual_click'
    });
  }

  // Declara la función setComparison; recibe mode y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setComparison(mode) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (mode !== 'current' && mode !== 'primoffice') return false;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    beforeMode = mode === 'current';
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    renderScene();
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return true;
  }

  // Declara la función setCalibrationPresetButtonState; recibe name y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setCalibrationPresetButtonState(name) {
    // Declara estado mutable para preview; la inicialización aporta los datos que consumirá el bloque siguiente.
    var preview = root && root.closest('.desk-preview');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!preview) return;
    // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
    preview.querySelectorAll('.setup-visual-header [data-combo-preset]').forEach(function (button) {
      // Declara estado mutable para active; la inicialización aporta los datos que consumirá el bloque siguiente.
      var active = button.getAttribute('data-combo-preset') === name;
      // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
      button.classList.toggle('is-active', active);
      // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  // Declara la función syncPresentedPresetFromButtons; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function syncPresentedPresetFromButtons() {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (calibration && calibrationPresetName) {
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      presentedPreset = calibrationPresetName;
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      setCalibrationPresetButtonState(calibrationPresetName);
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (root) root.dataset.presentedPreset = presentedPreset;
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return;
    }
    // Declara estado mutable para activeButton; la inicialización aporta los datos que consumirá el bloque siguiente.
    var activeButton = document.querySelector('.combo-preset__btn.is-active[data-combo-preset]');
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    presentedPreset = activeButton
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      ? normalizePreset(activeButton.getAttribute('data-combo-preset'))
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      : '';
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (root) root.dataset.presentedPreset = presentedPreset;
  }

  // Declara la función handleCalibrationPresetClick; recibe event y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handleCalibrationPresetClick(event) {
    // Declara estado mutable para button; la inicialización aporta los datos que consumirá el bloque siguiente.
    var button = event.target.closest('[data-combo-preset]');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!button || !calibration || !bridge || typeof bridge.getPresetSelection !== 'function') return;
    // Declara estado mutable para name; la inicialización aporta los datos que consumirá el bloque siguiente.
    var name = normalizePreset(button.getAttribute('data-combo-preset'));
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!name) return;

    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    event.preventDefault();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    event.stopImmediatePropagation();
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    calibrationPresetSelection = bridge.getPresetSelection(name);
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    calibrationPresetName = name;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    presentedPreset = name;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    beforeMode = false;
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    setCalibrationPresetButtonState(name);
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    renderScene();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    updateInteractiveStates();
  }

  // Declara la función sync; recibe payload y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function sync(payload) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!root || !bridge || typeof bridge.getState !== 'function') return false;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    commercialState = bridge.getState();
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!commercialState || !Array.isArray(commercialState.productIds)) return false;

    // Declara estado mutable para requestedPreset; la inicialización aporta los datos que consumirá el bloque siguiente.
    var requestedPreset = payload && payload.change ? normalizePreset(payload.change.preset) : '';
    // Declara estado mutable para tierNode; la inicialización aporta los datos que consumirá el bloque siguiente.
    var tierNode = byId('result-tier');
    // Declara estado mutable para currentResultTier; la inicialización aporta los datos que consumirá el bloque siguiente.
    var currentResultTier = tierNode ? tierNode.textContent.trim() : '';
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (requestedPreset) {
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      presentedPreset = requestedPreset;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      beforeMode = false;
    // Prueba una condición alternativa sólo cuando las ramas anteriores no se cumplieron.
    } else if (!lastRailKey || currentResultTier !== lastResultTier) {
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      presentedPreset = inferPresetFromResult();
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      beforeMode = false;
    }
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    lastResultTier = currentResultTier;

    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    renderRail();
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!isKnownVisualProduct(focusedProductId)) focusedProductId = chooseInitialProduct();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    renderScene();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    updateInteractiveStates();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    queueMicrotask(syncPresentedPresetFromButtons);
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return true;
  }

  // Declara la función productIdFromInteractive; recibe target y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function productIdFromInteractive(target) {
    // Declara estado mutable para railButton; la inicialización aporta los datos que consumirá el bloque siguiente.
    var railButton = target.closest('[data-rail-product]');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (railButton && root.contains(railButton)) return railButton.getAttribute('data-rail-product');
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return '';
  }

  // Declara la función handleRootClick; recibe event y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handleRootClick(event) {
    // Declara estado mutable para beforeButton; la inicialización aporta los datos que consumirá el bloque siguiente.
    var beforeButton = event.target.closest('[data-scene-before]');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (beforeButton && root.contains(beforeButton)) {
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      setComparison(beforeMode ? 'primoffice' : 'current');
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return;
    }

    // Declara estado mutable para id; la inicialización aporta los datos que consumirá el bloque siguiente.
    var id = productIdFromInteractive(event.target);
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!id) return;
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    event.preventDefault();
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (calibration) {
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      focusedProductId = id;
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      calibration.handleRailSelection(id);
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      updateInteractiveStates();
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return;
    }
    toggleProduct(id, 'visual_rail_click');
    // Fuera del modo de calibración, la acción anterior delega el cambio al puente comercial y conserva una única fuente de estado.
  }

  // Declara la función handleRootKeydown; recibe event y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handleRootKeydown(event) {
    // Declara estado mutable para id; la inicialización aporta los datos que consumirá el bloque siguiente.
    var id = productIdFromInteractive(event.target);
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (calibration && calibration.handleKeydown(event, id)) {
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (id) focusedProductId = id;
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      updateInteractiveStates();
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return;
    }
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!id) return;
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    event.preventDefault();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    toggleProduct(id, event.key === 'Enter' ? 'visual_keyboard_enter' : 'visual_keyboard_space');
  }

  // Declara la función init; recibe options y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function init(options) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (root) return true;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    root = byId('setupVisualHybrid');
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    bridge = options || window.PrimOfficeHybridBridge || null;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!root || !bridge) return false;

    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    createLayerStack();
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (isSetupCalibrationEnabled(window.location.search)) {
      // Declara estado mutable para calibrationStorage; la inicialización aporta los datos que consumirá el bloque siguiente.
      var calibrationStorage = null;
      // Inicia una operación protegida para poder recuperar un fallo previsto.
      try { calibrationStorage = window.localStorage; } catch (error) { calibrationStorage = null; }
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      calibration = createSetupCalibrationController({
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        root: root,
        // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
        sceneMedia: root.querySelector('.setup-scene__media'),
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        layerElements: layerElements,
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        resolveLayerForProduct: resolveVisibleLayerForProduct,
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        storage: calibrationStorage
      });
      // Declara estado mutable para preview; la inicialización aporta los datos que consumirá el bloque siguiente.
      var preview = root.closest('.desk-preview');
      // Declara estado mutable para presetGroup; la inicialización aporta los datos que consumirá el bloque siguiente.
      var presetGroup = preview && preview.querySelector('.setup-visual-header .combo-preset__buttons');
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (presetGroup) presetGroup.addEventListener('click', handleCalibrationPresetClick, true);
    }
    // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
    root.addEventListener('click', handleRootClick);
    // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
    root.addEventListener('keydown', handleRootKeydown);

    // Declara estado mutable para base; la inicialización aporta los datos que consumirá el bloque siguiente.
    var base = byId('setupSceneImage');
    // Declara estado mutable para beforeImage; la inicialización aporta los datos que consumirá el bloque siguiente.
    var beforeImage = byId('setupBeforeImage');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (base) {
      // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
      base.addEventListener('error', function () {
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        registerAssetError('base');
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      }, { once: true });
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (base.complete && !base.naturalWidth) registerAssetError('base');
    }
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (beforeImage) {
      // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
      beforeImage.addEventListener('error', function () {
        // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
        registerAssetError('before');
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      }, { once: true });
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      beforeImage.src = BEFORE_SCENE.src;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      beforeImage.width = BEFORE_SCENE.width;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      beforeImage.height = BEFORE_SCENE.height;
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      beforeImage.alt = BEFORE_SCENE.alt;
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (beforeImage.complete && !beforeImage.naturalWidth) registerAssetError('before');
    }

    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return sync();
  }

  // Publica una API controlada en el ámbito global para que el script inline pueda consumirla.
  window.SetupVisualHybrid = {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    init: init,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    sync: sync,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    setComparison: setComparison,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    deriveVisibleSetupLayers: deriveVisibleSetupLayers,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    manifest: SETUP_LAYER_MANIFEST,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    commercialToVisual: COMMERCIAL_TO_VISUAL,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    layerOrder: SETUP_LAYER_ORDER,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    calibrationActive: function () { return !!calibration; }
  };

  // Declara la función autoInit; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function autoInit() { init(window.PrimOfficeHybridBridge); }

  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (document.readyState === 'loading') {
    // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  // Define la alternativa que se ejecuta cuando la condición previa resulta falsa.
  } else {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    autoInit();
  }
})();
