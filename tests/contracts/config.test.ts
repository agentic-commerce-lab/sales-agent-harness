import { describe, expect, test } from 'bun:test';

import { parseAgentHarnessConfig } from '../../src/config/load-agent-config.js';

function createValidConfig() {
  return {
    agentId: 'demo-sales-agent',
    merchantId: 'demo-shopware-merchant',
    enabledCapabilities: [
      'searchProducts',
      'getProductDetails',
      'createCart',
      'updateCart',
      'getCartSummary',
      'prepareCheckoutHandoff',
    ],
    disabledCapabilities: [
      'quotes',
      'negotiation',
      'payments',
      'orderCreation',
      'bindingQuotes',
      'customDiscounts',
      'customerAccountMutation',
    ],
    policies: {
      allowedChannels: ['customer_ui', 'a2a'],
      blockedCategories: ['restricted'],
      blockedProducts: ['blocked-product-id'],
      maxCartValue: {
        amount: 1000,
        currency: 'EUR',
      },
      maxItemQuantity: 5,
      allowCheckoutHandoff: true,
      allowCheckoutCompletion: false,
      requireHumanApprovalForCheckout: false,
      unsupportedRegions: ['US-CA'],
      confidentialFields: ['margin', 'supplierCost', 'shopwareContextToken'],
    },
    shopware: {
      salesChannelId: 'sales-channel-1',
      storefrontBaseUrl: 'https://shop.example.test',
    },
  };
}

describe('parseAgentHarnessConfig', () => {
  test('accepts a demo merchant config with only MVP commerce capabilities enabled', () => {
    const config = parseAgentHarnessConfig(createValidConfig());

    expect(config.agentId).toBe('demo-sales-agent');
    expect(config.enabledCapabilities).toContain('prepareCheckoutHandoff');
    expect(config.disabledCapabilities).toContain('payments');
    expect(config.policies.allowedChannels).toEqual(['customer_ui', 'a2a']);
    expect(config.policies.maxCartValue.amount).toBe(1000);
    expect(config.policies.allowCheckoutCompletion).toBe(false);
  });

  test('defaults automated checkout completion to disabled for older configs', () => {
    const config = createValidConfig();
    const policies = Object.fromEntries(
      Object.entries(config.policies).filter(([key]) => key !== 'allowCheckoutCompletion'),
    );

    expect(parseAgentHarnessConfig({ ...config, policies }).policies.allowCheckoutCompletion).toBe(
      false,
    );
  });

  test('rejects unknown enabled capabilities', () => {
    const invalidConfig = createValidConfig();

    expect(() =>
      parseAgentHarnessConfig({
        ...invalidConfig,
        enabledCapabilities: ['placeOrder'],
      }),
    ).toThrow('Invalid agent harness config');
  });

  test('rejects invalid channels', () => {
    const invalidConfig = createValidConfig();

    expect(() =>
      parseAgentHarnessConfig({
        ...invalidConfig,
        policies: {
          ...invalidConfig.policies,
          allowedChannels: ['email'],
        },
      }),
    ).toThrow('Invalid agent harness config');
  });
});
