import type { BaseMessageLike } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { CreateDeepAgentParams } from 'deepagents';
import type { z } from 'zod';

export interface LangGraphRuntimeMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface LangGraphRuntimeInput {
  readonly agentSessionId: string;
  readonly message: string;
  readonly messages?: readonly LangGraphRuntimeMessage[];
}

export interface LangGraphRuntimeResponse {
  readonly message: string;
  readonly toolCalls: readonly string[];
}

export interface DeepAgentInvokeInput {
  readonly messages: BaseMessageLike[];
  readonly agentSessionId: string;
}

export interface DeepAgentGraph {
  invoke(input: DeepAgentInvokeInput): Promise<unknown>;
}

export type DeepAgentModel = NonNullable<CreateDeepAgentParams['model']>;

export interface DeepAgentFactoryParams {
  readonly model: DeepAgentModel;
  readonly tools: readonly StructuredToolInterface[];
  readonly systemPrompt: string;
}

export interface ModelFactoryInput {
  readonly apiKey: string;
  readonly model: string;
}

export interface RuntimeToolExecutionContext {
  readonly agentSessionId: string;
}

export interface ExecutableLangGraphRuntimeTool {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  execute(input: Record<string, unknown>, context: RuntimeToolExecutionContext): Promise<unknown>;
}

export interface CreateLangGraphDeepAgentRuntimeInput {
  readonly apiKey: string;
  readonly modelName: string;
  readonly tools: readonly ExecutableLangGraphRuntimeTool[];
  readonly systemPrompt?: string;
  readonly createDeepAgent?: (params: DeepAgentFactoryParams) => DeepAgentGraph;
  readonly createModel?: (input: ModelFactoryInput) => DeepAgentModel;
}
