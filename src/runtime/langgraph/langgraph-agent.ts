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

  const params: DeepAgentFactoryParams = {
    model: createModel(input),
    tools: toStructuredTools(input.tools, toolContext),
    systemPrompt: input.systemPrompt ?? defaultSystemPrompt,
    ...(input.checkpointSaver ? { checkpointer: input.checkpointSaver } : {}),
  };

  return factory(params);
}

function createModel(input: CreateLangGraphDeepAgentRuntimeInput): DeepAgentModel {
  const modelInput = {
    apiKey: input.apiKey,
    model: input.modelName,
    baseUrl: input.baseUrl,
  };

  if (input.createModel) {
    return input.createModel(modelInput);
  }

  return new ChatOpenAI({
    apiKey: modelInput.apiKey,
    model: modelInput.model,
    ...(modelInput.baseUrl ? { configuration: { baseURL: modelInput.baseUrl } } : {}),
  });
}

function defaultCreateDeepAgent(params: DeepAgentFactoryParams): DeepAgentGraph {
  const agentParams = {
    model: params.model,
    tools: [...params.tools],
    systemPrompt: params.systemPrompt,
    ...(params.checkpointer ? { checkpointer: params.checkpointer } : {}),
  };
  const agent = createDeepAgent(agentParams);

  return {
    invoke: (input, options) => agent.invoke(input, options),
  };
}

const defaultSystemPrompt = [
  'You are running inside the Sales Agent Harness.',
  'Use only the registered harness tools for commerce actions.',
  'Only sell products that were returned by harness tools from the merchant shop in the current conversation.',
  'Do not recommend substitute products from general knowledge, training data, other shops, brands, marketplaces, or memory.',
  'Only ever reference product names, SKUs, IDs, prices, availability, delivery, promotions, and product details that were returned by a harness tool in the current conversation.',
  'Never invent, guess, estimate, or recall commerce data from training data; if it was not returned by a harness tool, it does not exist for this shop conversation.',
  'If price, availability, delivery, promotion, or product details are missing, state that the shop data is unknown and offer to check with a supported tool when possible.',
  'If a returned product is unavailable, say it is unavailable and do not sell it, add it to a cart, or suggest unverified alternatives.',
  'If a search returns no results, say so clearly and do not suggest alternatives you have not looked up in the shop.',
  'Complete checkout only when a registered completeCheckout tool is available and the buyer has explicitly confirmed the exact order.',
  'Do not execute payments, accept legal terms, negotiate discounts, or make binding commitments outside registered harness tools.',
  'Surface missing, uncertain, unsupported, or policy-blocked commerce data clearly.',
].join(' ');
