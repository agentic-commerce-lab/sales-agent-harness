import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditEvent, AuditLogger } from './audit-log.js';

export interface FileAuditLoggerOptions {
  readonly path: string;
}

interface StoredAuditEvent extends Omit<AuditEvent, 'occurredAt' | 'error'> {
  readonly occurredAt: string;
  readonly error?: {
    readonly name: string;
    readonly message: string;
  };
}

export class FileAuditLogger implements AuditLogger {
  readonly #path: string;

  constructor(options: FileAuditLoggerOptions) {
    this.#path = options.path;
    ensureParentDirectory(this.#path);
    if (!existsSync(this.#path)) {
      writeFileSync(this.#path, '');
    }
  }

  get events(): readonly AuditEvent[] {
    return readFileSync(this.#path, 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => readEvent(JSON.parse(line)));
  }

  record(event: AuditEvent): void {
    appendFileSync(this.#path, `${JSON.stringify(writeEvent(event))}\n`);
  }
}

function readEvent(value: unknown): AuditEvent {
  if (!isStoredEvent(value)) {
    throw new Error('Audit log file contains an invalid event record');
  }

  return {
    ...value,
    occurredAt: new Date(value.occurredAt),
    ...(value.error ? { error: new Error(value.error.message, { cause: value.error.name }) } : {}),
  };
}

function writeEvent(event: AuditEvent): StoredAuditEvent {
  return {
    ...event,
    occurredAt: event.occurredAt.toISOString(),
    ...(event.error
      ? {
          error: {
            name: event.error.name,
            message: event.error.message,
          },
        }
      : {}),
  };
}

function isStoredEvent(value: unknown): value is StoredAuditEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === 'string' &&
    typeof value.agentSessionId === 'string' &&
    typeof value.merchantId === 'string' &&
    typeof value.agentId === 'string' &&
    typeof value.channel === 'string' &&
    typeof value.occurredAt === 'string'
  );
}

function ensureParentDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
