import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { BaseMessageLike } from '@langchain/core/messages';
import { trace } from '@opentelemetry/api';

import { createAgent } from './langgraph-agent.js';
import { normalizeDeepAgentResponse } from './langgraph-response.js';
import type {
  CreateLangGraphDeepAgentRuntimeInput,
  DeepAgentGraph,
  LangGraphAgentRun,
  LangGraphAgentRunStore,
  LangGraphRuntimeInput,
  LangGraphRuntimeMessage,
  LangGraphRuntimeResponse,
  RuntimeToolExecutionContext,
} from './langgraph-types.js';

export { normalizeDeepAgentResponse } from './langgraph-response.js';
export { createSqliteLangGraphCheckpointSaver } from './sqlite-checkpoint-saver.js';

const tracer = trace.getTracer('sales-agent-harness');

export class LangGraphDeepAgentRuntime {
  readonly #agent: DeepAgentGraph;
  readonly #toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>;
  readonly #runs = new Map<string, LangGraphAgentRun>();
  readonly #runStore: LangGraphAgentRunStore | undefined;
  readonly #createRunId: () => string;
  readonly #now: () => Date;

  constructor(options: {
    readonly agent: DeepAgentGraph;
    readonly toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>;
    readonly createRunId?: (() => string) | undefined;
    readonly now?: (() => Date) | undefined;
    readonly runStore?: LangGraphAgentRunStore | undefined;
  }) {
    this.#agent = options.agent;
    this.#toolContext = options.toolContext;
    this.#createRunId = options.createRunId ?? randomUUID;
    this.#now = options.now ?? (() => new Date());
    this.#runStore = options.runStore;
  }

  async respond(input: LangGraphRuntimeInput): Promise<LangGraphRuntimeResponse> {
    return tracer.startActiveSpan(
      'agent.respond',
      { attributes: { 'langfuse.session.id': input.agentSessionId } },
      async (span) => {
        try {
          const result = await this.#toolContext.run({ agentSessionId: input.agentSessionId }, () =>
            this.#agent.invoke(
              {
                messages: toLangChainMessages(
                  input.messages ?? [{ role: 'user', content: input.message }],
                ),
                agentSessionId: input.agentSessionId,
              },
              { configurable: { thread_id: input.agentSessionId } },
            ),
          );

          return normalizeDeepAgentResponse(result);
        } finally {
          span.end();
        }
      },
    );
  }

  // fallow-ignore-next-line unused-class-member
  async startRun(input: LangGraphRuntimeInput): Promise<LangGraphAgentRun> {
    return this.#executeRun(this.#createRunId(), input);
  }

  getRun(runId: string): LangGraphAgentRun | undefined {
    return this.#runStore?.get(runId) ?? this.#runs.get(runId);
  }

  // fallow-ignore-next-line unused-class-member
  async resumeRun(runId: string, input: LangGraphRuntimeInput): Promise<LangGraphAgentRun> {
    if (!this.getRun(runId)) {
      throw new Error(`Agent run ${runId} was not found`);
    }

    return this.#executeRun(runId, input);
  }

  // fallow-ignore-next-line unused-class-member
  cancelRun(runId: string): LangGraphAgentRun | undefined {
    const run = this.getRun(runId);

    if (!run) {
      return undefined;
    }

    const cancelled: LangGraphAgentRun = {
      ...run,
      status: 'cancelled',
      updatedAt: this.#now(),
    };
    this.#runs.set(runId, cancelled);
    this.#runStore?.save(cancelled);

    return cancelled;
  }

  async #executeRun(runId: string, input: LangGraphRuntimeInput): Promise<LangGraphAgentRun> {
    const startedAt = this.#now();
    const runningRun: LangGraphAgentRun = {
      runId,
      agentSessionId: input.agentSessionId,
      status: 'running',
      input,
      createdAt: this.#runs.get(runId)?.createdAt ?? startedAt,
      updatedAt: startedAt,
    };
    this.#runs.set(runId, runningRun);
    this.#runStore?.save(runningRun);

    try {
      const response = await this.respond(input);
      const completedRun: LangGraphAgentRun = {
        ...runningRun,
        status: 'completed',
        response,
        updatedAt: this.#now(),
      };
      this.#runs.set(runId, completedRun);
      this.#runStore?.save(completedRun);

      return completedRun;
    } catch (error) {
      const failedRun: LangGraphAgentRun = {
        ...runningRun,
        status: 'failed',
        error: error instanceof Error ? error : new Error('Agent run failed', { cause: error }),
        updatedAt: this.#now(),
      };
      this.#runs.set(runId, failedRun);
      this.#runStore?.save(failedRun);

      return failedRun;
    }
  }
}

export function createLangGraphDeepAgentRuntime(
  input: CreateLangGraphDeepAgentRuntimeInput,
): LangGraphDeepAgentRuntime {
  const toolContext = new AsyncLocalStorage<RuntimeToolExecutionContext>();
  const agent = createAgent(input, toolContext);

  return new LangGraphDeepAgentRuntime({
    agent,
    toolContext,
    createRunId: input.createRunId,
    now: input.now,
    runStore: input.runStore,
  });
}

function toLangChainMessages(messages: readonly LangGraphRuntimeMessage[]): BaseMessageLike[] {
  return messages.map((message) => [message.role === 'user' ? 'human' : 'ai', message.content]);
}
