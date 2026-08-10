// Adaptador Pages que confirma el resultado de una transferencia ya procesada.
import {
  // Verifica ticket, token de procesamiento y correspondencia exacta del resultado antes de persistir.
  handleCartTransferComplete,
  // Produce el preflight con los mismos criterios CORS que el endpoint de consumo.
  handleCartTransferOptions
} from '../../../_lib/tiendanube/transfers.mjs';

// La finalización es una mutación y por eso sólo se publica mediante POST.
export async function onRequestPost(context) {
  // Retornar directamente evita envolver o perder status, headers y cuerpo del servicio.
  return handleCartTransferComplete(context);
}

// Respuesta de negociación para el fetch cross-origin del storefront.
export async function onRequestOptions(context) {
  // La selección explícita del ámbito impide habilitar orígenes de la landing aquí.
  return handleCartTransferOptions(context, 'storefront');
}
