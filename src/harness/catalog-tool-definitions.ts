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
    description:
      'Search only products available from the merchant shop through trusted harness data. Do not use this tool to infer, invent, or recommend products not returned by the shop.',
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
    description:
      'Get trusted merchant shop product details for a product ID returned by harness tools. If a field is absent, treat that shop data as unknown.',
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
