const DEFAULT_CONFIG = Object.freeze({
  TIENDANUBE_ENABLED: false,
  TIENDANUBE_CART_TRANSFER_URL: '/api/tiendanube/cart-transfer',
  TIENDANUBE_TRANSFER_TIMEOUT_MS: 10000,
  TIENDANUBE_STOREFRONT_ORIGINS: [
    'https://primoffice2.mitiendanube.com',
    'https://primoffice.com.ar',
    'https://www.primoffice.com.ar'
  ]
});

let inFlight = null;

function runtimeConfig() {
  const runtime = typeof window !== 'undefined' && window.PrimOfficeConfig
    ? window.PrimOfficeConfig
    : {};
  return Object.assign({}, DEFAULT_CONFIG, runtime);
}

function originSet(config) {
  const values = Array.isArray(config.TIENDANUBE_STOREFRONT_ORIGINS)
    ? config.TIENDANUBE_STOREFRONT_ORIGINS
    : String(config.TIENDANUBE_STOREFRONT_ORIGINS || '').split(',');
  const origins = new Set();
  values.map((value) => String(value || '').trim()).filter(Boolean).forEach((value) => {
    try { origins.add(new URL(value).origin); } catch (_) {}
  });
  return origins;
}

export function isAllowedStorefrontUrl(value, config = runtimeConfig()) {
  try {
    const url = new URL(String(value || ''));
    const queryKeys = Array.from(url.searchParams.keys());
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.pathname === '/' && !url.hash && queryKeys.length === 1 &&
      queryKeys[0] === 'setupoficina_ticket' &&
      /^[A-Za-z0-9_-]{43}$/.test(String(url.searchParams.get('setupoficina_ticket') || '')) &&
      originSet(config).has(url.origin);
  } catch (_) {
    return false;
  }
}

export function normalizeTransferItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('No hay productos seleccionados.');
  const seen = new Set();
  return items.map((raw) => {
    const internalId = String(raw && raw.internalId || '').trim();
    const quantity = Number(raw && raw.quantity);
    if (!/^[a-z0-9_ñ-]{1,64}$/u.test(internalId)) throw new Error('La seleccion contiene un ID invalido.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('La seleccion contiene una cantidad invalida.');
    if (seen.has(internalId)) throw new Error('La seleccion contiene productos duplicados.');
    seen.add(internalId);
    return { internalId, quantity };
  });
}

export function createClientRequestId(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl || typeof cryptoImpl.randomUUID !== 'function') {
    throw new Error('El navegador no permite generar una solicitud segura.');
  }
  return cryptoImpl.randomUUID();
}

async function responseBody(response) {
  try { return await response.json(); }
  catch (_) { return {}; }
}

export async function prepareCartTransfer(items, options = {}) {
  const config = options.config || runtimeConfig();
  if (config.TIENDANUBE_ENABLED !== true) throw new Error('La compra online todavia no esta habilitada.');
  const normalized = normalizeTransferItems(items);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config.TIENDANUBE_TRANSFER_TIMEOUT_MS || 10000));

  try {
    const response = await (options.fetchImpl || fetch)(config.TIENDANUBE_CART_TRANSFER_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientRequestId: createClientRequestId(options.cryptoImpl || globalThis.crypto),
        items: normalized
      }),
      signal: controller.signal
    });
    const data = await responseBody(response);
    if (!response.ok || !data.ok) {
      throw new Error(String(data.message || 'No pudimos preparar el carrito de Tiendanube.'));
    }
    if (!isAllowedStorefrontUrl(data.redirectUrl, config)) {
      throw new Error('Tiendanube devolvio un destino no permitido.');
    }
    return data;
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('La preparacion del carrito excedio el tiempo de espera.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function transferButtons(documentImpl) {
  if (!documentImpl || typeof documentImpl.querySelectorAll !== 'function') return [];
  return Array.from(documentImpl.querySelectorAll('[data-tiendanube-transfer]'));
}

function setButtonsPending(documentImpl, pending, enabled = true) {
  transferButtons(documentImpl).forEach((button) => {
    button.disabled = pending || !enabled;
    if (pending) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
  });
}

function setBridgeOnlyVisibility(documentImpl, enabled) {
  if (!documentImpl || typeof documentImpl.querySelectorAll !== 'function') return;
  Array.from(documentImpl.querySelectorAll('[data-tiendanube-only]')).forEach((element) => {
    element.hidden = !enabled;
  });
}

function statusElement(documentImpl) {
  return documentImpl && typeof documentImpl.getElementById === 'function'
    ? documentImpl.getElementById('tiendanube-transfer-status')
    : null;
}

function showStatus(documentImpl, message, kind = 'info') {
  const element = statusElement(documentImpl);
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
  if (message) element.removeAttribute('hidden');
  else element.setAttribute('hidden', '');
}

function unavailableMessage(unavailable) {
  if (!Array.isArray(unavailable) || !unavailable.length) return 'Carrito preparado. Abriendo Tiendanube...';
  const names = unavailable.map((item) => String(item && (item.name || item.internalId) || '')).filter(Boolean);
  return `Abrimos Tiendanube. No se pudieron preparar: ${names.join(', ')}.`;
}

export function syncTiendanubeTransferUi(options = {}) {
  const documentImpl = options.documentImpl || (typeof document !== 'undefined' ? document : null);
  const config = options.config || runtimeConfig();
  const enabled = config.TIENDANUBE_ENABLED === true;
  setBridgeOnlyVisibility(documentImpl, enabled);
  setButtonsPending(documentImpl, false, true);
  if (!enabled) showStatus(documentImpl, '', 'info');
}

export function transferSelection(items, options = {}) {
  if (inFlight) return Promise.resolve({ ok: false, skipped: true, reason: 'in_flight' });
  const documentImpl = options.documentImpl || (typeof document !== 'undefined' ? document : null);
  const locationImpl = options.locationImpl || (typeof window !== 'undefined' ? window.location : null);
  const config = options.config || runtimeConfig();
  const enabled = config.TIENDANUBE_ENABLED === true;
  if (!enabled) {
    showStatus(documentImpl, '', 'info');
    setButtonsPending(documentImpl, false, true);
    return Promise.resolve({ ok: false, skipped: true, reason: 'disabled' });
  }

  setButtonsPending(documentImpl, true, true);
  showStatus(documentImpl, 'Validando productos y disponibilidad...', 'pending');
  let redirected = false;
  inFlight = prepareCartTransfer(items, { ...options, config })
    .then((result) => {
      showStatus(documentImpl, unavailableMessage(result.unavailable), result.unavailable && result.unavailable.length ? 'warning' : 'success');
      if (!locationImpl || typeof locationImpl.assign !== 'function') throw new Error('No se pudo abrir el carrito.');
      redirected = true;
      locationImpl.assign(result.redirectUrl);
      return result;
    })
    .catch((error) => {
      showStatus(documentImpl, String(error && error.message || 'No pudimos preparar el carrito.'), 'error');
      throw error;
    })
    .finally(() => {
      inFlight = null;
      if (!redirected) setButtonsPending(documentImpl, false, true);
    });
  return inFlight;
}

if (typeof window !== 'undefined') {
  window.PrimOfficeTiendanube = {
    prepareCartTransfer,
    transferSelection,
    syncTiendanubeTransferUi
  };
  syncTiendanubeTransferUi();
}

export default { prepareCartTransfer, transferSelection, syncTiendanubeTransferUi };
