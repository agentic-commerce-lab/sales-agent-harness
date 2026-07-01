import { z } from 'zod';

import type { CommerceApiRequest } from '../api/harness-api.js';
import { agentChannels } from '../contracts/config.js';
import type { CustomerContext } from '../contracts/session.js';
import type { CreateAgentSessionInput } from './sales-agent-app.js';

const sessionSchema = z.object({
  channel: z.enum(agentChannels),
  customerContext: z
    .object({
      customerId: z.string().optional(),
      customerGroup: z.string().optional(),
      region: z.string().optional(),
    })
    .optional(),
  shopwareContextToken: z.string().min(1).optional(),
  ttlMs: z.number().int().positive().optional(),
});

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const buyerSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
});

const fulfillmentSchema = z.object({
  type: z.literal('shipping'),
  shippingAddress: z.object({
    street: z.string().min(1),
    zipcode: z.string().min(1),
    city: z.string().min(1),
    countryCode: z.string().min(2),
  }),
});

const commerceRequestSchema = z.discriminatedUnion('capability', [
  z.object({
    capability: z.literal('searchProducts'),
    agentSessionId: z.string().min(1),
    query: z.string().min(1),
    limit: z.number().int().positive().optional(),
  }),
  z.object({
    capability: z.literal('getProductDetails'),
    agentSessionId: z.string().min(1),
    productId: z.string().min(1),
  }),
  z.object({
    capability: z.literal('createCart'),
    agentSessionId: z.string().min(1),
    items: z.array(cartItemSchema).min(1),
  }),
  z.object({
    capability: z.literal('updateCart'),
    agentSessionId: z.string().min(1),
    cartId: z.string().min(1),
    items: z.array(cartItemSchema).min(1),
  }),
  z.object({
    capability: z.literal('getCartSummary'),
    agentSessionId: z.string().min(1),
    cartId: z.string().min(1),
  }),
  z.object({
    capability: z.literal('prepareCheckoutHandoff'),
    agentSessionId: z.string().min(1),
    cartId: z.string().min(1),
  }),
  z.object({
    capability: z.literal('completeCheckout'),
    agentSessionId: z.string().min(1),
    checkoutId: z.string().min(1),
    buyer: buyerSchema,
    fulfillment: fulfillmentSchema,
  }),
]);

export const chatSchema = z.object({
  agentSessionId: z.string().min(1),
  message: z.string().min(1),
});

export const handoffValidationSchema = z.object({
  handoffId: z.string().min(1),
});

export function parseSession(input: unknown): CreateAgentSessionInput {
  const parsed = sessionSchema.parse(input);
  const sessionInput: CreateAgentSessionInput = {
    channel: parsed.channel,
  };

  return {
    ...sessionInput,
    ...(parsed.customerContext
      ? { customerContext: parseCustomerContext(parsed.customerContext) }
      : {}),
    ...(parsed.shopwareContextToken ? { shopwareContextToken: parsed.shopwareContextToken } : {}),
    ...(parsed.ttlMs ? { ttlMs: parsed.ttlMs } : {}),
  };
}

export function parseCommerceRequest(input: unknown): CommerceApiRequest {
  const parsed = commerceRequestSchema.parse(input);

  switch (parsed.capability) {
    case 'searchProducts':
      return {
        capability: parsed.capability,
        agentSessionId: parsed.agentSessionId,
        query: parsed.query,
        ...(parsed.limit ? { limit: parsed.limit } : {}),
      };
    case 'getProductDetails':
      return parsed;
    case 'createCart':
      return parsed;
    case 'updateCart':
      return parsed;
    case 'getCartSummary':
      return parsed;
    case 'prepareCheckoutHandoff':
      return parsed;
    case 'completeCheckout':
      return parsed;
    default:
      return assertNever(parsed);
  }
}

function parseCustomerContext(input: {
  readonly customerId?: string | undefined;
  readonly customerGroup?: string | undefined;
  readonly region?: string | undefined;
}): CustomerContext {
  return {
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.customerGroup ? { customerGroup: input.customerGroup } : {}),
    ...(input.region ? { region: input.region } : {}),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported commerce API request: ${String(value)}`);
}
