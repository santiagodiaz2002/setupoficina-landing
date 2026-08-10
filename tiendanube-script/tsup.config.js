// Importa el helper tipado de tsup que valida y autocompleta la forma del objeto de configuración exportado.
import { defineConfig } from 'tsup';
// Importa la validación local que restringe el backend compilado a producción o a un Preview exacto del proyecto.
import { resolveBackendUrl } from './build/backend-url.mjs';

// Resuelve el origen una sola vez al cargar esta configuración; un valor inválido detiene el build antes de generar el artefacto público.
const backendUrl = resolveBackendUrl();

// Exporta la receta que consume el comando `npm run build`, declarado en `tiendanube-script/package.json`.
export default defineConfig({
  // Usa `src/main.tsx` como único punto de entrada; sus imports incorporan el coordinador y el agregador al mismo bundle.
  entry: ['src/main.tsx'],
  // Genera un módulo ECMAScript, formato requerido para entregar la función `App` de NubeSDK.
  format: ['esm'],
  // Permite sintaxis moderna porque el artefacto se ejecuta dentro del runtime controlado por Tiendanube.
  target: 'esnext',
  // Evita limpiar todo el directorio de salida, que vive dentro de los assets públicos del repositorio.
  clean: false,
  // Elimina espacios, nombres prescindibles y comentarios para producir el archivo versionado compacto.
  minify: true,
  // Sigue los imports desde `main.tsx` y reúne su código en la salida.
  bundle: true,
  // No crea un mapa de fuentes adicional; por eso el artefacto generado es un único archivo JavaScript.
  sourcemap: false,
  // Impide dividir el grafo en chunks que requerirían instalar varios archivos en el storefront.
  splitting: false,
  // Incluye también dependencias npm necesarias en lugar de dejar imports externos que el host tendría que resolver.
  skipNodeModulesBundle: false,
  // Escribe el resultado en el directorio estático servido por Cloudflare Pages.
  outDir: '../assets/tiendanube',
  // Sustituye en tiempo de compilación la constante declarada en `src/main.tsx` por una cadena JSON segura.
  define: {
    // `JSON.stringify` garantiza que esbuild reciba un literal de cadena y no código ejecutable.
    __SETUPOFICINA_BACKEND_URL__: JSON.stringify(backendUrl)
  },
  // Ajusta una resolución interna del runtime JSX para que el bundler use el export público que realmente ofrece el paquete.
  esbuildOptions(options) {
    // Define el alias dentro de las opciones que tsup transmitirá a esbuild.
    options.alias = {
      // Redirige la ruta interna `dist` a la ruta exportada oficialmente por `@tiendanube/nube-sdk-jsx`.
      '@tiendanube/nube-sdk-jsx/dist/jsx-runtime': '@tiendanube/nube-sdk-jsx/jsx-runtime'
    };
  },
  // Personaliza la extensión de salida según la opción de minificación resuelta por tsup.
  outExtension: ({ options }) => ({
    // Con `minify:true` genera `main.min.js`; sin minificar generaría `main.js`.
    js: options.minify ? '.min.js' : '.js'
  })
});
