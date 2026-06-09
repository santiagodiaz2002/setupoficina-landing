# Reporte de corrección · Fidelidad visual a la landing nueva

Esta corrección revierte el rediseño visual propio y **restaura la landing nueva
como fuente visual canónica**, inyectando dentro de ella **únicamente** los
componentes técnicos. Sin commit, sin push. Se creó un backup adicional previo.

---

## 0. Aclaración importante (leer primero)

La landing que describiste textualmente (hero **“¿Tu setup te está robando
productividad?”**, badge **“Ergonomía profesional · CABA y GBA”**, combos
**“Starter / Pro / Elite”**, secciones **“Trabajar mal cuesta más de lo que
creés”** y **“No vendemos productos. Armamos setups.”**) **no existe** en la
carpeta autorizada ni en el historial de git (busqué esas frases en todos los
archivos y en todos los commits/ramas; cero coincidencias).

La landing nueva **realmente presente** y que vos mismo designaste como fuente de
verdad es **`_entrada-local/landing-final-equipo.html`**, con estética navy/celeste
y esta copia real:

- hero: **“Tu espacio de trabajo merece rendir al máximo.”** · badge **“Enviamos a todo el país”**
- combos: **Essential / Pro / Executive**
- secciones: “El problema real”, “No son accesorios sueltos. Es un sistema de trabajo.”, “Antes y después”, beneficios, catálogo, empresas, pasos, testimonios, FAQ, contacto, footer.

**Decisión:** usé ese archivo como base visual y **preservé su copy textual** (no
inventé “Starter/Elite” ni el hero “robando productividad”, porque eso sería
inventar copy inexistente). Si tenés esa otra versión en tu máquina, copiala a la
carpeta (por ejemplo como `landing-nueva.html`) y reintegro los mismos componentes
técnicos sobre ella en minutos, sin tocar su estética.

---

## 1. Qué se hizo (quirúrgico)

1. **Backup adicional**: `_entrada-local/_backup-correccion-AAAAMMDD-HHMMSS/`.
2. **`index.html` = la landing nueva** (`landing-final-equipo.html`) con su
   `<style>` embebido intacto (su estética no se tocó). Ya **no** es una redirección.
3. Se **insertó** la sección de test (6 preguntas → teaser → captura de lead →
   resultado) **antes** del configurador, con clases **scoped** `.test-*`.
4. Se **reemplazó únicamente** el preview 2D (SVG `#deskSvg`) por el **configurador
   3D real**, dentro del **mismo contenedor visual** (`.config-grid/.config-visual`),
   con clases scoped `.c3d-*`.
5. Se **integró el carrito** (productos + extras + total estimado) **dentro del área
   del configurador/resultado**, sin rediseñar el resto.
6. Se **reemplazó el `<script>` inline** (nav + configurador 2D + `handleLead`) por
   los **módulos ES** técnicos.
7. `primoffice-landing.html` quedó como **copia idéntica** de `index.html`
   (sin redirección).

> El resultado del test queda **bloqueado hasta enviar el formulario**: el flujo es
> wizard → teaser → formulario → (envío) → resultado. Recién ahí se revela y se
> precarga el configurador 3D.

---

## 2. Tabla de trazabilidad visual

| Elemento visual original (landing nueva) | Estado final | Componente técnico injertado |
|---|---|---|
| Barra superior (promo BBVA/transferencia) | **Preservado igual** | — |
| Navbar (Setups/Configurador/Catálogo/Empresas/Contacto) | **Preservado igual** | — |
| Hero “rendir al máximo” + badge + stats + mockup lateral | **Preservado igual** | — |
| Trust band (garantía, envío mismo día, cuotas, showroom) | **Preservado igual** | — |
| “El problema real” (pain) | **Preservado igual** | — |
| “No son accesorios sueltos. Es un sistema de trabajo.” | **Preservado igual** | — |
| Combos **Essential / Pro / Executive** | **Preservado igual** | — |
| *(nuevo)* Sección **Test (6 preguntas)** | **Agregado** antes del configurador | `js/test-diagnostico.js` + `css/test-diagnostico.css` (scoped) |
| *(nuevo)* **Teaser parcial + captura de lead** | **Agregado** (resultado bloqueado hasta enviar) | `test-diagnostico.js`, `leads-service.js`, `app-config.js` |
| Configurador **2D** (SVG `#deskSvg` + checklist) | **Reemplazado por 3D** en el mismo contenedor | `js/configurador-3d.js` (Three.js) + `css/configurador-3d.css` |
| *(nuevo)* **Carrito + extras + total estimado** | **Agregado** dentro del configurador | `configurador-3d.js` + `js/config/catalogo-precios.js` |
| “Antes y después” (compare) | **Preservado igual** | — |
| Beneficios | **Preservado igual** | — |
| Catálogo | **Preservado igual** | — |
| Empresas | **Preservado igual** | — |
| Pasos (3 pasos) | **Preservado igual** | — |
| Conversión (CTA) | **Preservado igual** | — |
| Testimonios | **Preservado igual** | — |
| FAQ | **Preservado igual** | — |
| Contacto (form WhatsApp) | **Preservado igual** | `handleLead` (en `main.js` original) |
| Footer | **Preservado igual** | — |
| `<script>` inline (nav + config 2D + `handleLead`) | **Reemplazado** por módulos | `main.js` + módulos ES |

---

## 3. Archivos VISUALES revertidos

| Archivo | Antes (mi rework, incorrecto) | Ahora |
|---|---|---|
| `index.html` | Redirección a una landing reconstruida desde la estética del donante | **La landing nueva integrada** (raíz publicada correcta) |
| `primoffice-landing.html` | Reconstrucción visual desde cero (estética donante) | **Copia idéntica** de la landing nueva integrada |
| `css/styles.css` | Reescritura con estética propia | **Restaurado al original** (además **no** se enlaza en la nueva landing, que usa su `<style>` embebido) |
| `js/main.js` | Versión con scroll-reveal / parallax / nav-active propios | **Restaurado al original** del donante (nav + sombra de header + `handleLead` + analítica) |

---

## 4. Archivos TÉCNICOS conservados (injertados sin alterar la estética)

| Archivo | Función |
|---|---|
| `js/configurador-3d.js` | Configurador 3D real (Three.js): escena, cámara, luces, vistas, reset, rotación/zoom, táctil, lazy-load, **fallback WebGL**, `prefers-reduced-motion`, presets, precarga + **carrito/extras/total**. |
| `js/test-diagnostico.js` | Flujo **6 preguntas** → teaser → **captura de lead** → resultado → precarga 3D → WhatsApp. Payload anidado. |
| `js/config/app-config.js` | **WhatsApp `5491139149688`** centralizado, modo demo, endpoint futuro, timeout, flags Odoo. |
| `js/config/catalogo-precios.js` | Precios de **referencia** del carrito (`PRECIOS_CONFIRMADOS:false`). |
| `js/services/leads-service.js` | `submitLead(payload)` (demo + `localStorage`), desacoplado para Odoo. |
| `css/test-diagnostico.css` | Estilos **scoped** `.test-*` (wizard, teaser, lead, resultado). No tocan hero/combos/footer. |
| `css/configurador-3d.css` | Estilos **scoped** `.c3d-*` (escena, controles, carrito). No tocan hero/combos/footer. |
| `docs/INTEGRACION_ODOO_CRM.md` | Contrato e integración con Odoo CRM. |
| `assets/.../README.md` | Documentación de fotos y modelos. |

> Los CSS técnicos **no** redefinen clases globales del layout (`.hero`, `.setup-card`,
> `.btn`, footer, etc.). Sólo agregan selectores `.test-*` / `.c3d-*` propios.

---

## 5. Confirmación de preservación (validado en el archivo real)

- [x] Hero preservado (`Tu espacio de trabajo merece rendir al máximo`).
- [x] Navbar preservada.
- [x] Sección de problemas preservada (`El problema real`).
- [x] Combos preservados (`Essential / Pro / Executive`).
- [x] Beneficios preservados.
- [x] CTA final preservado (conversión + contacto).
- [x] Footer preservado.
- [x] **Exactamente 6 preguntas** (insertadas, no las 8 anteriores).
- [x] Captura de lead **agregada** (obligatoria antes del resultado).
- [x] Configurador **3D agregado** (reemplaza el preview 2D).
- [x] **Carrito agregado** (productos + extras + total).
- [x] **Resultado bloqueado** hasta enviar el formulario.
- [x] Sin estética heredada de la landing anterior fuera del configurador
      (`css/styles.css` de mi rework **no** está enlazado; sólo CSS scoped técnico).
- [x] `<style>` embebido original intacto; SVG 2D y script inline eliminados.

---

## 6. Cómo abrir y verificar (Windows)

> Usa un servidor local (ES modules + importmap no funcionan con `file://`).

- VS Code + **Live Server** sobre `index.html`, o
- `python -m http.server 8000` → `http://localhost:8000/`

Comparación visual: abrí `_entrada-local/landing-final-equipo.html` (original) y
`index.html` (integrada) lado a lado: todas las secciones visibles deben verse
iguales, salvo que ahora aparece la sección de **Test** y el configurador es **3D**
con **carrito**.

Test/lead/localStorage/WhatsApp: ver `docs/REPORTE_REDISENO.md` §8 (sigue vigente
para el flujo técnico). El número de WhatsApp es **`5491139149688`**.

---

## 7. Nota sobre el reporte anterior

`docs/REPORTE_REDISENO.md` documenta el trabajo previo; su sección de **rediseño
visual global** quedó **revertida** por esta corrección (ver §3). El resto
(flujo de test, configurador, leads, Odoo, precios de referencia) sigue vigente.
