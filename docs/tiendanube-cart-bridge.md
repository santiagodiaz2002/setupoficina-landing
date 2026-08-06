# Puente SetupOficina → carrito Tiendanube

## Alcance

La integración corresponde a la aplicación Partners `setupoficina` (App ID
`38321`). La primera autorización descubre el Store ID sin configuración previa;
las operaciones comerciales quedan bloqueadas hasta seleccionar luego esa
instalación de forma explícita mediante `TIENDANUBE_STORE_ID`.

La landing manda exclusivamente `internalId` y `quantity`. La Function valida
la selección contra `tiendanube_catalog`, consulta la API estable `2025-03` y
crea un ticket de 32 bytes, válido por 10 minutos y de un solo consumo. En D1
se guarda únicamente su SHA-256.

El script NubeSDK consume el ticket desde el storefront, agrega cada variante
con `cart:add` sin alterar los ítems preexistentes, completa el ticket y navega
a `/cart?setupoficina_result=1`. En el carrito recupera el resultado desde
`asyncSessionStorage`, lo muestra y lo elimina para que no reaparezca. No utiliza
clientes, pedidos, pagos, cupones ni descuentos.

## Variables de Cloudflare Pages

### Plaintext

- `TIENDANUBE_ENABLED`: `false` por defecto. El backend sólo opera con `true`.
- `TIENDANUBE_ENV`: `production` para el dominio canónico o `preview` para un
  deployment exacto de Cloudflare Pages. Debe coincidir con el callback OAuth.
- `TIENDANUBE_APP_ID`: identificador público de la app; para esta integración,
  `38321`.
- `TIENDANUBE_API_VERSION`: debe ser exactamente `2025-03`.
- `TIENDANUBE_STORE_ID`: comienza vacío para el primer OAuth. Después se
  configura con el `user_id` numérico confirmado; nunca se elige la primera
  instalación de D1 de forma implícita.
- `TIENDANUBE_USER_AGENT`: nombre de la app y URL o contacto.
- `TIENDANUBE_STOREFRONT_URL`: URL HTTPS obligatoria que recibirá el ticket;
  no existe fallback implícito entre demo y producción.
- `TIENDANUBE_ALLOWED_SETUP_ORIGINS`: lista cerrada, separada por comas.
- `TIENDANUBE_ALLOWED_STOREFRONT_ORIGINS`: lista cerrada, separada por comas.
  Ambas son obligatorias, admiten solamente orígenes HTTPS completos y fallan
  de forma cerrada ante entradas inválidas.
- `TIENDANUBE_OAUTH_REDIRECT_URL`: callback HTTPS exacto de la instalación.
  Producción usa
  `https://setupoficina.com.ar/api/tiendanube/oauth/callback`. Un Preview debe
  usar su URL real exacta bajo
  `https://<DEPLOYMENT>.setupoficina-landing.pages.dev/api/tiendanube/oauth/callback`.
  No se confía en `Host` ni en headers reenviados para construirla.
- `TIENDANUBE_EXPECTED_STORE_DOMAINS`: lista cerrada de dominios originales
  esperados, sin esquema ni path (por ejemplo, el dominio `mitiendanube.com`
  de la tienda objetivo). La instalación falla si `GET /store` no coincide.
- `TIENDANUBE_API_TIMEOUT_MS`: timeout por lectura; valor sugerido `5000`.
- `TIENDANUBE_API_MAX_RETRIES`: reintentos de lecturas seguras; valor sugerido `2`.

Los únicos scopes aceptados son exactamente `read_products` y `write_scripts`.
El callback rechaza una concesión faltante, adicional, duplicada o mal formada
antes de cifrar el token.

Variable local de compilación del script (no es un secret de Pages):

- `SETUPOFICINA_BACKEND_URL`: origen HTTPS del backend que se incrusta en el
  bundle. Si está vacía, usa `https://setupoficina.com.ar`. Sólo se aceptan ese
  origen o hosts de Preview con la forma
  `https://<DEPLOYMENT>.setupoficina-landing.pages.dev`, sin path, puerto,
  credenciales, query ni fragmento.

### Secrets

- `TIENDANUBE_CLIENT_SECRET`: secreto de la aplicación usado tanto en el
  intercambio OAuth como para validar el HMAC SHA-256 de los webhooks.
- `TIENDANUBE_TOKEN_ENCRYPTION_KEY`: clave aleatoria de exactamente 32 bytes,
  codificada en base64, para AES-256-GCM. Debe administrarse fuera del
  repositorio y mantenerse estable mientras existan instalaciones cifradas.
- `TIENDANUBE_ACCESS_TOKEN`: fallback temporal y obsoleto, permitido solamente
  cuando `TIENDANUBE_OAUTH_REDIRECT_URL` es un Preview válido. El entorno
  canónico de producción lo ignora y carga exclusivamente el token cifrado de
  D1 para `TIENDANUBE_STORE_ID`.

El binding D1 sigue llamándose `LEADS_DB`. No se incorpora ningún ID de base ni
secreto al repositorio. Cargar secrets desde el panel de Cloudflare Pages o,
cuando el proyecto esté configurado localmente, con:

```bash
npx wrangler pages secret put TIENDANUBE_CLIENT_SECRET --project-name <PAGES_PROJECT>
npx wrangler pages secret put TIENDANUBE_TOKEN_ENCRYPTION_KEY --project-name <PAGES_PROJECT>
```

Ambos comandos solicitan el valor por entrada estándar: no pasarlo como
argumento de línea de comandos ni guardarlo en `.dev.vars` versionado. Generar
la clave con un CSPRNG o gestor de secretos que entregue 32 bytes y base64
canónico; validar el formato localmente antes de cargarla. Su valor no debe
imprimirse en logs, documentación ni artefactos.

## Migración D1

La migración agrega, sin modificar tablas preexistentes:

- `tiendanube_catalog`
- `tiendanube_cart_transfers`
- `tiendanube_rate_limits`
- `tiendanube_oauth_states`
- `tiendanube_installations`

No modifica `leads` ni sus índices. Primero validar contra una base local:

```bash
npx wrangler d1 execute <D1_DATABASE_NAME> --local --file db/migrations/0001_tiendanube_cart_bridge.sql
```

Después de revisar el resultado, la ejecución remota operativa es:

```bash
npx wrangler d1 execute <D1_DATABASE_NAME> --remote --file db/migrations/0001_tiendanube_cart_bridge.sql
```

Este repositorio no ejecuta la migración remota automáticamente. La migración
deja `tiendanube_catalog` vacío: no contiene IDs históricos de ninguna tienda.
`tiendanube_oauth_states` conserva sólo el SHA-256 del state, entorno, vigencia y
consumo. `tiendanube_installations` conserva el token cifrado con AES-256-GCM,
su IV independiente y los metadatos mínimos de la tienda.

El catálogo queda aislado por `store_id`. Los tickets tienen un TTL máximo de
600 segundos y estados `pending`, `processing`, `completed` o `expired`.
`processing` utiliza un lease de 90 segundos y un segundo token opaco, del cual
D1 guarda sólo el SHA-256. Una ejecución abandonada puede recuperarse después
del lease sin permitir que el procesador anterior complete el ticket.

## Sincronización controlada del catálogo

`config/tiendanube-catalog.json` es la única fuente versionada de la relación
comercial. Cada entrada contiene exclusivamente `internal_id`, el `sku`
esperado y `name`; no contiene IDs Tiendanube, stock ni precios.

Antes de crear un ticket, el backend vuelve a consultar el producto real. El
campo actual `visibility` acepta `visible` y `unlisted`, y rechaza `hidden` como
`product_hidden`. Para payloads antiguos sin `visibility`, `published=false`
se rechaza como `product_unpublished_legacy`. Después se mantienen sin cambios
las validaciones de variante, visibilidad de variante, stock y precio real.

La herramienta `tools/tiendanube-sync-catalog.mjs` consulta
`GET /2025-03/{store_id}/products?q=<SKU>` y compara el SKU exacto de todas las
variantes devueltas. Falla si no encuentra el SKU, si hay más de una variante
coincidente o si dos entradas terminan apuntando a la misma variante. El token
sólo se lee desde el entorno y nunca se incluye en argumentos, archivos ni
mensajes.

El SQL generado incluye el `TIENDANUBE_STORE_ID`, rechaza `internal_id` o
`variant_id` duplicados y hace UPSERT sobre `(store_id, internal_id)`. Nunca se
aplica a D1 por sí solo.

Ese uso efímero de `TIENDANUBE_ACCESS_TOKEN` pertenece exclusivamente a la
herramienta local de sincronización. No cambia la regla del backend: producción
resuelve el token cifrado desde D1 y no admite el fallback plano.

Procedimiento en PowerShell, válido tanto para la tienda demo como para
PrimOffice (cambiar el store y el token del entorno):

```powershell
$env:TIENDANUBE_ENV = 'preview' # usar production para PrimOffice
$env:TIENDANUBE_API_VERSION = '2025-03'
$env:TIENDANUBE_STORE_ID = '<STORE_ID_DE_LA_TIENDA>'
$env:TIENDANUBE_USER_AGENT = 'setupoficina (contacto operativo)'
$secureToken = Read-Host 'Access token Tiendanube' -AsSecureString
$env:TIENDANUBE_ACCESS_TOKEN = [System.Net.NetworkCredential]::new('', $secureToken).Password

$catalogSql = 'db/generated/tiendanube-catalog-demo.sql'
node tools/tiendanube-sync-catalog.mjs --output $catalogSql
```

Para PrimOffice, cargar las credenciales de esa tienda con el mismo mecanismo y
usar un archivo separado:

```powershell
$catalogSql = 'db/generated/tiendanube-catalog-primoffice.sql'
node tools/tiendanube-sync-catalog.mjs --output $catalogSql
```

El archivo se crea con modo exclusivo para evitar sobreescrituras accidentales.
Para regenerarlo deliberadamente se admite `--force`. `db/generated/` está
ignorado y el SQL resuelto no debe versionarse. Revisar el archivo y aplicarlo
primero a D1 local:

```powershell
Get-Content $catalogSql
npx wrangler d1 execute <D1_DATABASE_NAME> --local --file $catalogSql
```

Después de revisar store, IDs y base destino, el comando operativo remoto es:

```powershell
npx wrangler d1 execute <D1_DATABASE_NAME> --remote --file $catalogSql
```

Este repositorio no lo ejecuta automáticamente. Al terminar, retirar el token
del proceso local:

```powershell
$env:TIENDANUBE_ACCESS_TOKEN = $null
```

## Instalación OAuth Authorization Code

Requisitos previos: migración aplicada en el D1 del ambiente, binding
`LEADS_DB`, variables no secretas configuradas y ambos secrets cargados. En el
panel Partners, registrar como callback exactamente el valor de
`TIENDANUBE_OAUTH_REDIRECT_URL`; no combinar una instalación iniciada en
Preview con el callback de producción ni viceversa.

1. Abrir `GET /api/tiendanube/oauth/start` en el mismo origen configurado como
   callback. Antes de generar state, cookie o redirección, el endpoint comprueba
   que no exista ninguna instalación activa en el D1 de ese ambiente. Si existe,
   responde `409` sin iniciar una nueva autorización. Si no existe, genera 32
   bytes aleatorios, persiste sólo su SHA-256 por diez minutos y coloca el valor
   original en una cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
2. El navegador es redirigido a
   `https://www.tiendanube.com/apps/38321/authorize?state=...`. No se agrega
   ningún secret ni token a la URL.
3. Tiendanube vuelve al callback con `code` y `state`. La Function valida
   cookie, hash, entorno, expiración y consumo único antes de intercambiar el
   código en `https://www.tiendanube.com/apps/authorize/token`.
4. El callback exige exactamente `read_products` y `write_scripts`. Luego
   consulta `GET /store` y valida el dominio exacto contra la allowlist.
5. En la primera instalación `TIENDANUBE_STORE_ID` permanece vacío y el Store ID
   se toma de `user_id`/`store_id`. Si ya está configurado, debe coincidir y una
   instalación activa existente no se reemplaza silenciosamente.
6. Recién entonces cifra el access token con AES-256-GCM y lo guarda en D1. La
   respuesta HTML muestra sólo resultado, nombre, Store ID, dominio y scopes.
7. Sin Store ID configurado, `GET /api/tiendanube/oauth/status` devuelve
   `installed=false` y no enumera D1. Con Store ID responde exclusivamente
   `installed`, `storeId`, `storeDomain`, `scopes`, `installedAt` y
   `configurationReady` para esa instalación.

Los endpoints incorporan rate limiting y respuestas `no-store`. Los errores no
incluyen `code`, state, client secret, clave de cifrado ni access token. Repetir
un callback consumido no vuelve a llamar al endpoint de tokens. Tras el primer
OAuth hay que copiar el Store ID mostrado a la variable del
ambiente y volver a desplegar antes de habilitar operaciones comerciales. No
existe selección automática de la primera instalación.

Una reautorización futura requiere una revocación local explícita y revisada:
confirmar el D1 y Store ID objetivo, marcar únicamente esa fila con
`revoked_at=unixepoch()` y `updated_at=unixepoch()`, verificar que dejó de estar
activa y recién entonces volver a abrir `/api/tiendanube/oauth/start`. No existe
rotación, reemplazo ni revocación automática desde el flujo OAuth.

## Endpoints

- `GET /api/tiendanube/oauth/start`
- `GET /api/tiendanube/oauth/callback`
- `GET /api/tiendanube/oauth/status`
- `POST /api/tiendanube/cart-transfer`: origen de SetupOficina.
- `POST /api/tiendanube/cart-transfer/consume`: origen del storefront.
- `POST /api/tiendanube/cart-transfer/complete`: origen del storefront.
- `POST /api/tiendanube/privacy/store-redact`
- `POST /api/tiendanube/privacy/customers-redact`
- `POST /api/tiendanube/privacy/customers-data-request`

Los webhooks usan el cuerpo crudo y el header
`x-linkedstore-hmac-sha256`. La app no persiste PII de clientes; los dos
webhooks de cliente responden explícitamente que no hay datos almacenados.

## NubeSDK

El script de la tienda demo debe conservar el evento `onfirstinteraction`. Al
entrar desde SetupOficina, el usuario debe realizar una primera interacción
—clic, toque o desplazamiento— antes de que Tiendanube cargue y ejecute el
script. El ticket permanece en la URL hasta ese momento. No cambiar el evento a
`onload`: su uso en storefront requiere aprobación previa de Tiendanube.

Flujo dentro del storefront:

1. La entrada con `setupoficina_ticket` consume el ticket, recibe un token de
   procesamiento ligado al lease y agrega los productos secuencialmente con
   `cart:add`. El mismo adder mantiene un solo juego de listeners y aplica
   timeout individual.
2. El resultado se guarda durante 10 minutos en `asyncSessionStorage` antes de
   navegar a `/cart?setupoficina_result=1`.
3. La inicialización del script o el evento `location:updated` detectan el
   carrito, recuperan el resultado y consultan
   `nube.api.getAvailableSlots().getStatic()`.
4. Se prioriza el slot fijo oficial `corner_top_right` con el componente
   `Toast`. `modal_content` es el único fallback y también debe estar presente
   en el registro oficial devuelto por la API.
5. Después de renderizar agregados, faltantes, productos sin stock y la
   confirmación de conservación del carrito anterior, el resultado se elimina
   de `asyncSessionStorage`.

Una visita normal sin ticket ni `setupoficina_result=1` no consulta storage, no
renderiza UI y no modifica carrito ni navegación.

Producción (usa el backend canónico):

```powershell
cd tiendanube-script
npm ci
npm run typecheck
npm run build
```

Para compilar explícitamente una demo contra un Preview existente, reemplazar
el placeholder sólo cuando Cloudflare haya creado su URL:

```powershell
cd tiendanube-script
$env:SETUPOFICINA_BACKEND_URL = 'https://<PREVIEW_DEPLOYMENT>.setupoficina-landing.pages.dev'
npm run build
```

No se inventa ni versiona una URL de Preview. La validación de build rechaza
otros dominios y cualquier URL con path, query, puerto o credenciales.

Ambos comandos generan directamente el artefacto versionado
`assets/tiendanube/main.min.js`, servido por Cloudflare Pages en:

```text
/assets/tiendanube/main.min.js
```

Desde la raíz del repositorio se puede comprobar qué backend quedó incrustado:

```powershell
rg -o 'https://[A-Za-z0-9.-]+' assets/tiendanube/main.min.js
```

Debe aparecer exactamente el origen productivo o el Preview indicado. Antes de
generar producción después de una demo, limpiar la variable o fijarla de forma
explícita:

```powershell
$env:SETUPOFICINA_BACKEND_URL = 'https://setupoficina.com.ar'
cd tiendanube-script
npm run build
```

La instalación o asociación de la app/script en Tiendanube, su homologación y
cualquier deploy son pasos externos y deliberadamente no se ejecutan desde este
repositorio. Los únicos permisos previstos son `read_products` y
`write_scripts`.

## Feature flag y fallback comercial

Con `TIENDANUBE_ENABLED=false`, los botones principales Starter, Pro y Epic
abren sus URLs históricas de PrimOffice y el botón exclusivo del nuevo puente no
se muestra. El carrito existente y las acciones secundarias de WhatsApp siguen
disponibles. No se presenta un error por integración deshabilitada.

Con `TIENDANUBE_ENABLED=true`, los botones principales y la acción del carrito
personalizado preparan la transferencia al carrito nativo. WhatsApp continúa
siempre como acción secundaria.

El mismo flag tiene dos superficies deliberadas: la variable de Pages protege
las Functions y el valor público en `js/config/app-config.js` controla la
landing estática. Ambos deben permanecer en `false` hasta la prueba integral y
activarse juntos en el despliegue aprobado; Pages no inyecta variables de
entorno en archivos estáticos con el build actual (`exit 0`).

## Orden operativo posterior al primer commit

Estos pasos son remotos y no forman parte de la implementación local:

1. Hacer push de la rama aprobada.
2. Crear el Preview de Cloudflare Pages.
3. Crear o seleccionar el D1 de demo con binding `LEADS_DB`.
4. Aplicar y verificar la migración en D1 demo.
5. Configurar variables y secrets del Preview, dejando
   `TIENDANUBE_STORE_ID` vacío y `TIENDANUBE_ENABLED=false`.
6. Compilar NubeSDK con el origen exacto del Preview.
7. Completar Datos básicos de la aplicación Partners.
8. Configurar como callback la URL exacta del Preview.
9. Crear la tienda demo.
10. Ejecutar OAuth contra la tienda demo.
11. Copiar el Store ID mostrado por el callback.
12. Configurar ese valor como `TIENDANUBE_STORE_ID` en Preview.
13. Volver a desplegar el Preview y comprobar `configurationReady=true`.
14. Sincronizar y aplicar de forma revisada el catálogo de la tienda demo.
15. Crear o activar el script NubeSDK con `onfirstinteraction` en demo.
16. Activar juntas ambas superficies de `TIENDANUBE_ENABLED` en el Preview y
    ejecutar pruebas integrales de carrito previo, incorporación parcial,
    expiración, recuperación de lease y resultado en `/cart`.
17. Obtener la aprobación de Martín.
18. Repetir el procedimiento controlado para producción, con D1, callback,
    OAuth, Store ID, catálogo, bundle y script productivos.

## Pruebas locales

La suite no llama a Tiendanube real:

```bash
node --test tests/*.test.mjs
```
