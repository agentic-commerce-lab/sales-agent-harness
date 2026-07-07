import type { HarnessCapability } from '../contracts/config.js';
import type { AgentSession } from '../contracts/session.js';
import type { AuditLogger } from '../observability/audit-log.js';
import { runAllowedHarnessAction } from './harness-action-runner.js';
import type { HarnessExecutorCartOptions, HarnessExecutorOptions } from './harness-executor.js';
import { recordExecutorPolicy } from './harness-executor-audit.js';
import {
  cartPolicyInputFromSummary,
  evaluateHarnessPolicy,
  toHarnessBlockedStatus,
} from './harness-policy.js';
import type { HarnessRequest, HarnessResponse } from './harness-types.js';

export interface ExecuteHarnessRequestInput<T> {
  readonly options: HarnessExecutorOptions;
  readonly capability: HarnessCapability;
  readonly request: HarnessRequest;
  readonly run: (session: AgentSession) => Promise<T>;
  readonly cart?: HarnessExecutorCartOptions<T>;
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

  const response = await runAllowedHarnessAction({
    capability: input.capability,
    session,
    run: input.run,
    policyDecision,
    recordAudit: input.recordAudit,
    recordResult: input.recordResult,
  });

  return enforceCartLimitsOnResult(input, session, response);
}

/**
 * Cart totals are only known after the adapter call, so cart value and
 * quantity limits are re-evaluated against the returned cart summary. A
 * violating result is withheld and reported as blocked.
 */
function enforceCartLimitsOnResult<T>(
  input: ExecuteHarnessRequestInput<T>,
  session: AgentSession,
  response: HarnessResponse<T>,
): HarnessResponse<T> {
  const summary =
    response.status === 'ok' && response.value !== undefined
      ? input.cart?.summaryFromValue?.(response.value)
      : undefined;

  if (!summary) {
    return response;
  }

  const policyDecision = evaluateHarnessPolicy({
    config: input.options.config,
    session,
    capability: input.capability,
    requestedAt: input.options.now(),
    cart: cartPolicyInputFromSummary(summary),
  });

  if (policyDecision.status === 'allow') {
    return response;
  }

  recordExecutorPolicy({
    auditLogger: input.options.auditLogger,
    session,
    capability: input.capability,
    occurredAt: input.options.now(),
    policyDecision,
  });
  input.recordAudit(session, 'blocked_action', input.capability);

  return {
    status: toHarnessBlockedStatus(policyDecision),
    policyDecision,
  };
}

function requireSession(options: HarnessExecutorOptions, agentSessionId: string): AgentSession {
  const session = options.sessionStore.getSession(agentSessionId, options.config.merchantId);

  if (!session) {
    throw new Error(`Agent session ${agentSessionId} was not found`);
  }

  return session;
}
