const RUNTIME_ROOT = './assets/setup-layers/runtime/';

export const SETUP_CANVAS_SIZE = Object.freeze({ width: 1254, height: 1254 });

function freezeLayout(layout) {
  return Object.freeze(Object.fromEntries(
    Object.entries(layout).map(([key, point]) => [key, Object.freeze({ x: point.x, y: point.y })])
  ));
}

/*
 * Las coordenadas dependen exclusivamente del tipo de escritorio visible.
 * Starter/Pro/Epic sólo determinan productos; nunca desplazan las capas.
 */
const STANDARD_DESK_LAYOUT = freezeLayout({
  standardDesk: { x: 132, y: 181 },
  standingDesk: { x: 0, y: 0 },
  pBox: { x: 31, y: 50 },
  pMat: { x: 1144, y: 414 },
  pGlow: { x: 86, y: 48 },
  pArm: { x: 84, y: 65 },
  pNotebook: { x: 151, y: -292 },
  pMechanic: { x: 37, y: -283 },
  pHub: { x: 51, y: 135 },
  pMouseProV: { x: 89, y: 50 }
});

const STANDING_DESK_LAYOUT = freezeLayout({
  standardDesk: { x: -18, y: 61 },
  standingDesk: { x: 103, y: 79 },
  pBox: { x: 31, y: 50 },
  pMat: { x: 1144, y: 414 },
  pGlow: { x: 58, y: 9 },
  pArm: { x: 56, y: 23 },
  pNotebook: { x: 172, y: -279 },
  pMechanic: { x: 18, y: -265 },
  pHub: { x: 97, y: 71 },
  pMouseProV: { x: 85, y: 61 }
});

export const SETUP_LAYER_LAYOUT_BY_DESK = Object.freeze({
  standard: STANDARD_DESK_LAYOUT,
  standing: STANDING_DESK_LAYOUT
});

/* Compatibilidad para consumidores anteriores. El runtime no decide por preset. */
export const SETUP_LAYER_LAYOUT_BY_PRESET = Object.freeze({
  starter: STANDARD_DESK_LAYOUT,
  pro: STANDARD_DESK_LAYOUT,
  epic: STANDING_DESK_LAYOUT
});

export const SETUP_LAYER_LAYOUT = SETUP_LAYER_LAYOUT_BY_DESK.standard;

export function normalizeSetupDeskType(value) {
  if (value && typeof value === 'object') {
    return value.standing_desk ? 'standing' : 'standard';
  }
  const deskType = String(value || '').toLowerCase();
  return deskType === 'standing' || deskType === 'standingdesk' ||
    deskType === 'standing_desk' || deskType === 'epic'
    ? 'standing'
    : 'standard';
}

export function getSetupLayerLayout(deskType = 'standard') {
  return SETUP_LAYER_LAYOUT_BY_DESK[normalizeSetupDeskType(deskType)];
}

export function normalizeSetupPreset(value) {
  const preset = String(value || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(SETUP_LAYER_LAYOUT_BY_PRESET, preset) ? preset : 'pro';
}

export const CALIBRATABLE_SETUP_LAYERS = Object.freeze([
  'standardDesk', 'standingDesk', 'pBox', 'pMat', 'pGlow',
  'pArm', 'pNotebook', 'pMechanic', 'pHub', 'pMouseProV'
]);

export const SETUP_LAYER_MANIFEST = Object.freeze({
  base: Object.freeze({ src: `${RUNTIME_ROOT}00_BASE_ESTATICA.png`, width: 1254, height: 1254 }),
  pArm: Object.freeze({ src: `${RUNTIME_ROOT}01_PARM.png`, width: 1254, height: 1254 }),
  pNotebook: Object.freeze({ src: `${RUNTIME_ROOT}02_PNOTEBOOK.png`, width: 1254, height: 1254 }),
  pMechanic: Object.freeze({ src: `${RUNTIME_ROOT}03_PMECHANIC.png`, width: 1254, height: 1254 }),
  pGlow: Object.freeze({ src: `${RUNTIME_ROOT}04_PGLOW.png`, width: 1254, height: 1254 }),
  pMat: Object.freeze({ src: `${RUNTIME_ROOT}05_PMAT.png`, width: 1254, height: 1254 }),
  pHub: Object.freeze({ src: `${RUNTIME_ROOT}06_PHUB.png`, width: 1254, height: 1254 }),
  pBox: Object.freeze({ src: `${RUNTIME_ROOT}07_PBOX.png`, width: 1254, height: 1254 }),
  pMouseProV: Object.freeze({ src: `${RUNTIME_ROOT}08_PMOUSEPROV.png`, width: 1254, height: 1254 }),
  standingDesk: Object.freeze({ src: `${RUNTIME_ROOT}09_STANDING_DESK.png`, width: 1254, height: 1254 }),
  standardDesk: Object.freeze({ src: `${RUNTIME_ROOT}09B_STANDARD_DESK.png`, width: 1024, height: 1024 })
});

export const COMMERCIAL_TO_VISUAL = Object.freeze({
  soporte_monitor: 'pArm', soporte_notebook: 'pNotebook', teclado_mec: 'pMechanic',
  luz_led: 'pGlow', mousepad_xxl: 'pMat', hub_usb: 'pHub',
  organizador_prem: 'pBox', mouse_vertical: 'pMouseProV', standing_desk: 'standingDesk'
});

export const VISUAL_PRODUCT_IDS = Object.freeze([
  'soporte_notebook', 'mouse_vertical', 'mousepad_xxl', 'soporte_monitor',
  'teclado_mec', 'hub_usb', 'organizador_prem', 'luz_led', 'standing_desk'
]);

export const SETUP_LAYER_ORDER = Object.freeze([
  'standardDesk', 'standingDesk', 'pBox', 'pMat', 'pGlow',
  'pArm', 'pNotebook', 'pMechanic', 'pHub', 'pMouseProV'
]);

export function deriveVisibleSetupLayers(selectedProducts = {}) {
  const selected = selectedProducts || {};
  const visible = new Set([selected.standing_desk ? 'standingDesk' : 'standardDesk']);
  Object.entries(COMMERCIAL_TO_VISUAL).forEach(([commercialId, visualKey]) => {
    if (commercialId !== 'standing_desk' && selected[commercialId]) visible.add(visualKey);
  });
  return SETUP_LAYER_ORDER.filter((key) => visible.has(key));
}
