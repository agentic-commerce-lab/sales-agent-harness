import type { CartItemInput } from '../../contracts/commerce.js';
import type { ShopwareEnvironmentConfig } from '../../env/shopware-config.js';
import { parseCart } from './shopware-store-api-cart-parsers.js';
import { parseProduct, parseProductSearchResponse } from './shopware-store-api-parsers.js';

export interface ShopwarePrice {
  readonly unitPrice: number;
  readonly totalPrice: number;
  readonly currency?: string | undefined;
}

export interface ShopwareDeliveryTime {
  readonly name?: string | undefined;
}

export interface ShopwareProduct {
  readonly id: string;
  readonly name?: string | undefined;
  readonly productNumber?: string | undefined;
  readonly description?: string | undefined;
  readonly available?: boolean | undefined;
  readonly calculatedPrice?: ShopwarePrice | undefined;
  readonly categoryNames?: readonly string[];
  readonly deliveryTime?: ShopwareDeliveryTime | undefined;
  readonly customFields?: Readonly<Record<string, unknown>> | undefined;
  readonly children?: readonly ShopwareProduct[];
  readonly margin?: unknown;
  readonly shopwareContextToken?: string | undefined;
}

export interface ShopwareProductSearchResponse {
  readonly elements: readonly ShopwareProduct[];
}

export interface ShopwareLineItem {
  readonly id: string;
  readonly referencedId?: string | undefined;
  readonly label?: string | undefined;
  readonly quantity: number;
  readonly price?: ShopwarePrice | undefined;
}

export interface ShopwareCart {
  readonly token?: string | undefined;
  readonly lineItems?: readonly ShopwareLineItem[];
  readonly price?:
    | {
        readonly positionPrice?: number | undefined;
        readonly totalPrice?: number | undefined;
        readonly currency?: string | undefined;
      }
    | undefined;
}

export interface ShopwareStoreApiClient {
  searchProducts(input: {
    readonly query: string;
    readonly limit?: number;
  }): Promise<ShopwareProductSearchResponse>;
  getProductDetails(input: { readonly productId: string }): Promise<ShopwareProduct>;
  createCart(input: { readonly items: readonly CartItemInput[] }): Promise<ShopwareCart>;
  updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
  }): Promise<ShopwareCart>;
  getCart(input: { readonly cartId: string }): Promise<ShopwareCart>;
  getCheckoutBaseUrl(): Promise<string>;
}

export class FetchShopwareStoreApiClient implements ShopwareStoreApiClient {
  readonly #config: ShopwareEnvironmentConfig;
  readonly #fetch: typeof fetch;

  constructor(config: ShopwareEnvironmentConfig, fetchImplementation: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetchImplementation;
  }

  // fallow-ignore-next-line unused-class-member
  async searchProducts(input: {
    readonly query: string;
    readonly limit?: number;
  }): Promise<ShopwareProductSearchResponse> {
    const payload = await this.postJson('/store-api/search', {
      search: input.query,
      limit: input.limit,
    });

    return parseProductSearchResponse(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getProductDetails(input: { readonly productId: string }): Promise<ShopwareProduct> {
    const payload = await this.postJson(`/store-api/product/${input.productId}`, {});

    return parseProduct(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async createCart(input: { readonly items: readonly CartItemInput[] }): Promise<ShopwareCart> {
    const payload = await this.postJson('/store-api/checkout/cart/line-item', {
      items: input.items.map(toShopwareLineItemPayload),
    });

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
  }): Promise<ShopwareCart> {
    const payload = await this.postJson('/store-api/checkout/cart/line-item', {
      cartId: input.cartId,
      items: input.items.map(toShopwareLineItemPayload),
    });

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getCart(_input: { readonly cartId: string }): Promise<ShopwareCart> {
    const payload = await this.postJson('/store-api/checkout/cart', {});

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getCheckoutBaseUrl(): Promise<string> {
    return `${this.#config.baseUrl.replace(/\/$/, '')}/checkout`;
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    const response = await this.#fetch(`${this.#config.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sw-access-key': this.#config.storeApiAccessKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Shopware Store API request failed with status ${response.status}`);
    }

    return response.json();
  }
}

function toShopwareLineItemPayload(item: CartItemInput) {
  return {
    referencedId: item.productId,
    type: 'product',
    quantity: item.quantity,
  };
}
