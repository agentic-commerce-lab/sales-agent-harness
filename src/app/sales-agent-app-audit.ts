import type { AuditLogger } from '../observability/audit-log.js';
import type { InMemorySessionStore } from '../session/session-store.js';

export function recordAppAudit(
  auditLogger: AuditLogger,
  session: Parameters<InMemorySessionStore['createSession']>[0],
  type: Parameters<AuditLogger['record']>[0]['type'],
  now: () => Date,
): void {
  auditLogger.record({
    type,
    agentSessionId: session.agentSessionId,
    merchantId: session.merchantId,
    agentId: session.agentId,
    channel: session.channel,
    occurredAt: now(),
  });
}
