import type { CompletedCheckoutResult } from '../contracts/commerce.js';

export interface CheckoutIdempotencyRecord {
  readonly merchantId: string;
  readonly agentSessionId: string;
  readonly idempotencyKey: string;
  readonly result: CompletedCheckoutResult;
  readonly createdAt: Date;
}

export interface CheckoutIdempotencyStore {
  get(input: {
    readonly merchantId: string;
    readonly agentSessionId: string;
    readonly idempotencyKey: string;
  }): CheckoutIdempotencyRecord | undefined;
  save(record: CheckoutIdempotencyRecord): void;
}

export class InMemoryCheckoutIdempotencyStore implements CheckoutIdempotencyStore {
  readonly #records = new Map<string, CheckoutIdempotencyRecord>();

  // fallow-ignore-next-line unused-class-member
  get(input: {
    readonly merchantId: string;
    readonly agentSessionId: string;
    readonly idempotencyKey: string;
  }): CheckoutIdempotencyRecord | undefined {
    return this.#records.get(recordKey(input));
  }

  // fallow-ignore-next-line unused-class-member
  save(record: CheckoutIdempotencyRecord): void {
    this.#records.set(recordKey(record), record);
  }
}

function recordKey(input: {
  readonly merchantId: string;
  readonly agentSessionId: string;
  readonly idempotencyKey: string;
}): string {
  return `${input.merchantId}:${input.agentSessionId}:${input.idempotencyKey}`;
}
