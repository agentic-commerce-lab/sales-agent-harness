import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { agentChannels, harnessCapabilities } from '../contracts/config.js';
import type { AgentSession } from '../contracts/session.js';
import type { HandoffRecord } from '../handoff/handoff-store.js';
import type { CheckoutIdempotencyRecord } from '../harness/checkout-idempotency-store.js';
import type { AuditEvent } from '../observability/audit-log.js';
import type { AgentRun } from '../runtime/agent-runtime.js';

const auditEventTypes = [
  'session_created',
  'user_request',
  'agent_response',
  'tool_call',
  'policy_decision',
  'commerce_call',
  'cart_change',
  'blocked_action',
  'checkout_handoff',
  'checkout_completion',
  'error',
] as const;

const policyDecisionStatuses = ['allow', 'block', 'escalate'] as const;
const agentRunStatuses = ['running', 'completed', 'failed', 'cancelled'] as const;

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

export const sessionRowSchema = z.object({
  agent_session_id: z.string(),
  merchant_id: z.string(),
  agent_id: z.string(),
  channel: z.enum(agentChannels),
  customer_context_json: z.string(),
  shopware_sales_channel_id: z.string().nullable(),
  shopware_context_token: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
});

export const handoffRowSchema = z.object({
  handoff_id: z.string(),
  agent_session_id: z.string(),
  merchant_id: z.string(),
  shopware_sales_channel_id: z.string(),
  shopware_context_token: z.string(),
  cart_summary_json: z.string(),
  expires_at: z.string(),
  status: z.enum(['ready_for_checkout', 'used']),
});

const auditRowSchema = z.object({
  type: z.enum(auditEventTypes),
  agent_session_id: z.string(),
  merchant_id: z.string(),
  agent_id: z.string(),
  channel: z.enum(agentChannels),
  capability: z.enum(harnessCapabilities).nullable(),
  policy_decision: z.enum(policyDecisionStatuses).nullable(),
  data_sources_json: z.string().nullable(),
  cart_id: z.string().nullable(),
  handoff_id: z.string().nullable(),
  error_name: z.string().nullable(),
  error_message: z.string().nullable(),
  occurred_at: z.string(),
});

export const agentRunRowSchema = z.object({
  run_id: z.string(),
  agent_session_id: z.string(),
  status: z.enum(agentRunStatuses),
  input_json: z.string(),
  response_json: z.string().nullable(),
  error_name: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const checkoutIdempotencyRowSchema = z.object({
  merchant_id: z.string(),
  agent_session_id: z.string(),
  idempotency_key: z.string(),
  result_json: z.string(),
  created_at: z.string(),
});

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

const customerContextSchema = z.object({
  customerId: z.string().optional(),
  customerGroup: z.string().optional(),
  region: z.string().optional(),
});

const moneySchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

const cartSummarySchema = z.object({
  cartId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      label: z.string(),
      quantity: z.number(),
      unitPrice: moneySchema,
      totalPrice: moneySchema,
    }),
  ),
  subtotal: moneySchema,
  shipping: moneySchema.optional(),
  total: moneySchema,
  currency: z.string(),
});

const auditDataSourcesSchema = z.array(
  z.enum(['shopware_store_api', 'ucp', 'policy_config', 'session_store']),
);

const agentRuntimeMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const agentRuntimeInputSchema = z.object({
  agentSessionId: z.string(),
  message: z.string(),
  messages: z.array(agentRuntimeMessageSchema).optional(),
});

const agentRuntimeResponseSchema = z.object({
  message: z.string(),
  toolCalls: z.array(z.string()),
});

const completedCheckoutResultSchema = z.object({
  summary: cartSummarySchema,
  orderId: z.string().optional(),
  status: z.literal('completed'),
});

function readCustomerContext(value: string): AgentSession['customerContext'] {
  const parsed = customerContextSchema.parse(JSON.parse(value));

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
