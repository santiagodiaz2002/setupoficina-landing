# Reporte · Mejora del configurador 3D con productos reales de PrimOffice

**Alcance:** exclusivamente el configurador 3D (`js/setup-3d.js`).
**Fecha:** 2026-06-10 · **Fuente oficial:** https://www.primoffice.com.ar/ (Tienda Nube)
**Sin commit ni push** (ver punto 9).

---

## 1) Productos encontrados

Los 11 productos del catálogo prioritario fueron localizados en la tienda oficial:

| Producto | URL oficial | Categoría | Datos clave | Mapeo `dsi-*` |
|---|---|---|---|---|
| **pStanding** | `/productos/escritorio-altura-ajustable-pstanding/` | Mobiliario / Standing Desk | Eléctrico, **altura 70–118 cm**, ancho ajustable | estructura del escritorio (modo standing) |
| **pArm** | `/productos/soporte-monitor-brazo-articulado-parm/` | Soportes / Monitor | Brazo articulado, clamp; **acero al carbono + epoxi**, negro | `dsi-monitor-arm` |
| **pStandard** | `/productos/soporte-monitor-regulable-pstandard/` | Soportes / Monitor | Riser altura regulable; acero al carbono + epoxi | `dsi-monitor-stand` |
| **pNotebook** | `/productos/soporte-notebook-ergonomico-pnotebook/` | Soportes / Notebook | Elevador ergonómico inclinado; aluminio | `dsi-stand` |
| **pMat** | `/productos/pad-xl-cuero-ecologico-pmat/` | Accesorios / Escritorio | Pad **XL** de cuero ecológico, mate, 10 colores | `dsi-mousepad` |
| **pHub** | `/productos/adaptador-hub-usbc-multifuncional-phub/` | Conectividad / Hubs | USB-C 7 en 1, aluminio | `dsi-hub` |
| **pBox** | `/productos/bandeja-organizadora-de-cables-para-escritorio-pbox/` | Accesorios / Escritorio | Bandeja de cables, **40×18×10 cm**, acero, tapa abatible, **se monta bajo el escritorio** | `dsi-organizer` |
| **pGlow** | `/productos/lampara-para-monitor-barra-de-luz-led-pglow/` | Accesorios / Periféricos | Barra de luz LED, se apoya **sobre la pantalla** | `dsi-lightbar` |
| **pMechanic** | `/productos/teclado-mecanico-compacto-rgb-pmechanic/` | Accesorios / Periféricos | Teclado mecánico compacto **RGB**, negro | `dsi-keyboard` |
| **pMouseProV** | `/productos/mouse-vertical-ergonomico-inalambrico-recargable-pmouseprov-lg4ff/` | Accesorios / Periféricos | Mouse **vertical** ergonómico inalámbrico recargable | `dsi-mouse` |
| **pPhone Pro** | `/productos/soporte-celular-ajustable-pphonepro/` | Soportes / Celular | Soporte metálico ajustable, 6 colores | — (sin slot `dsi`) |

Ficha completa por producto en `_entrada-local/referencias-productos/<producto>/producto.json` e índice en `manifest.json`.

> El standing desk se representa con la **estructura del escritorio** del configurador (no es un objeto suelto), mejorada con referencia a pStanding. Monitor, notebook y silla permanecen como **objetos contextuales genéricos**.

---

## 2) Imágenes descargadas

**No se descargaron archivos de imagen.** El entorno de ejecución **bloquea la descarga binaria por red** (no se permite `curl`/`wget`/`python` para bajar URLs). En su lugar:

- Se catalogaron las URLs de galería oficial en cada `producto.json`. **pBox** trae las **5 URLs reales** de su galería (CDN Tienda Nube `acdn-us.mitiendanube.com/stores/001/717/384/products/...`).
- Se entrega un script listo para que el usuario baje **3–5 imágenes por producto**:
  `bash _entrada-local/referencias-productos/descargar-referencias.sh`
- Destino de originales: `_entrada-local/referencias-productos/<producto>/`. Copias optimizadas: `assets/images/products/`.

**Pendiente real:** ejecutar el script de descarga (acción del usuario) — ver punto 6.

---

## 3) Objetos procedurales reemplazados / mejorados

Reescritura completa de geometrías en `js/setup-3d.js` (low-poly, materiales cacheados):

| Objeto | Antes | Ahora (fiel al producto real) |
|---|---|---|
| **pBox** (`dsi-organizer`) | Portalápices con 3 lápices de colores | **Bandeja de cables de acero** (piso + paredes + **tapa abatible** entreabierta + cables), **montada DEBAJO de la superficie**. **Portalápices eliminado.** |
| **pMat** (`dsi-mousepad`) | Slab plano simple | Pad XL de cuero con **borde cosido**, mate |
| **pGlow** (`dsi-lightbar`) | Barra + glow plano | **Barra de luz** con tira emisiva cálida hacia abajo + **gancho/contrapeso** sobre la pantalla |
| **pHub** (`dsi-hub`) | Cajita + 1 LED | Cuerpo de aluminio + **fila de 4 puertos** + cola/conector USB-C + LED |
| **pStandard** (`dsi-monitor-stand`) | Cuello + base cilíndrica | **Riser**: plataforma + 2 patas + rieles de base + gap frontal (acero negro) |
| **pStanding** (escritorio) | 2 patas tipo caja | **Columnas telescópicas** (segmento fijo + deslizante) con pies, **viga inferior** y **teclado de control**; rango sentado↔de pie 0.73↔1.08 m |
| **pArm** (`dsi-monitor-arm`) | Poste + 1 barra | Clamp + columna + **brazo de 2 segmentos con juntas** + placa VESA |
| **pNotebook** (`dsi-stand`) | Tapa + 2 patas | Elevador **inclinado** de aluminio + tope frontal |
| **pMechanic** (`dsi-keyboard`) | 36 teclas | Case + **matriz 4×13 keycaps** + barra espaciadora + **underglow RGB** (geometría de tecla reutilizada) |
| **pMouseProV** (`dsi-mouse`) | Esfera achatada | **Mouse vertical** inclinado + apoyo de pulgar + botón + rueda |

Contextuales (monitor, notebook, silla): se mantienen genéricos, con ajustes finos (`arrangeMonitor`, nuevo `arrangeLaptop` que eleva/inclina la notebook sobre pNotebook).

---

## 4) `.glb` generados o integrados

- **No se generó ni integró ningún `.glb`** (no se inventan archivos sin tooling de modelado disponible).
- Se implementó el **pipeline `.glb` completo y diferido** en `setup-3d.js` (`GLTFLoader`):
  cada producto del `REGISTRY` define `{ name, build, model, scale, position, rotation }`.
  - `model:null` en **todos** los slots → **cero requests** y **cero 404** en runtime; no penaliza la carga inicial.
  - Si se define `model:'assets/models/products/<x>.glb'` y carga OK → se usa el `.glb`; si falla → **fallback** al procedural. Nunca rompe el WebGL fallback.
  - Carga diferida en `requestIdleCallback`; `GLTFLoader` solo se importa si hay algún `model` no nulo.
- Slots `.glb` listos (rutas sugeridas en el campo `glb` de cada entrada): `assets/models/products/{pArm,pStandard,pNotebook,pMat,pHub,pBox,pGlow,pMechanic,pMouseProV}.glb`.
- Para activar un modelo: copiar el `.glb` y reemplazar `model:null` por la ruta (ver `assets/models/products/README.md`).

---

## 5) Tooling disponible y tooling ausente

| Herramienta | Estado |
|---|---|
| Node 22 / npm 10 | ✅ disponible (validación, análisis estático) |
| Python 3.10 + Pillow + NumPy | ✅ disponible |
| **Blender CLI** | ❌ **ausente** (no se pudo generar `.glb`) |
| **trimesh / bpy** | ❌ ausente |
| **Herramienta image-to-3D sin credenciales** | ❌ no disponible |
| Descarga binaria por red (curl/wget) | ❌ bloqueada por el entorno |
| Navegador con WebGL accesible al servidor del sandbox | ❌ no disponible (prueba interactiva queda para el usuario) |

Por eso se siguió la regla: **no inventar `.glb`**, dejar slots listos, **mejorar los procedurales al máximo** y entregar un **script Blender reproducible** (`assets/models/products/generar_modelos_blender.py`) para generar pBox/pStandard/pHub/pGlow cuando haya Blender.

---

## 6) Pendientes reales

1. **Ejecutar la descarga de imágenes**: `bash _entrada-local/referencias-productos/descargar-referencias.sh` (el entorno no permitió bajar binarios).
2. **Modelos `.glb` de alta fidelidad** (requieren Blender o image-to-3D, no disponibles): **pArm, pNotebook, pMechanic, pMouseProV, pPhone Pro**. Con Blender, pBox/pStandard/pHub/pGlow salen del script incluido.
3. **pPhone Pro**: no tiene slot `dsi` en la landing (no hay producto de carrito que lo dispare). Queda catalogado; incorporarlo requeriría tocar la landing/carrito (fuera de alcance).
4. **pMat y pNotebook**: builders listos pero **inactivos** porque el carrito actual no expone `dsi-mousepad` ni `dsi-stand`. Se activan solos si la landing agrega un producto con ese `dsEl` (sin tocar `setup-3d.js`).
5. **Prueba interactiva en navegador** (WebGL): pendiente de correr localmente (ver punto 8).
6. Artefacto removible: `assets/models/products/__pycache__/` (caché `.pyc` de Python; el mount no permitió borrarlo, eliminar en Windows).

---

## 7) Archivos modificados

**Modificado (contenido):**
- `js/setup-3d.js` — reescritura del adaptador 3D (procedurales fieles + pipeline `.glb` + escritorio pStanding). Único cambio de contenido real en todo el repo.

**Creados:**
- `docs/REPORTE_PRODUCTOS_3D.md` (este archivo)
- `CLAUDE.md`
- `_entrada-local/referencias-productos/manifest.json`
- `_entrada-local/referencias-productos/README.md`
- `_entrada-local/referencias-productos/descargar-referencias.sh`
- `_entrada-local/referencias-productos/{pStanding,pArm,pStandard,pNotebook,pMat,pHub,pBox,pGlow,pMechanic,pMouseProV,pPhonePro}/producto.json`
- `assets/models/products/README.md`
- `assets/models/products/generar_modelos_blender.py`
- `assets/images/products/README.md`

**No modificados** (confirmado): `index.html`, landing visual, fondo animado/partículas, test, leads, carrito, precios, WhatsApp, favicon, Odoo, y el resto de CSS/JS. `css/integracion-canonica.css` estaba autorizado pero **no hizo falta tocarlo** (los estilos `.s3d-*` ya soportan el canvas).

> Nota: `git status` marca muchos archivos como *modified*; es **ruido de fin de línea (CRLF↔LF)** del mount Linux. Verificado con `git diff --ignore-cr-at-eol`: el **único** archivo con cambio de contenido es `js/setup-3d.js`. `setup-3d.js` se dejó en **CRLF** para igualar la convención del repo.

---

## 8) Pruebas ejecutadas

- ✅ `node --check js/setup-3d.js` → sintaxis válida (con CRLF).
- ✅ Balance de `{}` `()` `[]` correcto (198/198, 667/667, 41/41).
- ✅ **Análisis estático** (0 fallos): todas las `COL.*` referenciadas existen (22/25); los 12 builders del `REGISTRY` están definidos; `DSI` (12) ⊆ `REGISTRY` y `LAYOUT`; API pública presente (`setVisible`, `setView`, `refreshFromDOM`, `isReady`).
- ✅ **Test lógica de fallback `.glb`** (espejo de `loadModelFor`): 4/4 — `model:null`→procedural; carga OK→glb; error→procedural.
- ✅ **Servidor local** (`python3 -m http.server`): `200` en `/index.html`, `/js/setup-3d.js`, `/css/integracion-canonica.css`.
- ✅ `importmap` resuelve `three` y `three/addons/` → `GLTFLoader` cargable.
- ✅ Todos los `model:` reales en `null` → **0 requests `.glb`** en runtime (sin 404 / sin errores rojos por modelos faltantes).
- ✅ Portalápices eliminado (sin geometría de lápices).
- ⏳ **Pendiente (usuario)**: prueba visual en navegador. No es ejecutable en el sandbox (sin WebGL/headless que alcance el server). Para probar:
  ```bash
  python3 -m http.server 8080      # en la raíz del repo
  # abrir http://localhost:8080/  → hacer el test → ver el preview 3D
  ```
  Checklist sugerido: carga del configurador, pBox sin portalápices (bajo la superficie), pMat, pGlow, pHub, pStandard, standing desk (animación sentado/de pie), presets, rotación/zoom, vistas (3/4·frontal·superior·reset), reset, sincronización carrito↔3D, total, sticky desktop, mobile, fallback sin WebGL, consola sin errores rojos.

> Limitación honesta: la validación cubre sintaxis, estructura, consistencia, lógica de fallback y servido HTTP; el render WebGL interactivo debe verificarse en navegador (instrucciones arriba).

---

## 9) Confirmación

**No se ejecutó `git commit` ni `git push`.** El working tree quedó con cambios sin commitear; la rama y el último commit (`6228812 Merge branch 'develop'`) permanecen intactos. No se publicó nada.

---

## Nota operativa (limitaciones del entorno sandbox)

El entorno donde se trabajó usa un *mount* que **no permite borrar archivos**. Dos artefactos
inocuos pueden haber quedado y conviene eliminarlos manualmente (no afectan la landing):

1. **`.git/index.lock`** — generado por comandos `git status` de solo lectura; el mount impidió
   borrarlo (quedó en 0 bytes). Si `git` se queja con *"Unable to create '.git/index.lock': File exists"*,
   borralo antes de operar:
   - Windows: `del .git\index.lock`  ·  Unix: `rm -f .git/index.lock`
2. **`assets/models/products/__pycache__/`** — caché `.pyc` de Python; eliminar con
   `rmdir /s /q assets\models\products\__pycache__` (Windows) o `rm -rf` (Unix).

Ninguno de los dos se commiteó (no se hizo commit) ni afecta el funcionamiento del configurador.
