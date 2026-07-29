import { expect, test } from 'bun:test';
import { z } from 'zod';
import type { A2aHttpApp } from '../../src/app/a2a-message.js';
import { handleA2aSendMessage } from '../../src/app/a2a-message.js';
import type { Ap2PaymentMandate } from '../../src/contracts/commerce.js';
import type { AgentRuntimeResponse } from '../../src/runtime/agent-runtime.js';

const taskSchema = z.object({
  artifacts: z.array(
    z.object({
      metadata: z.object({
        ap2MerchantAuthorization: z.string().optional(),
        checkoutTerms: z
          .object({
            checkoutId: z.string(),
            total: z.object({ amount: z.number(), currency: z.string() }),
          })
          .optional(),
      }),
    }),
  ),
});

function createApp(options?: {
  readonly recordedMandates?: { agentSessionId: string; mandate: Ap2PaymentMandate }[];
  readonly recordedCapabilities?: {
    agentSessionId: string;
    supportedPaymentHandlers: readonly string[];
  }[];
  readonly chatResponse?: AgentRuntimeResponse;
}): A2aHttpApp {
  const recordedMandates = options?.recordedMandates ?? [];
  const recordedCapabilities = options?.recordedCapabilities ?? [];

  return {
    createSession: () => ({ agentSessionId: 'session-1' }),
    chat: async () => options?.chatResponse ?? { message: 'ok', toolCalls: [] },
    recordAp2Mandate: (agentSessionId, mandate) => {
      recordedMandates.push({ agentSessionId, mandate });
    },
    recordPaymentCapability: (agentSessionId, supportedPaymentHandlers) => {
      recordedCapabilities.push({ agentSessionId, supportedPaymentHandlers });
    },
  };
}

test('records a well-formed AP2 mandate from inbound message metadata before chatting', async () => {
  const recordedMandates: { agentSessionId: string; mandate: Ap2PaymentMandate }[] = [];
  const app = createApp({ recordedMandates });

  await handleA2aSendMessage(app, {
    message: {
      messageId: 'msg-1',
      contextId: 'session-1',
      role: 'user',
      parts: [{ kind: 'text', text: 'Here is my payment authorization.' }],
      metadata: {
        ap2Mandate: { checkoutMandate: 'checkout-mandate-jwt' },
      },
    },
  });

  expect(recordedMandates).toEqual([
    { agentSessionId: 'session-1', mandate: { checkoutMandate: 'checkout-mandate-jwt' } },
  ]);
});

test('does not record a mandate when message metadata has none', async () => {
  const recordedMandates: { agentSessionId: string; mandate: Ap2PaymentMandate }[] = [];
  const app = createApp({ recordedMandates });

  await handleA2aSendMessage(app, {
    message: {
      messageId: 'msg-1',
      contextId: 'session-1',
      role: 'user',
      parts: [{ kind: 'text', text: 'I want to buy a jacket.' }],
    },
  });

  expect(recordedMandates).toEqual([]);
});

test('ignores malformed AP2 mandate metadata instead of recording a partial mandate', async () => {
  const recordedMandates: { agentSessionId: string; mandate: Ap2PaymentMandate }[] = [];
  const app = createApp({ recordedMandates });

  await handleA2aSendMessage(app, {
    message: {
      messageId: 'msg-1',
      contextId: 'session-1',
      role: 'user',
      parts: [{ kind: 'text', text: 'Here is my payment authorization.' }],
      metadata: { ap2Mandate: { checkoutMandate: '' } },
    },
  });

  expect(recordedMandates).toEqual([]);
});

test('relays the shop-verified merchant authorization back in the response artifact metadata', async () => {
  const app = createApp({
    chatResponse: {
      message: 'Your order is confirmed.',
      toolCalls: ['completeCheckout'],
      completedCheckout: {
        summary: {
          cartId: 'checkout-1',
          items: [],
          subtotal: { amount: 0, currency: 'USD' },
          total: { amount: 0, currency: 'USD' },
          currency: 'USD',
        },
        orderId: 'order-1',
        status: 'completed',
        ap2MerchantAuthorization: 'merchant-authorization-jws',
      },
    },
  });

  const result = await handleA2aSendMessage(app, {
    message: {
      messageId: 'msg-1',
      contextId: 'session-1',
      role: 'user',
      parts: [{ kind: 'text', text: 'Complete the checkout.' }],
    },
  });
  const task = taskSchema.parse(result);

  expect(task.artifacts[0]?.metadata.ap2MerchantAuthorization).toBe('merchant-authorization-jws');
});

test('relays pending checkout terms so the buyer can build an accurate mandate before completion', async () => {
  const app = createApp({
    chatResponse: {
      message: 'Here is your cart total.',
      toolCalls: ['prepareCheckoutHandoff'],
      pendingCheckoutTerms: {
        checkoutId: 'checkout-1',
        total: { amount: 29.99, currency: 'EUR' },
      },
    },
  });

  const result = await handleA2aSendMessage(app, {
    message: {
      messageId: 'msg-1',
      contextId: 'session-1',
      role: 'user',
      parts: [{ kind: 'text', text: 'Prepare my checkout.' }],
    },
  });
  const task = taskSchema.parse(result);

  expect(task.artifacts[0]?.metadata.checkoutTerms).toEqual({
    checkoutId: 'checkout-1',
    total: { amount: 29.99, currency: 'EUR' },
  });
});
