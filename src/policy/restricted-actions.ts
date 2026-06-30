import type { RestrictedCommerceAction } from '../contracts/policy.js';

export const restrictedCommerceActions = [
  'placeOrder',
  'executePayment',
  'acceptLegalTerms',
  'createBindingQuote',
  'negotiateCustomDiscount',
  'modifyCustomerAccount',
] as const satisfies readonly RestrictedCommerceAction[];
