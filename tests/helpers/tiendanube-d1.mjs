// Este helper implementa un doble en memoria del subconjunto de D1 que usan OAuth, catálogo, rate limiting y transferencias.
// No interpreta SQL de forma general: reconoce las sentencias verificadas del backend y actualiza mapas con semántica suficiente para cada prueba.
// Las implementaciones de vinculación, lectura, escritura y lote permiten probar promesas y carreras sin abrir una base ni llamar a Cloudflare.
// Define un doble controlado que imita solo la interfaz utilizada por el código productivo.
export class MemoryD1 {
// Inicializa el doble con estado explícito para que cada efecto pueda inspeccionarse.
  constructor(catalog = []) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.catalog = new Map(catalog.map((row) => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const normalized = { store_id: '12345', max_quantity: 10, enabled: 1, ...row };
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return [`${normalized.store_id}:${normalized.internal_id}`, normalized];
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }));
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.transfers = new Map();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.rates = new Map();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.oauthStates = new Map();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.installations = new Map();
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Imita la preparación de D1 y conserva la sentencia para decidir qué operación simular.
  prepare(sql) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return new MemoryStatement(this, sql);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  async batch(statements) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const results = [];
// Ejecuta la mutación en memoria y espera sus metadatos simulados.
    for (const statement of statements) results.push(await statement.run());
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return results;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un doble controlado que imita solo la interfaz utilizada por el código productivo.
class MemoryStatement {
// Inicializa el doble con estado explícito para que cada efecto pueda inspeccionarse.
  constructor(db, sql) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.db = db;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.sql = String(sql).replace(/\s+/g, ' ').trim();
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.args = [];
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Imita la vinculación posicional y conserva los valores para la ejecución posterior.
  bind(...args) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.args = args;
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return this;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  async all() {
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.includes('FROM tiendanube_catalog')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId, ...internalIds] = this.args;
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return {
// Define un campo del fixture que representa una entrada o respuesta específica.
        results: internalIds
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          .map((id) => this.db.catalog.get(`${storeId}:${id}`))
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          .filter((row) => row && Number(row.enabled) === 1)
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
    throw new Error(`SQL all no soportado: ${this.sql}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  async first() {
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('INSERT INTO tiendanube_rate_limits')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [keyHash, route, now, expiresAt, resetBefore] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const key = `${keyHash}:${route}`;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const previous = this.db.rates.get(key);
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const next = !previous || previous.window_start <= resetBefore
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        ? { key_hash: keyHash, route, window_start: now, request_count: 1, expires_at: expiresAt }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        : { ...previous, request_count: previous.request_count + 1, expires_at: expiresAt };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      this.db.rates.set(key, next);
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { request_count: next.request_count, window_start: next.window_start };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('UPDATE tiendanube_oauth_states SET consumed_at = ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [consumedAt, stateHash, environment, now] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.oauthStates.get(String(stateHash));
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (!row || row.environment !== String(environment) || row.consumed_at !== null || row.expires_at <= now) return null;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.consumed_at = consumedAt;
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { state_hash: row.state_hash };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.includes('FROM tiendanube_oauth_states')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [stateHash, environment] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.oauthStates.get(String(stateHash));
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return row && row.environment === String(environment)
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        ? { expires_at: row.expires_at, consumed_at: row.consumed_at }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.includes('FROM tiendanube_installations')) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (this.sql.includes('WHERE revoked_at IS NULL')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
        const row = Array.from(this.db.installations.values()).find((installation) => installation.revoked_at === null);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
        return row ? { store_id: row.store_id } : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.installations.get(String(storeId));
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return row ? { ...row } : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.includes('client_request_id = ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId, clientRequestId] = this.args;
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return Array.from(this.db.transfers.values()).find((row) => (
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row.store_id === String(storeId) && row.client_request_id === String(clientRequestId)
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      )) || null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith("UPDATE tiendanube_cart_transfers SET status = 'processing'")) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [processingStartedAt, leaseExpiresAt, processingTokenHash, ticketHash, storeId, now, leaseNow] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.transfers.get(String(ticketHash));
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const eligible = row && row.store_id === String(storeId) && row.expires_at > now && (
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row.status === 'pending' || (row.status === 'processing' && row.processing_lease_expires_at <= leaseNow)
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      );
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (!eligible) return null;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.status = 'processing';
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.processing_started_at = processingStartedAt;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.processing_lease_expires_at = Math.min(row.expires_at, leaseExpiresAt);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.processing_token_hash = processingTokenHash;
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return {
// Define un campo del fixture que representa una entrada o respuesta específica.
        selection_json: row.selection_json,
// Define un campo del fixture que representa una entrada o respuesta específica.
        resolved_items_json: row.resolved_items_json,
// Define un campo del fixture que representa una entrada o respuesta específica.
        unavailable_items_json: row.unavailable_items_json,
// Define un campo del fixture que representa una entrada o respuesta específica.
        expires_at: row.expires_at
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.includes('SELECT status, expires_at, processing_lease_expires_at FROM tiendanube_cart_transfers')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [ticketHash, storeId] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.transfers.get(String(ticketHash));
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return row && row.store_id === String(storeId)
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        ? { status: row.status, expires_at: row.expires_at, processing_lease_expires_at: row.processing_lease_expires_at }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.includes('SELECT status, expires_at, processing_token_hash,')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [ticketHash, storeId] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.transfers.get(String(ticketHash));
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
      return row && row.store_id === String(storeId)
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        ? {
// Define un campo del fixture que representa una entrada o respuesta específica.
            status: row.status,
// Define un campo del fixture que representa una entrada o respuesta específica.
            expires_at: row.expires_at,
// Define un campo del fixture que representa una entrada o respuesta específica.
            processing_token_hash: row.processing_token_hash,
// Define un campo del fixture que representa una entrada o respuesta específica.
            resolved_items_json: row.resolved_items_json,
// Define un campo del fixture que representa una entrada o respuesta específica.
            unavailable_items_json: row.unavailable_items_json
// Cierra el bloque o la estructura y delimita el alcance del fixture.
          }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        : null;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
    throw new Error(`SQL first no soportado: ${this.sql}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  async run() {
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('DELETE FROM tiendanube_oauth_states WHERE expires_at <= ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [now] = this.args;
// Reserva estado mutable para registrar llamadas o simular una transición.
      let changes = 0;
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
      for (const [key, row] of this.db.oauthStates) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
        if (row.expires_at <= now) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          this.db.oauthStates.delete(key);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          changes += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('INSERT INTO tiendanube_oauth_states')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [stateHash, environment, createdAt, expiresAt] = this.args;
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (this.db.oauthStates.has(String(stateHash))) throw new Error('UNIQUE constraint failed: state_hash');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      this.db.oauthStates.set(String(stateHash), {
// Define un campo del fixture que representa una entrada o respuesta específica.
        state_hash: String(stateHash),
// Define un campo del fixture que representa una entrada o respuesta específica.
        environment: String(environment),
// Define un campo del fixture que representa una entrada o respuesta específica.
        store_id: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
        created_at: createdAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        expires_at: expiresAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        consumed_at: null
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      });
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes: 1 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('INSERT INTO tiendanube_installations')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId, storeDomain, encryptedAccessToken, encryptionIv, scopesJson, installedAt, updatedAt] = this.args;
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (this.db.installations.has(String(storeId))) throw new Error('UNIQUE constraint failed: tiendanube_installations.store_id');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      this.db.installations.set(String(storeId), {
// Define un campo del fixture que representa una entrada o respuesta específica.
        store_id: String(storeId),
// Define un campo del fixture que representa una entrada o respuesta específica.
        store_domain: String(storeDomain),
// Define un campo del fixture que representa una entrada o respuesta específica.
        encrypted_access_token: String(encryptedAccessToken),
// Define un campo del fixture que representa una entrada o respuesta específica.
        encryption_iv: String(encryptionIv),
// Define un campo del fixture que representa una entrada o respuesta específica.
        scopes_json: String(scopesJson),
// Define un campo del fixture que representa una entrada o respuesta específica.
        installed_at: installedAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        updated_at: updatedAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        revoked_at: null
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      });
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes: 1 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('UPDATE tiendanube_installations SET store_domain = ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeDomain, encryptedAccessToken, encryptionIv, scopesJson, installedAt, updatedAt, storeId] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const previous = this.db.installations.get(String(storeId));
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (!previous || previous.revoked_at === null) return { meta: { changes: 0 } };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      this.db.installations.set(String(storeId), {
// Define un campo del fixture que representa una entrada o respuesta específica.
        store_id: String(storeId),
// Define un campo del fixture que representa una entrada o respuesta específica.
        store_domain: String(storeDomain),
// Define un campo del fixture que representa una entrada o respuesta específica.
        encrypted_access_token: String(encryptedAccessToken),
// Define un campo del fixture que representa una entrada o respuesta específica.
        encryption_iv: String(encryptionIv),
// Define un campo del fixture que representa una entrada o respuesta específica.
        scopes_json: String(scopesJson),
// Define un campo del fixture que representa una entrada o respuesta específica.
        installed_at: installedAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        updated_at: updatedAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        revoked_at: null
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      });
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes: 1 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('UPDATE tiendanube_oauth_states SET store_id = ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId, stateHash, environment] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.oauthStates.get(String(stateHash));
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (!row || row.environment !== String(environment) || row.consumed_at === null) return { meta: { changes: 0 } };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.store_id = String(storeId);
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes: 1 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('INSERT INTO tiendanube_cart_transfers')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [ticketHash, storeId, clientRequestId, selectionJson, resolvedJson, unavailableJson, createdAt, expiresAt] = this.args;
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (this.db.transfers.has(String(ticketHash))) throw new Error('UNIQUE constraint failed: ticket_hash');
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (Array.from(this.db.transfers.values()).some((row) => row.store_id === String(storeId) && row.client_request_id === String(clientRequestId))) {
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
        throw new Error('UNIQUE constraint failed: client_request_id');
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      this.db.transfers.set(String(ticketHash), {
// Define un campo del fixture que representa una entrada o respuesta específica.
        ticket_hash: String(ticketHash),
// Define un campo del fixture que representa una entrada o respuesta específica.
        store_id: String(storeId),
// Define un campo del fixture que representa una entrada o respuesta específica.
        client_request_id: String(clientRequestId),
// Define un campo del fixture que representa una entrada o respuesta específica.
        selection_json: selectionJson,
// Define un campo del fixture que representa una entrada o respuesta específica.
        resolved_items_json: resolvedJson,
// Define un campo del fixture que representa una entrada o respuesta específica.
        unavailable_items_json: unavailableJson,
// Define un campo del fixture que representa una entrada o respuesta específica.
        status: 'pending',
// Define un campo del fixture que representa una entrada o respuesta específica.
        created_at: createdAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        expires_at: expiresAt,
// Define un campo del fixture que representa una entrada o respuesta específica.
        processing_started_at: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
        processing_lease_expires_at: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
        processing_token_hash: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
        completed_at: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
        completion_json: null
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      });
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes: 1 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith("UPDATE tiendanube_cart_transfers SET status = 'expired'")) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [ticketHash, storeId, now] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.transfers.get(String(ticketHash));
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row && row.store_id === String(storeId) &&
// Continúa una llamada o estructura de prueba con sus argumentos explícitos.
        ['pending', 'processing'].includes(row.status) && row.expires_at <= now
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      ) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row.status = 'expired';
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row.processing_started_at = null;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row.processing_lease_expires_at = null;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row.processing_token_hash = null;
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
        return { meta: { changes: 1 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes: 0 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith("UPDATE tiendanube_cart_transfers SET status = 'completed'")) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [completedAt, completionJson, ticketHash, storeId, processingTokenHash, now] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const row = this.db.transfers.get(String(ticketHash));
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        !row || row.store_id !== String(storeId) || row.status !== 'processing' ||
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
        row.processing_token_hash !== String(processingTokenHash) || row.expires_at <= now
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      ) return { meta: { changes: 0 } };
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.status = 'completed';
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.completed_at = completedAt;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      row.completion_json = completionJson;
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes: 1 } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('DELETE FROM tiendanube_cart_transfers')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId] = this.args;
// Reserva estado mutable para registrar llamadas o simular una transición.
      let changes = 0;
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
      for (const [key, row] of this.db.transfers) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
        if (row.store_id === String(storeId)) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          this.db.transfers.delete(key);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          changes += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('DELETE FROM tiendanube_installations')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId] = this.args;
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const changes = this.db.installations.delete(String(storeId)) ? 1 : 0;
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('DELETE FROM tiendanube_oauth_states WHERE store_id = ? OR expires_at <= ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId, now] = this.args;
// Reserva estado mutable para registrar llamadas o simular una transición.
      let changes = 0;
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
      for (const [key, row] of this.db.oauthStates) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
        if (row.store_id === String(storeId) || row.expires_at <= now) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          this.db.oauthStates.delete(key);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          changes += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('DELETE FROM tiendanube_catalog WHERE store_id = ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const [storeId] = this.args;
// Reserva estado mutable para registrar llamadas o simular una transición.
      let changes = 0;
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
      for (const [key, row] of this.db.catalog) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
        if (row.store_id === String(storeId)) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          this.db.catalog.delete(key);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
          changes += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (this.sql.startsWith('DELETE FROM tiendanube_rate_limits')) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
      if (this.sql.includes('WHERE expires_at <= ?')) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
        const [now] = this.args;
// Reserva estado mutable para registrar llamadas o simular una transición.
        let changes = 0;
// Recorre fixtures o llamadas registradas para verificar cada elemento relevante.
        for (const [key, row] of this.db.rates.entries()) {
// Selecciona la respuesta del doble o valida una precondición del escenario.
          if (Number(row.expires_at) <= Number(now)) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
            this.db.rates.delete(key);
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
            changes += 1;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
          }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
        }
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
        return { meta: { changes } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
      }
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const changes = this.db.rates.size;
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      this.db.rates.clear();
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
      return { meta: { changes } };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }

// Las pruebas de OAuth permiten que el backend ejecute el bootstrap idempotente del esquema.
    if (this.sql.startsWith('CREATE TABLE IF NOT EXISTS') || this.sql.startsWith('CREATE INDEX IF NOT EXISTS')) {
      return { meta: { changes: 0 } };
    }

// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
    throw new Error(`SQL run no soportado: ${this.sql}`);
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
export const PRODUCT_IDS = Object.freeze({
// Define un campo del fixture que representa una entrada o respuesta específica.
  soporte_notebook: [1001, 2001],
// Define un campo del fixture que representa una entrada o respuesta específica.
  mouse_vertical: [1002, 2002],
// Define un campo del fixture que representa una entrada o respuesta específica.
  mousepad_xxl: [1003, 2003],
// Define un campo del fixture que representa una entrada o respuesta específica.
  soporte_monitor: [1004, 2004],
// Define un campo del fixture que representa una entrada o respuesta específica.
  teclado_mec: [1005, 2005],
// Define un campo del fixture que representa una entrada o respuesta específica.
  hub_usb: [1006, 2006],
// Define un campo del fixture que representa una entrada o respuesta específica.
  organizador_prem: [1007, 2007],
// Define un campo del fixture que representa una entrada o respuesta específica.
  luz_led: [1008, 2008],
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  'reposamuñecas': [1009, 2009],
// Define un campo del fixture que representa una entrada o respuesta específica.
  almohadilla: [1010, 2010],
// Define un campo del fixture que representa una entrada o respuesta específica.
  standing_desk: [1011, 2011]
// Cierra el bloque o la estructura y delimita el alcance del fixture.
});

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
export function catalogRows(ids = Object.keys(PRODUCT_IDS)) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return ids.map((internalId) => ({
// Define un campo del fixture que representa una entrada o respuesta específica.
    store_id: '12345',
// Define un campo del fixture que representa una entrada o respuesta específica.
    internal_id: internalId,
// Define un campo del fixture que representa una entrada o respuesta específica.
    product_id: PRODUCT_IDS[internalId][0],
// Define un campo del fixture que representa una entrada o respuesta específica.
    variant_id: PRODUCT_IDS[internalId][1],
// Define un campo del fixture que representa una entrada o respuesta específica.
    enabled: 1,
// Define un campo del fixture que representa una entrada o respuesta específica.
    max_quantity: 10
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
export function productFor(internalId, overrides = {}) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const [productId, variantId] = PRODUCT_IDS[internalId];
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
  const variantOverrides = overrides.variant || {};
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return {
// Define un campo del fixture que representa una entrada o respuesta específica.
    id: productId,
// Define un campo del fixture que representa una entrada o respuesta específica.
    name: { es: `Producto ${internalId}` },
// Define un campo del fixture que representa una entrada o respuesta específica.
    published: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
    variants: [{
// Define un campo del fixture que representa una entrada o respuesta específica.
      id: variantId,
// Define un campo del fixture que representa una entrada o respuesta específica.
      product_id: productId,
// Define un campo del fixture que representa una entrada o respuesta específica.
      price: '100.00',
// Define un campo del fixture que representa una entrada o respuesta específica.
      promotional_price: null,
// Define un campo del fixture que representa una entrada o respuesta específica.
      stock_management: true,
// Define un campo del fixture que representa una entrada o respuesta específica.
      stock: 20,
// Define un campo del fixture que representa una entrada o respuesta específica.
      inventory_levels: [{ location_id: 'loc-1', stock: 20 }],
// Define un campo del fixture que representa una entrada o respuesta específica.
      values: [],
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
      ...variantOverrides
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }],
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'variant'))
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un doble controlado que imita solo la interfaz utilizada por el código productivo.
export class FakeTiendanubeClient {
// Inicializa el doble con estado explícito para que cada efecto pueda inspeccionarse.
  constructor(products = {}) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.products = new Map(Object.entries(products).map(([id, product]) => [Number(id), product]));
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.calls = [];
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }

// Completa la preparación, simulación o comprobación correspondiente a esta línea.
  async getProduct(productId) {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
    this.calls.push(Number(productId));
// Selecciona la respuesta del doble o valida una precondición del escenario.
    if (!this.products.has(Number(productId))) {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
      const error = new Error('not found');
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      error.name = 'TiendanubeApiError';
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      error.status = 404;
// Hace fallar el doble de manera deliberada para ejercer la ruta defensiva.
      throw error;
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    }
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return this.products.get(Number(productId));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Define un helper de prueba que concentra preparación o inspección repetida entre casos.
export function productsFor(ids) {
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
  return Object.fromEntries(ids.map((internalId) => {
// Prepara un fixture o resultado inmutable que el resto del caso inspeccionará.
    const product = productFor(internalId);
// Devuelve el dato simulado o el resultado auxiliar al caso llamador.
    return [String(product.id), product];
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  }));
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Construye un doble de persistencia cuyos cambios quedan disponibles para las aserciones.
export function envFor(db, overrides = {}) {
// Devuelve un fixture con la interfaz mínima que consume la unidad bajo prueba.
  return {
// Define un campo del fixture que representa una entrada o respuesta específica.
    LEADS_DB: db,
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ENABLED: 'true',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ENV: 'production',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_API_VERSION: '2025-03',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_STORE_ID: '12345',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ACCESS_TOKEN: 'test-access-token',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_CLIENT_SECRET: 'test-client-secret',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_APP_ID: '38321',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_OAUTH_REDIRECT_URL: 'https://setupoficina.com.ar/api/tiendanube/oauth/callback',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_EXPECTED_STORE_DOMAINS: 'primoffice2.mitiendanube.com',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_TOKEN_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_USER_AGENT: 'setupoficina (tests@example.com)',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_STOREFRONT_URL: 'https://primoffice2.mitiendanube.com/',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ALLOWED_SETUP_ORIGINS: 'https://setupoficina.com.ar',
// Define un campo del fixture que representa una entrada o respuesta específica.
    TIENDANUBE_ALLOWED_STOREFRONT_ORIGINS: 'https://primoffice2.mitiendanube.com,https://primoffice.com.ar,https://www.primoffice.com.ar',
// Copia el fixture base y sobrescribe únicamente lo necesario para esta variante.
    ...overrides
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  };
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}

// Construye una petición local con encabezados y cuerpo controlados para el handler.
export function jsonRequest(url, body, origin = 'https://setupoficina.com.ar') {
// Construye una petición simulada; no sale del proceso de pruebas.
  return new Request(url, {
// Define un campo del fixture que representa una entrada o respuesta específica.
    method: 'POST',
// Define un campo del fixture que representa una entrada o respuesta específica.
    headers: {
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'Content-Type': 'application/json',
// Define un campo del fixture que representa una entrada o respuesta específica.
      Origin: origin,
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'CF-Connecting-IP': '203.0.113.20',
// Completa la preparación, simulación o comprobación correspondiente a esta línea.
      'User-Agent': 'test-agent'
// Cierra el bloque o la estructura y delimita el alcance del fixture.
    },
// Define un campo del fixture que representa una entrada o respuesta específica.
    body: JSON.stringify(body)
// Cierra el bloque o la estructura y delimita el alcance del fixture.
  });
// Cierra el bloque o la estructura y delimita el alcance del fixture.
}
