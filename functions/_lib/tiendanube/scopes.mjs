import { HttpError } from './http.mjs';

export const REQUIRED_TIENDANUBE_SCOPES = Object.freeze([
  'read_products',
  'write_scripts'
]);

const SCOPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function invalidScopes() {
  return new HttpError(403, 'oauth_scopes_invalid', 'Los permisos concedidos no coinciden con los requeridos.');
}

function scopeValues(value) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) throw invalidScopes();
    return normalized.split(/[\s,]+/u);
  }
  if (Array.isArray(value)) {
    if (!value.length || value.some((scope) => typeof scope !== 'string')) throw invalidScopes();
    return value.map((scope) => scope.trim());
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length !== 1 || !['scope', 'scopes'].includes(keys[0])) throw invalidScopes();
    return scopeValues(value[keys[0]]);
  }
  throw invalidScopes();
}

export function validateGrantedScopes(value) {
  const scopes = scopeValues(value);
  if (
    scopes.length !== REQUIRED_TIENDANUBE_SCOPES.length ||
    scopes.some((scope) => !SCOPE_PATTERN.test(scope)) ||
    new Set(scopes).size !== scopes.length
  ) {
    throw invalidScopes();
  }
  const granted = new Set(scopes);
  if (REQUIRED_TIENDANUBE_SCOPES.some((scope) => !granted.has(scope))) throw invalidScopes();
  return [...REQUIRED_TIENDANUBE_SCOPES];
}

export function requiredScopesLabel() {
  return REQUIRED_TIENDANUBE_SCOPES.join(', ');
}
