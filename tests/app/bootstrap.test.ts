import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
} from '@langchain/langgraph-checkpoint';

import { createRunnableSalesAgentHarnessApp } from '../../src/app/bootstrap.js';
import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import type { DeepAgentFactoryParams } from '../../src/runtime/langgraph/langgraph-types.js';

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
      debugLogRequestBodies: false,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'shopware',
      storage: {
        provider: 'memory',
      },
      runtime: {
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      commerce: {
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

test('createRunnableSalesAgentHarnessApp can use Agentic Commerce UCP checkout handoff URLs', async () => {
  const app = createRunnableSalesAgentHarnessApp({
    agentConfig: createConfig(),
    environment: {
      agentConfigPath: 'config/agents/demo-sales-agent.json',
      host: '127.0.0.1',
      port: 3000,
      debugLogRequestBodies: false,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'ucp',
      storage: {
        provider: 'memory',
      },
      runtime: {
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      commerce: {
        baseUrl: 'https://shop.example.test',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
      },
    },
    fetchImplementation: ucpFetch,
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

  expect(handoff.value.continueUrl).toBe(
    'https://shop.example.test/ucp/embedded/checkout/checkout-1',
  );
  expect(JSON.stringify(handoff.value)).not.toContain('secret-context-token');
});

test('createRunnableSalesAgentHarnessApp can use SQLite app storage', () => {
  const sqlitePath = tempDatabasePath();
  const app = createRunnableSalesAgentHarnessApp({
    agentConfig: createConfig(),
    environment: {
      agentConfigPath: 'config/agents/demo-sales-agent.json',
      host: '127.0.0.1',
      port: 3000,
      debugLogRequestBodies: false,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'shopware',
      storage: {
        provider: 'sqlite',
        sqlitePath,
      },
      runtime: {
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      commerce: {
        baseUrl: 'https://shop.example.test',
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
  const reopenedApp = createRunnableSalesAgentHarnessApp({
    agentConfig: createConfig(),
    environment: {
      agentConfigPath: 'config/agents/demo-sales-agent.json',
      host: '127.0.0.1',
      port: 3000,
      debugLogRequestBodies: false,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'shopware',
      storage: {
        provider: 'sqlite',
        sqlitePath,
      },
      runtime: {
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      commerce: {
        baseUrl: 'https://shop.example.test',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
      },
    },
    fetchImplementation: cartFetch,
  });

  expect(
    reopenedApp.sessionStore.getSession(session.agentSessionId, 'merchant-1')?.commerceContext
      ?.shopwareContextToken,
  ).toBe('secret-context-token');
});

test('createRunnableSalesAgentHarnessApp wires LangGraph checkpointing to SQLite storage', () => {
  const sqlitePath = tempDatabasePath();
  const observed: { checkpointer?: DeepAgentFactoryParams['checkpointer'] } = {};

  createRunnableSalesAgentHarnessApp({
    agentConfig: createConfig(),
    environment: {
      agentConfigPath: 'config/agents/demo-sales-agent.json',
      host: '127.0.0.1',
      port: 3000,
      debugLogRequestBodies: false,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'shopware',
      storage: {
        provider: 'sqlite',
        sqlitePath,
      },
      runtime: {
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      commerce: {
        baseUrl: 'https://shop.example.test',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
      },
    },
    fetchImplementation: cartFetch,
    createDeepAgent: (params) => {
      observed.checkpointer = params.checkpointer;
      return {
        invoke: async () => ({ messages: [] }),
      };
    },
  });

  expect(observed.checkpointer).toBeDefined();
});

test('createRunnableSalesAgentHarnessApp preserves LangGraph checkpoints across SQLite app recreation', async () => {
  const sqlitePath = tempDatabasePath();
  const checkpoint = createCheckpoint('checkpoint-1');
  let restoredCheckpointId: string | undefined;
  const firstApp = createRunnableSalesAgentHarnessApp({
    agentConfig: createChatConfig(),
    environment: createSqliteEnvironment(sqlitePath),
    fetchImplementation: cartFetch,
    createDeepAgent: (params) => ({
      invoke: async (_input, options) => {
        const checkpointer = expectCheckpointSaver(params.checkpointer);

        await checkpointer.put(
          { configurable: { thread_id: options?.configurable.thread_id ?? 'session-1' } },
          checkpoint,
          createCheckpointMetadata(),
          {},
        );
        return { messages: [] };
      },
    }),
  });
  const session = firstApp.createSession({
    channel: 'customer_ui',
    shopwareContextToken: 'secret-context-token',
  });

  await firstApp.chat({ agentSessionId: session.agentSessionId, message: 'Remember this cart' });

  const secondApp = createRunnableSalesAgentHarnessApp({
    agentConfig: createChatConfig(),
    environment: createSqliteEnvironment(sqlitePath),
    fetchImplementation: cartFetch,
    createDeepAgent: (params) => ({
      invoke: async (_input, options) => {
        const checkpointer = expectCheckpointSaver(params.checkpointer);

        const tuple = await checkpointer.getTuple({
          configurable: { thread_id: options?.configurable.thread_id ?? 'session-1' },
        });
        restoredCheckpointId = tuple?.checkpoint.id;
        return { messages: [] };
      },
    }),
  });

  await secondApp.chat({ agentSessionId: session.agentSessionId, message: 'Resume' });

  expect(restoredCheckpointId).toBe('checkpoint-1');
});

const ucpFetch = Object.assign(
  async (url: string | URL | Request) => {
    const path = new URL(requestUrl(url)).pathname;
    if (path === '/.well-known/ucp') {
      return new Response(
        JSON.stringify({
          ucp: {
            services: {
              'dev.ucp.shopping': { endpoint: 'https://shop.example.test/ucp/v1' },
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (path === '/ucp/v1/carts/cart') {
      return new Response(JSON.stringify(createUcpCart()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (path === '/ucp/v1/checkout-sessions') {
      return new Response(
        JSON.stringify({
          ...createUcpCart(),
          id: 'checkout-1',
          continue_url: 'https://shop.example.test/ucp/embedded/checkout/checkout-1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
  },
  {
    preconnect: () => {},
  },
) satisfies typeof fetch;

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
      allowCheckoutCompletion: false,
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

function createChatConfig(): AgentHarnessConfig {
  return {
    ...createConfig(),
    enabledCapabilities: ['searchProducts'],
  };
}

function createSqliteEnvironment(sqlitePath: string) {
  return {
    agentConfigPath: 'config/agents/demo-sales-agent.json',
    host: '127.0.0.1',
    port: 3000,
    debugLogRequestBodies: false,
    runtimeProvider: 'deep_agents' as const,
    commerceAdapterProvider: 'shopware' as const,
    storage: {
      provider: 'sqlite' as const,
      sqlitePath,
    },
    runtime: {
      provider: 'openai' as const,
      apiKey: 'test-key',
      modelName: 'gpt-5-mini',
    },
    commerce: {
      baseUrl: 'https://shop.example.test',
      storeApiAccessKey: 'store-api-key',
      defaultSalesChannelId: 'sales-channel-1',
    },
  };
}

function createCheckpoint(id: string): Checkpoint {
  return {
    v: 4,
    id,
    ts: '2026-07-06T00:00:00.000Z',
    channel_values: { messages: ['remembered'] },
    channel_versions: { messages: 1 },
    versions_seen: {},
  };
}

function createCheckpointMetadata(): CheckpointMetadata {
  return {
    source: 'loop',
    step: 1,
    parents: {},
  };
}

function expectCheckpointSaver(
  checkpointer: DeepAgentFactoryParams['checkpointer'],
): BaseCheckpointSaver {
  if (!checkpointer || checkpointer === true) {
    throw new Error('Expected checkpoint saver');
  }

  return checkpointer;
}

function createUcpCart() {
  return {
    id: 'cart',
    currency: 'EUR',
    line_items: [],
    money_summary: {
      subtotal: { amount: 0, currency: 'EUR' },
      total: { amount: 0, currency: 'EUR' },
    },
  };
}

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

function tempDatabasePath(): string {
  return join(mkdtempSync(join(tmpdir(), 'sales-agent-harness-bootstrap-')), 'store.sqlite');
}
