const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @typedef {object} TransferItem
 * @property {string} internalId
 * @property {number} productId
 * @property {number} variantId
 * @property {number} quantity
 * @property {string} name
 */

/** @typedef {{ok: boolean, item: TransferItem, reason?: string}} AddResult */
/** @typedef {{item: TransferItem, resolve: (result: AddResult) => void, timer: any}} ActiveOperation */
/**
 * @typedef {object} AdderOptions
 * @property {number} [timeoutMs]
 * @property {(callback: () => void, timeout: number) => any} [setTimeoutImpl]
 * @property {(timer: any) => void} [clearTimeoutImpl]
 */

/** @param {unknown} payload */
function eventItem(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  return payload && typeof payload === 'object' ? payload : null;
}

/**
 * @param {any} nube
 * @param {AdderOptions} [options]
 */
export function createSequentialCartAdder(nube, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const setTimer = options.setTimeoutImpl || setTimeout;
  const clearTimer = options.clearTimeoutImpl || clearTimeout;
  /** @type {ActiveOperation | null} */
  let active = null;
  let sequence = Promise.resolve();

  /** @param {AddResult} result */
  function finish(result) {
    if (!active) return;
    const operation = active;
    active = null;
    clearTimer(operation.timer);
    operation.resolve(result);
  }

  /** @param {{eventPayload?: unknown}} state */
  function onSuccess(state) {
    if (!active) return;
    const item = eventItem(state && state.eventPayload);
    if (!item) return;
    if (Number(item.product_id) !== Number(active.item.productId)) return;
    if (Number(item.variant_id) !== Number(active.item.variantId)) return;
    finish({ ok: true, item: active.item });
  }

  function onFail() {
    if (!active) return;
    finish({ ok: false, item: active.item, reason: 'cart_add_failed' });
  }

  nube.on('cart:add:success', onSuccess);
  nube.on('cart:add:fail', onFail);

  /** @param {TransferItem} item @returns {Promise<AddResult>} */
  function addOne(item) {
    return new Promise((resolve) => {
      const timer = setTimer(() => {
        finish({ ok: false, item, reason: 'cart_add_timeout' });
      }, timeoutMs);
      active = { item, resolve, timer };
      try {
        nube.send('cart:add', () => ({
          cart: {
            items: [{
              product_id: item.productId,
              variant_id: item.variantId,
              quantity: item.quantity
            }]
          }
        }));
      } catch (_) {
        finish({ ok: false, item, reason: 'cart_add_failed' });
      }
    });
  }

  /** @param {TransferItem[]} items @returns {Promise<AddResult[]>} */
  async function runSequentially(items) {
    const results = [];
    for (const item of items) results.push(await addOne(item));
    return results;
  }

  /** @param {TransferItem[]} items @returns {Promise<AddResult[]>} */
  function addSequentially(items) {
    const operation = sequence.then(() => runSequentially(items));
    sequence = operation.then(() => undefined, () => undefined);
    return operation;
  }

  function dispose() {
    if (typeof nube.off === 'function') {
      nube.off('cart:add:success', onSuccess);
      nube.off('cart:add:fail', onFail);
    }
  }

  return { addSequentially, dispose };
}

/**
 * Evita registrar listeners de carrito en visitas que nunca reciben un ticket.
 * @param {any} nube
 * @param {AdderOptions} [options]
 */
export function createLazySequentialCartAdder(nube, options = {}) {
  /** @type {ReturnType<typeof createSequentialCartAdder> | null} */
  let adder = null;
  return {
    /** @param {TransferItem[]} items @returns {Promise<AddResult[]>} */
    addSequentially(items) {
      adder ||= createSequentialCartAdder(nube, options);
      return adder.addSequentially(items);
    },
    dispose() {
      adder?.dispose();
      adder = null;
    }
  };
}
