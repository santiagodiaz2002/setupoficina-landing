import {
  handleCartTransferConsume,
  handleCartTransferOptions
} from '../../../_lib/tiendanube/transfers.mjs';

export async function onRequestPost(context) {
  return handleCartTransferConsume(context);
}

export async function onRequestOptions(context) {
  return handleCartTransferOptions(context, 'storefront');
}
