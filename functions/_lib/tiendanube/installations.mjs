// Este módulo es la única frontera de persistencia para instalaciones OAuth de Tiendanube.
// Lo consumen OAuth, estado y cliente HTTP; sin él no habría selección inequívoca de tienda ni custodia cifrada del acceso.
// Las consultas D1 preparan y vinculan valores por separado para evitar interpolar datos externos en SQL.
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { HttpError } from './http.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { isPreviewOAuthEnvironment } from './oauth-config.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { REQUIRED_TIENDANUBE_SCOPES, validateGrantedScopes } from './scopes.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { decryptAccessToken, encryptAccessToken } from './token-crypto.mjs';

// Lee el identificador opcional de tienda y solo acepta su representación decimal canónica.
export function optionalConfiguredStoreId(env = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeId = String(env.TIENDANUBE_STORE_ID || '').trim();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!storeId) return null;
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!/^\d+$/.test(storeId)) throw new HttpError(503, 'store_not_configured', 'Store ID no configurado.');
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return storeId;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Convierte la configuración opcional en requisito y emite un error de servicio cuando falta.
export function configuredStoreId(env = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeId = optionalConfiguredStoreId(env);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!storeId) throw new HttpError(503, 'store_not_configured', 'Store ID no configurado.');
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return storeId;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Obtiene el binding D1 requerido y falla de forma explícita si el despliegue no lo configuró.
function database(env = {}) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return env.LEADS_DB;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Consulta por clave de tienda y devuelve también registros revocados para decisiones administrativas.
async function loadInstallationRecord(env, storeId) {
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
  return database(env).prepare(`
    SELECT store_id, store_domain, encrypted_access_token, encryption_iv,
           scopes_json, installed_at, updated_at, revoked_at
    FROM tiendanube_installations
    WHERE store_id = ?
    LIMIT 1
  `).bind(storeId).first();
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Comprueba si existe al menos una instalación vigente sin recuperar secretos innecesarios.
export async function hasAnyActiveInstallation(env = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const row = await database(env).prepare(`
    SELECT store_id
    FROM tiendanube_installations
    WHERE revoked_at IS NULL
    LIMIT 1
  `).first();
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return Boolean(row);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Convierte la configuración opcional en requisito y emite un error de servicio cuando falta.
export async function loadActiveInstallation(env, storeId = configuredStoreId(env)) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const row = await loadInstallationRecord(env, storeId);
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return row && row.revoked_at === null ? row : null;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Interpreta el conjunto persistido de permisos y trata datos dañados como lista vacía.
function storedScopes(row) {
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Entrega el valor ya comprobado al llamador y termina esta rama.
    return validateGrantedScopes(JSON.parse(row.scopes_json));
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (_) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(503, 'oauth_installation_invalid', 'Instalacion OAuth activa invalida.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Valida tienda, dominio y permisos; cifra el acceso y actualiza o inserta una única instalación activa.
export async function saveInstallation(env, data, deps = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const db = database(env);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeId = String(data.storeId || '').trim();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!/^\d+$/.test(storeId)) throw new HttpError(502, 'oauth_store_invalid', 'Respuesta de tienda invalida.');
// Calcula y conserva un dato inmutable dentro de este alcance.
  const configuredId = optionalConfiguredStoreId(env);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (configuredId && storeId !== configuredId) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(403, 'store_mismatch', 'Tienda OAuth no autorizada.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const scopes = validateGrantedScopes(data.scopes);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const existing = await loadInstallationRecord(env, storeId);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (existing && existing.revoked_at === null) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(409, 'installation_already_active', 'La tienda ya tiene una instalacion activa.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const encrypted = await encryptAccessToken(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    data.accessToken,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    env.TIENDANUBE_TOKEN_ENCRYPTION_KEY,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    storeId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    deps.cryptoImpl
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  );
// Calcula y conserva un dato inmutable dentro de este alcance.
  const now = Number(deps.now ?? Math.floor(Date.now() / 1000));
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let changes = 0;
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (existing) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const result = await db.prepare(`
      UPDATE tiendanube_installations
      SET store_domain = ?, encrypted_access_token = ?, encryption_iv = ?,
          scopes_json = ?, installed_at = ?, updated_at = ?, revoked_at = NULL
      WHERE store_id = ? AND revoked_at IS NOT NULL
    `).bind(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      data.storeDomain,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      encrypted.encryptedAccessToken,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      encrypted.encryptionIv,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      JSON.stringify(scopes),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      now,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      now,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      storeId
// Ejecuta la mutación preparada y permite revisar cuántas filas cambiaron.
    ).run();
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    changes = Number(result && result.meta && result.meta.changes || 0);
// Atiende el caso alternativo ya descartado por la condición previa.
  } else {
// Aísla una operación que puede fallar por datos externos, red o persistencia.
    try {
// Calcula y conserva un dato inmutable dentro de este alcance.
      const result = await db.prepare(`
        INSERT INTO tiendanube_installations (
          store_id, store_domain, encrypted_access_token, encryption_iv,
          scopes_json, installed_at, updated_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `).bind(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        storeId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        data.storeDomain,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        encrypted.encryptedAccessToken,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        encrypted.encryptionIv,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        JSON.stringify(scopes),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        now,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        now
// Ejecuta la mutación preparada y permite revisar cuántas filas cambiaron.
      ).run();
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
      changes = Number(result && result.meta && result.meta.changes || 0);
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
    } catch (error) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
      if (/unique|constraint/i.test(String(error && error.message || ''))) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
        throw new HttpError(409, 'installation_already_active', 'La tienda ya tiene una instalacion activa.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
      }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
      throw error;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (changes !== 1) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(409, 'installation_already_active', 'La tienda ya tiene una instalacion activa.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Devuelve un objeto normalizado que forma parte del contrato interno del módulo.
  return { storeId, storeDomain: data.storeDomain, scopes, installedAt: now };
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Descifra el acceso persistido y solo habilita el respaldo en claro para una vista previa expresamente validada.
export async function accessTokenForEnvironment(env, overrides = {}) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const storeId = configuredStoreId(env);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (env.LEADS_DB) {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const installation = await loadActiveInstallation(env, storeId);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (installation) {
// Interpreta el conjunto persistido de permisos y trata datos dañados como lista vacía.
      storedScopes(installation);
// Devuelve un objeto normalizado que forma parte del contrato interno del módulo.
      return {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
        storeId,
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
        accessToken: await decryptAccessToken(
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
          installation,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
          env.TIENDANUBE_TOKEN_ENCRYPTION_KEY,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
          storeId,
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
          overrides.cryptoImpl
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
        ),
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
        source: 'encrypted_d1'
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
      };
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }

// Calcula y conserva un dato inmutable dentro de este alcance.
  const developmentToken = String(env.TIENDANUBE_ACCESS_TOKEN || '');
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (developmentToken && isPreviewOAuthEnvironment(env)) {
// Devuelve un objeto normalizado que forma parte del contrato interno del módulo.
    return { storeId, accessToken: developmentToken, source: 'preview_fallback' };
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
  throw new HttpError(503, 'oauth_installation_missing', 'Instalacion OAuth activa no disponible.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Proyecta una instalación a datos públicos y excluye material cifrado, vector y credenciales.
export function installationPublicStatus(row, configuredId) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const empty = {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    installed: false,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    storeId: configuredId || null,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    storeDomain: null,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    scopes: [],
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    installedAt: null,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    configurationReady: false
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  };
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!configuredId || !row) return empty;
// Reserva estado mutable porque el valor se ajustará durante la validación o el recorrido.
  let scopes;
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    scopes = validateGrantedScopes(JSON.parse(row.scopes_json));
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (_) {
// Devuelve un objeto normalizado que forma parte del contrato interno del módulo.
    return { ...empty, installed: true };
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Devuelve un objeto normalizado que forma parte del contrato interno del módulo.
  return {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    installed: true,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    storeId: String(row.store_id),
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    storeDomain: String(row.store_domain),
// Completa esta etapa concreta de cálculo, validación o construcción del resultado.
    scopes,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    installedAt: new Date(Number(row.installed_at) * 1000).toISOString(),
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
    configurationReady: scopes.length === REQUIRED_TIENDANUBE_SCOPES.length
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  };
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}
