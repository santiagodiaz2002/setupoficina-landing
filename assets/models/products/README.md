# Modelos 3D de productos (`assets/models/products/`)

Slots `.glb` por producto para el configurador `js/setup-3d.js`.

## Pipeline (cómo funciona)
`setup-3d.js` define un `REGISTRY` por objeto `dsi-*`:

```js
'dsi-organizer': { name:'pBox', build:bCableBox, model:null,
                   glb:'assets/models/products/pBox.glb',
                   scale:1, position:null, rotation:null }
```

- `build` → geometría procedural (fallback, siempre disponible).
- `model` → ruta del `.glb`. **Si es `null`, no se hace ninguna request** (no
  penaliza la carga ni genera 404). El campo `glb` es solo la ruta sugerida.
- Carga **diferida** (GLTFLoader, en `requestIdleCallback`). Si el `.glb` carga
  bien se usa; si falla o no existe, se conserva el procedural.

## Activar un modelo `.glb`
1. Dejá el archivo acá, p. ej. `assets/models/products/pBox.glb`.
2. En `setup-3d.js`, en ese producto, reemplazá `model:null` por
   `model:'assets/models/products/pBox.glb'`.
3. Ajustá `scale` / `position` (`[x,y,z]`) / `rotation` (`[x,y,z]` en rad) si hace falta.

## Estado de generación
- **No había Blender ni herramientas image-to-3D** en el entorno → **no se generaron `.glb`** (no se inventan archivos).
- `generar_modelos_blender.py` genera versiones simples de **pBox, pStandard, pHub, pGlow** cuando haya Blender:
  `blender --background --python assets/models/products/generar_modelos_blender.py`
- **Pendientes de modelado de alta fidelidad / image-to-3D:** pArm, pNotebook, pMechanic, pMouseProV, pPhone Pro.

Recomendaciones web: `.glb` liviano, low-poly, materiales reutilizados, texturas embebidas, < ~300 KB por modelo.
