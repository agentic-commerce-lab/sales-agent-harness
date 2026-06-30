import type { AgentHarnessConfig, HarnessCapability } from '../contracts/config.js';
import type { PolicyDecision } from '../contracts/policy.js';
import type { AgentSession } from '../contracts/session.js';
import { evaluatePolicy } from '../policy/evaluate-policy.js';
import type { HarnessStatus } from './harness-types.js';

export interface HarnessCartPolicyInput {
  readonly maxItemQuantity: number;
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
    ...(input.cart
      ? { cart: createCartPolicyInput(input.config, input.cart.maxItemQuantity) }
      : {}),
  });
}

export function toHarnessBlockedStatus(policyDecision: PolicyDecision): HarnessStatus {
  return policyDecision.status === 'escalate' ? 'escalated' : 'blocked';
}

function createCartPolicyInput(config: AgentHarnessConfig, maxItemQuantity: number) {
  return {
    totalAmount: 0,
    currency: config.policies.maxCartValue.currency,
    maxItemQuantity,
  };
}
