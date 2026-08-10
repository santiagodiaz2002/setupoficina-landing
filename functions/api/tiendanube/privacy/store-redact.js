// Adaptador del webhook firmado que solicita borrar los datos de una tienda.
import { handlePrivacyWebhook } from '../../../_lib/tiendanube/privacy.mjs';

// Sólo POST está expuesto porque el cuerpo crudo y su firma autorizan una operación destructiva.
export async function onRequestPost(context) {
  // El discriminante selecciona el borrado transaccional de las tablas del puente.
  return handlePrivacyWebhook(context, 'store-redact');
}
