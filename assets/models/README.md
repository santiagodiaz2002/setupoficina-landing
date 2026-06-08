# Modelos 3D del configurador (`assets/models/`)

El configurador (`js/configurador-3d.js`) dibuja hoy **placeholders** geométricos
prolijos para cada producto. La arquitectura ya está preparada para reemplazar
cada placeholder por un modelo real **`.glb`** o **`.gltf`** sin tocar la lógica:
solo hay que dejar el archivo en esta carpeta y completar el campo
`rutaModeloGlb` del producto correspondiente.

> Mientras `rutaModeloGlb` sea `null`, se usa el placeholder.
> Si se define una ruta y la carga falla, **se vuelve automáticamente al
> placeholder** (no rompe la escena).

---

## Cómo incorporar un modelo real

1. Exportá el modelo como `.glb` (recomendado: un solo archivo, con texturas
   embebidas) y copialo a `assets/models/`.
2. Abrí `js/configurador-3d.js` y, en el arreglo `PRODUCTOS`, completá el campo
   `rutaModeloGlb` del producto con una **ruta relativa**, por ejemplo:

   ```js
   {
     id: 'silla',
     // ...
     rutaModeloGlb: './assets/models/silla.glb',
     geometriaPlaceholder: 'silla' // queda como respaldo si el GLB no carga
   }
   ```

3. Listo. El `GLTFLoader` carga el modelo, le activa sombras y reemplaza el
   placeholder dentro del mismo grupo (se conservan posición, escala y la
   lógica de aparición/desaparición).

No hace falta tocar nada más: dependencias, presets, animaciones, resumen y
envío por WhatsApp siguen funcionando igual.

---

## Convenciones de los modelos (importante)

Para que los modelos calcen con la escena sin reajustes:

- **Unidades:** metros. 1 unidad = 1 m (la escena usa medidas reales: un
  escritorio estándar mide 1,50 × 0,72 m).
- **Origen (pivot):** apoyado en el piso, con el origen en la base del objeto
  (`y = 0` = punto de apoyo). Para accesorios de escritorio, el origen va en la
  cara inferior que toca la superficie.
- **Orientación:** el frente del producto mira hacia **+Z** (hacia el usuario /
  la cámara por defecto). El monitor, la notebook y el celular muestran su
  pantalla hacia +Z.
- **Centrado en X/Z:** el modelo centrado en su propio eje; la posición final la
  fija `posicionInicial` en el código.
- **Escala fina:** si el modelo viene en otra escala, ajustá `escala` del
  producto (número uniforme u objeto `{x, y, z}`) en lugar de reexportar.
- **Optimización:** mallas livianas (idealmente < 150k triángulos por modelo),
  texturas ≤ 2K, formato `.glb`. Si usás Draco, habilitá el `DRACOLoader`
  (ver más abajo).

---

## Mapa de productos → placeholder → archivo sugerido

| `id`       | Producto                      | `geometriaPlaceholder` | Archivo sugerido            |
|------------|-------------------------------|------------------------|-----------------------------|
| `silla`    | Silla ergonómica              | `silla`                | `silla.glb`                 |
| `monitor`  | Monitor externo               | `monitor`              | `monitor.glb`               |
| `soporte`  | Soporte de monitor (riser)    | `soporte`              | `soporte-monitor.glb`       |
| `brazo`    | Brazo articulado              | `brazo`                | `brazo-articulado.glb`      |
| `luz`      | Luz de monitor (pLed)         | `luz`                  | `luz-monitor.glb`           |
| `notebook` | Notebook                      | `notebook`             | `notebook.glb`              |
| `teclado`  | Teclado                       | `teclado`              | `teclado.glb`               |
| `mouse`    | Mouse                         | `mouse`                | `mouse.glb`                 |
| `hub`      | Hub USB-C (pHub)              | `hub`                  | `hub-usbc.glb`              |
| `celular`  | Soporte de celular            | `celular`              | `soporte-celular.glb`       |
| `cables`   | Organizador de cables (pBox)  | `cables`               | `organizador-cables.glb`    |
| `pad`      | Pad de escritorio (pMat XL)   | `pad`                  | `pad-escritorio.glb`        |

> El escritorio (tablero + patas) **no es un producto**: se genera por código y
> cambia de tamaño (compacto/estándar/amplio) y altura (sentado/standing). Si en
> el futuro querés un tablero con textura de madera real, puede agregarse como
> modelo aparte siguiendo la misma idea.

---

## Notas específicas por producto

- **`luz`**: el placeholder controla una `SpotLight` (encendido gradual). Si
  cargás un modelo real, la luz sigue funcionando porque la maneja la escena, no
  la malla. Para que el "foco" emisivo prenda/apague, exponé un material emisivo
  o dejá que la `SpotLight` haga el efecto.
- **`monitor`**: el panel sube/baja según haya `soporte` o `brazo`. Si traés un
  monitor real, mantené el panel como hijo nombrado `mon-panel` (o adaptá
  `applyArrangement()` en el JS) para conservar ese ajuste de altura.
- **`soporte` y `brazo`** son mutuamente excluyentes (regla del configurador).
- **`cables`** se ubica debajo de la superficie y acompaña la altura del
  escritorio.

---

## (Opcional) Modelos comprimidos con Draco

Si tus `.glb` usan compresión Draco, agregá el decoder al loader en
`js/configurador-3d.js`, dentro de `buildScene()`:

```js
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
gltfLoader.setDRACOLoader(draco);
```

(El import map de `index.html` ya resuelve `three/addons/`.)

---

## Qué pedirle a PrimOffice

Modelos `.glb` (o `.gltf` + texturas) **de los productos reales del catálogo**,
respetando las convenciones de arriba (metros, origen en la base, frente hacia
+Z). Idealmente uno por `id` de la tabla. Con eso, el configurador pasa de
placeholders a una vista fiel del producto real sin cambios de lógica.

---

## API pública del configurador (integración con el test)

El configurador expone, en `window.PrimOfficeConfigurador3D`, dos funciones que
usa el test diagnóstico (`js/test-diagnostico.js`):

```js
// Precarga una recomendación generada por el test.
window.PrimOfficeConfigurador3D.applyRecommendation({
  preset,     // 'basica' | 'pro' | 'premium'
  products,   // array de ids de PRODUCTOS (ej. ['silla','monitor','brazo',...])
  deskSize,   // 'compacto' | 'estandar' | 'amplio'
  deskMode    // 'sentado' | 'standing'
});

// Devuelve la configuración final tras los cambios manuales del usuario.
window.PrimOfficeConfigurador3D.getCurrentConfiguration();
// → { preset, deskSize, deskMode, products:[...ids], productNames:[...], count }
```

Ambas funcionan con o sin WebGL (la capa de UI siempre está activa). Cargar
modelos `.glb` reales **no** cambia este contrato.
