import { type Ap2Mandate, createAp2Mandate, isAp2MandatesEnabled } from './ap2-mandate.js';
import { createBuyerPrompt, DONE_SIGNAL } from './buyer-prompt.js';
import {
  asArray,
  asRecord,
  type CheckoutTerms,
  callSellerA2A,
  readString,
} from './seller-client.js';
import { payWithX402, type X402PaymentOutcome } from './x402-payment.js';

export interface ConversationEntry {
  role: 'buyer' | 'seller';
  message: string;
  toolCalls?: string[];
}

export interface TurnInput {
  goal: string;
  contextId?: string;
  history: ConversationEntry[];
  /** Checkout terms the seller reported on a previous turn, if any. */
  checkoutTerms?: CheckoutTerms;
}

export type TurnResult =
  | { done: true }
  | {
      done: false;
      buyerMessage: string;
      sellerResponse: string;
      toolCalls: string[];
      contextId: string;
      payment?: X402PaymentOutcome;
      ap2Mandate?: Ap2Mandate;
      ap2MerchantAuthorization?: string;
      checkoutTerms?: CheckoutTerms;
    };

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const buyerMessage = await decideBuyerMessage(input.goal, input.history);

  if (buyerMessage.includes(DONE_SIGNAL)) {
    return { done: true };
  }

  // Attached to every outbound message so it is already on the session
  // whenever the seller's LLM decides to call completeCheckout — the
  // harness never asks the model to supply one, see recordAp2Mandate.
  // Skipped entirely when AP2_MANDATES_ENABLED=false.
  const ap2Mandate = isAp2MandatesEnabled()
    ? createAp2Mandate({
        contextId: input.contextId,
        goal: input.goal,
        ...(input.checkoutTerms ? { checkoutTerms: input.checkoutTerms } : {}),
      })
    : undefined;
  const sellerResult = await callSellerA2A(buyerMessage, input.contextId, ap2Mandate);
  const payment = sellerResult.x402 ? await payWithX402(sellerResult.x402) : undefined;

  return {
    done: false,
    buyerMessage,
    sellerResponse: sellerResult.message,
    toolCalls: sellerResult.toolCalls,
    contextId: sellerResult.contextId,
    ...(ap2Mandate ? { ap2Mandate } : {}),
    ...(sellerResult.ap2MerchantAuthorization
      ? { ap2MerchantAuthorization: sellerResult.ap2MerchantAuthorization }
      : {}),
    ...(payment ? { payment } : {}),
    checkoutTerms: sellerResult.checkoutTerms ?? input.checkoutTerms,
  };
}

interface BuyerModelConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export async function decideBuyerMessage(
  goal: string,
  history: ConversationEntry[],
): Promise<string> {
  const config = resolveBuyerModelConfig();

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: createCompletionBody(config.model, goal, history),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${config.baseUrl} error ${res.status}: ${err}`);
  }

  return parseCompletionText(await res.json());
}

/** The model that will actually be used, without requiring an API key — for display purposes. */
export function resolveBuyerModelName(): string {
  const provider = process.env.BUYER_MODEL_PROVIDER ?? 'openai';

  return process.env.BUYER_MODEL ?? defaultBuyerModel(provider);
}

function defaultBuyerModel(provider: string): string {
  return provider === 'openrouter' ? 'openai/gpt-5-mini' : 'gpt-5-mini';
}

function resolveBuyerModelConfig(): BuyerModelConfig {
  const provider = process.env.BUYER_MODEL_PROVIDER ?? 'openai';

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    return {
      baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      apiKey,
      model: resolveBuyerModelName(),
    };
  }

  if (provider !== 'openai') {
    throw new Error(`Unsupported BUYER_MODEL_PROVIDER ${provider}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  return {
    baseUrl: 'https://api.openai.com/v1',
    apiKey,
    model: resolveBuyerModelName(),
  };
}

function createCompletionBody(model: string, goal: string, history: ConversationEntry[]): string {
  return JSON.stringify({
    model,
    messages: [
      { role: 'system', content: createBuyerPrompt(goal) },
      {
        role: 'user',
        content: `Conversation so far:\n\n${formatHistory(history)}\n\nYour next message (or ${DONE_SIGNAL}):`,
      },
    ],
  });
}

function formatHistory(history: ConversationEntry[]): string {
  if (history.length === 0) {
    return '(No messages yet — start by describing your need.)';
  }

  return history.map((e) => `${e.role === 'buyer' ? 'YOU' : 'SELLER'}: ${e.message}`).join('\n\n');
}

function parseCompletionText(payload: unknown): string {
  const content = readMessageContent(payload);

  if (!content) {
    throw new Error('OpenAI response is missing message content');
  }

  return content.trim();
}

function readMessageContent(payload: unknown): string {
  const choices = asArray(asRecord(payload)?.choices);
  const message = asRecord(asRecord(choices[0])?.message);

  return readString(message?.content);
}
