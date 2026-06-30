import { describe, expect, test } from 'bun:test';

import type { AgentHarnessConfig } from '../../src/contracts/config.js';
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
    const registry = createExecutableToolRegistry(createConfig(), {
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
      updateCart: async () => ({ status: 'blocked', policyDecision: createPolicyDecision() }),
    });
    const searchProducts = registry.find((tool) => tool.name === 'searchProducts');

    const result = await searchProducts?.execute(
      { query: 'jacket', limit: 2 },
      { agentSessionId: 'session-1' },
    );

    expect(registry.map((tool) => tool.name)).toEqual(['searchProducts', 'createCart']);
    expect(searchProducts?.description).toContain('trusted merchant product data');
    expect(searchProducts?.schema.safeParse({ query: 'jacket', limit: 2 }).success).toBe(true);
    expect(calls).toEqual([{ agentSessionId: 'session-1', query: 'jacket', limit: 2 }]);
    expect(result).toEqual({ status: 'ok', value: { products: [] } });
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
