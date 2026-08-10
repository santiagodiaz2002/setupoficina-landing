// Esta suite importa el servicio de transferencia del frontend como módulo aislado y simula elementos de interfaz y transporte.
// Verifica que el navegador envíe solo selección interna, respete destinos permitidos y mantenga el fallback comercial existente.
// Las lecturas textuales finales fijan la relación verificada entre HTML, configuración y servicio sin ejecutar un navegador.
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import test from 'node:test';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import assert from 'node:assert/strict';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { readFile } from 'node:fs/promises';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import path from 'node:path';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { fileURLToPath } from 'node:url';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import vm from 'node:vm';

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const REDIRECT_TICKET = 'A'.repeat(43);

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function importService() {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const source = await readFile(path.join(root, 'js/services/tiendanube-cart-transfer.js'), 'utf8');
// Importa dinámicamente la unidad aislada para que el caso controle su entorno.
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function config(overrides = {}) {
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return {
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ENABLED: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_CART_TRANSFER_URL: '/api/tiendanube/cart-transfer',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_TRANSFER_TIMEOUT_MS: 1000,
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_STOREFRONT_ORIGINS: ['https://primoffice2.mitiendanube.com'],
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
    ...overrides
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function uiHarness() {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const attributes = new Map();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const button = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    disabled: false,
// Define un campo del fixture que representa una entrada o respuesta específica.
    hidden: false,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    setAttribute(name, value) { attributes.set(name, value); },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    removeAttribute(name) { attributes.delete(name); }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const statusAttributes = new Set(['hidden']);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const status = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    textContent: '',
// Define un campo del fixture que representa una entrada o respuesta específica.
    dataset: {},
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    setAttribute(name) { statusAttributes.add(name); },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    removeAttribute(name) { statusAttributes.delete(name); }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const documentImpl = {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    querySelectorAll(selector) { return selector === '[data-tiendanube-only]' ? [button] : [button]; },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    getElementById(id) { return id === 'tiendanube-transfer-status' ? status : null; }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { button, status, attributes, statusAttributes, documentImpl };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function comboPurchaseHarness(html, enabled) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const start = html.indexOf('var PRIMOFFICE_COMBO_URLS=');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const assignment = 'window.buyComboInPrimOffice=buyComboInPrimOffice;';
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const end = html.indexOf(assignment, start) + assignment.length;
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(start >= 0 && end >= assignment.length, 'No se encontro el flujo comercial en index.html');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const calls = { bridge: 0, opened: [], prepared: [], leads: [] };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const context = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    window: {
// Define un campo del fixture que representa una entrada o respuesta específica.
      PrimOfficeConfig: { TIENDANUBE_ENABLED: enabled },
// Define un campo del fixture que representa una entrada o respuesta específica.
      open: (...args) => calls.opened.push(args)
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    COMBO_PRESETS: { starter: [], pro: [], epic: [] },
// Define un campo del fixture que representa una entrada o respuesta específica.
    prepareComboPreset: (comboId) => calls.prepared.push(comboId),
// Define un campo del fixture que representa una entrada o respuesta específica.
    startTiendanubeCartTransfer: () => { calls.bridge += 1; return Promise.resolve({ ok: true }); },
// Define un campo del fixture que representa una entrada o respuesta específica.
    clearTimeout: () => {},
// Define un campo del fixture que representa una entrada o respuesta específica.
    pqLeadSession: { cartUpdateTimer: null },
// Define un campo del fixture que representa una entrada o respuesta específica.
    submitLeadUpdate: (event) => calls.leads.push(event),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    Promise
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  vm.runInNewContext(html.slice(start, end), context);
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { calls, buy: context.window.buyComboInPrimOffice };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('servicio envia solo IDs internos, cantidades y crypto.randomUUID', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const service = await importService();
// Reserva estado mutable para registrar llamadas o simular una transición.
  let request;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const result = await service.prepareCartTransfer([
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { internalId: 'soporte_notebook', quantity: 2, productId: 999, variant_id: 888, price: 1 }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    config: config(),
// Define un campo del fixture que representa una entrada o respuesta específica.
    cryptoImpl: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' },
// Define un campo del fixture que representa una entrada o respuesta específica.
    fetchImpl: async (url, options) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      request = { url, options };
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
      return new Response(JSON.stringify({
// Define un campo del fixture que representa una entrada o respuesta específica.
        ok: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
        redirectUrl: `https://primoffice2.mitiendanube.com/?setupoficina_ticket=${REDIRECT_TICKET}`,
// Define un campo del fixture que representa una entrada o respuesta específica.
        unavailable: []
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(result.ok, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(request.url, '/api/tiendanube/cart-transfer');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(JSON.parse(request.options.body), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    clientRequestId: '123e4567-e89b-42d3-a456-426614174000',
// Define un campo del fixture que representa una entrada o respuesta específica.
    items: [{ internalId: 'soporte_notebook', quantity: 2 }]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(request.options.body, /productId|variant|sku|price/i);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('doble clic dispara una sola solicitud y deshabilita el boton', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const service = await importService();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ui = uiHarness();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const assigned = [];
// Reserva estado mutable para registrar llamadas o simular una transición.
  let resolveFetch;
// Reserva estado mutable para registrar llamadas o simular una transición.
  let fetchCalls = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const fetchImpl = () => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    fetchCalls += 1;
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return new Promise((resolve) => { resolveFetch = resolve; });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const options = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    config: config(),
// Define un campo del fixture que representa una entrada o respuesta específica.
    documentImpl: ui.documentImpl,
// Define un campo del fixture que representa una entrada o respuesta específica.
    locationImpl: { assign: (url) => assigned.push(url) },
// Define un campo del fixture que representa una entrada o respuesta específica.
    cryptoImpl: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174001' },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    fetchImpl
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const first = service.transferSelection([{ internalId: 'hub_usb', quantity: 1 }], options);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const second = await service.transferSelection([{ internalId: 'hub_usb', quantity: 1 }], options);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(second, { ok: false, skipped: true, reason: 'in_flight' });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(fetchCalls, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.button.disabled, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.attributes.get('aria-busy'), 'true');

// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
  resolveFetch(new Response(JSON.stringify({
// Define un campo del fixture que representa una entrada o respuesta específica.
    ok: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
    redirectUrl: `https://primoffice2.mitiendanube.com/?setupoficina_ticket=${REDIRECT_TICKET}`,
// Define un campo del fixture que representa una entrada o respuesta específica.
    unavailable: []
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await first;
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(assigned, [`https://primoffice2.mitiendanube.com/?setupoficina_ticket=${REDIRECT_TICKET}`]);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('rechaza redireccion externa y conserva la configuracion ante error', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const service = await importService();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ui = uiHarness();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const assigned = [];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const items = [{ internalId: 'mouse_vertical', quantity: 1 }];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const snapshot = JSON.stringify(items);
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(service.transferSelection(items, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    config: config(),
// Define un campo del fixture que representa una entrada o respuesta específica.
    documentImpl: ui.documentImpl,
// Define un campo del fixture que representa una entrada o respuesta específica.
    locationImpl: { assign: (url) => assigned.push(url) },
// Define un campo del fixture que representa una entrada o respuesta específica.
    cryptoImpl: { randomUUID: () => '123e4567-e89b-42d3-a456-426614174002' },
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    fetchImpl: async () => new Response(JSON.stringify({
// Define un campo del fixture que representa una entrada o respuesta específica.
      ok: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
      redirectUrl: 'https://evil.example/steal',
// Define un campo del fixture que representa una entrada o respuesta específica.
      unavailable: []
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    }), { status: 201, headers: { 'Content-Type': 'application/json' } })
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }), /destino no permitido/);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(assigned, []);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(JSON.stringify(items), snapshot);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.button.disabled, false);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(ui.status.textContent, /destino no permitido/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('feature flag false conserva botones principales utilizables y oculta la accion exclusiva del puente', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const service = await importService();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ui = uiHarness();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  service.syncTiendanubeTransferUi({
// Define un campo del fixture que representa una entrada o respuesta específica.
    documentImpl: ui.documentImpl,
// Define un campo del fixture que representa una entrada o respuesta específica.
    config: config({ TIENDANUBE_ENABLED: false })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.button.disabled, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.button.hidden, true);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const result = await service.transferSelection([{ internalId: 'hub_usb', quantity: 1 }], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    documentImpl: ui.documentImpl,
// Define un campo del fixture que representa una entrada o respuesta específica.
    config: config({ TIENDANUBE_ENABLED: false })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(result.reason, 'disabled');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.button.disabled, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.status.textContent, '');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.statusAttributes.has('hidden'), true);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('feature flag true habilita y muestra la accion del nuevo puente', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const service = await importService();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ui = uiHarness();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  service.syncTiendanubeTransferUi({ documentImpl: ui.documentImpl, config: config() });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.button.disabled, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(ui.button.hidden, false);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('feature flag false abre las URLs historicas de Starter, Pro y Epic', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = comboPurchaseHarness(html, false);
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const [combo, url] of [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    ['starter', 'https://www.primoffice.com.ar/combo-starter/'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    ['pro', 'https://www.primoffice.com.ar/combo-pro/'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    ['epic', 'https://www.primoffice.com.ar/combo-epic/']
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ]) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    harness.buy(combo);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.deepEqual(harness.calls.opened.at(-1), [url, '_blank', 'noopener']);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.bridge, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.calls.leads, ['purchase_click', 'purchase_click', 'purchase_click']);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('feature flag true enruta los combos por el nuevo puente sin abrir fallback', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = comboPurchaseHarness(html, true);
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await harness.buy('starter');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.bridge, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.calls.opened, []);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de catálogo o esquema y comprueba que la fuente administrativa se traduzca sin datos inseguros.
test('HTML conserva fallback comercial sin exponer catalogo Tiendanube', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const appConfig = await readFile(path.join(root, 'js/config/app-config.js'), 'utf8');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /tiendanube-cart-transfer-button/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /data-tiendanube-only hidden/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /js\/services\/tiendanube-cart-transfer\.js/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /selectedTiendanubeTransferItems/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(html, /PRIMOFFICE_STORE_PRODUCTS/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /starter:'https:\/\/www\.primoffice\.com\.ar\/combo-starter\/'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /pro:'https:\/\/www\.primoffice\.com\.ar\/combo-pro\/'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /epic:'https:\/\/www\.primoffice\.com\.ar\/combo-epic\/'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /if\(tiendanubeCartBridgeEnabled\(\)\)return startTiendanubeCartTransfer\(\)/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /var url=PRIMOFFICE_COMBO_URLS\[comboId\]/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(html, /window\.open\(url,'_blank','noopener'\)/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(html, /variantId:554959249|sku:'PNOTEBOOKGE'/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(html, /data-combo-action="purchase"[^>]*disabled/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(appConfig, /TIENDANUBE_ENABLED:\s*false/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});
