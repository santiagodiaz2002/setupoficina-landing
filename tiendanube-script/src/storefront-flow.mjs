// Nombra de forma estable la entrada de almacenamiento temporal donde el storefront conserva el resultado mientras cambia de ruta.
export const RESULT_STORAGE_KEY = 'setupoficina_cart_transfer_result';
// Define la única ruta a la que se navega después de agregar productos; el query permite distinguir este regreso de una visita normal al carrito.
export const RESULT_ROUTE = '/cart?setupoficina_result=1';
// Limita el resultado almacenado a diez minutos, el mismo orden de magnitud que el ticket, para no mostrar información vieja en una visita posterior.
export const RESULT_TTL_SECONDS = 600;

// Agrupa los motivos que la presentación debe separar como falta de stock en vez de mezclarlos con fallos técnicos de agregado.
const OUT_OF_STOCK_REASONS = new Set(['insufficient_stock', 'out_of_stock']);

/**
 * Estos tipos JSDoc documentan el contrato entre `main.tsx`, el almacenamiento provisto por NubeSDK y este coordinador escrito en JavaScript.
 * @typedef {{name?: string, reason?: string}} ResultItem
 * @typedef {{
 *   added: ResultItem[],
 *   failed: ResultItem[],
 *   completedAt?: string,
 *   preservedExistingCart?: boolean,
 *   syncWarning?: string,
 *   fatalError?: string
 * }} StoredResult
 * @typedef {{
 *   asyncSessionStorage: {
 *     getItem(key: string): Promise<string | null>,
 *     setItem(key: string, value: string, ttl?: number): Promise<void>,
 *     removeItem(key: string): Promise<void>
 *   },
 *   navigate(route: string): void
 * }} BrowserAPIs
 * @typedef {{url: string, queries: Record<string, string>}} FlowLocation
 * @typedef {{location: FlowLocation, store: {id: string | number}}} FlowState
 * @typedef {{
 *   transfer(ticket: string, storeId: string): Promise<void>,
 *   displayResult(): Promise<boolean>
 * }} CoordinatorOptions
 */

// Convierte una lista de resultados en nombres no vacíos para que la UI pueda unirlos sin exponer objetos internos.
/** @param {ResultItem[]} items */
function names(items) {
  // `map` normaliza cada nombre a texto y `filter(Boolean)` descarta entradas ausentes que no aportarían información al mensaje.
  return items.map((item) => String(item && item.name || '')).filter(Boolean);
}

/**
 * Prepara datos puramente presentacionales a partir del resultado persistido; no modifica carrito, ruta ni almacenamiento.
 * @param {StoredResult} result
 * @returns {{
 *   addedNames: string[],
 *   outOfStockNames: string[],
 *   failedNames: string[],
 *   preservedMessage: string,
 *   syncWarning: string,
 *   fatalError: string,
 *   variant: 'success' | 'error' | 'warning'
 * }}
 */
export function summarizeDisplayResult(result) {
  // Acepta `added` sólo si realmente es un array; un payload parcial se transforma en lista vacía en vez de romper el render.
  const added = Array.isArray(result && result.added) ? result.added : [];
  // Normaliza del mismo modo todos los fallos antes de clasificarlos por motivo.
  const allFailed = Array.isArray(result && result.failed) ? result.failed : [];
  // Conserva únicamente los fallos cuyo código corresponde a stock insuficiente o agotado.
  const outOfStock = allFailed.filter((item) => OUT_OF_STOCK_REASONS.has(String(item && item.reason || '')));
  // Separa el resto de los fallos para que problemas técnicos no aparezcan bajo el rótulo de stock.
  const failed = allFailed.filter((item) => !OUT_OF_STOCK_REASONS.has(String(item && item.reason || '')));
  // Convierte el error fatal opcional en una cadena limpia; su presencia domina la variante visual elegida debajo.
  const fatalError = String(result && result.fatalError || '').trim();
  // Devuelve un objeto diseñado para `renderResult()` de `main.tsx`, sin alterar el resultado original.
  return {
    // Entrega sólo los nombres de incorporaciones confirmadas por el SDK.
    addedNames: names(added),
    // Entrega por separado los nombres que no pudieron agregarse por disponibilidad.
    outOfStockNames: names(outOfStock),
    // Entrega los nombres de los fallos restantes, como timeout o rechazo del carrito.
    failedNames: names(failed),
    // Explicita que el flujo sólo agrega ítems y nunca vacía el carrito que el cliente ya tenía.
    preservedMessage: 'Conservamos los productos que ya estaban en tu carrito.',
    // Propaga una advertencia de sincronización sólo como texto limpio y opcional.
    syncWarning: String(result && result.syncWarning || '').trim(),
    // Expone el error fatal ya normalizado para que el título y detalle puedan reutilizarlo.
    fatalError,
    // Prioriza error fatal, luego advertencias por fallos parciales y finalmente éxito total.
    variant: fatalError ? 'error' : outOfStock.length || failed.length ? 'warning' : 'success'
  };
}

// Persiste primero el resultado y recién después cambia de ruta; ese orden evita perder el detalle al abandonar la vista actual.
/** @param {BrowserAPIs} browser @param {StoredResult} result */
export async function persistResultAndNavigate(browser, result) {
  // Espera a que la API asíncrona del storefront confirme la escritura antes de iniciar la navegación.
  await browser.asyncSessionStorage.setItem(
    // Usa una clave propia del proyecto para no colisionar con otros scripts instalados en la tienda.
    RESULT_STORAGE_KEY,
    // Serializa el objeto porque el contrato de almacenamiento recibe texto.
    JSON.stringify(result),
    // Solicita expiración automática a los diez minutos para limitar la vida del mensaje.
    RESULT_TTL_SECONDS
  );
  // Navega al carrito con el marcador que `isResultLocation()` reconocerá en la siguiente inicialización o actualización interna.
  browser.navigate(RESULT_ROUTE);
}

// Construye un resultado seguro de reemplazo cuando lo almacenado no puede parsearse o no respeta la forma mínima esperada.
function invalidStoredResult() {
  // Devuelve la misma estructura que espera el render, pero sin inventar productos agregados o fallidos.
  return {
    // No atribuye éxitos cuando los datos originales son irrecuperables.
    added: [],
    // Tampoco atribuye fallos a productos concretos que no pudieron verificarse.
    failed: [],
    // Registra cuándo se detectó el dato inválido para conservar un resultado estructuralmente completo.
    completedAt: new Date().toISOString(),
    // Mantiene la garantía del flujo: ningún código de esta integración elimina el carrito anterior.
    preservedExistingCart: true,
    // Proporciona a la UI una explicación genérica sin incluir el contenido corrupto.
    fatalError: 'No pudimos recuperar el detalle de la transferencia.'
  };
}

/**
 * Recupera, valida, presenta y consume una sola vez el resultado temporal guardado antes de navegar.
 * @param {BrowserAPIs} browser
 * @param {(result: StoredResult) => Promise<boolean>} renderResult
 * @returns {Promise<boolean>} `true` únicamente cuando el resultado llegó a mostrarse y pudo eliminarse.
 */
export async function displayStoredResult(browser, renderResult) {
  // Lee la entrada mediante la API asíncrona de NubeSDK; una visita normal no tendrá valor para esta clave.
  const stored = await browser.asyncSessionStorage.getItem(RESULT_STORAGE_KEY);
  // Informa que no hubo nada para mostrar sin ejecutar render ni borrado.
  if (!stored) return false;

  // Reserva la variable que contendrá el resultado parseado o el fallback estructurado.
  let result;
  // Aísla tanto errores de JSON como estructuras manipuladas o antiguas.
  try {
    // Reconstruye el objeto guardado por `persistResultAndNavigate()`.
    result = JSON.parse(stored);
    // Exige un objeto y los dos arrays mínimos que necesita el resumen; cualquier otra forma se considera inválida.
    if (!result || typeof result !== 'object' || !Array.isArray(result.added) || !Array.isArray(result.failed)) {
      // Sustituye datos incompatibles por un mensaje fatal verificable, sin intentar completar campos inventados.
      result = invalidStoredResult();
    }
  } catch (_) {
    // Un JSON corrupto sigue el mismo camino seguro que una estructura incompleta.
    result = invalidStoredResult();
  }

  // Delega la presentación al callback de `main.tsx`, que primero comprueba la disponibilidad real de un slot oficial.
  const displayed = await renderResult(result);
  // Conserva el dato para un intento posterior si el storefront todavía no ofreció dónde renderizarlo.
  if (!displayed) return false;
  // Elimina el resultado sólo después de mostrarlo para que una recarga futura no repita el aviso.
  await browser.asyncSessionStorage.removeItem(RESULT_STORAGE_KEY);
  // Confirma al coordinador que esta visita ya consumió exitosamente la presentación.
  return true;
}

// Determina si una ubicación del router de Tiendanube representa exactamente el carrito marcado por esta integración.
/** @param {FlowLocation | null | undefined} location */
export function isResultLocation(location) {
  // Rechaza de inmediato ubicaciones ausentes o que no traigan el valor de query acordado.
  if (!location || location.queries?.setupoficina_result !== '1') return false;
  // El parseo se protege porque `location.url` proviene del estado del host y puede no ser una URL válida en pruebas o errores.
  try {
    // Normaliza barras finales y exige `/cart` para impedir mostrar el resultado en cualquier otra página que copie el query.
    return new URL(String(location.url)).pathname.replace(/\/+$/, '') === '/cart';
  } catch (_) {
    // Una URL ilegible nunca habilita efectos de presentación.
    return false;
  }
}

// Crea el coordinador que `App()` reutiliza para la ubicación inicial y para cada evento de navegación interna del storefront.
/** @param {CoordinatorOptions} options */
export function createLocationCoordinator(options) {
  // Recuerda tickets observados durante la vida de esta instancia para no consumir dos veces el mismo valor ante eventos repetidos.
  const processedTickets = new Set();
  // Evita ejecutar simultáneamente más de un intento de presentación mientras continúa activa la misma ruta de resultado.
  let resultRouteActive = false;

  // Interpreta un snapshot de estado y elige entre transferir un ticket, mostrar un resultado o no hacer nada.
  /** @param {FlowState} state */
  async function handle(state) {
    // Extrae y limpia el ticket del query usando optional chaining para tolerar estados parciales sin lanzar excepciones.
    const ticket = String(state && state.location && state.location.queries?.setupoficina_ticket || '').trim();
    // La presencia de un ticket tiene prioridad sobre cualquier lógica de visualización de resultados.
    if (ticket) {
      // Abandona el bloqueo de la ruta de resultado porque el usuario está comenzando una transferencia nueva.
      resultRouteActive = false;
      // Ignora notificaciones repetidas del router para un ticket ya entregado a `options.transfer`.
      if (processedTickets.has(ticket)) return;
      // Marca antes del `await` para impedir una segunda entrada concurrente con el mismo ticket.
      processedTickets.add(ticket);
      // Delega el proceso completo a `executeTransfer()` de `main.tsx`, pasando también el Store ID observado en el estado.
      await options.transfer(ticket, String(state.store.id));
      // Termina aquí porque la transferencia decidirá cuándo persistir y navegar.
      return;
    }

    // Fuera del carrito marcado, libera el bloqueo y evita cualquier lectura del almacenamiento temporal.
    if (!isResultLocation(state && state.location)) {
      // Permite que una futura entrada real al carrito vuelva a intentar mostrar el resultado.
      resultRouteActive = false;
      return;
    }
    // Descarta notificaciones duplicadas mientras ya se está intentando mostrar el mismo resultado.
    if (resultRouteActive) return;
    // Bloquea antes de iniciar la promesa para serializar eventos del router que lleguen casi al mismo tiempo.
    resultRouteActive = true;
    // Permite restablecer el bloqueo tanto ante ausencia de slot/resultado como ante una excepción inesperada.
    try {
      // Delega en `showStoredResult()` de `main.tsx`, que termina llamando a `displayStoredResult()`.
      const displayed = await options.displayResult();
      // Si aún no pudo mostrar nada, deja habilitado un reintento posterior en la misma ruta.
      if (!displayed) resultRouteActive = false;
    } catch (error) {
      // Libera el estado interno antes de propagar el error al manejador superior.
      resultRouteActive = false;
      // Conserva la semántica de fallo para que `App()` pueda absorberla sin dejar un rechazo flotante.
      throw error;
    }
  }

  // Expone únicamente el handler; los sets y flags quedan encapsulados para una instancia de aplicación.
  return { handle };
}
