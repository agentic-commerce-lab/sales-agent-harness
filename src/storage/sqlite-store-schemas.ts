import { z } from 'zod';
import { agentChannels, harnessCapabilities } from '../contracts/config.js';

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

export const auditRowSchema = z.object({
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

const customerContextSchema = z.object({
  customerId: z.string().optional(),
  customerGroup: z.string().optional(),
  region: z.string().optional(),
});

const moneySchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

export const cartSummarySchema = z.object({
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

export const auditDataSourcesSchema = z.array(
  z.enum(['shopware_store_api', 'ucp', 'policy_config', 'session_store']),
);

const agentRuntimeMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const agentRuntimeInputSchema = z.object({
  agentSessionId: z.string(),
  message: z.string(),
  messages: z.array(agentRuntimeMessageSchema).optional(),
});

export const agentRuntimeResponseSchema = z.object({
  message: z.string(),
  toolCalls: z.array(z.string()),
});

export const completedCheckoutResultSchema = z.object({
  summary: cartSummarySchema,
  orderId: z.string().optional(),
  status: z.literal('completed'),
});

export function parseCustomerContextJson(value: string): z.infer<typeof customerContextSchema> {
  return customerContextSchema.parse(JSON.parse(value));
}
