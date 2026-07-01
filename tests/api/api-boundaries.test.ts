import { describe, expect, test } from 'bun:test';

import { createA2aApi } from '../../src/api/a2a-api.js';
import { createCustomerApi } from '../../src/api/customer-api.js';
import type { CommerceHarnessApi } from '../../src/api/harness-api.js';
import type { PolicyDecision } from '../../src/contracts/policy.js';

const allowDecision: PolicyDecision = {
  status: 'allow',
  reason: 'capability_enabled',
  context: {
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    agentSessionId: 'session-1',
    channel: 'a2a',
    capability: 'searchProducts',
    requestedAt: new Date('2026-06-30T12:00:00.000Z'),
  },
  message: 'Allowed',
};

function createHarness() {
  const calls: string[] = [];
  const harness = {
    searchProducts: async () => {
      calls.push('searchProducts');
      return {
        status: 'ok',
        policyDecision: allowDecision,
        value: { dataSource: 'shopware_store_api', products: [] },
      };
    },
    getProductDetails: async () => {
      calls.push('getProductDetails');
      throw new Error('Unexpected product details call');
    },
    createCart: async () => {
      calls.push('createCart');
      throw new Error('Unexpected cart create call');
    },
    updateCart: async () => {
      calls.push('updateCart');
      throw new Error('Unexpected cart update call');
    },
    getCartSummary: async () => {
      calls.push('getCartSummary');
      throw new Error('Unexpected cart summary call');
    },
    prepareCheckoutHandoff: async () => {
      calls.push('prepareCheckoutHandoff');
      return {
        status: 'ok',
        policyDecision: allowDecision,
        value: {
          summary: {
            cartId: 'cart-1',
            items: [],
            subtotal: { amount: 119, currency: 'EUR' },
            total: { amount: 119, currency: 'EUR' },
            currency: 'EUR',
          },
          continueUrl: 'https://shop.example.test/agent-checkout?h=handoff_opaque',
          handoffId: 'handoff_opaque',
          expiresAt: new Date('2026-06-30T12:05:00.000Z'),
        },
      };
    },
    completeCheckout: async () => {
      calls.push('completeCheckout');
      return {
        status: 'ok',
        policyDecision: allowDecision,
        value: {
          summary: {
            cartId: 'checkout-1',
            items: [],
            subtotal: { amount: 119, currency: 'EUR' },
            total: { amount: 119, currency: 'EUR' },
            currency: 'EUR',
          },
          orderId: 'order-1',
          status: 'completed',
        },
      };
    },
  } satisfies CommerceHarnessApi;

  return { calls, harness };
}

describe('API boundaries', () => {
  test('customer API dispatches to harness methods', async () => {
    const { calls, harness } = createHarness();
    const api = createCustomerApi(harness);

    await api.handle({
      capability: 'searchProducts',
      agentSessionId: 'session-1',
      query: 'jacket',
    });

    expect(calls).toEqual(['searchProducts']);
  });

  test('A2A checkout handoff returns only an opaque continuation URL', async () => {
    const { calls, harness } = createHarness();
    const api = createA2aApi(harness);

    const response = await api.handle({
      capability: 'prepareCheckoutHandoff',
      agentSessionId: 'session-1',
      cartId: 'cart-1',
    });

    expect(calls).toEqual(['prepareCheckoutHandoff']);
    expect(JSON.stringify(response)).not.toContain('secret');
    expect(JSON.stringify(response)).not.toContain('shopwareContextToken');
    expect(JSON.stringify(response)).not.toContain('handoffId');
    expect(JSON.stringify(response)).toContain('h=handoff_opaque');
  });
});
