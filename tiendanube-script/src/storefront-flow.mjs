export const RESULT_STORAGE_KEY = 'setupoficina_cart_transfer_result';
export const RESULT_ROUTE = '/cart?setupoficina_result=1';
export const RESULT_TTL_SECONDS = 600;

const OUT_OF_STOCK_REASONS = new Set(['insufficient_stock', 'out_of_stock']);

/**
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

/** @param {ResultItem[]} items */
function names(items) {
  return items.map((item) => String(item && item.name || '')).filter(Boolean);
}

/**
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
  const added = Array.isArray(result && result.added) ? result.added : [];
  const allFailed = Array.isArray(result && result.failed) ? result.failed : [];
  const outOfStock = allFailed.filter((item) => OUT_OF_STOCK_REASONS.has(String(item && item.reason || '')));
  const failed = allFailed.filter((item) => !OUT_OF_STOCK_REASONS.has(String(item && item.reason || '')));
  const fatalError = String(result && result.fatalError || '').trim();
  return {
    addedNames: names(added),
    outOfStockNames: names(outOfStock),
    failedNames: names(failed),
    preservedMessage: 'Conservamos los productos que ya estaban en tu carrito.',
    syncWarning: String(result && result.syncWarning || '').trim(),
    fatalError,
    variant: fatalError ? 'error' : outOfStock.length || failed.length ? 'warning' : 'success'
  };
}

/** @param {BrowserAPIs} browser @param {StoredResult} result */
export async function persistResultAndNavigate(browser, result) {
  await browser.asyncSessionStorage.setItem(
    RESULT_STORAGE_KEY,
    JSON.stringify(result),
    RESULT_TTL_SECONDS
  );
  browser.navigate(RESULT_ROUTE);
}

function invalidStoredResult() {
  return {
    added: [],
    failed: [],
    completedAt: new Date().toISOString(),
    preservedExistingCart: true,
    fatalError: 'No pudimos recuperar el detalle de la transferencia.'
  };
}

/**
 * @param {BrowserAPIs} browser
 * @param {(result: StoredResult) => Promise<boolean>} renderResult
 */
export async function displayStoredResult(browser, renderResult) {
  const stored = await browser.asyncSessionStorage.getItem(RESULT_STORAGE_KEY);
  if (!stored) return false;

  let result;
  try {
    result = JSON.parse(stored);
    if (!result || typeof result !== 'object' || !Array.isArray(result.added) || !Array.isArray(result.failed)) {
      result = invalidStoredResult();
    }
  } catch (_) {
    result = invalidStoredResult();
  }

  const displayed = await renderResult(result);
  if (!displayed) return false;
  await browser.asyncSessionStorage.removeItem(RESULT_STORAGE_KEY);
  return true;
}

/** @param {FlowLocation | null | undefined} location */
export function isResultLocation(location) {
  if (!location || location.queries?.setupoficina_result !== '1') return false;
  try {
    return new URL(String(location.url)).pathname.replace(/\/+$/, '') === '/cart';
  } catch (_) {
    return false;
  }
}

/** @param {CoordinatorOptions} options */
export function createLocationCoordinator(options) {
  const processedTickets = new Set();
  let resultRouteActive = false;

  /** @param {FlowState} state */
  async function handle(state) {
    const ticket = String(state && state.location && state.location.queries?.setupoficina_ticket || '').trim();
    if (ticket) {
      resultRouteActive = false;
      if (processedTickets.has(ticket)) return;
      processedTickets.add(ticket);
      await options.transfer(ticket, String(state.store.id));
      return;
    }

    if (!isResultLocation(state && state.location)) {
      resultRouteActive = false;
      return;
    }
    if (resultRouteActive) return;
    resultRouteActive = true;
    try {
      const displayed = await options.displayResult();
      if (!displayed) resultRouteActive = false;
    } catch (error) {
      resultRouteActive = false;
      throw error;
    }
  }

  return { handle };
}
