import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  createLangGraphDeepAgentRuntime,
  createSqliteLangGraphCheckpointSaver,
  normalizeDeepAgentResponse,
} from '../../src/runtime/langgraph/langgraph-runtime.js';

describe('createLangGraphDeepAgentRuntime', () => {
  test('creates a Deep Agent with the configured model and enabled harness tools', async () => {
    const created = createRuntimeWithFakeDeepAgent();

    expect(created.model).toEqual({
      apiKey: 'test-key',
      model: 'gpt-5-mini',
    });
    expect(created.deepAgentParams?.tools?.map((runtimeTool) => runtimeTool.name)).toEqual([
      'searchProducts',
      'createCart',
    ]);
    expect(created.deepAgentParams?.systemPrompt).toContain('Sales Agent Harness');
  });

  test('instructs the agent to sell only shop-returned products and state unknown data', async () => {
    const created = createRuntimeWithFakeDeepAgent();
    const prompt = created.deepAgentParams?.systemPrompt ?? '';

    expect(prompt).toContain('Only sell products that were returned by harness tools');
    expect(prompt).toContain('Do not recommend substitute products from general knowledge');
    expect(prompt).toContain(
      'If price, availability, delivery, promotion, or product details are missing',
    );
    expect(prompt).toContain('state that the shop data is unknown');
    expect(prompt).toContain('If a returned product is unavailable');
  });

  test('passes a LangGraph checkpointer into Deep Agents when configured', async () => {
    const checkpointSaver = true;
    const created = createRuntimeWithFakeDeepAgent({ checkpointSaver });

    expect(created.deepAgentParams?.checkpointer).toBe(checkpointSaver);
  });

  test('exports the Bun SQLite LangGraph checkpointer factory', async () => {
    expect(createSqliteLangGraphCheckpointSaver).toBeFunction();
  });

  test('wraps executable harness tools as LangChain structured tools', async () => {
    const created = createRuntimeWithFakeDeepAgent();

    await created.runtime.respond({ agentSessionId: 'session-1', message: 'Find jackets' });

    expect(created.toolInputs).toEqual([{ query: 'jacket', limit: 2 }]);
    expect(created.toolResults).toEqual([
      JSON.stringify({
        status: 'ok',
        value: { products: [{ id: 'product-1', label: 'Trusted Jacket', categories: [] }] },
      }),
    ]);
  });

  test('normalizes Deep Agent output into the runtime response shape', async () => {
    const created = createRuntimeWithFakeDeepAgent();

    const response = await created.runtime.respond({
      agentSessionId: 'session-1',
      message: 'Find jackets',
    });

    expect(created.invocations).toEqual([
      {
        input: { messages: [['human', 'Find jackets']], agentSessionId: 'session-1' },
        options: { configurable: { thread_id: 'session-1' } },
      },
    ]);
    expect(response).toEqual({
      message: 'I found a trusted jacket.',
      toolCalls: ['searchProducts'],
    });
  });
});

describe('createLangGraphDeepAgentRuntime conversation context', () => {
  test('passes full conversation messages into the Deep Agent', async () => {
    const created = createRuntimeWithFakeDeepAgent();

    await created.runtime.respond({
      agentSessionId: 'session-1',
      message: 'Prepare checkout for that cart.',
      messages: [
        {
          role: 'user',
          content: 'Add product 3ac014f329884b57a2cce5a29f34779c to a cart.',
        },
        {
          role: 'assistant',
          content: 'Created cart draft with ID: cart',
        },
        {
          role: 'user',
          content: 'Prepare checkout for that cart.',
        },
      ],
    });

    expect(created.invocations.at(-1)).toEqual({
      input: {
        messages: [
          ['human', 'Add product 3ac014f329884b57a2cce5a29f34779c to a cart.'],
          ['ai', 'Created cart draft with ID: cart'],
          ['human', 'Prepare checkout for that cart.'],
        ],
        agentSessionId: 'session-1',
      },
      options: { configurable: { thread_id: 'session-1' } },
    });
  });

  test('passes the active agent session ID into tool execution', async () => {
    let toolContext: unknown;
    const runtime = createLangGraphDeepAgentRuntime({
      apiKey: 'test-key',
      modelName: 'gpt-5-mini',
      tools: [
        {
          name: 'searchProducts',
          description: 'Search products from trusted commerce data.',
          schema: z.object({ query: z.string() }),
          execute: async (_input, context) => {
            toolContext = context;
            return { status: 'ok', value: { products: [] } };
          },
        },
      ],
      createModel: () => 'fake-model',
      createDeepAgent: (params) => ({
        invoke: async () => {
          await params.tools?.[0]?.invoke({ query: 'jacket' });
          return { messages: [{ role: 'assistant', content: 'Done.' }] };
        },
      }),
    });

    await runtime.respond({ agentSessionId: 'session-1', message: 'Find jackets' });

    expect(toolContext).toEqual({ agentSessionId: 'session-1' });
  });
});

describe('createLangGraphDeepAgentRuntime run lifecycle', () => {
  test('starts and retrieves completed runs with normalized responses', async () => {
    const created = createRuntimeWithFakeDeepAgent();

    const run = await created.runtime.startRun({
      agentSessionId: 'session-1',
      message: 'Find jackets',
    });
    const storedRun = created.runtime.getRun(run.runId);

    expect(run.status).toBe('completed');
    expect(run.response).toEqual({
      message: 'I found a trusted jacket.',
      toolCalls: ['searchProducts'],
    });
    expect(storedRun).toEqual(run);
  });

  test('resumes an existing run with new input and preserves the run id', async () => {
    const created = createRuntimeWithFakeDeepAgent();
    const run = await created.runtime.startRun({
      agentSessionId: 'session-1',
      message: 'Find jackets',
    });

    const resumed = await created.runtime.resumeRun(run.runId, {
      agentSessionId: 'session-1',
      message: 'Add one to cart',
    });

    expect(resumed.runId).toBe(run.runId);
    expect(resumed.status).toBe('completed');
    expect(created.invocations).toHaveLength(2);
  });

  test('cancels a tracked run without deleting its audit-friendly record', async () => {
    const created = createRuntimeWithFakeDeepAgent();
    const run = await created.runtime.startRun({
      agentSessionId: 'session-1',
      message: 'Find jackets',
    });

    const cancelled = created.runtime.cancelRun(run.runId);

    expect(cancelled?.status).toBe('cancelled');
    expect(created.runtime.getRun(run.runId)?.status).toBe('cancelled');
  });
});

describe('normalizeDeepAgentResponse', () => {
  test('extracts string content and tool call names from the final assistant message', () => {
    const response = normalizeDeepAgentResponse({
      messages: [
        { role: 'user', content: 'Find jackets' },
        {
          role: 'assistant',
          content: 'I found a trusted jacket.',
          tool_calls: [{ name: 'searchProducts' }],
        },
      ],
    });

    expect(response).toEqual({
      message: 'I found a trusted jacket.',
      toolCalls: ['searchProducts'],
    });
  });
});

function createRuntimeWithFakeDeepAgent(options: CreateRuntimeWithFakeDeepAgentOptions = {}) {
  const invocations: unknown[] = [];
  const toolInputs: unknown[] = [];
  const toolResults: unknown[] = [];
  let deepAgentParams: FakeDeepAgentParams | undefined;
  let model: unknown;
  const runtime = createLangGraphDeepAgentRuntime({
    apiKey: 'test-key',
    modelName: 'gpt-5-mini',
    checkpointSaver: options.checkpointSaver,
    tools: [
      {
        name: 'searchProducts',
        description: 'Search products from trusted commerce data.',
        schema: z.object({ query: z.string(), limit: z.number().optional() }),
        execute: async (input) => {
          toolInputs.push(input);
          return {
            status: 'ok',
            value: {
              products: [{ id: 'product-1', label: 'Trusted Jacket', categories: [] }],
            },
          };
        },
      },
      {
        name: 'createCart',
        description: 'Create a non-binding cart draft.',
        schema: z.object({
          items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
        }),
        execute: async () => ({ status: 'blocked', reason: 'capability_disabled' }),
      },
    ],
    createModel: (input) => {
      model = input;
      return 'fake-model';
    },
    createDeepAgent: (params) => {
      deepAgentParams = params;
      return {
        invoke: async (input: unknown, invokeOptions?: unknown) => {
          invocations.push({ input, options: invokeOptions });
          const searchTool = params.tools?.find(
            (runtimeTool) => runtimeTool.name === 'searchProducts',
          );
          toolResults.push(await searchTool?.invoke({ query: 'jacket', limit: 2 }));
          return {
            messages: [
              {
                role: 'assistant',
                content: 'I found a trusted jacket.',
                tool_calls: [{ name: 'searchProducts' }],
              },
            ],
          };
        },
      };
    },
  });

  return { deepAgentParams, invocations, model, runtime, toolInputs, toolResults };
}

interface FakeDeepAgentParams {
  readonly model: unknown;
  readonly tools?: readonly { readonly name: string; invoke(input: unknown): Promise<unknown> }[];
  readonly systemPrompt?: string;
  readonly checkpointer?: unknown;
}

interface CreateRuntimeWithFakeDeepAgentOptions {
  readonly checkpointSaver?: Parameters<
    typeof createLangGraphDeepAgentRuntime
  >[0]['checkpointSaver'];
}
