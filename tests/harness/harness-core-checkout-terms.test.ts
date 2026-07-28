import { describe, expect, test } from 'bun:test';
import type {
  CartResult,
  CheckoutHandoffResult,
  CommerceAdapter,
  CompletedCheckoutResult,
  ProductDetailsResult,
  ProductSearchResult,
} from '../../src/contracts/commerce.js';
import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import { InMemoryHandoffStore } from '../../src/handoff/handoff-store.js';
import { HarnessCore } from '../../src/harness/harness-core.js';
import { InMemoryAuditLogger } from '../../src/observability/audit-log.js';
import { InMemorySessionStore } from '../../src/session/session-store.js';

function createConfig(): AgentHarnessConfig {
  return {
    agentId: 'agent-1',
    merchantId: 'merchant-1',
    enabledCapabilities: ['prepareCheckoutHandoff', 'completeCheckout'],
    disabledCapabilities: ['quotes', 'negotiation', 'payments', 'orderCreation'],
    policies: {
      allowedChannels: ['a2a'],
      blockedCategories: [],
      blockedProducts: [],
      maxCartValue: { amount: 1000, currency: 'EUR' },
      maxItemQuantity: 5,
      allowCheckoutHandoff: true,
      allowCheckoutCompletion: true,
      requireHumanApprovalForCheckout: false,
      unsupportedRegions: [],
      confidentialFields: ['shopwareContextToken'],
    },
    shopware: {
      salesChannelId: 'sales-channel-1',
      storefrontBaseUrl: 'https://shop.example.test',
    },
  };
}

function createAdapter(): CommerceAdapter {
  const cartResult: CartResult = {
    dataSource: 'shopware_store_api',
    cart: {
      cartId: 'cart-1',
      items: [],
      subtotal: { amount: 119, currency: 'EUR' },
      total: { amount: 119, currency: 'EUR' },
      currency: 'EUR',
    },
  };

  return {
    searchProducts: async (): Promise<ProductSearchResult> => ({
      dataSource: 'shopware_store_api',
      products: [],
    }),
    getProductDetails: async (): Promise<ProductDetailsResult> => {
      throw new Error('Unexpected product details call');
    },
    createCart: async (): Promise<CartResult> => cartResult,
    updateCart: async (): Promise<CartResult> => cartResult,
    getCartSummary: async (): Promise<CartResult> => cartResult,
    prepareCheckoutHandoff: async (): Promise<CheckoutHandoffResult> => ({
      summary: cartResult.cart,
      continueUrl: 'https://shop.example.test/ucp/embedded/checkout/checkout-1',
      checkoutId: 'checkout-1',
    }),
    completeCheckout: async (): Promise<CompletedCheckoutResult> => ({
      summary: cartResult.cart,
      orderId: 'order-1',
      status: 'completed',
    }),
  };
}

function createHarness(adapter: CommerceAdapter = createAdapter()) {
  const sessionStore = new InMemorySessionStore();
  sessionStore.createSession({
    agentSessionId: 'session-1',
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    channel: 'a2a',
    customerContext: {},
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
  });
  sessionStore.setCommerceContext('session-1', {
    shopwareSalesChannelId: 'sales-channel-1',
    shopwareContextToken: 'secret-context-token',
  });

  return {
    harness: new HarnessCore({
      config: createConfig(),
      adapter,
      auditLogger: new InMemoryAuditLogger(),
      handoffStore: new InMemoryHandoffStore({
        now: () => new Date('2026-06-30T12:00:00.000Z'),
      }),
      sessionStore,
      checkoutHandoffMode: 'adapter',
      now: () => new Date('2026-06-30T12:00:00.000Z'),
    }),
  };
}

function createBuyer() {
  return { email: 'buyer@example.test', firstName: 'Ada', lastName: 'Buyer' };
}

function createFulfillment() {
  return {
    type: 'shipping' as const,
    shippingAddress: {
      street: 'Test Street 1',
      zipcode: '12345',
      city: 'Berlin',
      countryCode: 'DE',
    },
  };
}

describe('HarnessCore pending checkout terms', () => {
  test('exposes the real checkout terms after a handoff is prepared', async () => {
    const { harness } = createHarness();

    await harness.prepareCheckoutHandoff({ agentSessionId: 'session-1', cartId: 'cart-1' });

    expect(harness.peekPendingCheckoutTerms('session-1')).toEqual({
      checkoutId: 'checkout-1',
      total: { amount: 119, currency: 'EUR' },
    });
  });

  test('clears the pending terms once the checkout actually completes', async () => {
    const { harness } = createHarness();

    await harness.prepareCheckoutHandoff({ agentSessionId: 'session-1', cartId: 'cart-1' });
    await harness.completeCheckout({
      agentSessionId: 'session-1',
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    expect(harness.peekPendingCheckoutTerms('session-1')).toBeUndefined();
  });

  test('does not repeat-consume the pending terms — it is a peek, not a take', async () => {
    const { harness } = createHarness();

    await harness.prepareCheckoutHandoff({ agentSessionId: 'session-1', cartId: 'cart-1' });

    expect(harness.peekPendingCheckoutTerms('session-1')).toBeDefined();
    expect(harness.peekPendingCheckoutTerms('session-1')).toBeDefined();
  });
});
