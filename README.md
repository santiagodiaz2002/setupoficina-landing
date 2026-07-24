# Landing PrimOffice

Landing comercial con test ergonómico, recomendación personalizada,
visualizador híbrido 2D, carrito dinámico y comparación visual antes/después.

## Arquitectura activa

La landing es HTML, CSS y JavaScript sin framework. La experiencia visual del
resultado vive en `js/setup-visual-hybrid.js` y
`css/setup-visual-hybrid.css`. Presenta una escena fotográfica por nivel,
hotspots accesibles, referencia ambiental antes/setup y una barra compacta de
productos. El catálogo, los presets y el carrito siguen definidos únicamente
por la lógica central de `index.html`.

Las fotografías de ambientes y productos provienen exclusivamente de los
assets locales oficiales bajo `assets/images/`. `js/setup-3d.js` se conserva
como archivo legacy y no se carga en el runtime.

## Ejecutar localmente

Abrir con Live Server o ejecutar:

python -m http.server 8000

Luego abrir `http://localhost:8000/`. Para la verificación defensiva del flujo
de leads:

node --test tests/leads-defensive.test.mjs
