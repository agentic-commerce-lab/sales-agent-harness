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

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://harness.example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
