import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { z } from 'zod';
import type { AgentSession } from '../contracts/session.js';
import type { HandoffRecord } from '../handoff/handoff-store.js';
import type { CheckoutIdempotencyRecord } from '../harness/checkout-idempotency-store.js';
import type { AuditEvent } from '../observability/audit-log.js';
import type { AgentRun } from '../runtime/agent-runtime.js';
import {
  type agentRunRowSchema,
  agentRuntimeInputSchema,
  agentRuntimeResponseSchema,
  auditDataSourcesSchema,
  auditRowSchema,
  cartSummarySchema,
  type checkoutIdempotencyRowSchema,
  completedCheckoutResultSchema,
  handoffRowSchema,
  parseCustomerContextJson,
  type sessionRowSchema,
} from './sqlite-store-schemas.js';

export {
  agentRunRowSchema,
  checkoutIdempotencyRowSchema,
  handoffRowSchema,
  sessionRowSchema,
} from './sqlite-store-schemas.js';

export function openDatabase(databasePath: string): Database {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.run('pragma foreign_keys = on');

  return db;
}

export function migrateSessionStore(db: Database): void {
  db.run(`create table if not exists sessions (
    agent_session_id text primary key,
    merchant_id text not null,
    agent_id text not null,
    channel text not null,
    customer_context_json text not null,
    shopware_sales_channel_id text,
    shopware_context_token text,
    created_at text not null,
    expires_at text
  )`);
}

export function migrateHandoffStore(db: Database): void {
  db.run(`create table if not exists handoffs (
    handoff_id text primary key,
    agent_session_id text not null,
    merchant_id text not null,
    shopware_sales_channel_id text not null,
    shopware_context_token text not null,
    cart_summary_json text not null,
    expires_at text not null,
    status text not null
  )`);
}

export function migrateAuditLog(db: Database): void {
  db.run(`create table if not exists audit_events (
    id integer primary key autoincrement,
    type text not null,
    agent_session_id text not null,
    merchant_id text not null,
    agent_id text not null,
    channel text not null,
    capability text,
    policy_decision text,
    data_sources_json text,
    cart_id text,
    handoff_id text,
    error_name text,
    error_message text,
    occurred_at text not null
  )`);
}

export function migrateAgentRunStore(db: Database): void {
  db.run(`create table if not exists agent_runs (
    run_id text primary key,
    agent_session_id text not null,
    status text not null,
    input_json text not null,
    response_json text,
    error_name text,
    error_message text,
    created_at text not null,
    updated_at text not null
  )`);
}

export function migrateCheckoutIdempotencyStore(db: Database): void {
  db.run(`create table if not exists checkout_idempotency (
    merchant_id text not null,
    agent_session_id text not null,
    idempotency_key text not null,
    result_json text not null,
    created_at text not null,
    primary key (merchant_id, agent_session_id, idempotency_key)
  )`);
}

export function sessionFromRow(row: z.infer<typeof sessionRowSchema>): AgentSession {
  const commerceContext =
    row.shopware_sales_channel_id && row.shopware_context_token
      ? {
          commerceContext: {
            shopwareSalesChannelId: row.shopware_sales_channel_id,
            shopwareContextToken: row.shopware_context_token,
          },
        }
      : {};

  return {
    agentSessionId: row.agent_session_id,
    merchantId: row.merchant_id,
    agentId: row.agent_id,
    channel: row.channel,
    customerContext: readCustomerContext(row.customer_context_json),
    ...commerceContext,
    createdAt: new Date(row.created_at),
    ...(row.expires_at ? { expiresAt: new Date(row.expires_at) } : {}),
  };
}

export function readHandoffRow(value: unknown): HandoffRecord {
  return handoffFromRow(handoffRowSchema.parse(value));
}

export function handoffFromRow(row: z.infer<typeof handoffRowSchema>): HandoffRecord {
  return {
    handoffId: row.handoff_id,
    agentSessionId: row.agent_session_id,
    merchantId: row.merchant_id,
    shopwareSalesChannelId: row.shopware_sales_channel_id,
    shopwareContextToken: row.shopware_context_token,
    cartSummary: readCartSummary(row.cart_summary_json),
    expiresAt: new Date(row.expires_at),
    status: row.status,
  };
}

export function readAuditRow(value: unknown): AuditEvent {
  const row = auditRowSchema.parse(value);

  return {
    type: row.type,
    agentSessionId: row.agent_session_id,
    merchantId: row.merchant_id,
    agentId: row.agent_id,
    channel: row.channel,
    ...(row.capability ? { capability: row.capability } : {}),
    ...(row.policy_decision ? { policyDecision: row.policy_decision } : {}),
    ...(row.data_sources_json
      ? { dataSources: auditDataSourcesSchema.parse(JSON.parse(row.data_sources_json)) }
      : {}),
    ...(row.cart_id ? { cartId: row.cart_id } : {}),
    ...(row.handoff_id ? { handoffId: row.handoff_id } : {}),
    ...(row.error_message
      ? { error: new Error(row.error_message, { cause: row.error_name ?? undefined }) }
      : {}),
    occurredAt: new Date(row.occurred_at),
  };
}

export function auditEventInsertValues(event: AuditEvent): readonly (string | null)[] {
  return [
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
  ];
}

export function agentRunFromRow(row: z.infer<typeof agentRunRowSchema>): AgentRun {
  return {
    runId: row.run_id,
    agentSessionId: row.agent_session_id,
    status: row.status,
    input: readAgentRuntimeInput(row.input_json),
    ...(row.response_json
      ? { response: agentRuntimeResponseSchema.parse(JSON.parse(row.response_json)) }
      : {}),
    ...(row.error_message
      ? { error: new Error(row.error_message, { cause: row.error_name ?? undefined }) }
      : {}),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function checkoutIdempotencyFromRow(
  row: z.infer<typeof checkoutIdempotencyRowSchema>,
): CheckoutIdempotencyRecord {
  return {
    merchantId: row.merchant_id,
    agentSessionId: row.agent_session_id,
    idempotencyKey: row.idempotency_key,
    result: readCompletedCheckoutResult(row.result_json),
    createdAt: new Date(row.created_at),
  };
}

function readCustomerContext(value: string): AgentSession['customerContext'] {
  const parsed = parseCustomerContextJson(value);

  return {
    ...(parsed.customerId ? { customerId: parsed.customerId } : {}),
    ...(parsed.customerGroup ? { customerGroup: parsed.customerGroup } : {}),
    ...(parsed.region ? { region: parsed.region } : {}),
  };
}

function readCartSummary(value: string): HandoffRecord['cartSummary'] {
  const parsed = cartSummarySchema.parse(JSON.parse(value));

  return {
    cartId: parsed.cartId,
    items: parsed.items,
    subtotal: parsed.subtotal,
    ...(parsed.shipping ? { shipping: parsed.shipping } : {}),
    total: parsed.total,
    currency: parsed.currency,
  };
}

function readAgentRuntimeInput(value: string): AgentRun['input'] {
  const parsed = agentRuntimeInputSchema.parse(JSON.parse(value));

  return {
    agentSessionId: parsed.agentSessionId,
    message: parsed.message,
    ...(parsed.messages ? { messages: parsed.messages } : {}),
  };
}

function readCompletedCheckoutResult(value: string): CheckoutIdempotencyRecord['result'] {
  const parsed = completedCheckoutResultSchema.parse(JSON.parse(value));

  return {
    summary: readCartSummary(JSON.stringify(parsed.summary)),
    ...(parsed.orderId ? { orderId: parsed.orderId } : {}),
    status: parsed.status,
  };
}
