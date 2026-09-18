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
