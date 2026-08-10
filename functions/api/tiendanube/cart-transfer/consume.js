// Adaptador Pages del consumo del ticket desde el storefront de Tiendanube.
import {
  // Adquiere en D1 un lease de procesamiento y entrega los IDs resueltos al script autorizado.
  handleCartTransferConsume,
  // Comparte la construcción segura de respuestas preflight.
  handleCartTransferOptions
} from '../../../_lib/tiendanube/transfers.mjs';

// Sólo el método POST queda expuesto para cambiar el estado del ticket.
export async function onRequestPost(context) {
  // El servicio valida Origin, feature flag, Store ID, ticket, rate limit y transición atómica.
  return handleCartTransferConsume(context);
}

// Atiende el preflight que genera el fetch JSON del script NubeSDK.
export async function onRequestOptions(context) {
  // "storefront" evita reutilizar por error la allowlist de la landing.
  return handleCartTransferOptions(context, 'storefront');
}
