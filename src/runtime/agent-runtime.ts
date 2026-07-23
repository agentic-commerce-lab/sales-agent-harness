import type { CheckoutTerms, CompletedCheckoutResult } from '../contracts/commerce.js';
import type { HarnessToolDefinition } from '../harness/tool-registry.js';

export interface AgentRuntimeMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface AgentRuntimeInput {
  readonly agentSessionId: string;
  readonly message: string;
  readonly messages?: readonly AgentRuntimeMessage[];
}

export interface AgentRuntimeResponse {
  readonly message: string;
  readonly toolCalls: readonly string[];
  /** Structured result of a checkout completed during this turn, if any. */
  readonly completedCheckout?: CompletedCheckoutResult | undefined;
  /** Real terms of a checkout prepared but not yet completed, if any. */
  readonly pendingCheckoutTerms?: CheckoutTerms | undefined;
}

export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentRun {
  readonly runId: string;
  readonly agentSessionId: string;
  readonly status: AgentRunStatus;
  readonly input: AgentRuntimeInput;
  readonly response?: AgentRuntimeResponse | undefined;
  readonly error?: Error | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AgentRuntime {
  respond(input: AgentRuntimeInput): Promise<AgentRuntimeResponse>;
  startRun(input: AgentRuntimeInput): Promise<AgentRun>;
  getRun(runId: string): AgentRun | undefined;
  resumeRun(runId: string, input: AgentRuntimeInput): Promise<AgentRun>;
  cancelRun(runId: string): AgentRun | undefined;
}

export interface AgentRuntimeFactoryInput {
  readonly tools: readonly HarnessToolDefinition[];
}
