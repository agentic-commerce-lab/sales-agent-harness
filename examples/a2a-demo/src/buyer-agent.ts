import { createBuyerPrompt, DONE_SIGNAL } from './buyer-prompt.js';
import { asArray, asRecord, callSellerA2A, readString } from './seller-client.js';

export interface ConversationEntry {
  role: 'buyer' | 'seller';
  message: string;
  toolCalls?: string[];
}

export interface TurnInput {
  goal: string;
  contextId?: string;
  history: ConversationEntry[];
}

export type TurnResult =
  | { done: true }
  | {
      done: false;
      buyerMessage: string;
      sellerResponse: string;
      toolCalls: string[];
      contextId: string;
    };

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const buyerMessage = await decideBuyerMessage(input.goal, input.history);

  if (buyerMessage.includes(DONE_SIGNAL)) {
    return { done: true };
  }

  const sellerResult = await callSellerA2A(buyerMessage, input.contextId);

  return {
    done: false,
    buyerMessage,
    sellerResponse: sellerResult.message,
    toolCalls: sellerResult.toolCalls,
    contextId: sellerResult.contextId,
  };
}

export async function decideBuyerMessage(
  goal: string,
  history: ConversationEntry[],
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: createCompletionBody(goal, history),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  return parseCompletionText(await res.json());
}

function createCompletionBody(goal: string, history: ConversationEntry[]): string {
  return JSON.stringify({
    model: process.env.BUYER_MODEL ?? 'gpt-5-mini',
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
