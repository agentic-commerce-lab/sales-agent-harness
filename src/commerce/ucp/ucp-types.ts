import type {
  Ap2PaymentMandate,
  BuyerInput,
  CartItemInput,
  FulfillmentInput,
} from '../../contracts/commerce.js';

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
  readonly x402?: UcpX402Instructions | undefined;
  readonly ap2?: UcpAp2Response | undefined;
}

/** Wire shape of the x402 extension object on completed UCP checkouts. */
export interface UcpX402Instructions {
  readonly handler_id?: string | undefined;
  readonly pay_url?: string | undefined;
  readonly deep_link_code?: string | undefined;
  readonly scheme?: string | undefined;
  readonly network?: string | undefined;
  readonly asset?: string | undefined;
  readonly asset_symbol?: string | undefined;
  readonly access_key?: string | undefined;
}

/** Wire shape of the ap2 extension object on completed UCP checkouts. */
export interface UcpAp2Response {
  readonly merchant_authorization?: string | undefined;
}

export interface UcpMoneySummary {
  readonly subtotal?: UcpMoney | undefined;
  readonly fulfillment?: UcpMoney | undefined;
  readonly tax?: UcpMoney | undefined;
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
  completeCheckout(input: {
    readonly checkoutId: string;
    readonly ap2Mandate?: Ap2PaymentMandate | undefined;
  }): Promise<UcpCart>;
  getEmbeddedCheckoutUrl(checkoutId: string): string;
}
