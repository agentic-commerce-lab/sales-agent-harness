import { expect, test } from 'bun:test';
import { createSalesAgentHarnessApp } from '../../src/app/sales-agent-app.js';
import type { CommerceAdapter } from '../../src/contracts/commerce.js';
import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import type { AgentRuntime } from '../../src/runtime/agent-runtime.js';

test('createSalesAgentHarnessApp creates public sessions without exposing Shopware context tokens', () => {
  const createdRuntimeTools: string[][] = [];
  const ids = ['session-1', 'generated-shopware-context'];
  const app = createSalesAgentHarnessApp({
    config: createConfig(),
    adapter: createAdapter(),
    runtimeFactory: ({ tools }) => {
      createdRuntimeTools.push(toToolNames(tools));
      return createRuntime();
    },
    createId: () => ids.shift() ?? 'unexpected-id',
    now: () => new Date('2026-06-30T10:00:00.000Z'),
  });

  const session = app.createSession({
    channel: 'customer_ui',
    customerContext: { region: 'DE' },
  });

  expect(session).toEqual({
    agentSessionId: 'session-1',
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    channel: 'customer_ui',
    customerContext: { region: 'DE' },
    createdAt: new Date('2026-06-30T10:00:00.000Z'),
    expiresAt: new Date('2026-06-30T10:30:00.000Z'),
  });
  expect(app.sessionStore.getSession('session-1', 'merchant-1')?.commerceContext).toEqual({
    shopwareSalesChannelId: 'sales-channel-1',
    shopwareContextToken: 'generated-shopware-context',
  });
  expect(JSON.stringify(session)).not.toContain('generated-shopware-context');
  expect(createdRuntimeTools).toEqual([
    ['searchProducts', 'getProductDetails', 'createCart', 'prepareCheckoutHandoff'],
  ]);
  expect(app.auditLogger.events.map((event) => event.type)).toContain('session_created');
});

test('createSalesAgentHarnessApp accepts an existing server-side Shopware context token', () => {
  const app = createSalesAgentHarnessApp({
    config: createConfig(),
    adapter: createAdapter(),
    runtimeFactory: () => createRuntime(),
    createId: () => 'session-1',
    now: () => new Date('2026-06-30T10:00:00.000Z'),
  });

  app.createSession({
    channel: 'customer_ui',
    shopwareContextToken: 'secret-shopware-context',
  });

  expect(app.sessionStore.getSession('session-1', 'merchant-1')?.commerceContext).toEqual({
    shopwareSalesChannelId: 'sales-channel-1',
    shopwareContextToken: 'secret-shopware-context',
  });
});

test('createSalesAgentHarnessApp routes chat through the configured agent runtime and audits the exchange', async () => {
  const runtimeInputs: unknown[] = [];
  const app = createSalesAgentHarnessApp({
    config: createConfig(),
    adapter: createAdapter(),
    runtimeFactory: () => createRuntime(runtimeInputs),
    createId: () => 'session-1',
    now: () => new Date('2026-06-30T10:00:00.000Z'),
  });
  app.createSession({
    channel: 'a2a',
    shopwareContextToken: 'secret-shopware-context',
  });

  const response = await app.chat({
    agentSessionId: 'session-1',
    message: 'Find a jacket',
  });

  expect(runtimeInputs).toEqual([
    {
      agentSessionId: 'session-1',
      message: 'Find a jacket',
      messages: [{ role: 'user', content: 'Find a jacket' }],
    },
  ]);
  expect(response).toEqual({
    message: 'Runtime response',
    toolCalls: ['searchProducts'],
  });
  expect(app.auditLogger.events.map((event) => event.type)).toEqual([
    'session_created',
    'user_request',
    'agent_response',
  ]);
});

test('createSalesAgentHarnessApp passes session conversation history to the runtime', async () => {
  const runtimeInputs: unknown[] = [];
  const app = createSalesAgentHarnessApp({
    config: createConfig(),
    adapter: createAdapter(),
    runtimeFactory: () =>
      createRuntime(runtimeInputs, [
        { message: 'Created cart draft with ID: cart', toolCalls: ['createCart'] },
        { message: 'Prepared checkout handoff.', toolCalls: ['prepareCheckoutHandoff'] },
      ]),
    createId: () => 'session-1',
    now: () => new Date('2026-06-30T10:00:00.000Z'),
  });
  app.createSession({
    channel: 'a2a',
    shopwareContextToken: 'secret-shopware-context',
  });

  await app.chat({
    agentSessionId: 'session-1',
    message: 'Add product 3ac014f329884b57a2cce5a29f34779c to a cart.',
  });
  await app.chat({
    agentSessionId: 'session-1',
    message: 'Prepare checkout for that cart.',
  });

  expect(runtimeInputs).toEqual([
    {
      agentSessionId: 'session-1',
      message: 'Add product 3ac014f329884b57a2cce5a29f34779c to a cart.',
      messages: [
        {
          role: 'user',
          content: 'Add product 3ac014f329884b57a2cce5a29f34779c to a cart.',
        },
      ],
    },
    {
      agentSessionId: 'session-1',
      message: 'Prepare checkout for that cart.',
      messages: [
        {
          role: 'user',
          content: 'Add product 3ac014f329884b57a2cce5a29f34779c to a cart.',
        },
        {
          role: 'assistant',
          content: 'Created cart draft with ID: cart',
        },
        {
          role: 'user',
          content: 'Prepare checkout for that cart.',
        },
      ],
    },
  ]);
});

test('createSalesAgentHarnessApp validates checkout handoff tokens without leaking stored Shopware context', async () => {
  const adapter = createAdapter();
  const app = createSalesAgentHarnessApp({
    config: createConfig(),
    adapter,
    runtimeFactory: () => createRuntime(),
    createId: () => 'session-1',
    now: () => new Date('2026-06-30T10:00:00.000Z'),
  });
  app.createSession({
    channel: 'customer_ui',
    shopwareContextToken: 'secret-shopware-context',
  });

  const handoff = await app.commerceCustomerApi.handle({
    capability: 'prepareCheckoutHandoff',
    agentSessionId: 'session-1',
    cartId: 'cart-1',
  });
  if (handoff.status !== 'ok' || !handoff.value || !('continueUrl' in handoff.value)) {
    throw new Error('Expected checkout handoff response');
  }

  const handoffId = new URL(handoff.value.continueUrl).searchParams.get('h');

  const validation = app.validateCheckoutHandoff({ handoffId: handoffId ?? '' });

  expect(validation.status).toBe('ok');
  expect(JSON.stringify(validation)).not.toContain('secret-shopware-context');
  expect(validation.status === 'ok' ? validation.summary.cartId : '').toBe('cart-1');
});

function createConfig(): AgentHarnessConfig {
  return {
    agentId: 'agent-1',
    merchantId: 'merchant-1',
    enabledCapabilities: [
      'searchProducts',
      'getProductDetails',
      'createCart',
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

function createRuntime(
  inputs: unknown[] = [],
  responses: readonly { readonly message: string; readonly toolCalls: readonly string[] }[] = [],
): AgentRuntime {
  const queuedResponses = [...responses];

  return {
    respond: async (input) => {
      inputs.push(input);

      return (
        queuedResponses.shift() ?? {
          message: 'Runtime response',
          toolCalls: ['searchProducts'],
        }
      );
    },
  };
}

function createAdapter(): CommerceAdapter {
  return {
    searchProducts: async () => ({
      products: [],
      dataSource: 'shopware_store_api',
    }),
    getProductDetails: async () => ({
      product: {
        id: 'product-1',
        label: 'Jacket',
        categories: [],
        attributes: {},
        variants: [],
      },
      dataSource: 'shopware_store_api',
    }),
    createCart: async () => ({
      cart: createCartSummary(),
      dataSource: 'shopware_store_api',
    }),
    updateCart: async () => ({
      cart: createCartSummary(),
      dataSource: 'shopware_store_api',
    }),
    getCartSummary: async () => ({
      cart: createCartSummary(),
      dataSource: 'shopware_store_api',
    }),
    prepareCheckoutHandoff: async () => ({
      summary: createCartSummary(),
      continueUrl: 'https://shop.example.test/checkout',
    }),
  };
}

function createCartSummary() {
  return {
    cartId: 'cart-1',
    items: [],
    subtotal: { amount: 0, currency: 'EUR' },
    total: { amount: 0, currency: 'EUR' },
    currency: 'EUR',
  };
}

function toToolNames(tools: readonly { readonly name: string }[]): string[] {
  return tools.map((tool) => tool.name);
}
