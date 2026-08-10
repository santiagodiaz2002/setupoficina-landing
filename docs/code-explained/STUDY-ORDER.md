# Orden pedagógico para estudiar las 52 fuentes

## Criterio

**HECHO VERIFICADO:** este recorrido incluye una vez cada uno de los 52 archivos fuente del inventario. El orden va de lo visible y los contratos del navegador hacia persistencia, seguridad e integraciones. Los wrappers de ruta se leen después de su lógica compartida; las pruebas se leen después del comportamiento que especifican.

Para los formatos no fuente, conviene consultar en paralelo sus explicaciones bajo este mismo directorio: `site.webmanifest.md` con el HTML; `env.example.md` con backend; `assets/setup-layers/manifest.json.md` con visuales; `config/tiendanube-catalog.json.md` con catálogo; y los tres documentos de `tiendanube-script/` con el build.

## Etapa 1 — Página, configuración y servicios básicos del navegador

### 1. `index.html`

- **Archivo a abrir:** `index.html`.
- **Conocimientos:** estructura HTML, IDs/clases/data attributes, DOM, eventos, estado en arrays/objetos y carga de scripts clásicos vs módulos.
- **Funciones a comprender primero:** `renderQ`, `buildCart`, `renderCart`, `showResult`, `pqPayload`, `pqSubmit`; solo después, `updateProductSelections`, `applyComboPreset`, `submitLeadUpdate` y `radar*`.
- **Logro esperado:** poder dibujar el recorrido pregunta → diagnóstico → selección → contacto → resultado, y señalar qué parte queda inline y qué parte se delega.

### 2. `js/config/app-config.js`

- **Archivo a abrir:** `js/config/app-config.js`.
- **Conocimientos:** export ES module, objeto de configuración, valores públicos, `Object.assign` y global `window`.
- **Funciones/estructuras:** `APP_CONFIG` y el bloque que fusiona/publica `window.PrimOfficeConfig`.
- **Logro esperado:** explicar por qué esta configuración puede ser consumida por scripts sin import directo y distinguirla de secretos backend.

### 3. `css/integracion-canonica.css`

- **Archivo a abrir:** `css/integracion-canonica.css`.
- **Conocimientos:** selectores por clase/atributo, Grid, foco, `hidden`, `aria-invalid`, `:has`, animación y responsive.
- **Funciones/bloques:** familias `.pq-panel`, `.pq-card`, `.pq-input`, `.pq-channel`, `.pq-error`, `.pq-submit`.
- **Logro esperado:** relacionar cada estado del formulario que cambia JavaScript con su representación visual.

### 4. `js/services/leads-service.js`

- **Archivo a abrir:** `js/services/leads-service.js`.
- **Conocimientos:** async/await, `fetch`, timeout/AbortController, localStorage, configuración global y objeto de resultado.
- **Funciones:** `cfg`, `usarModoDemo`, `guardarDemo`, `enviarReal`, `submitLead`, `updateLead`, `getLeadsDemo`.
- **Logro esperado:** explicar exactamente cuándo hay almacenamiento local, POST o PATCH y cómo el llamador recibe fallos sin una excepción sin controlar.

### 5. `css/comparacion-antes-despues.css`

- **Archivo a abrir:** `css/comparacion-antes-despues.css`.
- **Conocimientos:** variable CSS, `clip-path`, positioning, z-index, pseudoclases y atributos de estado.
- **Funciones/bloques:** `.ba-compare`, las dos imágenes, divisor/manija y labels.
- **Logro esperado:** explicar cómo un único porcentaje controla recorte y divisor.

### 6. `js/comparacion-antes-despues.js`

- **Archivo a abrir:** `js/comparacion-antes-despues.js`.
- **Conocimientos:** IIFE, Pointer Events, teclado accesible, `requestAnimationFrame`, IntersectionObserver y reduced motion.
- **Funciones:** `clamp`, `set`, `fromPointer`, `down`, `move`, `up`, `animate`.
- **Logro esperado:** seguir un arrastre/tecla desde el evento hasta `--ba-position` y ARIA.

### 7. `css/pulido-visual.css`

- **Archivo a abrir:** `css/pulido-visual.css`.
- **Conocimientos:** canvas posicionado, fondos, transform/opacity, estados de reveal y reduced motion.
- **Funciones/bloques:** `#pv-bg`, `#pv-canvas`, `.pv-rv`, variantes y `.pv-in`.
- **Logro esperado:** distinguir decoración global de comportamiento/datos comerciales.

### 8. `js/pulido-visual.js`

- **Archivo a abrir:** `js/pulido-visual.js`.
- **Conocimientos:** Canvas 2D, bucle de animación, pixel ratio, closures, observers y eventos resize/scroll.
- **Funciones:** `run`, `initBackground`, `makeSprite`, `newPart`, `resize`, `build`, `draw`, `drawStatic`, `updateIntensity`, `setupReveal`.
- **Logro esperado:** explicar la vida completa del canvas y cuándo aparece una clase de reveal.

## Etapa 2 — Compositor visual actual y archivo 3D legado

### 9. `js/setup-visual-config.js`

- **Archivo a abrir:** `js/setup-visual-config.js`.
- **Conocimientos:** objetos/arrays inmutables, mapeos, normalización y derivación de estado.
- **Funciones:** `normalizeSetupDeskType`, `getSetupLayerLayout`, `normalizeSetupPreset`, `deriveVisibleSetupLayers`; constantes de manifiesto/orden/mapeo.
- **Logro esperado:** convertir una selección comercial en la lista exacta de PNG y explicar por qué hay un único escritorio.

### 10. `css/setup-visual-hybrid.css`

- **Archivo a abrir:** `css/setup-visual-hybrid.css`.
- **Conocimientos:** capas absolutas, stacking, grid/flex, estados dinámicos, accesibilidad, media queries y paneles.
- **Funciones/bloques:** `.setup-scene`, `.setup-product-bar`, `.setup-product-chip`, `.setup-calibration-panel`, estados `.is-*`.
- **Logro esperado:** identificar qué clases son estructura permanente y cuáles son outputs de JavaScript.

### 11. `js/setup-visual-calibration.js`

- **Archivo a abrir:** `js/setup-visual-calibration.js`.
- **Conocimientos:** módulos, coordenadas lógicas, escalado, localStorage sanitizado, pointer/keyboard y callbacks.
- **Funciones:** `isSetupCalibrationEnabled`, `sanitizeCalibrationStorage`, `canvasDeltaFromClientDelta`, `resolveLayerPosition`, `buildCalibrationExport`, `createSetupCalibrationController`.
- **Logro esperado:** explicar cómo un delta de pantalla se vuelve offset del lienzo y por qué la calibración no modifica carrito/leads.

### 12. `js/setup-visual-hybrid.js`

- **Archivo a abrir:** `js/setup-visual-hybrid.js`.
- **Conocimientos:** imports, IIFE, bridge entre módulos/JavaScript clásico, DOM delegado, estado visual vs comercial y manejo de error de assets.
- **Funciones:** `init`, `sync`, `renderScene`, `renderRail`, `toggleProduct`, `setComparison`, `handleRootClick`, `handleRootKeydown`, `createLayerStack`.
- **Logro esperado:** narrar el ciclo bridge → estado → capas/rail → evento → callback al carrito → resync.

### 13. `tests/visual-mapping.test.mjs`

- **Archivo a abrir:** `tests/visual-mapping.test.mjs`.
- **Conocimientos:** `node:test`, assertions, lectura binaria, hashes, imports mediante data URL/VM y subprocess controlado.
- **Funciones:** `importVisualConfig`, `importVisualCalibration`, `extractComboPresets`, `hash` y cada test como especificación.
- **Logro esperado:** enumerar las invariantes comprobadas del compositor y diferenciar una prueba que lee de una herramienta que genera archivos.

### 14. `js/setup-3d.js`

- **Archivo a abrir:** `js/setup-3d.js`.
- **Conocimientos:** Three.js/WebGL, imports dinámicos, scene graph, geometría procedural, cámara, raycasting y fallback.
- **Funciones:** `init`, `buildScene`, familia de builders `b*`, `placeAll`, `applyVisible`, `autoFrame`, `setupDrag`, `resetPositions`.
- **Logro esperado:** describir su API y diseño, y demostrar con el HTML que es legado no cargado en el runtime actual.

## Etapa 3 — Lead, D1 y Odoo

### 15. `db/schema_leads.sql`

- **Archivo a abrir:** `db/schema_leads.sql`.
- **Conocimientos:** tabla, tipos SQLite, claves, índices, null/default y JSON guardado como texto.
- **Funciones/bloques:** `CREATE TABLE leads` y los índices.
- **Logro esperado:** explicar qué columnas vienen del usuario, del diagnóstico, del request y de Odoo.

### 16. `functions/api/leads.js`

- **Archivo a abrir:** `functions/api/leads.js`.
- **Conocimientos:** Pages Functions por método, validación defensiva, D1 prepared statements, XML, XML-RPC, fetch backend y try/catch.
- **Funciones:** primero `onRequestGet/Post/Patch`, `validatePayload`, `normalizeLeadPayload`; después `xmlRpcCall`, `getOdooSession`, `sendToOdoo`, `updateOdooLead`, resolución de tags.
- **Logro esperado:** narrar POST/PATCH desde body hasta D1 y, condicionalmente, Odoo, incluidos códigos/error y actualización del estado de sync.

### 17. `tests/leads-defensive.test.mjs`

- **Archivo a abrir:** `tests/leads-defensive.test.mjs`.
- **Conocimientos:** test doubles, VM, extracción de funciones inline, timers y requests simuladas.
- **Funciones:** `extractFunction`, `createSubmitHarness`, `createTimerHarness`, fixtures D1/XML y nueve escenarios.
- **Logro esperado:** usar los tests para justificar sesión, debounce, PATCH y manejo de fallos sin afirmar llamadas reales.

## Etapa 4 — Fundamentos compartidos del backend Tiendanube

### 18. `db/migrations/0001_tiendanube_cart_bridge.sql`

- **Archivo a abrir:** `db/migrations/0001_tiendanube_cart_bridge.sql`.
- **Conocimientos:** SQL DDL, constraints, claves compuestas, JSON válido, estados/leases e índices.
- **Funciones/bloques:** las cinco tablas y sus `CHECK`/índices.
- **Logro esperado:** dibujar qué datos viven en catálogo, ticket, rate limit, OAuth state e instalación.

### 19. `functions/_lib/tiendanube/http.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/http.mjs`.
- **Conocimientos:** Request/Response, CORS, status/headers, errores de dominio y validación JSON.
- **Funciones:** `HttpError`, `setupOrigins`, `storefrontOrigins`, `assertAllowedOrigin`, `jsonResponse`, `errorResponse`, `optionsResponse`, `readJsonBody`, asserts.
- **Logro esperado:** explicar cómo todos los servicios producen respuestas coherentes y separan orígenes landing/storefront.

### 20. `functions/_lib/tiendanube/security.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/security.mjs`.
- **Conocimientos:** Web Crypto, SHA-256, HMAC, aleatoriedad, comparación temporal y trust boundary.
- **Funciones:** `timingSafeEqual`, `sha256Hex`, `randomTicket`, `verifyWebhookHmac`, `assertNoCommerceFields`, `assertTicket`, `isFeatureEnabled`.
- **Logro esperado:** explicar por qué el frontend no puede mandar IDs/precios/stock confiables y cómo se verifican tickets/webhooks.

### 21. `functions/_lib/tiendanube/rate-limit.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/rate-limit.mjs`.
- **Conocimientos:** identidad de request, hash, ventana temporal, UPSERT/contador D1 y HTTP 429.
- **Funciones:** `rateLimitIdentity`, `enforceRateLimit`.
- **Logro esperado:** seguir una request desde IP/User-Agent hasta la fila de contador y el bloqueo.

### 22. `functions/_lib/tiendanube/client.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/client.mjs`.
- **Conocimientos:** cliente API, clase/error, fetch/abort, retries, content-type/tamaño y normalización de datos externos.
- **Funciones:** `TiendanubeClient.request/getProduct/listProducts/getStore`, `clientFromEnv`, `readBoundedResponseText`, `availableStock`, `currentPrice`, `localizedText`.
- **Logro esperado:** explicar qué llamadas pueden reintentarse, cómo se limita una respuesta y cómo se clasifica un fallo externo.

### 23. `tests/tiendanube-client.test.mjs`

- **Archivo a abrir:** `tests/tiendanube-client.test.mjs`.
- **Conocimientos:** fetch falso, Response sintética, assertions de headers/error/retry.
- **Funciones:** helper `client` y casos sobre API, timeout, límites, stock y precio.
- **Logro esperado:** citar evidencia local de las garantías del cliente sin consultar Tiendanube.

### 24. `functions/_lib/tiendanube/scopes.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/scopes.mjs`.
- **Conocimientos:** scopes OAuth, Set/normalización y validación exacta.
- **Funciones:** `validateGrantedScopes`, `requiredScopesLabel`, `REQUIRED_TIENDANUBE_SCOPES`.
- **Logro esperado:** explicar por qué el proyecto exige `read_products` y `write_scripts` y rechaza permisos incompatibles.

### 25. `functions/_lib/tiendanube/oauth-config.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/oauth-config.mjs`.
- **Conocimientos:** URL/origen/path, dominios, env y separación production/preview.
- **Funciones:** `configuredTiendanubeEnvironment`, `oauthRedirectConfig`, `assertConfiguredOAuthRequest`, `expectedStoreDomains`, `normalizeStoreDomain`.
- **Logro esperado:** listar qué configuración debe coincidir antes de permitir el flujo OAuth.

### 26. `functions/_lib/tiendanube/token-crypto.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/token-crypto.mjs`.
- **Conocimientos:** base64, bytes, AES-GCM, IV y additional authenticated data.
- **Funciones:** `decodeEncryptionKey`, `encryptAccessToken`, `decryptAccessToken`.
- **Logro esperado:** explicar qué se guarda en D1 y por qué el store ID queda autenticado con el ciphertext.

### 27. `functions/_lib/tiendanube/installations.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/installations.mjs`.
- **Conocimientos:** repositorio D1, filas activas/revocadas, token cifrado y fallback condicionado por entorno.
- **Funciones:** `hasAnyActiveInstallation`, `loadActiveInstallation`, `saveInstallation`, `accessTokenForEnvironment`, `installationPublicStatus`.
- **Logro esperado:** describir la vida del token desde OAuth hasta `clientFromEnv` sin exponerlo en estado público.

## Etapa 5 — OAuth completo y adaptadores de ruta

### 28. `functions/_lib/tiendanube/oauth.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/oauth.mjs`.
- **Conocimientos:** OAuth authorization code, state/cookie, hash, expiración/consumo atómico, redirect, exchange y HTML seguro.
- **Funciones:** `handleOAuthStart`, `handleOAuthCallback`, `handleOAuthStatus`, state helpers, `exchangeAuthorizationCode`, `fetchAndValidateStore`.
- **Logro esperado:** narrar los tres endpoints, cada dato que cruza el límite externo y cuándo se cifra/persiste.

### 29. `functions/api/tiendanube/oauth/start.js`

- **Archivo a abrir:** `functions/api/tiendanube/oauth/start.js`.
- **Conocimientos:** convención de exports Pages por método y adaptador delgado.
- **Funciones:** `onRequestGet`.
- **Logro esperado:** explicar por qué la ruta no duplica lógica y qué handler recibe el contexto.

### 30. `functions/api/tiendanube/oauth/callback.js`

- **Archivo a abrir:** `functions/api/tiendanube/oauth/callback.js`.
- **Conocimientos:** misma convención, callback de tercero.
- **Funciones:** `onRequestGet`.
- **Logro esperado:** conectar la URL configurada con `handleOAuthCallback`.

### 31. `functions/api/tiendanube/oauth/status.js`

- **Archivo a abrir:** `functions/api/tiendanube/oauth/status.js`.
- **Conocimientos:** endpoint de lectura y exposición mínima.
- **Funciones:** `onRequestGet`.
- **Logro esperado:** explicar que devuelve estado público y no token.

### 32. `tests/tiendanube-oauth.test.mjs`

- **Archivo a abrir:** `tests/tiendanube-oauth.test.mjs`.
- **Conocimientos:** fixtures criptográficos, D1 en memoria, cookies y fetch múltiple falso.
- **Funciones:** `request`, `tokenAndStoreFetch`, `begin`, `callback` y escenarios OAuth/cifrado/status.
- **Logro esperado:** enumerar ataques/fallos cubiertos y distinguir invariantes probadas de configuración real no identificada.

## Etapa 6 — Catálogo y transferencia landing → backend

### 33. `tools/tiendanube-sync-catalog.mjs`

- **Archivo a abrir:** `tools/tiendanube-sync-catalog.mjs`.
- **Conocimientos:** CLI Node, fs, validación, paginado API, SKU y generación SQL.
- **Funciones:** `validateCatalogDefinition`, `resolveSkuMatch`, `buildCatalogUpsertSql`, `fetchProductsForSku`, `parseArguments`, `runCatalogSync`.
- **Logro esperado:** explicar cómo IDs externos llegan al catálogo D1 sin ser aceptados desde el navegador.

### 34. `tests/tiendanube-catalog-sync.test.mjs`

- **Archivo a abrir:** `tests/tiendanube-catalog-sync.test.mjs`.
- **Conocimientos:** SQLite en memoria, testing de CLI/SQL y API falsa.
- **Funciones:** casos sobre forma mínima, migración, match exacto, paginado y UPSERT.
- **Logro esperado:** justificar por pruebas que la fuente versionada no incluye IDs, token, precio ni stock.

### 35. `functions/_lib/tiendanube/transfers.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/transfers.mjs`.
- **Conocimientos:** máquina de estados, transacciones D1, idempotencia, ticket hash, lease, trust boundary, CORS y API externa.
- **Funciones:** `normalizeSelectionPayload`, `resolveCatalogSelection`, `handleCartTransfer`, `handleCartTransferConsume`, `handleCartTransferComplete`, `buildStorefrontRedirect`.
- **Logro esperado:** dibujar estados pending → processing → completed/expired y explicar qué valida cada transición.

### 36. `functions/api/tiendanube/cart-transfer.js`

- **Archivo a abrir:** `functions/api/tiendanube/cart-transfer.js`.
- **Conocimientos:** wrapper Pages y preflight CORS de landing.
- **Funciones:** `onRequestPost`, `onRequestOptions`.
- **Logro esperado:** mapear `/api/tiendanube/cart-transfer` al handler de preparación.

### 37. `functions/api/tiendanube/cart-transfer/consume.js`

- **Archivo a abrir:** `functions/api/tiendanube/cart-transfer/consume.js`.
- **Conocimientos:** wrapper storefront y adquisición de lease.
- **Funciones:** `onRequestPost`, `onRequestOptions`.
- **Logro esperado:** mapear `/consume` y explicar por qué usa la allowlist storefront.

### 38. `functions/api/tiendanube/cart-transfer/complete.js`

- **Archivo a abrir:** `functions/api/tiendanube/cart-transfer/complete.js`.
- **Conocimientos:** wrapper de confirmación y resultado exacto.
- **Funciones:** `onRequestPost`, `onRequestOptions`.
- **Logro esperado:** mapear `/complete` y su processing token.

### 39. `js/services/tiendanube-cart-transfer.js`

- **Archivo a abrir:** `js/services/tiendanube-cart-transfer.js`.
- **Conocimientos:** validación frontend no autoritativa, UUID, fetch/abort, allowlist URL, promesa en vuelo y UI.
- **Funciones:** `normalizeTransferItems`, `createClientRequestId`, `prepareCartTransfer`, `isAllowedStorefrontUrl`, `transferSelection`, `syncTiendanubeTransferUi`.
- **Logro esperado:** narrar click en landing → POST mínimo → redirect validado y explicar qué datos nunca acepta del cliente el backend.

### 40. `tests/tiendanube-frontend.test.mjs`

- **Archivo a abrir:** `tests/tiendanube-frontend.test.mjs`.
- **Conocimientos:** DOM/location/config/fetch simulados y evaluación de módulo.
- **Funciones:** `importService`, `uiHarness`, `comboPurchaseHarness` y casos de flag/doble click/fallback.
- **Logro esperado:** demostrar los dos caminos del feature flag y la protección contra redirect externo.

### 41. `tests/helpers/tiendanube-d1.mjs`

- **Archivo a abrir:** `tests/helpers/tiendanube-d1.mjs`.
- **Conocimientos:** test doubles, interfaz D1, prepared statements y fake client.
- **Funciones:** `MemoryD1`, `MemoryStatement`, `FakeTiendanubeClient`, `catalogRows`, `productFor`, `envFor`, `jsonRequest`.
- **Logro esperado:** explicar qué parte de D1/API se simula y por qué los tests no prueban infraestructura remota.

## Etapa 7 — Webhooks de privacidad y especificación integral del puente

### 42. `functions/_lib/tiendanube/privacy.mjs`

- **Archivo a abrir:** `functions/_lib/tiendanube/privacy.mjs`.
- **Conocimientos:** cuerpo crudo, HMAC, webhooks, idempotencia y borrado por store ID.
- **Funciones:** `handlePrivacyWebhook`, `rawWebhookBody`, `parseWebhookJson`, `deleteStoreData`.
- **Logro esperado:** explicar los tres tipos y por qué la firma se verifica antes de parsear/procesar.

### 43. `functions/api/tiendanube/privacy/store-redact.js`

- **Archivo a abrir:** `functions/api/tiendanube/privacy/store-redact.js`.
- **Conocimientos:** wrapper POST y tipo literal.
- **Funciones:** `onRequestPost`.
- **Logro esperado:** conectar la ruta con el borrado del puente para una tienda.

### 44. `functions/api/tiendanube/privacy/customers-redact.js`

- **Archivo a abrir:** `functions/api/tiendanube/privacy/customers-redact.js`.
- **Conocimientos:** wrapper de webhook sin almacenamiento PII local comprobado.
- **Funciones:** `onRequestPost`.
- **Logro esperado:** explicar la respuesta sin inventar datos de cliente.

### 45. `functions/api/tiendanube/privacy/customers-data-request.js`

- **Archivo a abrir:** `functions/api/tiendanube/privacy/customers-data-request.js`.
- **Conocimientos:** endpoint de solicitud de datos y delegación.
- **Funciones:** `onRequestPost`.
- **Logro esperado:** explicar qué afirma el handler sobre datos almacenados.

### 46. `tests/tiendanube-transfer.test.mjs`

- **Archivo a abrir:** `tests/tiendanube-transfer.test.mjs`.
- **Conocimientos:** pruebas de estados concurrentes, HMAC, rate limit, CORS y migración.
- **Funciones:** `transferPayload`, `prepare`, `signedWebhook` y escenarios de prepare/consume/complete/privacy.
- **Logro esperado:** usar este archivo como especificación ejecutable del backend completo y sus límites.

## Etapa 8 — Script que corre dentro del storefront Tiendanube

### 47. `tiendanube-script/build/backend-url.mjs`

- **Archivo a abrir:** `tiendanube-script/build/backend-url.mjs`.
- **Conocimientos:** URL parser, allowlist de host y variable de build.
- **Funciones:** `validateBackendUrl`, `resolveBackendUrl`.
- **Logro esperado:** explicar qué orígenes pueden quedar compilados y por qué el valor no se decide en runtime del storefront.

### 48. `tiendanube-script/src/transfer-core.mjs`

- **Archivo a abrir:** `tiendanube-script/src/transfer-core.mjs`.
- **Conocimientos:** eventos NubeSDK, closures, promesas secuenciales, timeout y lazy initialization.
- **Funciones:** `createSequentialCartAdder`, `createLazySequentialCartAdder`, `addOne`, `runSequentially`, `finish`, handlers success/fail.
- **Logro esperado:** explicar cómo correlaciona un evento con un ítem y conserva éxitos parciales sin borrar carrito previo.

### 49. `tiendanube-script/src/storefront-flow.mjs`

- **Archivo a abrir:** `tiendanube-script/src/storefront-flow.mjs`.
- **Conocimientos:** router SPA, session storage asíncrono, TTL, deduplicación y separación de efectos/presentación.
- **Funciones:** `summarizeDisplayResult`, `persistResultAndNavigate`, `displayStoredResult`, `isResultLocation`, `createLocationCoordinator`.
- **Logro esperado:** narrar ticket → transferencia → storage → navegación → render único → borrado.

### 50. `tiendanube-script/src/main.tsx`

- **Archivo a abrir:** `tiendanube-script/src/main.tsx`.
- **Conocimientos:** TypeScript, JSX NubeSDK, tipos, slots, fetch acotado, integración de módulos y eventos de ubicación.
- **Funciones:** `postJson`, `availableResultSlot`, `renderResult`, `executeTransfer`, `showStoredResult`, `App`.
- **Logro esperado:** explicar el recorrido storefront completo y separar agregado local de confirmación backend.

### 51. `tiendanube-script/tsup.config.js`

- **Archivo a abrir:** `tiendanube-script/tsup.config.js`.
- **Conocimientos:** bundling, entry/output, define en compile-time, alias JSX, ESM y minificación.
- **Funciones/estructuras:** `defineConfig`, callbacks `esbuildOptions` y `outExtension`.
- **Logro esperado:** reconstruir conceptualmente cómo las tres fuentes terminan en `assets/tiendanube/main.min.js`.

### 52. `tests/tiendanube-nubesdk.test.mjs`

- **Archivo a abrir:** `tests/tiendanube-nubesdk.test.mjs`.
- **Conocimientos:** harness de event bus/browser, microtasks, storage/routing y verificación de artefacto.
- **Funciones:** `nubeHarness`, `browserHarness`, `state` y casos de secuencia, timeout, primera interacción, resultado, URL y bundle.
- **Logro esperado:** poder defender con evidencia los invariantes del script y marcar como no identificada cualquier instalación real.

## Resultado final de estudio

Al completar las 52 entradas, deberías poder explicar cuatro límites sin mezclarlos:

1. estado/DOM de la landing;
2. persistencia D1 y sincronización Odoo del lead;
3. autorización, catálogo y ticket de transferencia en el backend;
4. consumo del ticket y agregado mediante NubeSDK dentro del storefront.

**INFORMACIÓN NO IDENTIFICADA:** este orden enseña lo versionado; no completa valores de producción, deployments, instalaciones OAuth activas ni registros externos que no están en el repositorio.
