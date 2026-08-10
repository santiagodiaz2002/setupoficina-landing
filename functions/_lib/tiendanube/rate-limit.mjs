// Errores HTTP uniformes y SHA-256 permiten bloquear sin guardar identificadores de red en claro.
import { HttpError } from './http.mjs';
// Completa la etapa actual de rate limiting con D1 sin introducir un efecto adicional.
import { sha256Hex } from './security.mjs';

// Deriva una identidad seudónima por request para la ventana de rate limiting.
export async function rateLimitIdentity(request) {
  // Cloudflare aporta la IP de conexión; el segundo header es sólo un fallback fuera de Pages.
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  // User-Agent y Origin separan clientes que comparten IP, aunque también amplían cardinalidad.
  const userAgent = request.headers.get('User-Agent') || 'unknown';
// Calcula y conserva un dato inmutable dentro de este alcance.
  const origin = request.headers.get('Origin') || 'none';
  // El prefijo versiona el formato para poder cambiarlo sin colisionar con filas históricas.
  return sha256Hex(`v1\n${ip}\n${userAgent}\n${origin}`);
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}

// Incrementa de forma atómica un contador de ventana fija persistido en D1.
// Retorna métricas mínimas si permite continuar o lanza 429 cuando supera el límite.
export async function enforceRateLimit(db, request, route, options = {}) {
  // Los defaults protegen nuevos llamadores; cada endpoint puede fijar límites más específicos.
  const limit = Number(options.limit || 20);
// Calcula y conserva un dato inmutable dentro de este alcance.
  const windowSeconds = Number(options.windowSeconds || 60);
  // now y keyHash inyectables vuelven deterministas las pruebas de frontera.
  const now = Number(options.now ?? Math.floor(Date.now() / 1000));
// Calcula y conserva un dato inmutable dentro de este alcance.
  const resetBefore = now - windowSeconds;
// Calcula y conserva un dato inmutable dentro de este alcance.
  const keyHash = options.keyHash || await rateLimitIdentity(request);

  // La limpieza oportunista evita una tabla creciente sin necesitar un cron separado.
  await db.prepare('DELETE FROM tiendanube_rate_limits WHERE expires_at <= ?').bind(now).run();

  // La sentencia inserta la primera solicitud o actualiza el mismo bucket en una sola operación SQL.
  const row = await db.prepare(`
    INSERT INTO tiendanube_rate_limits
      (key_hash, route, window_start, request_count, expires_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(key_hash, route) DO UPDATE SET
      request_count = CASE
        WHEN tiendanube_rate_limits.window_start <= ? THEN 1
        ELSE tiendanube_rate_limits.request_count + 1
      END,
      window_start = CASE
        WHEN tiendanube_rate_limits.window_start <= ? THEN excluded.window_start
        ELSE tiendanube_rate_limits.window_start
      END,
      expires_at = excluded.expires_at
    RETURNING request_count, window_start
  // bind mantiene hash, ruta y tiempos fuera del texto SQL; first toma las columnas de RETURNING.
  `).bind(keyHash, route, now, now + windowSeconds * 2, resetBefore, resetBefore).first();

  // Una fila inesperadamente ausente se interpreta como contador cero; un error D1 ya habría lanzado.
  const count = Number(row && row.request_count ? row.request_count : 0);
// Comprueba una precondición de rate limiting con D1 y detiene el flujo cuando no se cumple.
  if (count > limit) {
    // Retry-After informa segundos restantes, con mínimo uno para evitar un reintento inmediato.
    const retryAfter = Math.max(1, windowSeconds - (now - Number(row.window_start || now)));
// Interrumpe la operación con un error deliberado que el borde HTTP puede serializar.
    throw new HttpError(429, 'rate_limited', 'Demasiadas solicitudes.', null, {
// Define un campo del resultado o de la configuración con un valor ya controlado.
      'Retry-After': String(retryAfter)
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
    });
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
  }

  // El endpoint sólo necesita saber que puede seguir; count/limit ayudan a pruebas y observabilidad.
  return { allowed: true, count, limit };
// Cierra el bloque o la estructura y delimita el alcance de sus temporales.
}
