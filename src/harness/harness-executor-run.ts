import type { HarnessCapability } from '../contracts/config.js';
import type { AgentSession } from '../contracts/session.js';
import type { AuditLogger } from '../observability/audit-log.js';
import { runAllowedHarnessAction } from './harness-action-runner.js';
import type { HarnessExecutorOptions } from './harness-executor.js';
import { recordExecutorPolicy } from './harness-executor-audit.js';
import { evaluateHarnessPolicy, toHarnessBlockedStatus } from './harness-policy.js';
import type { HarnessRequest, HarnessResponse } from './harness-types.js';

export interface ExecuteHarnessRequestInput<T> {
  readonly options: HarnessExecutorOptions;
  readonly capability: HarnessCapability;
  readonly request: HarnessRequest;
  readonly run: (session: AgentSession) => Promise<T>;
  readonly cart?: { readonly maxItemQuantity: number };
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

export async function executeHarnessRequest<T>(
  input: ExecuteHarnessRequestInput<T>,
): Promise<HarnessResponse<T>> {
  const session = requireSession(input.options, input.request.agentSessionId);
  const policyDecision = evaluateHarnessPolicy({
    config: input.options.config,
    session,
    capability: input.capability,
    requestedAt: input.options.now(),
    ...(input.cart ? { cart: input.cart } : {}),
  });

  recordExecutorPolicy({
    auditLogger: input.options.auditLogger,
    session,
    capability: input.capability,
    occurredAt: input.options.now(),
    policyDecision,
  });

  if (policyDecision.status !== 'allow') {
    input.recordAudit(session, 'blocked_action', input.capability);

    return {
      status: toHarnessBlockedStatus(policyDecision),
      policyDecision,
    };
  }

  return runAllowedHarnessAction({
    capability: input.capability,
    session,
    run: input.run,
    policyDecision,
    recordAudit: input.recordAudit,
    recordResult: input.recordResult,
  });
}

function requireSession(options: HarnessExecutorOptions, agentSessionId: string): AgentSession {
  const session = options.sessionStore.getSession(agentSessionId, options.config.merchantId);

  if (!session) {
    throw new Error(`Agent session ${agentSessionId} was not found`);
  }

  return session;
}
