// Esta suite prueba el núcleo y el flujo storefront de la aplicación embebida con un doble del SDK de Nube.
// Los casos cubren consumo, agregado secuencial, eventos de éxito o fallo, finalización, ubicación y render en slots disponibles.
// También verifica contratos textuales y el artefacto local, sin publicar scripts ni conectar con una tienda.
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import test from 'node:test';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import assert from 'node:assert/strict';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { access, readFile } from 'node:fs/promises';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import path from 'node:path';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { fileURLToPath } from 'node:url';

// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  createLazySequentialCartAdder,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  createSequentialCartAdder
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
} from '../tiendanube-script/src/transfer-core.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  RESULT_ROUTE,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  RESULT_STORAGE_KEY,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  createLocationCoordinator,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  displayStoredResult,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  isResultLocation,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  persistResultAndNavigate,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  summarizeDisplayResult
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
} from '../tiendanube-script/src/storefront-flow.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  PRODUCTION_BACKEND_URL,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  resolveBackendUrl,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  validateBackendUrl
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
} from '../tiendanube-script/build/backend-url.mjs';

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const forbiddenEdgeSlot = ['edge', 'bottom', 'center'].join('_');

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function nubeHarness(outcomes) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const listeners = new Map();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const sent = [];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const cart = [{ product_id: 999, variant_id: 9991, quantity: 2, name: 'Producto previo' }];
// Reserva estado mutable para registrar llamadas o simular una transición.
  let index = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const nube = {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    on(event, handler) { listeners.set(event, handler); },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    off(event, handler) { if (listeners.get(event) === handler) listeners.delete(event); },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    send(event, modifier) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const state = modifier();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      sent.push({ event, state });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const item = state.cart.items[0];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const outcome = outcomes[index++];
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      queueMicrotask(() => {
// Selecciona la respuesta del doble o valida una precondición del escenario.
        if (outcome === 'success') {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          cart.push({ ...item, name: `Producto ${item.product_id}` });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          listeners.get('cart:add:success')?.({ eventPayload: { ...item, name: `Producto ${item.product_id}` } });
// Cubre el comportamiento alternativo del doble para este recorrido.
        } else {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          listeners.get('cart:add:fail')?.({ eventPayload: null });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { nube, sent, cart, listeners };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const ITEMS = [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  { internalId: 'soporte_notebook', productId: 10, variantId: 101, quantity: 1, name: 'Soporte' },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  { internalId: 'hub_usb', productId: 20, variantId: 201, quantity: 2, name: 'Hub' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
];

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function browserHarness(initialValue = null) {
// Reserva estado mutable para registrar llamadas o simular una transición.
  let value = initialValue;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const calls = [];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const browser = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    asyncSessionStorage: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      async getItem(key) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        calls.push(['get', key]);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
        return value;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      async setItem(key, nextValue, ttl) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        calls.push(['set', key, ttl]);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        value = nextValue;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      async removeItem(key) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        calls.push(['remove', key]);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        value = null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    navigate(route) { calls.push(['navigate', route]); }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { browser, calls, value: () => value };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
function state(url, queries = {}) {
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { location: { url, queries }, store: { id: 1234 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('NubeSDK agrega secuencialmente y conserva el carrito previo', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = nubeHarness(['success', 'success']);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const adder = createSequentialCartAdder(harness.nube, { timeoutMs: 100 });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const results = await adder.addSequentially(ITEMS);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  adder.dispose();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(results.map((result) => result.ok), [true, true]);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.sent.map((entry) => entry.event), ['cart:add', 'cart:add']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.cart[0].name, 'Producto previo');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.cart[0].quantity, 2);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.cart.length, 3);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.listeners.size, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('incorporacion parcial continua despues de cart:add:fail', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = nubeHarness(['success', 'fail']);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const adder = createSequentialCartAdder(harness.nube, { timeoutMs: 100 });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const results = await adder.addSequentially(ITEMS);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  adder.dispose();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(results[0].ok, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(results[1].ok, false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(results[1].reason, 'cart_add_failed');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.sent.length, 2);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.cart.some((item) => item.product_id === 999), true);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('cart:add con timeout falla y el mismo adder conserva un unico juego de listeners', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const listeners = new Map();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const sent = [];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const nube = {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    on(event, handler) { listeners.set(event, handler); },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    off(event, handler) { if (listeners.get(event) === handler) listeners.delete(event); },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    send(event, modifier) { sent.push({ event, state: modifier() }); }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const adder = createSequentialCartAdder(nube, { timeoutMs: 1 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(listeners.size, 2);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const first = await adder.addSequentially([ITEMS[0]]);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const second = await adder.addSequentially([ITEMS[1]]);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual([first[0].reason, second[0].reason], ['cart_add_timeout', 'cart_add_timeout']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(sent.length, 2);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(listeners.size, 2);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  adder.dispose();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(listeners.size, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('una visita sin ticket no registra listeners de carrito y el adder se inicia una sola vez al usarlo', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = nubeHarness(['success', 'success']);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const adder = createLazySequentialCartAdder(harness.nube, { timeoutMs: 100 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.listeners.size, 0);
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await adder.addSequentially([ITEMS[0]]);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.listeners.size, 2);
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await adder.addSequentially([ITEMS[1]]);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.listeners.size, 2);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  adder.dispose();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.listeners.size, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('script cumple el contrato NubeSDK sin DOM y escucha navegacion interna', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const main = await readFile(path.join(root, 'tiendanube-script/src/main.tsx'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const core = await readFile(path.join(root, 'tiendanube-script/src/transfer-core.mjs'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const flow = await readFile(path.join(root, 'tiendanube-script/src/storefront-flow.mjs'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const source = `${main}\n${core}\n${flow}`;
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(flow, /setupoficina_ticket/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(flow, /String\(state\.store\.id\)/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /cart-transfer\/consume/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /cart-transfer\/complete/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /processingToken: consumed\.processingToken/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(core, /nube\.on\('cart:add:success'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(core, /nube\.on\('cart:add:fail'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(core, /nube\.send\('cart:add'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /nube\.on\('location:updated'/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(source, /\bwindow\b|\bdocument\b|\blocalStorage\b|\bsessionStorage\b|jQuery|cart:remove/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('resultado se guarda antes de navegar al carrito con el marcador', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = browserHarness();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const result = { added: [], failed: [], preservedExistingCart: true };
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await persistResultAndNavigate(harness.browser, result);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.calls.map((call) => call[0]), ['set', 'navigate']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls[0][1], RESULT_STORAGE_KEY);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls[1][1], '/cart?setupoficina_result=1');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(RESULT_ROUTE, '/cart?setupoficina_result=1');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('al entrar al carrito recupera, muestra y elimina el resultado', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const stored = JSON.stringify({
// Define un campo del fixture que representa una entrada o respuesta específica.
    added: [{ name: 'Soporte' }],
// Define un campo del fixture que representa una entrada o respuesta específica.
    failed: [{ name: 'Luz', reason: 'insufficient_stock' }],
// Define un campo del fixture que representa una entrada o respuesta específica.
    preservedExistingCart: true
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = browserHarness(stored);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const shown = [];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const coordinator = createLocationCoordinator({
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    async transfer() { throw new Error('No debe transferir en el carrito.'); },
// Define un campo del fixture que representa una entrada o respuesta específica.
    displayResult: () => displayStoredResult(harness.browser, async (result) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      shown.push(result);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await coordinator.handle(state('https://primoffice.com.ar/cart?setupoficina_result=1', { setupoficina_result: '1' }));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(shown.length, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(harness.calls.map((call) => call[0]), ['get', 'remove']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.value(), null);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('una recarga posterior no vuelve a mostrar un resultado consumido', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const harness = browserHarness(JSON.stringify({ added: [], failed: [] }));
// Reserva estado mutable para registrar llamadas o simular una transición.
  let renderCalls = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const render = async () => { renderCalls += 1; return true; };
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(await displayStoredResult(harness.browser, render), true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(await displayStoredResult(harness.browser, render), false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(renderCalls, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(harness.calls.filter((call) => call[0] === 'remove').length, 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('visita normal sin ticket ni marcador no modifica la tienda', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const calls = [];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const coordinator = createLocationCoordinator({
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    async transfer() { calls.push('transfer'); },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    async displayResult() { calls.push('display'); return true; }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await coordinator.handle(state('https://primoffice.com.ar/products', {}));
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(calls, []);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(isResultLocation(state('https://primoffice.com.ar/products?setupoficina_result=1', { setupoficina_result: '1' }).location), false);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('resultado parcial distingue agregados, sin stock y otros fallos', () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const summary = summarizeDisplayResult({
// Define un campo del fixture que representa una entrada o respuesta específica.
    added: [{ name: 'Soporte' }],
// Define un campo del fixture que representa una entrada o respuesta específica.
    failed: [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      { name: 'Luz', reason: 'insufficient_stock' },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      { name: 'Hub', reason: 'cart_add_failed' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(summary.addedNames, ['Soporte']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(summary.outOfStockNames, ['Luz']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(summary.failedNames, ['Hub']);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(summary.preservedMessage, /Conservamos los productos/);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(summary.variant, 'warning');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('usa slots oficiales comprobados y Toast en corner_top_right', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const main = await readFile(path.join(root, 'tiendanube-script/src/main.tsx'), 'utf8');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /RESULT_SLOT_IDS = \['corner_top_right', 'modal_content'\]/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /nube\.api\.getAvailableSlots\(\)\.getStatic\(\)/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /slot\.slotId === 'corner_top_right'/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(main, /<Toast\.Root/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(main, /edge_[a-z_]+/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('documentacion conserva onfirstinteraction y explica la primera interaccion', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const docs = await readFile(path.join(root, 'docs/tiendanube-cart-bridge.md'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const readme = await readFile(path.join(root, 'tiendanube-script/README.md'), 'utf8');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const text = `${docs}\n${readme}`;
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(text, /onfirstinteraction/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(text, /clic, toque o desplazamiento/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(text, /No cambiar el evento a\s*`onload`/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(text, /aprobación previa/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('backend del script acepta produccion y previews del proyecto, no URLs arbitrarias', () => {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(resolveBackendUrl(undefined), PRODUCTION_BACKEND_URL);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    validateBackendUrl('https://branch-123.setupoficina-landing.pages.dev'),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'https://branch-123.setupoficina-landing.pages.dev'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  assert.throws(() => validateBackendUrl('https://evil.example'), /solo admite/);
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  assert.throws(() => validateBackendUrl('http://branch.setupoficina-landing.pages.dev'), /solo admite/);
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  assert.throws(() => validateBackendUrl('https://branch.setupoficina-landing.pages.dev/path'), /solo admite/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso de la aplicación embebida y observa eventos, carrito, ubicación o render mediante el SDK simulado.
test('el build publico NubeSDK existe en la salida estatica versionada', async () => {
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await access(path.join(root, 'assets/tiendanube/main.min.js'));
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const artifact = await readFile(path.join(root, 'assets/tiendanube/main.min.js'), 'utf8');
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const buildConfig = await readFile(path.join(root, 'tiendanube-script/tsup.config.js'), 'utf8');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(artifact, /setupoficina_cart_transfer_result/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(buildConfig, /outDir:\s*'\.\.\/assets\/tiendanube'/);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const backend = artifact.match(/https:\/\/(?:setupoficina\.com\.ar|[a-z0-9-]+\.setupoficina-landing\.pages\.dev)/i)?.[0];
// Comprueba la invariantes booleana que debe sostenerse en este punto del escenario.
  assert.ok(backend, 'El bundle debe contener un backend permitido');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(validateBackendUrl(backend), backend);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(artifact.includes(forbiddenEdgeSlot), false);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(artifact, /corner_top_right/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});
