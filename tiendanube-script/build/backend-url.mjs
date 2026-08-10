// Define el único origen canónico de producción que puede quedar incrustado en el bundle NubeSDK; `resolveBackendUrl()` lo usa como valor por defecto durante el build.
export const PRODUCTION_BACKEND_URL = 'https://setupoficina.com.ar';

// Reconoce exclusivamente hosts Preview de este proyecto de Cloudflare Pages y evita aceptar subdominios vacíos, demasiado largos o con caracteres ajenos a DNS.
const PREVIEW_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.setupoficina-landing\.pages\.dev$/;

// Valida el origen recibido por la configuración de tsup antes de que ese valor se compile dentro de `assets/tiendanube/main.min.js`.
// Recibe cualquier valor convertible a texto, produce un origen HTTPS normalizado y lanza `Error` si el destino podría sacar las peticiones del backend verificado.
export function validateBackendUrl(value) {
  // Convierte valores nulos en cadena vacía y elimina espacios accidentales para que la validación posterior opere sobre una representación uniforme.
  const raw = String(value || '').trim();
  // Reserva la variable que contendrá la instancia `URL`; declararla fuera del `try` permite usarla en todas las comprobaciones siguientes.
  let url;
  // Intenta delegar al parser estándar de URL la separación segura de protocolo, credenciales, host, puerto, ruta, query y fragmento.
  try {
    // Construye una URL absoluta; una cadena relativa o mal formada provoca la excepción capturada inmediatamente debajo.
    url = new URL(raw);
  } catch (_) {
    // Detiene el build con un mensaje específico porque sin una URL válida el script no sabría a qué backend enviar los tickets.
    throw new Error('SETUPOFICINA_BACKEND_URL debe ser una URL HTTPS valida.');
  }

  // Comprueba que el valor represente sólo un origen: `URL` normaliza la ausencia de ruta como `/`, y aquí también se prohíben query y fragmento.
  const hasOnlyOrigin = url.pathname === '/' && !url.search && !url.hash;
  // Marca el caso permitido de producción comparando el origen normalizado, no la cadena original potencialmente ambigua.
  const isProduction = url.origin === PRODUCTION_BACKEND_URL;
  // Marca el segundo caso permitido: un deployment Preview cuyo hostname satisface el patrón cerrado declarado arriba.
  const isCloudflarePreview = PREVIEW_HOST_PATTERN.test(url.hostname);
  // Reúne todas las condiciones de rechazo para impedir HTTP, credenciales, puertos, rutas adicionales y hosts fuera de producción/Preview.
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !hasOnlyOrigin ||
    (!isProduction && !isCloudflarePreview)
  ) {
    // Explica al operador las dos familias de destinos aceptadas sin repetir ni exponer el valor potencialmente sensible recibido.
    throw new Error(
      'SETUPOFICINA_BACKEND_URL solo admite setupoficina.com.ar o un Preview de setupoficina-landing.pages.dev.'
    );
  }
  // Devuelve únicamente `protocol + host`, eliminando la barra final normalizada; `tsup.config.js` serializa exactamente este resultado.
  return url.origin;
}

// Resuelve el valor de build que consume `tiendanube-script/tsup.config.js`: acepta una inyección explícita para tests o lee la variable del proceso.
export function resolveBackendUrl(value = process.env.SETUPOFICINA_BACKEND_URL) {
  // Usa producción cuando la variable está ausente/vacía y, en ambos casos, obliga a pasar por la validación cerrada anterior.
  return validateBackendUrl(value || PRODUCTION_BACKEND_URL);
}
