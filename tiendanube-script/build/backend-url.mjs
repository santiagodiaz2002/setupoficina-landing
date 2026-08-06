export const PRODUCTION_BACKEND_URL = 'https://setupoficina.com.ar';

const PREVIEW_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.setupoficina-landing\.pages\.dev$/;

export function validateBackendUrl(value) {
  const raw = String(value || '').trim();
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new Error('SETUPOFICINA_BACKEND_URL debe ser una URL HTTPS valida.');
  }

  const hasOnlyOrigin = url.pathname === '/' && !url.search && !url.hash;
  const isProduction = url.origin === PRODUCTION_BACKEND_URL;
  const isCloudflarePreview = PREVIEW_HOST_PATTERN.test(url.hostname);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !hasOnlyOrigin ||
    (!isProduction && !isCloudflarePreview)
  ) {
    throw new Error(
      'SETUPOFICINA_BACKEND_URL solo admite setupoficina.com.ar o un Preview de setupoficina-landing.pages.dev.'
    );
  }
  return url.origin;
}

export function resolveBackendUrl(value = process.env.SETUPOFICINA_BACKEND_URL) {
  return validateBackendUrl(value || PRODUCTION_BACKEND_URL);
}
