import type { AgentChannel, AgentHarnessConfig } from '../contracts/config.js';
import type { CommerceAction } from '../contracts/policy.js';

export interface PolicyRequestContext {
  readonly agentSessionId: string;
  readonly channel: AgentChannel;
  readonly requestedAt: Date;
}

export interface ProductPolicyInput {
  readonly productId: string;
  readonly categories: readonly string[];
}

export interface CartPolicyInput {
  readonly totalAmount: number;
  readonly currency: string;
  readonly maxItemQuantity: number;
}

export interface EvaluatePolicyInput {
  readonly config: AgentHarnessConfig;
  readonly context: PolicyRequestContext;
  readonly capability: CommerceAction;
  readonly product?: ProductPolicyInput;
  readonly cart?: CartPolicyInput;
  readonly customerRegion?: string;
}
