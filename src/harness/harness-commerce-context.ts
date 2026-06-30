import type { CommerceExecutionContext } from '../contracts/commerce.js';
import type { AgentSession } from '../contracts/session.js';

export function withCommerceContext<T extends object>(
  input: T,
  session: AgentSession,
): T & { readonly executionContext?: CommerceExecutionContext } {
  if (!session.commerceContext) {
    return input;
  }

  return {
    ...input,
    executionContext: session.commerceContext,
  };
}

export function maxItemQuantity(items: readonly { readonly quantity: number }[]): number {
  return Math.max(0, ...items.map((item) => item.quantity));
}
