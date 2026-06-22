# AGENTS.md — PrimOffice Landing

## Objetivo

Este repositorio contiene la landing comercial de PrimOffice.

La tarea general es mejorarla progresivamente sin reescribirla desde cero ni romper el flujo comercial existente.

Prioridades:

1. estabilidad;
2. captura de leads;
3. persistencia en Cloudflare D1;
4. sincronización con Odoo;
5. configurador Three.js;
6. responsive;
7. performance;
8. accesibilidad;
9. SEO;
10. refinamiento visual.

## Arquitectura actual

La aplicación es una landing estática basada en HTML, CSS y JavaScript.

Archivos activos principales:

* `index.html`
* `css/integracion-canonica.css`
* `css/pulido-visual.css`
* `css/comparacion-antes-despues.css`
* `js/pulido-visual.js`
* `js/comparacion-antes-despues.js`
* `js/config/app-config.js`
* `js/services/leads-service.js`
* `js/setup-3d.js`
* `functions/api/leads.js`

No asumir que otros archivos con nombres similares están activos. Verificar siempre las referencias reales desde `index.html`.

## Flujo comercial

El flujo que debe preservarse es:

1. landing;
2. test ergonómico de seis preguntas;
3. resultado preliminar;
4. captura de nombre y email o WhatsApp;
5. resultado completo;
6. carrito;
7. radar;
8. configurador 3D;
9. persistencia del lead en D1;
10. sincronización posterior con Odoo.

Un fallo de Odoo nunca debe provocar la pérdida del lead en D1.

## Nomenclatura comercial

Los niveles oficiales son:

* Starter
* Pro
* Epic

`Epic` es el nombre actual y oficial del nivel superior.
`Elite` es únicamente un valor legacy de entrada y debe normalizarse hacia `Epic`.
No crear, mostrar, guardar ni asignar nuevamente `Elite`.

Las etiquetas conceptuales de Odoo deben mantenerse separadas:

* origen: `Test - Landing`;
* resultado: `Setup Starter`, `Setup Pro` o `Setup Epic`;
* canal: `WhatsApp` o `Email`.

## Configurador 3D

El configurador activo está en `js/setup-3d.js` y utiliza Three.js.

No:

* reescribirlo desde cero;
* migrarlo a otra biblioteca;
* reemplazar su arquitectura sin justificación;
* eliminar cámara, zoom, rotación, reinicio o precarga por nivel;
* romper la relación con test, carrito o resultado.

Priorizar carga diferida, rendimiento móvil, limpieza de recursos WebGL y compatibilidad con el preview 2D.

## Backend y Odoo

La Function activa está en `functions/api/leads.js`.

No:

* incluir credenciales en el repositorio;
* mostrar API keys en logs;
* cambiar bindings sin revisar configuración;
* borrar leads o etiquetas;
* ejecutar pruebas masivas en producción;
* enviar datos de prueba reales sin aprobación.

Credenciales y configuración deben provenir de variables de entorno.

## Cloudflare D1

El binding esperado es `LEADS_DB`.

Verificar compatibilidad entre:

* payload del frontend;
* columnas D1;
* POST;
* PATCH;
* campos enviados a Odoo.

La base real puede contener migraciones que no están reflejadas en `db/schema_leads.sql`. No asumir que producción está rota únicamente por comparar el archivo local.

## Git y seguridad

Antes de modificar:

1. ejecutar `git status`;
2. revisar cambios existentes;
3. no sobrescribir trabajo no commiteado;
4. presentar un plan breve por archivos.

No ejecutar sin autorización:

* `git commit`;
* `git push`;
* `git reset --hard`;
* `git clean`;
* deploy;
* cambios DNS;
* cambios de variables Cloudflare;
* eliminación de registros;
* comandos destructivos.

## Dependencias

No agregar React, Vue, Angular, Next.js, Vite, frameworks, bundlers o dependencias nuevas sin autorización explícita.

No instalar paquetes para resolver tareas que puedan solucionarse con la arquitectura actual.

## Forma de trabajo

Para tareas amplias:

1. inspeccionar;
2. explicar el diagnóstico;
3. diferenciar problemas comprobados de sospechas;
4. proponer cambios por archivo;
5. realizar modificaciones mínimas;
6. revisar el diff;
7. verificar el comportamiento;
8. informar qué se pudo y qué no se pudo probar.

No declarar que algo funciona si no fue verificado.
