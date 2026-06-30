import { describe, expect, test } from 'bun:test';

import type { AgentRuntimeInput } from '../../src/runtime/agent-runtime.js';
import { LangGraphDeepAgentRuntime } from '../../src/runtime/langgraph/langgraph-runtime.js';

describe('LangGraphDeepAgentRuntime', () => {
  test('passes only registered harness tools into the runtime boundary', async () => {
    let receivedTools: readonly string[] = [];
    const runtime = new LangGraphDeepAgentRuntime({
      tools: [{ name: 'searchProducts' }, { name: 'createCart' }],
      invoker: {
        invoke: async (input: AgentRuntimeInput, tools: readonly string[]) => {
          receivedTools = tools;
          return { message: input.message, toolCalls: tools };
        },
      },
    });

    const response = await runtime.respond({
      agentSessionId: 'session-1',
      message: 'Find jackets',
    });

    expect(receivedTools).toEqual(['searchProducts', 'createCart']);
    expect(response.toolCalls).toEqual(['searchProducts', 'createCart']);
  });
});
