import { expect, test } from 'bun:test';
import { createSalesAgentHttpHandler, type SalesAgentHttpApp } from '../../src/app/http-handler.js';
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
      shopwareContextToken: 'secret-shopware-context',
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
  expect(JSON.stringify(calls)).toContain('secret-shopware-context');
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
  expect(await response.json()).toEqual({ error: 'A2A-Version header must be 1.0' });
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
  };
}

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
      'Merchant-controlled seller agent for safe product search, cart preparation, and checkout handoff.',
    supportedInterfaces: [
      {
        url: 'https://harness.example.test',
        protocolBinding: 'HTTP+JSON',
        protocolVersion: '1.0',
      },
    ],
    version: '0.1.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      {
        id: 'seller-agent-commerce',
        name: 'Seller Agent Commerce',
        description:
          'Search products, answer commerce questions, prepare carts, and create non-binding checkout handoffs.',
        tags: ['commerce', 'shopware', 'cart', 'checkout-handoff'],
        examples: ['Find waterproof jackets', 'Prepare a cart with two of product product-1'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
      },
    ],
  };
}

function createExpectedA2aTask() {
  return {
    task: {
      id: 'msg-1',
      contextId: 'session-1',
      status: {
        state: 'TASK_STATE_COMPLETED',
        message: {
          messageId: 'msg-1-response',
          role: 'ROLE_AGENT',
          parts: [{ text: 'Hello' }],
        },
      },
      artifacts: [
        {
          artifactId: 'msg-1-artifact',
          name: 'Seller agent response',
          parts: [{ text: 'Hello' }],
          metadata: { toolCalls: [] },
        },
      ],
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
    headers.set('A2A-Version', '1.0');
  }

  return new Request(`https://harness.example.test${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
