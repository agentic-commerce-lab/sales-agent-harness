import type { PolicyDecision } from '../contracts/policy.js';
import {
  evaluateCapability,
  evaluateCart,
  evaluateChannel,
  evaluateCheckout,
  evaluateCustomer,
  evaluateForbiddenAction,
  evaluateProduct,
} from './policy-checks.js';
import { createDecision } from './policy-decision.js';
import type { EvaluatePolicyInput } from './policy-input.js';

export type { EvaluatePolicyInput } from './policy-input.js';

export function evaluatePolicy(input: EvaluatePolicyInput): PolicyDecision {
  const forbiddenDecision = evaluateForbiddenAction(input);

  if (forbiddenDecision) {
    return forbiddenDecision;
  }

  const capabilityDecision = evaluateCapability(input);

  if (capabilityDecision) {
    return capabilityDecision;
  }

  const channelDecision = evaluateChannel(input);

  if (channelDecision) {
    return channelDecision;
  }

  const productDecision = evaluateProduct(input);

  if (productDecision) {
    return productDecision;
  }

  const customerDecision = evaluateCustomer(input);

  if (customerDecision) {
    return customerDecision;
  }

  const cartDecision = evaluateCart(input);

  if (cartDecision) {
    return cartDecision;
  }

  const checkoutDecision = evaluateCheckout(input);

  if (checkoutDecision) {
    return checkoutDecision;
  }

  return createDecision(input, 'allow', 'capability_enabled', 'Capability is enabled and allowed.');
}
