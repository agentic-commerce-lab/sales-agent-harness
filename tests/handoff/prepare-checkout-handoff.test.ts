import { describe, expect, test } from 'bun:test';

import type { CartSummary } from '../../src/contracts/commerce.js';
import { InMemoryHandoffStore } from '../../src/handoff/handoff-store.js';
import { prepareCheckoutHandoff } from '../../src/handoff/prepare-checkout-handoff.js';

function createCartSummary(): CartSummary {
  return {
    cartId: 'cart-1',
    items: [
      {
        productId: 'product-1',
        label: 'Blue Jacket',
        quantity: 1,
        unitPrice: { amount: 119, currency: 'EUR' },
        totalPrice: { amount: 119, currency: 'EUR' },
      },
    ],
    subtotal: { amount: 119, currency: 'EUR' },
    total: { amount: 119, currency: 'EUR' },
    currency: 'EUR',
  };
}

describe('prepareCheckoutHandoff', () => {
  test('creates an opaque continueUrl without exposing the Shopware context token', () => {
    const store = new InMemoryHandoffStore({ now: () => new Date('2026-06-30T12:00:00.000Z') });

    const handoff = prepareCheckoutHandoff({
      store,
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      shopwareSalesChannelId: 'sales-channel-1',
      shopwareContextToken: 'secret-context-token',
      cartSummary: createCartSummary(),
      storefrontBaseUrl: 'https://shop.example.test',
      ttlMs: 300000,
    });

    expect(handoff.continueUrl).toStartWith('https://shop.example.test/agent-checkout?h=handoff_');
    expect(handoff.continueUrl).not.toContain('secret-context-token');
    expect(
      store.resolve(handoff.handoffId, 'merchant-1', 'sales-channel-1')?.cartSummary.total,
    ).toEqual({
      amount: 119,
      currency: 'EUR',
    });
  });

  test('validates expiry, merchant scope, sales-channel scope, and limited use', () => {
    const store = new InMemoryHandoffStore({ now: () => new Date('2026-06-30T12:00:00.000Z') });
    const handoff = prepareCheckoutHandoff({
      store,
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      shopwareSalesChannelId: 'sales-channel-1',
      shopwareContextToken: 'secret-context-token',
      cartSummary: createCartSummary(),
      storefrontBaseUrl: 'https://shop.example.test',
      ttlMs: 1,
    });

    expect(store.resolve(handoff.handoffId, 'wrong-merchant', 'sales-channel-1')).toBeUndefined();
    expect(store.resolve(handoff.handoffId, 'merchant-1', 'wrong-sales-channel')).toBeUndefined();
    expect(store.resolve(handoff.handoffId, 'merchant-1', 'sales-channel-1')).toBeDefined();
    expect(store.resolve(handoff.handoffId, 'merchant-1', 'sales-channel-1')).toBeUndefined();

    const expiredStore = new InMemoryHandoffStore({
      now: () => new Date('2026-06-30T12:10:00.000Z'),
    });
    expiredStore.save({
      ...store.records[0]!,
      status: 'ready_for_checkout',
    });

    expect(
      expiredStore.resolve(handoff.handoffId, 'merchant-1', 'sales-channel-1'),
    ).toBeUndefined();
  });
});
