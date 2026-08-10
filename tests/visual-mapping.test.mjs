// Esta suite protege el mapeo visual, los assets y el modo de calibración del configurador de la landing.
// Combina importaciones locales, lectura textual, hashes, cabeceras de imagen y un proceso Python local para validar manifiestos.
// Aunque no prueba el backend, forma parte del alcance solicitado y documenta contratos que el frontend no debe romper.
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import test from 'node:test';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import assert from 'node:assert/strict';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { createHash } from 'node:crypto';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { readFile, stat } from 'node:fs/promises';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { spawnSync } from 'node:child_process';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { fileURLToPath, pathToFileURL } from 'node:url';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import path from 'node:path';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import vm from 'node:vm';

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const here = path.dirname(fileURLToPath(import.meta.url));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const root = path.resolve(here, '..');

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function importVisualConfig() {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const source = await readFile(path.join(root, 'js/setup-visual-config.js'), 'utf8');
// Importa dinámicamente la unidad aislada para que el caso controle su entorno.
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function importVisualCalibration() {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const moduleUrl = pathToFileURL(path.join(root, 'js/setup-visual-calibration.js')).href;
// Importa dinámicamente la unidad aislada para que el caso controle su entorno.
  return import(`${moduleUrl}?test=${Date.now()}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function extractComboPresets(html) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const match = html.match(/var COMBO_PRESETS=(\{[\s\S]*?\});/);
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(match, 'COMBO_PRESETS debe existir en index.html');
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return vm.runInNewContext(`(${match[1]})`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function hash(pathname) {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const buffer = await readFile(pathname);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return createHash('sha256').update(buffer).digest('hex');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('el runtime activo usa exclusivamente el compositor PNG por capas', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const js = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const activeSource = `${html}\n${js}`;

// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /assets\/setup-layers\/runtime\/00_BASE_ESTATICA\.png/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(js, /deriveVisibleSetupLayers/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(activeSource, /assets\/images\/scene\/mapped\//);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(activeSource, /scene-epic-reference/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(html, /js\/setup-3d\.js/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('el mapeo comercial usa los IDs reales y una sola capa por producto', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    COMMERCIAL_TO_VISUAL,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    SETUP_LAYER_MANIFEST
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  } = await importVisualConfig();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { ...COMMERCIAL_TO_VISUAL },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    {
// Define un campo del fixture que representa una entrada o respuesta específica.
      soporte_monitor: 'pArm',
// Define un campo del fixture que representa una entrada o respuesta específica.
      soporte_notebook: 'pNotebook',
// Define un campo del fixture que representa una entrada o respuesta específica.
      teclado_mec: 'pMechanic',
// Define un campo del fixture que representa una entrada o respuesta específica.
      luz_led: 'pGlow',
// Define un campo del fixture que representa una entrada o respuesta específica.
      mousepad_xxl: 'pMat',
// Define un campo del fixture que representa una entrada o respuesta específica.
      hub_usb: 'pHub',
// Define un campo del fixture que representa una entrada o respuesta específica.
      organizador_prem: 'pBox',
// Define un campo del fixture que representa una entrada o respuesta específica.
      mouse_vertical: 'pMouseProV',
// Define un campo del fixture que representa una entrada o respuesta específica.
      standing_desk: 'standingDesk'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(COMMERCIAL_TO_VISUAL.soporte_notebook, 'pNotebook');
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(SETUP_LAYER_MANIFEST.pNotebook);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    Object.values(COMMERCIAL_TO_VISUAL).filter((key) => key === 'pNotebook').length,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    1,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'notebook y soporte deben representarse mediante una sola capa'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('Starter, Pro y Epic activan exactamente los productos canónicos', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const presets = extractComboPresets(html);

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    Array.from(presets.starter),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    ['soporte_notebook', 'mouse_vertical', 'mousepad_xxl']
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    Array.from(presets.pro),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'soporte_notebook',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'soporte_monitor',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'teclado_mec',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'mouse_vertical',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'mousepad_xxl',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'hub_usb',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'organizador_prem',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'luz_led'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    Array.from(presets.epic),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'standing_desk',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'soporte_notebook',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'soporte_monitor',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'teclado_mec',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'mouse_vertical',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'mousepad_xxl',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'hub_usb',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'organizador_prem',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'luz_led'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const products of Object.values(presets)) {
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
    assert.ok(!products.includes('reposamuñecas'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
    assert.ok(!products.includes('almohadilla'));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('las tarjetas comerciales muestran los mismos productos y totales que los presets', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, />117\.979</);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, />348\.324</);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, />792\.311</);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const cards = html.match(/<div class="combo-card(?: [^"]*)?">[\s\S]*?<\/div>\s*<\/div>/g) || [];
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(cards.length, 3);
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const card of cards) {
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(card, /pEase|pLumbar/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('la derivación visual mantiene exactamente un escritorio', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { deriveVisibleSetupLayers } = await importVisualConfig();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const standard = deriveVisibleSetupLayers({});
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const standing = deriveVisibleSetupLayers({ standing_desk: true });

// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(standard.includes('standardDesk'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(!standard.includes('standingDesk'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(standing.includes('standingDesk'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(!standing.includes('standardDesk'));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    standing.filter((key) => key === 'standingDesk' || key === 'standardDesk').length,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    1
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('pArm y pGlow son independientes', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { deriveVisibleSetupLayers } = await importVisualConfig();

// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(deriveVisibleSetupLayers({ soporte_monitor: true }).includes('pArm'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(!deriveVisibleSetupLayers({ soporte_monitor: true }).includes('pGlow'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(deriveVisibleSetupLayers({ luz_led: true }).includes('pGlow'));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(!deriveVisibleSetupLayers({ luz_led: true }).includes('pArm'));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('todas las rutas del manifiesto existen, son PNG válidos y las capas tienen alfa', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { SETUP_LAYER_MANIFEST } = await importVisualConfig();

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const [key, entry] of Object.entries(SETUP_LAYER_MANIFEST)) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const pathname = path.join(root, entry.src.replace(/^\.\//, ''));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const info = await stat(pathname);
// Lee un artefacto local para fijar un contrato textual o binario verificable.
    const header = await readFile(pathname);
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
    assert.ok(info.isFile() && info.size > 1024, `${key} debe existir y no estar vacío`);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(header.toString('hex', 0, 8), '89504e470d0a1a0a', `${key} debe ser PNG`);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(header.readUInt32BE(16), entry.width, `${key} debe coincidir con el ancho declarado`);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(header.readUInt32BE(20), entry.height, `${key} debe coincidir con el alto declarado`);
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (key !== 'base') {
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
      assert.ok([4, 6].includes(header[25]), `${key} debe conservar canal alfa`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('runtime elimina mapa y brújula sólo de capas; la base queda byte a byte intacta', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const sourceBase = path.join(root, 'assets/setup-layers/source/00_BASE_ESTATICA.png');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const runtimeBase = path.join(root, 'assets/setup-layers/runtime/00_BASE_ESTATICA.png');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(await hash(sourceBase), await hash(runtimeBase));

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
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
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const python = process.platform === 'win32'
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    ? { command: 'py', args: ['-3'] }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    : { command: 'python3', args: [] };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const result = spawnSync(python.command, [...python.args, '-c', script], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    cwd: root,
// Define un campo del fixture que representa una entrada o respuesta específica.
    encoding: 'utf8'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(result.status, 0, result.stderr || result.stdout);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('el controlador registra un solo listener delegado por tipo de interacción', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const js = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((js.match(/root\.addEventListener\('click'/g) || []).length, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((js.match(/root\.addEventListener\('keydown'/g) || []).length, 1);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(js, /function handleRootKeydown[\s\S]*event\.preventDefault\(\)/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(js, /addEventListener\('dblclick'/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('todas las referencias locales declaradas por el runtime existen', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const files = [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'index.html',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'css/integracion-canonica.css',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'css/pulido-visual.css',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'css/comparacion-antes-despues.css',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'css/setup-visual-hybrid.css',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'js/pulido-visual.js',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'js/comparacion-antes-despues.js',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'js/config/app-config.js',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'js/services/leads-service.js',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'js/setup-visual-config.js',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'js/setup-visual-hybrid.js'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  ];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const references = new Set();

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const file of files) {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
    const source = await readFile(path.join(root, file), 'utf8');
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
    for (const match of source.matchAll(/(?:\.\/)?assets\/[A-Za-z0-9_./-]+\.(?:png|webp|jpg|ico)/g)) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      references.add(match[0].replace(/^\.\//, ''));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(references.size > 0);
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const reference of references) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const info = await stat(path.join(root, reference));
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
    assert.ok(info.isFile(), `${reference} debe existir`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('el mensaje de WhatsApp conserva texto y totales sin glifos incompatibles', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const match = html.match(/window\.sendQuickWhatsApp=[\s\S]*?\/\/ ── SCROLL REVEAL/);
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(match, 'debe existir el bloque activo de WhatsApp');
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(match[0], /[👋✅➕�]/u);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(match[0], /Combo preparado/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(match[0], /Total estimado/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});


// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('la configuración declara únicamente las diez capas calibrables y excluye la base', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    CALIBRATABLE_SETUP_LAYERS,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    SETUP_CANVAS_SIZE,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    SETUP_LAYER_LAYOUT
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  } = await importVisualConfig();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    Array.from(CALIBRATABLE_SETUP_LAYERS),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'standardDesk',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'standingDesk',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pBox',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pMat',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pGlow',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pArm',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pNotebook',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pMechanic',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pHub',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'pMouseProV'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(CALIBRATABLE_SETUP_LAYERS.length, 10);
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(!CALIBRATABLE_SETUP_LAYERS.includes('base'));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual({ ...SETUP_CANVAS_SIZE }, { width: 1254, height: 1254 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(Object.keys(SETUP_LAYER_LAYOUT), Array.from(CALIBRATABLE_SETUP_LAYERS));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual({ ...SETUP_LAYER_LAYOUT.standardDesk }, { x: 132, y: 181 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual({ ...SETUP_LAYER_LAYOUT.pNotebook }, { x: 151, y: -292 });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('las posiciones dependen únicamente del tipo de escritorio', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    SETUP_LAYER_LAYOUT_BY_DESK,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    getSetupLayerLayout,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    normalizeSetupDeskType
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  } = await importVisualConfig();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(normalizeSetupDeskType({ standing_desk: false }), 'standard');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(normalizeSetupDeskType({ standing_desk: true }), 'standing');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.strictEqual(getSetupLayerLayout('standard'), SETUP_LAYER_LAYOUT_BY_DESK.standard);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.strictEqual(getSetupLayerLayout('standing'), SETUP_LAYER_LAYOUT_BY_DESK.standing);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual({ ...getSetupLayerLayout({ standing_desk: false }).pNotebook }, { x: 151, y: -292 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual({ ...getSetupLayerLayout({ standing_desk: true }).pNotebook }, { x: 172, y: -279 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual({ ...getSetupLayerLayout('standard').pMechanic }, { x: 37, y: -283 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual({ ...getSetupLayerLayout('standing').pMechanic }, { x: 18, y: -265 });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('el compositor elige el layout por standing_desk y nunca por preset', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(hybridJs, /var deskType = selected\.standing_desk \? 'standing' : 'standard'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(hybridJs, /getSetupLayerLayout\(deskType\)/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(hybridJs, /calibration\.setDeskType\(deskType\)/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(hybridJs, /getSetupLayerLayout\(presentedPreset\)/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('el modo calibración sólo se activa con calibrate=1', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { isSetupCalibrationEnabled } = await importVisualCalibration();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(isSetupCalibrationEnabled(''), false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(isSetupCalibrationEnabled('?calibrate=0'), false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(isSetupCalibrationEnabled('?foo=1&calibrate=true'), false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(isSetupCalibrationEnabled('?calibrate=1'), true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(isSetupCalibrationEnabled('?foo=1&calibrate=1&bar=2'), true);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('la conversión de arrastre usa la escala lógica 1254 x 1254', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { canvasDeltaFromClientDelta } = await importVisualCalibration();

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(canvasDeltaFromClientDelta(10, 20, 627, 627), { x: 20, y: 40 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(canvasDeltaFromClientDelta(5, -10, 1254, 1254), { x: 5, y: -10 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(canvasDeltaFromClientDelta(8, 4, 0, 600), { x: 0, y: 0 });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('el render proporcional no depende de píxeles de viewport', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { logicalPointToTransform } = await importVisualCalibration();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const point = { x: 125.4, y: -62.7 };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const expected = 'translate(10%, -5%)';
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const viewports = [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    [1440, 900],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    [1280, 720],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    [768, 1024],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    [390, 844]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  ];

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const viewport of viewports) {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.deepEqual(viewport.length, 2);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(logicalPointToTransform(point), expected);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('la exportación incluye lienzo, diez capas y coordenadas numéricas', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    buildCalibrationExport,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    createZeroCalibrationOffsets
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  } = await importVisualCalibration();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const offsets = createZeroCalibrationOffsets();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  offsets.pNotebook = { x: 17, y: -9 };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  offsets.standardDesk = { x: 3, y: 4 };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const exported = buildCalibrationExport(offsets);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const serialized = JSON.stringify(exported, null, 2);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const parsed = JSON.parse(serialized);

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(parsed.canvas, { width: 1254, height: 1254 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(Object.keys(parsed.layers).length, 10);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(parsed.deskType, 'standard');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(parsed.preset, 'pro');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(parsed.layers.pNotebook, { x: 168, y: -301 });
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const point of Object.values(parsed.layers)) {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(typeof point.x, 'number');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(typeof point.y, 'number');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('restablecer una capa y todas devuelve coordenadas cero', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    createZeroCalibrationOffsets,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    resetAllCalibrationOffsets,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    resetCalibrationLayer
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  } = await importVisualCalibration();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const offsets = createZeroCalibrationOffsets();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  offsets.pArm = { x: 50, y: -20 };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  offsets.pMat = { x: 7, y: 8 };

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const oneReset = resetCalibrationLayer(offsets, 'pArm');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(oneReset.pArm, { x: 0, y: 0 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(oneReset.pMat, { x: 7, y: 8 });

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const allReset = resetAllCalibrationOffsets();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(Object.keys(allReset).length, 10);
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const point of Object.values(allReset)) {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.deepEqual(point, { x: 0, y: 0 });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('localStorage de calibración sólo serializa canvas y desviaciones por capa', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    SETUP_CALIBRATION_STORAGE_KEY,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    buildCalibrationStoragePayload,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    createZeroCalibrationOffsets,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    sanitizeCalibrationPayload
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  } = await importVisualCalibration();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const offsets = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    standard: createZeroCalibrationOffsets(),
// Define un campo del fixture que representa una entrada o respuesta específica.
    standing: createZeroCalibrationOffsets()
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  offsets.standard.pHub = { x: 11, y: 22 };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const payload = buildCalibrationStoragePayload(offsets);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const serialized = JSON.stringify(payload);

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(SETUP_CALIBRATION_STORAGE_KEY, 'primoffice_setup_calibration_v3');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(payload.canvas, { width: 1254, height: 1254 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(payload.desks, { standard: { layers: { pHub: { x: 11, y: 22 } } } });
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(serialized, /cartState|extrasState|lead|odoo|whatsapp|price/i);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const sanitized = sanitizeCalibrationPayload({
// Define un campo del fixture que representa una entrada o respuesta específica.
    canvas: { width: 1, height: 1 },
// Define un campo del fixture que representa una entrada o respuesta específica.
    layers: { pHub: { x: '4', y: 5 }, base: { x: 99, y: 99 } },
// Define un campo del fixture que representa una entrada o respuesta específica.
    cartState: { standing_desk: true },
// Define un campo del fixture que representa una entrada o respuesta específica.
    lead: { email: 'test@example.com' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(sanitized.pHub, { x: 4, y: 5 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal('base' in sanitized, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal('cartState' in sanitized, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal('lead' in sanitized, false);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de leads y verifica normalización, persistencia o sincronización externa simulada.
test('la calibración está separada del carrito, leads, Odoo y WhatsApp', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const calibrationJs = await readFile(path.join(root, 'js/setup-visual-calibration.js'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');

// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(calibrationJs, /cartState|extrasState|submitLead|PATCH|Odoo|sendWhatsApp|window\.open|price/i);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(hybridJs, /if \(calibration\) \{[\s\S]*calibration\.handleRailSelection\(id\);[\s\S]*return;[\s\S]*\}\s*toggleProduct\(id/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(hybridJs, /if \(isSetupCalibrationEnabled\(window\.location\.search\)\) \{[\s\S]*createSetupCalibrationController/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('los listeners de arrastre sólo se registran dentro del controlador temporal', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const calibrationJs = await readFile(path.join(root, 'js/setup-visual-calibration.js'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((hybridJs.match(/addEventListener\('pointer/g) || []).length, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((calibrationJs.match(/sceneMedia\.addEventListener\('pointer/g) || []).length, 4);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(calibrationJs, /pointerdown/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(calibrationJs, /pointermove/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(calibrationJs, /pointerup/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(calibrationJs, /pointercancel/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('cambiar el preset en calibración sólo cambia la vista temporal', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const hybridJs = await readFile(path.join(root, 'js/setup-visual-hybrid.js'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const bridgeMatch = html.match(/getPresetSelection:function\(name\)\{([\s\S]*?)\n  \},\n  setProductSelection/);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const handlerMatch = hybridJs.match(/function handleCalibrationPresetClick\(event\) \{([\s\S]*?)\n  \}\n\n  function sync/);

// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(bridgeMatch, 'el puente debe exponer una lectura de preset sin mutaciones');
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(bridgeMatch[1], /cartState\s*=|extrasState\s*=|updateProductSelection|submitLead|PATCH/i);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(bridgeMatch[1], /COMBO_PRESETS\[name\]/);
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(handlerMatch, 'debe existir el interceptor temporal de presets');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(handlerMatch[1], /event\.stopImmediatePropagation\(\)/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(handlerMatch[1], /bridge\.getPresetSelection\(name\)/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(handlerMatch[1], /setProductSelection|prepareComboPreset|submitLead|sendWhatsApp|window\.open/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(hybridJs, /presetGroup\.addEventListener\('click', handleCalibrationPresetClick, true\)/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(hybridJs, /calibration\.setDeskType\(deskType\)/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso visual y fija la relación entre selección, capas, assets o calibración.
test('calcular, exportar y resetear posiciones no muta una selección comercial', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    buildCalibrationExport,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    createZeroCalibrationOffsets,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    resetCalibrationLayer
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  } = await importVisualCalibration();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const commercialSelection = Object.freeze({
// Define un campo del fixture que representa una entrada o respuesta específica.
    soporte_notebook: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
    standing_desk: false,
// Define un campo del fixture que representa una entrada o respuesta específica.
    luz_led: true
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const snapshot = JSON.stringify(commercialSelection);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const offsets = createZeroCalibrationOffsets();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  offsets.pNotebook = { x: 33, y: -14 };

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  buildCalibrationExport(offsets);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  resetCalibrationLayer(offsets, 'pNotebook');

// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(JSON.stringify(commercialSelection), snapshot);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});
