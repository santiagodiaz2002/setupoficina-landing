# `site.webmanifest`

**HECHO VERIFICADO:** este manifiesto JSON aporta metadatos de instalación/presentación de la landing al navegador. `index.html` lo enlaza con `rel="manifest"`.

| Propiedad | Valor comprobado | Propósito |
|---|---|---|
| `name` | nombre largo de PrimOffice y el test/visualizador | identificación completa de la aplicación |
| `short_name` | `PrimOffice` | nombre compacto cuando el espacio de interfaz es limitado |
| `lang` | `es-AR` | idioma/región declarados |
| `start_url` | `/` | ruta inicial al abrirla desde una instalación |
| `scope` | `/` | ámbito de navegación declarado |
| `display` | `standalone` | solicita una presentación similar a aplicación, sin la interfaz completa del navegador |
| `background_color` | `#0F172A` | color de fondo usado durante/transiciones de apertura compatibles |
| `theme_color` | `#0F172A` | color temático para interfaz del navegador compatible |
| `id` | `/` | identificador estable declarado para la aplicación |
| `description` | descripción del test y explorador | texto descriptivo del manifiesto |
| `icons[0]` | `./assets/images/brand/icon-192.png`, `192x192`, PNG | icono de 192 píxeles |
| `icons[1]` | `./assets/images/brand/icon-512.png`, `512x512`, PNG | icono de 512 píxeles |

**HECHO VERIFICADO:** ambos archivos de icono existen y están versionados.

**INFORMACIÓN NO IDENTIFICADA:** no hay service worker versionado. Por tanto, este manifiesto no demuestra caché offline, precache ni funcionamiento sin conexión.
