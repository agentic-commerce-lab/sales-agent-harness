import type { Ap2PaymentMandate } from '../contracts/commerce.js';
import type { AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import type { A2aMessage, A2aPart } from './a2a-schemas.js';
import { ap2MandateMetadataSchema, sendMessageSchema } from './a2a-schemas.js';
import type { ChatInput, CreateAgentSessionInput } from './sales-agent-app.js';

export interface A2aHttpApp {
  createSession(input: CreateAgentSessionInput): { readonly agentSessionId: string };
  chat(input: ChatInput): Promise<AgentRuntimeResponse>;
  recordAp2Mandate(agentSessionId: string, mandate: Ap2PaymentMandate): void;
  recordPaymentCapability(
    agentSessionId: string,
    supportedPaymentHandlers: readonly string[],
  ): void;
}

export async function handleA2aSendMessage(app: A2aHttpApp, input: unknown): Promise<unknown> {
  const parsed = sendMessageSchema.parse(input);
  const agentSessionId = extractAgentSessionId(parsed.message) ?? createA2aSession(app);
  const message = extractTextMessage(parsed.message.parts);
  const ap2Mandate = extractAp2Mandate(parsed.message);

  if (ap2Mandate) {
    app.recordAp2Mandate(agentSessionId, ap2Mandate);
  }

  const supportedPaymentHandlers = extractSupportedPaymentHandlers(parsed.message);

  if (supportedPaymentHandlers) {
    app.recordPaymentCapability(agentSessionId, supportedPaymentHandlers);
  }

  const response = await app.chat({ agentSessionId, message });

  return createCompletedTask(parsed.message, agentSessionId, response);
}

function createA2aSession(app: A2aHttpApp): string {
  const session = app.createSession({ channel: 'a2a' });
  return session.agentSessionId;
}

function createCompletedTask(
  message: A2aMessage,
  agentSessionId: string,
  response: AgentRuntimeResponse,
): unknown {
  const taskId = message.taskId ?? message.messageId;

  return {
    id: taskId,
    contextId: agentSessionId,
    status: {
      state: 'completed',
      message: {
        messageId: `${message.messageId}-response`,
        role: 'agent',
        parts: [{ kind: 'text', text: response.message }],
      },
    },
    artifacts: [
      {
        artifactId: `${taskId}-artifact`,
        name: 'Seller agent response',
        parts: [{ kind: 'text', text: response.message }],
        metadata: {
          toolCalls: [...response.toolCalls],
          ...buildCheckoutMetadata(response),
        },
      },
    ],
  };
}

/**
 * Structured relay of buyer-executed checkout details, kept out of prose so
 * opaque codes never depend on the model copying them: order id + x402
 * instructions, a fallback web-checkout url for x402-disabled clients, the AP2
 * merchant authorization, and the pending checkout terms (id + total) the buyer
 * uses to pin its next mandate.
 */
function buildCheckoutMetadata(response: AgentRuntimeResponse): Record<string, unknown> {
  const checkout = response.completedCheckout;

  return compact({
    orderId: checkout?.orderId,
    x402: checkout?.x402,
    continueUrl: checkout?.continueUrl,
    ap2MerchantAuthorization: checkout?.ap2MerchantAuthorization,
    checkoutTerms: response.pendingCheckoutTerms,
  });
}

/** Drop `undefined` entries, so optional fields build without per-key ternaries. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

function extractAp2Mandate(message: A2aMessage): Ap2PaymentMandate | undefined {
  const parsed = ap2MandateMetadataSchema.safeParse(message.metadata?.ap2Mandate);

  return parsed.success ? parsed.data : undefined;
}

/**
 * The UCP payment handler ids the buyer client declares it supports. Absent (or
 * empty) means the buyer commits no method, so the shop hands off to a browser
 * checkout instead of placing an order.
 */
function extractSupportedPaymentHandlers(message: A2aMessage): readonly string[] | undefined {
  const raw = message.metadata?.supportedPaymentHandlers;

  if (!Array.isArray(raw)) {
    return undefined;
  }

  return raw.filter((value): value is string => typeof value === 'string');
}

function extractAgentSessionId(message: A2aMessage): string | null {
  const metadataSessionId = message.metadata?.agentSessionId;

  if (typeof metadataSessionId === 'string' && metadataSessionId.length > 0) {
    return metadataSessionId;
  }

  return message.contextId ?? null;
}

function extractTextMessage(parts: readonly A2aPart[]): string {
  const text = parts
    .map((part) => part.text)
    .filter((partText): partText is string => Boolean(partText))
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('A2A message requires at least one text part');
  }

  return text;
}
