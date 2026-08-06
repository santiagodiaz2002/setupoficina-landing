import { HttpError } from './http.mjs';
import { sha256Hex } from './security.mjs';

export async function rateLimitIdentity(request) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const origin = request.headers.get('Origin') || 'none';
  return sha256Hex(`v1\n${ip}\n${userAgent}\n${origin}`);
}

export async function enforceRateLimit(db, request, route, options = {}) {
  const limit = Number(options.limit || 20);
  const windowSeconds = Number(options.windowSeconds || 60);
  const now = Number(options.now ?? Math.floor(Date.now() / 1000));
  const resetBefore = now - windowSeconds;
  const keyHash = options.keyHash || await rateLimitIdentity(request);

  await db.prepare('DELETE FROM tiendanube_rate_limits WHERE expires_at <= ?').bind(now).run();

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
  `).bind(keyHash, route, now, now + windowSeconds * 2, resetBefore, resetBefore).first();

  const count = Number(row && row.request_count ? row.request_count : 0);
  if (count > limit) {
    const retryAfter = Math.max(1, windowSeconds - (now - Number(row.window_start || now)));
    throw new HttpError(429, 'rate_limited', 'Demasiadas solicitudes.', null, {
      'Retry-After': String(retryAfter)
    });
  }

  return { allowed: true, count, limit };
}
