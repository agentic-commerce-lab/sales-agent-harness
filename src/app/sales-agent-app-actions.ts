import { randomUUID } from 'node:crypto';

import { InMemoryHandoffStore } from '../handoff/handoff-store.js';
import { HarnessCore } from '../harness/harness-core.js';
import { InMemoryAuditLogger } from '../observability/audit-log.js';
import { InMemorySessionStore } from '../session/session-store.js';
import type { AppContext, CreateSalesAgentHarnessAppInput } from './sales-agent-app-types.js';

export function createAppContext(input: CreateSalesAgentHarnessAppInput): AppContext {
  const now = input.now ?? (() => new Date());

  return {
    auditLogger: input.auditLogger ?? new InMemoryAuditLogger(),
    createId: input.createId ?? (() => randomUUID()),
    handoffStore: input.handoffStore ?? new InMemoryHandoffStore({ now }),
    now,
    sessionStore: input.sessionStore ?? new InMemorySessionStore({ now }),
  };
}

export function createHarness(
  input: CreateSalesAgentHarnessAppInput,
  context: AppContext,
): HarnessCore {
  return new HarnessCore({
    config: input.config,
    adapter: input.adapter,
    auditLogger: context.auditLogger,
    handoffStore: context.handoffStore,
    sessionStore: context.sessionStore,
    now: context.now,
  });
}
