import { describe, expect, test } from 'bun:test';

import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import { createToolRegistry } from '../../src/harness/tool-registry.js';

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
