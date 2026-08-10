// HttpError permite rechazar permisos incorrectos con un código estable y sin detalles del token.
import { HttpError } from './http.mjs';

// Contrato mínimo y exacto de la aplicación: leer productos y administrar el script instalado.
// Object.freeze evita mutaciones accidentales compartidas entre requests del mismo isolate.
export const REQUIRED_TIENDANUBE_SCOPES = Object.freeze([
// Completa la etapa actual de permisos OAuth sin introducir un efecto adicional.
  'read_products',
// Completa la etapa actual de permisos OAuth sin introducir un efecto adicional.
  'write_scripts'
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
]);

// Restringe cada nombre a la sintaxis documentada y limita entradas desmesuradas.
const SCOPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

// Crea siempre el mismo error público para no revelar qué permiso concreto faltó o sobró.
function invalidScopes() {
// Entrega el valor ya validado al llamador y termina esta rama.
  return new HttpError(403, 'oauth_scopes_invalid', 'Los permisos concedidos no coinciden con los requeridos.');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Normaliza las formas de respuesta observadas: texto, array o contenedor scope/scopes.
function scopeValues(value) {
// Comprueba una precondición de permisos OAuth y detiene el flujo cuando no se cumple.
  if (typeof value === 'string') {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const normalized = value.trim();
    // Un texto vacío nunca equivale a una concesión válida.
    if (!normalized) throw invalidScopes();
    // Algunos proveedores separan permisos por espacios y otros por comas.
    return normalized.split(/[\s,]+/u);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Comprueba una precondición de permisos OAuth y detiene el flujo cuando no se cumple.
  if (Array.isArray(value)) {
    // Se rechazan arrays vacíos y miembros no textuales antes de llamar trim.
    if (!value.length || value.some((scope) => typeof scope !== 'string')) throw invalidScopes();
// Entrega el valor ya validado al llamador y termina esta rama.
    return value.map((scope) => scope.trim());
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Comprueba una precondición de permisos OAuth y detiene el flujo cuando no se cumple.
  if (value && typeof value === 'object') {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const keys = Object.keys(value);
    // El contenedor debe tener una sola clave conocida; campos extra podrían ocultar ambigüedad.
    if (keys.length !== 1 || !['scope', 'scopes'].includes(keys[0])) throw invalidScopes();
    // La recursión aplica las mismas reglas al valor interno, sin duplicar lógica.
    return scopeValues(value[keys[0]]);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
  throw invalidScopes();
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Exige igualdad de conjuntos, no sólo que estén presentes algunos permisos requeridos.
export function validateGrantedScopes(value) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const scopes = scopeValues(value);
  // Cantidad exacta, sintaxis y ausencia de duplicados se comprueban antes de comparar nombres.
  if (
// Completa la etapa actual de permisos OAuth sin introducir un efecto adicional.
    scopes.length !== REQUIRED_TIENDANUBE_SCOPES.length ||
// Completa la etapa actual de permisos OAuth sin introducir un efecto adicional.
    scopes.some((scope) => !SCOPE_PATTERN.test(scope)) ||
// Completa la etapa actual de permisos OAuth sin introducir un efecto adicional.
    new Set(scopes).size !== scopes.length
// Completa la etapa actual de permisos OAuth sin introducir un efecto adicional.
  ) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw invalidScopes();
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const granted = new Set(scopes);
  // Si todos los requeridos están y la cantidad coincide, tampoco existen permisos adicionales.
  if (REQUIRED_TIENDANUBE_SCOPES.some((scope) => !granted.has(scope))) throw invalidScopes();
  // Se devuelve el orden canónico, independiente del orden recibido por OAuth.
  return [...REQUIRED_TIENDANUBE_SCOPES];
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Produce una etiqueta humana reutilizando la misma fuente de verdad que valida el callback.
export function requiredScopesLabel() {
// Entrega el valor ya validado al llamador y termina esta rama.
  return REQUIRED_TIENDANUBE_SCOPES.join(', ');
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}
