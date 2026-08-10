// Esta suite prueba el cliente HTTP con respuestas y transporte simulados, nunca contra la red real.
// Los casos cubren límite de cuerpo, autenticación impuesta por el cliente, clasificación segura de errores, cancelación y reintentos.
// Las aserciones de no filtrado protegen el material de acceso incluso cuando el proveedor devuelve fallos.
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import test from 'node:test';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import assert from 'node:assert/strict';

// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  TiendanubeApiError,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  TiendanubeClient,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  availableStock,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  currentPrice
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
} from '../functions/_lib/tiendanube/client.mjs';

// Define un transporte HTTP simulado que registra entradas y devuelve respuestas deterministas.
function client(fetchImpl, overrides = {}) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return new TiendanubeClient({
// Define un campo del fixture que representa una entrada o respuesta específica.
    storeId: '12345',
// Define un campo del fixture que representa una entrada o respuesta específica.
    accessToken: 'token-for-tests',
// Define un campo del fixture que representa una entrada o respuesta específica.
    userAgent: 'setupoficina (tests@example.com)',
// Define un campo del fixture que representa una entrada o respuesta específica.
    timeoutMs: 100,
// Define un campo del fixture que representa una entrada o respuesta específica.
    maxRetries: 1,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    fetchImpl,
// Define un campo del fixture que representa una entrada o respuesta específica.
    sleepImpl: async () => {},
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
    ...overrides
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso del cliente HTTP y controla respuesta, tiempo, reintento o confidencialidad con dobles locales.
test('cliente usa API 2025-03, Bearer y User-Agent configurado', async () => {
// Reserva estado mutable para registrar llamadas o simular una transición.
  let captured;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const api = client(async (url, options) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    captured = { url, options };
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    return new Response(JSON.stringify({ id: 99 }), {
// Define un campo del fixture que representa una entrada o respuesta específica.
      status: 200,
// Define un campo del fixture que representa una entrada o respuesta específica.
      headers: { 'Content-Type': 'application/json' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await api.getProduct(99);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(captured.url, 'https://api.tiendanube.com/2025-03/12345/products/99');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(captured.options.headers.Authorization, 'Bearer token-for-tests');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(captured.options.headers['User-Agent'], 'setupoficina (tests@example.com)');
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  assert.throws(() => new TiendanubeClient({
// Define un campo del fixture que representa una entrada o respuesta específica.
    storeId: '12345',
// Define un campo del fixture que representa una entrada o respuesta específica.
    accessToken: 'token-for-tests'
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }), (error) => error.code === 'client_configuration_invalid');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del cliente HTTP y controla respuesta, tiempo, reintento o confidencialidad con dobles locales.
test('reintenta 429 y 5xx solo para lecturas seguras', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const statuses = [429, 500, 200];
// Reserva estado mutable para registrar llamadas o simular una transición.
  let readCalls = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const readClient = client(async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const status = statuses[readCalls++];
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    return new Response(status === 200 ? '{"ok":true}' : '{}', {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      status,
// Define un campo del fixture que representa una entrada o respuesta específica.
      headers: status === 429
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        ? { 'Retry-After': '0' }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        : status === 200 ? { 'Content-Type': 'application/json' } : {}
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { maxRetries: 2 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(await readClient.request('/products/1'), { ok: true });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(readCalls, 3);

// Reserva estado mutable para registrar llamadas o simular una transición.
  let writeCalls = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const writeClient = client(async () => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    writeCalls += 1;
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    return new Response('{}', { status: 500 });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { maxRetries: 3 });
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    writeClient.request('/scripts', { method: 'POST', body: '{}' }),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    (error) => error instanceof TiendanubeApiError && error.status === 500
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(writeCalls, 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
for (const [status, code] of [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  [401, 'unauthorized'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  [403, 'forbidden'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  [404, 'not_found'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  [409, 'conflict'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  [422, 'unprocessable_entity'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  [429, 'rate_limited'],
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
  [503, 'upstream_error']
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
]) {
// Abre un caso del cliente HTTP y controla respuesta, tiempo, reintento o confidencialidad con dobles locales.
  test(`clasifica respuesta Tiendanube ${status}`, async () => {
// Reserva estado mutable para registrar llamadas o simular una transición.
    let calls = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const api = client(async () => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      calls += 1;
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
      return new Response('{}', { status });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
    await assert.rejects(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      api.getProduct(1),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      (error) => error instanceof TiendanubeApiError && error.status === status && error.code === code
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    );
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(calls, status === 429 || status >= 500 ? 2 : 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso del cliente HTTP y controla respuesta, tiempo, reintento o confidencialidad con dobles locales.
test('aplica timeout y no expone el token en el error', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const api = client((_url, options) => new Promise((_resolve, reject) => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    options.signal.addEventListener('abort', () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const error = new Error('aborted token-for-tests');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      error.name = 'AbortError';
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      reject(error);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }), { timeoutMs: 5 });
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(api.getProduct(1), (error) => {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(error.code, 'timeout');
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(error.message, /token-for-tests/);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });

// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
  const stalledBody = client(async (_url, options) => new Response(new ReadableStream({
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    start(controller) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      options.signal.addEventListener('abort', () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
        const error = new Error('body aborted token-for-tests');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        error.name = 'AbortError';
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        controller.error(error);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }), {
// Define un campo del fixture que representa una entrada o respuesta específica.
    timeoutMs: 5,
// Define un campo del fixture que representa una entrada o respuesta específica.
    maxRetries: 0
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(stalledBody.getProduct(1), (error) => {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(error.code, 'timeout');
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(error.message, /token-for-tests/);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return true;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del cliente HTTP y controla respuesta, tiempo, reintento o confidencialidad con dobles locales.
test('respeta Retry-After y valida content-type y tamaño antes de parsear JSON', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const delays = [];
// Reserva estado mutable para registrar llamadas o simular una transición.
  let calls = 0;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const retrying = client(async () => {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    calls += 1;
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    if (calls === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '3' } });
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { sleepImpl: async (delay) => delays.push(delay) });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(await retrying.getProduct(1), { ok: true });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(delays, [3000]);

// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    client(async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'text/html' } })).getProduct(1),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    (error) => error.code === 'invalid_content_type'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(
// Construye una respuesta simulada para controlar estado, cuerpo y encabezados.
    client(async () => new Response('{"ok":true}', {
// Define un campo del fixture que representa una entrada o respuesta específica.
      status: 200,
// Define un campo del fixture que representa una entrada o respuesta específica.
      headers: { 'Content-Type': 'application/json', 'Content-Length': '999' }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    }), { maxResponseBytes: 20 }).getProduct(1),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    (error) => error.code === 'response_too_large'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del cliente HTTP y controla respuesta, tiempo, reintento o confidencialidad con dobles locales.
test('inventory_levels tiene prioridad sobre stock y soporta inventario infinito', () => {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(availableStock({
// Define un campo del fixture que representa una entrada o respuesta específica.
    stock_management: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
    stock: 99,
// Define un campo del fixture que representa una entrada o respuesta específica.
    inventory_levels: [{ stock: 0 }, { stock: 3 }]
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }), 3);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(availableStock({ stock_management: false, stock: 0, inventory_levels: [] }), Number.POSITIVE_INFINITY);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(availableStock({ stock_management: true, inventory_levels: [{ stock: '' }] }), Number.POSITIVE_INFINITY);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(availableStock({ stock_management: true, stock: 4 }), 4);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('precio promocional real prevalece y precios invalidos se descartan', () => {
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(currentPrice({ price: '100.00', promotional_price: '80.50' }), '80.50');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(currentPrice({ price: '100.00', promotional_price: '' }), '100.00');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(currentPrice({ price: 'gratis' }), '');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});
