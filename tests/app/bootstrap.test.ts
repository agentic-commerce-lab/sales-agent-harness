import { expect, test } from 'bun:test';

import { createRunnableSalesAgentHarnessApp } from '../../src/app/bootstrap.js';
import type { AgentHarnessConfig } from '../../src/contracts/config.js';

const cartFetch = Object.assign(
  async () =>
    new Response(
      JSON.stringify({
        token: 'cart',
        lineItems: [],
        price: {
          positionPrice: 0,
          totalPrice: 0,
          rawTotal: 0,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  {
    preconnect: () => {},
  },
) satisfies typeof fetch;

test('createRunnableSalesAgentHarnessApp uses the Shopware environment URL for checkout handoffs', async () => {
  const app = createRunnableSalesAgentHarnessApp({
    agentConfig: createConfig(),
    environment: {
      agentConfigPath: 'config/agents/demo-sales-agent.json',
      host: '127.0.0.1',
      port: 3000,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'shopware',
      runtime: {
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      shopware: {
        baseUrl: 'http://host.docker.internal',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
      },
    },
    fetchImplementation: cartFetch,
  });
  const session = app.createSession({
    channel: 'customer_ui',
    shopwareContextToken: 'secret-context-token',
  });

  const handoff = await app.commerceCustomerApi.handle({
    capability: 'prepareCheckoutHandoff',
    agentSessionId: session.agentSessionId,
    cartId: 'cart',
  });

  if (handoff.status !== 'ok' || !handoff.value || !('continueUrl' in handoff.value)) {
    throw new Error('Expected checkout handoff');
  }

  expect(handoff.value.continueUrl).toStartWith(
    'http://host.docker.internal/agent-checkout?h=handoff_',
  );
});

function createConfig(): AgentHarnessConfig {
  return {
    agentId: 'agent-1',
    merchantId: 'merchant-1',
    enabledCapabilities: ['prepareCheckoutHandoff'],
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
      allowedChannels: ['customer_ui'],
      blockedCategories: [],
      blockedProducts: [],
      maxCartValue: { amount: 1000, currency: 'EUR' },
      maxItemQuantity: 5,
      allowCheckoutHandoff: true,
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
