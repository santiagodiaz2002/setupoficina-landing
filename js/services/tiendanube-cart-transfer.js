// GUÍA EDUCATIVA: servicio que valida la selección, solicita un ticket y redirige al storefront permitido.
// Index.html llama a la API global publicada aquí; este módulo no registra por sí mismo los clicks de compra.
// Declara referencias estables para DEFAULT_CONFIG; la inicialización aporta los datos que consumirá el bloque siguiente.
const DEFAULT_CONFIG = Object.freeze({
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_ENABLED: false,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_CART_TRANSFER_URL: '/api/tiendanube/cart-transfer',
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_TRANSFER_TIMEOUT_MS: 10000,
  // Define una entrada del objeto de configuración o estado que está construyéndose.
  TIENDANUBE_STOREFRONT_ORIGINS: [
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'https://primoffice2.mitiendanube.com',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'https://primoffice.com.ar',
    // Define una entrada del objeto de configuración o estado que está construyéndose.
    'https://www.primoffice.com.ar'
  ]
});

// Declara estado mutable para inFlight; la inicialización aporta los datos que consumirá el bloque siguiente.
let inFlight = null;

// Declara la función runtimeConfig; recibe ningún argumento y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function runtimeConfig() {
  // Declara referencias estables para runtime; la inicialización aporta los datos que consumirá el bloque siguiente.
  const runtime = typeof window !== 'undefined' && window.PrimOfficeConfig
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    ? window.PrimOfficeConfig
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    : {};
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return Object.assign({}, DEFAULT_CONFIG, runtime);
}

// Declara la función originSet; recibe config y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function originSet(config) {
  // Declara referencias estables para values; la inicialización aporta los datos que consumirá el bloque siguiente.
  const values = Array.isArray(config.TIENDANUBE_STOREFRONT_ORIGINS)
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    ? config.TIENDANUBE_STOREFRONT_ORIGINS
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    : String(config.TIENDANUBE_STOREFRONT_ORIGINS || '').split(',');
  // Declara referencias estables para origins; la inicialización aporta los datos que consumirá el bloque siguiente.
  const origins = new Set();
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  values.map((value) => String(value || '').trim()).filter(Boolean).forEach((value) => {
    // Inicia una operación protegida para poder recuperar un fallo previsto.
    try { origins.add(new URL(value).origin); } catch (_) {}
  });
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return origins;
}

// Declara y exporta la función isAllowedStorefrontUrl; recibe value, config = runtimeConfig( y entrega el valor determinado por sus retornos.
export function isAllowedStorefrontUrl(value, config = runtimeConfig()) {
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try {
    // Declara referencias estables para url; la inicialización aporta los datos que consumirá el bloque siguiente.
    const url = new URL(String(value || ''));
    // Declara referencias estables para queryKeys; la inicialización aporta los datos que consumirá el bloque siguiente.
    const queryKeys = Array.from(url.searchParams.keys());
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      url.pathname === '/' && !url.hash && queryKeys.length === 1 &&
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      queryKeys[0] === 'setupoficina_ticket' &&
      // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
      /^[A-Za-z0-9_-]{43}$/.test(String(url.searchParams.get('setupoficina_ticket') || '')) &&
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      originSet(config).has(url.origin);
  // Captura el error de la operación protegida y ejecuta la recuperación definida.
  } catch (_) {
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return false;
  }
}

// Declara y exporta la función normalizeTransferItems; recibe items y entrega el valor determinado por sus retornos.
export function normalizeTransferItems(items) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!Array.isArray(items) || !items.length) throw new Error('No hay productos seleccionados.');
  // Declara referencias estables para seen; la inicialización aporta los datos que consumirá el bloque siguiente.
  const seen = new Set();
  // Transforma cada elemento y construye una colección nueva con los valores devueltos.
  return items.map((raw) => {
    // Declara referencias estables para internalId; la inicialización aporta los datos que consumirá el bloque siguiente.
    const internalId = String(raw && raw.internalId || '').trim();
    // Declara referencias estables para quantity; la inicialización aporta los datos que consumirá el bloque siguiente.
    const quantity = Number(raw && raw.quantity);
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!/^[a-z0-9_ñ-]{1,64}$/u.test(internalId)) throw new Error('La seleccion contiene un ID invalido.');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('La seleccion contiene una cantidad invalida.');
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (seen.has(internalId)) throw new Error('La seleccion contiene productos duplicados.');
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    seen.add(internalId);
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return { internalId, quantity };
  });
}

// Declara y exporta la función createClientRequestId; recibe cryptoImpl = globalThis.crypto y entrega el valor determinado por sus retornos.
export function createClientRequestId(cryptoImpl = globalThis.crypto) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!cryptoImpl || typeof cryptoImpl.randomUUID !== 'function') {
    // Interrumpe el flujo normal y comunica el problema al manejador de errores superior.
    throw new Error('El navegador no permite generar una solicitud segura.');
  }
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return cryptoImpl.randomUUID();
}

// Declara la función responseBody; recibe response y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
async function responseBody(response) {
  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try { return await response.json(); }
  // Captura el error de la operación protegida y ejecuta la recuperación definida.
  catch (_) { return {}; }
}

// Declara y exporta la función prepareCartTransfer; recibe items, options = {} y entrega el valor determinado por sus retornos.
export async function prepareCartTransfer(items, options = {}) {
  // Declara referencias estables para config; la inicialización aporta los datos que consumirá el bloque siguiente.
  const config = options.config || runtimeConfig();
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (config.TIENDANUBE_ENABLED !== true) throw new Error('La compra online todavia no esta habilitada.');
  // Declara referencias estables para normalized; la inicialización aporta los datos que consumirá el bloque siguiente.
  const normalized = normalizeTransferItems(items);
  // Declara referencias estables para controller; la inicialización aporta los datos que consumirá el bloque siguiente.
  const controller = new AbortController();
  // Declara referencias estables para timeout; la inicialización aporta los datos que consumirá el bloque siguiente.
  const timeout = setTimeout(() => controller.abort(), Number(config.TIENDANUBE_TRANSFER_TIMEOUT_MS || 10000));

  // Inicia una operación protegida para poder recuperar un fallo previsto.
  try {
    // Declara referencias estables para response; la inicialización aporta los datos que consumirá el bloque siguiente.
    const response = await (options.fetchImpl || fetch)(config.TIENDANUBE_CART_TRANSFER_URL, {
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      method: 'POST',
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      headers: {
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        Accept: 'application/json',
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        'Content-Type': 'application/json'
      },
      // Convierte entre objetos y texto JSON para transportar o persistir una copia independiente.
      body: JSON.stringify({
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        clientRequestId: createClientRequestId(options.cryptoImpl || globalThis.crypto),
        // Define una entrada del objeto de configuración o estado que está construyéndose.
        items: normalized
      }),
      // Define una entrada del objeto de configuración o estado que está construyéndose.
      signal: controller.signal
    });
    // Declara referencias estables para data; la inicialización aporta los datos que consumirá el bloque siguiente.
    const data = await responseBody(response);
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!response.ok || !data.ok) {
      // Interrumpe el flujo normal y comunica el problema al manejador de errores superior.
      throw new Error(String(data.message || 'No pudimos preparar el carrito de Tiendanube.'));
    }
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (!isAllowedStorefrontUrl(data.redirectUrl, config)) {
      // Interrumpe el flujo normal y comunica el problema al manejador de errores superior.
      throw new Error('Tiendanube devolvio un destino no permitido.');
    }
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return data;
  // Captura el error de la operación protegida y ejecuta la recuperación definida.
  } catch (error) {
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (error && error.name === 'AbortError') throw new Error('La preparacion del carrito excedio el tiempo de espera.');
    // Interrumpe el flujo normal y comunica el problema al manejador de errores superior.
    throw error;
  // Ejecuta la limpieza final tanto si la operación tuvo éxito como si falló.
  } finally {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    clearTimeout(timeout);
  }
}

// Declara la función transferButtons; recibe documentImpl y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function transferButtons(documentImpl) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!documentImpl || typeof documentImpl.querySelectorAll !== 'function') return [];
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return Array.from(documentImpl.querySelectorAll('[data-tiendanube-transfer]'));
}

// Declara la función setButtonsPending; recibe documentImpl, pending, enabled = true y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function setButtonsPending(documentImpl, pending, enabled = true) {
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  transferButtons(documentImpl).forEach((button) => {
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    button.disabled = pending || !enabled;
    // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
    if (pending) button.setAttribute('aria-busy', 'true');
    // Define la alternativa que se ejecuta cuando la condición previa resulta falsa.
    else button.removeAttribute('aria-busy');
  });
}

// Declara la función setBridgeOnlyVisibility; recibe documentImpl, enabled y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function setBridgeOnlyVisibility(documentImpl, enabled) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!documentImpl || typeof documentImpl.querySelectorAll !== 'function') return;
  // Recorre la colección y ejecuta el callback una vez por elemento, sin crear por sí mismo otra colección.
  Array.from(documentImpl.querySelectorAll('[data-tiendanube-only]')).forEach((element) => {
    // Actualiza el estado con el valor calculado a la derecha de la asignación.
    element.hidden = !enabled;
  });
}

// Declara la función statusElement; recibe documentImpl y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function statusElement(documentImpl) {
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return documentImpl && typeof documentImpl.getElementById === 'function'
    // Localiza el nodo requerido en el DOM; las operaciones posteriores verifican o dependen de su existencia.
    ? documentImpl.getElementById('tiendanube-transfer-status')
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    : null;
}

// Declara la función showStatus; recibe documentImpl, message, kind = 'info' y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function showStatus(documentImpl, message, kind = 'info') {
  // Declara referencias estables para element; la inicialización aporta los datos que consumirá el bloque siguiente.
  const element = statusElement(documentImpl);
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!element) return;
  // Actualiza el contenido visible con datos derivados del estado actual.
  element.textContent = message;
  // Sincroniza atributos del DOM para accesibilidad, estilos o comunicación con otros manejadores.
  element.dataset.kind = kind;
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (message) element.removeAttribute('hidden');
  // Define la alternativa que se ejecuta cuando la condición previa resulta falsa.
  else element.setAttribute('hidden', '');
}

// Declara la función unavailableMessage; recibe unavailable y devuelve el resultado de sus retornos o sólo produce efectos cuando no hay retorno explícito.
function unavailableMessage(unavailable) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!Array.isArray(unavailable) || !unavailable.length) return 'Carrito preparado. Abriendo Tiendanube...';
  // Declara referencias estables para names; la inicialización aporta los datos que consumirá el bloque siguiente.
  const names = unavailable.map((item) => String(item && (item.name || item.internalId) || '')).filter(Boolean);
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return `Abrimos Tiendanube. No se pudieron preparar: ${names.join(', ')}.`;
}

// Declara y exporta la función syncTiendanubeTransferUi; recibe options = {} y entrega el valor determinado por sus retornos.
export function syncTiendanubeTransferUi(options = {}) {
  // Declara referencias estables para documentImpl; la inicialización aporta los datos que consumirá el bloque siguiente.
  const documentImpl = options.documentImpl || (typeof document !== 'undefined' ? document : null);
  // Declara referencias estables para config; la inicialización aporta los datos que consumirá el bloque siguiente.
  const config = options.config || runtimeConfig();
  // Declara referencias estables para enabled; la inicialización aporta los datos que consumirá el bloque siguiente.
  const enabled = config.TIENDANUBE_ENABLED === true;
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  setBridgeOnlyVisibility(documentImpl, enabled);
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  setButtonsPending(documentImpl, false, true);
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!enabled) showStatus(documentImpl, '', 'info');
}

// Declara y exporta la función transferSelection; recibe items, options = {} y entrega el valor determinado por sus retornos.
export function transferSelection(items, options = {}) {
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (inFlight) return Promise.resolve({ ok: false, skipped: true, reason: 'in_flight' });
  // Declara referencias estables para documentImpl; la inicialización aporta los datos que consumirá el bloque siguiente.
  const documentImpl = options.documentImpl || (typeof document !== 'undefined' ? document : null);
  // Declara referencias estables para locationImpl; la inicialización aporta los datos que consumirá el bloque siguiente.
  const locationImpl = options.locationImpl || (typeof window !== 'undefined' ? window.location : null);
  // Declara referencias estables para config; la inicialización aporta los datos que consumirá el bloque siguiente.
  const config = options.config || runtimeConfig();
  // Declara referencias estables para enabled; la inicialización aporta los datos que consumirá el bloque siguiente.
  const enabled = config.TIENDANUBE_ENABLED === true;
  // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
  if (!enabled) {
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    showStatus(documentImpl, '', 'info');
    // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
    setButtonsPending(documentImpl, false, true);
    // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
    return Promise.resolve({ ok: false, skipped: true, reason: 'disabled' });
  }

  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  setButtonsPending(documentImpl, true, true);
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  showStatus(documentImpl, 'Validando productos y disponibilidad...', 'pending');
  // Declara estado mutable para redirected; la inicialización aporta los datos que consumirá el bloque siguiente.
  let redirected = false;
  // Actualiza el estado con el valor calculado a la derecha de la asignación.
  inFlight = prepareCartTransfer(items, { ...options, config })
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    .then((result) => {
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      showStatus(documentImpl, unavailableMessage(result.unavailable), result.unavailable && result.unavailable.length ? 'warning' : 'success');
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (!locationImpl || typeof locationImpl.assign !== 'function') throw new Error('No se pudo abrir el carrito.');
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      redirected = true;
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      locationImpl.assign(result.redirectUrl);
      // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
      return result;
    })
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    .catch((error) => {
      // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
      showStatus(documentImpl, String(error && error.message || 'No pudimos preparar el carrito.'), 'error');
      // Interrumpe el flujo normal y comunica el problema al manejador de errores superior.
      throw error;
    })
    // Esta sentencia aporta un valor o completa la actualización del bloque lógico actual.
    .finally(() => {
      // Actualiza el estado con el valor calculado a la derecha de la asignación.
      inFlight = null;
      // Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
      if (!redirected) setButtonsPending(documentImpl, false, true);
    });
  // Devuelve este resultado al llamador y finaliza la ejecución de la función actual.
  return inFlight;
}

// Evalúa la condición y ejecuta la rama siguiente únicamente cuando el resultado es verdadero.
if (typeof window !== 'undefined') {
  // Publica una API controlada en el ámbito global para que el script inline pueda consumirla.
  window.PrimOfficeTiendanube = {
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    prepareCartTransfer,
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    transferSelection,
    // Incorpora este símbolo a la declaración multilineal que lo contiene.
    syncTiendanubeTransferUi
  };
  // Ejecuta la operación indicada; sus efectos o retorno alimentan el flujo posterior.
  syncTiendanubeTransferUi();
}

// Publica la API principal como exportación predeterminada para consumidores que prefieren un único objeto.
export default { prepareCartTransfer, transferSelection, syncTiendanubeTransferUi };
