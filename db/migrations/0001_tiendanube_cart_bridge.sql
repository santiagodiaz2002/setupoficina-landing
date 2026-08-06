-- Tiendanube cart bridge. Esta migracion crea tablas nuevas y no altera `leads`.
CREATE TABLE IF NOT EXISTS tiendanube_catalog (
  store_id TEXT NOT NULL CHECK (
    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
  ),
  internal_id TEXT NOT NULL CHECK (length(internal_id) BETWEEN 1 AND 64),
  expected_sku TEXT NOT NULL CHECK (length(expected_sku) BETWEEN 1 AND 100),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  product_id INTEGER NOT NULL CHECK (product_id > 0),
  variant_id INTEGER NOT NULL CHECK (variant_id > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  max_quantity INTEGER NOT NULL DEFAULT 10 CHECK (max_quantity BETWEEN 1 AND 100),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (store_id, internal_id),
  UNIQUE (store_id, product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_tiendanube_catalog_enabled
  ON tiendanube_catalog(store_id, enabled, internal_id);

CREATE TABLE IF NOT EXISTS tiendanube_cart_transfers (
  ticket_hash TEXT PRIMARY KEY CHECK (
    length(ticket_hash) = 64 AND ticket_hash NOT GLOB '*[^0-9a-f]*'
  ),
  store_id TEXT NOT NULL CHECK (
    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
  ),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) = 36),
  selection_json TEXT NOT NULL CHECK (json_valid(selection_json)),
  resolved_items_json TEXT NOT NULL CHECK (json_valid(resolved_items_json)),
  unavailable_items_json TEXT NOT NULL CHECK (json_valid(unavailable_items_json)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'expired')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  processing_started_at INTEGER,
  processing_lease_expires_at INTEGER,
  processing_token_hash TEXT,
  completed_at INTEGER,
  completion_json TEXT CHECK (completion_json IS NULL OR json_valid(completion_json)),
  CHECK (expires_at > created_at AND expires_at - created_at <= 600),
  CHECK (
    (status IN ('pending', 'expired') AND processing_started_at IS NULL
      AND processing_lease_expires_at IS NULL AND processing_token_hash IS NULL)
    OR
    (status IN ('processing', 'completed') AND processing_started_at IS NOT NULL
      AND processing_lease_expires_at IS NOT NULL
      AND processing_lease_expires_at > processing_started_at
      AND processing_lease_expires_at <= expires_at
      AND length(processing_token_hash) = 64
      AND processing_token_hash NOT GLOB '*[^0-9a-f]*')
  ),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND completion_json IS NOT NULL)
    OR
    (status <> 'completed' AND completed_at IS NULL AND completion_json IS NULL)
  ),
  UNIQUE (store_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_tiendanube_transfers_expiry
  ON tiendanube_cart_transfers(store_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_tiendanube_transfers_processing_lease
  ON tiendanube_cart_transfers(store_id, status, processing_lease_expires_at);

CREATE TABLE IF NOT EXISTS tiendanube_rate_limits (
  key_hash TEXT NOT NULL CHECK (
    length(key_hash) = 64 AND key_hash NOT GLOB '*[^0-9a-f]*'
  ),
  route TEXT NOT NULL CHECK (length(route) BETWEEN 1 AND 160),
  window_start INTEGER NOT NULL CHECK (window_start >= 0),
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  CHECK (request_count >= 1 AND expires_at > window_start),
  PRIMARY KEY (key_hash, route)
);

CREATE INDEX IF NOT EXISTS idx_tiendanube_rate_limits_expiry
  ON tiendanube_rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS tiendanube_oauth_states (
  state_hash TEXT PRIMARY KEY CHECK (
    length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'
  ),
  environment TEXT NOT NULL CHECK (length(environment) BETWEEN 1 AND 300),
  store_id TEXT CHECK (
    store_id IS NULL OR (
      length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
    )
  ),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  CHECK (expires_at > created_at AND expires_at - created_at <= 600),
  CHECK (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at))
);

CREATE INDEX IF NOT EXISTS idx_tiendanube_oauth_states_expiry
  ON tiendanube_oauth_states(environment, expires_at, consumed_at);

CREATE INDEX IF NOT EXISTS idx_tiendanube_oauth_states_store
  ON tiendanube_oauth_states(store_id, consumed_at);

CREATE TABLE IF NOT EXISTS tiendanube_installations (
  store_id TEXT PRIMARY KEY CHECK (
    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
  ),
  store_domain TEXT NOT NULL CHECK (length(store_domain) BETWEEN 1 AND 253),
  encrypted_access_token TEXT NOT NULL CHECK (length(encrypted_access_token) >= 24),
  encryption_iv TEXT NOT NULL CHECK (length(encryption_iv) = 16),
  scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),
  installed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (installed_at > 0 AND updated_at >= installed_at)
);

CREATE INDEX IF NOT EXISTS idx_tiendanube_installations_active
  ON tiendanube_installations(revoked_at, store_id);
