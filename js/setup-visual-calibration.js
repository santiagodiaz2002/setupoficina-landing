// GUÍA EDUCATIVA: utilidades y controlador del modo opcional de calibración activado mediante el parámetro de consulta previsto.
// El compositor importa siempre este módulo, pero sólo crea el controlador cuando la URL habilita el modo temporal.
// Inicia la lista de símbolos que se obtienen del módulo indicado al cerrar esta declaración.
import {
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  CALIBRATABLE_SETUP_LAYERS,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  SETUP_CANVAS_SIZE,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  getSetupLayerLayout,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  normalizeSetupDeskType,
  // Incorpora este símbolo a la declaración multilineal que lo contiene.
  normalizeSetupPreset
// Cierra la lista de importación e identifica el archivo que provee esos símbolos.
} from './setup-visual-config.js?v=layout-by-desk-2';

// Declara y exporta la constante SETUP_CALIBRATION_STORAGE_KEY; otros módulos leen su valor sin reasignar esta referencia.
export const SETUP_CALIBRATION_STORAGE_KEY = 'primoffice_setup_calibration_v3';
// Declara referencias estables para DESK_TYPES; la inicialización aporta los datos que consumirá el bloque siguiente.
const DESK_TYPES = Object.freeze(['standard', 'standing']);
// Declara referencias estables para EMPTY_POINT; la inicialización aporta los datos que consumirá el bloque siguiente.
const EMPTY_POINT = Object.freeze({ x: 0, y: 0 });

// Declara la función finiteNumber; recibe value, fallback = 0 y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function finiteNumber(value, fallback = 0) {
  // Declara referencias estables para number; la inicialización aporta los datos que consumirá el bloque siguiente.
  const number = Number(value);
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return Number.isFinite(number) ? number : fallback;
}

// Declara la función normalizedPoint; recibe value y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function normalizedPoint(value) {
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return { x: finiteNumber(value && value.x, 0), y: finiteNumber(value && value.y, 0) };
}

// Declara y exporta la función isSetupCalibrationEnabled; recibe search = '' y entrega el valor determinado por sus retornos.
export function isSetupCalibrationEnabled(search = '') {
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return new URLSearchParams(String(search || '')).get('calibrate') === '1';
}

// Declara y exporta la función createZeroCalibrationOffsets; recibe ningún argumento y entrega el valor determinado por sus retornos.
export function createZeroCalibrationOffsets() {
  // Acumula todos los elementos en el resultado único que devuelve la función reductora.
  return CALIBRATABLE_SETUP_LAYERS.reduce((result, key) => {
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    result[key] = { x: 0, y: 0 };
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return result;
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  }, {});
}

// Declara y exporta la función createZeroCalibrationByDesk; recibe ningún argumento y entrega el valor determinado por sus retornos.
export function createZeroCalibrationByDesk() {
  // Acumula todos los elementos en el resultado único que devuelve la función reductora.
  return DESK_TYPES.reduce((result, deskType) => {
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    result[deskType] = createZeroCalibrationOffsets();
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return result;
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  }, {});
}

// Declara y exporta la función sanitizeCalibrationPayload; recibe value y entrega el valor determinado por sus retornos.
export function sanitizeCalibrationPayload(value) {
  // Declara referencias estables para source; la inicialización aporta los datos que consumirá el bloque siguiente.
  const source = value && typeof value === 'object' ? value : {};
  // Declara referencias estables para sourceLayers; la inicialización aporta los datos que consumirá el bloque siguiente.
  const sourceLayers = source.layers && typeof source.layers === 'object' ? source.layers : {};
  // Declara referencias estables para offsets; la inicialización aporta los datos que consumirá el bloque siguiente.
  const offsets = createZeroCalibrationOffsets();
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  CALIBRATABLE_SETUP_LAYERS.forEach((key) => { offsets[key] = normalizedPoint(sourceLayers[key]); });
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return offsets;
}

// Declara y exporta la función sanitizeCalibrationStorage; recibe value y entrega el valor determinado por sus retornos.
export function sanitizeCalibrationStorage(value) {
  // Declara referencias estables para source; la inicialización aporta los datos que consumirá el bloque siguiente.
  const source = value && typeof value === 'object' ? value : {};
  // Declara referencias estables para sourceDesks; la inicialización aporta los datos que consumirá el bloque siguiente.
  const sourceDesks = source.desks && typeof source.desks === 'object' ? source.desks : {};
  // Declara referencias estables para result; la inicialización aporta los datos que consumirá el bloque siguiente.
  const result = createZeroCalibrationByDesk();
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  DESK_TYPES.forEach((deskType) => {
    // Declara referencias estables para deskValue; la inicialización aporta los datos que consumirá el bloque siguiente.
    const deskValue = sourceDesks[deskType];
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    result[deskType] = sanitizeCalibrationPayload(
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      deskValue && deskValue.layers ? deskValue : { layers: deskValue }
    );
  });
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return result;
}

// Declara y exporta la función resetCalibrationLayer; recibe offsets, key y entrega el valor determinado por sus retornos.
export function resetCalibrationLayer(offsets, key) {
  // Declara referencias estables para next; la inicialización aporta los datos que consumirá el bloque siguiente.
  const next = sanitizeCalibrationPayload({ layers: offsets });
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (CALIBRATABLE_SETUP_LAYERS.includes(key)) next[key] = { x: 0, y: 0 };
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return next;
}

// Declara y exporta la función resetAllCalibrationOffsets; recibe ningún argumento y entrega el valor determinado por sus retornos.
export function resetAllCalibrationOffsets() { return createZeroCalibrationOffsets(); }

// Declara y exporta la función canvasDeltaFromClientDelta; recibe deltaClientX, deltaClientY, visibleWidth, visibleHeight y entrega el valor determinado por sus retornos.
export function canvasDeltaFromClientDelta(deltaClientX, deltaClientY, visibleWidth, visibleHeight) {
  // Declara referencias estables para width; la inicialización aporta los datos que consumirá el bloque siguiente.
  const width = finiteNumber(visibleWidth, 0);
  // Declara referencias estables para height; la inicialización aporta los datos que consumirá el bloque siguiente.
  const height = finiteNumber(visibleHeight, 0);
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (width <= 0 || height <= 0) return { ...EMPTY_POINT };
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    x: finiteNumber(deltaClientX, 0) * SETUP_CANVAS_SIZE.width / width,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    y: finiteNumber(deltaClientY, 0) * SETUP_CANVAS_SIZE.height / height
  };
}

// Declara y exporta la función resolveLayerPosition; recibe key, offsets, deskType = 'standard' y entrega el valor determinado por sus retornos.
export function resolveLayerPosition(key, offsets, deskType = 'standard') {
  // Declara referencias estables para base; la inicialización aporta los datos que consumirá el bloque siguiente.
  const base = normalizedPoint(getSetupLayerLayout(deskType)[key]);
  // Declara referencias estables para offset; la inicialización aporta los datos que consumirá el bloque siguiente.
  const offset = normalizedPoint(offsets && offsets[key]);
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return { x: base.x + offset.x, y: base.y + offset.y };
}

// Declara y exporta la función logicalPointToTransform; recibe point y entrega el valor determinado por sus retornos.
export function logicalPointToTransform(point) {
  // Declara referencias estables para normalized; la inicialización aporta los datos que consumirá el bloque siguiente.
  const normalized = normalizedPoint(point);
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return `translate(${normalized.x * 100 / SETUP_CANVAS_SIZE.width}%, ${normalized.y * 100 / SETUP_CANVAS_SIZE.height}%)`;
}

// Declara y exporta la función buildCalibrationExport; recibe offsets, deskType = 'standard', preset = '' y entrega el valor determinado por sus retornos.
export function buildCalibrationExport(offsets, deskType = 'standard', preset = '') {
  // Declara referencias estables para normalizedDeskType; la inicialización aporta los datos que consumirá el bloque siguiente.
  const normalizedDeskType = normalizeSetupDeskType(deskType);
  // Declara referencias estables para clean; la inicialización aporta los datos que consumirá el bloque siguiente.
  const clean = sanitizeCalibrationPayload({ layers: offsets });
  // Declara referencias estables para layers; la inicialización aporta los datos que consumirá el bloque siguiente.
  const layers = {};
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  CALIBRATABLE_SETUP_LAYERS.forEach((key) => {
    // Declara referencias estables para position; la inicialización aporta los datos que consumirá el bloque siguiente.
    const position = resolveLayerPosition(key, clean, normalizedDeskType);
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    layers[key] = { x: position.x, y: position.y };
  });
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    deskType: normalizedDeskType,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    preset: normalizeSetupPreset(preset),
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    canvas: { width: SETUP_CANVAS_SIZE.width, height: SETUP_CANVAS_SIZE.height },
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    layers
  };
}

// Declara y exporta la función buildCalibrationStoragePayload; recibe offsetsByDesk y entrega el valor determinado por sus retornos.
export function buildCalibrationStoragePayload(offsetsByDesk) {
  // Declara referencias estables para clean; la inicialización aporta los datos que consumirá el bloque siguiente.
  const clean = sanitizeCalibrationStorage({ desks: offsetsByDesk });
  // Declara referencias estables para desks; la inicialización aporta los datos que consumirá el bloque siguiente.
  const desks = {};
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  DESK_TYPES.forEach((deskType) => {
    // Declara referencias estables para layers; la inicialización aporta los datos que consumirá el bloque siguiente.
    const layers = {};
    // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
    CALIBRATABLE_SETUP_LAYERS.forEach((key) => {
      // Declara referencias estables para point; la inicialización aporta los datos que consumirá el bloque siguiente.
      const point = clean[deskType][key];
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (point.x !== 0 || point.y !== 0) layers[key] = { x: point.x, y: point.y };
    });
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (Object.keys(layers).length) desks[deskType] = { layers };
  });
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return {
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    canvas: { width: SETUP_CANVAS_SIZE.width, height: SETUP_CANVAS_SIZE.height },
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    desks
  };
}

// Declara la función readStoredOffsets; recibe storage y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function readStoredOffsets(storage) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!storage) return createZeroCalibrationByDesk();
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try {
    // Declara referencias estables para raw; la inicialización aporta los datos que consumirá el bloque siguiente.
    const raw = storage.getItem(SETUP_CALIBRATION_STORAGE_KEY);
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return raw ? sanitizeCalibrationStorage(JSON.parse(raw)) : createZeroCalibrationByDesk();
  // Captura el error de la operación protegida y ejecuta la recuperación definida.
  } catch (error) { return createZeroCalibrationByDesk(); }
}

// Declara la función persistOffsets; recibe storage, offsetsByDesk y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function persistOffsets(storage, offsetsByDesk) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!storage) return;
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try { storage.setItem(SETUP_CALIBRATION_STORAGE_KEY, JSON.stringify(buildCalibrationStoragePayload(offsetsByDesk))); } catch (error) {}
}

// Declara la función copyTextWithTextarea; recibe text y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function copyTextWithTextarea(text) {
  // Declara referencias estables para textarea; la inicialización aporta los datos que consumirá el bloque siguiente.
  const textarea = document.createElement('textarea');
  // Actualiza el estado con el valor calculado a la derecha de la asignación.
  textarea.value = text;
  // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
  textarea.setAttribute('readonly', '');
  // Actualiza el estado con el valor calculado a la derecha de la asignación.
  textarea.style.position = 'fixed';
  // Actualiza el estado con el valor calculado a la derecha de la asignación.
  textarea.style.opacity = '0';
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  document.body.appendChild(textarea);
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  textarea.select();
  // Declara referencias estables para copied; la inicialización aporta los datos que consumirá el bloque siguiente.
  const copied = document.execCommand('copy');
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  textarea.remove();
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return copied ? Promise.resolve() : Promise.reject(new Error('Clipboard unavailable'));
}
// Declara la función copyText; recibe text y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function copyText(text) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return navigator.clipboard.writeText(text).catch(() => copyTextWithTextarea(text));
  }
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return copyTextWithTextarea(text);
}
// Declara la función downloadText; recibe filename, text y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function downloadText(filename, text) {
  // Declara referencias estables para blob; la inicialización aporta los datos que consumirá el bloque siguiente.
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  // Declara referencias estables para url; la inicialización aporta los datos que consumirá el bloque siguiente.
  const url = URL.createObjectURL(blob);
  // Declara referencias estables para anchor; la inicialización aporta los datos que consumirá el bloque siguiente.
  const anchor = document.createElement('a');
  // Actualiza el estado con el valor calculado a la derecha de la asignación.
  anchor.href = url; anchor.download = filename; anchor.hidden = true;
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Declara y exporta la función createSetupCalibrationController; recibe options y entrega el valor determinado por sus retornos.
export function createSetupCalibrationController(options) {
  // Declara referencias estables para root; la inicialización aporta los datos que consumirá el bloque siguiente.
  const root = options.root;
  // Declara referencias estables para sceneMedia; la inicialización aporta los datos que consumirá el bloque siguiente.
  const sceneMedia = options.sceneMedia;
  // Declara referencias estables para layerElements; la inicialización aporta los datos que consumirá el bloque siguiente.
  const layerElements = options.layerElements;
  // Declara referencias estables para resolveLayerForProduct; la inicialización aporta los datos que consumirá el bloque siguiente.
  const resolveLayerForProduct = options.resolveLayerForProduct;
  // Declara referencias estables para storage; la inicialización aporta los datos que consumirá el bloque siguiente.
  const storage = options.storage || null;
  // Declara estado mutable para currentPreset; la inicialización aporta los datos que consumirá el bloque siguiente.
  let currentPreset = 'pro';
  // Declara estado mutable para currentDeskType; la inicialización aporta los datos que consumirá el bloque siguiente.
  let currentDeskType = 'standard';
  // Declara estado mutable para visibleLayers; la inicialización aporta los datos que consumirá el bloque siguiente.
  let visibleLayers = new Set();
  // Declara estado mutable para offsetsByDesk; la inicialización aporta los datos que consumirá el bloque siguiente.
  let offsetsByDesk = readStoredOffsets(storage);
  // Declara estado mutable para selectedLayer; la inicialización aporta los datos que consumirá el bloque siguiente.
  let selectedLayer = '';
  // Declara estado mutable para dragging; la inicialización aporta los datos que consumirá el bloque siguiente.
  let dragging = null;
  // Declara estado mutable para panel, nameNode, presetNode, deskNode, xNode, yNode, resetLayerButton, statusNode; la inicialización aporta los datos que consumirá el bloque siguiente.
  let panel = null, nameNode = null, presetNode = null, deskNode = null, xNode = null, yNode = null, resetLayerButton = null, statusNode = null;

  // Declara la función currentOffsets; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function currentOffsets() { return offsetsByDesk[currentDeskType]; }
  // Declara la función isVisibleLayer; recibe key y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function isVisibleLayer(key) { return CALIBRATABLE_SETUP_LAYERS.includes(key) && visibleLayers.has(key); }
  // Declara la función selectedPosition; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function selectedPosition() { return selectedLayer ? resolveLayerPosition(selectedLayer, currentOffsets(), currentDeskType) : EMPTY_POINT; }
  // Declara la función applyLayerTransform; recibe key y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function applyLayerTransform(key) {
    // Declara referencias estables para element; la inicialización aporta los datos que consumirá el bloque siguiente.
    const element = layerElements[key];
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (element) element.style.transform = logicalPointToTransform(resolveLayerPosition(key, currentOffsets(), currentDeskType));
  }
  // Declara la función applyAllTransforms; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function applyAllTransforms() { CALIBRATABLE_SETUP_LAYERS.forEach(applyLayerTransform); }
  // Declara la función renderSelection; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function renderSelection() {
    // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
    CALIBRATABLE_SETUP_LAYERS.forEach((key) => {
      // Declara referencias estables para element; la inicialización aporta los datos que consumirá el bloque siguiente.
      const element = layerElements[key];
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (element) element.classList.toggle('is-calibration-selected', key === selectedLayer);
    });
    // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
    root.classList.toggle('has-calibration-selection', !!selectedLayer);
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    root.dataset.calibrationLayer = selectedLayer;
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    root.dataset.calibrationPreset = currentPreset;
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    root.dataset.calibrationDeskType = currentDeskType;
    // Declara referencias estables para point; la inicialización aporta los datos que consumirá el bloque siguiente.
    const point = selectedPosition();
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (presetNode) presetNode.textContent = currentPreset;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (deskNode) deskNode.textContent = currentDeskType;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (nameNode) nameNode.textContent = selectedLayer || 'Ninguna capa seleccionada';
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (xNode) xNode.textContent = selectedLayer ? String(point.x) : '—';
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (yNode) yNode.textContent = selectedLayer ? String(point.y) : '—';
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (resetLayerButton) resetLayerButton.disabled = !selectedLayer;
  }
  // Declara la función setStatus; recibe message, kind = '' y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setStatus(message, kind = '') { if (statusNode) { statusNode.textContent = message; statusNode.dataset.kind = kind; } }
  // Declara la función saveAndRender; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function saveAndRender() { persistOffsets(storage, offsetsByDesk); applyAllTransforms(); renderSelection(); }
  // Declara la función setPreset; recibe preset y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setPreset(preset) {
    // Declara referencias estables para next; la inicialización aporta los datos que consumirá el bloque siguiente.
    const next = normalizeSetupPreset(preset);
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (next === currentPreset) { renderSelection(); return; }
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    currentPreset = next;
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    renderSelection();
  }
  // Declara la función setDeskType; recibe deskType y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function setDeskType(deskType) {
    // Declara referencias estables para next; la inicialización aporta los datos que consumirá el bloque siguiente.
    const next = normalizeSetupDeskType(deskType);
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (next === currentDeskType) { applyAllTransforms(); return; }
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    currentDeskType = next;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (selectedLayer && !isVisibleLayer(selectedLayer)) selectedLayer = '';
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    applyAllTransforms();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    renderSelection();
  }
  // Declara la función selectLayer; recibe key y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function selectLayer(key) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!isVisibleLayer(key)) return false;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    selectedLayer = key;
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    renderSelection();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    setStatus(`Capa ${key} seleccionada en el layout ${currentDeskType}.`, 'selection');
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return true;
  }
  // Declara la función updateSelectedPosition; recibe nextPoint y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function updateSelectedPosition(nextPoint) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!selectedLayer || !isVisibleLayer(selectedLayer)) return false;
    // Declara referencias estables para base; la inicialización aporta los datos que consumirá el bloque siguiente.
    const base = normalizedPoint(getSetupLayerLayout(currentDeskType)[selectedLayer]);
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    currentOffsets()[selectedLayer] = {
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      x: Math.round(finiteNumber(nextPoint.x, base.x) - base.x),
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      y: Math.round(finiteNumber(nextPoint.y, base.y) - base.y)
    };
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    saveAndRender(); return true;
  }
  // Declara la función resetSelectedLayer; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function resetSelectedLayer() {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!selectedLayer) return false;
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    offsetsByDesk[currentDeskType] = resetCalibrationLayer(currentOffsets(), selectedLayer);
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    saveAndRender();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    setStatus(`Capa ${selectedLayer} restablecida para el layout ${currentDeskType}.`, 'reset');
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return true;
  }
  // Declara la función resetAllLayers; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function resetAllLayers() {
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    offsetsByDesk[currentDeskType] = resetAllCalibrationOffsets();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    saveAndRender();
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    setStatus(`Todas las capas del layout ${currentDeskType} fueron restablecidas.`, 'reset');
  }
  // Declara la función exportJson; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function exportJson() { return JSON.stringify(buildCalibrationExport(currentOffsets(), currentDeskType, currentPreset), null, 2); }
  // Declara la función handlePanelClick; recibe event y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handlePanelClick(event) {
    // Declara referencias estables para action; la inicialización aporta los datos que consumirá el bloque siguiente.
    const action = event.target.closest('[data-calibration-action]');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!action || !panel.contains(action)) return;
    // Declara referencias estables para name; la inicialización aporta los datos que consumirá el bloque siguiente.
    const name = action.getAttribute('data-calibration-action');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (name === 'reset-layer') resetSelectedLayer();
    // Prueba una condición alternativa sólo cuando las ramas anteriores no se cumplieron.
    else if (name === 'reset-all') resetAllLayers();
    // Prueba una condición alternativa sólo cuando las ramas anteriores no se cumplieron.
    else if (name === 'copy') copyText(exportJson()).then(() => setStatus('JSON copiado.', 'success')).catch(() => setStatus('No se pudo copiar.', 'error'));
    // Prueba una condición alternativa sólo cuando las ramas anteriores no se cumplieron.
    else if (name === 'download') {
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      downloadText(`setup-layer-layout-${currentDeskType}.json`, exportJson());
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      setStatus(`JSON del layout ${currentDeskType} generado.`, 'success');
    }
  }
  // Declara la función buildPanel; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function buildPanel() {
    // Crea estructura DOM en memoria para configurarla antes de insertarla en la página.
    panel = document.createElement('section');
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    panel.className = 'setup-calibration-panel';
    // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
    panel.setAttribute('aria-labelledby', 'setupCalibrationTitle');
    // Actualiza el contenido visible con datos derivados del estado actual.
    panel.innerHTML =
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<div class="setup-calibration-panel__header"><div><span class="setup-calibration-panel__eyebrow">Modo temporal</span><h5 id="setupCalibrationTitle">Calibración de capas</h5></div><span class="setup-calibration-panel__canvas">Lienzo 1254 × 1254</span></div>' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<div class="setup-calibration-panel__readout" aria-live="polite"><div><span>Preset visible</span><strong data-calibration-preset>pro</strong></div><div><span>Layout</span><strong data-calibration-desk>standard</strong></div><div><span>Capa</span><strong data-calibration-name>Ninguna capa seleccionada</strong></div><div><span>X</span><strong data-calibration-x>—</strong></div><div><span>Y</span><strong data-calibration-y>—</strong></div></div>' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<p class="setup-calibration-panel__help">Las posiciones se comparten por tipo de escritorio. Starter, Pro y Epic no guardan coordenadas separadas.</p>' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<div class="setup-calibration-panel__actions"><button type="button" data-calibration-action="reset-layer" disabled>Restablecer capa</button><button type="button" data-calibration-action="reset-all">Restablecer layout</button><button type="button" data-calibration-action="copy">Copiar JSON</button><button type="button" data-calibration-action="download">Descargar JSON</button></div>' +
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      '<p class="setup-calibration-panel__status" data-calibration-status role="status" aria-live="polite"></p>';
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    presetNode = panel.querySelector('[data-calibration-preset]');
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    deskNode = panel.querySelector('[data-calibration-desk]');
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    nameNode = panel.querySelector('[data-calibration-name]');
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    xNode = panel.querySelector('[data-calibration-x]');
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    yNode = panel.querySelector('[data-calibration-y]');
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    resetLayerButton = panel.querySelector('[data-calibration-action="reset-layer"]');
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    statusNode = panel.querySelector('[data-calibration-status]');
    // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
    panel.addEventListener('click', handlePanelClick);
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    root.appendChild(panel);
  }
  // Declara la función handlePointerDown; recibe event y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handlePointerDown(event) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (event.target.closest('button, a, input, select, textarea')) return;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!selectedLayer || !isVisibleLayer(selectedLayer) || event.button !== 0) return;
    // Declara referencias estables para rect; la inicialización aporta los datos que consumirá el bloque siguiente.
    const rect = sceneMedia.getBoundingClientRect(); if (rect.width <= 0 || rect.height <= 0) return;
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    event.preventDefault(); const point = selectedPosition();
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    dragging = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: point.x, startY: point.y };
    // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
    sceneMedia.setPointerCapture(event.pointerId); sceneMedia.classList.add('is-calibration-dragging');
  }
  // Declara la función handlePointerMove; recibe event y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handlePointerMove(event) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    // Declara referencias estables para rect; la inicialización aporta los datos que consumirá el bloque siguiente.
    const rect = sceneMedia.getBoundingClientRect();
    // Declara referencias estables para delta; la inicialización aporta los datos que consumirá el bloque siguiente.
    const delta = canvasDeltaFromClientDelta(event.clientX - dragging.startClientX, event.clientY - dragging.startClientY, rect.width, rect.height);
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    updateSelectedPosition({ x: dragging.startX + delta.x, y: dragging.startY + delta.y });
  }
  // Declara la función endPointer; recibe event y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function endPointer(event) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (sceneMedia.hasPointerCapture(event.pointerId)) sceneMedia.releasePointerCapture(event.pointerId);
    // Actualiza clases CSS para que la presentación refleje el estado lógico calculado.
    dragging = null; sceneMedia.classList.remove('is-calibration-dragging');
  }
  // Declara la función handleKeydown; recibe event, productId = '' y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handleKeydown(event, productId = '') {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if ((event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') && productId) {
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      event.preventDefault(); return selectLayer(resolveLayerForProduct(productId));
    }
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!selectedLayer || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    event.preventDefault(); const amount = event.shiftKey ? 10 : 1; const point = selectedPosition();
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (event.key === 'ArrowLeft') point.x -= amount;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (event.key === 'ArrowRight') point.x += amount;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (event.key === 'ArrowUp') point.y -= amount;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (event.key === 'ArrowDown') point.y += amount;
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return updateSelectedPosition(point);
  }
  // Declara la función syncVisibleLayers; recibe keys y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function syncVisibleLayers(keys) {
    // Conserva únicamente los elementos que satisfacen el predicado proporcionado.
    visibleLayers = new Set(keys.filter((key) => CALIBRATABLE_SETUP_LAYERS.includes(key)));
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (selectedLayer && !visibleLayers.has(selectedLayer)) selectedLayer = '';
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    applyAllTransforms(); renderSelection();
  }
  // Declara la función handleRailSelection; recibe productId y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
  function handleRailSelection(productId) { return selectLayer(resolveLayerForProduct(productId)); }

  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  buildPanel(); applyAllTransforms(); renderSelection();
  // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
  sceneMedia.addEventListener('pointerdown', handlePointerDown);
  // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
  sceneMedia.addEventListener('pointermove', handlePointerMove);
  // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
  sceneMedia.addEventListener('pointerup', endPointer);
  // Registra un manejador para la interacción indicada; el callback recibe el evento y actualiza el estado asociado.
  sceneMedia.addEventListener('pointercancel', endPointer);

  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return {
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    setPreset,
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    setDeskType,
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    syncVisibleLayers,
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    handleRailSelection,
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    handleKeydown,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    getSelectedLayer: () => selectedLayer,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    getPreset: () => currentPreset,
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    getDeskType: () => currentDeskType,
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    exportJson
  };
}
