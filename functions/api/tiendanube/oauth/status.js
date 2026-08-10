// Ruta de lectura del estado público y sanitizado de la instalación OAuth configurada.
import { handleOAuthStatus } from '../../../_lib/tiendanube/oauth.mjs';

// GET no modifica la instalación; sólo el contador de rate limit asociado a la consulta.
export async function onRequestGet(context) {
  // El servicio no acepta elegir otra tienda por query y nunca devuelve el access token.
  return handleOAuthStatus(context);
}
