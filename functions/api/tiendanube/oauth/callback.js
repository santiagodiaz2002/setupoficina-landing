import { handleOAuthCallback } from '../../../_lib/tiendanube/oauth.mjs';

export async function onRequestGet(context) {
  return handleOAuthCallback(context);
}
