// Este módulo procesa los tres webhooks de privacidad registrados para la aplicación de Tiendanube.
// Verifica el cuerpo crudo con HMAC antes de interpretar JSON y borra por tienda solo cuando el tipo exige redacción total.
// Sin la firma, el límite de tamaño y la coincidencia de tienda, un tercero podría provocar lecturas o borrados no autorizados.
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { HttpError, errorResponse, jsonResponse } from './http.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { enforceRateLimit } from './rate-limit.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { optionalConfiguredStoreId } from './installations.mjs';
// Importa una dependencia compartida para reutilizar el contrato y evitar implementaciones divergentes.
import { verifyWebhookHmac } from './security.mjs';

// Calcula y conserva un dato inmutable dentro de este alcance.
const WEBHOOK_TYPES = new Set(['store-redact', 'customers-redact', 'customers-data-request']);

// Obtiene el binding D1 donde viven datos del puente y rechaza un despliegue incompleto.
function database(env) {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (!env.LEADS_DB) throw new HttpError(500, 'd1_not_configured', 'D1 LEADS_DB no configurada.');
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return env.LEADS_DB;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Lee el cuerpo binario con un máximo estricto para verificar exactamente los bytes firmados.
async function rawWebhookBody(request, maxBytes = 64 * 1024) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(413, 'payload_too_large', 'Webhook demasiado grande.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Calcula y conserva un dato inmutable dentro de este alcance.
  const body = new Uint8Array(await request.arrayBuffer());
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (body.byteLength > maxBytes) throw new HttpError(413, 'payload_too_large', 'Webhook demasiado grande.');
// Entrega el valor ya comprobado al llamador y termina esta rama.
  return body;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Convierte el cuerpo ya autenticado en un objeto simple y rechaza JSON inválido o estructuras inesperadas.
function parseWebhookJson(rawBody) {
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Calcula y conserva un dato inmutable dentro de este alcance.
    const payload = JSON.parse(new TextDecoder().decode(rawBody));
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid');
// Entrega el valor ya comprobado al llamador y termina esta rama.
    return payload;
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (_) {
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(400, 'invalid_webhook_json', 'JSON de webhook invalido.');
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Prepara la eliminación de datos vinculados a una tienda y usa lote cuando el doble o D1 lo ofrece.
async function deleteStoreData(db, storeId, now) {
// Calcula y conserva un dato inmutable dentro de este alcance.
  const statements = [
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
    db.prepare('DELETE FROM tiendanube_cart_transfers WHERE store_id = ?').bind(storeId),
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
    db.prepare('DELETE FROM tiendanube_installations WHERE store_id = ?').bind(storeId),
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
    db.prepare('DELETE FROM tiendanube_oauth_states WHERE store_id = ? OR expires_at <= ?').bind(storeId, now),
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
    db.prepare('DELETE FROM tiendanube_catalog WHERE store_id = ?').bind(storeId),
// Prepara una sentencia D1 sin interpolar directamente valores procedentes de la petición.
    db.prepare("DELETE FROM tiendanube_rate_limits WHERE route LIKE 'tiendanube:%'")
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  ];
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
  if (typeof db.batch === 'function') {
// Agrupa las sentencias para reducir viajes a D1 y mantener el orden de aplicación.
    await db.batch(statements);
// Entrega el valor ya comprobado al llamador y termina esta rama.
    return;
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Ejecuta la mutación preparada y permite revisar cuántas filas cambiaron.
  for (const statement of statements) await statement.run();
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}

// Valida tipo, firma, tienda y frecuencia; luego aplica la respuesta específica de privacidad.
export async function handlePrivacyWebhook({ request, env }, type, deps = {}) {
// Aísla una operación que puede fallar por datos externos, red o persistencia.
  try {
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!WEBHOOK_TYPES.has(type)) throw new HttpError(404, 'webhook_not_found', 'Webhook inexistente.');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const rawBody = await rawWebhookBody(request);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const signature = request.headers.get('x-linkedstore-hmac-sha256') || '';
// Calcula y conserva un dato inmutable dentro de este alcance.
    const verified = await verifyWebhookHmac(rawBody, signature, env.TIENDANUBE_CLIENT_SECRET, deps.cryptoImpl);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!verified) throw new HttpError(401, 'invalid_webhook_signature', 'Firma de webhook invalida.');

// Calcula y conserva un dato inmutable dentro de este alcance.
    const payload = parseWebhookJson(rawBody);
// Calcula y conserva un dato inmutable dentro de este alcance.
    const storeId = String(payload.store_id ?? '').trim();
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (!/^\d+$/.test(storeId)) throw new HttpError(400, 'invalid_store_id', 'Webhook invalido.');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const configuredId = optionalConfiguredStoreId(env);
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (configuredId && storeId !== configuredId) throw new HttpError(403, 'store_mismatch', 'Tienda no autorizada.');
// Calcula y conserva un dato inmutable dentro de este alcance.
    const db = database(env);
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
    await enforceRateLimit(db, request, `tiendanube:privacy:${type}`, {
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      limit: 120,
// Declara un campo explícito del objeto que se comparte con la siguiente etapa.
      windowSeconds: 60,
// Incorpora propiedades ya validadas en el nuevo objeto sin modificar el original.
      ...(deps.rateLimit || {})
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    });

// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (type === 'store-redact') {
// Espera la promesa antes de usar su resultado y mantiene el orden de este flujo asíncrono.
      await deleteStoreData(db, storeId, Number(deps.now ?? Math.floor(Date.now() / 1000)));
// Devuelve la respuesta final y cede el control al runtime de Pages.
      return jsonResponse({ ok: true, redacted: true }, 200);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }

    // La aplicacion no solicita scopes de clientes/pedidos y no persiste PII.
// Evalúa una precondición y evita que el flujo continúe con estado inválido o no autorizado.
    if (type === 'customers-redact') {
// Devuelve la respuesta final y cede el control al runtime de Pages.
      return jsonResponse({ ok: true, redacted: false, reason: 'no_customer_data_stored' }, 200);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
    }
// Devuelve la respuesta final y cede el control al runtime de Pages.
    return jsonResponse({ ok: true, data: [], reason: 'no_customer_data_stored' }, 200);
// Captura el fallo para traducirlo sin filtrar secretos ni detalles del proveedor.
  } catch (error) {
// Devuelve la respuesta final y cede el control al runtime de Pages.
    return errorResponse(error);
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
  }
// Cierra el bloque o la estructura y delimita el alcance iniciado antes.
}
