import type { CartItemInput, CommerceExecutionContext } from '../../contracts/commerce.js';

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

export interface ShopwareDelivery {
  readonly shippingCosts?: ShopwarePrice | undefined;
}

export interface ShopwareCart {
  readonly token?: string | undefined;
  readonly lineItems?: readonly ShopwareLineItem[];
  readonly deliveries?: readonly ShopwareDelivery[];
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
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareProductSearchResponse>;
  getProductDetails(input: {
    readonly productId: string;
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareProduct>;
  createCart(input: {
    readonly items: readonly CartItemInput[];
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareCart>;
  updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareCart>;
  getCart(input: {
    readonly cartId: string;
    readonly executionContext?: CommerceExecutionContext;
  }): Promise<ShopwareCart>;
  getCheckoutBaseUrl(): Promise<string>;
}
