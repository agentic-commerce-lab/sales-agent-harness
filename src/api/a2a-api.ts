import type { CheckoutHandoffResult } from '../contracts/commerce.js';
import type { HarnessResponse } from '../harness/harness-core.js';
import type { CommerceApiRequest, CommerceApiResponse, CommerceHarnessApi } from './harness-api.js';
import { dispatchCommerceRequest } from './harness-api.js';

export type A2aApiResponse =
  | Exclude<CommerceApiResponse, HarnessResponse<CheckoutHandoffResult>>
  | HarnessResponse<{
      readonly summary: CheckoutHandoffResult['summary'];
      readonly continueUrl: string;
      readonly checkoutId?: string | undefined;
    }>;

export interface A2aApi {
  handle(request: CommerceApiRequest): Promise<A2aApiResponse>;
}

export function createA2aApi(harness: CommerceHarnessApi): A2aApi {
  return {
    handle: async (request) => {
      const response = await dispatchCommerceRequest(harness, request);

      if (!isCheckoutHandoffResponse(request, response)) {
        return response;
      }

      return {
        status: response.status,
        policyDecision: response.policyDecision,
        value: {
          summary: response.value.summary,
          continueUrl: response.value.continueUrl,
          // Pass through the UCP checkout session id so an A2A buyer can close
          // the loop (completeCheckout requires it). Without this the A2A
          // surface produced no way to reach a purchase (see post-mortem F4).
          ...(response.value.checkoutId ? { checkoutId: response.value.checkoutId } : {}),
        },
      };
    },
  };
}

function isCheckoutHandoffResponse(
  request: CommerceApiRequest,
  response: CommerceApiResponse,
): response is HarnessResponse<CheckoutHandoffResult> & {
  readonly status: 'ok';
  readonly value: CheckoutHandoffResult;
} {
  return (
    request.capability === 'prepareCheckoutHandoff' &&
    response.status === 'ok' &&
    Boolean(response.value)
  );
}
