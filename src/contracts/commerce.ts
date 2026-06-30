export interface Money {
  readonly amount: number;
  readonly currency: string;
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
  readonly total: Money;
  readonly currency: string;
}

export interface SearchProductsInput {
  readonly query: string;
  readonly limit?: number;
}

export interface ProductDetailsInput {
  readonly productId: string;
}

export interface CreateCartInput {
  readonly items: readonly CartItemInput[];
}

export interface UpdateCartInput {
  readonly cartId: string;
  readonly items: readonly CartItemInput[];
}

export interface CartItemInput {
  readonly productId: string;
  readonly quantity: number;
}

export interface CartSummaryInput {
  readonly cartId: string;
}

export interface CheckoutHandoffInput {
  readonly cartId: string;
}

export interface ProductSearchResult {
  readonly products: readonly ProductSummary[];
  readonly dataSource: 'shopware_store_api';
}

export interface ProductDetailsResult {
  readonly product: ProductDetails;
  readonly dataSource: 'shopware_store_api';
}

export interface CartResult {
  readonly cart: CartSummary;
  readonly dataSource: 'shopware_store_api';
}

export interface CheckoutHandoffResult {
  readonly summary: CartSummary;
  readonly continueUrl: string;
}

export interface CommerceAdapter {
  searchProducts(input: SearchProductsInput): Promise<ProductSearchResult>;
  getProductDetails(input: ProductDetailsInput): Promise<ProductDetailsResult>;
  createCart(input: CreateCartInput): Promise<CartResult>;
  updateCart(input: UpdateCartInput): Promise<CartResult>;
  getCartSummary(input: CartSummaryInput): Promise<CartResult>;
  prepareCheckoutHandoff(input: CheckoutHandoffInput): Promise<CheckoutHandoffResult>;
}
