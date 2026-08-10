// Adaptador del webhook de acceso/exportación de datos de cliente.
import { handlePrivacyWebhook } from '../../../_lib/tiendanube/privacy.mjs';

// Se publica únicamente POST para recibir el cuerpo firmado del proveedor.
export async function onRequestPost(context) {
  // La respuesta válida es una colección vacía porque este puente no guarda PII de clientes.
  return handlePrivacyWebhook(context, 'customers-data-request');
}
