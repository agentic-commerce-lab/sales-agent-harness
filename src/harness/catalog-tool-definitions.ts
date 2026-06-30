import { z } from 'zod';

import type {
  ExecutableHarnessToolDefinition,
  HarnessToolExecutor,
} from './executable-tool-registry.js';

export function createSearchProductsTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({ query: z.string(), limit: z.number().int().positive().optional() });

  return {
    name: 'searchProducts',
    description: 'Search trusted merchant product data through the Seller Agent Harness.',
    schema,
    execute: (input, context) => {
      const parsed = schema.parse(input);

      return harness.searchProducts({
        agentSessionId: context.agentSessionId,
        query: parsed.query,
        ...(parsed.limit ? { limit: parsed.limit } : {}),
      });
    },
  };
}

export function createProductDetailsTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({ productId: z.string() });

  return {
    name: 'getProductDetails',
    description: 'Get trusted merchant product details through the Seller Agent Harness.',
    schema,
    execute: (input, context) => {
      const parsed = schema.parse(input);

      return harness.getProductDetails({
        agentSessionId: context.agentSessionId,
        productId: parsed.productId,
      });
    },
  };
}
