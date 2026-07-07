import { randomUUID } from 'node:crypto';

import { InMemoryHandoffStore } from '../handoff/handoff-store.js';
import { InMemoryCheckoutIdempotencyStore } from '../harness/checkout-idempotency-store.js';
import { HarnessCore } from '../harness/harness-core.js';
import { InMemoryAuditLogger } from '../observability/audit-log.js';
import { InMemoryConversationStore } from '../session/conversation-store.js';
import { InMemorySessionStore } from '../session/session-store.js';
import type { AppContext, CreateSalesAgentHarnessAppInput } from './sales-agent-app-types.js';

export function createAppContext(input: CreateSalesAgentHarnessAppInput): AppContext {
  const now = input.now ?? (() => new Date());

  return {
    auditLogger: input.auditLogger ?? new InMemoryAuditLogger(),
    checkoutIdempotencyStore:
      input.checkoutIdempotencyStore ?? new InMemoryCheckoutIdempotencyStore(),
    conversationStore: input.conversationStore ?? new InMemoryConversationStore(),
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
  const checkoutHandoffOptions = input.checkoutHandoffMode
    ? { checkoutHandoffMode: input.checkoutHandoffMode }
    : {};

  return new HarnessCore({
    config: input.config,
    adapter: input.adapter,
    auditLogger: context.auditLogger,
    checkoutIdempotencyStore: context.checkoutIdempotencyStore,
    handoffStore: context.handoffStore,
    sessionStore: context.sessionStore,
    now: context.now,
    ...checkoutHandoffOptions,
  });
}
