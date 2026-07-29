import { expect, test } from 'bun:test';
import { z } from 'zod';
import { a2aProtocolVersion } from '../../src/app/a2a-constants.js';
import { createSalesAgentHttpHandler, type SalesAgentHttpApp } from '../../src/app/http-handler.js';
import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import type { PublicAgentSession } from '../../src/contracts/session.js';

test('createSalesAgentHttpHandler creates sessions, handles chat, and returns JSON responses', async () => {
  const calls: unknown[] = [];
  const handler = createSalesAgentHttpHandler({
    app: createSessionChatApp(calls),
  });

  const sessionResponse = await handler.handle(
    jsonRequest('/sessions', {
      channel: 'customer_ui',
      customerContext: { region: 'DE' },
    }),
  );
  const chatResponse = await handler.handle(
    jsonRequest('/chat', {
      agentSessionId: 'session-1',
      message: 'Find jackets',
    }),
  );

  expect(sessionResponse.status).toBe(201);
  expect(await sessionResponse.json()).toEqual({
    agentSessionId: 'session-1',
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    channel: 'customer_ui',
    customerContext: { region: 'DE' },
    createdAt: '2026-06-30T10:00:00.000Z',
  });
  expect(await chatResponse.json()).toEqual({ message: 'Hello', toolCalls: [] });
  expect(calls).toContainEqual({
    route: 'session',
    input: { channel: 'customer_ui', customerContext: { region: 'DE' } },
  });
});

test('createSalesAgentHttpHandler routes commerce and handoff validation requests', async () => {
  const handler = createSalesAgentHttpHandler({
    app: createCommerceRoutingApp(),
  });

  const customer = await handler.handle(
    jsonRequest('/commerce/customer', {
      capability: 'searchProducts',
      agentSessionId: 'session-1',
      query: 'jacket',
    }),
  );
  const a2a = await handler.handle(
    jsonRequest('/commerce/a2a', {
      capability: 'getCartSummary',
      agentSessionId: 'session-1',
      cartId: 'cart-1',
    }),
  );
  const handoff = await handler.handle(jsonRequest('/handoff/validate', { handoffId: 'h-1' }));

  expect(await customer.json()).toEqual({
    status: 'ok',
    value: {
      routed: 'customer',
      input: { capability: 'searchProducts', agentSessionId: 'session-1', query: 'jacket' },
    },
  });
  expect(await a2a.json()).toEqual({
    status: 'ok',
    value: {
      routed: 'a2a',
      input: { capability: 'getCartSummary', agentSessionId: 'session-1', cartId: 'cart-1' },
    },
  });
  expect(await handoff.json()).toEqual({
    status: 'ok',
    handoffId: 'h-1',
    summary: createCartSummary(),
  });
});

test('createSalesAgentHttpHandler exposes A2A discovery and message send endpoints', async () => {
  const calls: unknown[] = [];
  const handler = createSalesAgentHttpHandler({
    app: createSessionChatApp(calls),
  });

  const cardResponse = await handler.handle(
    new Request('https://harness.example.test/.well-known/agent-card.json'),
  );
  const sendResponse = await handler.handle(
    a2aRequest('/message:send', {
      message: {
        messageId: 'msg-1',
        role: 'ROLE_USER',
        parts: [{ text: 'Find waterproof jackets' }],
        metadata: { agentSessionId: 'session-1' },
      },
    }),
  );

  expect(cardResponse.headers.get('content-type')).toBe('application/a2a+json');
  expect(await cardResponse.json()).toEqual(createExpectedAgentCard());
  expect(sendResponse.headers.get('content-type')).toBe('application/a2a+json');
  expect(await sendResponse.json()).toEqual(createExpectedA2aTask());
  expect(calls).toContainEqual({
    route: 'chat',
    input: { agentSessionId: 'session-1', message: 'Find waterproof jackets' },
  });
});

test('createSalesAgentHttpHandler exposes configured agent profile in the A2A card', async () => {
  const handler = createSalesAgentHttpHandler({
    app: createSessionChatApp([]),
    agentConfig: {
      ...createHttpAgentConfig(),
      agentProfile: {
        displayName: 'Demo Store Concierge',
        description: 'Finds products, prepares carts, and completes checkout when enabled.',
        serviceSummary: 'Demo store catalog, cart, and checkout support.',
        supportedLanguages: ['en', 'de'],
        contactUrl: 'https://shop.example.test/contact',
        examples: ['Find waterproof jackets', 'Complete checkout for checkout-1'],
      },
    },
  });

  const response = await handler.handle(
    new Request('https://harness.example.test/.well-known/agent-card.json'),
  );
  const card = profileAgentCardSchema.parse(await response.json());

  expect(card.name).toBe('Demo Store Concierge');
  expect(card.description).toBe(
    'Finds products, prepares carts, and completes checkout when enabled.',
  );
  expect(card.skills[0].description).toBe('Demo store catalog, cart, and checkout support.');
  expect(card.skills[0].examples).toEqual([
    'Find waterproof jackets',
    'Complete checkout for checkout-1',
  ]);
  expect(card.metadata).toEqual({
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    supportedLanguages: ['en', 'de'],
    contactUrl: 'https://shop.example.test/contact',
  });
});

test('createSalesAgentHttpHandler requires A2A-Version on message send requests', async () => {
  const handler = createSalesAgentHttpHandler({
    app: createSessionChatApp([]),
  });

  const response = await handler.handle(
    a2aRequest(
      '/message:send',
      {
        message: {
          messageId: 'msg-1',
          role: 'ROLE_USER',
          parts: [{ text: 'Find waterproof jackets' }],
          metadata: { agentSessionId: 'session-1' },
        },
      },
      { includeVersion: false },
    ),
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: `A2A-Version header must be ${a2aProtocolVersion}`,
  });
});

test('createSalesAgentHttpHandler does not expose legacy A2A message aliases', async () => {
  const handler = createSalesAgentHttpHandler({
    app: createSessionChatApp([]),
  });

  const response = await handler.handle(
    jsonRequest('/a2a/messages', {
      agentSessionId: 'session-1',
      message: 'Find jackets',
    }),
  );

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Not found' });
});

test('createSalesAgentHttpHandler serves the example customer UI', async () => {
  const handler = createSalesAgentHttpHandler({
    app: createCommerceRoutingApp(),
  });

  const response = await handler.handle(
    new Request('https://harness.example.test/examples/customer-ui'),
  );
  const html = await response.text();

  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(html).toContain('Sales Agent Harness Demo');
  expect(html).toContain('/sessions');
  expect(html).toContain('/chat');
  expect(html).not.toContain('Shopware context token');
});

test('createSalesAgentHttpHandler serves a cacheable UCP platform profile when configured', async () => {
  const handler = createSalesAgentHttpHandler({
    app: createCommerceRoutingApp(),
    ucpPlatformProfile: {
      ucp: { version: '2026-04-08' },
      signing_keys: [{ kid: 'platform-key', kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }],
    },
  });

  const response = await handler.handle(
    new Request('https://harness.example.test/.well-known/ucp'),
  );

  expect(response.headers.get('content-type')).toBe('application/json');
  expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  expect(await response.json()).toEqual({
    ucp: { version: '2026-04-08' },
    signing_keys: [{ kid: 'platform-key', kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }],
  });
});

function createSessionChatApp(calls: unknown[]): SalesAgentHttpApp {
  return {
    createSession: (input): PublicAgentSession => {
      calls.push({ route: 'session', input });

      return {
        agentSessionId: 'session-1',
        merchantId: 'merchant-1',
        agentId: 'agent-1',
        channel: input.channel,
        customerContext: input.customerContext ?? {},
        createdAt: new Date('2026-06-30T10:00:00.000Z'),
      };
    },
    chat: async (input) => {
      calls.push({ route: 'chat', input });

      return { message: 'Hello', toolCalls: [] };
    },
    commerceCustomerApi: {
      handle: async (input) => ({ status: 'ok', value: input }),
    },
    commerceA2aApi: {
      handle: async (input) => ({ status: 'ok', value: input }),
    },
    validateCheckoutHandoff: () => ({ status: 'not_found' as const }),
    recordAp2Mandate: () => {},
    recordPaymentCapability: () => {},
  };
}

const profileAgentCardSchema = z.object({
  name: z.string(),
  description: z.string(),
  skills: z.tuple([
    z.object({
      description: z.string(),
      examples: z.array(z.string()),
    }),
  ]),
  metadata: z.unknown(),
});

function createCommerceRoutingApp(): SalesAgentHttpApp {
  return {
    createSession: () => {
      throw new Error('Unexpected session creation');
    },
    chat: async () => {
      throw new Error('Unexpected chat request');
    },
    commerceCustomerApi: {
      handle: async (input) => ({ status: 'ok', value: { routed: 'customer', input } }),
    },
    commerceA2aApi: {
      handle: async (input) => ({ status: 'ok', value: { routed: 'a2a', input } }),
    },
    validateCheckoutHandoff: ({ handoffId }) => ({
      status: 'ok' as const,
      handoffId,
      summary: createCartSummary(),
    }),
    recordAp2Mandate: () => {},
    recordPaymentCapability: () => {},
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

function createExpectedAgentCard() {
  return {
    name: 'Sales Agent Harness',
    description:
      'Merchant-controlled seller agent for safe product search, cart preparation, checkout handoff, and policy-gated checkout completion.',
    url: 'https://harness.example.test',
    version: '0.1.0',
    protocolVersion: a2aProtocolVersion,
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    supportedInterfaces: [
      {
        url: 'https://harness.example.test',
        transport: 'JSONRPC',
        protocolVersion: a2aProtocolVersion,
      },
    ],
    securitySchemes: {},
    security: [],
    skills: [
      {
        id: 'seller-agent-commerce',
        name: 'Seller Agent Commerce',
        description:
          'Search products, answer commerce questions, prepare carts, create checkout handoffs, and complete checkout when merchant policy allows it.',
        tags: ['commerce', 'shopware', 'cart', 'checkout'],
        examples: ['Find waterproof jackets', 'Prepare a cart with two of product product-1'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
      },
    ],
  };
}

function createExpectedA2aTask() {
  return {
    id: 'msg-1',
    contextId: 'session-1',
    status: {
      state: 'completed',
      message: {
        messageId: 'msg-1-response',
        role: 'agent',
        parts: [{ kind: 'text', text: 'Hello' }],
      },
    },
    artifacts: [
      {
        artifactId: 'msg-1-artifact',
        name: 'Seller agent response',
        parts: [{ kind: 'text', text: 'Hello' }],
        metadata: { toolCalls: [] },
      },
    ],
  };
}

function createHttpAgentConfig(): AgentHarnessConfig {
  return {
    agentId: 'agent-1',
    merchantId: 'merchant-1',
    enabledCapabilities: ['searchProducts', 'prepareCheckoutHandoff'],
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

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://harness.example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function a2aRequest(
  path: string,
  body: unknown,
  options: { readonly includeVersion?: boolean } = {},
): Request {
  const headers = new Headers({ 'content-type': 'application/a2a+json' });

  if (options.includeVersion ?? true) {
    headers.set('A2A-Version', a2aProtocolVersion);
  }

  return new Request(`https://harness.example.test${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('GET / returns a 200 discovery pointer instead of 404', async () => {
  const handler = createSalesAgentHttpHandler({ app: createCommerceRoutingApp() });
  const rootResponse = await handler.handle(new Request('https://harness.example.test/'));
  expect(rootResponse.status).toBe(200);
  expect(await rootResponse.json()).toMatchObject({
    endpoints: {
      agentCard: '/.well-known/agent-card.json',
      commerceA2a: '/commerce/a2a',
      commerceCustomer: '/commerce/customer',
    },
  });
});
