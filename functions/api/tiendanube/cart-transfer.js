import {
  handleCartTransfer,
  handleCartTransferOptions
} from '../../_lib/tiendanube/transfers.mjs';

export async function onRequestPost(context) {
  return handleCartTransfer(context);
}

export async function onRequestOptions(context) {
  return handleCartTransferOptions(context, 'setup');
}
