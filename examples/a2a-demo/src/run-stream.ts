import type { ServerResponse } from 'node:http';

import { type Ap2Mandate, createAp2Mandate, isAp2MandatesEnabled } from './ap2-mandate.js';
import { type ConversationEntry, decideBuyerMessage } from './buyer-agent.js';
import { DONE_SIGNAL } from './buyer-prompt.js';
import { type CheckoutTerms, callSellerA2A, type SellerA2AResult } from './seller-client.js';
import { describePayment, isX402Enabled, payWithX402 } from './x402-payment.js';

export type Emit = (event: string, data: unknown) => void;

const MAX_TURNS = 16;

interface ConversationState {
  turn: number;
  contextId: string | undefined;
  history: ConversationEntry[];
  /**
   * Checkout terms the seller most recently reported. Learned one turn late
   * (the buyer can only see what the seller told it last turn), so the
   * mandate attached to the turn that triggers completion is only accurate
   * once the seller has reported terms at least once beforehand.
   */
  checkoutTerms: CheckoutTerms | undefined;
}

export function streamConversation(goal: string, res: ServerResponse, emit: Emit): Promise<void> {
  return streamNextTurn(goal, res, emit, {
    turn: 0,
    contextId: undefined,
    history: [],
    checkoutTerms: undefined,
  });
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

  const ap2Mandate = createStateMandate(goal, state);
  emitBuyer(emit, buyerMessage, ap2Mandate, state);
  emit('status', { phase: 'seller-thinking' });

  const sellerResult = await callSellerA2A(buyerMessage, state.contextId, ap2Mandate);

  emit('seller', {
    message: sellerResult.message,
    toolCalls: sellerResult.toolCalls,
    contextId: sellerResult.contextId,
  });

  const history: ConversationEntry[] = [
    ...state.history,
    { role: 'buyer', message: buyerMessage },
    { role: 'seller', message: sellerResult.message, toolCalls: sellerResult.toolCalls },
  ];

  // The mandate only becomes meaningful once the seller actually used it to
  // complete a checkout, so only surface it in the feed at that point.
  if (sellerResult.ap2MerchantAuthorization) {
    emit('ap2', {
      mandate: ap2Mandate,
      merchantAuthorization: sellerResult.ap2MerchantAuthorization,
    });
  }

  if ((await resolvePaymentOrHandoff(emit, sellerResult, history, state)) === 'handoff') {
    return undefined;
  }

  return {
    turn: state.turn + 1,
    contextId: sellerResult.contextId,
    history,
    checkoutTerms: sellerResult.checkoutTerms ?? state.checkoutTerms,
  };
}

/**
 * Attached to every outbound message so it is already on the seller's session
 * whenever its LLM decides to call completeCheckout — the harness never asks
 * the model to supply one, see HarnessCore#recordAp2Mandate. Undefined
 * (skipped) when AP2_MANDATES_ENABLED=false.
 */
function createStateMandate(goal: string, state: ConversationState): Ap2Mandate | undefined {
  if (!isAp2MandatesEnabled()) {
    return undefined;
  }

  return createAp2Mandate({
    contextId: state.contextId,
    goal,
    ...(state.checkoutTerms
      ? {
          checkoutTerms: {
            checkoutId: state.checkoutTerms.checkoutId,
            totalAmount: state.checkoutTerms.totalAmount,
            currency: state.checkoutTerms.currency,
          },
        }
      : {}),
  });
}

function emitBuyer(
  emit: Emit,
  buyerMessage: string,
  ap2Mandate: Ap2Mandate | undefined,
  state: ConversationState,
): void {
  emit('buyer', {
    message: buyerMessage,
    ...(ap2Mandate
      ? {
          ap2Mandate: {
            checkoutMandate: ap2Mandate.checkoutMandate,
            pinned: state.checkoutTerms !== undefined,
            checkoutTerms: state.checkoutTerms,
          },
        }
      : {}),
  });
}

/**
 * x402 is the primary path: when supported, the buyer wallet settles
 * deterministically (no model in the loop for money). When x402 is disabled on
 * this client (X402_ENABLED=false), fall back to the shop's continue_url so a
 * human finishes the checkout in a browser. Returns 'handoff' when the
 * conversation should stop (a human takes over in the browser).
 */
async function resolvePaymentOrHandoff(
  emit: Emit,
  sellerResult: SellerA2AResult,
  history: ConversationEntry[],
  state: ConversationState,
): Promise<'handoff' | undefined> {
  if (isX402Enabled() && sellerResult.x402) {
    emit('status', { phase: 'buyer-paying' });
    const payment = await payWithX402(sellerResult.x402);
    emit('payment', payment);
    history.push({ role: 'buyer', message: describePayment(payment) });
    return undefined;
  }

  if (sellerResult.continueUrl) {
    emit('handoff', { continueUrl: sellerResult.continueUrl });
    // A handoff IS the resolution for this client: there is no shared payment
    // method, so a human finishes in the browser and NO order is placed here.
    // Stop the conversation instead of letting the buyer nag the seller to
    // complete an order it cannot place. outcome:'handoff' so the UI recap does
    // not claim an order was created.
    emit('done', { turns: state.turn + 1, contextId: sellerResult.contextId, outcome: 'handoff' });
    return 'handoff';
  }

  return undefined;
}
