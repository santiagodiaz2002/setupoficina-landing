// Este módulo fija la frontera de confianza del OAuth de Tiendanube para producción y vistas previas.
// Lo consumen los handlers de inicio, retorno y estado; sin estas comprobaciones una URL o tienda ajena podría entrar al flujo.
// Todas las funciones son puras salvo la creación de objetos de URL: no realizan red ni escriben en D1.
// Importa el tipo de error HTTP compartido para conservar códigos y respuestas coherentes entre módulos.
import { HttpError } from './http.mjs';

// Publica un valor canónico que otros módulos reutilizan y no deberían redefinir.
export const PRODUCTION_SETUP_ORIGIN = 'https://setupoficina.com.ar';
// Publica un valor canónico que otros módulos reutilizan y no deberían redefinir.
export const OAUTH_CALLBACK_PATH = '/api/tiendanube/oauth/callback';
// Publica un valor canónico que otros módulos reutilizan y no deberían redefinir.
export const SETUPOFICINA_APP_ID = '38321';

// Conserva una regla o un dato derivado en el alcance mínimo necesario.
const PREVIEW_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.setupoficina-landing\.pages\.dev$/;
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// Normaliza el entorno declarado y rechaza cualquier valor distinto de los dos modos admitidos; sin esta barrera se mezclarían configuraciones incompatibles.
export function configuredTiendanubeEnvironment(env = {}) {
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
  const environment = String(env.TIENDANUBE_ENV || '').trim().toLowerCase();
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
  if (!['production', 'preview'].includes(environment)) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(503, 'tiendanube_environment_invalid', 'Entorno Tiendanube no configurado.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Entrega el resultado validado; ningún dato sin comprobar atraviesa este punto.
  return environment;
// Cierra el bloque y limita el alcance de sus variables temporales.
}

// Construye la configuración de redirección y comprueba protocolo, origen, ruta y entorno antes de autorizar el flujo externo.
export function oauthRedirectConfig(env = {}) {
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
  const raw = String(env.TIENDANUBE_OAUTH_REDIRECT_URL || '').trim();
// Reserva una referencia mutable porque el valor se completa después de validar la entrada.
  let url;
// Aísla una operación que puede fallar al interpretar datos externos.
  try {
// Completa la validación o transformación actual sin introducir efectos externos.
    url = new URL(raw);
// Convierte el fallo de interpretación en un error controlado y no filtra detalles internos.
  } catch (_) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(503, 'oauth_redirect_invalid', 'Callback OAuth no configurado.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
  const isProduction = url.origin === PRODUCTION_SETUP_ORIGIN;
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
  const isPreview = PREVIEW_HOST_PATTERN.test(url.hostname);
// Normaliza el entorno declarado y rechaza cualquier valor distinto de los dos modos admitidos; sin esta barrera se mezclarían configuraciones incompatibles.
  const configuredEnvironment = configuredTiendanubeEnvironment(env);
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
  if (
// Completa la validación o transformación actual sin introducir efectos externos.
    url.protocol !== 'https:' ||
// Completa la validación o transformación actual sin introducir efectos externos.
    url.username ||
// Completa la validación o transformación actual sin introducir efectos externos.
    url.password ||
// Completa la validación o transformación actual sin introducir efectos externos.
    url.port ||
// Completa la validación o transformación actual sin introducir efectos externos.
    url.pathname !== OAUTH_CALLBACK_PATH ||
// Completa la validación o transformación actual sin introducir efectos externos.
    url.search ||
// Completa la validación o transformación actual sin introducir efectos externos.
    url.hash ||
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
    (!isProduction && !isPreview)
// Completa la validación o transformación actual sin introducir efectos externos.
  ) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(503, 'oauth_redirect_invalid', 'Callback OAuth fuera de los origenes permitidos.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
  if (
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
    (configuredEnvironment === 'production' && !isProduction) ||
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
    (configuredEnvironment === 'preview' && !isPreview)
// Completa la validación o transformación actual sin introducir efectos externos.
  ) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(503, 'oauth_environment_mismatch', 'Callback OAuth no coincide con el entorno configurado.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Devuelve un objeto ya normalizado para que los consumidores trabajen con una sola representación.
  return {
// Define un campo explícito del contrato interno que recibe el módulo llamador.
    redirectUrl: url.toString(),
// Define un campo explícito del contrato interno que recibe el módulo llamador.
    origin: url.origin,
// Define un campo explícito del contrato interno que recibe el módulo llamador.
    environment: isProduction ? 'production' : `preview:${url.origin}`,
// Completa la validación o transformación actual sin introducir efectos externos.
    isPreview
// Cierra el bloque y limita el alcance de sus variables temporales.
  };
// Cierra el bloque y limita el alcance de sus variables temporales.
}

// Contrasta la URL recibida con la configuración ya validada para impedir que otra procedencia reutilice el handler.
export function assertConfiguredOAuthRequest(request, redirect, expectedPath) {
// Reserva una referencia mutable porque el valor se completa después de validar la entrada.
  let url;
// Aísla una operación que puede fallar al interpretar datos externos.
  try {
// Completa la validación o transformación actual sin introducir efectos externos.
    url = new URL(request.url);
// Convierte el fallo de interpretación en un error controlado y no filtra detalles internos.
  } catch (_) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(403, 'oauth_origin_not_allowed', 'Origen OAuth no permitido.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
  if (url.origin !== redirect.origin || url.pathname !== expectedPath) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(403, 'oauth_origin_not_allowed', 'Origen OAuth no permitido.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Entrega el resultado validado; ningún dato sin comprobar atraviesa este punto.
  return url;
// Cierra el bloque y limita el alcance de sus variables temporales.
}

// Exige el identificador fijo de la aplicación y devuelve únicamente el valor previamente comprobado.
export function configuredAppId(env = {}) {
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
  const appId = String(env.TIENDANUBE_APP_ID || '').trim();
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
  if (appId !== SETUPOFICINA_APP_ID) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(503, 'oauth_app_invalid', 'App ID OAuth no configurado.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Entrega el resultado validado; ningún dato sin comprobar atraviesa este punto.
  return appId;
// Cierra el bloque y limita el alcance de sus variables temporales.
}

// Convierte la lista configurada de dominios permitidos en un conjunto validado para búsquedas exactas.
export function expectedStoreDomains(env = {}) {
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
  const entries = String(env.TIENDANUBE_EXPECTED_STORE_DOMAINS || '')
// Continúa la transformación secuencial de la configuración sin mutar el valor original.
    .split(',')
// Continúa la transformación secuencial de la configuración sin mutar el valor original.
    .map((entry) => entry.trim().toLowerCase())
// Continúa la transformación secuencial de la configuración sin mutar el valor original.
    .filter(Boolean);
// Esta condición detiene el flujo cuando una precondición de seguridad o configuración no se cumple.
  if (!entries.length || entries.some((entry) => !DOMAIN_PATTERN.test(entry))) {
// Interrumpe la petición con un error HTTP deliberado para que el consumidor reciba un estado estable.
    throw new HttpError(503, 'expected_store_domains_invalid', 'Dominios esperados no configurados.');
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Entrega el resultado validado; ningún dato sin comprobar atraviesa este punto.
  return new Set(entries);
// Cierra el bloque y limita el alcance de sus variables temporales.
}

// Canoniza un dominio de tienda y devuelve un valor vacío cuando su forma no es segura.
export function normalizeStoreDomain(value) {
// Conserva una regla o un dato derivado en el alcance mínimo necesario.
  const domain = String(value || '').trim().toLowerCase().replace(/\.$/, '');
// Entrega el resultado validado; ningún dato sin comprobar atraviesa este punto.
  return DOMAIN_PATTERN.test(domain) ? domain : '';
// Cierra el bloque y limita el alcance de sus variables temporales.
}

// Ofrece una comprobación booleana tolerante a errores para habilitar solamente las excepciones de vista previa.
export function isPreviewOAuthEnvironment(env = {}) {
// Aísla una operación que puede fallar al interpretar datos externos.
  try {
// Construye la configuración de redirección y comprueba protocolo, origen, ruta y entorno antes de autorizar el flujo externo.
    return oauthRedirectConfig(env).isPreview;
// Convierte el fallo de interpretación en un error controlado y no filtra detalles internos.
  } catch (_) {
// Entrega el resultado validado; ningún dato sin comprobar atraviesa este punto.
    return false;
// Cierra el bloque y limita el alcance de sus variables temporales.
  }
// Cierra el bloque y limita el alcance de sus variables temporales.
}
