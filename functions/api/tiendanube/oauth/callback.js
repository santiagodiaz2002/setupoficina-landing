import { handleOAuthCallback } from '../../../_lib/tiendanube/oauth.mjs';

export async function onRequestGet(context) {
  const response = await handleOAuthCallback(context);

  if (!response.ok) {
    let diagnosticCode = 'oauth_unknown_error';

    try {
      const body = await response.clone().text();
      const match = body.match(/<dt>Codigo de diagnostico<\/dt><dd>([^<]+)<\/dd>/i);
      if (match?.[1]) diagnosticCode = match[1].trim();
    } catch (_) {
      // El diagnóstico es auxiliar; nunca debe alterar la respuesta OAuth original.
    }

    console.error(JSON.stringify({
      event: 'tiendanube_oauth_callback_failed',
      status: response.status,
      diagnosticCode
    }));
  }

  return response;
}
