# `_routes.json`

**HECHO VERIFICADO:** este JSON no fue alterado. Define qué rutas dinámicas se entregan al sistema de Cloudflare Pages Functions.

| Propiedad | Valor | Significado en este repositorio |
|---|---|---|
| `version` | `1` | versión del formato de reglas |
| `include` | `["/api/*"]` | incluye cualquier ruta cuyo camino empiece con `/api/` para el enrutamiento de Functions |
| `exclude` | `[]` | no declara excepciones dentro de las rutas incluidas |

La regla coincide con los adaptadores versionados bajo `functions/api/`: `/api/leads`, `/api/tiendanube/cart-transfer`, sus subrutas, OAuth y privacidad. Los recursos estáticos como `/`, CSS, JavaScript e imágenes no aparecen en `include`.

**INFORMACIÓN NO IDENTIFICADA:** el archivo no demuestra por sí solo un despliegue activo ni cuál fue el comando de publicación.
