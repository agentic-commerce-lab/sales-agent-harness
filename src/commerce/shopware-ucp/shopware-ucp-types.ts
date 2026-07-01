import type { CartItemInput } from '../../contracts/commerce.js';

export interface ShopwareUcpMoney {
  readonly amount: number;
  readonly currency: string;
}

export interface ShopwareUcpProduct {
  readonly id: string;
  readonly title?: string | undefined;
  readonly name?: string | undefined;
  readonly sku?: string | undefined;
  readonly description?: string | undefined;
  readonly price?: ShopwareUcpMoney | number | undefined;
  readonly priceRange?:
    | {
        readonly min?: ShopwareUcpMoney | undefined;
      }
    | undefined;
  readonly price_range?:
    | {
        readonly min?: ShopwareUcpMoney | undefined;
      }
    | undefined;
  readonly available?: boolean | undefined;
  readonly categories?: readonly string[] | undefined;
}

export interface ShopwareUcpProductSearchResponse {
  readonly products: readonly ShopwareUcpProduct[];
}

export interface ShopwareUcpLineItem {
  readonly id?: string | undefined;
  readonly item?: ShopwareUcpProduct | undefined;
  readonly quantity: number;
  readonly unitPrice?: ShopwareUcpMoney | undefined;
  readonly unit_price?: ShopwareUcpMoney | undefined;
  readonly totalPrice?: ShopwareUcpMoney | undefined;
  readonly total_price?: ShopwareUcpMoney | undefined;
  readonly totals?: readonly ShopwareUcpTotal[] | undefined;
}

export interface ShopwareUcpCart {
  readonly id: string;
  readonly status?: string | undefined;
  readonly currency: string;
  readonly lineItems?: readonly ShopwareUcpLineItem[] | undefined;
  readonly line_items?: readonly ShopwareUcpLineItem[] | undefined;
  readonly moneySummary?:
    | {
        readonly subtotal?: ShopwareUcpMoney | undefined;
        readonly total?: ShopwareUcpMoney | undefined;
      }
    | undefined;
  readonly money_summary?:
    | {
        readonly subtotal?: ShopwareUcpMoney | undefined;
        readonly total?: ShopwareUcpMoney | undefined;
      }
    | undefined;
  readonly continueUrl?: string | undefined;
  readonly continue_url?: string | undefined;
  readonly links?: readonly { readonly rel?: string; readonly href?: string }[] | undefined;
  readonly totals?: readonly ShopwareUcpTotal[] | undefined;
  readonly order?: { readonly id?: string | undefined } | undefined;
}

export interface ShopwareUcpTotal {
  readonly type: string;
  readonly amount: number;
  readonly currency?: string | undefined;
}

export interface ShopwareUcpClient {
  searchProducts(input: {
    readonly query: string;
    readonly limit?: number;
  }): Promise<ShopwareUcpProductSearchResponse>;
  getProductDetails(input: { readonly productId: string }): Promise<ShopwareUcpProduct>;
  createCart(input: { readonly items: readonly CartItemInput[] }): Promise<ShopwareUcpCart>;
  updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
  }): Promise<ShopwareUcpCart>;
  getCart(input: { readonly cartId: string }): Promise<ShopwareUcpCart>;
  createCheckout(input: {
    readonly cartId?: string | undefined;
    readonly lineItems: readonly CartItemInput[];
  }): Promise<ShopwareUcpCart>;
  completeCheckout(input: { readonly checkoutId: string }): Promise<ShopwareUcpCart>;
  getEmbeddedCheckoutUrl(checkoutId: string): string;
}
