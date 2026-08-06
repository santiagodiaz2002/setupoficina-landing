import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import {
  buildCatalogUpsertSql,
  fetchProductsForSku,
  parseArguments,
  resolveSkuMatch,
  validateCatalogDefinition
} from '../tools/tiendanube-sync-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('fuente versionada contiene solo internal_id, SKU esperado y nombre', async () => {
  const raw = JSON.parse(await readFile(path.join(root, 'config/tiendanube-catalog.json'), 'utf8'));
  const catalog = validateCatalogDefinition(raw);
  assert.equal(catalog.length, 11);
  catalog.forEach((entry) => {
    assert.deepEqual(Object.keys(entry).sort(), ['internal_id', 'name', 'sku']);
  });
  assert.doesNotMatch(JSON.stringify(raw), /product_id|variant_id|price|stock/i);
});

test('migracion crea el catalogo vacio sin IDs historicos', async () => {
  const migration = await readFile(path.join(root, 'db/migrations/0001_tiendanube_cart_bridge.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS tiendanube_catalog/);
  assert.match(migration, /expected_sku TEXT NOT NULL/);
  assert.match(migration, /display_name TEXT NOT NULL/);
  assert.doesNotMatch(migration, /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+tiendanube_catalog/i);
  assert.doesNotMatch(migration, /554959249|1504839464|1337977476/);
});

test('migracion completa ejecuta en SQLite, conserva leads y deja catalogo vacio', async () => {
  const migration = await readFile(path.join(root, 'db/migrations/0001_tiendanube_cart_bridge.sql'), 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE leads (id TEXT PRIMARY KEY); INSERT INTO leads (id) VALUES (\'lead-existing\');');
  db.exec(migration);
  db.exec(migration);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'tiendanube_%' ORDER BY name").all();
  assert.deepEqual(tables.map((row) => row.name), [
    'tiendanube_cart_transfers',
    'tiendanube_catalog',
    'tiendanube_installations',
    'tiendanube_oauth_states',
    'tiendanube_rate_limits'
  ]);
  assert.equal(db.prepare('SELECT count(*) AS count FROM tiendanube_catalog').get().count, 0);
  assert.equal(db.prepare('SELECT id FROM leads').get().id, 'lead-existing');

  const insertTransfer = db.prepare(`
    INSERT INTO tiendanube_cart_transfers (
      ticket_hash, store_id, client_request_id, selection_json,
      resolved_items_json, unavailable_items_json, status, created_at, expires_at
    ) VALUES (?, '12345', ?, '[]', '[]', '[]', ?, 1000, ?)
  `);
  assert.throws(
    () => insertTransfer.run('a'.repeat(64), '123e4567-e89b-42d3-a456-426614174000', 'consumed', 1600),
    /CHECK constraint failed/
  );
  assert.throws(
    () => insertTransfer.run('b'.repeat(64), '123e4567-e89b-42d3-a456-426614174001', 'pending', 1601),
    /CHECK constraint failed/
  );
  db.prepare(`
    INSERT INTO tiendanube_oauth_states
      (state_hash, environment, created_at, expires_at, consumed_at)
    VALUES (?, 'production', 1000, 1600, NULL)
  `).run('c'.repeat(64));
  assert.throws(() => db.prepare(`
    INSERT INTO tiendanube_oauth_states
      (state_hash, environment, created_at, expires_at, consumed_at)
    VALUES (?, 'production', 1000, 1601, NULL)
  `).run('d'.repeat(64)), /CHECK constraint failed/);
  db.close();
});

test('sincronizacion resuelve una unica variante por SKU exacto', () => {
  const entry = { internal_id: 'hub_usb', sku: 'PHUB-7-1', name: 'Hub' };
  const match = resolveSkuMatch(entry, [
    { id: 10, variants: [{ id: 101, sku: 'OTRO' }, { id: 102, sku: 'PHUB-7-1' }] }
  ]);
  assert.deepEqual(match, { ...entry, productId: 10, variantId: 102 });
});

test('sincronizacion falla si falta el SKU o si la coincidencia es ambigua', () => {
  const entry = { internal_id: 'hub_usb', sku: 'PHUB-7-1', name: 'Hub' };
  assert.throws(() => resolveSkuMatch(entry, [{ id: 10, variants: [{ id: 101, sku: 'OTRO' }] }]), /No se encontro/);
  assert.throws(() => resolveSkuMatch(entry, [
    { id: 10, variants: [{ id: 101, sku: 'PHUB-7-1' }] },
    { id: 20, variants: [{ id: 201, sku: 'PHUB-7-1' }] }
  ]), /ambiguas/);
});

test('consulta paginada usa API de productos y no requiere una API real', async () => {
  const paths = [];
  const client = {
    async request(requestPath) {
      paths.push(requestPath);
      return [];
    }
  };
  assert.deepEqual(await fetchProductsForSku(client, 'PHUB-7-1'), []);
  assert.deepEqual(paths, ['/products?q=PHUB-7-1&page=1&per_page=200']);
});

test('SQL controlado hace UPSERT de IDs resueltos sin token ni precio', () => {
  const sql = buildCatalogUpsertSql([
    { internal_id: 'hub_usb', sku: 'PHUB-7-1', name: "Hub d'oficina", productId: 10, variantId: 102 }
  ], '12345');
  assert.match(sql, /BEGIN TRANSACTION/);
  assert.match(sql, /ON CONFLICT\(store_id, internal_id\) DO UPDATE SET/);
  assert.match(sql, /VALUES \('12345', 'hub_usb', 'PHUB-7-1', 'Hub d''oficina', 10, 102, 1, unixepoch\(\)\)/);
  assert.doesNotMatch(sql, /access.?token|price|stock/i);
});

test('SQL controlado rechaza internal_id o variant_id duplicados', () => {
  assert.throws(() => buildCatalogUpsertSql([
    { internal_id: 'hub_usb', sku: 'A', name: 'A', productId: 10, variantId: 101 },
    { internal_id: 'hub_usb', sku: 'B', name: 'B', productId: 20, variantId: 202 }
  ], '12345'), /internal_id duplicado/);
  assert.throws(() => buildCatalogUpsertSql([
    { internal_id: 'hub_usb', sku: 'A', name: 'A', productId: 10, variantId: 101 },
    { internal_id: 'mouse_vertical', sku: 'B', name: 'B', productId: 20, variantId: 101 }
  ], '12345'), /variante 101/);
});

test('CLI rechaza tokens como argumentos visibles', () => {
  assert.throws(() => parseArguments(['--token', 'secreto', '--output', 'db/generated/test.sql']), /solo se acepta mediante/);
  assert.throws(() => parseArguments(['valor-sensible-en-linea-de-comandos']), (error) => {
    assert.doesNotMatch(error.message, /valor-sensible/);
    return true;
  });
  assert.deepEqual(parseArguments(['--output', 'db/generated/test.sql']), {
    output: 'db/generated/test.sql',
    force: false
  });
});
