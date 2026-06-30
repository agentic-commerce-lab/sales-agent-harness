import { z } from 'zod';

import type {
  ExecutableHarnessToolDefinition,
  HarnessToolExecutor,
} from './executable-tool-registry.js';

export function createCreateCartTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({ items: cartItemsSchema });

  return {
    name: 'createCart',
    description: 'Create a non-binding cart draft through the Seller Agent Harness.',
    schema,
    execute: (input, context) => {
      const parsed = schema.parse(input);

      return harness.createCart({ agentSessionId: context.agentSessionId, items: parsed.items });
    },
  };
}

export function createUpdateCartTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({ cartId: z.string(), items: cartItemsSchema });

  return {
    name: 'updateCart',
    description: 'Update a non-binding cart draft through the Seller Agent Harness.',
    schema,
    execute: (input, context) => {
      const parsed = schema.parse(input);

      return harness.updateCart({
        agentSessionId: context.agentSessionId,
        cartId: parsed.cartId,
        items: parsed.items,
      });
    },
  };
}

export function createCartSummaryTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({ cartId: z.string() });

  return {
    name: 'getCartSummary',
    description: 'Get a trusted cart summary through the Seller Agent Harness.',
    schema,
    execute: (input, context) => {
      const parsed = schema.parse(input);

      return harness.getCartSummary({
        agentSessionId: context.agentSessionId,
        cartId: parsed.cartId,
      });
    },
  };
}

export function createCheckoutHandoffTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({ cartId: z.string() });

  return {
    name: 'prepareCheckoutHandoff',
    description: 'Prepare a non-binding checkout handoff through the Seller Agent Harness.',
    schema,
    execute: (input, context) => {
      const parsed = schema.parse(input);

      return harness.prepareCheckoutHandoff({
        agentSessionId: context.agentSessionId,
        cartId: parsed.cartId,
      });
    },
  };
}

const cartItemsSchema = z.array(
  z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  }),
);
