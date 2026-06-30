import type { AgentChannel, HarnessCapability } from '../contracts/config.js';
import type { PolicyDecisionStatus } from '../contracts/policy.js';

export type AuditEventType =
  | 'session_created'
  | 'user_request'
  | 'agent_response'
  | 'tool_call'
  | 'policy_decision'
  | 'shopware_call'
  | 'cart_change'
  | 'blocked_action'
  | 'checkout_handoff'
  | 'error';

export type AuditDataSource =
  | 'shopware_store_api'
  | 'shopware_ucp'
  | 'policy_config'
  | 'session_store';

export interface AuditEvent {
  readonly type: AuditEventType;
  readonly agentSessionId: string;
  readonly merchantId: string;
  readonly agentId: string;
  readonly channel: AgentChannel;
  readonly capability?: HarnessCapability;
  readonly policyDecision?: PolicyDecisionStatus;
  readonly dataSources?: readonly AuditDataSource[];
  readonly cartId?: string;
  readonly handoffId?: string;
  readonly error?: Error;
  readonly occurredAt: Date;
}

export interface AuditLogger {
  record(event: AuditEvent): void;
}

export class InMemoryAuditLogger implements AuditLogger {
  readonly #events: AuditEvent[] = [];

  get events(): readonly AuditEvent[] {
    return this.#events;
  }

  record(event: AuditEvent): void {
    this.#events.push(event);
  }
}
