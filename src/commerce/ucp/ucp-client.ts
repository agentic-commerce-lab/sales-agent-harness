import type {
  Ap2PaymentMandate,
  BuyerInput,
  CartItemInput,
  FulfillmentInput,
} from '../../contracts/commerce.js';
import type { CommerceEnvironmentConfig } from '../../env/commerce-config.js';
import { parseCart } from './ucp-cart-parsers.js';
import { createUcpHttpClient, type UcpHttpClient } from './ucp-http.js';
import {
  toUcpAp2Extension,
  toUcpBuyerPayload,
  toUcpFulfillmentPayload,
  toUcpLineItemPayload,
} from './ucp-payloads.js';
import { parseProductSearchResponse } from './ucp-product-parsers.js';
import type { UcpCart, UcpClient, UcpProduct, UcpProductSearchResponse } from './ucp-types.js';

export type * from './ucp-types.js';

export class FetchUcpClient implements UcpClient {
  readonly #http: UcpHttpClient;

  constructor(config: CommerceEnvironmentConfig, fetchImplementation: typeof fetch = fetch) {
    this.#http = createUcpHttpClient(config, fetchImplementation);
  }

  async searchProducts(input: {
    readonly query: string;
    readonly limit?: number;
  }): Promise<UcpProductSearchResponse> {
    const payload = await this.#request('POST', '/catalog/search', {
      query: input.query,
      limit: input.limit,
    });

    return parseProductSearchResponse(payload);
  }

  async getProductDetails(input: { readonly productId: string }): Promise<UcpProduct> {
    const payload = await this.#request('POST', '/catalog/lookup', { ids: [input.productId] });
    const products = parseProductSearchResponse(payload).products;
    const product = products.find((candidate) => candidate.id === input.productId) ?? products[0];

    if (!product) {
      throw new Error(`UCP product lookup returned no product for ${input.productId}`);
    }

    return product;
  }

  // fallow-ignore-next-line unused-class-member
  createCart(input: { readonly items: readonly CartItemInput[] }): Promise<UcpCart> {
    return this.#cartRequest('POST', '/carts', {
      line_items: input.items.map(toUcpLineItemPayload),
    });
  }

  // fallow-ignore-next-line unused-class-member
  updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
  }): Promise<UcpCart> {
    return this.#cartRequest('PATCH', `/carts/${input.cartId}`, {
      id: input.cartId,
      line_items: input.items.map(toUcpLineItemPayload),
    });
  }

  // fallow-ignore-next-line unused-class-member
  getCart(input: { readonly cartId: string }): Promise<UcpCart> {
    return this.#cartRequest('GET', `/carts/${input.cartId}`);
  }

  createCheckout(input: {
    readonly cartId?: string | undefined;
    readonly lineItems: readonly CartItemInput[];
  }): Promise<UcpCart> {
    return this.#cartRequest('POST', '/checkout-sessions', {
      ...(input.cartId ? { cart_id: input.cartId } : {}),
      line_items: input.lineItems.map(toUcpLineItemPayload),
    });
  }

  getCheckout(input: { readonly checkoutId: string }): Promise<UcpCart> {
    return this.#cartRequest('GET', checkoutPath(input.checkoutId));
  }

  updateCheckout(input: {
    readonly checkoutId: string;
    readonly lineItems: readonly CartItemInput[];
    readonly buyer: BuyerInput;
    readonly fulfillment: FulfillmentInput;
    readonly paymentHandlerId?: string | undefined;
  }): Promise<UcpCart> {
    return this.#cartRequest('PATCH', checkoutPath(input.checkoutId), {
      id: input.checkoutId,
      line_items: input.lineItems.map(toUcpLineItemPayload),
      buyer: toUcpBuyerPayload(input.buyer),
      fulfillment: toUcpFulfillmentPayload(input.fulfillment),
      // Commit the payment handler the buyer supports (UCP PaymentInstrument).
      // The shop places an order only for a handler it can settle; absent a
      // supported commitment it escalates to a browser handoff (no order).
      ...(input.paymentHandlerId
        ? { payment: { type: 'x402', handler_id: input.paymentHandlerId } }
        : {}),
    });
  }

  async completeCheckout(input: {
    readonly checkoutId: string;
    readonly ap2Mandate?: Ap2PaymentMandate | undefined;
  }): Promise<UcpCart> {
    if (input.ap2Mandate && !(await this.#http.supportsAp2Mandate())) {
      throw new Error(
        'an AP2 mandate was supplied but the shop does not advertise ' +
          'dev.ucp.shopping.ap2_mandate support in its UCP profile',
      );
    }

    return this.#cartRequest('POST', `${checkoutPath(input.checkoutId)}/complete`, {
      // No payment instrument here: a payment-specific credential (e.g.
      // x402's own signed authorization) rides through that payment method's
      // instrument via its own flow, not a synthetic AP2-branded one no
      // authorizer is registered to accept.
      payment: { instruments: [] },
      ...toUcpAp2Extension(input.ap2Mandate),
    });
  }

  // fallow-ignore-next-line unused-class-member
  getEmbeddedCheckoutUrl(checkoutId: string): string {
    return `${this.#http.baseUrl}/ucp/embedded/checkout/${encodeURIComponent(checkoutId)}`;
  }

  async #request(method: string, path: string, body?: unknown): Promise<unknown> {
    const endpoint = await this.#http.discoverEndpoint();
    return this.#http.requestJson(method, `${endpoint}${path}`, body);
  }

  async #cartRequest(method: string, path: string, body?: unknown): Promise<UcpCart> {
    return parseCart(await this.#request(method, path, body));
  }
}

function checkoutPath(checkoutId: string): string {
  return `/checkout-sessions/${encodeURIComponent(checkoutId)}`;
}
