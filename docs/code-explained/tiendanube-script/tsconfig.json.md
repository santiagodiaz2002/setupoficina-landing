# `tiendanube-script/tsconfig.json`

**HECHO VERIFICADO:** configura el chequeo TypeScript del script NubeSDK. `package.json` lo usa indirectamente mediante `tsc --noEmit`.

| Opción | Valor | Efecto |
|---|---|---|
| `target` | `ES2018` | nivel de JavaScript asumido por el chequeo |
| `jsx` | `react-jsx` | transforma/interpreta JSX con runtime automático |
| `jsxImportSource` | `@tiendanube/nube-sdk-jsx` | reemplaza el runtime React por el de NubeSDK JSX |
| `module` | `ESNext` | conserva sintaxis moderna de módulos |
| `moduleResolution` | `bundler` | resuelve imports como un bundler moderno |
| `allowJs` | `true` | incluye módulos JavaScript importados por el TSX |
| `checkJs` | `true` | también comprueba tipos inferidos/anotados en esos JS |
| `noEmit` | `true` | TypeScript valida pero no escribe salida |
| `esModuleInterop` | `true` | mejora interoperabilidad de imports con módulos CommonJS |
| `forceConsistentCasingInFileNames` | `true` | detecta diferencias de mayúsculas/minúsculas en rutas |
| `strict` | `true` | activa el conjunto estricto de chequeos de tipos |
| `include` | `["./src/**/*"]` | limita archivos raíz del proyecto TypeScript al directorio `src`; sus imports también se resuelven |

La generación del bundle no la hace `tsc`: la hace `tsup` con `tsup.config.js`.
