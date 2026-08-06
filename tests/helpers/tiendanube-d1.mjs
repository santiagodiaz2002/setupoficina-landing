export class MemoryD1 {
  constructor(catalog = []) {
    this.catalog = new Map(catalog.map((row) => {
      const normalized = { store_id: '12345', max_quantity: 10, enabled: 1, ...row };
      return [`${normalized.store_id}:${normalized.internal_id}`, normalized];
    }));
    this.transfers = new Map();
    this.rates = new Map();
    this.oauthStates = new Map();
    this.installations = new Map();
  }

  prepare(sql) {
    return new MemoryStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

class MemoryStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = String(sql).replace(/\s+/g, ' ').trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async all() {
    if (this.sql.includes('FROM tiendanube_catalog')) {
      const [storeId, ...internalIds] = this.args;
      return {
        results: internalIds
          .map((id) => this.db.catalog.get(`${storeId}:${id}`))
          .filter((row) => row && Number(row.enabled) === 1)
      };
    }
    throw new Error(`SQL all no soportado: ${this.sql}`);
  }

  async first() {
    if (this.sql.startsWith('INSERT INTO tiendanube_rate_limits')) {
      const [keyHash, route, now, expiresAt, resetBefore] = this.args;
      const key = `${keyHash}:${route}`;
      const previous = this.db.rates.get(key);
      const next = !previous || previous.window_start <= resetBefore
        ? { key_hash: keyHash, route, window_start: now, request_count: 1, expires_at: expiresAt }
        : { ...previous, request_count: previous.request_count + 1, expires_at: expiresAt };
      this.db.rates.set(key, next);
      return { request_count: next.request_count, window_start: next.window_start };
    }

    if (this.sql.startsWith('UPDATE tiendanube_oauth_states SET consumed_at = ?')) {
      const [consumedAt, stateHash, environment, now] = this.args;
      const row = this.db.oauthStates.get(String(stateHash));
      if (!row || row.environment !== String(environment) || row.consumed_at !== null || row.expires_at <= now) return null;
      row.consumed_at = consumedAt;
      return { state_hash: row.state_hash };
    }

    if (this.sql.includes('FROM tiendanube_oauth_states')) {
      const [stateHash, environment] = this.args;
      const row = this.db.oauthStates.get(String(stateHash));
      return row && row.environment === String(environment)
        ? { expires_at: row.expires_at, consumed_at: row.consumed_at }
        : null;
    }

    if (this.sql.includes('FROM tiendanube_installations')) {
      if (this.sql.includes('WHERE revoked_at IS NULL')) {
        const row = Array.from(this.db.installations.values()).find((installation) => installation.revoked_at === null);
        return row ? { store_id: row.store_id } : null;
      }
      const [storeId] = this.args;
      const row = this.db.installations.get(String(storeId));
      return row ? { ...row } : null;
    }

    if (this.sql.includes('client_request_id = ?')) {
      const [storeId, clientRequestId] = this.args;
      return Array.from(this.db.transfers.values()).find((row) => (
        row.store_id === String(storeId) && row.client_request_id === String(clientRequestId)
      )) || null;
    }

    if (this.sql.startsWith("UPDATE tiendanube_cart_transfers SET status = 'processing'")) {
      const [processingStartedAt, leaseExpiresAt, processingTokenHash, ticketHash, storeId, now, leaseNow] = this.args;
      const row = this.db.transfers.get(String(ticketHash));
      const eligible = row && row.store_id === String(storeId) && row.expires_at > now && (
        row.status === 'pending' || (row.status === 'processing' && row.processing_lease_expires_at <= leaseNow)
      );
      if (!eligible) return null;
      row.status = 'processing';
      row.processing_started_at = processingStartedAt;
      row.processing_lease_expires_at = Math.min(row.expires_at, leaseExpiresAt);
      row.processing_token_hash = processingTokenHash;
      return {
        selection_json: row.selection_json,
        resolved_items_json: row.resolved_items_json,
        unavailable_items_json: row.unavailable_items_json,
        expires_at: row.expires_at
      };
    }

    if (this.sql.includes('SELECT status, expires_at, processing_lease_expires_at FROM tiendanube_cart_transfers')) {
      const [ticketHash, storeId] = this.args;
      const row = this.db.transfers.get(String(ticketHash));
      return row && row.store_id === String(storeId)
        ? { status: row.status, expires_at: row.expires_at, processing_lease_expires_at: row.processing_lease_expires_at }
        : null;
    }

    if (this.sql.includes('SELECT status, expires_at, processing_token_hash,')) {
      const [ticketHash, storeId] = this.args;
      const row = this.db.transfers.get(String(ticketHash));
      return row && row.store_id === String(storeId)
        ? {
            status: row.status,
            expires_at: row.expires_at,
            processing_token_hash: row.processing_token_hash,
            resolved_items_json: row.resolved_items_json,
            unavailable_items_json: row.unavailable_items_json
          }
        : null;
    }

    throw new Error(`SQL first no soportado: ${this.sql}`);
  }

  async run() {
    if (this.sql.startsWith('DELETE FROM tiendanube_oauth_states WHERE expires_at <= ?')) {
      const [now] = this.args;
      let changes = 0;
      for (const [key, row] of this.db.oauthStates) {
        if (row.expires_at <= now) {
          this.db.oauthStates.delete(key);
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (this.sql.startsWith('INSERT INTO tiendanube_oauth_states')) {
      const [stateHash, environment, createdAt, expiresAt] = this.args;
      if (this.db.oauthStates.has(String(stateHash))) throw new Error('UNIQUE constraint failed: state_hash');
      this.db.oauthStates.set(String(stateHash), {
        state_hash: String(stateHash),
        environment: String(environment),
        store_id: null,
        created_at: createdAt,
        expires_at: expiresAt,
        consumed_at: null
      });
      return { meta: { changes: 1 } };
    }

    if (this.sql.startsWith('INSERT INTO tiendanube_installations')) {
      const [storeId, storeDomain, encryptedAccessToken, encryptionIv, scopesJson, installedAt, updatedAt] = this.args;
      if (this.db.installations.has(String(storeId))) throw new Error('UNIQUE constraint failed: tiendanube_installations.store_id');
      this.db.installations.set(String(storeId), {
        store_id: String(storeId),
        store_domain: String(storeDomain),
        encrypted_access_token: String(encryptedAccessToken),
        encryption_iv: String(encryptionIv),
        scopes_json: String(scopesJson),
        installed_at: installedAt,
        updated_at: updatedAt,
        revoked_at: null
      });
      return { meta: { changes: 1 } };
    }

    if (this.sql.startsWith('UPDATE tiendanube_installations SET store_domain = ?')) {
      const [storeDomain, encryptedAccessToken, encryptionIv, scopesJson, installedAt, updatedAt, storeId] = this.args;
      const previous = this.db.installations.get(String(storeId));
      if (!previous || previous.revoked_at === null) return { meta: { changes: 0 } };
      this.db.installations.set(String(storeId), {
        store_id: String(storeId),
        store_domain: String(storeDomain),
        encrypted_access_token: String(encryptedAccessToken),
        encryption_iv: String(encryptionIv),
        scopes_json: String(scopesJson),
        installed_at: installedAt,
        updated_at: updatedAt,
        revoked_at: null
      });
      return { meta: { changes: 1 } };
    }

    if (this.sql.startsWith('UPDATE tiendanube_oauth_states SET store_id = ?')) {
      const [storeId, stateHash, environment] = this.args;
      const row = this.db.oauthStates.get(String(stateHash));
      if (!row || row.environment !== String(environment) || row.consumed_at === null) return { meta: { changes: 0 } };
      row.store_id = String(storeId);
      return { meta: { changes: 1 } };
    }

    if (this.sql.startsWith('INSERT INTO tiendanube_cart_transfers')) {
      const [ticketHash, storeId, clientRequestId, selectionJson, resolvedJson, unavailableJson, createdAt, expiresAt] = this.args;
      if (this.db.transfers.has(String(ticketHash))) throw new Error('UNIQUE constraint failed: ticket_hash');
      if (Array.from(this.db.transfers.values()).some((row) => row.store_id === String(storeId) && row.client_request_id === String(clientRequestId))) {
        throw new Error('UNIQUE constraint failed: client_request_id');
      }
      this.db.transfers.set(String(ticketHash), {
        ticket_hash: String(ticketHash),
        store_id: String(storeId),
        client_request_id: String(clientRequestId),
        selection_json: selectionJson,
        resolved_items_json: resolvedJson,
        unavailable_items_json: unavailableJson,
        status: 'pending',
        created_at: createdAt,
        expires_at: expiresAt,
        processing_started_at: null,
        processing_lease_expires_at: null,
        processing_token_hash: null,
        completed_at: null,
        completion_json: null
      });
      return { meta: { changes: 1 } };
    }

    if (this.sql.startsWith("UPDATE tiendanube_cart_transfers SET status = 'expired'")) {
      const [ticketHash, storeId, now] = this.args;
      const row = this.db.transfers.get(String(ticketHash));
      if (
        row && row.store_id === String(storeId) &&
        ['pending', 'processing'].includes(row.status) && row.expires_at <= now
      ) {
        row.status = 'expired';
        row.processing_started_at = null;
        row.processing_lease_expires_at = null;
        row.processing_token_hash = null;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (this.sql.startsWith("UPDATE tiendanube_cart_transfers SET status = 'completed'")) {
      const [completedAt, completionJson, ticketHash, storeId, processingTokenHash, now] = this.args;
      const row = this.db.transfers.get(String(ticketHash));
      if (
        !row || row.store_id !== String(storeId) || row.status !== 'processing' ||
        row.processing_token_hash !== String(processingTokenHash) || row.expires_at <= now
      ) return { meta: { changes: 0 } };
      row.status = 'completed';
      row.completed_at = completedAt;
      row.completion_json = completionJson;
      return { meta: { changes: 1 } };
    }

    if (this.sql.startsWith('DELETE FROM tiendanube_cart_transfers')) {
      const [storeId] = this.args;
      let changes = 0;
      for (const [key, row] of this.db.transfers) {
        if (row.store_id === String(storeId)) {
          this.db.transfers.delete(key);
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (this.sql.startsWith('DELETE FROM tiendanube_installations')) {
      const [storeId] = this.args;
      const changes = this.db.installations.delete(String(storeId)) ? 1 : 0;
      return { meta: { changes } };
    }

    if (this.sql.startsWith('DELETE FROM tiendanube_oauth_states WHERE store_id = ? OR expires_at <= ?')) {
      const [storeId, now] = this.args;
      let changes = 0;
      for (const [key, row] of this.db.oauthStates) {
        if (row.store_id === String(storeId) || row.expires_at <= now) {
          this.db.oauthStates.delete(key);
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (this.sql.startsWith('DELETE FROM tiendanube_catalog WHERE store_id = ?')) {
      const [storeId] = this.args;
      let changes = 0;
      for (const [key, row] of this.db.catalog) {
        if (row.store_id === String(storeId)) {
          this.db.catalog.delete(key);
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (this.sql.startsWith('DELETE FROM tiendanube_rate_limits')) {
      if (this.sql.includes('WHERE expires_at <= ?')) {
        const [now] = this.args;
        let changes = 0;
        for (const [key, row] of this.db.rates.entries()) {
          if (Number(row.expires_at) <= Number(now)) {
            this.db.rates.delete(key);
            changes += 1;
          }
        }
        return { meta: { changes } };
      }
      const changes = this.db.rates.size;
      this.db.rates.clear();
      return { meta: { changes } };
    }

    throw new Error(`SQL run no soportado: ${this.sql}`);
  }
}

export const PRODUCT_IDS = Object.freeze({
  soporte_notebook: [1001, 2001],
  mouse_vertical: [1002, 2002],
  mousepad_xxl: [1003, 2003],
  soporte_monitor: [1004, 2004],
  teclado_mec: [1005, 2005],
  hub_usb: [1006, 2006],
  organizador_prem: [1007, 2007],
  luz_led: [1008, 2008],
  'reposamuñecas': [1009, 2009],
  almohadilla: [1010, 2010],
  standing_desk: [1011, 2011]
});

export function catalogRows(ids = Object.keys(PRODUCT_IDS)) {
  return ids.map((internalId) => ({
    store_id: '12345',
    internal_id: internalId,
    product_id: PRODUCT_IDS[internalId][0],
    variant_id: PRODUCT_IDS[internalId][1],
    enabled: 1,
    max_quantity: 10
  }));
}

export function productFor(internalId, overrides = {}) {
  const [productId, variantId] = PRODUCT_IDS[internalId];
  const variantOverrides = overrides.variant || {};
  return {
    id: productId,
    name: { es: `Producto ${internalId}` },
    published: true,
    variants: [{
      id: variantId,
      product_id: productId,
      price: '100.00',
      promotional_price: null,
      stock_management: true,
      stock: 20,
      inventory_levels: [{ location_id: 'loc-1', stock: 20 }],
      values: [],
      ...variantOverrides
    }],
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'variant'))
  };
}

export class FakeTiendanubeClient {
  constructor(products = {}) {
    this.products = new Map(Object.entries(products).map(([id, product]) => [Number(id), product]));
    this.calls = [];
  }

  async getProduct(productId) {
    this.calls.push(Number(productId));
    if (!this.products.has(Number(productId))) {
      const error = new Error('not found');
      error.name = 'TiendanubeApiError';
      error.status = 404;
      throw error;
    }
    return this.products.get(Number(productId));
  }
}

export function productsFor(ids) {
  return Object.fromEntries(ids.map((internalId) => {
    const product = productFor(internalId);
    return [String(product.id), product];
  }));
}

export function envFor(db, overrides = {}) {
  return {
    LEADS_DB: db,
    TIENDANUBE_ENABLED: 'true',
    TIENDANUBE_ENV: 'production',
    TIENDANUBE_API_VERSION: '2025-03',
    TIENDANUBE_STORE_ID: '12345',
    TIENDANUBE_ACCESS_TOKEN: 'test-access-token',
    TIENDANUBE_CLIENT_SECRET: 'test-client-secret',
    TIENDANUBE_APP_ID: '38321',
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://setupoficina.com.ar/api/tiendanube/oauth/callback',
    TIENDANUBE_EXPECTED_STORE_DOMAINS: 'primoffice2.mitiendanube.com',
    TIENDANUBE_TOKEN_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    TIENDANUBE_USER_AGENT: 'setupoficina (tests@example.com)',
    TIENDANUBE_STOREFRONT_URL: 'https://primoffice2.mitiendanube.com/',
    TIENDANUBE_ALLOWED_SETUP_ORIGINS: 'https://setupoficina.com.ar',
    TIENDANUBE_ALLOWED_STOREFRONT_ORIGINS: 'https://primoffice2.mitiendanube.com,https://primoffice.com.ar,https://www.primoffice.com.ar',
    ...overrides
  };
}

export function jsonRequest(url, body, origin = 'https://setupoficina.com.ar') {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'CF-Connecting-IP': '203.0.113.20',
      'User-Agent': 'test-agent'
    },
    body: JSON.stringify(body)
  });
}
