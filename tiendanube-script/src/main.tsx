import { Column, Text, Toast } from '@tiendanube/nube-sdk-jsx';
import type { NubeSDK } from '@tiendanube/nube-sdk-types';
import { createLazySequentialCartAdder } from './transfer-core.mjs';
import {
  createLocationCoordinator,
  displayStoredResult,
  persistResultAndNavigate,
  summarizeDisplayResult
} from './storefront-flow.mjs';

declare const __SETUPOFICINA_BACKEND_URL__: string;

const API_BASE_URL = __SETUPOFICINA_BACKEND_URL__;
const RESULT_SLOT_IDS = ['corner_top_right', 'modal_content'] as const;
const MAX_API_RESPONSE_BYTES = 256 * 1024;
const initializedApps = new WeakSet<object>();

type TransferItem = {
  internalId: string;
  productId: number;
  variantId: number;
  quantity: number;
  name: string;
};

type UnavailableItem = {
  internalId: string;
  quantity: number;
  name: string;
  reason: string;
};

type DisplayResult = {
  added: Array<{ internalId: string; quantity: number; name: string }>;
  failed: Array<{ internalId: string; reason: string; name: string }>;
  completedAt: string;
  preservedExistingCart: true;
  syncWarning?: string;
  fatalError?: string;
};

async function postJson(path: string, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
    const declaredLength = Number(response.headers.get('Content-Length') || 0);
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType) || (Number.isFinite(declaredLength) && declaredLength > MAX_API_RESPONSE_BYTES)) {
      throw new Error(`HTTP ${response.status}`);
    }
    const raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_API_RESPONSE_BYTES) throw new Error(`HTTP ${response.status}`);
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw) as Record<string, unknown>; }
    catch (_) { throw new Error(`HTTP ${response.status}`); }
    if (!response.ok || !data.ok) {
      throw new Error(String(data.message || `HTTP ${response.status}`));
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function namesLabel(items: string[]) {
  return items.length ? items.join(', ') : 'ninguno';
}

async function availableResultSlot(nube: NubeSDK) {
  try {
    const slots = await nube.api.getAvailableSlots().getStatic();
    return RESULT_SLOT_IDS
      .map((slotId) => slots.find((slot) => slot.slotId === slotId))
      .find(Boolean) || null;
  } catch (_) {
    return null;
  }
}

async function renderResult(nube: NubeSDK, result: DisplayResult) {
  const slot = await availableResultSlot(nube);
  if (!slot) return false;
  const summary = summarizeDisplayResult(result);
  const title = summary.fatalError ? 'No pudimos transferir el setup' : 'Tu setup ya esta en el carrito';
  const addedLine = `Agregados: ${namesLabel(summary.addedNames)}.`;
  const outOfStockLine = `Sin stock: ${namesLabel(summary.outOfStockNames)}.`;
  const failedLine = `Otros productos que fallaron: ${namesLabel(summary.failedNames)}.`;
  const detailLine = summary.fatalError || summary.syncWarning || 'Transferencia completada.';

  if (slot.slotId === 'corner_top_right') {
    nube.render(
      slot,
      <Toast.Root variant={summary.variant} duration={15000}>
        <Toast.Title>{title}</Toast.Title>
        <Toast.Description>{addedLine}</Toast.Description>
        <Toast.Description>{outOfStockLine}</Toast.Description>
        <Toast.Description>{failedLine}</Toast.Description>
        <Toast.Description>{summary.preservedMessage}</Toast.Description>
        <Toast.Description>{detailLine}</Toast.Description>
      </Toast.Root>
    );
  } else {
    nube.render(
      slot,
      <Column gap={8} padding={16}>
        <Text heading={2}>{title}</Text>
        <Text>{addedLine}</Text>
        <Text>{outOfStockLine}</Text>
        <Text>{failedLine}</Text>
        <Text>{summary.preservedMessage}</Text>
        <Text>{detailLine}</Text>
      </Column>
    );
  }
  return true;
}

async function executeTransfer(
  nube: NubeSDK,
  adder: ReturnType<typeof createLazySequentialCartAdder>,
  ticket: string,
  storeId: string
) {
  const browser = nube.getBrowserAPIs();
  try {
    const consumed = await postJson('/api/tiendanube/cart-transfer/consume', { ticket, storeId }) as {
      processingToken: string;
      items: TransferItem[];
      unavailable: UnavailableItem[];
    };
    const cartResults = await adder.addSequentially(consumed.items || []);

    const added = cartResults
      .filter((result) => result.ok)
      .map((result) => ({
        internalId: result.item.internalId,
        quantity: result.item.quantity,
        name: result.item.name
      }));
    const failed = [
      ...cartResults.filter((result) => !result.ok).map((result) => ({
        internalId: result.item.internalId,
        reason: result.reason || 'cart_add_failed',
        name: result.item.name
      })),
      ...(consumed.unavailable || []).map((item) => ({
        internalId: item.internalId,
        reason: item.reason,
        name: item.name
      }))
    ];
    const result: DisplayResult = {
      added,
      failed,
      completedAt: new Date().toISOString(),
      preservedExistingCart: true
    };

    try {
      await postJson('/api/tiendanube/cart-transfer/complete', {
        ticket,
        processingToken: consumed.processingToken,
        storeId,
        result: {
          added: added.map(({ internalId, quantity }) => ({ internalId, quantity })),
          failed: failed.map(({ internalId, reason }) => ({ internalId, reason }))
        }
      });
    } catch (_) {
      result.syncWarning = 'El carrito se actualizo, pero no pudimos confirmar el cierre de la transferencia.';
    }
    await persistResultAndNavigate(browser, result);
  } catch (error) {
    const result: DisplayResult = {
      added: [],
      failed: [],
      completedAt: new Date().toISOString(),
      preservedExistingCart: true,
      fatalError: String(error instanceof Error ? error.message : error)
    };
    try {
      await persistResultAndNavigate(browser, result);
    } catch (_) {
      await renderResult(nube, result);
    }
  }
}

function showStoredResult(nube: NubeSDK) {
  const browser = nube.getBrowserAPIs();
  return displayStoredResult(browser, (result) => renderResult(nube, result as DisplayResult));
}

export function App(nube: NubeSDK) {
  if (initializedApps.has(nube as object)) return;
  initializedApps.add(nube as object);
  const adder = createLazySequentialCartAdder(nube);
  const coordinator = createLocationCoordinator({
    transfer: (ticket: string, storeId: string) => executeTransfer(nube, adder, ticket, storeId),
    displayResult: () => showStoredResult(nube)
  });
  const handleLocation = (state: ReturnType<NubeSDK['getState']>) => {
    void coordinator.handle(state).catch(() => {});
  };
  nube.on('location:updated', handleLocation);
  handleLocation(nube.getState());
}
