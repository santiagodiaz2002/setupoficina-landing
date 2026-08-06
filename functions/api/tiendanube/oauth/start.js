import { handleOAuthStart } from '../../../_lib/tiendanube/oauth.mjs';

export async function onRequestGet(context) {
  return handleOAuthStart(context);
}
