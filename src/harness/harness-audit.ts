import type { CartResult } from '../contracts/commerce.js';
import type { HarnessCapability } from '../contracts/config.js';
import type { PolicyDecision } from '../contracts/policy.js';
import type { AgentSession } from '../contracts/session.js';
import type { AuditLogger } from '../observability/audit-log.js';

export interface HarnessAuditInput {
  readonly auditLogger: AuditLogger;
  readonly session: AgentSession;
  readonly type: Parameters<AuditLogger['record']>[0]['type'];
  readonly capability: HarnessCapability;
  readonly occurredAt: Date;
  readonly fields?: Partial<Parameters<AuditLogger['record']>[0]>;
}

export function recordHarnessAudit(input: HarnessAuditInput): void {
  input.auditLogger.record({
    type: input.type,
    agentSessionId: input.session.agentSessionId,
    merchantId: input.session.merchantId,
    agentId: input.session.agentId,
    channel: input.session.channel,
    capability: input.capability,
    occurredAt: input.occurredAt,
    ...input.fields,
  });
}

export function recordPolicyDecision(
  input: Omit<HarnessAuditInput, 'fields' | 'type'> & {
    readonly policyDecision: PolicyDecision;
  },
): void {
  recordHarnessAudit({
    ...input,
    type: 'policy_decision',
    fields: {
      policyDecision: input.policyDecision.status,
      dataSources: ['policy_config'],
    },
  });
}

export function recordResultAudit(
  input: Omit<HarnessAuditInput, 'fields' | 'type'> & {
    readonly value: unknown;
  },
): void {
  if (input.capability !== 'createCart' && input.capability !== 'updateCart') {
    return;
  }

  if (!isCartResult(input.value)) {
    return;
  }

  recordHarnessAudit({
    ...input,
    type: 'cart_change',
    fields: {
      cartId: input.value.cart.cartId,
      dataSources: [input.value.dataSource],
    },
  });
}

function isCartResult(value: unknown): value is CartResult {
  if (!isRecord(value)) {
    return false;
  }

  const cart = value.cart;

  if (!isRecord(cart)) {
    return false;
  }

  return typeof cart.cartId === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
