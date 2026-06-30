import type { HarnessCapability } from '../contracts/config.js';
import type { PolicyDecision } from '../contracts/policy.js';
import type { AgentSession } from '../contracts/session.js';
import type { AuditLogger } from '../observability/audit-log.js';
import { recordPolicyDecision, recordResultAudit } from './harness-audit.js';

export interface HarnessExecutorAuditInput {
  readonly auditLogger: AuditLogger;
  readonly session: AgentSession;
  readonly capability: HarnessCapability;
  readonly occurredAt: Date;
}

export function recordExecutorPolicy(
  input: HarnessExecutorAuditInput & { readonly policyDecision: PolicyDecision },
): void {
  recordPolicyDecision(input);
}

export function recordExecutorResult(
  input: HarnessExecutorAuditInput & { readonly value: unknown },
): void {
  recordResultAudit(input);
}
