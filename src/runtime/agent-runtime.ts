import type { HarnessToolDefinition } from '../harness/tool-registry.js';

export interface AgentRuntimeInput {
  readonly agentSessionId: string;
  readonly message: string;
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
