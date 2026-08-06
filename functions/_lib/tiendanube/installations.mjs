import { HttpError } from './http.mjs';
import { isPreviewOAuthEnvironment } from './oauth-config.mjs';
import { REQUIRED_TIENDANUBE_SCOPES, validateGrantedScopes } from './scopes.mjs';
import { decryptAccessToken, encryptAccessToken } from './token-crypto.mjs';

export function optionalConfiguredStoreId(env = {}) {
  const storeId = String(env.TIENDANUBE_STORE_ID || '').trim();
  if (!storeId) return null;
  if (!/^\d+$/.test(storeId)) throw new HttpError(503, 'store_not_configured', 'Store ID no configurado.');
  return storeId;
}

export function configuredStoreId(env = {}) {
  const storeId = optionalConfiguredStoreId(env);
  if (!storeId) throw new HttpError(503, 'store_not_configured', 'Store ID no configurado.');
  return storeId;
}

function database(env = {}) {
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
  return env.LEADS_DB;
}

async function loadInstallationRecord(env, storeId) {
  return database(env).prepare(`
    SELECT store_id, store_domain, encrypted_access_token, encryption_iv,
           scopes_json, installed_at, updated_at, revoked_at
    FROM tiendanube_installations
    WHERE store_id = ?
    LIMIT 1
  `).bind(storeId).first();
}

export async function hasAnyActiveInstallation(env = {}) {
  const row = await database(env).prepare(`
    SELECT store_id
    FROM tiendanube_installations
    WHERE revoked_at IS NULL
    LIMIT 1
  `).first();
  return Boolean(row);
}

export async function loadActiveInstallation(env, storeId = configuredStoreId(env)) {
  const row = await loadInstallationRecord(env, storeId);
  return row && row.revoked_at === null ? row : null;
}

function storedScopes(row) {
  try {
    return validateGrantedScopes(JSON.parse(row.scopes_json));
  } catch (_) {
    throw new HttpError(503, 'oauth_installation_invalid', 'Instalacion OAuth activa invalida.');
  }
}

export async function saveInstallation(env, data, deps = {}) {
  const db = database(env);
  const storeId = String(data.storeId || '').trim();
  if (!/^\d+$/.test(storeId)) throw new HttpError(502, 'oauth_store_invalid', 'Respuesta de tienda invalida.');
  const configuredId = optionalConfiguredStoreId(env);
  if (configuredId && storeId !== configuredId) {
    throw new HttpError(403, 'store_mismatch', 'Tienda OAuth no autorizada.');
  }
  const scopes = validateGrantedScopes(data.scopes);
  const existing = await loadInstallationRecord(env, storeId);
  if (existing && existing.revoked_at === null) {
    throw new HttpError(409, 'installation_already_active', 'La tienda ya tiene una instalacion activa.');
  }

  const encrypted = await encryptAccessToken(
    data.accessToken,
    env.TIENDANUBE_TOKEN_ENCRYPTION_KEY,
    storeId,
    deps.cryptoImpl
  );
  const now = Number(deps.now ?? Math.floor(Date.now() / 1000));
  let changes = 0;
  if (existing) {
    const result = await db.prepare(`
      UPDATE tiendanube_installations
      SET store_domain = ?, encrypted_access_token = ?, encryption_iv = ?,
          scopes_json = ?, installed_at = ?, updated_at = ?, revoked_at = NULL
      WHERE store_id = ? AND revoked_at IS NOT NULL
    `).bind(
      data.storeDomain,
      encrypted.encryptedAccessToken,
      encrypted.encryptionIv,
      JSON.stringify(scopes),
      now,
      now,
      storeId
    ).run();
    changes = Number(result && result.meta && result.meta.changes || 0);
  } else {
    try {
      const result = await db.prepare(`
        INSERT INTO tiendanube_installations (
          store_id, store_domain, encrypted_access_token, encryption_iv,
          scopes_json, installed_at, updated_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `).bind(
        storeId,
        data.storeDomain,
        encrypted.encryptedAccessToken,
        encrypted.encryptionIv,
        JSON.stringify(scopes),
        now,
        now
      ).run();
      changes = Number(result && result.meta && result.meta.changes || 0);
    } catch (error) {
      if (/unique|constraint/i.test(String(error && error.message || ''))) {
        throw new HttpError(409, 'installation_already_active', 'La tienda ya tiene una instalacion activa.');
      }
      throw error;
    }
  }
  if (changes !== 1) {
    throw new HttpError(409, 'installation_already_active', 'La tienda ya tiene una instalacion activa.');
  }
  return { storeId, storeDomain: data.storeDomain, scopes, installedAt: now };
}

export async function accessTokenForEnvironment(env, overrides = {}) {
  const storeId = configuredStoreId(env);
  if (env.LEADS_DB) {
    const installation = await loadActiveInstallation(env, storeId);
    if (installation) {
      storedScopes(installation);
      return {
        storeId,
        accessToken: await decryptAccessToken(
          installation,
          env.TIENDANUBE_TOKEN_ENCRYPTION_KEY,
          storeId,
          overrides.cryptoImpl
        ),
        source: 'encrypted_d1'
      };
    }
  }

  const developmentToken = String(env.TIENDANUBE_ACCESS_TOKEN || '');
  if (developmentToken && isPreviewOAuthEnvironment(env)) {
    return { storeId, accessToken: developmentToken, source: 'preview_fallback' };
  }
  throw new HttpError(503, 'oauth_installation_missing', 'Instalacion OAuth activa no disponible.');
}

export function installationPublicStatus(row, configuredId) {
  const empty = {
    installed: false,
    storeId: configuredId || null,
    storeDomain: null,
    scopes: [],
    installedAt: null,
    configurationReady: false
  };
  if (!configuredId || !row) return empty;
  let scopes;
  try {
    scopes = validateGrantedScopes(JSON.parse(row.scopes_json));
  } catch (_) {
    return { ...empty, installed: true };
  }
  return {
    installed: true,
    storeId: String(row.store_id),
    storeDomain: String(row.store_domain),
    scopes,
    installedAt: new Date(Number(row.installed_at) * 1000).toISOString(),
    configurationReady: scopes.length === REQUIRED_TIENDANUBE_SCOPES.length
  };
}
