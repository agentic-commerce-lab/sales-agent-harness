export interface Money {
  /**
   * Decimal amount in major currency units (109.99 means €109.99).
   * Adapters must convert backend-specific formats (for example UCP integer
   * minor units) before returning Money through this contract.
   */
  readonly amount: number;
  readonly currency: string;
}

export interface CommerceExecutionContext {
  readonly shopwareSalesChannelId: string;
  /**
   * Server-side only. Never expose this through customer, A2A, model, URL, or audit payloads.
   */
  readonly shopwareContextToken: string;
}

export interface ProductSummary {
  readonly id: string;
  readonly label: string;
  readonly sku?: string;
  readonly description?: string;
  readonly price?: Money;
  readonly available?: boolean;
  readonly deliveryEstimate?: string;
  readonly categories: readonly string[];
}

export interface ProductDetails extends ProductSummary {
  readonly attributes: Readonly<Record<string, string>>;
  readonly variants: readonly ProductSummary[];
}

export interface CartLineItem {
  readonly productId: string;
  readonly label: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
}

export interface CartSummary {
  readonly cartId: string;
  readonly items: readonly CartLineItem[];
  readonly subtotal: Money;
  readonly shipping?: Money;
  readonly tax?: Money;
  readonly total: Money;
  readonly currency: string;
  readonly deliveryEstimate?: string;
}

export interface SearchProductsInput {
  readonly query: string;
  readonly limit?: number;
  readonly executionContext?: CommerceExecutionContext;
}

export interface ProductDetailsInput {
  readonly productId: string;
  readonly executionContext?: CommerceExecutionContext;
}

export interface CreateCartInput {
  readonly items: readonly CartItemInput[];
  readonly executionContext?: CommerceExecutionContext;
}

export interface UpdateCartInput {
  readonly cartId: string;
  readonly items: readonly CartItemInput[];
  readonly executionContext?: CommerceExecutionContext;
}

export interface CartItemInput {
  readonly productId: string;
  readonly quantity: number;
}

export interface CartSummaryInput {
  readonly cartId: string;
  readonly executionContext?: CommerceExecutionContext;
}

export interface CheckoutHandoffInput {
  readonly cartId: string;
  readonly executionContext?: CommerceExecutionContext;
}

export interface BuyerInput {
  readonly email: string;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly phoneNumber?: string | undefined;
}

export interface ShippingAddressInput {
  readonly street: string;
  readonly zipcode: string;
  readonly city: string;
  readonly countryCode: string;
}

export interface FulfillmentInput {
  readonly type: 'shipping';
  readonly shippingAddress: ShippingAddressInput;
}

/**
 * AP2 checkout mandate credential relayed from the buyer's platform on
 * checkout completion, rides in the request's top-level `ap2.checkout_mandate`
 * field. Opaque to the harness: it forwards it to the shop for verification
 * and never generates or inspects it, since only the buyer's platform has the
 * authority to attest buyer consent. There is no separate payment-mandate
 * instrument here — a payment-specific credential (e.g. x402's own signed
 * authorization) rides through that payment method's own instrument, not a
 * synthetic AP2-branded one.
 */
export interface Ap2PaymentMandate {
  readonly checkoutMandate: string;
}

export interface CompleteCheckoutInput {
  readonly checkoutId: string;
  readonly idempotencyKey?: string | undefined;
  readonly buyer: BuyerInput;
  readonly fulfillment: FulfillmentInput;
  readonly executionContext?: CommerceExecutionContext;
  readonly ap2Mandate?: Ap2PaymentMandate | undefined;
  /**
   * UCP payment handler ids this client supports. The adapter commits the first
   * one the shop accepts; if none is supported the shop hands off to a browser
   * checkout (requires_escalation) instead of placing an order.
   */
  readonly supportedPaymentHandlers?: readonly string[] | undefined;
}

export interface ProductSearchResult {
  readonly products: readonly ProductSummary[];
  readonly dataSource: 'shopware_store_api' | 'ucp';
}

export interface ProductDetailsResult {
  readonly product: ProductDetails;
  readonly dataSource: 'shopware_store_api' | 'ucp';
}

export interface CartResult {
  readonly cart: CartSummary;
  readonly dataSource: 'shopware_store_api' | 'ucp';
}

export interface CheckoutHandoffResult {
  readonly summary: CartSummary;
  readonly continueUrl: string;
  /** The UCP checkout session id, when the adapter creates one (ucp_shopware only). */
  readonly checkoutId?: string | undefined;
}

/**
 * Buyer-executed payment instructions relayed from the shop's completed
 * checkout (x402 protocol: HTTP 402 handshake against payUrl, ownership
 * proven via deepLinkCode). The harness only passes these through — payment
 * execution stays a buyer-side action and remains a restricted action for
 * the seller agent.
 */
export interface X402PaymentInstructions {
  readonly handlerId: string;
  readonly payUrl: string;
  readonly deepLinkCode: string;
  readonly scheme?: string | undefined;
  readonly network?: string | undefined;
  readonly asset?: string | undefined;
  readonly assetSymbol?: string | undefined;
  /** Public Store API client identification, not a credential. */
  readonly accessKey?: string | undefined;
}

export interface CompletedCheckoutResult {
  readonly summary: CartSummary;
  readonly orderId?: string | undefined;
  /**
   * 'completed' — order placed (payment settles via x402 or was taken).
   * 'requires_escalation' — no mutually-supported payment method, so NO order
   * was placed; the buyer must finish in a browser via `continueUrl`.
   */
  readonly status: 'completed' | 'requires_escalation';
  readonly x402?: X402PaymentInstructions | undefined;
  /** JWS Detached Content signature proving the shop verified the AP2 mandate. */
  readonly ap2MerchantAuthorization?: string | undefined;
  /**
   * Fallback web checkout URL (UCP `continue_url`). x402 stays the primary
   * payment path; this lets a client that can't pay programmatically (e.g.
   * x402 unsupported/disabled) hand the buyer off to the shop's browser
   * checkout instead.
   */
  readonly continueUrl?: string | undefined;
}

/**
 * The real terms of a checkout the seller has prepared but not yet
 * completed — surfaced to the buyer ahead of completion so it can build an
 * AP2 mandate that pins the actual transaction instead of guessing at it.
 */
export interface CheckoutTerms {
  readonly checkoutId: string;
  readonly total: Money;
}

export interface CommerceAdapter {
  searchProducts(input: SearchProductsInput): Promise<ProductSearchResult>;
  getProductDetails(input: ProductDetailsInput): Promise<ProductDetailsResult>;
  createCart(input: CreateCartInput): Promise<CartResult>;
  updateCart(input: UpdateCartInput): Promise<CartResult>;
  getCartSummary(input: CartSummaryInput): Promise<CartResult>;
  prepareCheckoutHandoff(input: CheckoutHandoffInput): Promise<CheckoutHandoffResult>;
  completeCheckout(input: CompleteCheckoutInput): Promise<CompletedCheckoutResult>;
}
