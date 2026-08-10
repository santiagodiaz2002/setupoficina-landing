# `.env.example`

## Qué es

**HECHO VERIFICADO:** es una plantilla versionada de nombres de variables. No contiene los secretos reales. No fue modificada y ningún valor vacío/place­holder se interpreta aquí como configuración activa.

## Variables del puente Tiendanube

| Variable | Valor de ejemplo | Consumidor comprobado | Función |
|---|---|---|---|
| `TIENDANUBE_ENABLED` | `false` | `functions/_lib/tiendanube/security.mjs` | feature flag del backend; el frontend tiene además su propia constante pública en `js/config/app-config.js` |
| `TIENDANUBE_ENV` | `production` | `functions/_lib/tiendanube/oauth-config.mjs` | etiqueta/entorno validado por el flujo OAuth |
| `TIENDANUBE_APP_ID` | `38321` | `oauth-config.mjs` | identificador público esperado de la aplicación |
| `TIENDANUBE_API_VERSION` | `2025-03` | `client.mjs` | versión incluida en la URL de API; el módulo también define esa versión como constante |
| `TIENDANUBE_STORE_ID` | vacío | `installations.mjs`, `transfers.mjs`, herramienta de sincronización | identifica la tienda configurada cuando se requiere un ID explícito |
| `TIENDANUBE_USER_AGENT` | placeholder | `client.mjs` | cabecera identificadora enviada por el cliente de API |
| `TIENDANUBE_STOREFRONT_URL` | placeholder HTTPS | `transfers.mjs` | base de la redirección a la tienda; el código añade el ticket |
| `TIENDANUBE_ALLOWED_SETUP_ORIGINS` | placeholder HTTPS | `http.mjs` | allowlist CORS para solicitudes desde la landing |
| `TIENDANUBE_ALLOWED_STOREFRONT_ORIGINS` | placeholder HTTPS | `http.mjs` | allowlist CORS para consume/complete desde el storefront |
| `TIENDANUBE_OAUTH_REDIRECT_URL` | callback de SetupOficina | `oauth-config.mjs` | callback que el código valida contra origen y ruta esperados |
| `TIENDANUBE_EXPECTED_STORE_DOMAINS` | placeholder | `oauth-config.mjs` | dominios de tienda aceptados durante OAuth |
| `TIENDANUBE_API_TIMEOUT_MS` | `5000` | `client.mjs`, `oauth.mjs`, herramienta | límite temporal de llamadas a la API |
| `TIENDANUBE_API_MAX_RETRIES` | `2` | `client.mjs`, `oauth.mjs`, herramienta | máximo de reintentos configurables del cliente |

## Variable de build

| Variable | Consumidor | Recorrido comprobado |
|---|---|---|
| `SETUPOFICINA_BACKEND_URL` | `tiendanube-script/build/backend-url.mjs` y `tsup.config.js` | se valida en build, se serializa como `__SETUPOFICINA_BACKEND_URL__` y `src/main.tsx` la usa como base para `consume`/`complete` |

## Secretos representados por placeholders

| Variable | Consumidor comprobado | Función |
|---|---|---|
| `TIENDANUBE_ACCESS_TOKEN` | `installations.mjs` y herramienta de sincronización | fallback plano limitado por el código a Preview/desarrollo y token para la herramienta local |
| `TIENDANUBE_CLIENT_SECRET` | `oauth.mjs`, `privacy.mjs` | intercambio OAuth y verificación HMAC de webhooks |
| `TIENDANUBE_TOKEN_ENCRYPTION_KEY` | `installations.mjs`/`token-crypto.mjs` | clave base64 para cifrar/descifrar tokens con AES-GCM |

## Configuración usada pero no incluida en esta plantilla

**HECHO VERIFICADO:** el código también lee un binding `LEADS_DB` y las variables `ODOO_ENABLED`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME` y `ODOO_API_KEY`. Esos nombres no aparecen en `.env.example`.

**INFORMACIÓN NO IDENTIFICADA:** el repositorio no contiene valores reales de secretos/bindings ni un archivo Wrangler versionado que los asocie a un entorno publicado.
