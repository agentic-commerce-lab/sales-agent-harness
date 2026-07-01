import { describe, expect, test } from 'bun:test';

import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import type { HarnessToolExecutor } from '../../src/harness/executable-tool-registry.js';
import {
  createExecutableToolRegistry,
  createToolRegistry,
} from '../../src/harness/tool-registry.js';

describe('createToolRegistry', () => {
  test('registers only enabled capabilities', () => {
    const config: AgentHarnessConfig = {
      agentId: 'agent-1',
      merchantId: 'merchant-1',
      enabledCapabilities: ['searchProducts', 'createCart'],
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
        confidentialFields: [],
      },
      shopware: {
        salesChannelId: 'sales-channel-1',
        storefrontBaseUrl: 'https://shop.example.test',
      },
    };

    const registry = createToolRegistry(config);

    expect(registry.map((tool) => tool.name)).toEqual(['searchProducts', 'createCart']);
    expect(registry.some((tool) => tool.name === 'prepareCheckoutHandoff')).toBe(false);
  });
});

describe('createExecutableToolRegistry', () => {
  test('creates executable tools that delegate to harness methods with session context', async () => {
    const calls: unknown[] = [];
    const config = {
      ...createConfig(),
      enabledCapabilities: ['searchProducts', 'createCart', 'completeCheckout'],
      policies: { ...createConfig().policies, allowCheckoutCompletion: true },
    } satisfies AgentHarnessConfig;
    const registry = createExecutableToolRegistry(config, createHarnessExecutor(calls));
    const searchProducts = registry.find((tool) => tool.name === 'searchProducts');
    const completeCheckout = registry.find((tool) => tool.name === 'completeCheckout');

    const result = await searchProducts?.execute(
      { query: 'jacket', limit: 2 },
      { agentSessionId: 'session-1' },
    );
    const completed = await completeCheckout?.execute(
      {
        checkoutId: 'checkout-1',
        explicitBuyerConfirmation: true,
        buyer: createBuyer(),
        fulfillment: createFulfillment(),
      },
      { agentSessionId: 'session-1' },
    );

    expect(registry.map((tool) => tool.name)).toEqual([
      'searchProducts',
      'createCart',
      'completeCheckout',
    ]);
    expect(searchProducts?.description).toContain('trusted merchant product data');
    expect(searchProducts?.schema.safeParse({ query: 'jacket', limit: 2 }).success).toBe(true);
    expect(
      completeCheckout?.schema.safeParse({
        checkoutId: 'checkout-1',
        explicitBuyerConfirmation: false,
        buyer: createBuyer(),
        fulfillment: createFulfillment(),
      }).success,
    ).toBe(false);
    expect(
      completeCheckout?.schema.safeParse({
        checkoutId: 'checkout-1',
        explicitBuyerConfirmation: true,
      }).success,
    ).toBe(false);
    expect(calls).toEqual([{ agentSessionId: 'session-1', query: 'jacket', limit: 2 }]);
    expect(result).toEqual({ status: 'ok', value: { products: [] } });
    expect(completed).toEqual({
      status: 'ok',
      value: { status: 'completed', summary: { cartId: 'checkout-1' }, orderId: 'order-1' },
    });
  });

  test('requires checkout shipping countries as ISO alpha-2 codes', () => {
    const registry = createExecutableToolRegistry(
      createCheckoutCompletionConfig(),
      createHarnessExecutor([]),
    );
    const completeCheckout = registry.find((tool) => tool.name === 'completeCheckout');

    expect(
      completeCheckout?.schema.safeParse(createCheckoutInput({ countryCode: 'germany' })).success,
    ).toBe(false);

    const lowerCaseCountryCodeResult = completeCheckout?.schema.safeParse(
      createCheckoutInput({ countryCode: 'de' }),
    );

    expect(lowerCaseCountryCodeResult?.success).toBe(true);
    expect(JSON.stringify(lowerCaseCountryCodeResult)).toContain('"countryCode":"DE"');
  });
});

function createConfig(): AgentHarnessConfig {
  return {
    agentId: 'agent-1',
    merchantId: 'merchant-1',
    enabledCapabilities: ['searchProducts', 'createCart'],
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
      confidentialFields: [],
    },
    shopware: {
      salesChannelId: 'sales-channel-1',
      storefrontBaseUrl: 'https://shop.example.test',
    },
  };
}

function createCheckoutCompletionConfig(): AgentHarnessConfig {
  return {
    ...createConfig(),
    enabledCapabilities: ['completeCheckout'],
    policies: { ...createConfig().policies, allowCheckoutCompletion: true },
  };
}

function createHarnessExecutor(calls: unknown[]): HarnessToolExecutor {
  return {
    searchProducts: async (input) => {
      calls.push(input);
      return { status: 'ok', value: { products: [] } };
    },
    createCart: async () => ({ status: 'blocked', policyDecision: createPolicyDecision() }),
    getProductDetails: async () => ({
      status: 'blocked',
      policyDecision: createPolicyDecision(),
    }),
    getCartSummary: async () => ({ status: 'blocked', policyDecision: createPolicyDecision() }),
    prepareCheckoutHandoff: async () => ({
      status: 'blocked',
      policyDecision: createPolicyDecision(),
    }),
    completeCheckout: async () => ({
      status: 'ok',
      value: { status: 'completed', summary: { cartId: 'checkout-1' }, orderId: 'order-1' },
    }),
    updateCart: async () => ({ status: 'blocked', policyDecision: createPolicyDecision() }),
  };
}

function createBuyer() {
  return {
    email: 'buyer@example.test',
    firstName: 'Ada',
    lastName: 'Buyer',
    phoneNumber: '+49123456789',
  };
}

function createFulfillment() {
  return {
    type: 'shipping',
    shippingAddress: {
      street: 'Test Street 1',
      zipcode: '12345',
      city: 'Berlin',
      countryCode: 'DE',
    },
  };
}

function createCheckoutInput(options: { readonly countryCode: string }) {
  return {
    checkoutId: 'checkout-1',
    explicitBuyerConfirmation: true,
    buyer: createBuyer(),
    fulfillment: {
      ...createFulfillment(),
      shippingAddress: {
        ...createFulfillment().shippingAddress,
        countryCode: options.countryCode,
      },
    },
  };
}

function createPolicyDecision() {
  return {
    status: 'block' as const,
    reason: 'capability_disabled' as const,
    message: 'Capability disabled.',
    context: {
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      agentId: 'agent-1',
      channel: 'a2a' as const,
      capability: 'searchProducts' as const,
      requestedAt: new Date('2026-06-30T12:00:00.000Z'),
    },
  };
}
