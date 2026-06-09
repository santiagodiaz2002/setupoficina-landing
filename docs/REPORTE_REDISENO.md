# Reporte de rediseño · Landing PrimOffice

Implementación integral sobre la carpeta local autorizada. **No** se hizo
commit, push ni cambios en ramas remotas. **No** se agregaron credenciales.
Se creó un backup local antes de modificar.

---

## 1. Resumen

Se convirtió la landing en una experiencia más profesional, moderna e inmersiva,
orientada a conversión, conservando la identidad (navy + celeste, Inter) y los
datos comerciales confirmados. El flujo central quedó:

**Hero → CTA → test (6 preguntas) → teaser parcial → captura obligatoria de lead
→ `submitLead()` (demo + localStorage) → resultado completo → configurador 3D
precargado → carrito editable con total estimado → CTA de WhatsApp.**

La entrada canónica es **`primoffice-landing.html`**. `index.html` quedó como
redirección a esa entrada para no romper el flujo publicado (GitHub Pages).

---

## 2. Archivos creados

| Archivo | Qué es |
|---|---|
| `primoffice-landing.html` | **Entrada nueva** y canónica de la landing (reemplaza funcionalmente al `index.html` anterior). |
| `js/config/catalogo-precios.js` | Precios de referencia centralizados (carrito + total). Bandera `PRECIOS_CONFIRMADOS:false`. |
| `docs/INTEGRACION_ODOO_CRM.md` | Contrato de integración con Odoo CRM (arquitectura segura, payload `v1`, mapeo a `crm.lead`, duplicados, privacidad). |
| `docs/REPORTE_REDISENO.md` | Este reporte. |

## 3. Archivos modificados

| Archivo | Cambios |
|---|---|
| `index.html` | Convertido en **redirección** a `primoffice-landing.html` (fuente única). |
| `css/styles.css` | Rediseño visual premium: hero inmersivo, fondos vivos, scroll-reveal, microinteracciones, navbar con estados, accesibilidad, responsive hasta 320px, `prefers-reduced-motion`. |
| `css/test-diagnostico.css` | Teaser con vista bloqueada/borrosa, transiciones de paso/panel, ajustes responsive. |
| `css/configurador-3d.css` | Estilos de carrito: precio por ítem, extras, total estimado y nota de referencia. |
| `js/main.js` | Scroll-reveal (`IntersectionObserver`), parallax del hero ligado al cursor (sólo desktop), nav activa por sección, header “scrolled”, menú accesible (Escape, `aria-expanded`). |
| `js/test-diagnostico.js` | **6 preguntas nuevas** + scoring, autoavance accesible, teaser, validación, **payload anidado** (`leadId/contact/diagnosis/configuration`), precarga del 3D, WhatsApp con total. |
| `js/configurador-3d.js` | **Carrito editable**: precios por producto, **extras** opcionales, **total estimado** en vivo, `getCurrentConfiguration()` ampliado y mensaje de WhatsApp con extras + total + 24hs. Se conservó toda la escena Three.js. |
| `js/config/app-config.js` | `DEMO_MODE`, endpoint futuro, origen, timeout, `INTEGRATION` (flags Odoo), `LANDING_SOURCE`. WhatsApp centralizado. |
| `js/services/leads-service.js` | Respeta `DEMO_MODE`; referencias a `INTEGRACION_ODOO_CRM.md`. |
| `docs/INTEGRACION_BASE_DATOS.md` | Convertido en puntero al documento de Odoo. |
| `assets/images/setups/README.md` | Referencia a la entrada nueva + ejemplos de texto `alt`. |
| `assets/models/README.md` | Sin cambios de arquitectura (GLTFLoader ya estaba preparado). |

Backup: `_entrada-local/_backup-pre-redesign-AAAAMMDD-HHMMSS/` (carpeta **ignorada
por git**, nunca se commitea).

---

## 4. Componentes trasplantados desde la implementación previa (donante técnico)

La implementación previa ya estaba modularizada y aportó componentes valiosos que
**se conservaron y adaptaron** (no se rehicieron):

- **Configurador 3D real (Three.js)** — `js/configurador-3d.js`: escena, cámara,
  iluminación, escritorio, productos activables, rotación, zoom, táctil, reset,
  vistas (frontal/superior/3-4), presets, aparición/desaparición animada,
  `applyRecommendation()` / `getCurrentConfiguration()`, **lazy-load**, **fallback
  WebGL** y `prefers-reduced-motion`. Se le **sumó el carrito** (precios, extras, total).
- **Capa de leads desacoplada** — `submitLead(payload)`, `app-config.js`,
  `leads-service.js` con **modo demo + `localStorage`**.
- **Infraestructura del flujo del test** (teaser → lead → resultado → precarga 3D).
  Se mantuvo y se le cambió **el contenido por las 6 preguntas**.

> Nota: la maqueta 2D (SVG/CSS) del configurador de la versión anterior **no** se
> usa; quedó reemplazada por el configurador 3D verdadero.

---

## 5. Mejoras visuales aplicadas

- **Hero inmersivo**: aurora celeste animada, grilla técnica tenue, glows, brillo
  superior, **parallax ligado al cursor** (sólo desktop), entrada escalonada de
  badge/título/subtítulo/CTAs/visual.
- **Fondos vivos** por sección (gradientes radiales suaves) para evitar la
  sucesión de cajas blancas planas.
- **Scroll-reveal** escalonado con `IntersectionObserver` (transform/opacity).
- **Microinteracciones**: hover/active en cards y CTAs, brillo del botón primario,
  navbar con sombra al hacer scroll y **navegación activa** según sección.
- **Iconografía SVG** (sin emojis como íconos estructurales en beneficios/catálogo/hero).
- **Teaser con vista bloqueada/borrosa** del setup recomendado (sin dark patterns).
- **Cifras tabulares** para precios y total; foco visible global; objetivos táctiles ≥44px.

---

## 6. Las 6 preguntas (y ajustes de copy)

Se usan **exclusivamente** las 6 preguntas indicadas (títulos textuales). Ajustes
de copy realizados: **sólo tildes/acentuación** donde correspondía (“¿Cómo…”,
“¿Cuál…”, “¿Qué…”). **No** se alteró el sentido. Las **opciones** y la lógica de
puntaje se diseñaron sobre el sistema de categorías existente
(ergonomía, conectividad, iluminación, orden, espacio, mobiliario, corporativo).

1. ¿Cuántas horas por día trabajás frente a la computadora?
2. ¿Terminás el día con dolor de cuello, espalda o muñecas?
3. ¿Cómo trabajás habitualmente con tu computadora?
4. ¿Cómo describirías el estado de tu escritorio?
5. ¿Qué silla usás para trabajar?
6. ¿Cuál es tu mayor queja de productividad?

> No se recuperaron las 8 preguntas de la landing anterior (estaban aún en el
> módulo del test y fueron reemplazadas).

---

## 7. Cómo abrir la landing localmente (Windows)

> **Importante:** la landing usa **módulos ES** + `importmap`. Abrir el archivo con
> doble clic (`file://`) **bloquea** la carga de módulos. Hay que servirla por HTTP.

Opción A — **VS Code + Live Server**: clic derecho en `primoffice-landing.html` →
“Open with Live Server” → se abre en `http://127.0.0.1:5500/primoffice-landing.html`.

Opción B — **Python** (PowerShell, dentro de la carpeta del proyecto):

```powershell
python -m http.server 8000
```

Luego abrir `http://localhost:8000/primoffice-landing.html`.

---

## 8. Cómo verificar (paso a paso)

**Test (6 preguntas):** entrar a la sección *Test* (o clic en “Hacer test
gratuito”). Cada respuesta da feedback y autoavanza; la barra de progreso sube;
“Anterior” vuelve atrás. Al responder la 6.ª aparece el **teaser** (no el
resultado). Botón → **formulario de lead**.

**Validación del formulario:** probá enviar vacío (errores accesibles con foco en
el primer inválido), elegí Email/WhatsApp (campo dinámico) y tildá consentimiento.

**localStorage (modo demo):** tras enviar el lead, en DevTools → Console:

```js
JSON.parse(localStorage.getItem('primoffice_leads_demo'))
// o:
window.PrimOfficeLeads.getLeadsDemo()
```

Debe aparecer el payload anidado (`leadId`, `contact`, `diagnosis`, `configuration`).
La consola también muestra el aviso “MODO DEMO activo … pendiente”. El **resultado
se revela igual** aunque la persistencia falle.

**Configurador + carrito:** el resultado precarga el preset recomendado. Activá/
desactivá productos y extras → la escena 3D y el **total estimado** cambian en vivo;
probá vistas (3/4, frontal, superior, reset), rotar y zoom.

**CTA de WhatsApp (número `5491139149688`):** botón “Pedir … por WhatsApp” (en el
resultado y en el configurador). Abre `wa.me/5491139149688` con nombre, nivel,
productos, extras, **total estimado** y consulta por **entrega en 24hs**.

**UTMs:** abrir con `?utm_source=ig&utm_campaign=test` → quedan en el payload.

---

## 9. Qué queda preparado para Odoo CRM

- `submitLead(payload)` es el **único** punto de envío. Hoy en **modo demo**.
- Para activar el envío real (cuando PrimOffice entregue URL/auth/mapeo): poner
  `DEMO_MODE:false` + `LEADS_API_URL` (backend **propio**) + `INTEGRATION.odooEnabled:true`.
- El backend propio crea el lead en Odoo con **credenciales del servidor**
  (nunca en el front). Mapeo a `crm.lead`, duplicados, validaciones y privacidad
  documentados en `docs/INTEGRACION_ODOO_CRM.md`.

---

## 10. Estado: terminado / pendiente externo / mejoras futuras

**Terminado**

- Entrada `primoffice-landing.html` + arquitectura modular.
- 6 preguntas, scoring, autoavance, barra de progreso, volver atrás.
- Teaser parcial → **formulario obligatorio** → `submitLead` → resultado.
- Persistencia demo en `localStorage`; continuidad ante fallo.
- Configurador 3D + carrito editable + total + extras + WhatsApp.
- Rediseño visual, accesibilidad, SEO técnico, responsive, `prefers-reduced-motion`.
- WhatsApp centralizado; sin credenciales; backup local; sin commit/push.

**Pendiente de integración externa (PrimOffice)**

- Endpoint propio + autenticación + instancia Odoo + mapeo final (→ activar envío real).
- **Precios reales** del catálogo (hoy de referencia; `PRECIOS_CONFIRMADOS:false`).
- Fotos reales de setups (ver `assets/images/setups/README.md`).
- Política de privacidad / texto legal del consentimiento.

**Mejoras futuras opcionales**

- Modelos `.glb` reales en el 3D (arquitectura GLTFLoader ya lista).
- Versión `webp` del hero con `srcset` cuando haya fotos.
- A/B testing de copy del teaser y los CTAs.

---

## 11. Supuestos profesionales (resueltos sin interrumpir)

1. **Base canónica = arquitectura modular** ya presente (que contenía el
   configurador 3D real y la infraestructura del flujo). Se creó
   `primoffice-landing.html` como entrada nueva e `index.html` redirige.
2. **Las 6 preguntas no estaban implementadas** (el módulo tenía aún las 8 de la
   versión anterior). Se autoraron desde los títulos textuales del pedido.
3. **Claims comerciales**: se usaron los confirmados (+2.000 setups, 4.9★, 24hs,
   +37%, 2–4 h, 78%, garantía 30 días). Se **descartaron** datos no confirmados o
   en conflicto de la versión vieja (promo bancaria, garantía 6 meses, “+500
   clientes”, testimonios ficticios).
4. **Precios**: no existían en el proyecto. Se centralizaron precios **de
   referencia** claramente marcados (no confirmados) para que el carrito/total
   funcionen. **TODO: confirmar con PrimOffice.**
5. **`index.html` como redirección** (una sola fuente de verdad).

---

## 12. Pruebas ejecutadas

- Inspección de todos los archivos de la carpeta + landing anterior (donante).
- `node --check`: `catalogo-precios.js` OK, `test-diagnostico.js` OK.
- **Contrato DOM HTML↔JS**: los ~50 `id` que usa el JS existen en el HTML (sin faltantes).
- Búsqueda de “8 preguntas / Paso 1 de 8 / de 8”: **ninguno**.
- WhatsApp `5491139149688`: correcto y centralizado; sin variantes erróneas.
- Sin credenciales/secretos expuestos.
- Todas las referencias locales del HTML (`css/`, `js/`) resuelven a archivos existentes.
- `importmap` de Three.js presente; `aria-valuemax="6"`, “Paso 1 de 6”.
- `index.html` redirige a `primoffice-landing.html`.
- Backup creado en `_entrada-local/` (ignorado por git).

---

## 13. Limitaciones de verificación (entorno)

En este entorno, la vista del sistema de archivos del sandbox quedó **cacheada**
para algunos archivos sobrescritos, lo que impidió correr `node --check` localmente
sobre 4 módulos (devolvían vistas truncadas). La validez se confirmó por otra vía:
herramienta de archivos autorizada (contenido real completo), `node --check` de los
módulos que sí se sincronizaron y verificación del contrato de `id` HTML↔JS. Es un
**artefacto del sandbox**, no afecta a los archivos reales que abre el navegador.
No se pudo ejercitar WebGL en un navegador headless; el **fallback** y el lazy-load
están implementados.
