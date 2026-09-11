# Consultas corporativas de PrimOffice Empresas

Endpoint de producción: `POST https://setupoficina.com.ar/api/corporate-leads`.

Está aislado de `/api/leads`, Tiendanube y el diagnóstico Starter/Pro/Epic. Reutiliza el patrón XML-RPC del commit `fa324fac660cbc79283d272994d85c950f116a68` y las variables ya existentes en producción de Pages: `ODOO_ENABLED`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`. No requiere copiar secretos a Empresas ni al repositorio.

## Contrato

JSON con cadenas de texto: `nombre`, `empresa`, `contacto`, `tipo`, `cantidad`, `fecha`, `detalle`. Cantidad y detalle son opcionales. El contacto debe ser email o teléfono; fecha usa `YYYY-MM-DD`. Límite total: 16 KiB. Se rechazan fechas pasadas, proyectos desconocidos, cantidades no enteras y campos demasiado largos.

Respuestas: 201 con `{ "ok": true, "id": 123 }` después de crear el lead; 400 por datos inválidos; 403 por origen no permitido; 405 por método; 413 por tamaño; 415 por formato; 503 por indisponibilidad de Odoo. Los errores públicos y los logs no incluyen credenciales ni respuestas de Odoo. No se reintenta automáticamente la creación del lead.

CORS permite los orígenes `https://empresas.primoffice.com.ar`, `https://primoffice-empresas.primoffice.workers.dev` y localhost/127.0.0.1 en el puerto 8787 para desarrollo. OPTIONS responde 204. El frontend inicia el registro sin esperar su resultado antes de abrir WhatsApp.

## Odoo

Consulta `crm.lead.fields_get` antes de construir los campos. Crea `{Empresa} — {Tipo de proyecto}`, guarda contacto, email o teléfono y todos los datos del proyecto en una descripción HTML escapada. Usa `partner_name` únicamente cuando el modelo lo admite. Resuelve o crea exclusivamente la etiqueta `Empresas - Landing`.

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
