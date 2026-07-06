import type { AsyncLocalStorage } from 'node:async_hooks';

import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';

import { toStructuredTools } from './langgraph-tooling.js';
import type {
  CreateLangGraphDeepAgentRuntimeInput,
  DeepAgentFactoryParams,
  DeepAgentGraph,
  DeepAgentModel,
  RuntimeToolExecutionContext,
} from './langgraph-types.js';

export function createAgent(
  input: CreateLangGraphDeepAgentRuntimeInput,
  toolContext: AsyncLocalStorage<RuntimeToolExecutionContext>,
): DeepAgentGraph {
  const factory = input.createDeepAgent ?? defaultCreateDeepAgent;

  return factory({
    model: createModel(input),
    tools: toStructuredTools(input.tools, toolContext),
    systemPrompt: input.systemPrompt ?? defaultSystemPrompt,
  });
}

function createModel(input: CreateLangGraphDeepAgentRuntimeInput): DeepAgentModel {
  const modelInput = {
    apiKey: input.apiKey,
    model: input.modelName,
  };

  return input.createModel ? input.createModel(modelInput) : new ChatOpenAI(modelInput);
}

function defaultCreateDeepAgent(params: DeepAgentFactoryParams): DeepAgentGraph {
  const agent = createDeepAgent({
    model: params.model,
    tools: [...params.tools],
    systemPrompt: params.systemPrompt,
  });

  return {
    invoke: (input) => agent.invoke(input),
  };
}

const defaultSystemPrompt = [
  'You are running inside the Seller Agent Harness.',
  'Use only the registered harness tools for commerce actions.',
  'Only ever reference products, prices, availability, and IDs that were returned by a tool call in the current conversation.',
  'Never invent, guess, or recall product names, SKUs, IDs, prices, or stock status from training data — if it was not returned by a tool, it does not exist.',
  'If a search returns no results, say so clearly and do not suggest alternatives you have not looked up.',
  'Complete checkout only when a registered completeCheckout tool is available and the buyer has explicitly confirmed the exact order.',
  'Do not execute payments, accept legal terms, negotiate discounts, or make binding commitments outside registered harness tools.',
  'Surface missing, uncertain, unsupported, or policy-blocked commerce data clearly.',
].join(' ');
