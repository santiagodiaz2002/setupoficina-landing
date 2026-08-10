# `assets/setup-layers/manifest.json`

## Responsabilidad

**HECHO VERIFICADO:** inventaría propiedades físicas de las imágenes de capas. No es importado por el runtime del navegador: `js/setup-visual-config.js` mantiene un manifiesto JavaScript propio con las rutas que usa. La prueba `tests/visual-mapping.test.mjs` sí lee este JSON para verificar las capas.

## Propiedades superiores

| Propiedad | Contenido | Uso comprobado |
|---|---|---|
| `canvas` | `width: 1254`, `height: 1254` | tamaño lógico común de las capas; coincide con `SETUP_CANVAS_SIZE` |
| `cleared_regions` | regiones `map` y `compass` | registra áreas retiradas del alfa de las capas runtime |
| `source_files` | 14 registros | inventario de entradas/base, capas y referencias completas |
| `runtime_files` | 11 registros | base y capas que componen la escena activa |
| `reference_files` | 3 registros | imágenes completas Starter, Pro y Epic usadas como referencia |

## Regiones limpiadas

Cada región contiene:

- `canva`: coordenadas/medidas decimales (`x`, `y`, `width`, `height`) registradas respecto del lienzo.
- `pixel_bounds`: rectángulo entero `[left, top, right, bottom]` que la prueba usa para inspeccionar alfa.

`map` registra bounds `[975, 26, 1231, 361]`; `compass`, `[916, 221, 996, 302]`. La prueba confirma que esas regiones sean transparentes en capas runtime distintas de la base, y que la base conserve contenido.

## Forma de cada registro de archivo

| Campo | Significado comprobado |
|---|---|
| `file` | nombre relativo dentro de la familia (`source`, `runtime` o `references`) |
| `dimensions` | ancho y alto de la imagen |
| `mode` | `RGB` para composiciones opacas o `RGBA` para capas con alfa |
| `alpha` | booleano que declara si existe canal alfa |
| `sha256` | hash hexadecimal registrado para verificar contenido byte a byte |

## Familias

- `source_files`: `00_BASE_ESTATICA`, las capas `01` a `09/09B` y las composiciones `10` a `12`.
- `runtime_files`: `00_BASE_ESTATICA` y diez capas; no incluye composiciones completas de presets.
- `reference_files`: solo `10_SETUP_STARTER`, `11_SETUP_PRO` y `12_SETUP_EPIC`.

**HECHO VERIFICADO:** aunque el array `runtime_files` tiene 11 registros, la carpeta `runtime/` contiene además el PNG versionado `10_SETUP_STARTER.png`. No aparece en este JSON ni en el manifiesto JavaScript consumido por el navegador; por eso no se cuenta como capa runtime declarada.

**HECHO VERIFICADO:** la mayoría de imágenes declaran 1254×1254. `runtime/09B_STANDARD_DESK.png` declara 1024×1024, diferencia también presente en el archivo real y contemplada por el manifiesto JS.

**INFORMACIÓN NO IDENTIFICADA:** el proceso de generación exacto no es reproducible con los archivos versionados: el README de importación menciona un script y documento ausentes.
