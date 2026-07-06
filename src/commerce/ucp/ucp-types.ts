import type { BuyerInput, CartItemInput, FulfillmentInput } from '../../contracts/commerce.js';

export interface UcpMoney {
  readonly amount: number;
  readonly currency: string;
}

export interface UcpProduct {
  readonly id: string;
  readonly title?: string | undefined;
  readonly name?: string | undefined;
  readonly sku?: string | undefined;
  readonly description?: string | undefined;
  readonly price?: UcpMoney | number | undefined;
  readonly priceRange?:
    | {
        readonly min?: UcpMoney | undefined;
      }
    | undefined;
  readonly price_range?:
    | {
        readonly min?: UcpMoney | undefined;
      }
    | undefined;
  readonly available?: boolean | undefined;
  readonly categories?: readonly string[] | undefined;
  readonly attributes?: Readonly<Record<string, string>> | undefined;
  readonly variants?: readonly UcpProduct[] | undefined;
  readonly deliveryEstimate?: string | undefined;
  readonly delivery_estimate?: string | undefined;
}

export interface UcpProductSearchResponse {
  readonly products: readonly UcpProduct[];
}

export interface UcpLineItem {
  readonly id?: string | undefined;
  readonly item?: UcpProduct | undefined;
  readonly quantity: number;
  readonly unitPrice?: UcpMoney | undefined;
  readonly unit_price?: UcpMoney | undefined;
  readonly totalPrice?: UcpMoney | undefined;
  readonly total_price?: UcpMoney | undefined;
  readonly totals?: readonly UcpTotal[] | undefined;
}

export interface UcpCart {
  readonly id: string;
  readonly status?: string | undefined;
  readonly currency: string;
  readonly lineItems?: readonly UcpLineItem[] | undefined;
  readonly line_items?: readonly UcpLineItem[] | undefined;
  readonly moneySummary?: UcpMoneySummary | undefined;
  readonly money_summary?: UcpMoneySummary | undefined;
  readonly continueUrl?: string | undefined;
  readonly continue_url?: string | undefined;
  readonly links?: readonly { readonly rel?: string; readonly href?: string }[] | undefined;
  readonly totals?: readonly UcpTotal[] | undefined;
  readonly order?: { readonly id?: string | undefined } | undefined;
}

export interface UcpMoneySummary {
  readonly subtotal?: UcpMoney | undefined;
  readonly fulfillment?: UcpMoney | undefined;
  readonly total?: UcpMoney | undefined;
}

export interface UcpTotal {
  readonly type: string;
  readonly amount: number;
  readonly currency?: string | undefined;
}

export interface UcpClient {
  searchProducts(input: {
    readonly query: string;
    readonly limit?: number;
  }): Promise<UcpProductSearchResponse>;
  getProductDetails(input: { readonly productId: string }): Promise<UcpProduct>;
  createCart(input: { readonly items: readonly CartItemInput[] }): Promise<UcpCart>;
  updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
  }): Promise<UcpCart>;
  getCart(input: { readonly cartId: string }): Promise<UcpCart>;
  createCheckout(input: {
    readonly cartId?: string | undefined;
    readonly lineItems: readonly CartItemInput[];
  }): Promise<UcpCart>;
  getCheckout(input: { readonly checkoutId: string }): Promise<UcpCart>;
  updateCheckout(input: {
    readonly checkoutId: string;
    readonly lineItems: readonly CartItemInput[];
    readonly buyer: BuyerInput;
    readonly fulfillment: FulfillmentInput;
  }): Promise<UcpCart>;
  completeCheckout(input: { readonly checkoutId: string }): Promise<UcpCart>;
  getEmbeddedCheckoutUrl(checkoutId: string): string;
}
