// Ruta mínima que inicia OAuth sin duplicar la lógica sensible de state y cookies.
import { handleOAuthStart } from '../../../_lib/tiendanube/oauth.mjs';

// La navegación inicial es GET porque termina en una redirección al portal de autorización.
export async function onRequestGet(context) {
  // El servicio valida origen configurado, instalación activa, rate limit y persistencia del state.
  return handleOAuthStart(context);
}
