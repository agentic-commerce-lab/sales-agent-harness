import { z } from 'zod';

import type {
  ExecutableHarnessToolDefinition,
  HarnessToolExecutor,
} from './executable-tool-registry.js';

const isoCountryCodeSchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO 3166-1 alpha-2 country code.')
  .transform((value) => value.toUpperCase());

export function createCreateCartTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({ items: cartItemsSchema });

  return {
    name: 'createCart',
    description: 'Create a non-binding cart draft through the Sales Agent Harness.',
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
    description: 'Update a non-binding cart draft through the Sales Agent Harness.',
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
    description: 'Get a trusted cart summary through the Sales Agent Harness.',
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
    description: 'Prepare a non-binding checkout handoff through the Sales Agent Harness.',
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

export function createCompleteCheckoutTool(
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  const schema = z.object({
    checkoutId: z.string(),
    idempotencyKey: z.string().min(1).optional(),
    explicitBuyerConfirmation: z.literal(true),
    buyer: z.object({
      email: z.email(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phoneNumber: z.string().min(1).optional(),
    }),
    fulfillment: z.object({
      type: z.literal('shipping'),
      shippingAddress: z.object({
        street: z.string().min(1),
        zipcode: z.string().min(1),
        city: z.string().min(1),
        countryCode: isoCountryCodeSchema,
      }),
    }),
  });

  return {
    name: 'completeCheckout',
    description:
      'Complete a UCP checkout and place a real Shopware order only after explicit buyer confirmation.',
    schema,
    execute: (input, context) => {
      const parsed = schema.parse(input);

      return harness.completeCheckout({
        agentSessionId: context.agentSessionId,
        checkoutId: parsed.checkoutId,
        ...(parsed.idempotencyKey ? { idempotencyKey: parsed.idempotencyKey } : {}),
        buyer: parsed.buyer,
        fulfillment: parsed.fulfillment,
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
