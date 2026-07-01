import type { z } from 'zod';
import type { AgentHarnessConfig, HarnessCapability } from '../contracts/config.js';
import {
  createCartSummaryTool,
  createCheckoutHandoffTool,
  createCompleteCheckoutTool,
  createCreateCartTool,
  createUpdateCartTool,
} from './cart-tool-definitions.js';
import { createProductDetailsTool, createSearchProductsTool } from './catalog-tool-definitions.js';
import type { HarnessToolDefinition } from './tool-registry.js';

export interface HarnessToolExecutionContext {
  readonly agentSessionId: string;
}

export interface ExecutableHarnessToolDefinition extends HarnessToolDefinition {
  readonly description: string;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  execute(input: Record<string, unknown>, context: HarnessToolExecutionContext): Promise<unknown>;
}

export interface HarnessToolExecutor {
  searchProducts(input: {
    readonly agentSessionId: string;
    readonly query: string;
    readonly limit?: number;
  }): Promise<unknown>;
  getProductDetails(input: {
    readonly agentSessionId: string;
    readonly productId: string;
  }): Promise<unknown>;
  createCart(input: {
    readonly agentSessionId: string;
    readonly items: readonly { readonly productId: string; readonly quantity: number }[];
  }): Promise<unknown>;
  updateCart(input: {
    readonly agentSessionId: string;
    readonly cartId: string;
    readonly items: readonly { readonly productId: string; readonly quantity: number }[];
  }): Promise<unknown>;
  getCartSummary(input: {
    readonly agentSessionId: string;
    readonly cartId: string;
  }): Promise<unknown>;
  prepareCheckoutHandoff(input: {
    readonly agentSessionId: string;
    readonly cartId: string;
  }): Promise<unknown>;
  completeCheckout(input: {
    readonly agentSessionId: string;
    readonly checkoutId: string;
    readonly buyer: {
      readonly email: string;
      readonly firstName?: string | undefined;
      readonly lastName?: string | undefined;
      readonly phoneNumber?: string | undefined;
    };
    readonly fulfillment: {
      readonly type: 'shipping';
      readonly shippingAddress: {
        readonly street: string;
        readonly zipcode: string;
        readonly city: string;
        readonly countryCode: string;
      };
    };
  }): Promise<unknown>;
}

export function createExecutableToolRegistry(
  config: AgentHarnessConfig,
  harness: HarnessToolExecutor,
): readonly ExecutableHarnessToolDefinition[] {
  return config.enabledCapabilities.map((capability) => createExecutableTool(capability, harness));
}

function createExecutableTool(
  capability: HarnessCapability,
  harness: HarnessToolExecutor,
): ExecutableHarnessToolDefinition {
  switch (capability) {
    case 'searchProducts':
      return createSearchProductsTool(harness);
    case 'getProductDetails':
      return createProductDetailsTool(harness);
    case 'createCart':
      return createCreateCartTool(harness);
    case 'updateCart':
      return createUpdateCartTool(harness);
    case 'getCartSummary':
      return createCartSummaryTool(harness);
    case 'prepareCheckoutHandoff':
      return createCheckoutHandoffTool(harness);
    case 'completeCheckout':
      return createCompleteCheckoutTool(harness);
    default:
      return assertNever(capability);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported harness capability: ${String(value)}`);
}
