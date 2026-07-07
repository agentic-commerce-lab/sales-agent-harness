import { randomBytes } from 'node:crypto';

import type { CartSummary } from '../contracts/commerce.js';
import type { HandoffRecord, HandoffStore } from './handoff-store.js';

export interface CheckoutHandoff {
  readonly handoffId: string;
  readonly summary: CartSummary;
  readonly continueUrl: string;
  readonly expiresAt: Date;
}

export interface PrepareCheckoutHandoffInput {
  readonly store: HandoffStore;
  readonly agentSessionId: string;
  readonly merchantId: string;
  readonly shopwareSalesChannelId: string;
  readonly shopwareContextToken: string;
  readonly cartSummary: CartSummary;
  readonly storefrontBaseUrl: string;
  readonly ttlMs: number;
}

export function prepareCheckoutHandoff(input: PrepareCheckoutHandoffInput): CheckoutHandoff {
  const handoffId = createHandoffId();
  const expiresAt = new Date(input.store.currentTime().getTime() + input.ttlMs);
  const record: HandoffRecord = {
    handoffId,
    agentSessionId: input.agentSessionId,
    merchantId: input.merchantId,
    shopwareSalesChannelId: input.shopwareSalesChannelId,
    shopwareContextToken: input.shopwareContextToken,
    cartSummary: input.cartSummary,
    expiresAt,
    status: 'ready_for_checkout',
  };

  input.store.save(record);

  return {
    handoffId,
    summary: input.cartSummary,
    continueUrl: `${input.storefrontBaseUrl.replace(/\/$/, '')}/agent-checkout?h=${handoffId}`,
    expiresAt,
  };
}

function createHandoffId(): string {
  return `handoff_${randomBytes(16).toString('hex')}`;
}
