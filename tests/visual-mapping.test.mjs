import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

async function importVisualConfig() {
  const source = await readFile(path.join(root, 'js/setup-visual-config.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

async function importVisualCalibration() {
  const moduleUrl = pathToFileURL(path.join(root, 'js/setup-visual-calibration.js')).href;
  return import(`${moduleUrl}?test=${Date.now()}`);
}

function extractComboPresets(html) {
  const match = html.match(/var COMBO_PRESETS=(\{[\s\S]*?\});/);
  assert.ok(match, 'COMBO_PRESETS debe existir en index.html');
  return vm.runInNewContext(`(${match[1]})`);
}

async function hash(pathname) {
  const buffer = await readFile(pathname);
  return createHash('sha256').update(buffer).digest('hex');
}

test('el configurador 2D queda aislado del runtime visible sin borrar sus fuentes', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');

  assert.match(js, /deriveVisibleSetupLayers/);
  assert.doesNotMatch(html, /setupVisualHybrid|setup-visual-hybrid|assets\/setup-layers\/runtime\//);
  assert.doesNotMatch(html, /Vista fotográfica interactiva|Visualizá tu setup|data-scene-before/);
  assert.doesNotMatch(html, /js\/setup-3d\.js/);
});

test('el CTA de Tiendanube usa el celeste real del logo sin alterar WhatsApp', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /#tiendanube-cart-transfer-button\{background:#12ADE0;color:var\(--dark\)/);
  assert.match(html, /#tiendanube-cart-transfer-button:(?:hover|focus-visible|active|disabled)/);
  assert.match(html, /\.btn-cart--whatsapp\{background:#25D366;\}/);
});

test('el mapeo comercial usa los IDs reales y una sola capa por producto', async () => {
  const {
    COMMERCIAL_TO_VISUAL,
    SETUP_LAYER_MANIFEST
  } = await importVisualConfig();

  assert.deepEqual(
    { ...COMMERCIAL_TO_VISUAL },
    {
      soporte_monitor: 'pArm',
      soporte_notebook: 'pNotebook',
      teclado_mec: 'pMechanic',
      luz_led: 'pGlow',
      mousepad_xxl: 'pMat',
      hub_usb: 'pHub',
      organizador_prem: 'pBox',
      mouse_vertical: 'pMouseProV',
      standing_desk: 'standingDesk'
    }
  );
  assert.equal(COMMERCIAL_TO_VISUAL.soporte_notebook, 'pNotebook');
  assert.ok(SETUP_LAYER_MANIFEST.pNotebook);
  assert.equal(
    Object.values(COMMERCIAL_TO_VISUAL).filter((key) => key === 'pNotebook').length,
    1,
    'notebook y soporte deben representarse mediante una sola capa'
  );
});

test('Starter, Pro y Epic activan exactamente los productos canónicos', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const presets = extractComboPresets(html);

  assert.deepEqual(
    Array.from(presets.starter),
    ['soporte_notebook', 'mouse_vertical', 'mousepad_xxl']
  );
  assert.deepEqual(
    Array.from(presets.pro),
    [
      'soporte_notebook',
      'soporte_monitor',
      'teclado_mec',
      'mouse_vertical',
      'mousepad_xxl',
      'hub_usb',
      'organizador_prem',
      'luz_led'
    ]
  );
  assert.deepEqual(
    Array.from(presets.epic),
    [
      'standing_desk',
      'soporte_notebook',
      'soporte_monitor',
      'teclado_mec',
      'mouse_vertical',
      'mousepad_xxl',
      'hub_usb',
      'organizador_prem',
      'luz_led'
    ]
  );
  for (const products of Object.values(presets)) {
    assert.ok(!products.includes('reposamuñecas'));
    assert.ok(!products.includes('almohadilla'));
  }
});

test('las tarjetas comerciales muestran los mismos productos y totales que los presets', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, />117\.979</);
  assert.match(html, />348\.324</);
  assert.match(html, />792\.311</);

  const cards = html.match(/<div class="combo-card(?: [^"]*)?">[\s\S]*?<\/div>\s*<\/div>/g) || [];
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.doesNotMatch(card, /pEase|pLumbar/);
  }
});

test('la derivación visual mantiene exactamente un escritorio', async () => {
  const { deriveVisibleSetupLayers } = await importVisualConfig();
  const standard = deriveVisibleSetupLayers({});
  const standing = deriveVisibleSetupLayers({ standing_desk: true });

  assert.ok(standard.includes('standardDesk'));
  assert.ok(!standard.includes('standingDesk'));
  assert.ok(standing.includes('standingDesk'));
  assert.ok(!standing.includes('standardDesk'));
  assert.equal(
    standing.filter((key) => key === 'standingDesk' || key === 'standardDesk').length,
    1
  );
});

test('pArm y pGlow son independientes', async () => {
  const { deriveVisibleSetupLayers } = await importVisualConfig();

  assert.ok(deriveVisibleSetupLayers({ soporte_monitor: true }).includes('pArm'));
  assert.ok(!deriveVisibleSetupLayers({ soporte_monitor: true }).includes('pGlow'));
  assert.ok(deriveVisibleSetupLayers({ luz_led: true }).includes('pGlow'));
  assert.ok(!deriveVisibleSetupLayers({ luz_led: true }).includes('pArm'));
});

test('todas las rutas del manifiesto existen, son PNG válidos y las capas tienen alfa', async () => {
  const { SETUP_LAYER_MANIFEST } = await importVisualConfig();

  for (const [key, entry] of Object.entries(SETUP_LAYER_MANIFEST)) {
    const pathname = path.join(root, entry.src.replace(/^\.\//, ''));
    const info = await stat(pathname);
    const header = await readFile(pathname);
    assert.ok(info.isFile() && info.size > 1024, `${key} debe existir y no estar vacío`);
    assert.equal(header.toString('hex', 0, 8), '89504e470d0a1a0a', `${key} debe ser PNG`);
    assert.equal(header.readUInt32BE(16), entry.width, `${key} debe coincidir con el ancho declarado`);
    assert.equal(header.readUInt32BE(20), entry.height, `${key} debe coincidir con el alto declarado`);
    if (key !== 'base') {
      assert.ok([4, 6].includes(header[25]), `${key} debe conservar canal alfa`);
    }
  }
});

test('runtime elimina mapa y brújula sólo de capas; la base queda byte a byte intacta', async () => {
  const sourceBase = path.join(root, 'assets/setup-layers/source/00_BASE_ESTATICA.png');
  const runtimeBase = path.join(root, 'assets/setup-layers/runtime/00_BASE_ESTATICA.png');
  assert.equal(await hash(sourceBase), await hash(runtimeBase));

  const script = String.raw`
from pathlib import Path
from PIL import Image
import json
root = Path.cwd() / "assets" / "setup-layers"
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
rects = [tuple(region["pixel_bounds"]) for region in manifest["cleared_regions"].values()]
for item in manifest["source_files"]:
    path = root / "runtime" / item["file"]
    if path.name == "00_BASE_ESTATICA.png" or path.name.startswith(("10_", "11_", "12_")):
        continue
    alpha = Image.open(path).convert("RGBA").getchannel("A")
    for rect in rects:
        if alpha.crop(rect).getextrema() != (0, 0):
            raise SystemExit(f"{path.name} conserva mapa/brújula")
base = Image.open(root / "runtime" / "00_BASE_ESTATICA.png").convert("RGB")
for rect in rects:
    if max(channel.getextrema()[1] - channel.getextrema()[0] for channel in base.crop(rect).split()) == 0:
        raise SystemExit("la base perdió mapa/brújula")
`;
  const python = process.platform === 'win32'
    ? { command: 'py', args: ['-3'] }
    : { command: 'python3', args: [] };
  const result = spawnSync(python.command, [...python.args, '-c', script], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('el controlador registra un solo listener delegado por tipo de interacción', async () => {
  const js = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');
  assert.equal((js.match(/root\.addEventListener\('click'/g) || []).length, 1);
  assert.equal((js.match(/root\.addEventListener\('keydown'/g) || []).length, 1);
  assert.match(js, /function handleRootKeydown[\s\S]*event\.preventDefault\(\)/);
  assert.doesNotMatch(js, /addEventListener\('dblclick'/);
});

test('todas las referencias locales declaradas por el runtime existen', async () => {
  const files = [
    'index.html',
    'css/integracion-canonica.css',
    'css/pulido-visual.css',
    'css/comparacion-antes-despues.css',
    'css/setup-visual-hybrid.css',
    'js/pulido-visual.js',
    'js/comparacion-antes-despues.js',
    'js/config/app-config.js',
    'js/services/leads-service.js',
    'js/setup-visual-config.js',
    'js/setup-visual-hybrid.js'
  ];
  const references = new Set();

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/(?:\.\/)?assets\/[A-Za-z0-9_./-]+\.(?:png|webp|jpg|ico)/g)) {
      references.add(match[0].replace(/^\.\//, ''));
    }
  }

  assert.ok(references.size > 0);
  for (const reference of references) {
    const info = await stat(path.join(root, reference));
    assert.ok(info.isFile(), `${reference} debe existir`);
  }
});

test('el mensaje de WhatsApp conserva texto y totales sin glifos incompatibles', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const match = html.match(/window\.sendQuickWhatsApp=[\s\S]*?\/\/ ── SCROLL REVEAL/);
  assert.ok(match, 'debe existir el bloque activo de WhatsApp');
  assert.doesNotMatch(match[0], /[👋✅➕�]/u);
  assert.match(match[0], /Combo preparado/);
  assert.match(match[0], /Total estimado/);
});


test('la configuración declara únicamente las diez capas calibrables y excluye la base', async () => {
  const {
    CALIBRATABLE_SETUP_LAYERS,
    SETUP_CANVAS_SIZE,
    SETUP_LAYER_LAYOUT
  } = await importVisualConfig();

  assert.deepEqual(
    Array.from(CALIBRATABLE_SETUP_LAYERS),
    [
      'standardDesk',
      'standingDesk',
      'pBox',
      'pMat',
      'pGlow',
      'pArm',
      'pNotebook',
      'pMechanic',
      'pHub',
      'pMouseProV'
    ]
  );
  assert.equal(CALIBRATABLE_SETUP_LAYERS.length, 10);
  assert.ok(!CALIBRATABLE_SETUP_LAYERS.includes('base'));
  assert.deepEqual({ ...SETUP_CANVAS_SIZE }, { width: 1254, height: 1254 });
  assert.deepEqual(Object.keys(SETUP_LAYER_LAYOUT), Array.from(CALIBRATABLE_SETUP_LAYERS));
  assert.deepEqual({ ...SETUP_LAYER_LAYOUT.standardDesk }, { x: 132, y: 181 });
  assert.deepEqual({ ...SETUP_LAYER_LAYOUT.pNotebook }, { x: 151, y: -292 });
});

test('las posiciones dependen únicamente del tipo de escritorio', async () => {
  const {
    SETUP_LAYER_LAYOUT_BY_DESK,
    getSetupLayerLayout,
    normalizeSetupDeskType
  } = await importVisualConfig();

  assert.equal(normalizeSetupDeskType({ standing_desk: false }), 'standard');
  assert.equal(normalizeSetupDeskType({ standing_desk: true }), 'standing');
  assert.strictEqual(getSetupLayerLayout('standard'), SETUP_LAYER_LAYOUT_BY_DESK.standard);
  assert.strictEqual(getSetupLayerLayout('standing'), SETUP_LAYER_LAYOUT_BY_DESK.standing);
  assert.deepEqual({ ...getSetupLayerLayout({ standing_desk: false }).pNotebook }, { x: 151, y: -292 });
  assert.deepEqual({ ...getSetupLayerLayout({ standing_desk: true }).pNotebook }, { x: 172, y: -279 });
  assert.deepEqual({ ...getSetupLayerLayout('standard').pMechanic }, { x: 37, y: -283 });
  assert.deepEqual({ ...getSetupLayerLayout('standing').pMechanic }, { x: 18, y: -265 });
});

test('el compositor elige el layout por standing_desk y nunca por preset', async () => {
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');
  assert.match(hybridJs, /var deskType = selected\.standing_desk \? 'standing' : 'standard'/);
  assert.match(hybridJs, /getSetupLayerLayout\(deskType\)/);
  assert.match(hybridJs, /calibration\.setDeskType\(deskType\)/);
  assert.doesNotMatch(hybridJs, /getSetupLayerLayout\(presentedPreset\)/);
});

test('el modo calibración sólo se activa con calibrate=1', async () => {
  const { isSetupCalibrationEnabled } = await importVisualCalibration();

  assert.equal(isSetupCalibrationEnabled(''), false);
  assert.equal(isSetupCalibrationEnabled('?calibrate=0'), false);
  assert.equal(isSetupCalibrationEnabled('?foo=1&calibrate=true'), false);
  assert.equal(isSetupCalibrationEnabled('?calibrate=1'), true);
  assert.equal(isSetupCalibrationEnabled('?foo=1&calibrate=1&bar=2'), true);
});

test('la conversión de arrastre usa la escala lógica 1254 x 1254', async () => {
  const { canvasDeltaFromClientDelta } = await importVisualCalibration();

  assert.deepEqual(canvasDeltaFromClientDelta(10, 20, 627, 627), { x: 20, y: 40 });
  assert.deepEqual(canvasDeltaFromClientDelta(5, -10, 1254, 1254), { x: 5, y: -10 });
  assert.deepEqual(canvasDeltaFromClientDelta(8, 4, 0, 600), { x: 0, y: 0 });
});

test('el render proporcional no depende de píxeles de viewport', async () => {
  const { logicalPointToTransform } = await importVisualCalibration();
  const point = { x: 125.4, y: -62.7 };
  const expected = 'translate(10%, -5%)';
  const viewports = [
    [1440, 900],
    [1280, 720],
    [768, 1024],
    [390, 844]
  ];

  for (const viewport of viewports) {
    assert.deepEqual(viewport.length, 2);
    assert.equal(logicalPointToTransform(point), expected);
  }
});

test('la exportación incluye lienzo, diez capas y coordenadas numéricas', async () => {
  const {
    buildCalibrationExport,
    createZeroCalibrationOffsets
  } = await importVisualCalibration();
  const offsets = createZeroCalibrationOffsets();
  offsets.pNotebook = { x: 17, y: -9 };
  offsets.standardDesk = { x: 3, y: 4 };

  const exported = buildCalibrationExport(offsets);
  const serialized = JSON.stringify(exported, null, 2);
  const parsed = JSON.parse(serialized);

  assert.deepEqual(parsed.canvas, { width: 1254, height: 1254 });
  assert.equal(Object.keys(parsed.layers).length, 10);
  assert.equal(parsed.deskType, 'standard');
  assert.equal(parsed.preset, 'pro');
  assert.deepEqual(parsed.layers.pNotebook, { x: 168, y: -301 });
  for (const point of Object.values(parsed.layers)) {
    assert.equal(typeof point.x, 'number');
    assert.equal(typeof point.y, 'number');
  }
});

test('restablecer una capa y todas devuelve coordenadas cero', async () => {
  const {
    createZeroCalibrationOffsets,
    resetAllCalibrationOffsets,
    resetCalibrationLayer
  } = await importVisualCalibration();
  const offsets = createZeroCalibrationOffsets();
  offsets.pArm = { x: 50, y: -20 };
  offsets.pMat = { x: 7, y: 8 };

  const oneReset = resetCalibrationLayer(offsets, 'pArm');
  assert.deepEqual(oneReset.pArm, { x: 0, y: 0 });
  assert.deepEqual(oneReset.pMat, { x: 7, y: 8 });

  const allReset = resetAllCalibrationOffsets();
  assert.equal(Object.keys(allReset).length, 10);
  for (const point of Object.values(allReset)) {
    assert.deepEqual(point, { x: 0, y: 0 });
  }
});

test('localStorage de calibración sólo serializa canvas y desviaciones por capa', async () => {
  const {
    SETUP_CALIBRATION_STORAGE_KEY,
    buildCalibrationStoragePayload,
    createZeroCalibrationOffsets,
    sanitizeCalibrationPayload
  } = await importVisualCalibration();
  const offsets = {
    standard: createZeroCalibrationOffsets(),
    standing: createZeroCalibrationOffsets()
  };
  offsets.standard.pHub = { x: 11, y: 22 };
  const payload = buildCalibrationStoragePayload(offsets);
  const serialized = JSON.stringify(payload);

  assert.equal(SETUP_CALIBRATION_STORAGE_KEY, 'primoffice_setup_calibration_v3');
  assert.deepEqual(payload.canvas, { width: 1254, height: 1254 });
  assert.deepEqual(payload.desks, { standard: { layers: { pHub: { x: 11, y: 22 } } } });
  assert.doesNotMatch(serialized, /cartState|extrasState|lead|odoo|whatsapp|price/i);

  const sanitized = sanitizeCalibrationPayload({
    canvas: { width: 1, height: 1 },
    layers: { pHub: { x: '4', y: 5 }, base: { x: 99, y: 99 } },
    cartState: { standing_desk: true },
    lead: { email: 'test@example.com' }
  });
  assert.deepEqual(sanitized.pHub, { x: 4, y: 5 });
  assert.equal('base' in sanitized, false);
  assert.equal('cartState' in sanitized, false);
  assert.equal('lead' in sanitized, false);
});

test('la calibración está separada del carrito, leads, Odoo y WhatsApp', async () => {
  const calibrationJs = await readFile(path.join(root, 'js/setup-visual-calibration.js'), 'utf8');
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');

  assert.doesNotMatch(calibrationJs, /cartState|extrasState|submitLead|PATCH|Odoo|sendWhatsApp|window\.open|price/i);
  assert.match(hybridJs, /if \(calibration\) \{[\s\S]*calibration\.handleRailSelection\(id\);[\s\S]*return;[\s\S]*\}\s*toggleProduct\(id/);
  assert.match(hybridJs, /if \(isSetupCalibrationEnabled\(window\.location\.search\)\) \{[\s\S]*createSetupCalibrationController/);
});

test('los listeners de arrastre sólo se registran dentro del controlador temporal', async () => {
  const calibrationJs = await readFile(path.join(root, 'js/setup-visual-calibration.js'), 'utf8');
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');

  assert.equal((hybridJs.match(/addEventListener\('pointer/g) || []).length, 0);
  assert.equal((calibrationJs.match(/sceneMedia\.addEventListener\('pointer/g) || []).length, 4);
  assert.match(calibrationJs, /pointerdown/);
  assert.match(calibrationJs, /pointermove/);
  assert.match(calibrationJs, /pointerup/);
  assert.match(calibrationJs, /pointercancel/);
});

test('cambiar el preset en calibración sólo cambia la vista temporal', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');
  const bridgeMatch = html.match(/getPresetSelection:function\(name\)\{([\s\S]*?)\n  \},\n  setProductSelection/);
  const handlerMatch = hybridJs.match(/function handleCalibrationPresetClick\(event\) \{([\s\S]*?)\n  \}\n\n  function sync/);

  assert.ok(bridgeMatch, 'el puente debe exponer una lectura de preset sin mutaciones');
  assert.doesNotMatch(bridgeMatch[1], /cartState\s*=|extrasState\s*=|updateProductSelection|submitLead|PATCH/i);
  assert.match(bridgeMatch[1], /COMBO_PRESETS\[name\]/);
  assert.ok(handlerMatch, 'debe existir el interceptor temporal de presets');
  assert.match(handlerMatch[1], /event\.stopImmediatePropagation\(\)/);
  assert.match(handlerMatch[1], /bridge\.getPresetSelection\(name\)/);
  assert.doesNotMatch(handlerMatch[1], /setProductSelection|prepareComboPreset|submitLead|sendWhatsApp|window\.open/);
  assert.match(hybridJs, /presetGroup\.addEventListener\('click', handleCalibrationPresetClick, true\)/);
  assert.match(hybridJs, /calibration\.setDeskType\(deskType\)/);
});

test('calcular, exportar y resetear posiciones no muta una selección comercial', async () => {
  const {
    buildCalibrationExport,
    createZeroCalibrationOffsets,
    resetCalibrationLayer
  } = await importVisualCalibration();
  const commercialSelection = Object.freeze({
    soporte_notebook: true,
    standing_desk: false,
    luz_led: true
  });
  const snapshot = JSON.stringify(commercialSelection);
  const offsets = createZeroCalibrationOffsets();
  offsets.pNotebook = { x: 33, y: -14 };

  buildCalibrationExport(offsets);
  resetCalibrationLayer(offsets, 'pNotebook');

  assert.equal(JSON.stringify(commercialSelection), snapshot);
});
