import { describe, expect, test } from 'bun:test';

import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import { evaluatePolicy } from '../../src/policy/evaluate-policy.js';

function createConfig(): AgentHarnessConfig {
  return {
    agentId: 'demo-sales-agent',
    merchantId: 'demo-shopware-merchant',
    enabledCapabilities: ['searchProducts', 'createCart', 'prepareCheckoutHandoff'],
    disabledCapabilities: ['quotes', 'negotiation', 'payments', 'orderCreation'],
    policies: {
      allowedChannels: ['customer_ui', 'a2a'],
      blockedCategories: ['restricted'],
      blockedProducts: ['blocked-product-id'],
      maxCartValue: { amount: 1000, currency: 'EUR' },
      maxItemQuantity: 5,
      allowCheckoutHandoff: true,
      allowCheckoutCompletion: false,
      requireHumanApprovalForCheckout: false,
      unsupportedRegions: ['US-CA'],
      confidentialFields: ['shopwareContextToken'],
    },
    shopware: {
      salesChannelId: 'sales-channel-1',
      storefrontBaseUrl: 'https://shop.example.test',
    },
  };
}

function createContext() {
  return {
    agentSessionId: 'session-1',
    channel: 'customer_ui' as const,
    requestedAt: new Date('2026-06-30T12:00:00.000Z'),
  };
}

describe('evaluatePolicy capability checks', () => {
  test('allows enabled capabilities on allowed channels', () => {
    const decision = evaluatePolicy({
      config: createConfig(),
      context: createContext(),
      capability: 'searchProducts',
    });

    expect(decision.status).toBe('allow');
    expect(decision.reason).toBe('capability_enabled');
    expect(decision.context.merchantId).toBe('demo-shopware-merchant');
  });

  test('blocks disabled capabilities before commerce execution', () => {
    const decision = evaluatePolicy({
      config: createConfig(),
      context: createContext(),
      capability: 'getProductDetails',
    });

    expect(decision.status).toBe('block');
    expect(decision.reason).toBe('capability_disabled');
  });

  test('blocks restricted products and categories', () => {
    const config = createConfig();
    const restrictedProductDecision = evaluatePolicy({
      config,
      context: createContext(),
      capability: 'createCart',
      product: { productId: 'blocked-product-id', categories: [] },
    });
    const restrictedCategoryDecision = evaluatePolicy({
      config,
      context: createContext(),
      capability: 'createCart',
      product: { productId: 'allowed-product-id', categories: ['restricted'] },
    });

    expect(restrictedProductDecision.reason).toBe('blocked_product');
    expect(restrictedCategoryDecision.reason).toBe('blocked_category');
  });
});

describe('evaluatePolicy commercial safety checks', () => {
  test('blocks unsupported regions and commercial limits', () => {
    const regionDecision = evaluatePolicy({
      config: createConfig(),
      context: createContext(),
      capability: 'createCart',
      customerRegion: 'US-CA',
    });
    const quantityDecision = evaluatePolicy({
      config: createConfig(),
      context: createContext(),
      capability: 'createCart',
      cart: { totalAmount: 100, currency: 'EUR', maxItemQuantity: 6 },
    });
    const valueDecision = evaluatePolicy({
      config: createConfig(),
      context: createContext(),
      capability: 'createCart',
      cart: { totalAmount: 1001, currency: 'EUR', maxItemQuantity: 1 },
    });

    expect(regionDecision.reason).toBe('unsupported_region');
    expect(quantityDecision.reason).toBe('quantity_limit_exceeded');
    expect(valueDecision.reason).toBe('cart_value_limit_exceeded');
  });

  test('escalates checkout handoff when human approval is required', () => {
    const config = {
      ...createConfig(),
      policies: { ...createConfig().policies, requireHumanApprovalForCheckout: true },
    };

    const decision = evaluatePolicy({
      config,
      context: createContext(),
      capability: 'prepareCheckoutHandoff',
    });

    expect(decision.status).toBe('escalate');
    expect(decision.reason).toBe('human_approval_required');
  });

  test('blocks MVP-forbidden binding actions', () => {
    const decision = evaluatePolicy({
      config: createConfig(),
      context: createContext(),
      capability: 'executePayment',
    });

    expect(decision.status).toBe('block');
    expect(decision.reason).toBe('mvp_forbidden_action');
  });
});
