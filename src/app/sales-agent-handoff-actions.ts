import type {
  AppContext,
  CheckoutHandoffValidationResult,
  CreateSalesAgentHarnessAppInput,
} from './sales-agent-app-types.js';

export function validateCheckoutHandoff(
  input: CreateSalesAgentHarnessAppInput,
  context: AppContext,
  handoffInput: { readonly handoffId: string },
): CheckoutHandoffValidationResult {
  const record = context.handoffStore.resolve(
    handoffInput.handoffId,
    input.config.merchantId,
    input.config.shopware.salesChannelId,
  );

  if (!record) {
    return { status: 'not_found' };
  }

  return {
    status: 'ok',
    handoffId: record.handoffId,
    summary: record.cartSummary,
  };
}
