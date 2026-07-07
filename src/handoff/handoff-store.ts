import type { CartSummary } from '../contracts/commerce.js';

export type HandoffStatus = 'ready_for_checkout' | 'used';

export interface HandoffRecord {
  readonly handoffId: string;
  readonly agentSessionId: string;
  readonly merchantId: string;
  readonly shopwareSalesChannelId: string;
  readonly shopwareContextToken: string;
  readonly cartSummary: CartSummary;
  readonly expiresAt: Date;
  readonly status: HandoffStatus;
}

export interface HandoffStoreOptions {
  readonly now?: () => Date;
}

export interface HandoffStore {
  readonly records: readonly HandoffRecord[];
  save(record: HandoffRecord): void;
  currentTime(): Date;
  resolve(
    handoffId: string,
    merchantId: string,
    shopwareSalesChannelId: string,
  ): HandoffRecord | undefined;
}

export class InMemoryHandoffStore implements HandoffStore {
  readonly #records = new Map<string, HandoffRecord>();
  readonly #now: () => Date;

  constructor(options: HandoffStoreOptions = {}) {
    this.#now = options.now ?? (() => new Date());
  }

  get records(): readonly HandoffRecord[] {
    return [...this.#records.values()];
  }

  save(record: HandoffRecord): void {
    this.#records.set(record.handoffId, record);
  }

  // fallow-ignore-next-line unused-class-member
  currentTime(): Date {
    return this.#now();
  }

  resolve(
    handoffId: string,
    merchantId: string,
    shopwareSalesChannelId: string,
  ): HandoffRecord | undefined {
    const record = this.#records.get(handoffId);

    if (!record || !this.isResolvable(record, merchantId, shopwareSalesChannelId)) {
      return undefined;
    }

    this.#records.set(handoffId, { ...record, status: 'used' });

    return record;
  }

  private isResolvable(
    record: HandoffRecord,
    merchantId: string,
    shopwareSalesChannelId: string,
  ): boolean {
    return (
      record.status === 'ready_for_checkout' &&
      record.merchantId === merchantId &&
      record.shopwareSalesChannelId === shopwareSalesChannelId &&
      record.expiresAt > this.#now()
    );
  }
}
