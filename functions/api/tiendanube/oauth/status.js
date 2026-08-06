import { handleOAuthStatus } from '../../../_lib/tiendanube/oauth.mjs';

export async function onRequestGet(context) {
  return handleOAuthStatus(context);
}
