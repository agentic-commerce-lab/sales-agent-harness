import type { A2aApi } from '../api/a2a-api.js';
import type { CustomerApi } from '../api/customer-api.js';
import type { CheckoutHandoffResult, CommerceAdapter } from '../contracts/commerce.js';
import type { AgentChannel, AgentHarnessConfig } from '../contracts/config.js';
import type { CustomerContext, PublicAgentSession } from '../contracts/session.js';
import type { InMemoryHandoffStore } from '../handoff/handoff-store.js';
import type { createExecutableToolRegistry } from '../harness/executable-tool-registry.js';
import type { HarnessCore } from '../harness/harness-core.js';
import type { InMemoryAuditLogger } from '../observability/audit-log.js';
import type { AgentRuntime, AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import type { InMemoryConversationStore } from '../session/conversation-store.js';
import type { InMemorySessionStore } from '../session/session-store.js';

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
  readonly auditLogger: InMemoryAuditLogger;
  readonly commerceA2aApi: A2aApi;
  readonly commerceCustomerApi: CustomerApi;
  readonly handoffStore: InMemoryHandoffStore;
  readonly harness: HarnessCore;
  readonly sessionStore: InMemorySessionStore;
  createSession(input: CreateAgentSessionInput): PublicAgentSession;
  chat(input: ChatInput): Promise<AgentRuntimeResponse>;
  validateCheckoutHandoff(input: { readonly handoffId: string }): CheckoutHandoffValidationResult;
}

export interface CreateSalesAgentHarnessAppInput {
  readonly config: AgentHarnessConfig;
  readonly adapter: CommerceAdapter;
  readonly runtimeFactory: (input: {
    readonly tools: ReturnType<typeof createExecutableToolRegistry>;
  }) => AgentRuntime;
  readonly auditLogger?: InMemoryAuditLogger;
  readonly conversationStore?: InMemoryConversationStore;
  readonly handoffStore?: InMemoryHandoffStore;
  readonly sessionStore?: InMemorySessionStore;
  readonly createId?: () => string;
  readonly now?: () => Date;
}

export interface AppContext {
  readonly auditLogger: InMemoryAuditLogger;
  readonly conversationStore: InMemoryConversationStore;
  readonly createId: () => string;
  readonly handoffStore: InMemoryHandoffStore;
  readonly now: () => Date;
  readonly sessionStore: InMemorySessionStore;
}
