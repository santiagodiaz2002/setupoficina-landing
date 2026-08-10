# Archivos generados, minificados, binarios y dependencias

## Regla aplicada

Estos archivos no se comentaron internamente porque son binarios, salidas generadas, dependencias de terceros o formatos cuya regeneración podría sobrescribir comentarios. Se documentan sin atribuirles un origen que el repositorio no demuestre.

## Resumen verificado

| Grupo | Estado Git | Evidencia local | Origen comprobado |
|---|---|---|---|
| Imágenes versionadas | versionadas | 43 PNG, 14 WebP, 1 JPG y 1 ICO en todo el repo | referencias desde HTML/CSS/JS; para capas, `manifest.json` registra dimensiones y hashes |
| `assets/tiendanube/main.min.js` | versionado | bundle ESM minificado de 10.944 bytes | `tiendanube-script/tsup.config.js` apunta a ese directorio y minifica `src/main.tsx` |
| `tiendanube-script/package-lock.json` | versionado | lockfile npm v3, 51.777 bytes | corresponde al `package.json` del mismo directorio |
| `tiendanube-script/node_modules/` | ignorado | 964 archivos, 50.068.921 bytes durante la auditoría | dependencias instaladas desde manifiesto/lockfile; no son fuente del proyecto |
| `.wrangler/` | ignorado | 2 bundles JavaScript, 190.392 bytes en total | contenido ensamblado desde Functions; comando exacto no identificado |
| `_worker.bundle` | ignorado | multipart de 134.044 bytes con módulo de Functions | artefacto de empaquetado; comando exacto no identificado |
| `tests/visual-output/` | ignorado | 6 PNG y `visual-report.json`, 8.956.903 bytes | la prueba versionada no escribe esos archivos; generador exacto no identificado |
| `assets/images/Escritorio.zip` | ignorado | ZIP de 18.768.083 bytes | contenido/origen exacto no inspeccionado como fuente |

Los tamaños y cantidades describen el workspace auditado; los archivos ignorados pueden cambiar o no existir en otra copia del repositorio.

## Assets de imagen

### Imágenes generales

**HECHO VERIFICADO:** `assets/images/` contiene 29 archivos versionados:

- `Escritorio/`: 8 PNG y 1 WebP de productos/escenas.
- `brand/`: 6 PNG, 1 WebP y 1 JPG para iconos, logotipos y metadatos sociales.
- `comparacion/`: 2 WebP usados por el comparador antes/después.
- `scene/mapped/`: 10 WebP de escena y productos mapeados.

`index.html`, los CSS y los módulos visuales contienen referencias a parte de estos recursos. `tests/visual-mapping.test.mjs` comprueba que las referencias locales declaradas por el runtime existan.

**INFORMACIÓN NO IDENTIFICADA:** no hay metadatos versionados que documenten autor, licencia o herramienta de creación de cada imagen general.

### Capas del configurador

**HECHO VERIFICADO:** `assets/setup-layers/` contiene:

- `source/`: base, diez capas de producto/escritorio y tres composiciones de preset.
- `runtime/`: base y diez capas que consume `js/setup-visual-config.js`/`js/setup-visual-hybrid.js`, más `10_SETUP_STARTER.png`.
- `references/`: tres composiciones Starter, Pro y Epic.
- `manifest.json`: lienzo, regiones limpiadas, dimensiones, modo, alfa y SHA-256 de las familias anteriores.
- `import/README.md`: describe un flujo histórico de importación.
- tres `.gitkeep` vacíos, uno por `source/`, `runtime/` y `references/`.

**HECHO VERIFICADO:** los tres `.gitkeep` miden 0 bytes. No aportan datos al runtime; conservan la existencia de las carpetas en Git.

**HECHO VERIFICADO:** `assets/setup-layers/import/` solo tiene su `README.md` versionado; no hay PNG versionados en esa carpeta.

**HECHO VERIFICADO:** `assets/setup-layers/runtime/10_SETUP_STARTER.png` existe y está versionado, pero no figura en `manifest.json.runtime_files`, `SETUP_LAYER_MANIFEST` ni referencias locales del runtime encontradas por búsqueda. Su equivalente sí figura bajo `source/` y `references/`. **INFORMACIÓN NO IDENTIFICADA:** no se identificó un consumidor activo del duplicado ubicado en `runtime/`.

**INFORMACIÓN NO IDENTIFICADA:** el README de importación menciona `tools/import_setup_assets.py` y `docs/setup-assets.md`, pero ninguno está versionado en el inventario auditado. Por eso no puede verificarse ni reproducirse desde esta copia el proceso exacto que produjo todas las capas. El manifiesto sí comprueba el resultado registrado, no el procedimiento histórico.

## Bundle Tiendanube minificado

### `assets/tiendanube/main.min.js`

**HECHO VERIFICADO:** es una salida ESM minificada y versionada. La relación de generación está demostrada por:

1. `tiendanube-script/package.json`: el script `build` ejecuta `tsup`.
2. `tiendanube-script/tsup.config.js`: toma `src/main.tsx`, usa `bundle: true`, `minify: true`, `format: ['esm']` y `outDir: '../assets/tiendanube'`.
3. La misma configuración cambia la extensión a `.min.js` cuando la minificación está activa.
4. El bundle contiene la lógica reconocible de `main.tsx`, `transfer-core.mjs` y `storefront-flow.mjs`, además del runtime JSX incluido.

Fuentes que deben estudiarse en lugar del minificado:

- `tiendanube-script/src/main.tsx`
- `tiendanube-script/src/transfer-core.mjs`
- `tiendanube-script/src/storefront-flow.mjs`
- `tiendanube-script/build/backend-url.mjs`
- `tiendanube-script/tsup.config.js`

Su documentación paralela está en [assets/tiendanube/main.min.js.md](./assets/tiendanube/main.min.js.md).

**HECHO VERIFICADO:** `index.html` no carga este bundle. El bundle corresponde al script para el storefront de Tiendanube, no al JavaScript que inicia la landing.

**INFORMACIÓN NO IDENTIFICADA:** la presencia del archivo no demuestra que esté instalado o activo en una tienda real.

## Lockfile y dependencias instaladas

### `tiendanube-script/package-lock.json`

**HECHO VERIFICADO:** es un lockfile npm con `lockfileVersion: 3`, 103 entradas bajo `node_modules/` y versiones/resoluciones/integridades transitivas. No se modificó. Ver [tiendanube-script/package-lock.json.md](./tiendanube-script/package-lock.json.md).

### `tiendanube-script/node_modules/`

**HECHO VERIFICADO:** `.gitignore` excluye cualquier `node_modules/`. Durante la auditoría había 964 archivos locales bajo `tiendanube-script/node_modules/`. Son copias instaladas de paquetes externos; el código mantenido por este proyecto está fuera de esa carpeta.

**INFORMACIÓN NO IDENTIFICADA:** no se puede deducir solo por su presencia qué comando exacto instaló esa copia (`npm install`, `npm ci` u otro) ni garantizar que coincide actualmente con el lockfile sin ejecutar una validación específica.

## Artefactos locales de Cloudflare

### `.wrangler/`

**HECHO VERIFICADO:** está excluido por `.gitignore`. En el workspace auditado contiene:

```text
.wrangler/
├── functions-build/index.js
└── functions-build-final/index.js
```

Ambos archivos contienen módulos ensamblados desde `functions/_lib/tiendanube/` y los adaptadores de `functions/api/`.

### `_worker.bundle`

**HECHO VERIFICADO:** está excluido explícitamente por `.gitignore`. Es un cuerpo multipart que incluye metadata y un módulo JavaScript de Functions ensamblado.

**INFORMACIÓN NO IDENTIFICADA:** no existe configuración Wrangler versionada ni registro del comando que creó `.wrangler/` o `_worker.bundle`; no se atribuye a una ejecución o despliegue concreto.

## Salidas visuales locales

### `tests/visual-output/`

**HECHO VERIFICADO:** está excluido por `.gitignore` y contenía durante la auditoría:

```text
epic-composed.png
epic-diff.png
pro-composed.png
pro-diff.png
starter-composed.png
starter-diff.png
visual-report.json
```

Los nombres y el JSON describen composiciones/diferencias de presets. `tests/visual-mapping.test.mjs` sí valida archivos PNG, hashes, alfa, posiciones y composición lógica, pero no contiene instrucciones que escriban estos siete archivos.

**INFORMACIÓN NO IDENTIFICADA:** no se encontró en los 131 archivos versionados el generador exacto de `tests/visual-output/`; no se afirma que la prueba actual los haya producido.

## Archivos vacíos

| Archivo | Bytes | Función comprobada |
|---|---:|---|
| `.nojekyll` | 0 | marcador reconocido por hosting compatible con GitHub Pages; el repo no contiene lógica propia que lo lea |
| `assets/setup-layers/references/.gitkeep` | 0 | conserva el directorio en Git |
| `assets/setup-layers/runtime/.gitkeep` | 0 | conserva el directorio en Git |
| `assets/setup-layers/source/.gitkeep` | 0 | conserva el directorio en Git |

**INFORMACIÓN NO IDENTIFICADA:** un archivo vacío no prueba por sí solo qué proveedor publica el sitio. En particular, `.nojekyll` no demuestra un despliegue activo en GitHub Pages.
