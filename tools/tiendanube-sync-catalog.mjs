// Importa las operaciones asíncronas necesarias para leer el catálogo versionado, crear su directorio de salida y escribir el SQL revisable.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
// Importa utilidades de rutas para mantener todos los accesos dentro del repositorio sin depender del directorio desde el que se invoque el script.
import path from 'node:path';
// Importa conversiones entre URLs de módulos ESM y rutas, usadas tanto para hallar el repo como para detectar ejecución directa.
import { fileURLToPath, pathToFileURL } from 'node:url';

// Reutiliza el cliente backend y sus validadores de base/User-Agent para que la herramienta consulte Tiendanube con el mismo contrato de API.
import { TiendanubeClient, apiBaseFromEnv, userAgentFromEnv } from '../functions/_lib/tiendanube/client.mjs';

// Calcula la raíz subiendo un nivel desde este archivo, de modo que las rutas de entrada/salida no dependan de `process.cwd()`.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Fija como única definición comercial versionada el JSON bajo `config/`.
const defaultCatalogPath = path.join(repoRoot, 'config', 'tiendanube-catalog.json');
// Limita los SQL resueltos al directorio ignorado `db/generated`, evitando escribir resultados sensibles en otras rutas.
const generatedDirectory = path.join(repoRoot, 'db', 'generated');
// Declara las únicas propiedades admitidas por producto; el orden alfabético coincide con el `sort()` usado en la validación.
const allowedCatalogKeys = ['internal_id', 'name', 'sku'];

// Normaliza un SKU a texto sin espacios laterales para comparaciones exactas y detección de duplicados.
function normalizedSku(value) {
  // No cambia mayúsculas/minúsculas ni caracteres internos porque el SKU debe coincidir exactamente con la tienda.
  return String(value || '').trim();
}

// Convierte un ID externo a número y exige un entero positivo representable de forma segura por JavaScript.
function positiveId(value, field) {
  // Centraliza la conversión para product_id y variant_id.
  const number = Number(value);
  // Rechaza decimales, infinitos, valores negativos/cero y enteros fuera del rango seguro.
  if (!Number.isSafeInteger(number) || number < 1) {
    // Nombra el campo que falló sin incluir credenciales ni el payload completo recibido.
    throw new Error(`Tiendanube devolvio un ${field} invalido.`);
  }
  // Devuelve el número validado para incrustarlo como literal entero en el SQL generado.
  return number;
}

// Valida por completo `config/tiendanube-catalog.json` antes de hacer una sola consulta externa.
// Recibe el valor parseado, devuelve entradas normalizadas y lanza si hay forma, claves, IDs, SKU o nombres inválidos/duplicados.
export function validateCatalogDefinition(value) {
  // Exige una lista con al menos un producto para impedir generar una sincronización vacía por error.
  if (!Array.isArray(value) || !value.length) {
    throw new Error('El catalogo versionado debe contener al menos un producto.');
  }

  // Acumula IDs internos ya vistos para imponer unicidad dentro de la fuente versionada.
  const internalIds = new Set();
  // Acumula SKU normalizados para que dos entradas no intenten resolver la misma referencia comercial.
  const skus = new Set();
  // Valida y transforma cada entrada conservando el mismo orden que el JSON.
  return value.map((raw, index) => {
    // Cada entrada debe ser un objeto plano; arrays, nulos y primitivos no ofrecen el contrato esperado.
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`La entrada ${index + 1} del catalogo es invalida.`);
    }
    // Ordena las claves reales para compararlas de forma determinista con la allowlist declarada arriba.
    const keys = Object.keys(raw).sort();
    // Impide campos adicionales como precio, token o IDs reales, y también detecta cualquiera de las tres claves ausente.
    if (keys.length !== allowedCatalogKeys.length || keys.some((key, keyIndex) => key !== allowedCatalogKeys[keyIndex])) {
      throw new Error(`La entrada ${index + 1} solo puede contener internal_id, sku y name.`);
    }

    // Normaliza los tres valores permitidos a cadenas sin espacios laterales.
    const internalId = String(raw.internal_id || '').trim();
    const sku = String(raw.sku || '').trim();
    const name = String(raw.name || '').trim();
    // Limita el ID interno al alfabeto que también aceptan frontend/backend y a una longitud máxima de 64.
    if (!/^[a-z0-9_ñ-]{1,64}$/u.test(internalId)) throw new Error(`internal_id invalido en la entrada ${index + 1}.`);
    // Requiere SKU no vacío, acotado y sin controles que podrían corromper logs o SQL.
    if (!sku || sku.length > 100 || /[\u0000-\u001f\u007f]/u.test(sku)) throw new Error(`SKU invalido para ${internalId}.`);
    // Requiere un nombre presentable y compatible con el máximo definido en la tabla D1.
    if (!name || name.length > 160) throw new Error(`Nombre invalido para ${internalId}.`);

    // Prepara la representación exacta usada para detectar SKU repetidos.
    const comparableSku = normalizedSku(sku);
    // Evita que dos filas comerciales compartan el mismo ID interno.
    if (internalIds.has(internalId)) throw new Error(`internal_id duplicado: ${internalId}.`);
    // Evita consultas/resoluciones ambiguas para un mismo SKU.
    if (skus.has(comparableSku)) throw new Error(`SKU duplicado en el catalogo: ${sku}.`);
    // Registra ambos identificadores sólo después de superar todas las validaciones.
    internalIds.add(internalId);
    skus.add(comparableSku);
    // Devuelve un objeto nuevo con las claves permitidas y valores ya normalizados.
    return { internal_id: internalId, sku, name };
  });
}

// Busca una única variante cuyo SKU coincida exactamente dentro de la respuesta de productos de Tiendanube.
// Produce la entrada original enriquecida con productId/variantId, o lanza ante ausencia/ambigüedad.
export function resolveSkuMatch(entry, products) {
  // Rechaza respuestas que no sean listas antes de intentar recorrer variantes.
  if (!Array.isArray(products)) throw new Error(`Respuesta invalida al buscar el SKU ${entry.sku}.`);
  // Normaliza una sola vez el SKU esperado proveniente del JSON validado.
  const expected = normalizedSku(entry.sku);
  // Usa una clave compuesta de producto/variante para deduplicar coincidencias repetidas en respuestas paginadas.
  const matches = new Map();

  // Recorre todos los productos que la API devolvió para la búsqueda.
  products.forEach((product) => {
    // Trata variantes ausentes o mal formadas como lista vacía, sin inventar una coincidencia a nivel producto.
    const variants = product && Array.isArray(product.variants) ? product.variants : [];
    // Inspecciona cada variante porque el SKU pertenece a ese nivel en la API.
    variants.forEach((variant) => {
      // Descarta cualquier SKU distinto manteniendo comparación exacta tras trim.
      if (normalizedSku(variant && variant.sku) !== expected) return;
      // Valida el ID de producto antes de incorporarlo al resultado.
      const productId = positiveId(product && product.id, 'product_id');
      // Valida de forma independiente el ID de variante.
      const variantId = positiveId(variant && variant.id, 'variant_id');
      // Guarda la combinación única y copia la definición comercial sin mutarla.
      matches.set(`${productId}:${variantId}`, { ...entry, productId, variantId });
    });
  });

  // Sin coincidencia exacta no es seguro poblar D1 con IDs aproximados.
  if (matches.size === 0) throw new Error(`No se encontro el SKU esperado ${entry.sku} (${entry.internal_id}).`);
  // Más de una combinación haría ambiguo qué variante debe recibir la selección del usuario.
  if (matches.size > 1) throw new Error(`El SKU ${entry.sku} tiene coincidencias ambiguas en Tiendanube.`);
  // Devuelve el único valor del Map una vez demostrada la cardinalidad exacta.
  return matches.values().next().value;
}

// Escapa una cadena como literal SQL reemplazando cada comilla simple por dos comillas, regla de SQLite para representar el carácter sin cerrar el literal.
function sqlString(value) {
  // Rodea el texto escapado con comillas simples; sólo se usa para valores ya validados/controlados al generar un archivo offline.
  return `'${String(value).replaceAll("'", "''")}'`;
}

// Genera una transacción SQL revisable que inserta o actualiza el catálogo de una tienda, pero nunca la ejecuta contra D1.
export function buildCatalogUpsertSql(resolvedEntries, storeId) {
  // Exige al menos una resolución confirmada para no producir un archivo que aparente sincronizar sin filas.
  if (!Array.isArray(resolvedEntries) || !resolvedEntries.length) {
    throw new Error('No hay coincidencias resueltas para generar SQL.');
  }
  // Normaliza el Store ID que quedará repetido en cada fila del catálogo aislado por tienda.
  const normalizedStoreId = String(storeId || '').trim();
  // Restringe el identificador a dígitos, coherente con los CHECK de la migración D1.
  if (!/^\d+$/.test(normalizedStoreId)) throw new Error('TIENDANUBE_STORE_ID debe ser numerico.');
  // Detecta que una misma variante no sea asignada a dos productos internos diferentes.
  const variants = new Set();
  // Revalida unicidad interna después de la resolución para proteger también usos directos de esta función en tests/herramientas.
  const internalIds = new Set();
  // Convierte cada entrada resuelta en una sentencia UPSERT independiente dentro de la transacción común.
  const statements = resolvedEntries.map((entry) => {
    // Valida los IDs numéricos antes de interpolarlos como enteros sin comillas.
    const productId = positiveId(entry.productId, 'product_id');
    const variantId = positiveId(entry.variantId, 'variant_id');
    // Impide dos sentencias con la misma clave primaria comercial.
    if (internalIds.has(entry.internal_id)) throw new Error(`internal_id duplicado: ${entry.internal_id}.`);
    // Impide que una variante resuelta alimente más de una selección interna.
    if (variants.has(variantId)) throw new Error(`La variante ${variantId} esta asignada a mas de un internal_id.`);
    // Registra las claves que ya ocupará esta transacción.
    internalIds.add(entry.internal_id);
    variants.add(variantId);
    // Compone la sentencia por líneas para que el archivo generado sea legible y fácil de revisar antes de aplicarlo manualmente.
    return [
      // El destino es la tabla creada por `db/migrations/0001_tiendanube_cart_bridge.sql`.
      'INSERT INTO tiendanube_catalog',
      // Enumera explícitamente columnas para no depender de su orden físico ni escribir campos no controlados.
      '  (store_id, internal_id, expected_sku, display_name, product_id, variant_id, enabled, updated_at)',
      // Inserta tienda/definición escapadas, IDs positivos, habilitación y timestamp calculado por SQLite.
      `VALUES (${sqlString(normalizedStoreId)}, ${sqlString(entry.internal_id)}, ${sqlString(entry.sku)}, ${sqlString(entry.name)}, ${productId}, ${variantId}, 1, unixepoch())`,
      // Ante conflicto de la clave `(store_id, internal_id)`, actualiza la fila existente en lugar de duplicarla.
      'ON CONFLICT(store_id, internal_id) DO UPDATE SET',
      // Renueva el SKU esperado desde la definición versionada.
      '  expected_sku = excluded.expected_sku,',
      // Renueva el nombre apto para respuesta/UI.
      '  display_name = excluded.display_name,',
      // Sustituye el ID de producto si la resolución actual cambió.
      '  product_id = excluded.product_id,',
      // Sustituye la variante resuelta actual.
      '  variant_id = excluded.variant_id,',
      // Reactiva explícitamente toda entrada presente en la fuente actual.
      '  enabled = 1,',
      // Actualiza la fecha usando el reloj de SQLite al aplicar el archivo.
      '  updated_at = unixepoch();'
    // Une las piezas de una misma sentencia con saltos de línea.
    ].join('\n');
  });
  // Envuelve todas las sentencias en una transacción para que la aplicación manual pueda ser atómica en SQLite/D1.
  return `BEGIN TRANSACTION;\n\n${statements.join('\n\n')}\n\nCOMMIT;\n`;
}

// Consulta páginas de productos filtradas por SKU y acumula resultados hasta encontrar una página incompleta.
export async function fetchProductsForSku(client, sku) {
  // Conserva en orden todos los productos devueltos por las páginas consultadas.
  const products = [];
  // Impone un máximo de 20 páginas de 200 para evitar un bucle o descarga ilimitada ante una API inesperada.
  for (let page = 1; page <= 20; page += 1) {
    // Codifica el SKU en query y usa el cliente compartido, que agrega versión, autenticación, timeout y User-Agent.
    const result = await client.request(`/products?q=${encodeURIComponent(sku)}&page=${page}&per_page=200`);
    // La API debe devolver un array para este endpoint; otra forma detiene la sincronización.
    if (!Array.isArray(result)) throw new Error(`Tiendanube devolvio una respuesta invalida para el SKU ${sku}.`);
    // Incorpora esta página sin crear arrays anidados.
    products.push(...result);
    // Menos de 200 elementos demuestra que no existe otra página completa por consultar.
    if (result.length < 200) return products;
  }
  // Superar el tope explícito se trata como fallo, no como conjunto parcial potencialmente ambiguo.
  throw new Error(`La busqueda del SKU ${sku} excedio el limite seguro de paginacion.`);
}

// Interpreta exclusivamente `--output <ruta>` y el flag opcional `--force`, rechazando secretos en argumentos visibles del proceso.
export function parseArguments(args) {
  // Comienza sin salida para poder detectar su ausencia al terminar el recorrido.
  let output;
  // Por defecto la escritura será exclusiva y fallará si el archivo ya existe.
  let force = false;
  // Recorre manualmente los argumentos para asociar el valor siguiente a `--output`.
  for (let index = 0; index < args.length; index += 1) {
    // Lee el argumento actual sin mutar la lista recibida.
    const argument = args[index];
    // Prohíbe incluso flags desconocidos cuyo nombre sugiera credenciales, reforzando el uso exclusivo del entorno.
    if (/token|secret/i.test(argument)) {
      throw new Error('El access token solo se acepta mediante TIENDANUBE_ACCESS_TOKEN.');
    }
    // Reconoce la única opción que consume un valor adicional.
    if (argument === '--output') {
      // Guarda la ruta candidata; `resolveOutputPath()` hará luego la validación de alcance/extensión.
      output = args[index + 1];
      // Salta el valor para que no se procese como un argumento independiente.
      index += 1;
    } else if (argument === '--force') {
      // Permite sobreescritura deliberada únicamente cuando el operador lo solicita de forma explícita.
      force = true;
    } else {
      // Rechaza opciones imprevistas para que un typo no cambie silenciosamente el comportamiento.
      throw new Error('Argumento no reconocido. El token solo se acepta mediante el entorno.');
    }
  }
  // La herramienta siempre requiere una ruta revisable dentro de `db/generated/`.
  if (!output) throw new Error('Falta --output dentro de db/generated/.');
  // Devuelve una configuración simple que `main()` consumirá.
  return { output, force };
}

// Convierte la ruta CLI a absoluta y demuestra que queda estrictamente dentro de `db/generated/` con extensión `.sql`.
export function resolveOutputPath(value) {
  // Resuelve rutas relativas desde el directorio actual del operador, igual que otras herramientas CLI.
  const outputPath = path.resolve(process.cwd(), String(value || ''));
  // Calcula la relación con el único directorio permitido para detectar escapes mediante `..` o rutas absolutas.
  const relative = path.relative(generatedDirectory, outputPath);
  // Rechaza el directorio mismo, rutas fuera de él y archivos con otra extensión.
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || path.extname(outputPath).toLowerCase() !== '.sql') {
    throw new Error('El archivo de salida debe ser un .sql dentro de db/generated/.');
  }
  // Devuelve la ruta canónica ya confinada para que `writeFile()` no tenga que reinterpretar la entrada original.
  return outputPath;
}

// Ejecuta la resolución completa del catálogo y devuelve SQL en memoria; las pruebas pueden inyectar entorno/cliente y evitar llamadas reales.
export async function runCatalogSync(options = {}) {
  // Usa el entorno inyectado cuando existe y el del proceso sólo en ejecución CLI normal.
  const env = options.env || process.env;
  // Lee y normaliza la tienda objetivo desde una variable explícita.
  const storeId = String(env.TIENDANUBE_STORE_ID || '').trim();
  // Lee el token únicamente del entorno y nunca lo agrega a argumentos, archivos o mensajes.
  const accessToken = String(env.TIENDANUBE_ACCESS_TOKEN || '');
  // Delega la validación del identificador de aplicación/contacto al mismo helper del backend.
  const userAgent = userAgentFromEnv(env);
  // Impide consultar una tienda ausente o con ID no numérico.
  if (!/^\d+$/.test(storeId)) throw new Error('TIENDANUBE_STORE_ID debe ser numerico.');
  // Impide iniciar la sincronización sin autenticación disponible.
  if (!accessToken) throw new Error('Falta TIENDANUBE_ACCESS_TOKEN en el entorno.');

  // Lee, parsea y valida la fuente versionada antes de construir el cliente o recorrer SKU.
  const definition = validateCatalogDefinition(JSON.parse(await readFile(defaultCatalogPath, 'utf8')));
  // Reutiliza un doble inyectado en tests o crea el cliente real con todos sus parámetros controlados por entorno.
  const client = options.client || new TiendanubeClient({
    storeId,
    accessToken,
    userAgent,
    apiBase: apiBaseFromEnv(env),
    timeoutMs: env.TIENDANUBE_API_TIMEOUT_MS,
    maxRetries: env.TIENDANUBE_API_MAX_RETRIES
  });
  // Acumula una única resolución validada por cada entrada comercial.
  const resolved = [];
  // Procesa secuencialmente para mantener logs legibles y evitar una ráfaga simultánea de consultas a la API.
  for (const entry of definition) {
    // Informa progreso por stderr sólo cuando el llamador no solicitó modo silencioso; nunca imprime el token.
    if (!options.quiet) process.stderr.write(`Validando ${entry.internal_id} por SKU...\n`);
    // Recupera todas las páginas potenciales para el SKU actual.
    const products = await fetchProductsForSku(client, entry.sku);
    // Exige una coincidencia exacta y agrega los IDs resueltos a la colección.
    resolved.push(resolveSkuMatch(entry, products));
  }
  // Produce el SQL de todas las entradas sin aplicarlo ni abrir una conexión D1.
  return buildCatalogUpsertSql(resolved, storeId);
}

// Orquesta la interfaz de línea de comandos: argumentos, resolución, sincronización, directorio y escritura del archivo.
async function main() {
  // Interpreta únicamente las opciones permitidas a partir de los argumentos posteriores al ejecutable/script.
  const { output, force } = parseArguments(process.argv.slice(2));
  // Confina y normaliza la ruta antes de realizar consultas o escrituras.
  const outputPath = resolveOutputPath(output);
  // Ejecuta validación/consultas y mantiene el SQL en memoria hasta que toda la resolución haya tenido éxito.
  const sql = await runCatalogSync();
  // Crea `db/generated` si falta; no borra ni reemplaza otros contenidos.
  await mkdir(path.dirname(outputPath), { recursive: true });
  // Usa `wx` por defecto para impedir sobreescritura accidental y `w` sólo con `--force` explícito.
  await writeFile(outputPath, sql, { encoding: 'utf8', flag: force ? 'w' : 'wx' });
  // Informa una ruta relativa legible y recuerda que aplicar el SQL es un paso manual posterior.
  process.stderr.write(`SQL generado en ${path.relative(repoRoot, outputPath)}. Revisarlo antes de aplicarlo.\n`);
}

// Convierte la ruta realmente invocada por Node a URL para distinguir ejecución CLI de una importación usada por pruebas.
const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
// Sólo lanza `main()` cuando este módulo es el archivo ejecutado; importarlo expone helpers sin efectuar red ni escritura.
if (import.meta.url === invokedPath) {
  // Captura rechazos de la orquestación para presentar un mensaje breve y terminar con código no exitoso.
  main().catch((error) => {
    // Escribe sólo el mensaje normalizado en stderr y evita volcar objetos que pudieran contener datos del entorno.
    process.stderr.write(`Error: ${String(error && error.message || 'fallo inesperado')}\n`);
    // Señala fallo al shell sin forzar una salida inmediata que pudiera interrumpir el vaciado de stderr.
    process.exitCode = 1;
  });
}
