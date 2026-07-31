import {
  CALIBRATABLE_SETUP_LAYERS,
  SETUP_CANVAS_SIZE,
  getSetupLayerLayout,
  normalizeSetupDeskType,
  normalizeSetupPreset
} from './setup-visual-config.js?v=layout-by-desk-2';

export const SETUP_CALIBRATION_STORAGE_KEY = 'primoffice_setup_calibration_v3';
const DESK_TYPES = Object.freeze(['standard', 'standing']);
const EMPTY_POINT = Object.freeze({ x: 0, y: 0 });

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedPoint(value) {
  return { x: finiteNumber(value && value.x, 0), y: finiteNumber(value && value.y, 0) };
}

export function isSetupCalibrationEnabled(search = '') {
  return new URLSearchParams(String(search || '')).get('calibrate') === '1';
}

export function createZeroCalibrationOffsets() {
  return CALIBRATABLE_SETUP_LAYERS.reduce((result, key) => {
    result[key] = { x: 0, y: 0 };
    return result;
  }, {});
}

export function createZeroCalibrationByDesk() {
  return DESK_TYPES.reduce((result, deskType) => {
    result[deskType] = createZeroCalibrationOffsets();
    return result;
  }, {});
}

export function sanitizeCalibrationPayload(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sourceLayers = source.layers && typeof source.layers === 'object' ? source.layers : {};
  const offsets = createZeroCalibrationOffsets();
  CALIBRATABLE_SETUP_LAYERS.forEach((key) => { offsets[key] = normalizedPoint(sourceLayers[key]); });
  return offsets;
}

export function sanitizeCalibrationStorage(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sourceDesks = source.desks && typeof source.desks === 'object' ? source.desks : {};
  const result = createZeroCalibrationByDesk();
  DESK_TYPES.forEach((deskType) => {
    const deskValue = sourceDesks[deskType];
    result[deskType] = sanitizeCalibrationPayload(
      deskValue && deskValue.layers ? deskValue : { layers: deskValue }
    );
  });
  return result;
}

export function resetCalibrationLayer(offsets, key) {
  const next = sanitizeCalibrationPayload({ layers: offsets });
  if (CALIBRATABLE_SETUP_LAYERS.includes(key)) next[key] = { x: 0, y: 0 };
  return next;
}

export function resetAllCalibrationOffsets() { return createZeroCalibrationOffsets(); }

export function canvasDeltaFromClientDelta(deltaClientX, deltaClientY, visibleWidth, visibleHeight) {
  const width = finiteNumber(visibleWidth, 0);
  const height = finiteNumber(visibleHeight, 0);
  if (width <= 0 || height <= 0) return { ...EMPTY_POINT };
  return {
    x: finiteNumber(deltaClientX, 0) * SETUP_CANVAS_SIZE.width / width,
    y: finiteNumber(deltaClientY, 0) * SETUP_CANVAS_SIZE.height / height
  };
}

export function resolveLayerPosition(key, offsets, deskType = 'standard') {
  const base = normalizedPoint(getSetupLayerLayout(deskType)[key]);
  const offset = normalizedPoint(offsets && offsets[key]);
  return { x: base.x + offset.x, y: base.y + offset.y };
}

export function logicalPointToTransform(point) {
  const normalized = normalizedPoint(point);
  return `translate(${normalized.x * 100 / SETUP_CANVAS_SIZE.width}%, ${normalized.y * 100 / SETUP_CANVAS_SIZE.height}%)`;
}

export function buildCalibrationExport(offsets, deskType = 'standard', preset = '') {
  const normalizedDeskType = normalizeSetupDeskType(deskType);
  const clean = sanitizeCalibrationPayload({ layers: offsets });
  const layers = {};
  CALIBRATABLE_SETUP_LAYERS.forEach((key) => {
    const position = resolveLayerPosition(key, clean, normalizedDeskType);
    layers[key] = { x: position.x, y: position.y };
  });
  return {
    deskType: normalizedDeskType,
    preset: normalizeSetupPreset(preset),
    canvas: { width: SETUP_CANVAS_SIZE.width, height: SETUP_CANVAS_SIZE.height },
    layers
  };
}

export function buildCalibrationStoragePayload(offsetsByDesk) {
  const clean = sanitizeCalibrationStorage({ desks: offsetsByDesk });
  const desks = {};
  DESK_TYPES.forEach((deskType) => {
    const layers = {};
    CALIBRATABLE_SETUP_LAYERS.forEach((key) => {
      const point = clean[deskType][key];
      if (point.x !== 0 || point.y !== 0) layers[key] = { x: point.x, y: point.y };
    });
    if (Object.keys(layers).length) desks[deskType] = { layers };
  });
  return {
    canvas: { width: SETUP_CANVAS_SIZE.width, height: SETUP_CANVAS_SIZE.height },
    desks
  };
}

function readStoredOffsets(storage) {
  if (!storage) return createZeroCalibrationByDesk();
  try {
    const raw = storage.getItem(SETUP_CALIBRATION_STORAGE_KEY);
    return raw ? sanitizeCalibrationStorage(JSON.parse(raw)) : createZeroCalibrationByDesk();
  } catch (error) { return createZeroCalibrationByDesk(); }
}

function persistOffsets(storage, offsetsByDesk) {
  if (!storage) return;
  try { storage.setItem(SETUP_CALIBRATION_STORAGE_KEY, JSON.stringify(buildCalibrationStoragePayload(offsetsByDesk))); } catch (error) {}
}

function copyTextWithTextarea(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error('Clipboard unavailable'));
}
function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).catch(() => copyTextWithTextarea(text));
  }
  return copyTextWithTextarea(text);
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.hidden = true;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createSetupCalibrationController(options) {
  const root = options.root;
  const sceneMedia = options.sceneMedia;
  const layerElements = options.layerElements;
  const resolveLayerForProduct = options.resolveLayerForProduct;
  const storage = options.storage || null;
  let currentPreset = 'pro';
  let currentDeskType = 'standard';
  let visibleLayers = new Set();
  let offsetsByDesk = readStoredOffsets(storage);
  let selectedLayer = '';
  let dragging = null;
  let panel = null, nameNode = null, presetNode = null, deskNode = null, xNode = null, yNode = null, resetLayerButton = null, statusNode = null;

  function currentOffsets() { return offsetsByDesk[currentDeskType]; }
  function isVisibleLayer(key) { return CALIBRATABLE_SETUP_LAYERS.includes(key) && visibleLayers.has(key); }
  function selectedPosition() { return selectedLayer ? resolveLayerPosition(selectedLayer, currentOffsets(), currentDeskType) : EMPTY_POINT; }
  function applyLayerTransform(key) {
    const element = layerElements[key];
    if (element) element.style.transform = logicalPointToTransform(resolveLayerPosition(key, currentOffsets(), currentDeskType));
  }
  function applyAllTransforms() { CALIBRATABLE_SETUP_LAYERS.forEach(applyLayerTransform); }
  function renderSelection() {
    CALIBRATABLE_SETUP_LAYERS.forEach((key) => {
      const element = layerElements[key];
      if (element) element.classList.toggle('is-calibration-selected', key === selectedLayer);
    });
    root.classList.toggle('has-calibration-selection', !!selectedLayer);
    root.dataset.calibrationLayer = selectedLayer;
    root.dataset.calibrationPreset = currentPreset;
    root.dataset.calibrationDeskType = currentDeskType;
    const point = selectedPosition();
    if (presetNode) presetNode.textContent = currentPreset;
    if (deskNode) deskNode.textContent = currentDeskType;
    if (nameNode) nameNode.textContent = selectedLayer || 'Ninguna capa seleccionada';
    if (xNode) xNode.textContent = selectedLayer ? String(point.x) : '—';
    if (yNode) yNode.textContent = selectedLayer ? String(point.y) : '—';
    if (resetLayerButton) resetLayerButton.disabled = !selectedLayer;
  }
  function setStatus(message, kind = '') { if (statusNode) { statusNode.textContent = message; statusNode.dataset.kind = kind; } }
  function saveAndRender() { persistOffsets(storage, offsetsByDesk); applyAllTransforms(); renderSelection(); }
  function setPreset(preset) {
    const next = normalizeSetupPreset(preset);
    if (next === currentPreset) { renderSelection(); return; }
    currentPreset = next;
    renderSelection();
  }
  function setDeskType(deskType) {
    const next = normalizeSetupDeskType(deskType);
    if (next === currentDeskType) { applyAllTransforms(); return; }
    currentDeskType = next;
    if (selectedLayer && !isVisibleLayer(selectedLayer)) selectedLayer = '';
    applyAllTransforms();
    renderSelection();
  }
  function selectLayer(key) {
    if (!isVisibleLayer(key)) return false;
    selectedLayer = key;
    renderSelection();
    setStatus(`Capa ${key} seleccionada en el layout ${currentDeskType}.`, 'selection');
    return true;
  }
  function updateSelectedPosition(nextPoint) {
    if (!selectedLayer || !isVisibleLayer(selectedLayer)) return false;
    const base = normalizedPoint(getSetupLayerLayout(currentDeskType)[selectedLayer]);
    currentOffsets()[selectedLayer] = {
      x: Math.round(finiteNumber(nextPoint.x, base.x) - base.x),
      y: Math.round(finiteNumber(nextPoint.y, base.y) - base.y)
    };
    saveAndRender(); return true;
  }
  function resetSelectedLayer() {
    if (!selectedLayer) return false;
    offsetsByDesk[currentDeskType] = resetCalibrationLayer(currentOffsets(), selectedLayer);
    saveAndRender();
    setStatus(`Capa ${selectedLayer} restablecida para el layout ${currentDeskType}.`, 'reset');
    return true;
  }
  function resetAllLayers() {
    offsetsByDesk[currentDeskType] = resetAllCalibrationOffsets();
    saveAndRender();
    setStatus(`Todas las capas del layout ${currentDeskType} fueron restablecidas.`, 'reset');
  }
  function exportJson() { return JSON.stringify(buildCalibrationExport(currentOffsets(), currentDeskType, currentPreset), null, 2); }
  function handlePanelClick(event) {
    const action = event.target.closest('[data-calibration-action]');
    if (!action || !panel.contains(action)) return;
    const name = action.getAttribute('data-calibration-action');
    if (name === 'reset-layer') resetSelectedLayer();
    else if (name === 'reset-all') resetAllLayers();
    else if (name === 'copy') copyText(exportJson()).then(() => setStatus('JSON copiado.', 'success')).catch(() => setStatus('No se pudo copiar.', 'error'));
    else if (name === 'download') {
      downloadText(`setup-layer-layout-${currentDeskType}.json`, exportJson());
      setStatus(`JSON del layout ${currentDeskType} generado.`, 'success');
    }
  }
  function buildPanel() {
    panel = document.createElement('section');
    panel.className = 'setup-calibration-panel';
    panel.setAttribute('aria-labelledby', 'setupCalibrationTitle');
    panel.innerHTML =
      '<div class="setup-calibration-panel__header"><div><span class="setup-calibration-panel__eyebrow">Modo temporal</span><h5 id="setupCalibrationTitle">Calibración de capas</h5></div><span class="setup-calibration-panel__canvas">Lienzo 1254 × 1254</span></div>' +
      '<div class="setup-calibration-panel__readout" aria-live="polite"><div><span>Preset visible</span><strong data-calibration-preset>pro</strong></div><div><span>Layout</span><strong data-calibration-desk>standard</strong></div><div><span>Capa</span><strong data-calibration-name>Ninguna capa seleccionada</strong></div><div><span>X</span><strong data-calibration-x>—</strong></div><div><span>Y</span><strong data-calibration-y>—</strong></div></div>' +
      '<p class="setup-calibration-panel__help">Las posiciones se comparten por tipo de escritorio. Starter, Pro y Epic no guardan coordenadas separadas.</p>' +
      '<div class="setup-calibration-panel__actions"><button type="button" data-calibration-action="reset-layer" disabled>Restablecer capa</button><button type="button" data-calibration-action="reset-all">Restablecer layout</button><button type="button" data-calibration-action="copy">Copiar JSON</button><button type="button" data-calibration-action="download">Descargar JSON</button></div>' +
      '<p class="setup-calibration-panel__status" data-calibration-status role="status" aria-live="polite"></p>';
    presetNode = panel.querySelector('[data-calibration-preset]');
    deskNode = panel.querySelector('[data-calibration-desk]');
    nameNode = panel.querySelector('[data-calibration-name]');
    xNode = panel.querySelector('[data-calibration-x]');
    yNode = panel.querySelector('[data-calibration-y]');
    resetLayerButton = panel.querySelector('[data-calibration-action="reset-layer"]');
    statusNode = panel.querySelector('[data-calibration-status]');
    panel.addEventListener('click', handlePanelClick);
    root.appendChild(panel);
  }
  function handlePointerDown(event) {
    if (event.target.closest('button, a, input, select, textarea')) return;
    if (!selectedLayer || !isVisibleLayer(selectedLayer) || event.button !== 0) return;
    const rect = sceneMedia.getBoundingClientRect(); if (rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault(); const point = selectedPosition();
    dragging = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: point.x, startY: point.y };
    sceneMedia.setPointerCapture(event.pointerId); sceneMedia.classList.add('is-calibration-dragging');
  }
  function handlePointerMove(event) {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const rect = sceneMedia.getBoundingClientRect();
    const delta = canvasDeltaFromClientDelta(event.clientX - dragging.startClientX, event.clientY - dragging.startClientY, rect.width, rect.height);
    updateSelectedPosition({ x: dragging.startX + delta.x, y: dragging.startY + delta.y });
  }
  function endPointer(event) {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    if (sceneMedia.hasPointerCapture(event.pointerId)) sceneMedia.releasePointerCapture(event.pointerId);
    dragging = null; sceneMedia.classList.remove('is-calibration-dragging');
  }
  function handleKeydown(event, productId = '') {
    if ((event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') && productId) {
      event.preventDefault(); return selectLayer(resolveLayerForProduct(productId));
    }
    if (!selectedLayer || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
    event.preventDefault(); const amount = event.shiftKey ? 10 : 1; const point = selectedPosition();
    if (event.key === 'ArrowLeft') point.x -= amount;
    if (event.key === 'ArrowRight') point.x += amount;
    if (event.key === 'ArrowUp') point.y -= amount;
    if (event.key === 'ArrowDown') point.y += amount;
    return updateSelectedPosition(point);
  }
  function syncVisibleLayers(keys) {
    visibleLayers = new Set(keys.filter((key) => CALIBRATABLE_SETUP_LAYERS.includes(key)));
    if (selectedLayer && !visibleLayers.has(selectedLayer)) selectedLayer = '';
    applyAllTransforms(); renderSelection();
  }
  function handleRailSelection(productId) { return selectLayer(resolveLayerForProduct(productId)); }

  buildPanel(); applyAllTransforms(); renderSelection();
  sceneMedia.addEventListener('pointerdown', handlePointerDown);
  sceneMedia.addEventListener('pointermove', handlePointerMove);
  sceneMedia.addEventListener('pointerup', endPointer);
  sceneMedia.addEventListener('pointercancel', endPointer);

  return {
    setPreset,
    setDeskType,
    syncVisibleLayers,
    handleRailSelection,
    handleKeydown,
    getSelectedLayer: () => selectedLayer,
    getPreset: () => currentPreset,
    getDeskType: () => currentDeskType,
    exportJson
  };
}
