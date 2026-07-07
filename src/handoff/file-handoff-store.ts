import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CartSummary } from '../contracts/commerce.js';
import {
  type HandoffRecord,
  type HandoffStatus,
  type HandoffStore,
  isResolvableHandoff,
} from './handoff-store.js';

export interface FileHandoffStoreOptions {
  readonly path: string;
  readonly now?: () => Date;
}

interface StoredHandoffRecord extends Omit<HandoffRecord, 'expiresAt'> {
  readonly expiresAt: string;
}

export class FileHandoffStore implements HandoffStore {
  readonly #path: string;
  readonly #now: () => Date;

  constructor(options: FileHandoffStoreOptions) {
    this.#path = options.path;
    this.#now = options.now ?? (() => new Date());
    ensureParentDirectory(this.#path);
    if (!existsSync(this.#path)) {
      writeFileSync(this.#path, '[]');
    }
  }

  // fallow-ignore-next-line unused-class-member
  get records(): readonly HandoffRecord[] {
    return this.#readRecords();
  }

  save(record: HandoffRecord): void {
    const records = this.#readRecords().filter(
      (candidate) => candidate.handoffId !== record.handoffId,
    );
    records.push(record);
    this.#writeRecords(records);
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
    const records = this.#readRecords();
    const record = records.find((candidate) => candidate.handoffId === handoffId);

    if (!isResolvableHandoff(record, merchantId, shopwareSalesChannelId, this.#now())) {
      return undefined;
    }

    this.#writeRecords(markRecordUsed(records, handoffId));

    return record;
  }

  #readRecords(): HandoffRecord[] {
    const parsed: unknown = JSON.parse(readFileSync(this.#path, 'utf8'));

    if (!Array.isArray(parsed)) {
      throw new Error(`Handoff store file ${this.#path} must contain an array`);
    }

    return parsed.map(readRecord);
  }

  #writeRecords(records: readonly HandoffRecord[]): void {
    writeFileSync(this.#path, JSON.stringify(records.map(writeRecord), null, 2));
  }
}

function markRecordUsed(
  records: readonly HandoffRecord[],
  handoffId: string,
): readonly HandoffRecord[] {
  return records.map((candidate) => {
    if (candidate.handoffId !== handoffId) {
      return candidate;
    }

    return {
      handoffId: candidate.handoffId,
      agentSessionId: candidate.agentSessionId,
      merchantId: candidate.merchantId,
      shopwareSalesChannelId: candidate.shopwareSalesChannelId,
      shopwareContextToken: candidate.shopwareContextToken,
      cartSummary: candidate.cartSummary,
      expiresAt: candidate.expiresAt,
      status: 'used',
    };
  });
}

function readRecord(value: unknown): HandoffRecord {
  if (!isStoredRecord(value)) {
    throw new Error('Handoff store file contains an invalid handoff record');
  }

  return {
    ...value,
    expiresAt: new Date(value.expiresAt),
  };
}

function writeRecord(record: HandoffRecord): StoredHandoffRecord {
  return {
    ...record,
    expiresAt: record.expiresAt.toISOString(),
  };
}

function isStoredRecord(value: unknown): value is StoredHandoffRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.handoffId === 'string' &&
    typeof value.agentSessionId === 'string' &&
    typeof value.merchantId === 'string' &&
    typeof value.shopwareSalesChannelId === 'string' &&
    typeof value.shopwareContextToken === 'string' &&
    isCartSummary(value.cartSummary) &&
    typeof value.expiresAt === 'string' &&
    isHandoffStatus(value.status)
  );
}

function isCartSummary(value: unknown): value is CartSummary {
  return isRecord(value) && typeof value.cartId === 'string' && Array.isArray(value.items);
}

function isHandoffStatus(value: unknown): value is HandoffStatus {
  return value === 'ready_for_checkout' || value === 'used';
}

function ensureParentDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
