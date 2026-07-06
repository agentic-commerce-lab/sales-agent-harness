import type { ServerResponse } from 'node:http';

import { type ConversationEntry, decideBuyerMessage } from './buyer-agent.js';
import { DONE_SIGNAL } from './buyer-prompt.js';
import { callSellerA2A } from './seller-client.js';

export type Emit = (event: string, data: unknown) => void;

const MAX_TURNS = 16;

interface ConversationState {
  turn: number;
  contextId: string | undefined;
  history: ConversationEntry[];
}

export function streamConversation(goal: string, res: ServerResponse, emit: Emit): Promise<void> {
  return streamNextTurn(goal, res, emit, { turn: 0, contextId: undefined, history: [] });
}

async function streamNextTurn(
  goal: string,
  res: ServerResponse,
  emit: Emit,
  state: ConversationState,
): Promise<void> {
  const next = await advanceConversation(goal, res, emit, state);

  if (next) {
    return streamNextTurn(goal, res, emit, next);
  }
}

async function advanceConversation(
  goal: string,
  res: ServerResponse,
  emit: Emit,
  state: ConversationState,
): Promise<ConversationState | undefined> {
  if (state.turn >= MAX_TURNS || res.destroyed) {
    emit('done', { turns: state.turn, contextId: state.contextId });
    return undefined;
  }

  emit('status', { phase: 'buyer-thinking' });
  const buyerMessage = await decideBuyerMessage(goal, state.history);

  if (buyerMessage.includes(DONE_SIGNAL)) {
    emit('done', { turns: state.turn, contextId: state.contextId });
    return undefined;
  }

  emit('buyer', { message: buyerMessage });
  emit('status', { phase: 'seller-thinking' });
  const sellerResult = await callSellerA2A(buyerMessage, state.contextId);

  emit('seller', {
    message: sellerResult.message,
    toolCalls: sellerResult.toolCalls,
    contextId: sellerResult.contextId,
  });

  return {
    turn: state.turn + 1,
    contextId: sellerResult.contextId,
    history: [
      ...state.history,
      { role: 'buyer', message: buyerMessage },
      { role: 'seller', message: sellerResult.message, toolCalls: sellerResult.toolCalls },
    ],
  };
}
