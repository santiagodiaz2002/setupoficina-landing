# Reporte · Pasada de pulido visual (incremental)

Sin commit. Sin push. Sin cambios funcionales intencionales.

## 1. Archivos creados
- `css/pulido-visual.css` — capas ambientales, scroll-reveal, parallax (todo decorativo, scoped).
- `js/pulido-visual.js` — inyecta ambient, reveal repetible + stagger, parallax de cursor. Autocontenido.
- `docs/REPORTE_PULIDO_VISUAL.md` — este reporte.

## 2. Archivos modificados
- `index.html` — **sólo** se enlazaron los 2 archivos nuevos (`<link>` + `<script defer>`). No se tocó copy, secciones, quiz, lead, carrito ni scripts existentes.
- `css/integracion-canonica.css` — se agregaron reglas **del contenedor del configurador** (layout 58/42, alturas, sticky desktop / static mobile).
- `js/setup-3d.js` — **sólo** encuadre de cámara (distancia/posición inicial y `min/maxDistance`).

## 3. Skills utilizadas
- **`ui-ux-pro-max`** (criterio obligatorio): animaciones 150–620 ms sólo sobre `transform`/`opacity`, `prefers-reduced-motion`, contraste, foco visible, objetivos táctiles, sin reflow. No existen otras skills de motion/frontend/performance/accesibilidad instaladas, así que no se usaron adicionales.

## 4. Mejoras al configurador 3D
- **Layout desktop 58/42**: el resultado rompe el ancho del wrapper (720px) y el configurador pasa a ser la columna ancha (≈58%), el carrito ≈42%.
- **Altura desktop** `clamp(520px, 54vh, 620px)`; **sticky** del configurador a `top:88px` (compatible con la navbar fija) mientras se recorre el carrito largo. **Sin** `overflow` en ancestros (no rompe el sticky).
- **Mobile**: sticky desactivado, ancho completo, altura `clamp(360px, 52vh, 440px)`, carrito debajo.
- **Encuadre**: cámara más cercana y mejor 3/4 inicial; el escritorio se distingue sin zoom manual. **No** se tocó rotación, zoom, vistas, reset, sincronización con carrito ni fallback WebGL.

## 5. Mejoras al fondo
- Perfil **tech elegante** (navy/celeste): halos/auras radiales con deriva lenta por sección, con **intensidad variable** (hero alta vía su glow propio + parallax; problemas/combos/beneficios suave; test/CTA media; footer muy baja) y una **grilla técnica tenue** en la sección del test.
- **Parallax de cursor** muy sutil (sólo desktop, `pointer:fine` ≥992px), con `requestAnimationFrame` y **sólo `transform`**; desactivado en mobile/táctil y con `prefers-reduced-motion`.
- El contenido siempre queda por encima de las capas (`z-index`), sin tapar texto ni reducir legibilidad.

## 6. Scroll reveal
- **Repetible** con `IntersectionObserver` (no usa `unobserve`): entra → anima; sale del viewport → vuelve a su estado inicial; vuelve a entrar → re-anima.
- **Anti-titileo**: histéresis por `intersectionRatio` (entra ≥0.12, sale ≤0.02) + `rootMargin` moderado.
- **Stagger** de cards 0/80/160/240/320 ms, reiniciable al re-entrar.
- Sólo `opacity`/`transform`. **No** anima el formulario, el resultado, el carrito ni el configurador (se excluyen `#pqLead`, `#quiz-result`, `.cart-wrapper`, `.navbar`), para no interrumpir la interacción.

## 7. Comportamiento mobile
- Sin parallax ni interacción de cursor. Configurador ancho completo (360–440px) con carrito debajo. Efectos ambientales más livianos. Fallback 2D preservado. Sin scroll horizontal (`body{overflow-x:hidden}`).

## 8. Pruebas ejecutadas
- `node --check`: `pulido-visual.js` OK, `setup-3d.js` OK (tras el ajuste), script inline del quiz OK.
- Servidor local: `GET /` 200; `css/pulido-visual.css` 200; `js/pulido-visual.js` 200.
- Regresión: marcadores canónicos intactos (hero, badge, “Trabajar mal cuesta…”, Starter/Pro/Elite, “No vendemos productos…”, CTA final). Funcional intacto (`pqLeadForm`, `pqConsent`, `name="pqcanal"`, `s3dStage`, `desk-scene` fallback, `Setup3D`, `cart-total-value`); placeholder `5491100000000` = 0; WhatsApp oficial en `app-config.js`.
- `index.html`: sólo se sumaron los 2 enlaces; `<style>` embebido y script del quiz sin cambios.

## 9. Errores reales pendientes
- Ninguno detectado en estático. La validación final del **render 3D / sticky / parallax / reveal** requiere abrir en un navegador real (no es testeable headless en este entorno). Recomiendo verificar en `http://localhost:8000/` a 320 / 375 / 768 / 1024 / 1440 px.

## 10. Confirmaciones
- **Sin commit.** · **Sin push.** · **Sin cambios funcionales intencionales** (test, scoring, carrito, precios, leads, WhatsApp, Odoo y fallback 2D quedaron idénticos).
- Backup previo: `_entrada-local/_backup-pulido-*` (ignorado por git).
