import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { TiendanubeClient, apiBaseFromEnv, userAgentFromEnv } from '../functions/_lib/tiendanube/client.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultCatalogPath = path.join(repoRoot, 'config', 'tiendanube-catalog.json');
const generatedDirectory = path.join(repoRoot, 'db', 'generated');
const allowedCatalogKeys = ['internal_id', 'name', 'sku'];

function normalizedSku(value) {
  return String(value || '').trim();
}

function positiveId(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`Tiendanube devolvio un ${field} invalido.`);
  }
  return number;
}

export function validateCatalogDefinition(value) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('El catalogo versionado debe contener al menos un producto.');
  }

  const internalIds = new Set();
  const skus = new Set();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`La entrada ${index + 1} del catalogo es invalida.`);
    }
    const keys = Object.keys(raw).sort();
    if (keys.length !== allowedCatalogKeys.length || keys.some((key, keyIndex) => key !== allowedCatalogKeys[keyIndex])) {
      throw new Error(`La entrada ${index + 1} solo puede contener internal_id, sku y name.`);
    }

    const internalId = String(raw.internal_id || '').trim();
    const sku = String(raw.sku || '').trim();
    const name = String(raw.name || '').trim();
    if (!/^[a-z0-9_ñ-]{1,64}$/u.test(internalId)) throw new Error(`internal_id invalido en la entrada ${index + 1}.`);
    if (!sku || sku.length > 100 || /[\u0000-\u001f\u007f]/u.test(sku)) throw new Error(`SKU invalido para ${internalId}.`);
    if (!name || name.length > 160) throw new Error(`Nombre invalido para ${internalId}.`);

    const comparableSku = normalizedSku(sku);
    if (internalIds.has(internalId)) throw new Error(`internal_id duplicado: ${internalId}.`);
    if (skus.has(comparableSku)) throw new Error(`SKU duplicado en el catalogo: ${sku}.`);
    internalIds.add(internalId);
    skus.add(comparableSku);
    return { internal_id: internalId, sku, name };
  });
}

export function resolveSkuMatch(entry, products) {
  if (!Array.isArray(products)) throw new Error(`Respuesta invalida al buscar el SKU ${entry.sku}.`);
  const expected = normalizedSku(entry.sku);
  const matches = new Map();

  products.forEach((product) => {
    const variants = product && Array.isArray(product.variants) ? product.variants : [];
    variants.forEach((variant) => {
      if (normalizedSku(variant && variant.sku) !== expected) return;
      const productId = positiveId(product && product.id, 'product_id');
      const variantId = positiveId(variant && variant.id, 'variant_id');
      matches.set(`${productId}:${variantId}`, { ...entry, productId, variantId });
    });
  });

  if (matches.size === 0) throw new Error(`No se encontro el SKU esperado ${entry.sku} (${entry.internal_id}).`);
  if (matches.size > 1) throw new Error(`El SKU ${entry.sku} tiene coincidencias ambiguas en Tiendanube.`);
  return matches.values().next().value;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildCatalogUpsertSql(resolvedEntries, storeId) {
  if (!Array.isArray(resolvedEntries) || !resolvedEntries.length) {
    throw new Error('No hay coincidencias resueltas para generar SQL.');
  }
  const normalizedStoreId = String(storeId || '').trim();
  if (!/^\d+$/.test(normalizedStoreId)) throw new Error('TIENDANUBE_STORE_ID debe ser numerico.');
  const variants = new Set();
  const internalIds = new Set();
  const statements = resolvedEntries.map((entry) => {
    const productId = positiveId(entry.productId, 'product_id');
    const variantId = positiveId(entry.variantId, 'variant_id');
    if (internalIds.has(entry.internal_id)) throw new Error(`internal_id duplicado: ${entry.internal_id}.`);
    if (variants.has(variantId)) throw new Error(`La variante ${variantId} esta asignada a mas de un internal_id.`);
    internalIds.add(entry.internal_id);
    variants.add(variantId);
    return [
      'INSERT INTO tiendanube_catalog',
      '  (store_id, internal_id, expected_sku, display_name, product_id, variant_id, enabled, updated_at)',
      `VALUES (${sqlString(normalizedStoreId)}, ${sqlString(entry.internal_id)}, ${sqlString(entry.sku)}, ${sqlString(entry.name)}, ${productId}, ${variantId}, 1, unixepoch())`,
      'ON CONFLICT(store_id, internal_id) DO UPDATE SET',
      '  expected_sku = excluded.expected_sku,',
      '  display_name = excluded.display_name,',
      '  product_id = excluded.product_id,',
      '  variant_id = excluded.variant_id,',
      '  enabled = 1,',
      '  updated_at = unixepoch();'
    ].join('\n');
  });
  return `BEGIN TRANSACTION;\n\n${statements.join('\n\n')}\n\nCOMMIT;\n`;
}

export async function fetchProductsForSku(client, sku) {
  const products = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await client.request(`/products?q=${encodeURIComponent(sku)}&page=${page}&per_page=200`);
    if (!Array.isArray(result)) throw new Error(`Tiendanube devolvio una respuesta invalida para el SKU ${sku}.`);
    products.push(...result);
    if (result.length < 200) return products;
  }
  throw new Error(`La busqueda del SKU ${sku} excedio el limite seguro de paginacion.`);
}

export function parseArguments(args) {
  let output;
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (/token|secret/i.test(argument)) {
      throw new Error('El access token solo se acepta mediante TIENDANUBE_ACCESS_TOKEN.');
    }
    if (argument === '--output') {
      output = args[index + 1];
      index += 1;
    } else if (argument === '--force') {
      force = true;
    } else {
      throw new Error('Argumento no reconocido. El token solo se acepta mediante el entorno.');
    }
  }
  if (!output) throw new Error('Falta --output dentro de db/generated/.');
  return { output, force };
}

export function resolveOutputPath(value) {
  const outputPath = path.resolve(process.cwd(), String(value || ''));
  const relative = path.relative(generatedDirectory, outputPath);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || path.extname(outputPath).toLowerCase() !== '.sql') {
    throw new Error('El archivo de salida debe ser un .sql dentro de db/generated/.');
  }
  return outputPath;
}

export async function runCatalogSync(options = {}) {
  const env = options.env || process.env;
  const storeId = String(env.TIENDANUBE_STORE_ID || '').trim();
  const accessToken = String(env.TIENDANUBE_ACCESS_TOKEN || '');
  const userAgent = userAgentFromEnv(env);
  if (!/^\d+$/.test(storeId)) throw new Error('TIENDANUBE_STORE_ID debe ser numerico.');
  if (!accessToken) throw new Error('Falta TIENDANUBE_ACCESS_TOKEN en el entorno.');

  const definition = validateCatalogDefinition(JSON.parse(await readFile(defaultCatalogPath, 'utf8')));
  const client = options.client || new TiendanubeClient({
    storeId,
    accessToken,
    userAgent,
    apiBase: apiBaseFromEnv(env),
    timeoutMs: env.TIENDANUBE_API_TIMEOUT_MS,
    maxRetries: env.TIENDANUBE_API_MAX_RETRIES
  });
  const resolved = [];
  for (const entry of definition) {
    if (!options.quiet) process.stderr.write(`Validando ${entry.internal_id} por SKU...\n`);
    const products = await fetchProductsForSku(client, entry.sku);
    resolved.push(resolveSkuMatch(entry, products));
  }
  return buildCatalogUpsertSql(resolved, storeId);
}

async function main() {
  const { output, force } = parseArguments(process.argv.slice(2));
  const outputPath = resolveOutputPath(output);
  const sql = await runCatalogSync();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, { encoding: 'utf8', flag: force ? 'w' : 'wx' });
  process.stderr.write(`SQL generado en ${path.relative(repoRoot, outputPath)}. Revisarlo antes de aplicarlo.\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`Error: ${String(error && error.message || 'fallo inesperado')}\n`);
    process.exitCode = 1;
  });
}
