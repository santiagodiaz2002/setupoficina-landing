// Adaptador del webhook de supresión de datos de cliente.
import { handlePrivacyWebhook } from '../../../_lib/tiendanube/privacy.mjs';

// La firma HMAC se verifica en la librería antes de interpretar el JSON recibido.
export async function onRequestPost(context) {
  // Este tipo informa que la aplicación no persiste datos de clientes.
  return handlePrivacyWebhook(context, 'customers-redact');
}
