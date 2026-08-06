# Script NubeSDK de transferencia

Aplicacion NubeSDK aislada que consume un ticket de SetupOficina, agrega cada
producto en forma secuencial al carrito existente y navega al carrito nativo.
No usa DOM ni recibe precios desde la landing.

El script debe permanecer configurado con `onfirstinteraction` en la tienda
demo. Por eso, después de llegar desde SetupOficina, el usuario debe hacer un
clic, toque o desplazamiento para iniciar la transferencia. No usar `onload`
sin la aprobación previa requerida por Tiendanube.

El resultado se guarda temporalmente, se navega a
`/cart?setupoficina_result=1` y se recupera tanto en la inicialización como ante
`location:updated`. La UI consulta primero los slots realmente disponibles y
usa `Toast` en `corner_top_right`; `modal_content` es el único fallback. Una vez
mostrado, el resultado se elimina para impedir repeticiones.

El consume entrega un token de procesamiento opaco ligado a un lease. Ese valor
se devuelve al completar la transferencia y permite recuperar de forma segura
un procesamiento abandonado sin que el intento anterior pueda cerrarlo. El
script registra un único juego de listeners `cart:add:success` y
`cart:add:fail`, agrega secuencialmente y aplica timeout por producto.

## Compilar para producción

```powershell
npm ci
npm run typecheck
$env:SETUPOFICINA_BACKEND_URL = 'https://setupoficina.com.ar'
npm run build
```

## Compilar para demo

Una vez que exista el Preview de Cloudflare, usar su origen real:

```powershell
$env:SETUPOFICINA_BACKEND_URL = 'https://<PREVIEW_DEPLOYMENT>.setupoficina-landing.pages.dev'
npm run build
```

La validación sólo admite `https://setupoficina.com.ar` o un subdominio Preview
de `setupoficina-landing.pages.dev`. No admite paths, queries, puertos,
credenciales ni otros hosts.

El artefacto queda directamente en `../assets/tiendanube/main.min.js` y Pages lo
sirve como `/assets/tiendanube/main.min.js`. Para verificar el backend incrustado
desde la raíz del repositorio:

```powershell
rg -o 'https://[A-Za-z0-9.-]+' assets/tiendanube/main.min.js
```

La asociación o instalación del script en la tienda es un paso operativo
externo y no forma parte de estos comandos.
