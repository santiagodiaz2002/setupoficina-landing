import { defineConfig } from 'tsup';
import { resolveBackendUrl } from './build/backend-url.mjs';

const backendUrl = resolveBackendUrl();

export default defineConfig({
  entry: ['src/main.tsx'],
  format: ['esm'],
  target: 'esnext',
  clean: false,
  minify: true,
  bundle: true,
  sourcemap: false,
  splitting: false,
  skipNodeModulesBundle: false,
  outDir: '../assets/tiendanube',
  define: {
    __SETUPOFICINA_BACKEND_URL__: JSON.stringify(backendUrl)
  },
  esbuildOptions(options) {
    options.alias = {
      '@tiendanube/nube-sdk-jsx/dist/jsx-runtime': '@tiendanube/nube-sdk-jsx/jsx-runtime'
    };
  },
  outExtension: ({ options }) => ({
    js: options.minify ? '.min.js' : '.js'
  })
});
