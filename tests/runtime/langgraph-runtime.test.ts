import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  createLangGraphDeepAgentRuntime,
  normalizeDeepAgentResponse,
} from '../../src/runtime/langgraph/langgraph-runtime.js';

describe('createLangGraphDeepAgentRuntime', () => {
  test('creates a Deep Agent with the configured model and enabled harness tools', async () => {
    const created = createRuntimeWithFakeDeepAgent();

    expect(created.model).toEqual({
      apiKey: 'test-key',
      model: 'gpt-5-mini',
      temperature: 0,
    });
    expect(created.deepAgentParams?.tools?.map((runtimeTool) => runtimeTool.name)).toEqual([
      'searchProducts',
      'createCart',
    ]);
    expect(created.deepAgentParams?.systemPrompt).toContain('Seller Agent Harness');
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
      { messages: [{ role: 'user', content: 'Find jackets' }], agentSessionId: 'session-1' },
    ]);
    expect(response).toEqual({
      message: 'I found a trusted jacket.',
      toolCalls: ['searchProducts'],
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

function createRuntimeWithFakeDeepAgent() {
  const invocations: unknown[] = [];
  const toolInputs: unknown[] = [];
  const toolResults: unknown[] = [];
  let deepAgentParams: FakeDeepAgentParams | undefined;
  let model: unknown;
  const runtime = createLangGraphDeepAgentRuntime({
    apiKey: 'test-key',
    modelName: 'gpt-5-mini',
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
        invoke: async (input: unknown) => {
          invocations.push(input);
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
}
