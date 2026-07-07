import type { Database } from 'bun:sqlite';
import type {
  CheckoutIdempotencyRecord,
  CheckoutIdempotencyStore,
} from '../harness/checkout-idempotency-store.js';
import type { AgentRunStore } from '../runtime/agent-run-store.js';
import type { AgentRun } from '../runtime/agent-runtime.js';
import {
  agentRunFromRow,
  agentRunRowSchema,
  checkoutIdempotencyFromRow,
  checkoutIdempotencyRowSchema,
  migrateAgentRunStore,
  migrateCheckoutIdempotencyStore,
  openDatabase,
} from './sqlite-store-support.js';

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
