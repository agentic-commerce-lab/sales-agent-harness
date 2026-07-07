import type { Database } from 'bun:sqlite';
import type { AgentSession, CommerceContext, PublicAgentSession } from '../contracts/session.js';
import {
  type HandoffRecord,
  type HandoffStore,
  isResolvableHandoff,
} from '../handoff/handoff-store.js';
import type { AuditEvent, AuditLogger } from '../observability/audit-log.js';
import {
  isSessionAvailable,
  type SessionStore,
  toPublicSession,
} from '../session/session-store.js';
import {
  auditEventInsertValues,
  handoffFromRow,
  handoffRowSchema,
  migrateAuditLog,
  migrateHandoffStore,
  migrateSessionStore,
  openDatabase,
  readAuditRow,
  readHandoffRow,
  sessionFromRow,
  sessionRowSchema,
} from './sqlite-store-support.js';

export {
  SqliteAgentRunStore,
  SqliteCheckoutIdempotencyStore,
} from './sqlite-runtime-stores.js';

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

    if (!isSessionAvailable(session, merchantId, this.#now())) {
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

    return toPublicSession(session);
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

    if (!isResolvableHandoff(record, merchantId, shopwareSalesChannelId, this.#now())) {
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
      .run(...auditEventInsertValues(event));
  }
}
