import type { AsyncLocalStorage } from 'node:async_hooks';

import { type StructuredToolInterface, tool } from '@langchain/core/tools';

import type {
  ExecutableLangGraphRuntimeTool,
  RuntimeToolExecutionContext,
} from './langgraph-types.js';

export function toStructuredTools(
  runtimeTools: readonly ExecutableLangGraphRuntimeTool[],
  toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>,
): readonly StructuredToolInterface[] {
  return runtimeTools.map((runtimeTool) => toStructuredTool(runtimeTool, toolContext));
}

function toStructuredTool(
  runtimeTool: ExecutableLangGraphRuntimeTool,
  toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>,
): StructuredToolInterface {
  return tool(
    async (input) =>
      serializeToolResult(await runtimeTool.execute(input, readToolContext(toolContext))),
    {
      name: runtimeTool.name,
      description: runtimeTool.description,
      schema: runtimeTool.schema,
    },
  );
}

function readToolContext(
  toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>,
): RuntimeToolExecutionContext {
  const context = toolContext.getStore();

  if (!context) {
    throw new Error('Harness tool execution requires an active agent session context');
  }

  return context;
}

function serializeToolResult(value: unknown): string {
  if (!isRecord(value)) {
    return JSON.stringify({ status: 'ok', value });
  }

  if (value.status === 'ok') {
    return JSON.stringify({ status: 'ok', value: value.value });
  }

  return JSON.stringify({
    status: value.status,
    reason: value.reason ?? readPolicyReason(value.policyDecision),
    message: value.message,
  });
}

function readPolicyReason(value: unknown): unknown {
  return isRecord(value) ? value.reason : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
