// Establece el máximo de espera por cada producto agregado al carrito; si NubeSDK no confirma antes, la operación se informa como fallida y la secuencia puede continuar.
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Describe el dato ya resuelto por el backend que esta capa necesita para pedir a NubeSDK una incorporación al carrito.
 * @typedef {object} TransferItem
 * @property {string} internalId
 * `internalId` es el identificador comercial usado para relacionar el resultado con SetupOficina.
 * @property {number} productId
 * `productId` es el identificador numérico real entregado por `/consume`, no por la landing.
 * @property {number} variantId
 * `variantId` identifica la variante exacta que NubeSDK debe agregar.
 * @property {number} quantity
 * `quantity` conserva la cantidad validada originalmente por el backend.
 * @property {string} name
 * `name` es el nombre que luego puede mostrarse en el resumen del carrito.
 */

// Modela el resultado uniforme de un intento; `reason` sólo aparece cuando NubeSDK falla o no responde a tiempo.
/** @typedef {{ok: boolean, item: TransferItem, reason?: string}} AddResult */
// Conserva la única operación que puede estar esperando un evento, incluida su promesa y temporizador, para poder finalizarla exactamente una vez.
/** @typedef {{item: TransferItem, resolve: (result: AddResult) => void, timer: any}} ActiveOperation */
/**
 * Permite a producción usar temporizadores reales y a las pruebas inyectar implementaciones controladas sin cambiar la lógica del agregador.
 * @typedef {object} AdderOptions
 * @property {number} [timeoutMs]
 * `timeoutMs` permite cambiar el tiempo máximo por ítem.
 * @property {(callback: () => void, timeout: number) => any} [setTimeoutImpl]
 * `setTimeoutImpl` permite sustituir la creación de temporizadores.
 * @property {(timer: any) => void} [clearTimeoutImpl]
 * `clearTimeoutImpl` permite sustituir la cancelación de temporizadores.
 */

/**
 * Normaliza el payload variable de los eventos de NubeSDK: algunas versiones entregan el ítem directamente y otras dentro de un array.
 * @param {unknown} payload Valor recibido desde `state.eventPayload`.
 * @returns {object | null} Primer objeto de producto identificable, o `null` si el evento no trae uno.
 */
/** @param {unknown} payload */
function eventItem(payload) {
  // Si el SDK entregó un array, toma sólo el primer elemento porque cada operación de esta capa envía un único producto.
  if (Array.isArray(payload)) return payload[0] || null;
  // Acepta objetos directos y descarta primitivos/nulos para que el handler no lea propiedades inválidas.
  return payload && typeof payload === 'object' ? payload : null;
}

/**
 * Crea un agregador que registra una sola pareja de listeners y serializa todas las incorporaciones para no confundir respuestas entre productos.
 * @param {any} nube
 * @param {AdderOptions} [options]
 * @returns {{addSequentially(items: TransferItem[]): Promise<AddResult[]>, dispose(): void}} API que usa `main.tsx` y que también ejercitan las pruebas NubeSDK.
 */
export function createSequentialCartAdder(nube, options = {}) {
  // Convierte el timeout inyectado o predeterminado a número antes de pasarlo a la API de temporizadores.
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  // Selecciona la función que crea temporizadores; la inyección vuelve deterministas los casos de timeout en tests.
  const setTimer = options.setTimeoutImpl || setTimeout;
  // Selecciona la función complementaria que libera el temporizador cuando llega éxito o fallo.
  const clearTimer = options.clearTimeoutImpl || clearTimeout;
  /** @type {ActiveOperation | null} */
  // Apunta al único ítem actualmente pendiente; `null` significa que un evento tardío no debe resolver nada.
  let active = null;
  // Empieza con una promesa ya resuelta y se usa como cola: cada lote nuevo se encadena después del anterior.
  let sequence = Promise.resolve();

  /** @param {AddResult} result */
  /**
   * Cierra la operación activa, cancela su timeout y resuelve la promesa que espera `addOne()`.
   * @param {AddResult} result Resultado que consumirá `runSequentially()`.
   */
  function finish(result) {
    // Ignora eventos duplicados o tardíos si la operación ya fue cerrada por otra vía.
    if (!active) return;
    // Guarda la referencia antes de limpiar `active`, porque aún necesita su temporizador y función `resolve`.
    const operation = active;
    // Marca inmediatamente que no hay trabajo pendiente para impedir una segunda resolución reentrante.
    active = null;
    // Evita que el timeout se dispare después de haber recibido una respuesta válida del SDK.
    clearTimer(operation.timer);
    // Desbloquea la promesa individual con un objeto de resultado, sin rechazar la secuencia completa.
    operation.resolve(result);
  }

  /** @param {{eventPayload?: unknown}} state */
  /**
   * Atiende una confirmación de carrito y sólo la asocia al producto/variante que está esperando actualmente.
   * @param {{eventPayload?: unknown}} state Estado emitido por NubeSDK.
   */
  function onSuccess(state) {
    // Un éxito recibido fuera de una incorporación iniciada por esta instancia no le pertenece y se ignora.
    if (!active) return;
    // Extrae el producto del formato de evento normalizado por `eventItem()`.
    const item = eventItem(state && state.eventPayload);
    // Sin información de ítem no es seguro atribuir el éxito a la operación actual.
    if (!item) return;
    // Compara el producto numéricamente para tolerar que el SDK represente IDs como texto o número.
    if (Number(item.product_id) !== Number(active.item.productId)) return;
    // Exige además la variante exacta, evitando cerrar el ítem incorrecto si dos variantes comparten producto.
    if (Number(item.variant_id) !== Number(active.item.variantId)) return;
    // Produce un éxito ligado al mismo objeto recibido del backend para conservar sus metadatos en el resumen.
    finish({ ok: true, item: active.item });
  }

  // Convierte el evento de fallo del SDK en un resultado recuperable; no rechaza la promesa porque deben intentarse los productos restantes.
  function onFail() {
    // Descarta fallos que no coinciden con una operación iniciada por este agregador.
    if (!active) return;
    // Finaliza con un motivo estable que `main.tsx` incluye entre los productos fallidos.
    finish({ ok: false, item: active.item, reason: 'cart_add_failed' });
  }

  // Registra una sola vez el callback de éxito compartido por todos los ítems que esta instancia procese.
  nube.on('cart:add:success', onSuccess);
  // Registra una sola vez el callback de fallo complementario; `dispose()` puede retirar ambos si el host soporta esa operación.
  nube.on('cart:add:fail', onFail);

  /** @param {TransferItem} item @returns {Promise<AddResult>} */
  /**
   * Envía exactamente un producto al carrito y espera éxito, fallo, excepción síncrona o timeout.
   * @param {TransferItem} item Producto/variante ya autorizado por el backend.
   * @returns {Promise<AddResult>} Promesa que siempre se resuelve con éxito o fallo explícito.
   */
  function addOne(item) {
    // Crea la promesa que `runSequentially()` esperará antes de avanzar al siguiente producto.
    return new Promise((resolve) => {
      // Programa el límite individual; su callback conserva `item` mediante una closure.
      const timer = setTimer(() => {
        // Un SDK silencioso se transforma en fallo controlado para impedir que toda la transferencia quede bloqueada.
        finish({ ok: false, item, reason: 'cart_add_timeout' });
      }, timeoutMs);
      // Publica la operación antes de enviar para que incluso una respuesta síncrona pueda encontrarla.
      active = { item, resolve, timer };
      // Protege la cola frente a una implementación del SDK que lance durante el envío.
      try {
        // Solicita al host una mutación de carrito; el callback construye el estado nuevo siguiendo el contrato NubeSDK.
        nube.send('cart:add', () => ({
          // Agrupa la modificación bajo la clave de carrito esperada por el SDK.
          cart: {
            // Envía un array de un solo elemento para preservar la correlación uno-a-uno con los eventos.
            items: [{
              // Usa el ID real entregado por `/api/tiendanube/cart-transfer/consume`, nunca uno tomado de la landing.
              product_id: item.productId,
              // Identifica la variante comercial exacta resuelta y validada por el backend.
              variant_id: item.variantId,
              // Transfiere la cantidad ya limitada por catálogo y solicitud original.
              quantity: item.quantity
            }]
          }
        }));
      } catch (_) {
        // Uniforma una excepción síncrona con el mismo motivo de un evento de fallo para que el resto del lote continúe.
        finish({ ok: false, item, reason: 'cart_add_failed' });
      }
    });
  }

  /** @param {TransferItem[]} items @returns {Promise<AddResult[]>} */
  /**
   * Recorre un lote en orden y espera cada incorporación antes de iniciar la siguiente, requisito que evita solapar el único estado `active`.
   * @param {TransferItem[]} items Lista resuelta por el endpoint consume.
   * @returns {Promise<AddResult[]>} Resultados en el mismo orden de entrada.
   */
  async function runSequentially(items) {
    // Acumula tanto éxitos como fallos para que la UI pueda presentar una transferencia parcial completa.
    const results = [];
    // El `await` dentro del bucle es intencional: garantiza que sólo exista una operación activa por vez.
    for (const item of items) results.push(await addOne(item));
    // Entrega todos los resultados al coordinador de `main.tsx`, que los separa en agregados y fallidos.
    return results;
  }

  /** @param {TransferItem[]} items @returns {Promise<AddResult[]>} */
  /**
   * Encola un lote completo detrás de cualquier llamada anterior a esta misma instancia.
   * @param {TransferItem[]} items Productos a incorporar.
   * @returns {Promise<AddResult[]>} Promesa propia de este lote.
   */
  function addSequentially(items) {
    // Encadena el trabajo sin ejecutarlo hasta que `sequence` haya terminado.
    const operation = sequence.then(() => runSequentially(items));
    // Actualiza la cola con una promesa que queda resuelta incluso si apareciera un rechazo inesperado, para no bloquear llamadas futuras.
    sequence = operation.then(() => undefined, () => undefined);
    // Devuelve la promesa con resultados reales al llamador, no la promesa vacía usada internamente como cola.
    return operation;
  }

  // Ofrece limpieza explícita de listeners para hosts o pruebas que destruyan la aplicación.
  function dispose() {
    // Comprueba la capacidad opcional del SDK antes de intentar retirar callbacks.
    if (typeof nube.off === 'function') {
      // Retira exactamente la función registrada para confirmaciones de carrito.
      nube.off('cart:add:success', onSuccess);
      // Retira exactamente la función registrada para fallos de carrito.
      nube.off('cart:add:fail', onFail);
    }
  }

  // Expone sólo las dos operaciones públicas; el estado activo y los handlers permanecen encapsulados por la closure.
  return { addSequentially, dispose };
}

/**
 * Evita registrar listeners de carrito en visitas que nunca reciben un ticket.
 * `App()` crea este wrapper al iniciar, pero el agregador real nace en el primer uso.
 * @param {any} nube
 * @param {AdderOptions} [options]
 * @returns {{addSequentially(items: TransferItem[]): Promise<AddResult[]>, dispose(): void}} Fachada con la misma API que el agregador real.
 */
export function createLazySequentialCartAdder(nube, options = {}) {
  /** @type {ReturnType<typeof createSequentialCartAdder> | null} */
  // Mantiene privada la instancia ya materializada; comienza en `null` para que una visita normal no registre listeners de carrito.
  let adder = null;
  // Devuelve una fachada estable que puede existir desde el arranque sin producir efectos sobre el carrito.
  return {
    /** @param {TransferItem[]} items @returns {Promise<AddResult[]>} */
    /**
     * Materializa el agregador como máximo una vez y delega la lista recibida.
     * @param {TransferItem[]} items Productos entregados por consume.
     * @returns {Promise<AddResult[]>} Resultados del agregador secuencial real.
     */
    addSequentially(items) {
      // La asignación lógica crea la instancia sólo cuando `adder` todavía es nulo.
      adder ||= createSequentialCartAdder(nube, options);
      // Reutiliza la misma instancia para conservar un único juego de listeners y una única cola.
      return adder.addSequentially(items);
    },
    // Libera la instancia materializada si existe y permite que un uso posterior cree otra limpia.
    dispose() {
      // Optional chaining evita fallar cuando nunca llegó un ticket y, por lo tanto, nunca se creó el agregador.
      adder?.dispose();
      // Elimina la referencia para que la closure no conserve estado ni callbacks ya descartados.
      adder = null;
    }
  };
}
