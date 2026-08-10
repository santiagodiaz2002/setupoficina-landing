// Inicializa de forma idempotente el almacenamiento del puente Tiendanube.
// Usa exactamente las mismas sentencias CREATE IF NOT EXISTS de la migracion versionada.
// No modifica ni elimina la tabla leads ni datos comerciales existentes.
import { HttpError } from './http.mjs';

const SCHEMA_STATEMENTS = Object.freeze([
  "CREATE TABLE IF NOT EXISTS tiendanube_catalog (\n  store_id TEXT NOT NULL CHECK (\n    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'\n  ),\n  internal_id TEXT NOT NULL CHECK (length(internal_id) BETWEEN 1 AND 64),\n  expected_sku TEXT NOT NULL CHECK (length(expected_sku) BETWEEN 1 AND 100),\n  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),\n  product_id INTEGER NOT NULL CHECK (product_id > 0),\n  variant_id INTEGER NOT NULL CHECK (variant_id > 0),\n  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),\n  max_quantity INTEGER NOT NULL DEFAULT 10 CHECK (max_quantity BETWEEN 1 AND 100),\n  created_at INTEGER NOT NULL DEFAULT (unixepoch()),\n  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),\n  PRIMARY KEY (store_id, internal_id),\n  UNIQUE (store_id, product_id, variant_id)\n);",
  "CREATE INDEX IF NOT EXISTS idx_tiendanube_catalog_enabled\n  ON tiendanube_catalog(store_id, enabled, internal_id);",
  "CREATE TABLE IF NOT EXISTS tiendanube_cart_transfers (\n  ticket_hash TEXT PRIMARY KEY CHECK (\n    length(ticket_hash) = 64 AND ticket_hash NOT GLOB '*[^0-9a-f]*'\n  ),\n  store_id TEXT NOT NULL CHECK (\n    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'\n  ),\n  client_request_id TEXT NOT NULL CHECK (length(client_request_id) = 36),\n  selection_json TEXT NOT NULL CHECK (json_valid(selection_json)),\n  resolved_items_json TEXT NOT NULL CHECK (json_valid(resolved_items_json)),\n  unavailable_items_json TEXT NOT NULL CHECK (json_valid(unavailable_items_json)),\n  status TEXT NOT NULL DEFAULT 'pending'\n    CHECK (status IN ('pending', 'processing', 'completed', 'expired')),\n  created_at INTEGER NOT NULL,\n  expires_at INTEGER NOT NULL,\n  processing_started_at INTEGER,\n  processing_lease_expires_at INTEGER,\n  processing_token_hash TEXT,\n  completed_at INTEGER,\n  completion_json TEXT CHECK (completion_json IS NULL OR json_valid(completion_json)),\n  CHECK (expires_at > created_at AND expires_at - created_at <= 600),\n  CHECK (\n    (status IN ('pending', 'expired') AND processing_started_at IS NULL\n      AND processing_lease_expires_at IS NULL AND processing_token_hash IS NULL)\n    OR\n    (status IN ('processing', 'completed') AND processing_started_at IS NOT NULL\n      AND processing_lease_expires_at IS NOT NULL\n      AND processing_lease_expires_at > processing_started_at\n      AND processing_lease_expires_at <= expires_at\n      AND length(processing_token_hash) = 64\n      AND processing_token_hash NOT GLOB '*[^0-9a-f]*')\n  ),\n  CHECK (\n    (status = 'completed' AND completed_at IS NOT NULL AND completion_json IS NOT NULL)\n    OR\n    (status <> 'completed' AND completed_at IS NULL AND completion_json IS NULL)\n  ),\n  UNIQUE (store_id, client_request_id)\n);",
  "CREATE INDEX IF NOT EXISTS idx_tiendanube_transfers_expiry\n  ON tiendanube_cart_transfers(store_id, status, expires_at);",
  "CREATE INDEX IF NOT EXISTS idx_tiendanube_transfers_processing_lease\n  ON tiendanube_cart_transfers(store_id, status, processing_lease_expires_at);",
  "CREATE TABLE IF NOT EXISTS tiendanube_rate_limits (\n  key_hash TEXT NOT NULL CHECK (\n    length(key_hash) = 64 AND key_hash NOT GLOB '*[^0-9a-f]*'\n  ),\n  route TEXT NOT NULL CHECK (length(route) BETWEEN 1 AND 160),\n  window_start INTEGER NOT NULL CHECK (window_start >= 0),\n  request_count INTEGER NOT NULL DEFAULT 1,\n  expires_at INTEGER NOT NULL,\n  CHECK (request_count >= 1 AND expires_at > window_start),\n  PRIMARY KEY (key_hash, route)\n);",
  "CREATE INDEX IF NOT EXISTS idx_tiendanube_rate_limits_expiry\n  ON tiendanube_rate_limits(expires_at);",
  "CREATE TABLE IF NOT EXISTS tiendanube_oauth_states (\n  state_hash TEXT PRIMARY KEY CHECK (\n    length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'\n  ),\n  environment TEXT NOT NULL CHECK (length(environment) BETWEEN 1 AND 300),\n  store_id TEXT CHECK (\n    store_id IS NULL OR (\n      length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'\n    )\n  ),\n  created_at INTEGER NOT NULL,\n  expires_at INTEGER NOT NULL,\n  consumed_at INTEGER,\n  CHECK (expires_at > created_at AND expires_at - created_at <= 600),\n  CHECK (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at))\n);",
  "CREATE INDEX IF NOT EXISTS idx_tiendanube_oauth_states_expiry\n  ON tiendanube_oauth_states(environment, expires_at, consumed_at);",
  "CREATE INDEX IF NOT EXISTS idx_tiendanube_oauth_states_store\n  ON tiendanube_oauth_states(store_id, consumed_at);",
  "CREATE TABLE IF NOT EXISTS tiendanube_installations (\n  store_id TEXT PRIMARY KEY CHECK (\n    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'\n  ),\n  store_domain TEXT NOT NULL CHECK (length(store_domain) BETWEEN 1 AND 253),\n  encrypted_access_token TEXT NOT NULL CHECK (length(encrypted_access_token) >= 24),\n  encryption_iv TEXT NOT NULL CHECK (length(encryption_iv) = 16),\n  scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),\n  installed_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL,\n  revoked_at INTEGER,\n  CHECK (installed_at > 0 AND updated_at >= installed_at)\n);",
  "CREATE INDEX IF NOT EXISTS idx_tiendanube_installations_active\n  ON tiendanube_installations(revoked_at, store_id);"
]);

const readyBindings = new WeakSet();

export async function ensureTiendanubeSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
  }
  if (readyBindings.has(db)) return;
  try {
    for (const statement of SCHEMA_STATEMENTS) {
      await db.prepare(statement).run();
    }
    readyBindings.add(db);
  } catch (_) {
    throw new HttpError(
      500,
      'tiendanube_schema_bootstrap_failed',
      'No se pudo preparar el almacenamiento Tiendanube.'
    );
  }
}
