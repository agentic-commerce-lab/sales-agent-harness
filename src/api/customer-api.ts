import type { CommerceApiRequest, CommerceApiResponse, CommerceHarnessApi } from './harness-api.js';
import { dispatchCommerceRequest } from './harness-api.js';

export interface CustomerApi {
  handle(request: CommerceApiRequest): Promise<CommerceApiResponse>;
}

export function createCustomerApi(harness: CommerceHarnessApi): CustomerApi {
  return {
    handle: (request) => dispatchCommerceRequest(harness, request),
  };
}
