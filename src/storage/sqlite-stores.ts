import type { Database } from 'bun:sqlite';
import type { AgentSession, CommerceContext, PublicAgentSession } from '../contracts/session.js';
import type { HandoffRecord, HandoffStore } from '../handoff/handoff-store.js';
import type {
  CheckoutIdempotencyRecord,
  CheckoutIdempotencyStore,
} from '../harness/checkout-idempotency-store.js';
import type { AuditEvent, AuditLogger } from '../observability/audit-log.js';
import type { AgentRunStore } from '../runtime/agent-run-store.js';
import type { AgentRun } from '../runtime/agent-runtime.js';
import type { SessionStore } from '../session/session-store.js';
import {
  agentRunFromRow,
  agentRunRowSchema,
  checkoutIdempotencyFromRow,
  checkoutIdempotencyRowSchema,
  handoffFromRow,
  handoffRowSchema,
  migrateAgentRunStore,
  migrateAuditLog,
  migrateCheckoutIdempotencyStore,
  migrateHandoffStore,
  migrateSessionStore,
  openDatabase,
  readAuditRow,
  readHandoffRow,
  sessionFromRow,
  sessionRowSchema,
} from './sqlite-store-support.js';

export interface SqliteStoreOptions {
  readonly databasePath: string;
  readonly now?: () => Date;
}

export class SqliteSessionStore implements SessionStore {
  readonly #db: Database;
  readonly #now: () => Date;

  constructor(options: SqliteStoreOptions) {
    this.#db = openDatabase(options.databasePath);
    this.#now = options.now ?? (() => new Date());
    migrateSessionStore(this.#db);
  }

  createSession(session: AgentSession): AgentSession {
    this.#db
      .query(
        `insert or replace into sessions (
          agent_session_id,
          merchant_id,
          agent_id,
          channel,
          customer_context_json,
          shopware_sales_channel_id,
          shopware_context_token,
          created_at,
          expires_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.agentSessionId,
        session.merchantId,
        session.agentId,
        session.channel,
        JSON.stringify(session.customerContext),
        session.commerceContext?.shopwareSalesChannelId ?? null,
        session.commerceContext?.shopwareContextToken ?? null,
        session.createdAt.toISOString(),
        session.expiresAt?.toISOString() ?? null,
      );

    return session;
  }

  // fallow-ignore-next-line unused-class-member
  setCommerceContext(agentSessionId: string, commerceContext: CommerceContext): AgentSession {
    const session = this.#getSessionById(agentSessionId);

    if (!session) {
      throw new Error(`Agent session ${agentSessionId} was not found`);
    }

    const updatedSession: AgentSession = {
      ...session,
      commerceContext,
    };
    this.createSession(updatedSession);

    return updatedSession;
  }

  getSession(agentSessionId: string, merchantId: string): AgentSession | undefined {
    const session = this.#getSessionById(agentSessionId);

    if (!session || session.merchantId !== merchantId) {
      return undefined;
    }

    if (session.expiresAt && session.expiresAt <= this.#now()) {
      return undefined;
    }

    return session;
  }

  // fallow-ignore-next-line unused-class-member
  getPublicSession(agentSessionId: string, merchantId: string): PublicAgentSession | undefined {
    const session = this.getSession(agentSessionId, merchantId);

    if (!session) {
      return undefined;
    }

    const publicSession: PublicAgentSession = {
      agentSessionId: session.agentSessionId,
      merchantId: session.merchantId,
      agentId: session.agentId,
      channel: session.channel,
      customerContext: session.customerContext,
      createdAt: session.createdAt,
    };

    if (session.expiresAt) {
      return { ...publicSession, expiresAt: session.expiresAt };
    }

    return publicSession;
  }

  #getSessionById(agentSessionId: string): AgentSession | undefined {
    const row = sessionRowSchema
      .nullable()
      .parse(
        this.#db.query('select * from sessions where agent_session_id = ?').get(agentSessionId),
      );

    if (!row) {
      return undefined;
    }

    return sessionFromRow(row);
  }
}

export class SqliteHandoffStore implements HandoffStore {
  readonly #db: Database;
  readonly #now: () => Date;

  constructor(options: SqliteStoreOptions) {
    this.#db = openDatabase(options.databasePath);
    this.#now = options.now ?? (() => new Date());
    migrateHandoffStore(this.#db);
  }

  // fallow-ignore-next-line unused-class-member
  get records(): readonly HandoffRecord[] {
    return this.#db.query('select * from handoffs order by handoff_id').all().map(readHandoffRow);
  }

  // fallow-ignore-next-line unused-class-member
  save(record: HandoffRecord): void {
    this.#db
      .query(
        `insert or replace into handoffs (
          handoff_id,
          agent_session_id,
          merchant_id,
          shopware_sales_channel_id,
          shopware_context_token,
          cart_summary_json,
          expires_at,
          status
        ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.handoffId,
        record.agentSessionId,
        record.merchantId,
        record.shopwareSalesChannelId,
        record.shopwareContextToken,
        JSON.stringify(record.cartSummary),
        record.expiresAt.toISOString(),
        record.status,
      );
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
    const row = handoffRowSchema
      .nullable()
      .parse(this.#db.query('select * from handoffs where handoff_id = ?').get(handoffId));

    if (!row) {
      return undefined;
    }

    const record = handoffFromRow(row);

    if (!isResolvable(record, merchantId, shopwareSalesChannelId, this.#now())) {
      return undefined;
    }

    this.#db.query('update handoffs set status = ? where handoff_id = ?').run('used', handoffId);

    return record;
  }
}

export interface SqliteAuditLoggerOptions {
  readonly databasePath: string;
}

export class SqliteAuditLogger implements AuditLogger {
  readonly #db: Database;

  constructor(options: SqliteAuditLoggerOptions) {
    this.#db = openDatabase(options.databasePath);
    migrateAuditLog(this.#db);
  }

  // fallow-ignore-next-line unused-class-member
  get events(): readonly AuditEvent[] {
    return this.#db.query('select * from audit_events order by id').all().map(readAuditRow);
  }

  record(event: AuditEvent): void {
    this.#db
      .query(
        `insert into audit_events (
          type,
          agent_session_id,
          merchant_id,
          agent_id,
          channel,
          capability,
          policy_decision,
          data_sources_json,
          cart_id,
          handoff_id,
          error_name,
          error_message,
          occurred_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.type,
        event.agentSessionId,
        event.merchantId,
        event.agentId,
        event.channel,
        event.capability ?? null,
        event.policyDecision ?? null,
        event.dataSources ? JSON.stringify(event.dataSources) : null,
        event.cartId ?? null,
        event.handoffId ?? null,
        event.error?.name ?? null,
        event.error?.message ?? null,
        event.occurredAt.toISOString(),
      );
  }
}

export class SqliteAgentRunStore implements AgentRunStore {
  readonly #db: Database;

  constructor(options: { readonly databasePath: string }) {
    this.#db = openDatabase(options.databasePath);
    migrateAgentRunStore(this.#db);
  }

  // fallow-ignore-next-line unused-class-member
  get(runId: string): AgentRun | undefined {
    const row = agentRunRowSchema
      .nullable()
      .parse(this.#db.query('select * from agent_runs where run_id = ?').get(runId));

    return row ? agentRunFromRow(row) : undefined;
  }

  // fallow-ignore-next-line unused-class-member
  save(run: AgentRun): void {
    this.#db
      .query(
        `insert or replace into agent_runs (
          run_id,
          agent_session_id,
          status,
          input_json,
          response_json,
          error_name,
          error_message,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.runId,
        run.agentSessionId,
        run.status,
        JSON.stringify(run.input),
        run.response ? JSON.stringify(run.response) : null,
        run.error?.name ?? null,
        run.error?.message ?? null,
        run.createdAt.toISOString(),
        run.updatedAt.toISOString(),
      );
  }
}

export class SqliteCheckoutIdempotencyStore implements CheckoutIdempotencyStore {
  readonly #db: Database;

  constructor(options: { readonly databasePath: string }) {
    this.#db = openDatabase(options.databasePath);
    migrateCheckoutIdempotencyStore(this.#db);
  }

  get(input: {
    readonly merchantId: string;
    readonly agentSessionId: string;
    readonly idempotencyKey: string;
  }): CheckoutIdempotencyRecord | undefined {
    const row = checkoutIdempotencyRowSchema.nullable().parse(
      this.#db
        .query(
          `select * from checkout_idempotency
          where merchant_id = ?
            and agent_session_id = ?
            and idempotency_key = ?`,
        )
        .get(input.merchantId, input.agentSessionId, input.idempotencyKey),
    );

    return row ? checkoutIdempotencyFromRow(row) : undefined;
  }

  save(record: CheckoutIdempotencyRecord): void {
    this.#db
      .query(
        `insert or replace into checkout_idempotency (
          merchant_id,
          agent_session_id,
          idempotency_key,
          result_json,
          created_at
        ) values (?, ?, ?, ?, ?)`,
      )
      .run(
        record.merchantId,
        record.agentSessionId,
        record.idempotencyKey,
        JSON.stringify(record.result),
        record.createdAt.toISOString(),
      );
  }
}

function isResolvable(
  record: HandoffRecord,
  merchantId: string,
  shopwareSalesChannelId: string,
  now: Date,
): boolean {
  return (
    record.status === 'ready_for_checkout' &&
    record.merchantId === merchantId &&
    record.shopwareSalesChannelId === shopwareSalesChannelId &&
    record.expiresAt > now
  );
}
