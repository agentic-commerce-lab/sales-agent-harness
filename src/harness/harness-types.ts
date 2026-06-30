import type { PolicyDecision } from '../contracts/policy.js';

export type HarnessStatus = 'ok' | 'blocked' | 'escalated';

export interface HarnessResponse<T> {
  readonly status: HarnessStatus;
  readonly value?: T;
  readonly policyDecision: PolicyDecision;
}

export interface HarnessRequest {
  readonly agentSessionId: string;
}
