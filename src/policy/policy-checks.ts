import type { PolicyDecision } from '../contracts/policy.js';
import { createDecision } from './policy-decision.js';
import type { EvaluatePolicyInput } from './policy-input.js';
import { restrictedCommerceActions } from './restricted-actions.js';

export function evaluateForbiddenAction(input: EvaluatePolicyInput): PolicyDecision | undefined {
  if (!includesValue(restrictedCommerceActions, input.capability)) {
    return undefined;
  }

  return createDecision(
    input,
    'block',
    'mvp_forbidden_action',
    'Binding commerce actions are not available in the MVP.',
  );
}

export function evaluateCapability(input: EvaluatePolicyInput): PolicyDecision | undefined {
  if (includesValue(input.config.enabledCapabilities, input.capability)) {
    return undefined;
  }

  return createDecision(input, 'block', 'capability_disabled', 'Capability is not enabled.');
}

export function evaluateChannel(input: EvaluatePolicyInput): PolicyDecision | undefined {
  if (includesValue(input.config.policies.allowedChannels, input.context.channel)) {
    return undefined;
  }

  return createDecision(input, 'block', 'channel_not_allowed', 'Channel is not allowed.');
}

export function evaluateProduct(input: EvaluatePolicyInput): PolicyDecision | undefined {
  if (!input.product) {
    return undefined;
  }

  if (input.config.policies.blockedProducts.includes(input.product.productId)) {
    return createDecision(input, 'block', 'blocked_product', 'Product is blocked by policy.');
  }

  if (hasBlockedCategory(input.config.policies.blockedCategories, input.product.categories)) {
    return createDecision(
      input,
      'block',
      'blocked_category',
      'Product category is blocked by policy.',
    );
  }

  return undefined;
}

export function evaluateCustomer(input: EvaluatePolicyInput): PolicyDecision | undefined {
  if (!input.customerRegion) {
    return undefined;
  }

  if (!input.config.policies.unsupportedRegions.includes(input.customerRegion)) {
    return undefined;
  }

  return createDecision(input, 'block', 'unsupported_region', 'Customer region is unsupported.');
}

export function evaluateCart(input: EvaluatePolicyInput): PolicyDecision | undefined {
  if (!input.cart) {
    return undefined;
  }

  if (input.cart.maxItemQuantity > input.config.policies.maxItemQuantity) {
    return createDecision(
      input,
      'block',
      'quantity_limit_exceeded',
      'Requested quantity exceeds the configured item limit.',
    );
  }

  if (input.cart.totalAmount > input.config.policies.maxCartValue.amount) {
    return createDecision(
      input,
      'block',
      'cart_value_limit_exceeded',
      'Requested cart value exceeds the configured limit.',
    );
  }

  return undefined;
}

export function evaluateCheckout(input: EvaluatePolicyInput): PolicyDecision | undefined {
  if (input.capability !== 'prepareCheckoutHandoff') {
    return undefined;
  }

  if (!input.config.policies.allowCheckoutHandoff) {
    return createDecision(
      input,
      'block',
      'checkout_handoff_disabled',
      'Checkout handoff is disabled by policy.',
    );
  }

  if (input.config.policies.requireHumanApprovalForCheckout) {
    return createDecision(
      input,
      'escalate',
      'human_approval_required',
      'Checkout handoff requires human approval.',
    );
  }

  return undefined;
}

function hasBlockedCategory(
  blockedCategories: readonly string[],
  productCategories: readonly string[],
): boolean {
  return productCategories.some((category) => blockedCategories.includes(category));
}

function includesValue<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((candidate) => candidate === value);
}
