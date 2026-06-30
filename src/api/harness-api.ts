import type {
  CartResult,
  CheckoutHandoffResult,
  ProductDetailsResult,
  ProductSearchResult,
} from '../contracts/commerce.js';
import type { HarnessResponse } from '../harness/harness-core.js';

export type CommerceApiRequest =
  | {
      readonly capability: 'searchProducts';
      readonly agentSessionId: string;
      readonly query: string;
      readonly limit?: number;
    }
  | {
      readonly capability: 'getProductDetails';
      readonly agentSessionId: string;
      readonly productId: string;
    }
  | {
      readonly capability: 'createCart';
      readonly agentSessionId: string;
      readonly items: readonly { readonly productId: string; readonly quantity: number }[];
    }
  | {
      readonly capability: 'updateCart';
      readonly agentSessionId: string;
      readonly cartId: string;
      readonly items: readonly { readonly productId: string; readonly quantity: number }[];
    }
  | {
      readonly capability: 'getCartSummary';
      readonly agentSessionId: string;
      readonly cartId: string;
    }
  | {
      readonly capability: 'prepareCheckoutHandoff';
      readonly agentSessionId: string;
      readonly cartId: string;
    };

export type CommerceApiResponse =
  | HarnessResponse<ProductSearchResult>
  | HarnessResponse<ProductDetailsResult>
  | HarnessResponse<CartResult>
  | HarnessResponse<CheckoutHandoffResult>;

export interface CommerceHarnessApi {
  searchProducts(
    input: Extract<CommerceApiRequest, { readonly capability: 'searchProducts' }>,
  ): Promise<HarnessResponse<ProductSearchResult>>;
  getProductDetails(
    input: Extract<CommerceApiRequest, { readonly capability: 'getProductDetails' }>,
  ): Promise<HarnessResponse<ProductDetailsResult>>;
  createCart(
    input: Extract<CommerceApiRequest, { readonly capability: 'createCart' }>,
  ): Promise<HarnessResponse<CartResult>>;
  updateCart(
    input: Extract<CommerceApiRequest, { readonly capability: 'updateCart' }>,
  ): Promise<HarnessResponse<CartResult>>;
  getCartSummary(
    input: Extract<CommerceApiRequest, { readonly capability: 'getCartSummary' }>,
  ): Promise<HarnessResponse<CartResult>>;
  prepareCheckoutHandoff(
    input: Extract<CommerceApiRequest, { readonly capability: 'prepareCheckoutHandoff' }>,
  ): Promise<HarnessResponse<CheckoutHandoffResult>>;
}

export async function dispatchCommerceRequest(
  harness: CommerceHarnessApi,
  request: CommerceApiRequest,
): Promise<CommerceApiResponse> {
  switch (request.capability) {
    case 'searchProducts':
      return harness.searchProducts(request);
    case 'getProductDetails':
      return harness.getProductDetails(request);
    case 'createCart':
      return harness.createCart(request);
    case 'updateCart':
      return harness.updateCart(request);
    case 'getCartSummary':
      return harness.getCartSummary(request);
    case 'prepareCheckoutHandoff':
      return harness.prepareCheckoutHandoff(request);
    default:
      return assertNever(request);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported commerce API request: ${String(value)}`);
}
