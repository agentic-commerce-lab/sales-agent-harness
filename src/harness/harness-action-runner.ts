import type { HarnessCapability } from '../contracts/config.js';
import type { AgentSession } from '../contracts/session.js';
import type { AuditLogger } from '../observability/audit-log.js';
import { normalizeError } from './harness-errors.js';
import type { HarnessResponse } from './harness-types.js';

export interface RunAllowedHarnessActionInput<T> {
  readonly capability: HarnessCapability;
  readonly session: AgentSession;
  readonly run: (session: AgentSession) => Promise<T>;
  readonly policyDecision: HarnessResponse<T>['policyDecision'];
  readonly recordAudit: (
    session: AgentSession,
    type: Parameters<AuditLogger['record']>[0]['type'],
    capability: HarnessCapability,
    fields?: Partial<Parameters<AuditLogger['record']>[0]>,
  ) => void;
  readonly recordResult: (
    session: AgentSession,
    capability: HarnessCapability,
    value: unknown,
  ) => void;
}

export async function runAllowedHarnessAction<T>(
  input: RunAllowedHarnessActionInput<T>,
): Promise<HarnessResponse<T>> {
  try {
    input.recordAudit(input.session, 'tool_call', input.capability);
    input.recordAudit(input.session, 'commerce_call', input.capability);
    const value = await input.run(input.session);
    input.recordResult(input.session, input.capability, value);

    return { status: 'ok', value, policyDecision: input.policyDecision };
  } catch (error) {
    input.recordAudit(input.session, 'error', input.capability, { error: normalizeError(error) });
    throw error;
  }
}
