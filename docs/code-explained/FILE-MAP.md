# Mapa de archivos fuente

## Cómo leer este mapa

**HECHO VERIFICADO:** las 52 secciones siguientes corresponden exactamente a los 52 resultados del filtro documentado en [INVENTORY.md](./INVENTORY.md). “Depende de” solo nombra imports, cargas, estructuras o contratos comprobados. “Utilizado por” distingue importación directa de dependencia conceptual (por ejemplo, una Function que presupone una tabla SQL).

**INFORMACIÓN NO IDENTIFICADA:** una ruta/configuración local no prueba que exista un despliegue activo. Cuando no hay cargador, importador o comando versionado, se indica expresamente.

## `css/comparacion-antes-despues.css`

- **Responsabilidad:** define la geometría, recorte por `--ba-position`, divisor, manija, etiquetas, foco y pista visual del comparador antes/después.
- **Depende de:** clases y atributos que crea el bloque `.ba-compare` de `index.html` y actualiza `js/comparacion-antes-despues.js` (`aria-valuenow`, `data-position-low/high`).
- **Utilizado por:** `index.html`, mediante `<link rel="stylesheet">`.
- **Entradas:** estructura HTML, variable CSS `--ba-position` y atributos de estado.
- **Salidas:** recorte visual de las dos imágenes, posición del divisor y estilos accesibles de foco/estado.
- **Funciones principales:** no aplica; bloques clave `.ba-compare`, `.ba-img--antes`, `.ba-divider`, `.ba-handle`, `.ba-label`.

## `css/integracion-canonica.css`

- **Responsabilidad:** estiliza teaser, formulario de contacto, elección de canal, errores, consentimiento, botones y paneles `pq-*` del flujo de lead.
- **Depende de:** markup `pq-*` de `index.html`, atributos `hidden`/`aria-invalid` y variables CSS globales con fallbacks.
- **Utilizado por:** `index.html`.
- **Entradas:** clases `pq-*`, estados de validación y tamaño de viewport.
- **Salidas:** layout responsive, estados visibles/ocultos, foco, error y animación del indicador de envío.
- **Funciones principales:** no aplica; bloques clave `.pq-panel`, `.pq-card`, `.pq-teaser__grid`, `.pq-input`, `.pq-channel`, `.pq-error`, `.pq-submit` y sus media queries.

## `css/pulido-visual.css`

- **Responsabilidad:** aplica el fondo global oscuro, posiciona el canvas decorativo y define estados de aparición progresiva.
- **Depende de:** `#pv-bg`/`#pv-canvas` inyectados por `js/pulido-visual.js` y clases dinámicas `.pv-rv`/`.pv-in`.
- **Utilizado por:** `index.html`.
- **Entradas:** DOM inyectado, clases de reveal, `prefers-reduced-motion` y breakpoints.
- **Salidas:** fondo visual, transparencia de secciones y transiciones de entrada.
- **Funciones principales:** no aplica; bloques clave `html`, `#pv-bg`, `#pv-canvas`, `.pv-rv` y variantes.

## `css/setup-visual-hybrid.css`

- **Responsabilidad:** presenta el compositor fotográfico por capas, rail de productos, comparador, feedback, preset buttons y panel temporal de calibración.
- **Depende de:** DOM de `index.html` y elementos/clases/atributos generados o alternados por `js/setup-visual-hybrid.js` y `js/setup-visual-calibration.js`.
- **Utilizado por:** `index.html` con query de versión `layout-by-desk-2`.
- **Entradas:** clases `.is-included`, `.is-focused`, `.is-calibrating`, `.is-calibration-selected`, `hidden`, `aria-pressed`, `data-kind` y viewport.
- **Salidas:** apilado/posicionamiento de escena, estados interactivos, panel adaptable y estilos responsive/reduced-motion.
- **Funciones principales:** no aplica; bloques clave `.setup-visual`, `.setup-scene`, `.setup-product-bar`, `.setup-product-chip`, `.setup-calibration-panel`.

## `db/migrations/0001_tiendanube_cart_bridge.sql`

- **Responsabilidad:** crea sin alterar `leads` las cinco tablas D1 del puente: catálogo, transferencias, rate limits, estados OAuth e instalaciones.
- **Depende de:** SQLite/D1 (`json_valid`, `unixepoch`, constraints e índices); no importa otro archivo.
- **Utilizado por:** `transfers.mjs`, `rate-limit.mjs`, `oauth.mjs`, `installations.mjs`, `privacy.mjs`, la herramienta de catálogo y pruebas que ejecutan/inspeccionan la migración.
- **Entradas:** ejecución SQL sobre una base D1/SQLite.
- **Salidas:** tablas `tiendanube_catalog`, `tiendanube_cart_transfers`, `tiendanube_rate_limits`, `tiendanube_oauth_states`, `tiendanube_installations` e índices asociados.
- **Funciones principales:** no aplica; operaciones principales `CREATE TABLE IF NOT EXISTS`, `CHECK`, claves únicas e índices de consulta/expiración.

## `db/schema_leads.sql`

- **Responsabilidad:** define la tabla `leads`, campos normalizados, JSON/payload, metadatos de request y estado de sincronización Odoo.
- **Depende de:** SQLite/D1; no hay importador/migrador versionado que lo ejecute automáticamente.
- **Utilizado por:** `functions/api/leads.js` depende conceptualmente de estas columnas para `INSERT`, `SELECT` y `UPDATE`.
- **Entradas:** ejecución SQL en una base nueva.
- **Salidas:** tabla `leads` e índices por fecha, ID de lead, contacto e ID Odoo.
- **Funciones principales:** no aplica; `CREATE TABLE IF NOT EXISTS leads` y cinco `CREATE INDEX`.

## `functions/_lib/tiendanube/client.mjs`

- **Responsabilidad:** encapsula llamadas a la API Tiendanube 2025-03, límites de respuesta, timeout, reintentos seguros, errores tipados y normalización de productos/variantes.
- **Depende de:** `installations.mjs` para obtener el token por entorno; APIs estándar `fetch`, `AbortController`, `Response`.
- **Utilizado por:** `oauth.mjs`, `transfers.mjs`, `tools/tiendanube-sync-catalog.mjs`, `tests/tiendanube-client.test.mjs` y pruebas OAuth/transfer.
- **Entradas:** `env`, store ID, token, User-Agent, rutas/requests de API, respuestas JSON de Tiendanube.
- **Salidas:** resultados JSON acotados o `TiendanubeApiError`; valores normalizados de texto, stock, precio y etiqueta de variante.
- **Funciones principales:** `TiendanubeClient.request/getProduct/listProducts/getStore`, `clientFromEnv`, `readBoundedResponseText`, `apiBaseFromEnv`, `availableStock`, `currentPrice`, `localizedText`, `variantLabel`.

## `functions/_lib/tiendanube/http.mjs`

- **Responsabilidad:** centraliza errores HTTP, allowlists CORS, respuestas JSON/options y validación estructural de cuerpos.
- **Depende de:** APIs estándar `Request`/`Response`; variables de entorno de orígenes.
- **Utilizado por:** `installations.mjs`, `oauth-config.mjs`, `oauth.mjs`, `privacy.mjs`, `rate-limit.mjs`, `scopes.mjs`, `security.mjs`, `token-crypto.mjs` y `transfers.mjs`.
- **Entradas:** request, env/listas de origen, datos/status/headers, error y body JSON.
- **Salidas:** `Response` con CORS/JSON, `HttpError` normalizado o objetos validados.
- **Funciones principales:** `HttpError`, `parseOriginList`, `setupOrigins`, `storefrontOrigins`, `assertAllowedOrigin`, `corsHeaders`, `jsonResponse`, `errorResponse`, `optionsResponse`, `readJsonBody`, `assertPlainObject`, `assertOnlyKeys`.

## `functions/_lib/tiendanube/installations.mjs`

- **Responsabilidad:** carga/guarda instalaciones OAuth en D1, cifra tokens, valida scopes y decide cómo obtener un access token según entorno.
- **Depende de:** `http.mjs`, `oauth-config.mjs`, `scopes.mjs`, `token-crypto.mjs` y binding `LEADS_DB`.
- **Utilizado por:** `client.mjs`, `oauth.mjs`, `privacy.mjs` y `tests/tiendanube-oauth.test.mjs`.
- **Entradas:** env, store ID, dominio, token/scopes obtenidos por OAuth y registro D1.
- **Salidas:** instalación activa, estado público sin secreto, fila cifrada persistida o token descifrado; errores tipados si falta configuración.
- **Funciones principales:** `optionalConfiguredStoreId`, `configuredStoreId`, `hasAnyActiveInstallation`, `loadActiveInstallation`, `saveInstallation`, `accessTokenForEnvironment`, `installationPublicStatus`.

## `functions/_lib/tiendanube/oauth-config.mjs`

- **Responsabilidad:** valida entorno, app ID, callback/origen y dominios permitidos para OAuth.
- **Depende de:** `HttpError` de `http.mjs` y variables `TIENDANUBE_*`.
- **Utilizado por:** `installations.mjs`, `oauth.mjs` y pruebas OAuth.
- **Entradas:** env, request/callback URL y dominio de tienda.
- **Salidas:** configuración normalizada o error ante desvíos de origen, ruta, app ID/dominio.
- **Funciones principales:** `configuredTiendanubeEnvironment`, `oauthRedirectConfig`, `assertConfiguredOAuthRequest`, `configuredAppId`, `expectedStoreDomains`, `normalizeStoreDomain`, `isPreviewOAuthEnvironment`.

## `functions/_lib/tiendanube/oauth.mjs`

- **Responsabilidad:** implementa inicio, callback y consulta de estado OAuth con state hasheado/consumible, cookie segura, intercambio de código, validación de tienda/scopes y persistencia cifrada.
- **Depende de:** `client.mjs`, `http.mjs`, `installations.mjs`, `oauth-config.mjs`, `rate-limit.mjs`, `scopes.mjs`, `security.mjs`, D1 y endpoints externos de autorización/token/API Tiendanube.
- **Utilizado por:** wrappers `functions/api/tiendanube/oauth/{start,callback,status}.js` y `tests/tiendanube-oauth.test.mjs`.
- **Entradas:** GET request, query `state`/`code`, cookie, env/secreto/binding y respuestas de Tiendanube.
- **Salidas:** redirect/cookie al iniciar, HTML de éxito/error en callback, JSON de estado público y filas OAuth/instalación actualizadas.
- **Funciones principales:** `handleOAuthStart`, `handleOAuthCallback`, `handleOAuthStatus`; helpers de state (`insertOAuthState`, `consumeOAuthState`, `associateOAuthState`) e intercambio/validación.

## `functions/_lib/tiendanube/privacy.mjs`

- **Responsabilidad:** verifica y procesa webhooks de privacidad `store-redact`, `customers-redact` y `customers-data-request`.
- **Depende de:** `http.mjs`, `rate-limit.mjs`, `installations.mjs`, `security.mjs`, `LEADS_DB` y `TIENDANUBE_CLIENT_SECRET`.
- **Utilizado por:** tres wrappers en `functions/api/tiendanube/privacy/` y `tests/tiendanube-transfer.test.mjs`.
- **Entradas:** POST con cuerpo crudo JSON, header HMAC, tipo de webhook y entorno.
- **Salidas:** para store redact elimina datos del puente de esa tienda; para endpoints de cliente informa que no se almacena información de cliente; devuelve JSON/error con rate limit.
- **Funciones principales:** `handlePrivacyWebhook`, `rawWebhookBody`, `parseWebhookJson`, `deleteStoreData`.

## `functions/_lib/tiendanube/rate-limit.mjs`

- **Responsabilidad:** deriva una identidad hasheada de request y mantiene contadores por ruta/ventana en D1.
- **Depende de:** `HttpError` (`http.mjs`), `sha256Hex` (`security.mjs`) y tabla `tiendanube_rate_limits`.
- **Utilizado por:** `oauth.mjs`, `privacy.mjs`, `transfers.mjs` y pruebas de transferencia.
- **Entradas:** DB, request, nombre de ruta, límite, ventana y tiempo opcional de prueba.
- **Salidas:** contador persistido/permitido o `HttpError` 429 con información de reintento.
- **Funciones principales:** `rateLimitIdentity`, `enforceRateLimit`.

## `functions/_lib/tiendanube/scopes.mjs`

- **Responsabilidad:** declara los scopes mínimos `read_products`/`write_scripts` y valida que el conjunto concedido sea exactamente compatible.
- **Depende de:** `HttpError` de `http.mjs`.
- **Utilizado por:** `installations.mjs`, `oauth.mjs` y pruebas OAuth.
- **Entradas:** scopes como texto/array.
- **Salidas:** array normalizado y validado, etiqueta legible o error de scopes.
- **Funciones principales:** `validateGrantedScopes`, `requiredScopesLabel`; constante `REQUIRED_TIENDANUBE_SCOPES`.

## `functions/_lib/tiendanube/security.mjs`

- **Responsabilidad:** ofrece conversiones hex, comparación temporal constante, SHA-256, tickets aleatorios, HMAC de webhooks y validaciones que impiden confiar en campos comerciales del cliente.
- **Depende de:** `HttpError` y Web Crypto (`crypto.subtle`, `getRandomValues`).
- **Utilizado por:** `oauth.mjs`, `privacy.mjs`, `rate-limit.mjs`, `transfers.mjs` y pruebas.
- **Entradas:** bytes/texto, firmas/secretos, payload arbitrario, ticket y env.
- **Salidas:** hash/firma validada/ticket o errores ante formato/campos prohibidos; booleano del feature flag.
- **Funciones principales:** `bytesToHex`, `hexToBytes`, `timingSafeEqual`, `sha256Hex`, `randomTicket`, `verifyWebhookHmac`, `assertNoCommerceFields`, `assertTicket`, `isFeatureEnabled`.

## `functions/_lib/tiendanube/token-crypto.mjs`

- **Responsabilidad:** cifra y descifra access tokens con AES-256-GCM, clave base64 de 32 bytes, IV aleatorio y store ID como datos autenticados adicionales.
- **Depende de:** `HttpError`, Web Crypto y `TIENDANUBE_TOKEN_ENCRYPTION_KEY` suministrada por su consumidor.
- **Utilizado por:** `installations.mjs` y `tests/tiendanube-oauth.test.mjs`.
- **Entradas:** token, clave codificada, store ID, o fila D1 cifrada.
- **Salidas:** `{ encryptedAccessToken, encryptionIv }`, token plano en memoria al descifrar o error seguro.
- **Funciones principales:** `decodeEncryptionKey`, `encryptAccessToken`, `decryptAccessToken`.

## `functions/_lib/tiendanube/transfers.mjs`

- **Responsabilidad:** implementa el ciclo de transferencia: preparar catálogo/ticket, consumirlo una vez con lease, completar resultado exacto y responder preflight según origen.
- **Depende de:** `http.mjs`, `security.mjs`, `rate-limit.mjs`, `client.mjs`, D1 y configuración Tiendanube.
- **Utilizado por:** wrappers `cart-transfer.js`, `cart-transfer/consume.js`, `cart-transfer/complete.js` y `tests/tiendanube-transfer.test.mjs`.
- **Entradas:** selección `{clientRequestId, items[{internalId,quantity}]}`, ticket/store ID, resultado de completion, request/origin y env.
- **Salidas:** ticket/redirección y no disponibles; items resueltos más processing token; estado completed; respuestas CORS/error y mutaciones atómicas en D1.
- **Funciones principales:** `normalizeSelectionPayload`, `resolveCatalogSelection`, `buildStorefrontRedirect`, `handleCartTransfer`, `handleCartTransferConsume`, `handleCartTransferComplete`, `handleCartTransferOptions`.

## `functions/api/leads.js`

- **Responsabilidad:** endpoint Pages `/api/leads`; valida/normaliza leads, persiste D1 y crea/actualiza oportunidades Odoo por XML-RPC cuando está habilitado/configurado.
- **Depende de:** binding `LEADS_DB`; variables `ODOO_ENABLED`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`; `fetch` hacia `/xmlrpc/2/common` y `/xmlrpc/2/object`. No importa módulos locales.
- **Utilizado por:** `js/services/leads-service.js` (POST/PATCH), el flujo inline de `index.html` y `tests/leads-defensive.test.mjs`; Cloudflare Pages invoca exports por método.
- **Entradas:** GET/OPTIONS o JSON POST/PATCH con contacto, diagnóstico, configuración, productos, UTM y `leadId` para actualizar.
- **Salidas:** status GET; filas `leads`; resultado 201/200 o errores 4xx/5xx; sincronización/estado Odoo sin hacer fallar el lead ya guardado.
- **Funciones principales:** `onRequestOptions`, `onRequestGet`, `onRequestPost`, `onRequestPatch`, `normalizeLeadPayload`, `validatePayload`, `sendToOdoo`, `updateOdooLead`, `xmlRpcCall`, helpers de XML/tags/lead.

## `functions/api/tiendanube/cart-transfer.js`

- **Responsabilidad:** adaptador de ruta `/api/tiendanube/cart-transfer` para preparar transferencias desde la landing.
- **Depende de:** `handleCartTransfer` y `handleCartTransferOptions` de `functions/_lib/tiendanube/transfers.mjs`.
- **Utilizado por:** Pages routing; el consumidor HTTP comprobado es `js/services/tiendanube-cart-transfer.js`.
- **Entradas:** contexto Pages POST u OPTIONS.
- **Salidas:** retorna sin alterar la `Response` del servicio; OPTIONS usa scope CORS `setup`.
- **Funciones principales:** `onRequestPost`, `onRequestOptions`.

## `functions/api/tiendanube/cart-transfer/complete.js`

- **Responsabilidad:** adaptador `/api/tiendanube/cart-transfer/complete` que confirma el resultado de una transferencia procesada.
- **Depende de:** `handleCartTransferComplete` y `handleCartTransferOptions` de `transfers.mjs`.
- **Utilizado por:** Pages routing; `tiendanube-script/src/main.tsx` hace el POST de confirmación.
- **Entradas:** contexto POST/OPTIONS con ticket, processing token, store ID y resultado.
- **Salidas:** `Response` del servicio; OPTIONS usa scope `storefront`.
- **Funciones principales:** `onRequestPost`, `onRequestOptions`.

## `functions/api/tiendanube/cart-transfer/consume.js`

- **Responsabilidad:** adaptador `/api/tiendanube/cart-transfer/consume` para adquirir el ticket desde el storefront.
- **Depende de:** `handleCartTransferConsume` y `handleCartTransferOptions` de `transfers.mjs`.
- **Utilizado por:** Pages routing; `tiendanube-script/src/main.tsx` hace el POST de consumo.
- **Entradas:** contexto POST/OPTIONS con ticket y store ID.
- **Salidas:** items autorizados, no disponibles y processing token a través del servicio; OPTIONS `storefront`.
- **Funciones principales:** `onRequestPost`, `onRequestOptions`.

## `functions/api/tiendanube/oauth/callback.js`

- **Responsabilidad:** adaptador GET `/api/tiendanube/oauth/callback`.
- **Depende de:** `handleOAuthCallback` de `functions/_lib/tiendanube/oauth.mjs`.
- **Utilizado por:** Pages routing y URL de callback declarada/validada por configuración OAuth.
- **Entradas:** contexto Pages con query/cookie/env.
- **Salidas:** HTML/estado/cookie devueltos por el handler.
- **Funciones principales:** `onRequestGet`.

## `functions/api/tiendanube/oauth/start.js`

- **Responsabilidad:** adaptador GET `/api/tiendanube/oauth/start`.
- **Depende de:** `handleOAuthStart` de `oauth.mjs`.
- **Utilizado por:** Pages routing. **INFORMACIÓN NO IDENTIFICADA:** no se encontró un consumidor frontend versionado que enlace esta ruta.
- **Entradas:** contexto Pages con request/env.
- **Salidas:** redirección OAuth y cookie/state a través del handler.
- **Funciones principales:** `onRequestGet`.

## `functions/api/tiendanube/oauth/status.js`

- **Responsabilidad:** adaptador GET `/api/tiendanube/oauth/status`.
- **Depende de:** `handleOAuthStatus` de `oauth.mjs`.
- **Utilizado por:** Pages routing. **INFORMACIÓN NO IDENTIFICADA:** no se encontró consumidor frontend versionado.
- **Entradas:** contexto Pages.
- **Salidas:** JSON público de configuración/instalación, sin token.
- **Funciones principales:** `onRequestGet`.

## `functions/api/tiendanube/privacy/customers-data-request.js`

- **Responsabilidad:** adaptador POST de privacidad `customers-data-request`.
- **Depende de:** `handlePrivacyWebhook` de `privacy.mjs` con tipo literal `customers-data-request`.
- **Utilizado por:** Pages routing/webhook externo; pruebas verifican contrato. **INFORMACIÓN NO IDENTIFICADA:** no hay registro local de webhooks externos activos.
- **Entradas:** contexto POST firmado.
- **Salidas:** respuesta del handler indicando que el puente no guarda datos de cliente.
- **Funciones principales:** `onRequestPost`.

## `functions/api/tiendanube/privacy/customers-redact.js`

- **Responsabilidad:** adaptador POST de privacidad `customers-redact`.
- **Depende de:** `handlePrivacyWebhook` con tipo `customers-redact`.
- **Utilizado por:** Pages routing/webhook externo y pruebas.
- **Entradas:** contexto POST firmado.
- **Salidas:** respuesta idempotente del handler; el modelo local no guarda PII de cliente para borrar.
- **Funciones principales:** `onRequestPost`.

## `functions/api/tiendanube/privacy/store-redact.js`

- **Responsabilidad:** adaptador POST de privacidad `store-redact`.
- **Depende de:** `handlePrivacyWebhook` con tipo `store-redact`.
- **Utilizado por:** Pages routing/webhook externo y pruebas.
- **Entradas:** contexto POST firmado con store ID.
- **Salidas:** eliminación idempotente de catálogo, transferencias, instalación y estados de esa tienda (además de states vencidos), más rate limits cuyas rutas empiezan con `tiendanube:`; devuelve respuesta JSON.
- **Funciones principales:** `onRequestPost`.

## `index.html`

- **Responsabilidad:** es la entrada estática de la landing: contiene metadatos, estructura visual, preguntas, formulario, resultados, catálogo/presets y la mayor parte de la lógica comercial inline.
- **Depende de:** los 4 CSS; scripts clásicos `pulido-visual.js` y `comparacion-antes-despues.js`; módulos `app-config.js`, `leads-service.js`, `tiendanube-cart-transfer.js`, `setup-visual-hybrid.js`; imágenes/fuentes remotas y APIs del navegador.
- **Utilizado por:** el navegador al solicitar `/`; pruebas de frontend, leads y mapeo visual leen/extractan sus contratos.
- **Entradas:** clicks/respuestas del quiz, formulario/contacto, URL/UTM, storage, selección de productos/presets y estado expuesto por módulos globales.
- **Salidas:** DOM actualizado, diagnóstico/radar, carrito/configuración, payload de lead, POST/PATCH vía servicio, mensajes/links WhatsApp, transferencia Tiendanube y `window.PrimOfficeHybridBridge`.
- **Funciones principales:** `renderQ`, `buildCart`, `renderCart`, `updateProductSelections`, `applyComboPreset`, `showResult`, familia `radar*`, `pqPayload`, `pqSubmit`, `submitLeadUpdate`, `sendWhatsApp`, `buyComboInPrimOffice`, `startTiendanubeCartTransfer`.

## `js/comparacion-antes-despues.js`

- **Responsabilidad:** inicializa cada `.ba-compare`, mueve el divisor por pointer/teclado y ejecuta una animación inicial cuando entra en viewport.
- **Depende de:** DOM/clases del comparador, CSS asociado, `IntersectionObserver`, Pointer Events, `requestAnimationFrame` y media query reduced-motion.
- **Utilizado por:** `index.html` como script clásico `defer`.
- **Entradas:** pointerdown/move/up/cancel, teclas Arrow/Home/End, visibilidad y dimensiones del elemento.
- **Salidas:** `--ba-position`, `aria-valuenow`, flags `data-position-low/high`, captura de puntero y animación.
- **Funciones principales:** IIFE por comparador; `clamp`, `set`, `fromPointer`, `down`, `move`, `up`, `animate`.

## `js/config/app-config.js`

- **Responsabilidad:** concentra configuración pública de landing/leads/WhatsApp/puente y la publica como `window.PrimOfficeConfig`.
- **Depende de:** `window` cuando existe; no importa otros módulos.
- **Utilizado por:** `index.html`; `leads-service.js`, `tiendanube-cart-transfer.js` y lógica inline leen `window.PrimOfficeConfig`.
- **Entradas:** configuración previa opcional en `window.PrimOfficeConfig`.
- **Salidas:** export nombrado/default `APP_CONFIG` y objeto global fusionado; no contiene secretos reales.
- **Funciones principales:** no declara funciones públicas; bloque de fusión `Object.assign` y constante `APP_CONFIG`.

## `js/pulido-visual.js`

- **Responsabilidad:** inyecta un canvas decorativo, dibuja partículas/conexiones adaptadas a fondo/scroll y agrega reveal progresivo a elementos seleccionados.
- **Depende de:** Canvas 2D, DOM, `requestAnimationFrame`, `IntersectionObserver`, resize/scroll, media queries de movimiento y `css/pulido-visual.css`.
- **Utilizado por:** `index.html` como script clásico `defer`.
- **Entradas:** tamaño/pixel ratio, tiempo, scroll, posición de secciones oscuras y visibilidad de elementos.
- **Salidas:** `#pv-bg/#pv-canvas`, frames decorativos, clases `.pv-rv`/`.pv-in`; no modifica datos comerciales.
- **Funciones principales:** `run`, `initBackground`, `makeSprite`, `newPart`, `resize`, `build`, `draw`, `drawStatic`, `updateIntensity`, `setupReveal`.

## `js/services/leads-service.js`

- **Responsabilidad:** abstrae envío/actualización de leads y modo local/demo.
- **Depende de:** `window.PrimOfficeConfig`, `fetch`, `AbortController`, `localStorage`; no importa `app-config.js` directamente.
- **Utilizado por:** `index.html` como módulo y a través de `window.PrimOfficeLeads`; `tests/leads-defensive.test.mjs` verifica sus modos.
- **Entradas:** payload de lead, configuración pública y estado de entorno local.
- **Salidas:** POST o PATCH a `/api/leads`, resultado uniforme `{ok,mode,...}` o almacenamiento bajo `LEADS_STORAGE_KEY`; exports nombrados/default/global.
- **Funciones principales:** `submitLead`, `updateLead`, `getLeadsDemo`, `enviarReal`, `guardarDemo`, `usarModoDemo`, `cfg`.

## `js/services/tiendanube-cart-transfer.js`

- **Responsabilidad:** valida una selección mínima, prepara transferencia, controla botones/estado y redirige únicamente a un storefront permitido.
- **Depende de:** `window.PrimOfficeConfig`, `fetch`, `crypto.randomUUID`, `AbortController`, DOM y `window.location`.
- **Utilizado por:** `index.html` como módulo/global `window.PrimOfficeTiendanube`; `tests/tiendanube-frontend.test.mjs`.
- **Entradas:** items `{internalId,quantity}`, flags/URL/allowlist, elementos `[data-tiendanube-transfer]` y respuesta del endpoint.
- **Salidas:** POST a `/api/tiendanube/cart-transfer`, status UI, navegación validada o error; bloqueo `inFlight` evita doble solicitud.
- **Funciones principales:** `isAllowedStorefrontUrl`, `normalizeTransferItems`, `createClientRequestId`, `prepareCartTransfer`, `syncTiendanubeTransferUi`, `transferSelection`.

## `js/setup-3d.js`

- **Responsabilidad:** adaptador 3D legacy/procedural basado en Three.js, con cámara, objetos, modos y arrastre; intenta espejar visibilidad comercial mediante `window.Setup3D`.
- **Depende de:** DOM `s3d*`, WebGL y imports dinámicos bare `three`/addons.
- **Utilizado por:** **INFORMACIÓN NO IDENTIFICADA:** `index.html` no lo carga, ningún módulo lo importa y el HTML activo no contiene `s3dStage`; por tanto no integra el runtime actual comprobado.
- **Entradas:** visibilidad/diagnóstico/modo vía API global, toolbar/pointer/wheel y viewport.
- **Salidas:** escena WebGL o fallback 2D; global `Setup3D` con `setVisible`, `setDiagnosis`, `setMode`, `setView`, `refreshFromDOM`, `reset`, `setFree`.
- **Funciones principales:** `init`, `start`, `buildScene`, constructores `b*`, `placeAll`, `applyVisible`, `setDeskMode`, `autoFrame`, `setView`, `setupDrag`, `resetPositions`.

## `js/setup-visual-calibration.js`

- **Responsabilidad:** modela offsets por capa/escritorio y crea un controlador temporal de calibración activado solo con `?calibrate=1`.
- **Depende de:** constantes/normalizadores de `setup-visual-config.js`; DOM, pointer/keyboard, `localStorage` y tamaño lógico 1254×1254.
- **Utilizado por:** `setup-visual-hybrid.js` y `tests/visual-mapping.test.mjs`.
- **Entradas:** offsets almacenados, desk type/preset, delta de puntero, selección de capa y callbacks del compositor.
- **Salidas:** transformaciones/posiciones, panel de calibración, payload storage/export JSON; no muta selección comercial según el contrato probado.
- **Funciones principales:** `isSetupCalibrationEnabled`, `createZeroCalibrationOffsets/ByDesk`, `sanitizeCalibrationPayload/Storage`, `canvasDeltaFromClientDelta`, `resolveLayerPosition`, `buildCalibrationExport`, `createSetupCalibrationController`.

## `js/setup-visual-config.js`

- **Responsabilidad:** fuente de verdad visual para lienzo, layouts por tipo de escritorio, manifiesto de PNG, mapeo producto→capa y orden de composición.
- **Depende de:** rutas versionadas bajo `assets/setup-layers/runtime/`; no importa otros módulos.
- **Utilizado por:** `setup-visual-calibration.js`, `setup-visual-hybrid.js` y `tests/visual-mapping.test.mjs`.
- **Entradas:** `deskType`, preset o mapa de productos seleccionados.
- **Salidas:** objetos inmutables de configuración y lista ordenada de capas visibles con exactamente un escritorio.
- **Funciones principales:** `normalizeSetupDeskType`, `getSetupLayerLayout`, `normalizeSetupPreset`, `deriveVisibleSetupLayers`; constantes `SETUP_LAYER_MANIFEST`, `COMMERCIAL_TO_VISUAL`, `SETUP_LAYER_ORDER`.

## `js/setup-visual-hybrid.js`

- **Responsabilidad:** runtime visual activo: compone capas PNG, renderiza rail/panel, refleja el carrito de `index.html`, alterna antes/después y conecta calibración.
- **Depende de:** `setup-visual-config.js`, `setup-visual-calibration.js`, DOM `setup-*`, assets de capas/comparación y `window.PrimOfficeHybridBridge` creado inline.
- **Utilizado por:** `index.html` como último módulo de la lista de scripts; pruebas visuales inspeccionan el controlador.
- **Entradas:** bridge (`getState`, `toggleProduct`, `setComparison`, callbacks), clicks/teclas, carga/error de imágenes y query de calibración.
- **Salidas:** stacks `<img>`, visibilidad/foco/aria, feedback, alt de escena, sincronización de preset/productos y global `window.SetupVisualHybrid`.
- **Funciones principales:** `init`, `autoInit`, `sync`, `renderScene`, `renderRail`, `toggleProduct`, `setComparison`, `handleRootClick`, `handleRootKeydown`, `createLayerStack`, `showAssetErrors`.

## `tests/helpers/tiendanube-d1.mjs`

- **Responsabilidad:** dobles de prueba para D1 y Tiendanube; interpreta el subconjunto de SQL usado por los servicios.
- **Depende de:** APIs JavaScript estándar; no toca D1/API real.
- **Utilizado por:** `tests/tiendanube-oauth.test.mjs` y `tests/tiendanube-transfer.test.mjs`.
- **Entradas:** filas iniciales, SQL/bindings, IDs, overrides de producto/env y requests JSON.
- **Salidas:** `MemoryD1`, statements con `bind/first/all/run`, catálogo/productos falsos, `FakeTiendanubeClient`, env/request fixtures.
- **Funciones principales:** clases `MemoryD1`, `MemoryStatement`, `FakeTiendanubeClient`; `catalogRows`, `productFor`, `productsFor`, `envFor`, `jsonRequest`.

## `tests/leads-defensive.test.mjs`

- **Responsabilidad:** prueba defensivamente sesión del lead, errores POST, debounce/PATCH, presets, Odoo/D1 y modos demo/real.
- **Depende de:** `node:test`, `assert`, fs/path/url, `vm`; lee/extracta lógica de `index.html`, importa `functions/api/leads.js` y `leads-service.js` mediante harnesses.
- **Utilizado por:** runner Node cuando se invoca explícitamente/por patrón; ningún archivo productivo lo importa.
- **Entradas:** fuentes locales, payloads/harness DOM-storage-timers, fetch/XML-RPC y D1 falsos.
- **Salidas:** assertions; no envía leads ni llama servicios productivos.
- **Funciones principales:** helpers `extractFunction`, `createSubmitHarness`, `createTimerHarness`, fixtures XML/D1/request y casos `test(...)`.

## `tests/tiendanube-catalog-sync.test.mjs`

- **Responsabilidad:** verifica forma del catálogo, migración vacía/idempotente, resolución exacta por SKU, paginado, SQL controlado y CLI sin token visible.
- **Depende de:** `node:test`, `assert`, fs/path/url, `node:sqlite`, `tools/tiendanube-sync-catalog.mjs`, catálogo JSON y migración SQL.
- **Utilizado por:** runner Node; no por producción.
- **Entradas:** fixtures de catálogo/productos, SQLite en memoria y argumentos CLI.
- **Salidas:** assertions y SQL en memoria; la prueba de fetch usa cliente falso, no API real.
- **Funciones principales:** casos `test(...)`; consume `validateCatalogDefinition`, `resolveSkuMatch`, `buildCatalogUpsertSql`, `fetchProductsForSku`, `parseArguments`.

## `tests/tiendanube-client.test.mjs`

- **Responsabilidad:** prueba headers/versión, reintentos, clasificación de errores, timeout, límites/content-type y normalizadores stock/precio.
- **Depende de:** `node:test`, `assert`, exports de `client.mjs` y fetches falsos.
- **Utilizado por:** runner Node.
- **Entradas:** respuestas `Response` sintetizadas y opciones de cliente.
- **Salidas:** assertions; no usa la red real.
- **Funciones principales:** helper `client` y casos sobre `TiendanubeClient`, `availableStock`, `currentPrice`.

## `tests/tiendanube-frontend.test.mjs`

- **Responsabilidad:** prueba payload mínimo/UUID, doble click, allowlist, flags/fallback de combos y ausencia de catálogo sensible en HTML.
- **Depende de:** Node test/assert/fs/path/url/vm; importa el servicio de transferencia y lee `index.html`.
- **Utilizado por:** runner Node.
- **Entradas:** config, DOM/location/fetch/crypto falsos y fuente HTML.
- **Salidas:** assertions; no navega ni llama endpoints reales.
- **Funciones principales:** `importService`, `config`, `uiHarness`, `comboPurchaseHarness` y casos `test(...)`.

## `tests/tiendanube-nubesdk.test.mjs`

- **Responsabilidad:** prueba agregación secuencial/parcial/timeout, listeners lazy, navegación/storage, resumen/UI slots y validación de backend/build.
- **Depende de:** `transfer-core.mjs`, `storefront-flow.mjs`, `backend-url.mjs`, bundle versionado, README y Node test/assert/fs/path/url.
- **Utilizado por:** runner Node.
- **Entradas:** harness NubeSDK, browser/storage, locations, outcomes y URLs.
- **Salidas:** assertions sobre carrito simulado y archivos; no opera una tienda real.
- **Funciones principales:** `nubeHarness`, `browserHarness`, `state` y casos sobre coordinador, adder y URL.

## `tests/tiendanube-oauth.test.mjs`

- **Responsabilidad:** cubre state/cookie/rate limit, callback, scopes/dominio, cifrado, status público y carga de token por entorno.
- **Depende de:** `client.mjs`, `installations.mjs`, `scopes.mjs`, `oauth.mjs`, `token-crypto.mjs`, helper MemoryD1 y fetch Web Crypto simulados.
- **Utilizado por:** runner Node.
- **Entradas:** requests/cookies, env D1 en memoria, códigos/tokens de fixture y respuestas API falsas.
- **Salidas:** assertions, filas cifradas solo en memoria y respuestas de handler.
- **Funciones principales:** `request`, `tokenAndStoreFetch`, `begin`, `callback` y casos `test(...)`.

## `tests/tiendanube-transfer.test.mjs`

- **Responsabilidad:** prueba selecciones/presets, disponibilidad, feature flag, tickets/leases/completion, CORS, rate limit, HMAC, privacidad y migración.
- **Depende de:** `transfers.mjs`, `privacy.mjs`, `rate-limit.mjs`, `security.mjs`, `client.mjs`, helper MemoryD1, Node crypto/fs/path/test.
- **Utilizado por:** runner Node.
- **Entradas:** payloads/request/env/productos/cliente falsos, tiempo y firmas HMAC de fixture.
- **Salidas:** assertions y cambios en D1 en memoria; no llama Tiendanube real.
- **Funciones principales:** `transferPayload`, `prepare`, `signedWebhook` y casos `test(...)` sobre handlers.

## `tests/visual-mapping.test.mjs`

- **Responsabilidad:** valida runtime por capas, mapeos/presets/totales, assets PNG/alfa, referencias, WhatsApp y aislamiento/cálculos de calibración.
- **Depende de:** Node test/assert/crypto/fs/child_process/path/url/vm; lee/importa config/calibración/hybrid/index/assets; ejecuta un snippet Python/Pillow para una prueba de alfa.
- **Utilizado por:** runner Node.
- **Entradas:** archivos versionados, hashes/dimensiones, extracción de presets y VM mínima.
- **Salidas:** assertions. **HECHO VERIFICADO:** no escribe `tests/visual-output/`.
- **Funciones principales:** `importVisualConfig`, `importVisualCalibration`, `extractComboPresets`, `hash` y casos `test(...)`.

## `tiendanube-script/build/backend-url.mjs`

- **Responsabilidad:** permite incrustar en build solo el origen de producción o un Preview cerrado de este proyecto.
- **Depende de:** `URL` y `process.env.SETUPOFICINA_BACKEND_URL`.
- **Utilizado por:** `tiendanube-script/tsup.config.js` y `tests/tiendanube-nubesdk.test.mjs`.
- **Entradas:** valor explícito o variable de proceso.
- **Salidas:** origen HTTPS normalizado o `Error`; fallback `https://setupoficina.com.ar`.
- **Funciones principales:** `validateBackendUrl`, `resolveBackendUrl`; constante `PRODUCTION_BACKEND_URL`.

## `tiendanube-script/src/main.tsx`

- **Responsabilidad:** entrada del script NubeSDK: consume ticket, agrega productos secuencialmente, completa backend, guarda/navega y renderiza resultado.
- **Depende de:** `@tiendanube/nube-sdk-jsx`, tipos NubeSDK, `transfer-core.mjs`, `storefront-flow.mjs` y constante de backend inyectada por tsup.
- **Utilizado por:** `tsup.config.js` como entry; su salida es `assets/tiendanube/main.min.js`; pruebas NubeSDK inspeccionan el contrato.
- **Entradas:** instancia NubeSDK, location/store ID, ticket, respuestas consume/complete, eventos de carrito y slots disponibles.
- **Salidas:** fetches al backend, mutaciones `cart:add`, storage/navegación y Toast/Column; export `App`.
- **Funciones principales:** `App`, `postJson`, `executeTransfer`, `renderResult`, `showStoredResult`, `availableResultSlot`, `namesLabel`.

## `tiendanube-script/src/storefront-flow.mjs`

- **Responsabilidad:** separa la coordinación de ubicación y el ciclo de persistir/mostrar una sola vez el resultado.
- **Depende de:** Browser APIs entregadas por NubeSDK (`asyncSessionStorage`, `navigate`) e interfaces callback; no importa módulos.
- **Utilizado por:** `main.tsx` y `tests/tiendanube-nubesdk.test.mjs`.
- **Entradas:** resultado de transferencia, browser API, location/state, callbacks `transfer`/`displayResult`.
- **Salidas:** resumen presentacional, storage TTL 600, navegación `/cart?setupoficina_result=1`, eliminación posterior y coordinación deduplicada.
- **Funciones principales:** `summarizeDisplayResult`, `persistResultAndNavigate`, `displayStoredResult`, `isResultLocation`, `createLocationCoordinator`.

## `tiendanube-script/src/transfer-core.mjs`

- **Responsabilidad:** agrega items uno a uno mediante NubeSDK, correlaciona eventos, aplica timeout, conserva resultados parciales y registra listeners solo al primer uso.
- **Depende de:** API NubeSDK `on/off/send`, Promises y timers; no importa módulos.
- **Utilizado por:** `main.tsx` y `tests/tiendanube-nubesdk.test.mjs`.
- **Entradas:** items resueltos `{productId,variantId,quantity,...}`, eventos `cart:add:success/fail` y opciones de timer.
- **Salidas:** array ordenado `{ok,item,reason?}`, cola serializada y limpieza de listeners.
- **Funciones principales:** `createSequentialCartAdder`, `createLazySequentialCartAdder`; internos `eventItem`, `addOne`, `runSequentially`, `finish`, `dispose`.

## `tiendanube-script/tsup.config.js`

- **Responsabilidad:** configura el bundle público NubeSDK.
- **Depende de:** `tsup.defineConfig`, `build/backend-url.mjs` y dependencias declaradas en `package.json`.
- **Utilizado por:** comando npm `build` (`tsup`).
- **Entradas:** `src/main.tsx`, variable validada de backend y módulos importados.
- **Salidas:** ESM único minificado `../assets/tiendanube/main.min.js`, sin sourcemap/splitting; inyecta `__SETUPOFICINA_BACKEND_URL__` y alias JSX.
- **Funciones principales:** callback `esbuildOptions`, callback `outExtension` y objeto `defineConfig` exportado.

## `tools/tiendanube-sync-catalog.mjs`

- **Responsabilidad:** CLI controlada que lee catálogo mínimo, consulta productos por SKU exacto y genera SQL UPSERT sin persistir token/precio/stock.
- **Depende de:** Node fs/path/url, `client.mjs`, `config/tiendanube-catalog.json`, env de Tiendanube y una API real solo cuando se ejecuta sin doble inyectado.
- **Utilizado por:** ejecución CLI manual y `tests/tiendanube-catalog-sync.test.mjs`.
- **Entradas:** catálogo JSON, argumentos `--store-id/--output`, variables de token/API y respuestas paginadas.
- **Salidas:** archivo SQL en una ruta `.sql` obligatoria y validada dentro de `db/generated/`, con UPSERTs; o errores ante SKU ambiguo/ausente/argumentos inseguros.
- **Funciones principales:** `validateCatalogDefinition`, `resolveSkuMatch`, `buildCatalogUpsertSql`, `fetchProductsForSku`, `parseArguments`, `resolveOutputPath`, `runCatalogSync`, `main`.
