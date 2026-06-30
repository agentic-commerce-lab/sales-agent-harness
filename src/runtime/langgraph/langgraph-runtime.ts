import { AsyncLocalStorage } from 'node:async_hooks';

import { createAgent } from './langgraph-agent.js';
import { normalizeDeepAgentResponse } from './langgraph-response.js';
import type {
  CreateLangGraphDeepAgentRuntimeInput,
  DeepAgentGraph,
  LangGraphRuntimeInput,
  LangGraphRuntimeResponse,
  RuntimeToolExecutionContext,
} from './langgraph-types.js';

export { normalizeDeepAgentResponse } from './langgraph-response.js';
export type {
  CreateLangGraphDeepAgentRuntimeInput,
  // fallow-ignore-next-line unused-type
  ExecutableLangGraphRuntimeTool,
  LangGraphRuntimeInput,
  LangGraphRuntimeResponse,
} from './langgraph-types.js';

export class LangGraphDeepAgentRuntime {
  readonly #agent: DeepAgentGraph;
  readonly #toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>;

  constructor(options: {
    readonly agent: DeepAgentGraph;
    readonly toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>;
  }) {
    this.#agent = options.agent;
    this.#toolContext = options.toolContext;
  }

  async respond(input: LangGraphRuntimeInput): Promise<LangGraphRuntimeResponse> {
    const result = await this.#toolContext.run({ agentSessionId: input.agentSessionId }, () =>
      this.#agent.invoke({
        messages: [{ role: 'user', content: input.message }],
        agentSessionId: input.agentSessionId,
      }),
    );

    return normalizeDeepAgentResponse(result);
  }
}

export function createLangGraphDeepAgentRuntime(
  input: CreateLangGraphDeepAgentRuntimeInput,
): LangGraphDeepAgentRuntime {
  const toolContext = new AsyncLocalStorage<RuntimeToolExecutionContext>();
  const agent = createAgent(input, toolContext);

  return new LangGraphDeepAgentRuntime({ agent, toolContext });
}
