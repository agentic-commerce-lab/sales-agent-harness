import type { CartSummary } from '../contracts/commerce.js';
import type { AgentHarnessConfig, HarnessCapability } from '../contracts/config.js';
import type { AgentSession } from '../contracts/session.js';
import type { AuditLogger } from '../observability/audit-log.js';
import type { SessionStore } from '../session/session-store.js';
import { recordHarnessAudit } from './harness-audit.js';
import { recordExecutorResult } from './harness-executor-audit.js';
import { executeHarnessRequest } from './harness-executor-run.js';
import type { HarnessRequest, HarnessResponse } from './harness-types.js';

export interface HarnessExecutorCartOptions<T> {
  readonly maxItemQuantity: number;
  /**
   * Extracts the cart summary from a successful result so cart limits like
   * maxCartValue can be enforced with the real total, which is only known
   * after the adapter call.
   */
  readonly summaryFromValue?: (value: T) => CartSummary | undefined;
}

export interface HarnessExecutorOptions {
  readonly config: AgentHarnessConfig;
  readonly auditLogger: AuditLogger;
  readonly sessionStore: SessionStore;
  readonly now: () => Date;
}

export interface HarnessExecutor {
  execute<T>(
    capability: HarnessCapability,
    request: HarnessRequest,
    run: (session: AgentSession) => Promise<T>,
    cart?: HarnessExecutorCartOptions<T>,
  ): Promise<HarnessResponse<T>>;
  recordAudit(
    session: AgentSession,
    type: Parameters<AuditLogger['record']>[0]['type'],
    capability: HarnessCapability,
    fields?: Partial<Parameters<AuditLogger['record']>[0]>,
  ): void;
}

export function createHarnessExecutor(options: HarnessExecutorOptions): HarnessExecutor {
  const execute: HarnessExecutor['execute'] = (capability, request, run, cart) =>
    executeHarnessRequest({
      options,
      capability,
      request,
      run,
      ...(cart ? { cart } : {}),
      recordAudit,
      recordResult,
    });

  const recordAudit: HarnessExecutor['recordAudit'] = (
    session: AgentSession,
    type: Parameters<AuditLogger['record']>[0]['type'],
    capability: HarnessCapability,
    fields: Partial<Parameters<AuditLogger['record']>[0]> = {},
  ): void => {
    recordHarnessAudit({
      auditLogger: options.auditLogger,
      session,
      type,
      capability,
      occurredAt: options.now(),
      fields,
    });
  };

  const recordResult = (
    session: AgentSession,
    capability: HarnessCapability,
    value: unknown,
  ): void =>
    recordExecutorResult({
      auditLogger: options.auditLogger,
      session,
      capability,
      occurredAt: options.now(),
      value,
    });

  return { execute, recordAudit };
}
