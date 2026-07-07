import type { CartSummary } from '../contracts/commerce.js';
import type { AgentHarnessConfig, HarnessCapability } from '../contracts/config.js';
import type { PolicyDecision } from '../contracts/policy.js';
import type { AgentSession } from '../contracts/session.js';
import { evaluatePolicy } from '../policy/evaluate-policy.js';
import { maxItemQuantity } from './harness-commerce-context.js';
import type { HarnessStatus } from './harness-types.js';

export interface HarnessCartPolicyInput {
  readonly maxItemQuantity: number;
  /**
   * Cart total in major currency units. Only known after the adapter returned
   * a cart summary, so pre-execution checks omit it and the executor
   * re-evaluates with the real total once the result is available.
   */
  readonly totalAmount?: number | undefined;
}

export function cartPolicyInputFromSummary(summary: CartSummary): HarnessCartPolicyInput {
  return {
    maxItemQuantity: maxItemQuantity(summary.items),
    totalAmount: summary.total.amount,
  };
}

export function evaluateHarnessPolicy(input: {
  readonly config: AgentHarnessConfig;
  readonly session: AgentSession;
  readonly capability: HarnessCapability;
  readonly requestedAt: Date;
  readonly cart?: HarnessCartPolicyInput;
}): PolicyDecision {
  return evaluatePolicy({
    config: input.config,
    context: {
      agentSessionId: input.session.agentSessionId,
      channel: input.session.channel,
      requestedAt: input.requestedAt,
    },
    capability: input.capability,
    ...(input.cart ? { cart: createCartPolicyInput(input.config, input.cart) } : {}),
  });
}

export function toHarnessBlockedStatus(policyDecision: PolicyDecision): HarnessStatus {
  return policyDecision.status === 'escalate' ? 'escalated' : 'blocked';
}

function createCartPolicyInput(config: AgentHarnessConfig, cart: HarnessCartPolicyInput) {
  return {
    totalAmount: cart.totalAmount ?? 0,
    currency: config.policies.maxCartValue.currency,
    maxItemQuantity: cart.maxItemQuantity,
  };
}
