# Consultas corporativas de PrimOffice Empresas

Endpoint de producción: `POST https://setupoficina.com.ar/api/corporate-leads`.

Está aislado de `/api/leads`, Tiendanube y el diagnóstico Starter/Pro/Epic. Reutiliza el patrón XML-RPC del commit `fa324fac660cbc79283d272994d85c950f116a68` y las variables ya existentes en producción de Pages: `ODOO_ENABLED`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`. No requiere copiar secretos a Empresas ni al repositorio.

## Contrato

JSON con cadenas de texto: `nombre`, `empresa`, `email`, `phone` (WhatsApp), `tipo`, `cantidad`, `fecha`, `detalle`. Solo detalle es opcional. Email y WhatsApp se validan por separado, sin restricciones de dominio. Fecha usa `YYYY-MM-DD`. Límite total: 16 KiB. Se rechazan fechas pasadas, proyectos desconocidos, cantidades no enteras y campos demasiado largos.

Opcionales: `gclid`, `gbraid`, `wbraid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `landing_url`, `referrer`. Los click IDs/UTMs admiten hasta 512 caracteres; las URLs HTTP(S), hasta 2048, sin credenciales. El frontend conserva la atribución inicial no vacía en sessionStorage y no envía datos personales a los eventos GA4.

El frontend envía además `submission_id` (UUID v4), generado al primer submit válido. Lo conserva en memoria y sessionStorage durante errores/retries y recargas, y lo elimina al confirmar éxito. El backend todavía acepta clientes antiguos sin ID durante el despliegue escalonado; para esos clientes genera un UUID pero no puede deduplicar retries que no lo envíen.

Respuestas: 201 con `{ "ok": true, "id": 123 }` después de crear o recuperar el lead y verificar su metadata; 400 por datos inválidos; 403 por origen no permitido; 405 por método; 413 por tamaño; 415 por formato; 503 por indisponibilidad de Odoo. Los errores públicos y los logs no incluyen credenciales ni respuestas de Odoo. No se reintenta automáticamente la creación del lead.

CORS permite los orígenes `https://empresas.primoffice.com.ar`, `https://primoffice-empresas.primoffice.workers.dev` y localhost/127.0.0.1 en el puerto 8787 para desarrollo. OPTIONS responde 204. El frontend espera la confirmación del backend antes de convertir y ofrecer WhatsApp opcionalmente.

## Odoo

Consulta `crm.lead.fields_get` antes de construir los campos. Crea `{Empresa} — {Tipo de proyecto}`, guarda contacto, email en `email_from`, teléfono en `phone` y todos los datos comerciales en una descripción HTML escapada. Usa `partner_name` únicamente cuando el modelo lo admite. Resuelve o crea exclusivamente la etiqueta `Empresas - Landing`.

La única persistencia corporativa sigue siendo Odoo. D1 pertenece a otros flujos y no se modifica. Se usa exclusivamente el campo HTML existente `crm.lead.description`, ya incluido en el payload original de corporate-leads y en `functions/api/leads.js`. Conserva la descripción comercial legible y agrega un bloque visible `<pre>` delimitado por `--- PRIMOFFICE CORPORATE DATA v1 ---` y `--- END PRIMOFFICE CORPORATE DATA ---`. El bloque inicial y toda la atribución se envían en el mismo `crm.lead.create`, incluyendo `submission_id`. Antes de crear, se busca por ese UUID y la etiqueta `Empresas - Landing`, con `active_test: false`, y se compara el ID exacto del bloque parseado. No se deduplica por datos de contacto. Un retry recupera el ID existente.

El JSON contiene los ocho campos comerciales; `gclid`, `gbraid`, `wbraid`; `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`; `landing_url` y `referrer` iniciales; `submission_id`, `lead_id` real de Odoo y `created_at` UTC obtenido de `create_date`; `schema_version: 1`, `currency: "ARS"`, `status: "new"`, `estimated_value: null`, `quoted_value: null` y `won_value: null`. Los valores son importes decimales en ARS; `null` significa desconocido y se distingue de cero. Parámetros opcionales ausentes se conservan como strings vacíos.

`corporate-record.mjs` serializa con orden de claves determinista. El JSON se escapa como texto HTML, nunca como script, atributo ni comentario oculto. Secuencias `---` dentro de valores se representan con escapes JSON para impedir ambigüedad con los delimitadores, sin perder su contenido al recuperarlo. `parseCorporateRecord(description)` extrae el último bloque de una descripción HTML leída de Odoo, decodifica entidades una sola vez y valida versión/estado/importes. Devuelve `null` si no existe bloque y rechaza bloques incompletos o inválidos. La descripción humana previa al bloque se conserva. Los tests verifican recuperación de Unicode, saltos, entidades y delimitadores ingresados por el cliente; no sustituyen una comprobación futura del saneamiento real de Odoo.

Tras el create se lee el lead y su `create_date`, se reemplaza únicamente el JSON del bloque (conservando el HTML humano), y se verifica la escritura mediante una nueva lectura antes de responder éxito. No se inventan timestamps: si falta una fecha válida de Odoo, se devuelve 503. Si falla la lectura o el write, el UUID inicial permite recuperar el mismo lead y completar la metadata en el retry. La metadata ya completa no se reescribe.

El parser acepta históricos con `captured_at` y `final_sale_value`, conserva esas claves y expone `won_value` usando el valor histórico, incluido cero. No confunde captura con fecha real de creación ni migra leads anteriores.

El helper soporta `new`, `qualified`, `quoted`, `won`, `lost` y valores no negativos o null. El formulario no puede fijar estado, timestamp ni importes: se inicializan en el servidor. No se implementan UI, transiciones, importación offline ni sincronización con Google Ads. Una segunda etapa podrá recuperar el bloque y migrarlo a campos propios si se desea, o reemplazarlo conservando el texto comercial y la atribución original; las actualizaciones comerciales posteriores no forman parte de esta entrega.

## Publicación sin migración Odoo

NO hay migración Odoo requerida ni custom field requerido. Se eliminó la migración del campo personalizado. El endpoint consulta únicamente los campos nativos de `crm.lead` mediante `fields_get`, sin acceso a `ir.model.fields` ni permisos de administración de esquema. Se conservan las operaciones previas de lectura/creación de la etiqueta `Empresas - Landing`. El preflight temporal, no desplegable, comprueba `description` sin consultar modelos administrativos; nunca se ejecuta automáticamente como parte del endpoint.

Publicar primero el backend compatible y después el frontend, en una etapa autorizada. No se necesita acceso al VPS ni modificación de esquema para implementar este cambio. El backend devuelve 503 si falta un campo nativo requerido o falla Odoo y no degrada silenciosamente la atribución.

## Riesgo de infraestructura separado

RIESGO PREEXISTENTE: odoo.setupoficina.com.ar actualmente solo expone HTTP públicamente; su remediación de infraestructura queda fuera de esta entrega.

HTTPS no se considera resuelto. No se hicieron autenticaciones reales ni se enviaron credenciales por HTTP durante esta entrega. Las verificaciones funcionales usan transporte Odoo simulado y no acreditan disponibilidad actual de producción.

Se conservan `registrationPending` y `submitted`. El retry explícito con el mismo UUID recupera un create ya confirmado en Odoo, aunque su respuesta o la escritura posterior se hayan perdido. No hay retries automáticos. La búsqueda y el create son operaciones separadas: esto no establece una exclusión transaccional para dos requests independientes que lleguen simultáneamente antes de que exista el lead; el frontend serializa los envíos del formulario. No se agregan locks, tablas ni cambios de esquema.

Validación de este contrato: `node --test tests/corporate-leads.test.mjs tests/leads-defensive.test.mjs`. En el repo frontend: configurar `CORPORATE_BACKEND_DIR` al worktree del backend y ejecutar `npm test` para incluir la prueba integrada con respuesta 201 perdida. El harness `node tests/qa-server.mjs <backend>` usa Odoo en memoria y permite simular la pérdida con `POST /__qa/lose-next-response`.

## Validación local de la arquitectura sin migración — 2026-09-17

- Estado de partida: frontend `main` / `8462b102dc5d835bf83d756ac1cad97ba5b1a3dd`; backend `codex/corporate-leads` / `644313ab21e7e6c29ff6f5a7bfd6572d38334ab3`. Ambos con cambios locales Ads previos, preservados; no se usaron ZIPs ni se restauraron archivos desde commits.
- Frontend: `npm test`, 9/9. HTML, CSS, JS funcional/configuración y tests del formulario conservan sus hashes del inicio de esta tarea. Solo se adaptaron documentación y harness local al campo nativo.
- Backend corporativo y CRM previo: `node --test tests/corporate-leads.test.mjs tests/leads-defensive.test.mjs`, 24/24 (15 corporativos y 9 defensivos).
- Suite backend completa: `node --test tests/*.test.mjs`, 131/134. Los tres fallos son los preexistentes de Retry-After/content-type/tamaño y navegación/resultados del carrito en Tiendanube; no se repitió la investigación del baseline ni se modificaron esos módulos.
- Integración local del JS actual del formulario con el endpoint real y transporte Odoo simulado: descripción comercial + bloque recuperable, atribución completa, espera del ID positivo, un solo submit/conversión, WhatsApp opcional, error sin éxito y reintento exitoso.
- Bundle del endpoint compilado en memoria para Workers, sin referencias operativas al custom field o a la migración. Sintaxis del preflight y harness validada; `git diff --check` aprobado en ambos repos.
- No se hicieron pruebas reales de Odoo, modificaciones de infraestructura, commit, push, deploy ni importación offline.

## Verificación 10–11/09/2026

- Lead 74: prueba directa del endpoint, email, creación y lectura correctas.
- Lead 75: formulario público desktop 1440, email, datos correctos.
- Lead 76: formulario público mobile 390, teléfono, datos correctos.
- Los tres tienen nombre `[PRUEBA] PrimOffice Empresas — Kits de bienvenida`, empresa `[PRUEBA] PrimOffice Empresas`, contacto `[PRUEBA] QA corporativo`, cantidad 80 y fecha objetivo 2026-12-15.
- Etiqueta real: `Empresas - Landing`, ID 45, sin etiquetas del test.
- `fields_get` confirmó `partner_name` como `char` y `active` como `boolean`.
- Se archivaron solamente los tres leads de prueba y se verificó `active=false`.
- La herramienta y el token temporales de QA se retiran al cerrar la validación; no son parte del endpoint definitivo.

Pruebas: `node --test tests/corporate-leads.test.mjs tests/leads-defensive.test.mjs` (18 aprobadas). La suite general presenta tres fallos anteriores en `tiendanube-client.test.mjs` y `tiendanube-nubesdk.test.mjs`, reproducidos en un checkout limpio del commit base. Esos archivos y sus flujos no se modifican en esta integración.

## Notificación por email — implementación preparada el 25/09/2026

### Base y publicación reales, verificadas en solo lectura

El formulario de `primoffice-empresas/site/assets/js/main.js` llama a este endpoint.
`setupoficina-corporate-leads` es un worktree del repositorio GitHub
`santiagodiaz2002/setupoficina-landing`; su branch `codex/corporate-leads` en
`7ce37b01a11eba83dc1498cb21251b2399218eaf` no contiene la corrección posterior de
idempotencia. `git ls-remote` confirmó `main` en
`55fdd5a64e8b4f3a8b93bfa06054d0e4a27450ca`.

La API de Cloudflare y `wrangler pages deployment list` confirmaron ese mismo SHA
en el deployment de producción `452c5fc4-1af8-481d-8ad9-662adb4a883a`, exitoso el
18/09/2026. Proyecto Pages: `setupoficina-landing`, cuenta PrimOffice
`a29f0f240aa395b57629ff6d17aff7d4`, dominios `setupoficina.com.ar` y
`www.setupoficina.com.ar`. Integración GitHub activa, producción desde `main`,
trigger `github:push`, build `exit 0`, raíz del repositorio y salida `.`;
compatibility date `2026-06-12`, sin flags. No hay configuración Wrangler versionada.

El cambio se preparó en el worktree aislado
`C:\Users\Santi\Documents\GitHub\setupoficina-corporate-email`, branch
`codex/corporate-email-notification`, desde ese SHA. No requiere usar ni limpiar
el checkout local `setupoficina-landing`, ni mover el preflight no rastreado del
worktree original. El frontend Empresas no requiere cambios ni publicación.

### Funcionamiento y fallos

Tras `createCorporateLead` (creación/recuperación y metadata verificada), el endpoint
registra `notifyCorporateLead` con `context.waitUntil`. Mantiene el `201 {ok:true,id}`
inmediato del lead, sin esperar Resend ni modificar Analytics, WhatsApp o UX.
Los harnesses sin contexto Pages esperan la tarea para permitir pruebas deterministas.
La tarea tiene el presupuesto de 25 segundos del cliente Odoo existente, con hasta
8 segundos para Resend dentro de ese presupuesto. No agrega dependencias npm,
D1, colas, cron, endpoints ni cambios de esquema Odoo.

La notificación lee el registro confirmado de Odoo, no los campos arbitrarios del
request. Envía mediante `POST https://api.resend.com/emails` a
`info@primoffice.com.ar`, constante privada del backend. Asunto:
`Nueva consulta corporativa — {empresa}`; Reply-To: email del contacto.
Incluye contacto, empresa, email, teléfono, proyecto, cantidad, fecha objetivo,
detalle e ID real. Tiene texto plano y HTML escapado; el asunto elimina CR/LF.

Se agrega `notification` al bloque JSON existente en `crm.lead.description`,
conservando los campos comerciales, atribución y notas humanas. Antes del primer
envío se persiste y relee `status: pending`, `first_attempt_at`, una copia del
mensaje y la clave `corporate-lead/{submission_id}`. La misma clave se envía como
`Idempotency-Key`. Un retry usa exactamente el mensaje guardado, incluso si el
navegador cambia datos o luego se cambia el remitente configurado.

Sólo HTTP exitoso con JSON e ID UUID de Resend sin error permite guardar y verificar
`status: sent`, `provider_id` y `accepted_at`. Esto confirma aceptación por Resend,
no entrega al buzón. Los retries de un registro `sent` no llaman a Resend, aun días
después. Consultas distintas con distintos UUID siguen generando distintos leads
y correos aunque coincidan empresa/email/teléfono.

Resend retiene la idempotencia durante 24 horas. Si un envío queda incierto (timeout,
respuesta inválida, error de proveedor o fallo al guardar la aceptación), puede
reintentarse con el mismo UUID dentro de las primeras 23 horas. Después se registra
`corporate_notification_requires_review` y no se reenvía automáticamente: consultar
Resend y el buzón antes de cualquier recuperación manual. No borrar el estado ni
cambiar el UUID para forzar el retry. La marca `sent` persistida evita depender
de la ventana de Resend en el caso normal.

Un fallo del correo nunca revierte el lead ni convierte su confirmación en 503.
Se registran códigos fijos con `lead_id`, sin payload, secretos, excepciones ni
respuestas del proveedor: `corporate_notification_configuration_missing`,
`configuration_invalid`, `provider_failed`, `provider_invalid_response`,
`storage_failed`, `state_not_saved`, `state_invalid`, `lead_unconfirmed` o
`requires_review` (todos con prefijo `corporate_notification_`). El éxito emite
`corporate_notification_sent`. Configuración ausente impide iniciar el envío y
queda explícita en logs; un 201 por sí solo no acredita correo habilitado.

No existe procesamiento periódico de pendientes ni retry automático. Ante un
error, revisar los logs del deployment Pages y el lead indicado; corregir la causa
y repetir la consulta con su mismo UUID dentro de la ventana segura. Fuera de ella,
reconciliar manualmente el resultado en Resend antes de reenviar. Se conserva la
limitación previa: Odoo busca y crea en operaciones separadas, sin exclusión
transaccional entre dos requests independientes de un UUID aún inexistente. El
frontend serializa los submits; este cambio no modifica esa arquitectura.

### Configuración externa requerida antes de publicar

La inspección de producción encontró los bindings Odoo existentes (incluido el
secreto cifrado `ODOO_API_KEY`; no se leyó su valor) y ninguna configuración Resend.
Faltan `RESEND_API_KEY` y `CORPORATE_NOTIFICATION_FROM`. No se verificó una cuenta
Resend, un dominio de envío ni entrega real. No publicar este cambio como correo
habilitado hasta completar lo siguiente:

1. En [Resend](https://resend.com/domains), abrir **Domains > Add domain** y agregar
   el dominio o subdominio propio elegido para enviar. Si ya está verificado en la
   cuenta, reutilizarlo. El remitente debe pertenecer al dominio verificado.
2. Copiar exactamente los registros de verificación que muestre Resend (nombre,
   tipo y valor) al DNS autoritativo del dominio elegido. Para `primoffice.com.ar`,
   `nslookup -type=NS primoffice.com.ar` confirmó delegación a AWS Route 53
   (`ns-1311.awsdns-35.org`, `ns-214.awsdns-26.com`, `ns-659.awsdns-18.net`,
   `ns-1629.awsdns-11.co.uk`). En la cuenta que administra esa zona, abrir
   **AWS Route 53 > Hosted zones > primoffice.com.ar > Create record**. Si la zona
   es administrada por un proveedor, entregarle los registros exactos que muestra
   Resend; esta inspección no identifica al titular de la cuenta AWS. No cargarlos
   en una zona Cloudflare no autoritativa. No hay valores universales para inventar.
   Usar sólo los registros de envío indicados, sin reemplazar los
   MX de recepción del correo comercial. Volver a Resend y esperar **Verified**.
3. En **Resend > API Keys > Create API Key**, crear una clave **Sending access**
   restringida al dominio elegido. Copiarla para guardarla directamente en Cloudflare.
4. En [Cloudflare Pages: setupoficina-landing](https://dash.cloudflare.com/a29f0f240aa395b57629ff6d17aff7d4/pages/view/setupoficina-landing),
   abrir **Settings > Variables and Secrets**, seleccionar **Production** y agregar:
   - `RESEND_API_KEY`: clave de Resend, tipo **Secret / Encrypt**.
   - `CORPORATE_NOTIFICATION_FROM`: mailbox real del dominio verificado, opcionalmente
     con formato `PrimOffice <mailbox>`. No usar la dirección del visitante.
   Guardar ambos antes del deployment. No modificar los bindings Odoo existentes ni
   agregar estas variables a Empresas. `.env.example` sólo documenta nombres vacíos.

### Validación local y publicación posterior

Desde el worktree aislado:

```powershell
git diff --check
node --check functions/api/corporate-leads.js
node --check functions/_lib/corporate/corporate-notification.mjs
node --check tests/corporate-notification.test.mjs
node --test tests/corporate-notification.test.mjs tests/corporate-leads.test.mjs tests/leads-defensive.test.mjs
node ..\primoffice-empresas\node_modules\wrangler\bin\wrangler.js pages functions build functions --outdir .wrangler/notification-build --compatibility-date 2026-06-12
```

En Empresas, sin modificar archivos:

```powershell
$env:CORPORATE_BACKEND_DIR='C:\Users\Santi\Documents\GitHub\setupoficina-corporate-email'
npm test
```

Las pruebas de correo usan transporte Odoo/Resend simulado y bloquean red ajena.
El test integrado existente del frontend usa su configuración Odoo de prueba sin
Resend; comprueba que esa ausencia se registra y conserva el contrato anterior.
Resultado local: 55/55 tests del backend (24 nuevos y 31 existentes), 12/12 del
frontend sin skips, sintaxis y compilación Pages correctas. No se ejecutó publicación.

Cuando se autorice publicar, revisar los cinco archivos del cambio y confirmar que
la configuración está lista. Crear el commit de la branch aislada, subirla y hacer
la revisión/merge a `main` en GitHub. Pages tiene previews activados para todas las
branches: subir la branch puede generar un preview, y el merge a `main` dispara
producción automáticamente. Repetir las validaciones anteriores sobre el commit a
publicar y comprobar que Pages terminó exitosamente con ese SHA. No ejecutar deploy
desde el checkout local con cambios ajenos ni publicar la branch antigua
`codex/corporate-leads`. No se necesita desplegar el frontend.

Prueba controlada posterior al deploy: usar una empresa identificable `[PRUEBA EMAIL]`,
un contacto propio, datos válidos y fecha futura. Enviar desde Empresas y conservar
el JSON/`submission_id` del request en DevTools. Verificar `201 {ok:true,id}`, mensaje
de éxito y un solo lead con etiqueta `Empresas - Landing`. Esperar la tarea de correo
y verificar un único mensaje en `info@primoffice.com.ar`, asunto, ocho datos, ID y
Reply-To correctos. Repetir exactamente el request capturado (sin generar otro UUID):
debe devolver el mismo ID y conservar un solo lead y un solo email. Confirmar
`notification.status=sent`, ID del proveedor, un único `generate_lead` del submit
original y WhatsApp disponible sólo por clic explícito. La repetición HTTP manual
no debe generar un nuevo evento del navegador. No se hizo esta prueba real aquí.

Referencias: [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email),
[idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys),
[dominios](https://resend.com/docs/dashboard/domains/introduction),
[API keys](https://resend.com/docs/dashboard/api-keys/introduction),
[secretos Pages](https://developers.cloudflare.com/pages/functions/bindings/#secrets),
[waitUntil](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil).
