import type { PolicyDecision, PolicyDecisionReason } from '../contracts/policy.js';
import type { EvaluatePolicyInput } from './policy-input.js';

export function createDecision(
  input: EvaluatePolicyInput,
  status: PolicyDecision['status'],
  reason: PolicyDecisionReason,
  message: string,
): PolicyDecision {
  return {
    status,
    reason,
    message,
    context: {
      agentSessionId: input.context.agentSessionId,
      merchantId: input.config.merchantId,
      agentId: input.config.agentId,
      channel: input.context.channel,
      capability: input.capability,
      requestedAt: input.context.requestedAt,
    },
  };
}
