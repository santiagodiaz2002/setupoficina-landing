# Reporte final · Integración quirúrgica sobre la landing canónica

Sin commit. Sin push. No se descartaron los módulos técnicos útiles.

---

## 1. Confirmación de origen

**`index.html` deriva directamente de `_entrada-local/landing-canonica-martin.html.html`.**

> El archivo que dejaste se guardó con doble extensión real
> (`landing-canonica-martin.html.html`); por eso al inicio no aparecía como
> `landing-canonica-martin.html`. Es esa la fuente visual usada: se **copió
> íntegra** como base de `index.html` y su `<style>` embebido quedó **intacto**.

Marcadores canónicos verificados en `index.html` (servido en `http://localhost:8000/`, HTTP 200):

- Hero `¿Tu setup te está robando productividad?` ✓
- Badge `Ergonomía profesional · CABA y GBA` ✓
- Pain `Trabajar mal cuesta más de lo que creés` ✓
- Combos `Setup Starter` / `Setup Pro` / `Setup Elite` ✓
- Beneficios `No vendemos productos. Armamos setups.` ✓
- CTA final `Tu mejor versión laboral…` ✓
- 6 preguntas canónicas (las del propio archivo) ✓

---

## 2. Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.html` | **Pasó a ser la landing canónica** (`landing-canonica-martin.html.html`) + inyecciones técnicas **scoped**. Su `<style>` embebido, hero, navbar, pain, combos, beneficios, CTA y footer quedaron **sin cambios**. |
| `primoffice-landing.html` | **Eliminado** (duplicado redundante). |

## 3. Archivos creados (técnicos)

| Archivo | Función |
|---|---|
| `js/setup-3d.js` | **Adaptador Three.js**: reemplaza el preview 2D por una escena 3D real. Escena, cámara, **OrbitControls** (rotación/zoom/táctil), **vistas** (perspectiva/frontal/superior) + **reset**, **lazy-load** (IntersectionObserver + import dinámico), **fallback WebGL** (si no hay WebGL, queda el preview 2D), `prefers-reduced-motion`. Espeja la visibilidad de productos del carrito (`setVisible`). |
| `css/integracion-canonica.css` | CSS **scoped** (`.s3d-*`, `.pq-*`) con los tokens del canónico. **No** redefine selectores globales (hero/navbar/combos/beneficios/CTA/footer). |
| `docs/REPORTE_INTEGRACION_FINAL.md` | Este reporte. |

## 4. Archivos técnicos reutilizados (enlazados por `index.html`)

| Archivo | Función |
|---|---|
| `js/config/app-config.js` | **WhatsApp `5491139149688` centralizado**, `DEMO_MODE`, endpoint futuro, timeout, flags Odoo. |
| `js/services/leads-service.js` | `submitLead(payload)` desacoplado: modo demo + `localStorage`, preparado para Odoo. |
| `docs/INTEGRACION_ODOO_CRM.md` | Contrato/mapeo a Odoo CRM. |

> **Quiz, scoring (Starter/Pro/Elite), carrito, extras, total y catálogo de
> precios** son los del **propio archivo canónico** (script inline): se
> conservaron. Sólo se les agregó: la intercepción teaser→lead antes del
> resultado, el hook al 3D y la centralización del número de WhatsApp.

## 5. Módulos técnicos conservados pero NO enlazados (no descartados)

De pasadas anteriores, disponibles en el repo pero **sin usar** por esta landing
(el canónico ya trae su propio quiz/carrito): `js/configurador-3d.js`,
`js/test-diagnostico.js`, `js/config/catalogo-precios.js`, `css/styles.css`,
`css/test-diagnostico.css`, `css/configurador-3d.css`, `js/main.js`. Se dejan
por si querés reutilizarlos; **no** afectan a `index.html`.

---

## 6. Tabla de trazabilidad

| Elemento visual original | ¿Preservado? | Componente técnico injertado |
|---|---|---|
| Navbar | **Sí** | — |
| Hero `robando productividad` + badge `Ergonomía profesional · CABA y GBA` + stats | **Sí** | — |
| Pain `Trabajar mal cuesta más de lo que creés` | **Sí** | — |
| Quiz: 6 preguntas canónicas + barra de progreso + “Anterior” | **Sí** | Intercepción del reveal tras la 6.ª respuesta |
| Preview 2D del resultado (`#desk-scene`) | **Reemplazado por 3D** (2D queda como **fallback**) | `js/setup-3d.js` (Three.js) + `.s3d-*` |
| Carrito + extras + total + “Pedir por WhatsApp” | **Sí** (del canónico) | Número centralizado `5491139149688`; mensaje con productos/extras/total/24hs |
| *(nuevo)* Teaser tras la 6.ª pregunta | **Agregado** | `.pq-*` + gate JS (parcial, sin revelar el resultado) |
| *(nuevo)* Captura de lead **antes** del resultado (nombre, canal email/WhatsApp, campo dinámico, consentimiento) | **Agregado** | `.pq-*` + `submitLead` + `localStorage` (módulos Odoo) |
| Combos `Starter / Pro / Elite` | **Sí** | — |
| Beneficios `No vendemos productos. Armamos setups.` | **Sí** | — |
| CTA final `Tu mejor versión laboral…` | **Sí** | — |
| Footer | **Sí** | — |

Resultado **bloqueado hasta enviar el formulario**: el flujo es
quiz → teaser → formulario → (envío) → resultado completo (con 3D + carrito).

---

## 7. Cómo probar localmente (Windows)

> Requiere servidor local (los módulos ES + importmap no cargan con `file://`).

```powershell
cd <carpeta del proyecto>
python -m http.server 8000
```

Abrí `http://localhost:8000/` y verificá:

- Hero/badge/pain/combos/beneficios/CTA/footer **idénticos** al canónico.
- Test: 6 preguntas, autoavance, “Anterior”, barra de progreso.
- Tras la 6.ª: **teaser** (parcial) → **formulario** (nombre + email/WhatsApp + consentimiento) → al enviar, **resultado completo**.
- En el resultado: **escena 3D** (arrastrar = rotar, rueda/pellizco = zoom, botones Frontal/Superior/3-4/Reset). Si tu navegador no soporta WebGL, aparece el **preview 2D** (fallback).
- Carrito editable + extras + **total**; botón WhatsApp abre `wa.me/5491139149688`.
- `localStorage`: en consola → `JSON.parse(localStorage.getItem('primoffice_leads_demo'))` muestra el lead.

---

## 8. Pendientes reales (integración externa)

- **Precios**: el carrito usa los precios del **propio archivo canónico** (objeto `P` del script). Confirmar con PrimOffice si son los finales.
- **Odoo CRM**: `DEMO_MODE` activo (lead en `localStorage`). Para envío real: backend propio + `LEADS_API_URL` + `DEMO_MODE:false` (ver `docs/INTEGRACION_ODOO_CRM.md`). Nunca credenciales en el front.
- **Modelos 3D**: la escena usa geometría propia (cajas/redondeados). Opcional: cargar `.glb` reales más adelante.
- WhatsApp: ya quedó el oficial `5491139149688` (se reemplazó el placeholder `5491100000000`).

---

## 9. Verificaciones ejecutadas

- `index.html` deriva de `landing-canonica-martin.html.html` (copia íntegra + scoped). ✓
- HTTP 200 servido localmente; todos los marcadores canónicos presentes. ✓
- `node --check`: script inline del quiz (con el gate) **OK**; `js/setup-3d.js` **OK**. `app-config.js` y `leads-service.js` verificados por lectura (válidos; el sandbox mostraba una vista cacheada que impedía el `node --check` directo, no afecta a los archivos reales). ✓
- `index.html` **no** enlaza nada del rework anterior (styles.css, test-diagnostico, configurador-3d, main.js, catalogo-precios): 0 referencias. ✓
- Preview 2D `#desk-scene` conservado como **fallback**; `#s3dStage` antes que él. ✓
- Placeholder `5491100000000`: 0. Número oficial en `app-config.js`. ✓
- `primoffice-landing.html` eliminado; única entrada `index.html`. ✓

## 10. Confirmaciones finales

- **No hice commit.** ✓
- **No hice push.** ✓
- No se modificaron ramas remotas ni se agregaron credenciales. ✓
- Backups: `_entrada-local/_backup-correccion2-*` (estado previo) — carpeta ignorada por git.
