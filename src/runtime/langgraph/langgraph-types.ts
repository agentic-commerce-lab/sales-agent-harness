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

export interface LangGraphAgentRun {
  readonly runId: string;
  readonly agentSessionId: string;
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled';
  readonly input: LangGraphRuntimeInput;
  readonly response?: LangGraphRuntimeResponse | undefined;
  readonly error?: Error | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LangGraphAgentRunStore {
  get(runId: string): LangGraphAgentRun | undefined;
  save(run: LangGraphAgentRun): void;
}

export interface DeepAgentInvokeInput {
  readonly messages: BaseMessageLike[];
  readonly agentSessionId: string;
}

export interface DeepAgentInvokeOptions {
  readonly configurable: {
    readonly thread_id: string;
  };
}

export interface DeepAgentGraph {
  invoke(input: DeepAgentInvokeInput, options?: DeepAgentInvokeOptions): Promise<unknown>;
}

export type DeepAgentModel = NonNullable<CreateDeepAgentParams['model']>;
export type LangGraphCheckpointSaver = NonNullable<CreateDeepAgentParams['checkpointer']>;

export interface DeepAgentFactoryParams {
  readonly model: DeepAgentModel;
  readonly tools: readonly StructuredToolInterface[];
  readonly systemPrompt: string;
  readonly checkpointer?: LangGraphCheckpointSaver | undefined;
}

export interface ModelFactoryInput {
  readonly apiKey: string;
  readonly model: string;
  readonly baseURL?: string | undefined;
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
  readonly baseURL?: string | undefined;
  readonly tools: readonly ExecutableLangGraphRuntimeTool[];
  readonly systemPrompt?: string | undefined;
  readonly createDeepAgent?: (params: DeepAgentFactoryParams) => DeepAgentGraph;
  readonly createModel?: (input: ModelFactoryInput) => DeepAgentModel;
  readonly createRunId?: () => string;
  readonly now?: () => Date;
  readonly runStore?: LangGraphAgentRunStore | undefined;
  readonly checkpointSaver?: LangGraphCheckpointSaver | undefined;
}
