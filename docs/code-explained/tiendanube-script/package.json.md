# `tiendanube-script/package.json`

## Identidad y comportamiento npm

| Propiedad | Valor | Significado |
|---|---|---|
| `name` | `setupoficina-tiendanube-cart-bridge` | nombre local del paquete |
| `version` | `0.1.0` | versión declarada del paquete |
| `private` | `true` | evita una publicación npm accidental por el flujo normal de npm |
| `type` | `module` | trata `.js` del paquete como módulos ES |

## Scripts

| Script | Comando | Qué usa/proporciona |
|---|---|---|
| `build` | `tsup` | aplica `tsup.config.js` para empaquetar/minificar el script en `assets/tiendanube/` |
| `typecheck` | `tsc --noEmit` | valida tipos según `tsconfig.json` sin emitir JavaScript |

## Dependencias directas de desarrollo

| Paquete | Rango | Uso comprobado |
|---|---|---|
| `@tiendanube/nube-sdk-jsx` | `^0.21.0` | componentes/runtime JSX (`Column`, `Text`, `Toast`) en `src/main.tsx` |
| `@tiendanube/nube-sdk-types` | `^0.90.0` | tipo TypeScript `NubeSDK` |
| `@tiendanube/nube-sdk-ui` | `^0.22.1` | dependencia del ecosistema UI incluida por el build; no hay import directo en la fuente mantenida |
| `tsup` | `^8.5.0` | bundler configurado por `tsup.config.js` |
| `typescript` | `^5.9.2` | chequeo de TypeScript/TSX |

## Override

`overrides.esbuild: ^0.28.1` obliga a npm a resolver la familia `esbuild` dentro de ese rango para el árbol de dependencias.

**INFORMACIÓN NO IDENTIFICADA:** el manifiesto no prueba una instalación o activación del bundle en una tienda real.
