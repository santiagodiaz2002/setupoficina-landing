// Adaptador de ruta de Cloudflare Pages para preparar una transferencia desde la landing.
// La lógica de negocio queda centralizada en la librería para poder probarla sin levantar Pages.
import {
  // Procesa el POST: valida origen y selección, consulta catálogo/API y crea el ticket en D1.
  handleCartTransfer,
  // Resuelve el preflight con la allowlist específica del origen de SetupOficina.
  handleCartTransferOptions
} from '../../_lib/tiendanube/transfers.mjs';

// Pages selecciona esta exportación únicamente para solicitudes POST a esta ruta exacta.
// Se retorna la promesa del servicio para conservar su Response y la propagación asíncrona.
export async function onRequestPost(context) {
  // context aporta request y env; el servicio no depende del wrapper para validar ninguno.
  return handleCartTransfer(context);
}

// El navegador usa esta exportación al negociar el envío JSON cross-origin.
export async function onRequestOptions(context) {
  // "setup" elige la allowlist de la landing, distinta de la lista del storefront.
  return handleCartTransferOptions(context, 'setup');
}
