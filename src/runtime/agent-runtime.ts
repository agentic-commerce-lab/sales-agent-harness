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
}

export interface AgentRuntime {
  respond(input: AgentRuntimeInput): Promise<AgentRuntimeResponse>;
}

export interface AgentRuntimeFactoryInput {
  readonly tools: readonly HarnessToolDefinition[];
}
