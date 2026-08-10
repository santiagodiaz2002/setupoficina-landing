// Esta suite cubre preparación, consumo y finalización del ticket usando catálogo D1 y cliente de Tiendanube simulados.
// Los casos fijan idempotencia, catálogo autorizado, vencimiento, lease, credencial de procesamiento, repetición y CORS.
// La comprobación del esquema asegura que las tablas necesarias sean aditivas y no afecten datos de leads.
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import test from 'node:test';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import assert from 'node:assert/strict';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { createHmac } from 'node:crypto';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { readFile } from 'node:fs/promises';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import path from 'node:path';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { fileURLToPath } from 'node:url';

// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  handleCartTransfer,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  handleCartTransferComplete,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  handleCartTransferConsume,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  handleCartTransferOptions,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  normalizeSelectionPayload
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
} from '../functions/_lib/tiendanube/transfers.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { handlePrivacyWebhook } from '../functions/_lib/tiendanube/privacy.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { enforceRateLimit } from '../functions/_lib/tiendanube/rate-limit.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { timingSafeEqual, verifyWebhookHmac } from '../functions/_lib/tiendanube/security.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import { TiendanubeApiError } from '../functions/_lib/tiendanube/client.mjs';
// Importa herramientas de prueba o la unidad bajo prueba desde archivos locales.
import {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  FakeTiendanubeClient,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  MemoryD1,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  PRODUCT_IDS,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  catalogRows,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  envFor,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  jsonRequest,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  productFor,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  productsFor
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
} from './helpers/tiendanube-d1.mjs';

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
const PRESETS = Object.freeze({
// Define un campo del fixture que representa una entrada o respuesta específica.
  starter: ['soporte_notebook', 'mouse_vertical', 'mousepad_xxl'],
// Define un campo del fixture que representa una entrada o respuesta específica.
  pro: ['soporte_notebook', 'soporte_monitor', 'teclado_mec', 'mouse_vertical', 'mousepad_xxl', 'hub_usb', 'organizador_prem', 'luz_led'],
// Define un campo del fixture que representa una entrada o respuesta específica.
  epic: ['standing_desk', 'soporte_notebook', 'soporte_monitor', 'teclado_mec', 'mouse_vertical', 'mousepad_xxl', 'hub_usb', 'organizador_prem', 'luz_led'],
// Define un campo del fixture que representa una entrada o respuesta específica.
  personalizada: ['soporte_notebook', 'hub_usb', 'reposamuñecas']
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Construye una petición local con encabezados y cuerpo controlados para el handler.
function transferPayload(ids, requestId = '123e4567-e89b-42d3-a456-426614174000') {
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return {
// Define un campo del fixture que representa una entrada o respuesta específica.
    clientRequestId: requestId,
// Define un campo del fixture que representa una entrada o respuesta específica.
    items: ids.map((internalId) => ({ internalId, quantity: 1 }))
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
async function prepare(ids, options = {}) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = options.db || new MemoryD1(catalogRows());
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const client = options.client || new FakeTiendanubeClient(productsFor(Object.keys(PRODUCT_IDS)));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const env = envFor(db, options.env || {});
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handleCartTransfer({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(ids, options.requestId)),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { client, now: options.now || 1000 });
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return { response, db, client, env };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
for (const [name, ids] of Object.entries(PRESETS)) {
// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
  test(`crea ticket para seleccion ${name} usando solo IDs internos`, async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const { response, db } = await prepare(ids);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.status, 201);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const body = await response.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(body.ok, true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(body.available.length, ids.length);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const redirect = new URL(body.redirectUrl);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(redirect.origin, 'https://primoffice2.mitiendanube.com');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const ticket = redirect.searchParams.get('setupoficina_ticket');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
    assert.match(ticket, /^[A-Za-z0-9_-]{43}$/);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const [stored] = db.transfers.values();
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
    assert.match(stored.ticket_hash, /^[a-f0-9]{64}$/);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(JSON.stringify(stored).includes(ticket), false);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
    assert.doesNotMatch(stored.resolved_items_json, /"price"/i);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(stored.expires_at - stored.created_at, 600);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.deepEqual(JSON.parse(stored.selection_json), transferPayload(ids).items);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('rechaza IDs fuera del catalogo antes de consultar Tiendanube', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const client = new FakeTiendanubeClient(productsFor(['soporte_notebook']));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handleCartTransfer({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(['producto_inventado'])),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: envFor(db)
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { client, now: 1000 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 422);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(client.calls.length, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.transfers.size, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('producto 404 queda informado como no disponible y 401 corta la transferencia', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const missing = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      async getProduct() {
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
        throw new TiendanubeApiError(404, 'not_found', 'missing');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(missing.response.status, 201);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const missingBody = await missing.response.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(missingBody.available.length, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(missingBody.unavailable[0].reason, 'product_not_found');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const unauthorized = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    requestId: '123e4567-e89b-42d3-a456-426614174099',
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      async getProduct() {
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
        throw new TiendanubeApiError(401, 'unauthorized', 'secret must not leak');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(unauthorized.response.status, 502);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const unauthorizedBody = await unauthorized.response.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(unauthorizedBody.error, 'tiendanube_authorization_error');
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(JSON.stringify(unauthorizedBody), /secret must not leak/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('visibility acepta visible y unlisted, rechaza hidden y conserva el fallback legacy', async () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const visibility of ['visible', 'unlisted']) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const accepted = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
      client: new FakeTiendanubeClient({
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
        [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          visibility,
// Define un campo del fixture que representa una entrada o respuesta específica.
          published: false
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const body = await accepted.response.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(body.available.length, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(body.unavailable.length, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const hidden = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient({
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', { visibility: 'hidden' })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await hidden.response.json()).unavailable[0].reason, 'product_hidden');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const unpublishedLegacy = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient({
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', { published: false })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await unpublishedLegacy.response.json()).unavailable[0].reason, 'product_unpublished_legacy');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('despues de visibility se siguen validando variante, stock y precio', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const hiddenVariant = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient({
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
// Define un campo del fixture que representa una entrada o respuesta específica.
        visibility: 'visible',
// Define un campo del fixture que representa una entrada o respuesta específica.
        variant: { visible: false }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await hiddenVariant.response.json()).unavailable[0].reason, 'variant_hidden');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const missingVariant = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient({
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
// Define un campo del fixture que representa una entrada o respuesta específica.
        visibility: 'visible',
// Define un campo del fixture que representa una entrada o respuesta específica.
        variants: []
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await missingVariant.response.json()).unavailable[0].reason, 'variant_not_found');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const noStock = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient({
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
// Define un campo del fixture que representa una entrada o respuesta específica.
        visibility: 'unlisted',
// Define un campo del fixture que representa una entrada o respuesta específica.
        variant: { stock: 0, inventory_levels: [{ location_id: 'loc-1', stock: 0 }] }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await noStock.response.json()).unavailable[0].reason, 'insufficient_stock');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const noPrice = await prepare(['soporte_notebook'], {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient({
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      [PRODUCT_IDS.soporte_notebook[0]]: productFor('soporte_notebook', {
// Define un campo del fixture que representa una entrada o respuesta específica.
        visibility: 'visible',
// Define un campo del fixture que representa una entrada o respuesta específica.
        variant: { price: '', promotional_price: null }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await noPrice.response.json()).unavailable[0].reason, 'price_unavailable');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('feature flag backend permanece apagado por defecto', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handleCartTransfer({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(['soporte_notebook'])),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: envFor(db, { TIENDANUBE_ENABLED: 'false' })
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { client: new FakeTiendanubeClient(productsFor(['soporte_notebook'])), now: 1000 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 503);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await response.json()).error, 'feature_disabled');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.transfers.size, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('no acepta product_id, variant_id, SKU ni precio desde el frontend', () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const extra of [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { product_id: 1 },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { variantId: 2 },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { SKU: 'ABC' },
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { price: 10 }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ]) {
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
    assert.throws(() => normalizeSelectionPayload({
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
      ...transferPayload(['soporte_notebook']),
// Define un campo del fixture que representa una entrada o respuesta específica.
      items: [{ internalId: 'soporte_notebook', quantity: 1, ...extra }]
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    }), /IDs ni precios|campos no permitidos/);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('transferencia exige un Content-Type JSON valido', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
// Construye una petición simulada; no sale del proceso de pruebas.
  const request = new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
// Define un campo del fixture que representa una entrada o respuesta específica.
    method: 'POST',
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'Content-Type': 'application/json-malformed',
// Define un campo del fixture que representa una entrada o respuesta específica.
      Origin: 'https://setupoficina.com.ar'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    body: JSON.stringify(transferPayload(['soporte_notebook']))
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handleCartTransfer({ request, env: envFor(db) }, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient(productsFor(['soporte_notebook'])),
// Define un campo del fixture que representa una entrada o respuesta específica.
    now: 1000
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 415);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.transfers.size, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('incorporacion parcial conserva disponibles e informa faltantes', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ids = ['soporte_notebook', 'organizador_prem'];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const products = productsFor(ids);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  products[String(PRODUCT_IDS.organizador_prem[0])] = productFor('organizador_prem', {
// Define un campo del fixture que representa una entrada o respuesta específica.
    variant: { inventory_levels: [{ location_id: 'loc-1', stock: 0 }], stock: 99 }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { response, db } = await prepare(ids, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    client: new FakeTiendanubeClient(products)
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 201);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const body = await response.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(body.available.map((item) => item.internalId), ['soporte_notebook']);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(body.unavailable.map((item) => [item.internalId, item.reason]), [
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    ['organizador_prem', 'insufficient_stock']
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  ]);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const [stored] = db.transfers.values();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(JSON.parse(stored.resolved_items_json).length, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(JSON.parse(stored.unavailable_items_json).length, 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('ticket se consume una sola vez y luego se completa una sola vez', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { response, db, env } = await prepare(PRESETS.starter);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const prepared = await response.json();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ticket = new URL(prepared.redirectUrl).searchParams.get('setupoficina_ticket');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const consumeRequest = () => jsonRequest(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { ticket, storeId: '12345' },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'https://primoffice2.mitiendanube.com'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const first = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1010 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(first.status, 200);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const consumed = await first.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(consumed.items.length, PRESETS.starter.length);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(consumed.processingToken, /^[A-Za-z0-9_-]{43}$/);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const reused = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1011 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(reused.status, 409);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await reused.json()).error, 'ticket_processing');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const result = {
// Define un campo del fixture que representa una entrada o respuesta específica.
    added: PRESETS.starter.map((internalId) => ({ internalId, quantity: 1 })),
// Define un campo del fixture que representa una entrada o respuesta específica.
    failed: []
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const completeRequest = () => jsonRequest(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'https://setupoficina.com.ar/api/tiendanube/cart-transfer/complete',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { ticket, processingToken: consumed.processingToken, storeId: '12345', result },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'https://primoffice2.mitiendanube.com'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const completed = await handleCartTransferComplete({ request: completeRequest(), env }, { now: 1020 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(completed.status, 200);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const repeatedCompletion = await handleCartTransferComplete({ request: completeRequest(), env }, { now: 1021 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(repeatedCompletion.status, 409);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal([...db.transfers.values()][0].status, 'completed');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('processing abandonado se recupera con lease y token de procesamiento nuevo', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { response, db, env } = await prepare(['soporte_notebook']);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ticket = new URL((await response.json()).redirectUrl).searchParams.get('setupoficina_ticket');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const consumeRequest = () => jsonRequest(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { ticket, storeId: '12345' },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'https://primoffice2.mitiendanube.com'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const first = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1010 });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const firstBody = await first.json();
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1099 })).status, 409);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const recovered = await handleCartTransferConsume({ request: consumeRequest(), env }, { now: 1100 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(recovered.status, 200);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const recoveredBody = await recovered.json();
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(recoveredBody.processingToken, firstBody.processingToken);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const staleCompletion = await handleCartTransferComplete({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: jsonRequest(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/complete',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        ticket,
// Define un campo del fixture que representa una entrada o respuesta específica.
        processingToken: firstBody.processingToken,
// Define un campo del fixture que representa una entrada o respuesta específica.
        storeId: '12345',
// Define un campo del fixture que representa una entrada o respuesta específica.
        result: { added: [{ internalId: 'soporte_notebook', quantity: 1 }], failed: [] }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://primoffice2.mitiendanube.com'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { now: 1101 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(staleCompletion.status, 409);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal([...db.transfers.values()][0].status, 'processing');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('complete acepta solo el conjunto y cantidades entregados por consume', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ids = ['soporte_notebook', 'organizador_prem'];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const products = productsFor(ids);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  products[String(PRODUCT_IDS.organizador_prem[0])] = productFor('organizador_prem', {
// Define un campo del fixture que representa una entrada o respuesta específica.
    variant: { inventory_levels: [{ stock: 0 }], stock: 0 }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { response, env } = await prepare(ids, { client: new FakeTiendanubeClient(products) });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ticket = new URL((await response.json()).redirectUrl).searchParams.get('setupoficina_ticket');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const consumed = await handleCartTransferConsume({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: jsonRequest(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      { ticket, storeId: '12345' },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://primoffice2.mitiendanube.com'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { now: 1010 });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const consumeBody = await consumed.json();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const malicious = await handleCartTransferComplete({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: jsonRequest(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/complete',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        ticket,
// Define un campo del fixture que representa una entrada o respuesta específica.
        processingToken: consumeBody.processingToken,
// Define un campo del fixture que representa una entrada o respuesta específica.
        storeId: '12345',
// Define un campo del fixture que representa una entrada o respuesta específica.
        result: {
// Define un campo del fixture que representa una entrada o respuesta específica.
          added: [{ internalId: 'organizador_prem', quantity: 1 }],
// Define un campo del fixture que representa una entrada o respuesta específica.
          failed: [{ internalId: 'soporte_notebook', reason: 'cart_add_failed' }]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://primoffice2.mitiendanube.com'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { now: 1020 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(malicious.status, 422);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('ticket pendiente expira exactamente a los diez minutos', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const { response, env } = await prepare(['soporte_notebook'], { now: 5000 });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const ticket = new URL((await response.json()).redirectUrl).searchParams.get('setupoficina_ticket');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const consume = await handleCartTransferConsume({
// Define un campo del fixture que representa una entrada o respuesta específica.
    request: jsonRequest(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://setupoficina.com.ar/api/tiendanube/cart-transfer/consume',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
      { ticket, storeId: '12345' },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'https://primoffice2.mitiendanube.com'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    ),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, { now: 5600 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(consume.status, 410);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal((await consume.json()).error, 'ticket_expired');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('CORS usa lista cerrada para landing y storefront', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1(catalogRows());
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const env = envFor(db);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const allowed = handleCartTransferOptions({
// Construye una petición simulada; no sale del proceso de pruebas.
    request: new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
// Define un campo del fixture que representa una entrada o respuesta específica.
      method: 'OPTIONS',
// Define un campo del fixture que representa una entrada o respuesta específica.
      headers: { Origin: 'https://setupoficina.com.ar' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, 'setup');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(allowed.status, 204);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://setupoficina.com.ar');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const rejected = handleCartTransferOptions({
// Construye una petición simulada; no sale del proceso de pruebas.
    request: new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
// Define un campo del fixture que representa una entrada o respuesta específica.
      method: 'OPTIONS',
// Define un campo del fixture que representa una entrada o respuesta específica.
      headers: { Origin: 'https://evil.example' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }),
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    env
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, 'setup');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(rejected.status, 403);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
// Comprueba el efecto observable relevante de esta preparación.
  assert.notEqual(allowed.headers.get('Access-Control-Allow-Origin'), '*');

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const missingConfig = handleCartTransferOptions({
// Construye una petición simulada; no sale del proceso de pruebas.
    request: new Request('https://setupoficina.com.ar/api/tiendanube/cart-transfer', {
// Define un campo del fixture que representa una entrada o respuesta específica.
      method: 'OPTIONS',
// Define un campo del fixture que representa una entrada o respuesta específica.
      headers: { Origin: 'https://setupoficina.com.ar' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }),
// Define un campo del fixture que representa una entrada o respuesta específica.
    env: envFor(db, { TIENDANUBE_ALLOWED_SETUP_ORIGINS: '' })
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  }, 'setup');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(missingConfig.status, 503);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(missingConfig.headers.get('Access-Control-Allow-Origin'), null);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('storefront faltante o fuera de allowlist falla antes de crear el ticket', async () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const storefrontUrl of ['', 'https://evil.example/']) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const db = new MemoryD1(catalogRows(['soporte_notebook']));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const client = new FakeTiendanubeClient(productsFor(['soporte_notebook']));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const response = await handleCartTransfer({
// Define un campo del fixture que representa una entrada o respuesta específica.
      request: jsonRequest('https://setupoficina.com.ar/api/tiendanube/cart-transfer', transferPayload(['soporte_notebook'])),
// Define un campo del fixture que representa una entrada o respuesta específica.
      env: envFor(db, { TIENDANUBE_STOREFRONT_URL: storefrontUrl })
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    }, { client, now: 1000 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(response.status, 503);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(db.transfers.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.equal(client.calls.length, 0);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('rate limit D1 bloquea al superar la ventana', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Construye una petición simulada; no sale del proceso de pruebas.
  const request = new Request('https://setupoficina.com.ar/api/test', {
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: { Origin: 'https://setupoficina.com.ar', 'CF-Connecting-IP': '203.0.113.40' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 100 });
// Espera la promesa de la unidad bajo prueba antes de inspeccionar sus efectos.
  await enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 101 });
// Exige que la entrada adversa falle con la clase o el código previsto, no con un éxito silencioso.
  await assert.rejects(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 102 }),
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    (error) => error.status === 429 && error.code === 'rate_limited'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const reset = await enforceRateLimit(db, request, 'tiendanube:test', { limit: 2, windowSeconds: 60, now: 300 });
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(reset.count, 1);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.rates.size, 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('webhooks verifican HMAC SHA-256 sobre el cuerpo crudo', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const raw = new TextEncoder().encode('{"store_id":12345, "spacing": true}');
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const signature = createHmac('sha256', 'test-client-secret').update(raw).digest('hex');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(await verifyWebhookHmac(raw, signature, 'test-client-secret'), true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(await verifyWebhookHmac(new TextEncoder().encode('{"store_id":12345}'), signature, 'test-client-secret'), false);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3])), false);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('webhooks rechazan firma faltante antes de procesar el payload', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
// Construye una petición simulada; no sale del proceso de pruebas.
  const request = new Request('https://setupoficina.com.ar/api/tiendanube/privacy/store-redact', {
// Define un campo del fixture que representa una entrada o respuesta específica.
    method: 'POST',
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: { 'Content-Type': 'application/json' },
// Define un campo del fixture que representa una entrada o respuesta específica.
    body: JSON.stringify({ store_id: 12345 })
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const response = await handlePrivacyWebhook({ request, env: envFor(db) }, 'store-redact');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(response.status, 401);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.catalog.size, 1);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('rutas de privacidad exponen exclusivamente el handler POST', async () => {
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
  for (const route of [
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    '../functions/api/tiendanube/privacy/store-redact.js',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    '../functions/api/tiendanube/privacy/customers-redact.js',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    '../functions/api/tiendanube/privacy/customers-data-request.js'
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  ]) {
// Importa dinámicamente la unidad aislada para que el caso controle su entorno.
    const module = await import(route);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
    assert.deepEqual(Object.keys(module), ['onRequestPost']);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Construye un doble de persistencia cuyos cambios quedan disponibles para las aserciones.
async function signedWebhook(type, payload, db, secret = 'test-client-secret', envOverrides = {}) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const raw = JSON.stringify(payload);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
// Construye una petición simulada; no sale del proceso de pruebas.
  const request = new Request(`https://setupoficina.com.ar/api/tiendanube/privacy/${type}`, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    method: 'POST',
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'Content-Type': 'application/json',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'x-linkedstore-hmac-sha256': signature,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'CF-Connecting-IP': '198.51.100.10',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'User-Agent': 'tiendanube-webhook'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    body: raw
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return handlePrivacyWebhook({ request, env: envFor(db, envOverrides) }, type, { rateLimit: { now: 2000 } });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('store-redact elimina solo datos del puente y es idempotente', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1(catalogRows(['soporte_notebook']));
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  db.transfers.set('hash', { store_id: '12345' });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  db.oauthStates.set('state-hash', { environment: 'production', store_id: '12345', expires_at: 9999, consumed_at: 1900 });
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  db.installations.set('12345', { store_id: '12345', revoked_at: null });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const first = await signedWebhook(
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'store-redact',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { store_id: 12345 },
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    db,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    'test-client-secret',
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
    { TIENDANUBE_STORE_ID: '' }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  );
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(first.status, 200);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.catalog.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.transfers.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.oauthStates.size, 0);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(db.installations.size, 0);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const second = await signedWebhook('store-redact', { store_id: 12345 }, db);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(second.status, 200);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('webhook invalido no procesa PII y endpoints de cliente informan que no se almacena', async () => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const db = new MemoryD1();
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const bad = await signedWebhook('customers-redact', { store_id: 12345, customer: { email: 'persona@example.com' } }, db, 'wrong-secret');
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.equal(bad.status, 401);

// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const redact = await signedWebhook('customers-redact', { store_id: 12345, customer: { id: 9 } }, db);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(await redact.json(), { ok: true, redacted: false, reason: 'no_customer_data_stored' });
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const dataRequest = await signedWebhook('customers-data-request', { store_id: 12345, customer: { id: 9 } }, db);
// Compara el resultado exacto para detectar cambios de valor, forma o estado.
  assert.deepEqual(await dataRequest.json(), { ok: true, data: [], reason: 'no_customer_data_stored' });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Abre un caso del ciclo de transferencia y fija una transición, rechazo o garantía de uso único.
test('migracion crea las cinco tablas Tiendanube y no altera leads', async () => {
// Lee un artefacto local para fijar un contrato textual o binario verificable.
  const sql = await readFile(path.join(root, 'db/migrations/0001_tiendanube_cart_bridge.sql'), 'utf8');
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_catalog/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_cart_transfers/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_rate_limits/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_oauth_states/);
// Verifica que el resultado o el archivo conserve el patrón contractual esperado.
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tiendanube_installations/);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+leads/i);
// Verifica una ausencia relevante para seguridad, aislamiento o compatibilidad del contrato.
  assert.doesNotMatch(sql, /DROP\s+TABLE/i);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});
