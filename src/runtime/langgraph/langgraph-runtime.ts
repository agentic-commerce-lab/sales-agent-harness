interface LangGraphRuntimeTool {
  readonly name: string;
}

interface LangGraphRuntimeInput {
  readonly agentSessionId: string;
  readonly message: string;
}

interface LangGraphRuntimeResponse {
  readonly message: string;
  readonly toolCalls: readonly string[];
}

export interface LangGraphDeepAgentInvoker {
  invoke(input: LangGraphRuntimeInput, tools: readonly string[]): Promise<LangGraphRuntimeResponse>;
}

export class LangGraphDeepAgentRuntime {
  readonly #tools: readonly string[];
  readonly #invoker: LangGraphDeepAgentInvoker;

  constructor(options: {
    readonly tools: readonly LangGraphRuntimeTool[];
    readonly invoker: LangGraphDeepAgentInvoker;
  }) {
    this.#tools = options.tools.map((tool) => tool.name);
    this.#invoker = options.invoker;
  }

  respond(input: LangGraphRuntimeInput): Promise<LangGraphRuntimeResponse> {
    return this.#invoker.invoke(input, this.#tools);
  }
}
