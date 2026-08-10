// Ruta mínima del callback OAuth registrado ante Tiendanube.
import { handleOAuthCallback } from '../../../_lib/tiendanube/oauth.mjs';

// El proveedor vuelve mediante GET con code y state en la query del callback exacto.
export async function onRequestGet(context) {
  // La librería consume el state una sola vez, intercambia el code y guarda el token cifrado.
  return handleOAuthCallback(context);
}
