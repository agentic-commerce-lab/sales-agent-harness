import type { A2aApi } from '../api/a2a-api.js';
import type { CustomerApi } from '../api/customer-api.js';
import type {
  Ap2PaymentMandate,
  CheckoutHandoffResult,
  CommerceAdapter,
} from '../contracts/commerce.js';
import type { AgentChannel, AgentHarnessConfig } from '../contracts/config.js';
import type { CustomerContext, PublicAgentSession } from '../contracts/session.js';
import type { HandoffStore } from '../handoff/handoff-store.js';
import type { CheckoutIdempotencyStore } from '../harness/checkout-idempotency-store.js';
import type { createExecutableToolRegistry } from '../harness/executable-tool-registry.js';
import type { HarnessCore } from '../harness/harness-core.js';
import type { AuditLogger } from '../observability/audit-log.js';
import type { AgentRuntime, AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import type { InMemoryConversationStore } from '../session/conversation-store.js';
import type { SessionStore } from '../session/session-store.js';

export interface CreateAgentSessionInput {
  readonly channel: AgentChannel;
  readonly customerContext?: CustomerContext;
  readonly shopwareContextToken?: string;
  readonly ttlMs?: number;
}

export interface ChatInput {
  readonly agentSessionId: string;
  readonly message: string;
}

export type CheckoutHandoffValidationResult =
  | {
      readonly status: 'ok';
      readonly handoffId: string;
      readonly summary: CheckoutHandoffResult['summary'];
    }
  | {
      readonly status: 'not_found';
    };

export interface SalesAgentHarnessApp {
  readonly auditLogger: AuditLogger;
  readonly commerceA2aApi: A2aApi;
  readonly commerceCustomerApi: CustomerApi;
  readonly handoffStore: HandoffStore;
  readonly harness: HarnessCore;
  readonly sessionStore: SessionStore;
  createSession(input: CreateAgentSessionInput): PublicAgentSession;
  chat(input: ChatInput): Promise<AgentRuntimeResponse>;
  validateCheckoutHandoff(input: { readonly handoffId: string }): CheckoutHandoffValidationResult;
  recordAp2Mandate(agentSessionId: string, mandate: Ap2PaymentMandate): void;
}

export interface CreateSalesAgentHarnessAppInput {
  readonly config: AgentHarnessConfig;
  readonly adapter: CommerceAdapter;
  readonly checkoutHandoffMode?: 'local' | 'adapter';
  readonly runtimeFactory: (input: {
    readonly tools: ReturnType<typeof createExecutableToolRegistry>;
  }) => AgentRuntime;
  readonly auditLogger?: AuditLogger;
  readonly checkoutIdempotencyStore?: CheckoutIdempotencyStore;
  readonly conversationStore?: InMemoryConversationStore;
  readonly handoffStore?: HandoffStore;
  readonly sessionStore?: SessionStore;
  readonly createId?: () => string;
  readonly now?: () => Date;
}

export interface AppContext {
  readonly auditLogger: AuditLogger;
  readonly checkoutIdempotencyStore: CheckoutIdempotencyStore;
  readonly conversationStore: InMemoryConversationStore;
  readonly createId: () => string;
  readonly handoffStore: HandoffStore;
  readonly now: () => Date;
  readonly sessionStore: SessionStore;
}
