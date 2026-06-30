import type { CartItemInput, CommerceExecutionContext } from '../../contracts/commerce.js';
import type { ShopwareEnvironmentConfig } from '../../env/shopware-config.js';
import { parseCart } from './shopware-store-api-cart-parsers.js';
import {
  createFetchShopwareStoreApiHttpClient,
  type ShopwareStoreApiHttpClient,
} from './shopware-store-api-http.js';
import { parseProduct, parseProductSearchResponse } from './shopware-store-api-parsers.js';
import type {
  ShopwareCart,
  ShopwareProduct,
  ShopwareProductSearchResponse,
  ShopwareStoreApiClient,
} from './shopware-store-api-types.js';

export type * from './shopware-store-api-types.js';

export class FetchShopwareStoreApiClient implements ShopwareStoreApiClient {
  readonly #http: ShopwareStoreApiHttpClient;

  constructor(config: ShopwareEnvironmentConfig, fetchImplementation: typeof fetch = fetch) {
    this.#http = createFetchShopwareStoreApiHttpClient(config, fetchImplementation);
  }

  // fallow-ignore-next-line unused-class-member
  async searchProducts(input: {
    readonly query: string;
    readonly limit?: number;
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareProductSearchResponse> {
    const payload = await this.#http.postJson(
      '/store-api/search',
      {
        search: input.query,
        limit: input.limit,
      },
      input.executionContext,
    );

    return parseProductSearchResponse(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getProductDetails(input: {
    readonly productId: string;
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareProduct> {
    const payload = await this.#http.postJson(
      `/store-api/product/${input.productId}`,
      {},
      input.executionContext,
    );

    return parseProduct(payload);
  }

  async createCart(input: {
    readonly items: readonly CartItemInput[];
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareCart> {
    const payload = await this.#http.postJson(
      '/store-api/checkout/cart/line-item',
      {
        items: input.items.map(toShopwareLineItemPayload),
      },
      input.executionContext,
    );

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareCart> {
    const payload = await this.#http.postJson(
      '/store-api/checkout/cart/line-item',
      {
        cartId: input.cartId,
        items: input.items.map(toShopwareLineItemPayload),
      },
      input.executionContext,
    );

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getCart(input: {
    readonly cartId: string;
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareCart> {
    const payload = await this.#http.postJson(
      '/store-api/checkout/cart',
      {},
      input.executionContext,
    );

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getCheckoutBaseUrl(): Promise<string> {
    return this.#http.getCheckoutBaseUrl();
  }
}

function toShopwareLineItemPayload(item: CartItemInput) {
  return {
    referencedId: item.productId,
    type: 'product',
    quantity: item.quantity,
  };
}
