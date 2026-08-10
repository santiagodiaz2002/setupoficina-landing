// Importa los componentes visuales oficiales que el script puede renderizar dentro de slots autorizados por Tiendanube.
import { Column, Text, Toast } from '@tiendanube/nube-sdk-jsx';
// Importa sólo el tipo del objeto NubeSDK; TypeScript lo elimina del bundle porque no es un valor necesario en ejecución.
import type { NubeSDK } from '@tiendanube/nube-sdk-types';
// Importa la fachada que agrega productos uno por uno y registra listeners de carrito recién cuando existe un ticket.
import { createLazySequentialCartAdder } from './transfer-core.mjs';
// Importa funciones puras y de coordinación que persisten el resultado, detectan rutas y preparan el resumen visual.
import {
  createLocationCoordinator,
  displayStoredResult,
  persistResultAndNavigate,
  summarizeDisplayResult
} from './storefront-flow.mjs';

// Declara para TypeScript la constante que tsup reemplaza durante el build; el valor real se valida en `build/backend-url.mjs`.
declare const __SETUPOFICINA_BACKEND_URL__: string;

// Conserva el origen compilado del backend y sirve de prefijo para las dos peticiones que realiza `postJson()`.
const API_BASE_URL = __SETUPOFICINA_BACKEND_URL__;
// Ordena los slots aceptados: primero el toast de esquina y, si no existe, el contenido modal como único fallback.
const RESULT_SLOT_IDS = ['corner_top_right', 'modal_content'] as const;
// Impide procesar respuestas API mayores a 256 KiB, tanto por header declarado como por bytes realmente recibidos.
const MAX_API_RESPONSE_BYTES = 256 * 1024;
// Registra instancias del SDK ya inicializadas sin impedir su recolección; evita duplicar handlers si `App()` se invoca más de una vez.
const initializedApps = new WeakSet<object>();

// Describe cada producto que el endpoint consume autoriza y que el agregador secuencial necesita para hablar con NubeSDK.
type TransferItem = {
  // Identificador interno que vuelve al resultado y permite relacionarlo con la selección de SetupOficina.
  internalId: string;
  // ID numérico del producto real, resuelto por el backend desde D1 y la API de Tiendanube.
  productId: number;
  // ID numérico de la variante exacta que se incorporará al carrito.
  variantId: number;
  // Cantidad solicitada y validada contra el máximo del catálogo.
  quantity: number;
  // Nombre apto para mostrar al cliente en el resumen.
  name: string;
};

// Describe productos que el backend decidió no transferir, por ejemplo por stock, visibilidad o precio inválido.
type UnavailableItem = {
  // Mantiene la identidad interna de la selección rechazada.
  internalId: string;
  // Conserva la cantidad original aunque el producto no llegue al SDK.
  quantity: number;
  // Proporciona la etiqueta que la interfaz puede presentar.
  name: string;
  // Código estable que permite distinguir falta de stock de otros rechazos.
  reason: string;
};

// Modela el dato temporal que viaja desde la ejecución de transferencia hasta la página de carrito.
type DisplayResult = {
  // Contiene únicamente productos confirmados por eventos de éxito del SDK.
  added: Array<{ internalId: string; quantity: number; name: string }>;
  // Reúne fallos del SDK y productos que el backend ya había marcado como no disponibles.
  failed: Array<{ internalId: string; reason: string; name: string }>;
  // Fecha ISO generada en el storefront para ubicar temporalmente el resultado.
  completedAt: string;
  // Literal verdadero que documenta la garantía de no vaciar productos preexistentes.
  preservedExistingCart: true;
  // Advertencia opcional cuando el carrito cambió pero el backend no confirmó el cierre del ticket.
  syncWarning?: string;
  // Error opcional cuando ni siquiera pudo completarse el flujo principal.
  fatalError?: string;
};

// Envía JSON a un endpoint del backend compilado y devuelve sólo respuestas JSON exitosas, acotadas y con `{ok:true}`.
// La función es usada por `executeTransfer()` para consumir y luego completar un ticket.
async function postJson(path: string, payload: unknown) {
  // Crea una señal cancelable para que una petición que no responde no bloquee indefinidamente el script.
  const controller = new AbortController();
  // Programa la cancelación a los diez segundos y conserva el identificador para limpiarlo en `finally`.
  const timeout = setTimeout(() => controller.abort(), 10000);
  // Garantiza la limpieza del temporizador independientemente de éxito, error HTTP, JSON inválido o aborto.
  try {
    // Construye la URL con el origen validado en build y la ruta constante elegida por el llamador.
    const response = await fetch(`${API_BASE_URL}${path}`, {
      // Ambos endpoints reciben comandos con cuerpo, por eso se usa POST.
      method: 'POST',
      // Solicita y anuncia JSON para que las Functions apliquen su validación de contenido.
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      // Convierte el objeto a texto JSON para transmitirlo como cuerpo HTTP.
      body: JSON.stringify(payload),
      // Vincula la petición al timeout creado arriba.
      signal: controller.signal
    });
    // Normaliza el tipo de contenido para validar variantes de mayúsculas y parámetros como charset.
    const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
    // Lee el tamaño declarado; cero representa header ausente y no sustituye la comprobación real posterior.
    const declaredLength = Number(response.headers.get('Content-Length') || 0);
    // Rechaza respuestas que no sean JSON o que anuncien más bytes de los permitidos antes de intentar parsearlas.
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType) || (Number.isFinite(declaredLength) && declaredLength > MAX_API_RESPONSE_BYTES)) {
      // Usa un error genérico con el estado HTTP para no confiar en un cuerpo de formato inesperado.
      throw new Error(`HTTP ${response.status}`);
    }
    // Lee el cuerpo como texto una sola vez; posteriormente se mide y se parsea desde esta copia.
    const raw = await response.text();
    // Mide bytes UTF-8 reales, no cantidad de caracteres, y corta respuestas grandes aunque el header faltara o mintiera.
    if (new TextEncoder().encode(raw).byteLength > MAX_API_RESPONSE_BYTES) throw new Error(`HTTP ${response.status}`);
    // Declara la forma mínima esperada sin afirmar campos específicos de consume o complete.
    let data: Record<string, unknown>;
    // Convierte el texto a objeto y transforma cualquier JSON inválido en el mismo error HTTP controlado.
    try { data = JSON.parse(raw) as Record<string, unknown>; }
    catch (_) { throw new Error(`HTTP ${response.status}`); }
    // Exige simultáneamente un estado 2xx y la confirmación lógica que comparten las respuestas del backend.
    if (!response.ok || !data.ok) {
      // Prefiere el mensaje estructurado del backend y usa el estado como fallback cuando no existe.
      throw new Error(String(data.message || `HTTP ${response.status}`));
    }
    // Entrega el objeto validado al flujo específico, que tipa los campos adicionales de consume.
    return data;
  } finally {
    // Cancela el temporizador para que no permanezca pendiente después de finalizar la petición.
    clearTimeout(timeout);
  }
}

// Une nombres para el texto visual y devuelve una palabra explícita cuando la categoría está vacía.
function namesLabel(items: string[]) {
  // Evita líneas ambiguas o vacías en el resumen mostrado al cliente.
  return items.length ? items.join(', ') : 'ninguno';
}

// Consulta los slots estáticos disponibles y elige el primero que coincida con el orden de preferencia declarado arriba.
async function availableResultSlot(nube: NubeSDK) {
  // La consulta depende del host; cualquier fallo se traduce en ausencia temporal de slot para permitir un reintento posterior.
  try {
    // Pide a la API oficial la lista efectiva de superficies de render disponibles en esta tienda/ruta.
    const slots = await nube.api.getAvailableSlots().getStatic();
    // Recorre primero los IDs permitidos y busca el objeto de slot correspondiente dentro de la respuesta real.
    return RESULT_SLOT_IDS
      .map((slotId) => slots.find((slot) => slot.slotId === slotId))
      // Selecciona la primera coincidencia o devuelve `null` si ninguna superficie autorizada está presente.
      .find(Boolean) || null;
  } catch (_) {
    // No inventa un slot ni intenta renderizar fuera de la API cuando la consulta falla.
    return null;
  }
}

// Renderiza un resultado ya validado en Toast o Column según el slot oficial que el host tenga disponible.
// Devuelve `false` si todavía no existe un slot, señal que evita borrar prematuramente el resultado almacenado.
async function renderResult(nube: NubeSDK, result: DisplayResult) {
  // Obtiene la superficie preferida antes de construir o enviar componentes.
  const slot = await availableResultSlot(nube);
  // Sin slot no hay efecto visual y `displayStoredResult()` podrá conservar el dato para reintentar.
  if (!slot) return false;
  // Clasifica agregados, falta de stock, otros fallos y variante mediante la función pura de `storefront-flow.mjs`.
  const summary = summarizeDisplayResult(result);
  // Usa un título de error sólo ante fallo fatal; una transferencia parcial conserva el título de carrito actualizado.
  const title = summary.fatalError ? 'No pudimos transferir el setup' : 'Tu setup ya esta en el carrito';
  // Convierte la lista de éxitos en una oración concreta.
  const addedLine = `Agregados: ${namesLabel(summary.addedNames)}.`;
  // Convierte la categoría de stock en una oración independiente.
  const outOfStockLine = `Sin stock: ${namesLabel(summary.outOfStockNames)}.`;
  // Expone los fallos técnicos por separado para no presentarlos como falta de disponibilidad.
  const failedLine = `Otros productos que fallaron: ${namesLabel(summary.failedNames)}.`;
  // Prioriza error fatal, luego advertencia de cierre y finalmente confirmación genérica.
  const detailLine = summary.fatalError || summary.syncWarning || 'Transferencia completada.';

  // El slot de esquina admite el componente Toast y es la opción visual preferida.
  if (slot.slotId === 'corner_top_right') {
    // Entrega al SDK el slot comprobado y el árbol de componentes declarativo.
    nube.render(
      slot,
      // Define severidad y duración del mensaje completo.
      <Toast.Root variant={summary.variant} duration={15000}>
        {/* Presenta primero el resultado general de la transferencia. */}
        <Toast.Title>{title}</Toast.Title>
        {/* Enumera las incorporaciones confirmadas. */}
        <Toast.Description>{addedLine}</Toast.Description>
        {/* Enumera por separado productos sin stock. */}
        <Toast.Description>{outOfStockLine}</Toast.Description>
        {/* Enumera fallos que no corresponden a stock. */}
        <Toast.Description>{failedLine}</Toast.Description>
        {/* Reafirma que el carrito anterior se preservó. */}
        <Toast.Description>{summary.preservedMessage}</Toast.Description>
        {/* Cierra con error, advertencia de sincronización o confirmación. */}
        <Toast.Description>{detailLine}</Toast.Description>
      </Toast.Root>
    );
  } else {
    // El único fallback permitido usa una columna de textos dentro del slot modal comprobado.
    nube.render(
      slot,
      // Agrupa las mismas líneas con espaciado y padding, sin depender del componente Toast.
      <Column gap={8} padding={16}>
        {/* Usa un encabezado semántico para el resultado general. */}
        <Text heading={2}>{title}</Text>
        {/* Mantiene el mismo contenido que la variante Toast para agregados. */}
        <Text>{addedLine}</Text>
        {/* Mantiene el mismo contenido para falta de stock. */}
        <Text>{outOfStockLine}</Text>
        {/* Mantiene el mismo contenido para otros fallos. */}
        <Text>{failedLine}</Text>
        {/* Conserva el mensaje sobre el carrito previo. */}
        <Text>{summary.preservedMessage}</Text>
        {/* Presenta el detalle final calculado arriba. */}
        <Text>{detailLine}</Text>
      </Column>
    );
  }
  // Informa que el host aceptó el render para que el resultado temporal pueda eliminarse.
  return true;
}

// Ejecuta el recorrido completo de un ticket: consume, agrega ítems, completa el backend, persiste el resumen y navega.
// Recibe la instancia SDK, el agregador reutilizable, el ticket de la URL y el Store ID observado por el host.
async function executeTransfer(
  nube: NubeSDK,
  adder: ReturnType<typeof createLazySequentialCartAdder>,
  ticket: string,
  storeId: string
) {
  // Obtiene las APIs de almacenamiento/navegación que NubeSDK ofrece al script instalado.
  const browser = nube.getBrowserAPIs();
  // Unifica cualquier fallo del recorrido principal en un resultado fatal visible para el cliente.
  try {
    // Consume el ticket de un solo uso y solicita los IDs reales ligados a la tienda actual.
    const consumed = await postJson('/api/tiendanube/cart-transfer/consume', { ticket, storeId }) as {
      // Token opaco que el endpoint complete exigirá para comprobar el lease vigente.
      processingToken: string;
      // Productos que superaron catálogo, visibilidad, variante, stock y precio en el backend.
      items: TransferItem[];
      // Productos rechazados antes de llegar al SDK, con su motivo presentable.
      unavailable: UnavailableItem[];
    };
    // Agrega los ítems autorizados uno por uno y espera un resultado individual para cada uno.
    const cartResults = await adder.addSequentially(consumed.items || []);

    // Construye la lista pública de éxitos sin propagar productId ni variantId al resultado visual.
    const added = cartResults
      // Conserva sólo intentos confirmados por el evento de éxito correspondiente.
      .filter((result) => result.ok)
      // Reduce cada resultado a identidad interna, cantidad y nombre.
      .map((result) => ({
        internalId: result.item.internalId,
        quantity: result.item.quantity,
        name: result.item.name
      }));
    // Reúne en una sola lista tanto fallos del SDK como no disponibles detectados por el backend.
    const failed = [
      // Convierte fallos de incorporación y aplica un código estable si el agregador no entregó motivo.
      ...cartResults.filter((result) => !result.ok).map((result) => ({
        internalId: result.item.internalId,
        reason: result.reason || 'cart_add_failed',
        name: result.item.name
      })),
      // Anexa productos que nunca se intentaron agregar porque el backend los declaró no disponibles.
      ...(consumed.unavailable || []).map((item) => ({
        internalId: item.internalId,
        reason: item.reason,
        name: item.name
      }))
    ];
    // Prepara el objeto que se persistirá antes de navegar al carrito.
    const result: DisplayResult = {
      // Incluye sólo incorporaciones confirmadas.
      added,
      // Incluye todos los fallos clasificados arriba.
      failed,
      // Marca el instante local de finalización en formato interoperable ISO.
      completedAt: new Date().toISOString(),
      // Explicita que la operación fue aditiva y no removió contenido anterior.
      preservedExistingCart: true
    };

    // El cierre del ticket se intenta después de modificar el carrito, pero su fallo no revierte ítems ya agregados por el host.
    try {
      // Informa al backend el resultado completo y el token asociado al lease de procesamiento.
      await postJson('/api/tiendanube/cart-transfer/complete', {
        ticket,
        processingToken: consumed.processingToken,
        storeId,
        // Reduce otra vez el payload a campos que el endpoint complete permite validar.
        result: {
          // Reporta para éxitos sólo identidad interna y cantidad original.
          added: added.map(({ internalId, quantity }) => ({ internalId, quantity })),
          // Reporta para fallos identidad y motivo, sin IDs reales ni datos comerciales nuevos.
          failed: failed.map(({ internalId, reason }) => ({ internalId, reason }))
        }
      });
    } catch (_) {
      // Conserva el éxito local del carrito pero añade una advertencia visible sobre la falta de confirmación del backend.
      result.syncWarning = 'El carrito se actualizo, pero no pudimos confirmar el cierre de la transferencia.';
    }
    // Guarda el resultado con TTL y, sólo cuando termina esa escritura, navega al carrito marcado.
    await persistResultAndNavigate(browser, result);
  } catch (error) {
    // Construye un resultado fatal sin atribuir incorporaciones que no pudieron verificarse desde este bloque.
    const result: DisplayResult = {
      added: [],
      failed: [],
      completedAt: new Date().toISOString(),
      preservedExistingCart: true,
      fatalError: String(error instanceof Error ? error.message : error)
    };
    // Primero intenta conservar el error durante la navegación normal al carrito.
    try {
      await persistResultAndNavigate(browser, result);
    } catch (_) {
      // Si almacenamiento o navegación también fallan, intenta mostrar el error inmediatamente en un slot disponible.
      await renderResult(nube, result);
    }
  }
}

// Adapta la API del SDK al helper que recupera, renderiza y elimina un resultado temporal consumido.
function showStoredResult(nube: NubeSDK) {
  // Obtiene las mismas APIs provistas por el host que se usaron al persistir el resultado.
  const browser = nube.getBrowserAPIs();
  // Inyecta `renderResult()` como callback y conserva el booleano que controla los reintentos del coordinador.
  return displayStoredResult(browser, (result) => renderResult(nube, result as DisplayResult));
}

// Es el punto de entrada exportado que NubeSDK invoca al cargar el bundle instalado en el storefront.
export function App(nube: NubeSDK) {
  // Evita registrar coordinador y listeners una segunda vez para la misma instancia del SDK.
  if (initializedApps.has(nube as object)) return;
  // Marca la instancia antes de crear callbacks para proteger también frente a una reinicialización reentrante.
  initializedApps.add(nube as object);
  // Crea la fachada perezosa; una visita sin ticket todavía no registra listeners de carrito.
  const adder = createLazySequentialCartAdder(nube);
  // Conecta las dos acciones externas que `storefront-flow.mjs` necesita para reaccionar a ubicaciones.
  const coordinator = createLocationCoordinator({
    // Captura la instancia y el agregador en una closure para ejecutar el ticket detectado.
    transfer: (ticket: string, storeId: string) => executeTransfer(nube, adder, ticket, storeId),
    // Captura la instancia para intentar recuperar el resultado cuando se llega al carrito marcado.
    displayResult: () => showStoredResult(nube)
  });
  // Adapta el estado emitido por NubeSDK a una llamada asíncrona cuyo posible error no queda como rechazo sin observar.
  const handleLocation = (state: ReturnType<NubeSDK['getState']>) => {
    // `void` señala que el evento no espera la promesa; el `catch` absorbe el error porque el flujo ya genera resultados visibles cuando puede.
    void coordinator.handle(state).catch(() => {});
  };
  // Reacciona a navegaciones internas posteriores, necesarias porque la aplicación puede cambiar de página sin recargar el script.
  nube.on('location:updated', handleLocation);
  // Procesa inmediatamente la ubicación inicial para detectar el ticket o el resultado aun si no ocurre un evento posterior.
  handleLocation(nube.getState());
}
