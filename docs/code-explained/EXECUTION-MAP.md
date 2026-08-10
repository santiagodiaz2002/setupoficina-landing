# Mapa secuencial de ejecución

Cada recorrido de este archivo está respaldado por llamadas, imports, handlers o rutas presentes en el repositorio. Los pasos externos que no pueden comprobarse se marcan expresamente.

## Usuario abre la página

1. El navegador solicita `index.html`.
2. El `<head>` declara metadata, fuentes Google, cuatro CSS locales y preloads de diez capas PNG.
3. El navegador aplica primero CSS inline y después las hojas/enmiendas en su orden de aparición.
4. Se construyen navegación, hero, comparador, test, formulario, resultado, configurador, radar, combos y footer.
5. El IIFE inline obtiene referencias a nodos por ID.
6. Registra menú, quiz, carrito, formulario, combos, WhatsApp y observadores inline.
7. Inicializa la primera pregunta mediante `renderQ(0)`.
8. Publica `window.PrimOfficeHybridBridge` para conectar estado comercial y visualizador.
9. `js/pulido-visual.js` se ejecuta como script defer y crea fondo/animaciones/scroll reveal.
10. `js/comparacion-antes-despues.js` conecta el comparador de imágenes.
11. `js/config/app-config.js` publica `window.PrimOfficeConfig`.
12. `js/services/leads-service.js` publica `window.PrimOfficeLeads`.
13. `js/services/tiendanube-cart-transfer.js` publica `window.PrimOfficeTiendanube` y sincroniza visibilidad de botones según el flag.
14. `js/setup-visual-hybrid.js` importa configuración y calibración.
15. `autoInit()` consume `PrimOfficeHybridBridge`, crea capas y publica `window.SetupVisualHybrid`.
16. La interfaz queda lista sin solicitar APIs productivas.

`js/setup-3d.js` no aparece en esta secuencia porque no está cargado.

## Usuario responde una pregunta

1. `renderQ(step)` crea tres botones de opción.
2. El usuario pulsa una opción.
3. El handler comprueba `advancing` para evitar dobles elecciones durante la transición.
4. Guarda el score de la opción en `answers[step]`.
5. Marca visualmente la opción elegida.
6. Después de 420 ms incrementa `step`.
7. Si quedan preguntas, vuelve a ejecutar `renderQ(step)`.
8. Si terminó la sexta, llama `pqOnComplete()`.

## Usuario termina el test

1. `pqOnComplete()` llama `buildCart(answers)`.
2. `buildCart()` suma respuestas y deriva Starter, Pro o Epic.
3. Devuelve la selección de productos recomendados.
4. `renderCart()` crea los checkboxes del carrito.
5. `updateTotal()` calcula el total estático en ARS.
6. `updatePreview()` sincroniza visualizador y radar.
7. El resultado completo permanece oculto.
8. Se muestra el teaser que invita a desbloquear la recomendación.

## Usuario abre el formulario de lead

1. Pulsa `pqTeaserCta`.
2. El handler oculta el teaser.
3. Muestra `pqLead`.
4. Intenta enfocar `pqNombre`.
5. Cambiar el radio de canal llama `pqUpdateCanal()`.
6. `pqUpdateCanal()` habilita y requiere email o WhatsApp, nunca ambos a la vez.

## Usuario envía el formulario

1. El evento `submit` llama `pqSubmit(event)`.
2. `preventDefault()` evita el envío HTML tradicional.
3. `pqValidate()` comprueba nombre, canal, contacto y consentimiento.
4. Si falla, muestra errores y no crea ninguna sesión de lead.
5. `pqPayload()` reúne formulario, respuestas, score, preset, productos, total, UTM y metadata.
6. El botón queda deshabilitado mientras se procesa.
7. Si existe `window.PrimOfficeLeads`, llama `submitLead(payload)`.
8. En modo local/demo, el servicio intenta guardar bajo `primoffice_leads_demo` y no hace fetch.
9. En modo real, `enviarReal()` hace POST JSON a `/api/leads` con timeout.
10. Una respuesta fallida restaura el botón, mantiene el formulario y muestra error.
11. Una respuesta exitosa llama `storeLeadSession(payload, result)`.
12. Se guarda `leadId` y posible ID Odoo sólo en memoria.
13. El formulario/teaser se ocultan.
14. El resultado completo se muestra y se desplaza a la vista.

## Backend recibe POST `/api/leads`

1. Cloudflare Pages enruta a `functions/api/leads.js:onRequestPost`.
2. Exige el binding `env.LEADS_DB`.
3. Comprueba `Content-Length` declarado.
4. Parsea JSON.
5. `validatePayload()` exige los campos mínimos.
6. `normalizeLeadPayload()` normaliza teléfono, tier y preset.
7. Extrae contacto, diagnóstico, configuración, UTM y metadata del request.
8. Genera un `leadId` sólo si el frontend no lo envió.
9. Prepara un INSERT con 19 placeholders.
10. Enlaza los valores mediante `.bind()`.
11. Ejecuta `.run()` sobre D1.
12. Si D1 falla, responde `500` y no inicia Odoo.
13. Si D1 guarda, llama `sendToOdoo()`.
14. Si Odoo está desactivado o incompleto, devuelve un resultado `skipped`.
15. Si está activo, autentica, resuelve tags y crea `crm.lead`.
16. Actualiza en D1 las cuatro columnas de estado Odoo.
17. Devuelve `201` con `leadId` y estado Odoo.

## Odoo crea un lead

1. `getOdooSession()` comprueba cinco variables de entorno.
2. `xmlRpcCall()` serializa `authenticate` y parámetros a XML.
3. Hace POST a `/xmlrpc/2/common`.
4. Parsea el `uid` de respuesta.
5. `buildOdooLead()` construye campos de `crm.lead`.
6. `resolveRequiredLeadTags()` determina origen, tier y canal.
7. Por cada nombre busca `crm.tag`; si falta, intenta crearlo.
8. Construye el comando many-to-many para `tag_ids`.
9. `xmlRpcCall()` envía `execute_kw` a `/xmlrpc/2/object` con modelo `crm.lead` y método `create`.
10. Odoo devuelve un ID numérico.
11. Ese ID se guarda en D1.

**INFORMACIÓN NO IDENTIFICADA:** la configuración y respuesta del Odoo real no se consultaron.

## Usuario modifica el configurador después del lead

1. Pulsa un checkbox o producto del rail.
2. El handler deriva el `internalId`.
3. Llama `updateProductSelection()`/`updateProductSelections()`.
4. Cambia `cartState` o `extrasState`.
5. Actualiza checkboxes, total, capas, mini panel y radar.
6. Construye un payload PATCH con el mismo `leadId`.
7. Calcula una firma ordenada de productos/extras/total.
8. Si no cambió, no envía nada.
9. Si cambió, programa un timer de 1.000 ms.
10. Cambios adicionales reinician el timer.
11. Al vencer, `PrimOfficeLeads.updateLead()` hace PATCH a `/api/leads`.

## Backend recibe PATCH `/api/leads`

1. Exige `LEADS_DB` y valida/normaliza el payload.
2. Exige `leadId`.
3. Busca `odoo_lead_id` desde D1.
4. Si no existe el lead, responde `404`.
5. Si existe ID Odoo, autentica nuevamente.
6. Lee tags actuales de `crm.lead`.
7. Separa tags externos de los administrados por PrimOffice.
8. Construye el conjunto final y ejecuta `crm.lead.write`.
9. Actualiza en D1 contacto, diagnóstico, total, productos, payload y estado Odoo.
10. Devuelve `200` con `updated:true`.

## Usuario selecciona Starter, Pro o Epic en el preview

1. Pulsa un botón con `data-combo-action="preview"` o sin acción explícita.
2. El listener común lee `data-combo-preset`.
3. `prepareComboPreset()` llama `applyComboPreset()`.
4. La lista de `COMBO_PRESETS` se transforma en cambios booleanos para todos los productos conocidos.
5. El carrito se vuelve a renderizar.
6. El visualizador recibe el preset presentado y la selección.
7. El radar anima hacia nuevos valores.
8. Se muestra feedback y se resalta el carrito personalizado.
9. Si ya existe lead, se programa PATCH.

## Usuario cambia un producto visual

1. Pulsa o activa con teclado un elemento `[data-rail-product]`/`[data-setup-product]`.
2. `setup-visual-hybrid.js` obtiene el ID por evento delegado.
3. Verifica que sea producto visual conocido.
4. Llama al callback `toggleProduct` del bridge.
5. El bridge delega al estado comercial de `index.html`.
6. Se actualizan carrito y extras.
7. `sync()` recibe el estado nuevo.
8. `deriveVisibleSetupLayers()` elige escritorio y capas.
9. `renderScene()` modifica visibilidad/transform de imágenes.
10. `renderRail()` y `updateMiniPanel()` reflejan inclusión/foco.

## Usuario activa `?calibrate=1`

1. `isSetupCalibrationEnabled(location.search)` devuelve true sólo para valor `1`.
2. El compositor intenta obtener almacenamiento local.
3. Crea `createSetupCalibrationController()`.
4. Lee/sanitiza offsets existentes por escritorio.
5. Construye el panel temporal.
6. Drag o flechas calculan desplazamientos en coordenadas del canvas lógico.
7. Persiste offsets bajo `primoffice_setup_calibration_v3`.
8. Puede resetear, copiar o descargar JSON.
9. La captura de botones de preset cambia la vista de calibración sin mutar el carrito.

## Usuario pide un combo por WhatsApp

1. Pulsa un botón con `data-combo-action="whatsapp"`.
2. `requestComboWhatsApp()` prepara el preset.
3. Construye el texto con combo, productos y total.
4. Si existe sesión de lead, `openExternalAfterLeadUpdate()` espera el PATCH correspondiente.
5. `openWhatsAppMessage()` obtiene el número desde configuración o fallback.
6. Codifica el mensaje.
7. Abre `https://wa.me/{numero}?text={mensaje}`.

No existe respuesta de WhatsApp consumida por el proyecto.

## Usuario pulsa comprar con Tiendanube deshabilitada

1. El listener identifica `data-combo-action="purchase"`.
2. `tiendanubeCartBridgeEnabled()` lee `PrimOfficeConfig.TIENDANUBE_ENABLED`.
3. El valor versionado actual es `false`.
4. `buyComboInPrimOffice()` elige la URL fija de Starter/Pro/Epic.
5. Abre el combo en `www.primoffice.com.ar`.

## Usuario pulsa comprar con Tiendanube habilitada

1. El flag público debe ser booleano true.
2. `selectedTiendanubeTransferItems()` produce `{internalId, quantity}`.
3. `PrimOfficeTiendanube.transferSelection()` comprueba que no exista `inFlight`.
4. Deshabilita todos los botones de transferencia y muestra estado pendiente.
5. `normalizeTransferItems()` valida IDs, cantidades y duplicados.
6. `crypto.randomUUID()` genera `clientRequestId`.
7. Hace POST a `/api/tiendanube/cart-transfer`.

## Backend prepara el ticket Tiendanube

1. Pages enruta al wrapper `functions/api/tiendanube/cart-transfer.js`.
2. El wrapper llama `handleCartTransfer()`.
3. Se exige `TIENDANUBE_ENABLED=true` en entorno.
4. Se construye la allowlist Setup y se valida `Origin`.
5. `readJsonBody()` exige Content-Type JSON y tamaño máximo.
6. `normalizeSelectionPayload()` acepta sólo `clientRequestId` e `items`.
7. El rate limit D1 de prepare se incrementa.
8. Se exige Store ID configurado.
9. `loadAuthorizedCatalog()` consulta filas enabled por IDs internos.
10. Si un ID no está autorizado, responde antes de consultar Tiendanube.
11. `clientFromEnv()` obtiene el access token cifrado desde instalación D1 en producción.
12. `resolveCatalogSelection()` consulta cada producto real.
13. Verifica visibilidad, variante, stock y precio.
14. Genera ticket de 32 bytes y su SHA-256.
15. Inserta ticket hash, selección, resueltos/no disponibles, estado pending y expiración.
16. Construye redirect permitido con `setupoficina_ticket`.
17. Devuelve `201`.
18. El frontend valida nuevamente la URL.
19. `location.assign()` abre el storefront.

## Storefront consume y agrega el setup

1. El script NubeSDK recibe una ubicación con `setupoficina_ticket`.
2. `createLocationCoordinator.handle()` evita repetirlo en la misma instancia.
3. `executeTransfer()` llama POST `/consume` con ticket y Store ID.
4. El backend valida origen storefront, flag, rate, ticket y tienda.
5. Si está pending o su lease anterior venció, genera processing token y hash.
6. Actualiza estado a processing y devuelve IDs reales/no disponibles.
7. `createLazySequentialCartAdder()` crea el agregador real en el primer uso.
8. Para cada ítem envía `cart:add` con product ID, variant ID y cantidad.
9. Espera éxito/fallo/timeout antes del siguiente.
10. Separa `added` y `failed`.
11. Añade los `unavailable` informados por backend.
12. Llama POST `/complete` con ticket, processing token, tienda y resultado.
13. El backend verifica que se reporte exactamente el conjunto permitido y cantidades originales.
14. Marca completed en D1.
15. El script guarda el resultado temporal antes de navegar.
16. Navega a `/cart?setupoficina_result=1`.

## Storefront muestra el resultado

1. La ubicación inicial o `location:updated` contiene `setupoficina_result=1` y path `/cart`.
2. El coordinador llama `showStoredResult()` una vez.
3. `displayStoredResult()` lee la clave temporal.
4. Parsea y valida `added`/`failed`.
5. `availableResultSlot()` consulta slots estáticos oficiales.
6. Prefiere `corner_top_right`; usa `modal_content` sólo si está disponible y el primero no.
7. `summarizeDisplayResult()` separa agregados, stock, otros fallos y fatal.
8. `renderResult()` envía Toast o Column al SDK.
9. Sólo si se mostró, elimina la clave temporal.

## Operador inicia OAuth Tiendanube

1. Abre `/api/tiendanube/oauth/start` en el origen configurado.
2. El backend valida método/origen/path, D1, App ID y configuración de entorno.
3. Aplica rate limit.
4. Comprueba que no haya instalación activa.
5. Genera state aleatorio, guarda sólo SHA-256 durante 600 segundos.
6. Coloca el state original en cookie segura.
7. Redirige a Tiendanube authorize.
8. Tiendanube devuelve code/state al callback configurado.
9. El callback valida query, cookie, hash, entorno, expiración y consumo atómico.
10. Intercambia code por token.
11. Valida scopes exactos.
12. Consulta la tienda y valida Store ID/dominio esperado.
13. Cifra el token con AES-256-GCM.
14. Inserta/actualiza instalación D1 según las reglas del código.
15. Devuelve HTML sanitizado.

**INFORMACIÓN NO IDENTIFICADA:** este flujo no se ejecutó contra Tiendanube real.

## Tiendanube envía un webhook de privacidad

1. La ruta wrapper llama `handlePrivacyWebhook()` con su tipo fijo.
2. Aplica rate limit.
3. Lee el cuerpo crudo con máximo declarado.
4. Obtiene `x-linkedstore-hmac-sha256`.
5. Calcula HMAC con `TIENDANUBE_CLIENT_SECRET`.
6. Compara firma en tiempo constante.
7. Parsea JSON sólo después de verificar autenticidad.
8. Rechaza campos comerciales prohibidos.
9. Para `store-redact`, elimina datos del puente mediante batch D1.
10. Para callbacks de cliente, confirma que no se conserva PII de clientes.

## Operador genera SQL de catálogo

1. Ejecuta `tools/tiendanube-sync-catalog.mjs --output db/generated/algo.sql` con variables de entorno.
2. `parseArguments()` rechaza tokens/secrets como argumentos.
3. `resolveOutputPath()` confina la salida.
4. Lee y valida `config/tiendanube-catalog.json`.
5. Crea el cliente Tiendanube.
6. Por cada SKU consulta hasta 20 páginas.
7. Exige exactamente una variante coincidente.
8. Genera una transacción con UPSERT por entrada.
9. Escribe de modo exclusivo salvo `--force`.
10. Se detiene: no ejecuta el SQL contra D1.

La aplicación local o remota de ese SQL es un paso operativo externo y no se realizó.
