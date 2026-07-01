import type {
  CartResult,
  CheckoutHandoffInput,
  CheckoutHandoffResult,
  CommerceAdapter,
  CompleteCheckoutInput,
  CompletedCheckoutResult,
  CreateCartInput,
  ProductDetailsInput,
  ProductDetailsResult,
  ProductSearchResult,
  SearchProductsInput,
  UpdateCartInput,
} from '../../contracts/commerce.js';
import {
  normalizeUcpCart,
  normalizeUcpProduct,
  normalizeUcpProductDetails,
  readUcpContinueUrl,
} from './normalize-shopware-ucp.js';
import type { ShopwareUcpClient } from './shopware-ucp-client.js';

export interface ShopwareUcpAdapterOptions {
  readonly client: ShopwareUcpClient;
}

export class ShopwareUcpAdapter implements CommerceAdapter {
  readonly #client: ShopwareUcpClient;

  constructor(options: ShopwareUcpAdapterOptions) {
    this.#client = options.client;
  }

  // fallow-ignore-next-line unused-class-member
  async searchProducts(input: SearchProductsInput): Promise<ProductSearchResult> {
    try {
      const result = await this.#client.searchProducts(input);

      return {
        products: result.products.map(normalizeUcpProduct),
        dataSource: 'shopware_ucp',
      };
    } catch (error) {
      throw wrapShopwareUcpError('Shopware UCP product search failed', error);
    }
  }

  // fallow-ignore-next-line unused-class-member
  async getProductDetails(input: ProductDetailsInput): Promise<ProductDetailsResult> {
    try {
      const product = await this.#client.getProductDetails(input);

      return {
        product: normalizeUcpProductDetails(product),
        dataSource: 'shopware_ucp',
      };
    } catch (error) {
      throw wrapShopwareUcpError('Shopware UCP product detail lookup failed', error);
    }
  }

  // fallow-ignore-next-line unused-class-member
  async createCart(input: CreateCartInput): Promise<CartResult> {
    try {
      const cart = await this.#client.createCart(input);

      return {
        cart: normalizeUcpCart(cart),
        dataSource: 'shopware_ucp',
      };
    } catch (error) {
      throw wrapShopwareUcpError('Shopware UCP cart creation failed', error);
    }
  }

  // fallow-ignore-next-line unused-class-member
  async updateCart(input: UpdateCartInput): Promise<CartResult> {
    try {
      const cart = await this.#client.updateCart(input);

      return {
        cart: normalizeUcpCart(cart),
        dataSource: 'shopware_ucp',
      };
    } catch (error) {
      throw wrapShopwareUcpError('Shopware UCP cart update failed', error);
    }
  }

  // fallow-ignore-next-line unused-class-member
  async getCartSummary(input: { readonly cartId: string }): Promise<CartResult> {
    try {
      const cart = await this.#client.getCart(input);

      return {
        cart: normalizeUcpCart(cart),
        dataSource: 'shopware_ucp',
      };
    } catch (error) {
      throw wrapShopwareUcpError('Shopware UCP cart summary lookup failed', error);
    }
  }

  async prepareCheckoutHandoff(input: CheckoutHandoffInput): Promise<CheckoutHandoffResult> {
    try {
      const cart = await this.#client.getCart({ cartId: input.cartId });
      const summary = normalizeUcpCart(cart);
      const checkout = await this.#client.createCheckout({
        cartId: input.cartId,
        lineItems: summary.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      return {
        summary,
        continueUrl:
          readUcpContinueUrl(checkout) ?? this.#client.getEmbeddedCheckoutUrl(checkout.id),
      };
    } catch (error) {
      throw wrapShopwareUcpError('Shopware UCP checkout handoff failed', error);
    }
  }

  async completeCheckout(input: CompleteCheckoutInput): Promise<CompletedCheckoutResult> {
    try {
      await this.#client.updateCheckout({
        checkoutId: input.checkoutId,
        buyer: input.buyer,
        fulfillment: input.fulfillment,
      });
      const checkout = await this.#client.completeCheckout({ checkoutId: input.checkoutId });

      return {
        summary: normalizeUcpCart(checkout),
        orderId: checkout.order?.id,
        status: 'completed',
      };
    } catch (error) {
      throw wrapShopwareUcpError('Shopware UCP checkout completion failed', error);
    }
  }
}

function wrapShopwareUcpError(message: string, error: unknown): Error {
  if (error instanceof Error && error.message.length > 0) {
    return new Error(`${message}: ${error.message}`, { cause: error });
  }

  return new Error(message, { cause: error });
}
