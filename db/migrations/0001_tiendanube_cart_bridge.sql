-- Esta migración es aditiva e idempotente: crea el almacenamiento del puente de carrito sin sembrar catálogo ni tocar la tabla de leads.
-- Las restricciones de forma, estado y tiempo complementan las validaciones de los handlers y protegen también escrituras directas.
-- El orden cubre catálogo autorizado, transferencias, rate limiting, estados OAuth e instalaciones cifradas, seguido por sus índices.
-- Tiendanube cart bridge. Esta migracion crea tablas nuevas y no altera `leads`.
-- Crea esta estructura solo cuando falta, por lo que repetir la migración no destruye datos existentes.
CREATE TABLE IF NOT EXISTS tiendanube_catalog (
-- La columna identifica la tienda y restringe su forma a una secuencia decimal acotada.
  store_id TEXT NOT NULL CHECK (
-- Completa la restricción de forma o nulabilidad iniciada en la línea anterior.
    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La columna guarda el identificador lógico enviado por el frontend dentro de una longitud acotada.
  internal_id TEXT NOT NULL CHECK (length(internal_id) BETWEEN 1 AND 64),
-- La columna conserva el SKU esperado para que la carga administrativa pueda detectar desvíos.
  expected_sku TEXT NOT NULL CHECK (length(expected_sku) BETWEEN 1 AND 100),
-- La columna ofrece una etiqueta administrativa obligatoria y de longitud acotada.
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
-- La columna enlaza con un producto remoto y exige un entero positivo.
  product_id INTEGER NOT NULL CHECK (product_id > 0),
-- La columna enlaza con una variante remota y exige un entero positivo.
  variant_id INTEGER NOT NULL CHECK (variant_id > 0),
-- La columna actúa como bandera binaria para excluir filas sin borrarlas.
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
-- La columna limita la cantidad que una selección puede solicitar para este artículo.
  max_quantity INTEGER NOT NULL DEFAULT 10 CHECK (max_quantity BETWEEN 1 AND 100),
-- La columna conserva el instante de creación en segundos para comparar estados temporalmente.
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
-- La columna conserva el instante de la última actualización administrativa.
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
-- La clave compuesta permite un artículo interno por tienda y sustenta la resolución exacta.
  PRIMARY KEY (store_id, internal_id),
-- La unicidad evita asociar dos filas de una tienda con la misma combinación remota.
  UNIQUE (store_id, product_id, variant_id)
-- Cierra la condición agrupada o la definición de tabla correspondiente.
);

-- Declara un índice idempotente para el patrón de consulta que completa la línea siguiente.
CREATE INDEX IF NOT EXISTS idx_tiendanube_catalog_enabled
-- Define las columnas y el orden que utiliza el índice anunciado justo antes.
  ON tiendanube_catalog(store_id, enabled, internal_id);

-- Crea esta estructura solo cuando falta, por lo que repetir la migración no destruye datos existentes.
CREATE TABLE IF NOT EXISTS tiendanube_cart_transfers (
-- La clave guarda solo el resumen hexadecimal del ticket y exige longitud y alfabeto exactos.
  ticket_hash TEXT PRIMARY KEY CHECK (
-- Completa la restricción de forma o nulabilidad iniciada en la línea anterior.
    length(ticket_hash) = 64 AND ticket_hash NOT GLOB '*[^0-9a-f]*'
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La columna identifica la tienda y restringe su forma a una secuencia decimal acotada.
  store_id TEXT NOT NULL CHECK (
-- Completa la restricción de forma o nulabilidad iniciada en la línea anterior.
    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La columna conserva la clave idempotente del cliente con longitud de UUID.
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) = 36),
-- La columna exige JSON válido con la selección interna original.
  selection_json TEXT NOT NULL CHECK (json_valid(selection_json)),
-- La columna exige JSON válido con los artículos resueltos por el servidor.
  resolved_items_json TEXT NOT NULL CHECK (json_valid(resolved_items_json)),
-- La columna exige JSON válido con los rechazos explicados por el servidor.
  unavailable_items_json TEXT NOT NULL CHECK (json_valid(unavailable_items_json)),
-- La columna limita el ciclo de vida a los cuatro estados admitidos.
  status TEXT NOT NULL DEFAULT 'pending'
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
    CHECK (status IN ('pending', 'processing', 'completed', 'expired')),
-- La columna conserva el instante de creación en segundos para comparar estados temporalmente.
  created_at INTEGER NOT NULL,
-- La columna fija el vencimiento que los handlers revisan antes de cada transición.
  expires_at INTEGER NOT NULL,
-- La columna registra cuándo una aplicación reclamó el ticket.
  processing_started_at INTEGER,
-- La columna limita cuánto tiempo puede durar una reclamación antes de recuperarse.
  processing_lease_expires_at INTEGER,
-- La columna conserva solo el resumen de la credencial temporal de finalización.
  processing_token_hash TEXT,
-- La columna registra cuándo se confirmó el resultado final.
  completed_at INTEGER,
-- La columna acepta nulo durante el proceso y exige JSON válido al completar.
  completion_json TEXT CHECK (completion_json IS NULL OR json_valid(completion_json)),
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
  CHECK (expires_at > created_at AND expires_at - created_at <= 600),
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
  CHECK (
-- La columna limita el ciclo de vida a los cuatro estados admitidos.
    (status IN ('pending', 'expired') AND processing_started_at IS NULL
-- Añade otra condición obligatoria a la invariantes iniciada antes.
      AND processing_lease_expires_at IS NULL AND processing_token_hash IS NULL)
-- Introduce la alternativa válida de la misma invariantes, sin permitir combinaciones intermedias.
    OR
-- La columna limita el ciclo de vida a los cuatro estados admitidos.
    (status IN ('processing', 'completed') AND processing_started_at IS NOT NULL
-- Añade otra condición obligatoria a la invariantes iniciada antes.
      AND processing_lease_expires_at IS NOT NULL
-- Añade otra condición obligatoria a la invariantes iniciada antes.
      AND processing_lease_expires_at > processing_started_at
-- Añade otra condición obligatoria a la invariantes iniciada antes.
      AND processing_lease_expires_at <= expires_at
-- Añade otra condición obligatoria a la invariantes iniciada antes.
      AND length(processing_token_hash) = 64
-- Añade otra condición obligatoria a la invariantes iniciada antes.
      AND processing_token_hash NOT GLOB '*[^0-9a-f]*')
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
  CHECK (
-- La columna limita el ciclo de vida a los cuatro estados admitidos.
    (status = 'completed' AND completed_at IS NOT NULL AND completion_json IS NOT NULL)
-- Introduce la alternativa válida de la misma invariantes, sin permitir combinaciones intermedias.
    OR
-- La columna limita el ciclo de vida a los cuatro estados admitidos.
    (status <> 'completed' AND completed_at IS NULL AND completion_json IS NULL)
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La unicidad hace idempotente la solicitud del cliente dentro de una tienda.
  UNIQUE (store_id, client_request_id)
-- Cierra la condición agrupada o la definición de tabla correspondiente.
);

-- Declara un índice idempotente para el patrón de consulta que completa la línea siguiente.
CREATE INDEX IF NOT EXISTS idx_tiendanube_transfers_expiry
-- Define las columnas y el orden que utiliza el índice anunciado justo antes.
  ON tiendanube_cart_transfers(store_id, status, expires_at);

-- Declara un índice idempotente para el patrón de consulta que completa la línea siguiente.
CREATE INDEX IF NOT EXISTS idx_tiendanube_transfers_processing_lease
-- Define las columnas y el orden que utiliza el índice anunciado justo antes.
  ON tiendanube_cart_transfers(store_id, status, processing_lease_expires_at);

-- Crea esta estructura solo cuando falta, por lo que repetir la migración no destruye datos existentes.
CREATE TABLE IF NOT EXISTS tiendanube_rate_limits (
-- La columna conserva el resumen de la clave de rate limiting y valida su forma hexadecimal.
  key_hash TEXT NOT NULL CHECK (
-- Completa la restricción de forma o nulabilidad iniciada en la línea anterior.
    length(key_hash) = 64 AND key_hash NOT GLOB '*[^0-9a-f]*'
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La columna separa contadores por operación y limita el tamaño de su etiqueta.
  route TEXT NOT NULL CHECK (length(route) BETWEEN 1 AND 160),
-- La columna marca el inicio no negativo de la ventana temporal.
  window_start INTEGER NOT NULL CHECK (window_start >= 0),
-- La columna inicia el contador en uno y nunca admite valores inferiores.
  request_count INTEGER NOT NULL DEFAULT 1,
-- La columna fija el vencimiento que los handlers revisan antes de cada transición.
  expires_at INTEGER NOT NULL,
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
  CHECK (request_count >= 1 AND expires_at > window_start),
-- La clave compuesta mantiene un único contador por clave y operación.
  PRIMARY KEY (key_hash, route)
-- Cierra la condición agrupada o la definición de tabla correspondiente.
);

-- Declara un índice idempotente para el patrón de consulta que completa la línea siguiente.
CREATE INDEX IF NOT EXISTS idx_tiendanube_rate_limits_expiry
-- Define las columnas y el orden que utiliza el índice anunciado justo antes.
  ON tiendanube_rate_limits(expires_at);

-- Crea esta estructura solo cuando falta, por lo que repetir la migración no destruye datos existentes.
CREATE TABLE IF NOT EXISTS tiendanube_oauth_states (
-- La clave conserva solo el resumen del estado OAuth y valida longitud y alfabeto.
  state_hash TEXT PRIMARY KEY CHECK (
-- Completa la restricción de forma o nulabilidad iniciada en la línea anterior.
    length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La columna vincula el estado OAuth con el entorno exacto donde se originó.
  environment TEXT NOT NULL CHECK (length(environment) BETWEEN 1 AND 300),
-- La columna identifica la tienda y restringe su forma a una secuencia decimal acotada.
  store_id TEXT CHECK (
-- La columna identifica la tienda y restringe su forma a una secuencia decimal acotada.
    store_id IS NULL OR (
-- Completa la restricción de forma o nulabilidad iniciada en la línea anterior.
      length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
-- Cierra la condición agrupada o la definición de tabla correspondiente.
    )
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La columna conserva el instante de creación en segundos para comparar estados temporalmente.
  created_at INTEGER NOT NULL,
-- La columna fija el vencimiento que los handlers revisan antes de cada transición.
  expires_at INTEGER NOT NULL,
-- La columna queda vacía hasta el consumo único del estado OAuth.
  consumed_at INTEGER,
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
  CHECK (expires_at > created_at AND expires_at - created_at <= 600),
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
  CHECK (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at))
-- Cierra la condición agrupada o la definición de tabla correspondiente.
);

-- Declara un índice idempotente para el patrón de consulta que completa la línea siguiente.
CREATE INDEX IF NOT EXISTS idx_tiendanube_oauth_states_expiry
-- Define las columnas y el orden que utiliza el índice anunciado justo antes.
  ON tiendanube_oauth_states(environment, expires_at, consumed_at);

-- Declara un índice idempotente para el patrón de consulta que completa la línea siguiente.
CREATE INDEX IF NOT EXISTS idx_tiendanube_oauth_states_store
-- Define las columnas y el orden que utiliza el índice anunciado justo antes.
  ON tiendanube_oauth_states(store_id, consumed_at);

-- Crea esta estructura solo cuando falta, por lo que repetir la migración no destruye datos existentes.
CREATE TABLE IF NOT EXISTS tiendanube_installations (
-- La columna identifica la tienda y restringe su forma a una secuencia decimal acotada.
  store_id TEXT PRIMARY KEY CHECK (
-- Completa la restricción de forma o nulabilidad iniciada en la línea anterior.
    length(store_id) BETWEEN 1 AND 20 AND store_id NOT GLOB '*[^0-9]*'
-- Cierra la condición agrupada o la definición de tabla correspondiente.
  ),
-- La columna conserva el dominio validado de la tienda instalada.
  store_domain TEXT NOT NULL CHECK (length(store_domain) BETWEEN 1 AND 253),
-- La columna exige una carga cifrada no trivial y nunca almacena el acceso en claro.
  encrypted_access_token TEXT NOT NULL CHECK (length(encrypted_access_token) >= 24),
-- La columna conserva el vector codificado con la longitud esperada por el descifrado.
  encryption_iv TEXT NOT NULL CHECK (length(encryption_iv) = 16),
-- La columna exige JSON válido con los permisos concedidos.
  scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),
-- La columna registra el momento positivo de la primera instalación.
  installed_at INTEGER NOT NULL,
-- La columna conserva el instante de la última actualización administrativa.
  updated_at INTEGER NOT NULL,
-- La columna queda vacía mientras la instalación continúa activa.
  revoked_at INTEGER,
-- Inicia una invariantes de base que protege el estado incluso fuera de los handlers.
  CHECK (installed_at > 0 AND updated_at >= installed_at)
-- Cierra la condición agrupada o la definición de tabla correspondiente.
);

-- Declara un índice idempotente para el patrón de consulta que completa la línea siguiente.
CREATE INDEX IF NOT EXISTS idx_tiendanube_installations_active
-- Define las columnas y el orden que utiliza el índice anunciado justo antes.
  ON tiendanube_installations(revoked_at, store_id);
