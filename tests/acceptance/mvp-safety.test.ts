import { describe, expect, test } from 'bun:test';

import type { CommerceHarnessApi } from '../../src/api/harness-api.js';
import type {
  CartResult,
  CheckoutHandoffResult,
  CommerceAdapter,
  ProductDetailsResult,
  ProductSearchResult,
} from '../../src/contracts/commerce.js';
import type { AgentHarnessConfig, HarnessCapability } from '../../src/contracts/config.js';
import type { RestrictedCommerceAction } from '../../src/contracts/policy.js';
import { InMemoryHandoffStore } from '../../src/handoff/handoff-store.js';
import { HarnessCore } from '../../src/harness/harness-core.js';
import { createToolRegistry } from '../../src/harness/tool-registry.js';
import { InMemoryAuditLogger } from '../../src/observability/audit-log.js';
import { evaluatePolicy } from '../../src/policy/evaluate-policy.js';
import { InMemorySessionStore } from '../../src/session/session-store.js';

const mvpCapabilities: readonly HarnessCapability[] = [
  'searchProducts',
  'getProductDetails',
  'createCart',
  'updateCart',
  'getCartSummary',
  'prepareCheckoutHandoff',
];

const forbiddenActions: readonly RestrictedCommerceAction[] = [
  'placeOrder',
  'executePayment',
  'acceptLegalTerms',
  'createBindingQuote',
  'negotiateCustomDiscount',
  'modifyCustomerAccount',
];

describe('MVP safety acceptance data handling', () => {
  test('uses trusted commerce data and filters sensitive fields from responses', async () => {
    const { harness } = createHarness();

    const search = await harness.searchProducts({ agentSessionId: 'session-1', query: 'jacket' });
    const details = await harness.getProductDetails({
      agentSessionId: 'session-1',
      productId: 'product-1',
    });

    expect(search.value?.products[0]?.label).toBe('Trusted Jacket');
    expect(details.value?.product.attributes).toEqual({ color: 'blue' });
    expect(JSON.stringify({ search, details })).not.toContain('secret');
    expect(JSON.stringify({ search, details })).not.toContain('margin');
  });
});

describe('MVP safety acceptance policy controls', () => {
  test('omits disabled tools and blocks disabled capability calls before commerce execution', async () => {
    const config = createConfig([]);
    const { calls, harness } = createHarness({ config });

    expect(createToolRegistry(config)).toEqual([]);

    const responses = await Promise.all(
      mvpCapabilities.map((capability) => callHarness(harness, capability)),
    );

    for (const response of responses) {
      expect(response.status).toBe('blocked');
      expect(response.policyDecision.reason).toBe('capability_disabled');
    }

    expect(calls).toEqual([]);
  });
});

describe('MVP safety acceptance commerce flow', () => {
  test('enforces policy limits, forbidden MVP actions, cart flow, handoff, and audit trail', async () => {
    const { auditLogger, harness } = createHarness();

    const cart = await harness.createCart({
      agentSessionId: 'session-1',
      items: [{ productId: 'product-1', quantity: 1 }],
    });
    const updated = await harness.updateCart({
      agentSessionId: 'session-1',
      cartId: 'cart-1',
      items: [{ productId: 'product-1', quantity: 2 }],
    });
    const handoff = await harness.prepareCheckoutHandoff({
      agentSessionId: 'session-1',
      cartId: 'cart-1',
    });

    expect(cart.status).toBe('ok');
    expect(updated.value?.cart.items[0]?.quantity).toBe(2);
    expect(handoff.value?.continueUrl).toContain('h=handoff_');
    expect(JSON.stringify(handoff)).not.toContain('secret-context-token');
    expect(auditLogger.events.map((event) => event.type)).toContain('policy_decision');
    expect(auditLogger.events.map((event) => event.type)).toContain('shopware_call');
    expect(auditLogger.events.map((event) => event.type)).toContain('cart_change');
    expect(auditLogger.events.map((event) => event.type)).toContain('checkout_handoff');

    for (const action of forbiddenActions) {
      const decision = evaluatePolicy({
        config: createConfig(),
        context: createPolicyContext(),
        capability: action,
      });
      expect(decision.reason).toBe('mvp_forbidden_action');
    }
  });

  test('blocks unsupported or uncertain commerce requests instead of guessing', async () => {
    const config = createConfig(['createCart'], {
      blockedProducts: ['blocked-product'],
      maxItemQuantity: 1,
    });
    const { harness } = createHarness({ config });

    const quantity = await harness.createCart({
      agentSessionId: 'session-1',
      items: [{ productId: 'product-1', quantity: 2 }],
    });
    const blockedProduct = evaluatePolicy({
      config,
      context: createPolicyContext(),
      capability: 'createCart',
      product: { productId: 'blocked-product', categories: [] },
    });

    expect(quantity.status).toBe('blocked');
    expect(quantity.policyDecision.reason).toBe('quantity_limit_exceeded');
    expect(blockedProduct.status).toBe('block');
    expect(blockedProduct.reason).toBe('blocked_product');
  });
});

function createConfig(
  enabledCapabilities: readonly HarnessCapability[] = mvpCapabilities,
  policyOverrides: Partial<AgentHarnessConfig['policies']> = {},
): AgentHarnessConfig {
  return {
    agentId: 'agent-1',
    merchantId: 'merchant-1',
    enabledCapabilities,
    disabledCapabilities: ['quotes', 'negotiation', 'payments', 'orderCreation'],
    policies: {
      allowedChannels: ['a2a'],
      blockedCategories: [],
      blockedProducts: [],
      maxCartValue: { amount: 1000, currency: 'EUR' },
      maxItemQuantity: 5,
      allowCheckoutHandoff: true,
      allowCheckoutCompletion: false,
      requireHumanApprovalForCheckout: false,
      unsupportedRegions: [],
      confidentialFields: ['shopwareContextToken', 'margin'],
      ...policyOverrides,
    },
    shopware: {
      salesChannelId: 'sales-channel-1',
      storefrontBaseUrl: 'https://shop.example.test',
    },
  };
}

function createHarness(options: { readonly config?: AgentHarnessConfig } = {}) {
  const calls: string[] = [];
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

  const auditLogger = new InMemoryAuditLogger();
  const handoffStore = new InMemoryHandoffStore({
    now: () => new Date('2026-06-30T12:00:00.000Z'),
  });

  return {
    auditLogger,
    calls,
    harness: new HarnessCore({
      config: options.config ?? createConfig(),
      adapter: createAdapter(calls),
      auditLogger,
      handoffStore,
      sessionStore,
      now: () => new Date('2026-06-30T12:00:00.000Z'),
    }),
  };
}

function createAdapter(calls: string[]): CommerceAdapter {
  return {
    searchProducts: async (): Promise<ProductSearchResult> => {
      calls.push('searchProducts');
      return {
        dataSource: 'shopware_store_api',
        products: [{ id: 'product-1', label: 'Trusted Jacket', categories: [] }],
      };
    },
    getProductDetails: async (): Promise<ProductDetailsResult> => {
      calls.push('getProductDetails');
      return {
        dataSource: 'shopware_store_api',
        product: {
          id: 'product-1',
          label: 'Trusted Jacket',
          categories: [],
          attributes: { color: 'blue' },
          variants: [],
        },
      };
    },
    createCart: async (): Promise<CartResult> => createCartResult(calls, 1),
    updateCart: async (): Promise<CartResult> => createCartResult(calls, 2),
    getCartSummary: async (): Promise<CartResult> => createCartResult(calls, 2),
    prepareCheckoutHandoff: async (): Promise<CheckoutHandoffResult> => {
      throw new Error('Harness prepares checkout handoffs without adapter handoff execution');
    },
    completeCheckout: async () => {
      throw new Error('Automated checkout completion is not part of the safety fixture');
    },
  };
}

function createCartResult(calls: string[], quantity: number): CartResult {
  calls.push('cart');
  return {
    dataSource: 'shopware_store_api',
    cart: {
      cartId: 'cart-1',
      items: [
        {
          productId: 'product-1',
          label: 'Trusted Jacket',
          quantity,
          unitPrice: { amount: 119, currency: 'EUR' },
          totalPrice: { amount: 119 * quantity, currency: 'EUR' },
        },
      ],
      subtotal: { amount: 119 * quantity, currency: 'EUR' },
      total: { amount: 119 * quantity, currency: 'EUR' },
      currency: 'EUR',
    },
  };
}

async function callHarness(harness: CommerceHarnessApi, capability: HarnessCapability) {
  switch (capability) {
    case 'searchProducts':
      return harness.searchProducts({ capability, agentSessionId: 'session-1', query: 'jacket' });
    case 'getProductDetails':
      return harness.getProductDetails({
        capability,
        agentSessionId: 'session-1',
        productId: 'product-1',
      });
    case 'createCart':
      return harness.createCart({ capability, agentSessionId: 'session-1', items: [] });
    case 'updateCart':
      return harness.updateCart({
        capability,
        agentSessionId: 'session-1',
        cartId: 'cart-1',
        items: [],
      });
    case 'getCartSummary':
      return harness.getCartSummary({ capability, agentSessionId: 'session-1', cartId: 'cart-1' });
    case 'prepareCheckoutHandoff':
      return harness.prepareCheckoutHandoff({
        capability,
        agentSessionId: 'session-1',
        cartId: 'cart-1',
      });
    case 'completeCheckout':
      return harness.completeCheckout({
        capability,
        agentSessionId: 'session-1',
        checkoutId: 'checkout-1',
        buyer: {
          email: 'buyer@example.test',
          firstName: 'Ada',
          lastName: 'Buyer',
        },
        fulfillment: {
          type: 'shipping',
          shippingAddress: {
            street: 'Test Street 1',
            zipcode: '12345',
            city: 'Berlin',
            countryCode: 'DE',
          },
        },
      });
    default:
      return assertNever(capability);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported harness capability: ${String(value)}`);
}

function createPolicyContext() {
  return {
    agentSessionId: 'session-1',
    channel: 'a2a' as const,
    requestedAt: new Date('2026-06-30T12:00:00.000Z'),
  };
}
