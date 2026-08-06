import { handlePrivacyWebhook } from '../../../_lib/tiendanube/privacy.mjs';

export async function onRequestPost(context) {
  return handlePrivacyWebhook(context, 'customers-data-request');
}
