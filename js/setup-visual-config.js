// GUÍA EDUCATIVA: fuente canónica del runtime visual para tamaños, posiciones, orden y mapeo entre productos comerciales y capas.
// El compositor y la herramienta de calibración importan estas exportaciones; el JSON de assets no se carga en el navegador.
// Declara referencias estables para RUNTIME_ROOT; la inicialización aporta los datos que consumirá el bloque siguiente.
const RUNTIME_ROOT = './assets/setup-layers/runtime/';

// Declara y exporta la constante SETUP_CANVAS_SIZE; otros módulos leen su valor sin reasignar esta referencia.
export const SETUP_CANVAS_SIZE = Object.freeze({ width: 1254, height: 1254 });

// Declara la función freezeLayout; recibe layout y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function freezeLayout(layout) {
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return Object.freeze(Object.fromEntries(
    // Transforma cada elemento y construye una colección nueva con los valores devueltos.
    Object.entries(layout).map(([key, point]) => [key, Object.freeze({ x: point.x, y: point.y })])
  ));
}

/*
 * Las coordenadas dependen exclusivamente del tipo de escritorio visible.
 * Starter/Pro/Epic sólo determinan productos; nunca desplazan las capas.
 */
// Declara referencias estables para STANDARD_DESK_LAYOUT; la inicialización aporta los datos que consumirá el bloque siguiente.
const STANDARD_DESK_LAYOUT = freezeLayout({
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  standardDesk: { x: 132, y: 181 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  standingDesk: { x: 0, y: 0 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pBox: { x: 31, y: 50 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pMat: { x: 77, y: 62},
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pGlow: { x: 72, y: 58 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pArm: { x: 67, y: 75 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pNotebook: { x: 151, y: -292 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pMechanic: { x: 37, y: -283 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pHub: { x: 51, y: 135 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pMouseProV: { x: 89, y: 50 }
});

// Declara referencias estables para STANDING_DESK_LAYOUT; la inicialización aporta los datos que consumirá el bloque siguiente.
const STANDING_DESK_LAYOUT = freezeLayout({
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  standardDesk: { x: -18, y: 61 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  standingDesk: { x: 103, y: 79 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pBox: { x: 31, y: 50 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pMat: { x: 70, y: 51 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pGlow: { x: 13, y: 32 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pArm: { x: 23, y: 50 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pNotebook: { x: 172, y: -279 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pMechanic: { x: 18, y: -265 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pHub: { x: 97, y: 71 },
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pMouseProV: { x: 85, y: 61 }
});

// Declara y exporta la constante SETUP_LAYER_LAYOUT_BY_DESK; otros módulos leen su valor sin reasignar esta referencia.
export const SETUP_LAYER_LAYOUT_BY_DESK = Object.freeze({
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  standard: STANDARD_DESK_LAYOUT,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  standing: STANDING_DESK_LAYOUT
});

/* Compatibilidad para consumidores anteriores. El runtime no decide por preset. */
// Declara y exporta la constante SETUP_LAYER_LAYOUT_BY_PRESET; otros módulos leen su valor sin reasignar esta referencia.
export const SETUP_LAYER_LAYOUT_BY_PRESET = Object.freeze({
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  starter: STANDARD_DESK_LAYOUT,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  pro: STANDARD_DESK_LAYOUT,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  epic: STANDING_DESK_LAYOUT
});

// Declara y exporta la constante SETUP_LAYER_LAYOUT; otros módulos leen su valor sin reasignar esta referencia.
export const SETUP_LAYER_LAYOUT = SETUP_LAYER_LAYOUT_BY_DESK.standard;

// Declara y exporta la función normalizeSetupDeskType; recibe value y entrega el valor determinado por sus retornos.
export function normalizeSetupDeskType(value) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (value && typeof value === 'object') {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return value.standing_desk ? 'standing' : 'standard';
  }
  // Declara referencias estables para deskType; la inicialización aporta los datos que consumirá el bloque siguiente.
  const deskType = String(value || '').toLowerCase();
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return deskType === 'standing' || deskType === 'standingdesk' ||
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    deskType === 'standing_desk' || deskType === 'epic'
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    ? 'standing'
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    : 'standard';
}

// Declara y exporta la función getSetupLayerLayout; recibe deskType = 'standard' y entrega el valor determinado por sus retornos.
export function getSetupLayerLayout(deskType = 'standard') {
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return SETUP_LAYER_LAYOUT_BY_DESK[normalizeSetupDeskType(deskType)];
}

// Declara y exporta la función normalizeSetupPreset; recibe value y entrega el valor determinado por sus retornos.
export function normalizeSetupPreset(value) {
  // Declara referencias estables para preset; la inicialización aporta los datos que consumirá el bloque siguiente.
  const preset = String(value || '').toLowerCase();
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return Object.prototype.hasOwnProperty.call(SETUP_LAYER_LAYOUT_BY_PRESET, preset) ? preset : 'pro';
}

// Declara y exporta la constante CALIBRATABLE_SETUP_LAYERS; otros módulos leen su valor sin reasignar esta referencia.
export const CALIBRATABLE_SETUP_LAYERS = Object.freeze([
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  'standardDesk', 'standingDesk', 'pBox', 'pMat', 'pGlow',
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  'pArm', 'pNotebook', 'pMechanic', 'pHub', 'pMouseProV'
]);

// Declara y exporta la constante SETUP_LAYER_MANIFEST; otros módulos leen su valor sin reasignar esta referencia.
export const SETUP_LAYER_MANIFEST = Object.freeze({
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  base: Object.freeze({ src: `${RUNTIME_ROOT}00_BASE_ESTATICA.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pArm: Object.freeze({ src: `${RUNTIME_ROOT}01_PARM.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pNotebook: Object.freeze({ src: `${RUNTIME_ROOT}02_PNOTEBOOK.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pMechanic: Object.freeze({ src: `${RUNTIME_ROOT}03_PMECHANIC.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pGlow: Object.freeze({ src: `${RUNTIME_ROOT}04_PGLOW.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pMat: Object.freeze({ src: `${RUNTIME_ROOT}05_PMAT.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pHub: Object.freeze({ src: `${RUNTIME_ROOT}06_PHUB.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pBox: Object.freeze({ src: `${RUNTIME_ROOT}07_PBOX.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  pMouseProV: Object.freeze({ src: `${RUNTIME_ROOT}08_PMOUSEPROV.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  standingDesk: Object.freeze({ src: `${RUNTIME_ROOT}09_STANDING_DESK.png`, width: 1254, height: 1254 }),
  // Usa utilidades de objetos para congelar, combinar o recorrer datos sin depender del prototipo del dominio.
  standardDesk: Object.freeze({ src: `${RUNTIME_ROOT}09B_STANDARD_DESK.png`, width: 1024, height: 1024 })
});

// Declara y exporta la constante COMMERCIAL_TO_VISUAL; otros módulos leen su valor sin reasignar esta referencia.
export const COMMERCIAL_TO_VISUAL = Object.freeze({
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  soporte_monitor: 'pArm', soporte_notebook: 'pNotebook', teclado_mec: 'pMechanic',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  luz_led: 'pGlow', mousepad_xxl: 'pMat', hub_usb: 'pHub',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  organizador_prem: 'pBox', mouse_vertical: 'pMouseProV', standing_desk: 'standingDesk'
});

// Declara y exporta la constante VISUAL_PRODUCT_IDS; otros módulos leen su valor sin reasignar esta referencia.
export const VISUAL_PRODUCT_IDS = Object.freeze([
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  'soporte_notebook', 'mouse_vertical', 'mousepad_xxl', 'soporte_monitor',
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  'teclado_mec', 'hub_usb', 'organizador_prem', 'luz_led', 'standing_desk'
]);

// Declara y exporta la constante SETUP_LAYER_ORDER; otros módulos leen su valor sin reasignar esta referencia.
export const SETUP_LAYER_ORDER = Object.freeze([
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  'standardDesk', 'standingDesk', 'pBox', 'pMat', 'pGlow',
  // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
  'pArm', 'pNotebook', 'pMechanic', 'pHub', 'pMouseProV'
]);

// Declara y exporta la función deriveVisibleSetupLayers; recibe selectedProducts = {} y entrega el valor determinado por sus retornos.
export function deriveVisibleSetupLayers(selectedProducts = {}) {
  // Declara referencias estables para selected; la inicialización aporta los datos que consumirá el bloque siguiente.
  const selected = selectedProducts || {};
  // Declara referencias estables para visible; la inicialización aporta los datos que consumirá el bloque siguiente.
  const visible = new Set([selected.standing_desk ? 'standingDesk' : 'standardDesk']);
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  Object.entries(COMMERCIAL_TO_VISUAL).forEach(([commercialId, visualKey]) => {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (commercialId !== 'standing_desk' && selected[commercialId]) visible.add(visualKey);
  });
  // Conserva únicamente los elementos que satisfacen el predicado proporcionado.
  return SETUP_LAYER_ORDER.filter((key) => visible.has(key));
}
