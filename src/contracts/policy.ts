import type { AgentChannel, HarnessCapability } from './config.js';

export type RestrictedCommerceAction =
  | 'placeOrder'
  | 'executePayment'
  | 'acceptLegalTerms'
  | 'createBindingQuote'
  | 'negotiateCustomDiscount'
  | 'modifyCustomerAccount';

export type CommerceAction = HarnessCapability | RestrictedCommerceAction;

export type PolicyDecisionStatus = 'allow' | 'block' | 'escalate';

export type PolicyDecisionReason =
  | 'capability_enabled'
  | 'capability_disabled'
  | 'channel_not_allowed'
  | 'blocked_category'
  | 'blocked_product'
  | 'quantity_limit_exceeded'
  | 'cart_value_limit_exceeded'
  | 'unsupported_region'
  | 'checkout_handoff_disabled'
  | 'checkout_completion_disabled'
  | 'human_approval_required'
  | 'mvp_forbidden_action';

export interface PolicyAuditContext {
  readonly agentSessionId: string;
  readonly merchantId: string;
  readonly agentId: string;
  readonly channel: AgentChannel;
  readonly capability: CommerceAction;
  readonly requestedAt: Date;
}

export interface PolicyDecision {
  readonly status: PolicyDecisionStatus;
  readonly reason: PolicyDecisionReason;
  readonly context: PolicyAuditContext;
  readonly message: string;
}
