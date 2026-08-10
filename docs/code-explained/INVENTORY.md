# Inventario verificado del repositorio

## Alcance y criterio

**HECHO VERIFICADO:** el inventario base se obtuvo con `git ls-files`. El resultado contiene **131 archivos versionados**. Para identificar fuentes se aplicó exactamente este filtro:

```powershell
git ls-files | Where-Object {
  $_ -match '\.(js|mjs|tsx|css|html|sql)$' -and
  $_ -ne 'assets/tiendanube/main.min.js'
}
```

El filtro devuelve **52 archivos fuente**. `assets/tiendanube/main.min.js` se excluye porque es un bundle minificado generado; su fuente y configuración de build sí están versionadas.

**HECHO VERIFICADO:** distribución funcional de las 52 fuentes:

| Grupo | Cantidad | Integrantes |
|---|---:|---|
| Frontend | 14 | `index.html`, 4 CSS y 9 JavaScript del directorio `js/` |
| Backend, D1 y pruebas relacionadas | 32 | 21 archivos bajo `functions/`, 2 SQL y 9 helpers/pruebas |
| Script de Tiendanube y herramienta | 6 | 5 fuentes bajo `tiendanube-script/` y `tools/tiendanube-sync-catalog.mjs` |
| **Total** | **52** | Coincide con el filtro anterior |

El detalle educativo de cada fuente está en [FILE-MAP.md](./FILE-MAP.md).

## Clasificación por extensión

**HECHO VERIFICADO:** conteo de los 131 archivos versionados, sin considerar los nuevos documentos educativos todavía no versionados:

| Extensión o tipo | Cantidad | Clasificación principal |
|---|---:|---|
| `.mjs` | 24 | módulos de backend, pruebas, herramienta y script |
| `.js` | 21 | frontend, adaptadores Pages, configuración de build y un bundle generado |
| `.tsx` | 1 | entrada TypeScript/JSX del script NubeSDK |
| `.css` | 4 | estilos del frontend |
| `.html` | 1 | documento y lógica inline de la landing |
| `.sql` | 2 | esquema D1 de leads y migración del puente |
| `.png` | 43 | imágenes y capas binarias |
| `.webp` | 14 | imágenes binarias optimizadas |
| `.jpg` | 1 | imagen social binaria |
| `.ico` | 1 | favicon binario |
| `.json` | 6 | rutas, catálogos, manifiesto de capas y configuración/lock de npm |
| `.md` | 4 | documentación existente |
| `.example` | 1 | plantilla de variables de entorno |
| `.webmanifest` | 1 | metadatos de aplicación web |
| `.xml` | 1 | sitemap |
| `.txt` | 1 | reglas para robots |
| `.gitkeep` | 3 | marcadores vacíos de directorio |
| `.gitignore` | 1 | reglas de exclusión de Git |
| `.nojekyll` | 1 | marcador vacío para desactivar Jekyll |
| **Total** | **131** | |

## Distribución por carpeta de primer nivel

| Ubicación | Versionados | Contenido comprobado |
|---|---:|---|
| raíz | 10 | entrada HTML, metadatos, SEO, favicon, plantilla de entorno y documentación general |
| `assets/` | 64 | 29 imágenes generales, 34 archivos del sistema de capas y 1 bundle Tiendanube |
| `config/` | 1 | catálogo lógico por SKU |
| `css/` | 4 | estilos de la landing |
| `db/` | 2 | SQL para D1 |
| `docs/` | 1 | documento previo del puente de carrito |
| `functions/` | 21 | Cloudflare Pages Functions y librerías compartidas |
| `js/` | 9 | módulos y scripts del navegador |
| `tests/` | 9 | pruebas Node y helper D1 en memoria |
| `tiendanube-script/` | 9 | fuente, build config, manifiestos npm y documentación del script NubeSDK |
| `tools/` | 1 | sincronizador de catálogo |
| **Total** | **131** | |

## Árbol completo de archivos versionados

Este árbol enumera los 131 resultados de `git ls-files`; no describe archivos ignorados o locales, que se registran en [GENERATED-AND-BINARY-FILES.md](./GENERATED-AND-BINARY-FILES.md).

```text
setupoficina-landing/
├── .env.example
├── .gitignore
├── .nojekyll
├── README.md
├── _routes.json
├── favicon.ico
├── index.html
├── robots.txt
├── site.webmanifest
├── sitemap.xml
├── assets/
│   ├── images/
│   │   ├── Escritorio/
│   │   │   ├── hub_usb.png
│   │   │   ├── luz_monitor.png
│   │   │   ├── monitor_brazo.png
│   │   │   ├── mouse.png
│   │   │   ├── notebook_soporte.png
│   │   │   ├── organizador_cables.png
│   │   │   ├── room-standard-clean.webp
│   │   │   ├── scene-epic-reference.png
│   │   │   └── teclado.png
│   │   ├── brand/
│   │   │   ├── apple-touch-icon.png
│   │   │   ├── favicon-32.png
│   │   │   ├── favicon-48.png
│   │   │   ├── icon-192.png
│   │   │   ├── icon-512.png
│   │   │   ├── logo-primoffice-horizontal-light.webp
│   │   │   ├── logo-primoffice-horizontal.png
│   │   │   └── primoffice-og.jpg
│   │   ├── comparacion/
│   │   │   ├── setup-antes.webp
│   │   │   └── setup-despues.webp
│   │   └── scene/mapped/
│   │       ├── hub_usb.webp
│   │       ├── luz_led.webp
│   │       ├── mouse_vertical.webp
│   │       ├── mousepad_xxl.webp
│   │       ├── organizador_prem.webp
│   │       ├── room-standard-mapped.webp
│   │       ├── scene-epic-reference.webp
│   │       ├── soporte_monitor.webp
│   │       ├── soporte_notebook.webp
│   │       └── teclado_mec.webp
│   ├── setup-layers/
│   │   ├── import/README.md
│   │   ├── manifest.json
│   │   ├── references/
│   │   │   ├── .gitkeep
│   │   │   ├── 10_SETUP_STARTER.png
│   │   │   ├── 11_SETUP_PRO.png
│   │   │   └── 12_SETUP_EPIC.png
│   │   ├── runtime/
│   │   │   ├── .gitkeep
│   │   │   ├── 00_BASE_ESTATICA.png
│   │   │   ├── 01_PARM.png
│   │   │   ├── 02_PNOTEBOOK.png
│   │   │   ├── 03_PMECHANIC.png
│   │   │   ├── 04_PGLOW.png
│   │   │   ├── 05_PMAT.png
│   │   │   ├── 06_PHUB.png
│   │   │   ├── 07_PBOX.png
│   │   │   ├── 08_PMOUSEPROV.png
│   │   │   ├── 09_STANDING_DESK.png
│   │   │   ├── 09B_STANDARD_DESK.png
│   │   │   └── 10_SETUP_STARTER.png
│   │   └── source/
│   │       ├── .gitkeep
│   │       ├── 00_BASE_ESTATICA.png
│   │       ├── 01_PARM.png
│   │       ├── 02_PNOTEBOOK.png
│   │       ├── 03_PMECHANIC.png
│   │       ├── 04_PGLOW.png
│   │       ├── 05_PMAT.png
│   │       ├── 06_PHUB.png
│   │       ├── 07_PBOX.png
│   │       ├── 08_PMOUSEPROV.png
│   │       ├── 09B_STANDARD_DESK.png
│   │       ├── 09_STANDING_DESK.png
│   │       ├── 10_SETUP_STARTER.png
│   │       ├── 11_SETUP_PRO.png
│   │       └── 12_SETUP_EPIC.png
│   └── tiendanube/main.min.js
├── config/
│   └── tiendanube-catalog.json
├── css/
│   ├── comparacion-antes-despues.css
│   ├── integracion-canonica.css
│   ├── pulido-visual.css
│   └── setup-visual-hybrid.css
├── db/
│   ├── migrations/0001_tiendanube_cart_bridge.sql
│   └── schema_leads.sql
├── docs/
│   └── tiendanube-cart-bridge.md
├── functions/
│   ├── _lib/tiendanube/
│   │   ├── client.mjs
│   │   ├── http.mjs
│   │   ├── installations.mjs
│   │   ├── oauth-config.mjs
│   │   ├── oauth.mjs
│   │   ├── privacy.mjs
│   │   ├── rate-limit.mjs
│   │   ├── scopes.mjs
│   │   ├── security.mjs
│   │   ├── token-crypto.mjs
│   │   └── transfers.mjs
│   └── api/
│       ├── leads.js
│       └── tiendanube/
│           ├── cart-transfer.js
│           ├── cart-transfer/complete.js
│           ├── cart-transfer/consume.js
│           ├── oauth/callback.js
│           ├── oauth/start.js
│           ├── oauth/status.js
│           └── privacy/
│               ├── customers-data-request.js
│               ├── customers-redact.js
│               └── store-redact.js
├── js/
│   ├── comparacion-antes-despues.js
│   ├── config/app-config.js
│   ├── pulido-visual.js
│   ├── services/leads-service.js
│   ├── services/tiendanube-cart-transfer.js
│   ├── setup-3d.js
│   ├── setup-visual-calibration.js
│   ├── setup-visual-config.js
│   └── setup-visual-hybrid.js
├── tests/
│   ├── helpers/tiendanube-d1.mjs
│   ├── leads-defensive.test.mjs
│   ├── tiendanube-catalog-sync.test.mjs
│   ├── tiendanube-client.test.mjs
│   ├── tiendanube-frontend.test.mjs
│   ├── tiendanube-nubesdk.test.mjs
│   ├── tiendanube-oauth.test.mjs
│   ├── tiendanube-transfer.test.mjs
│   └── visual-mapping.test.mjs
├── tiendanube-script/
│   ├── README.md
│   ├── build/backend-url.mjs
│   ├── package-lock.json
│   ├── package.json
│   ├── src/main.tsx
│   ├── src/storefront-flow.mjs
│   ├── src/transfer-core.mjs
│   ├── tsconfig.json
│   └── tsup.config.js
└── tools/
    └── tiendanube-sync-catalog.mjs
```

## Componentes encontrados y ausencias verificadas

**HECHO VERIFICADO:** existen frontend estático, JavaScript clásico y módulos ES, CSS, Cloudflare Pages Functions, D1/SQL, integración Odoo por XML-RPC, puente de carrito y OAuth/privacidad de Tiendanube, script NubeSDK, herramienta CLI y pruebas con `node:test`.

**HECHO VERIFICADO:** no hay archivo versionado de service worker, `wrangler.toml`, `wrangler.json`, `wrangler.jsonc`, `package.json` en la raíz ni configuración versionada de CI. El único `package.json` está bajo `tiendanube-script/`.

**INFORMACIÓN NO IDENTIFICADA:** el inventario demuestra archivos y relaciones locales, pero no demuestra por sí solo qué versión está publicada, si existe un despliegue activo, ni qué valores reales tienen bindings o secretos fuera del repositorio.
