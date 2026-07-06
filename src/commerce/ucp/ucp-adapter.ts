import type {
  CartItemInput,
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
} from './normalize-ucp.js';
import type { UcpClient } from './ucp-client.js';
import type { UcpCart, UcpLineItem } from './ucp-types.js';

export interface UcpAdapterOptions {
  readonly client: UcpClient;
}

export class UcpAdapter implements CommerceAdapter {
  readonly #client: UcpClient;

  constructor(options: UcpAdapterOptions) {
    this.#client = options.client;
  }

  // fallow-ignore-next-line unused-class-member
  async searchProducts(input: SearchProductsInput): Promise<ProductSearchResult> {
    try {
      const result = await this.#client.searchProducts(input);

      return {
        products: result.products.map(normalizeUcpProduct),
        dataSource: 'ucp',
      };
    } catch (error) {
      throw wrapUcpError('UCP product search failed', error);
    }
  }

  async getProductDetails(input: ProductDetailsInput): Promise<ProductDetailsResult> {
    try {
      const product = await this.#client.getProductDetails(input);

      return {
        product: normalizeUcpProductDetails(product),
        dataSource: 'ucp',
      };
    } catch (error) {
      throw wrapUcpError('UCP product detail lookup failed', error);
    }
  }

  // fallow-ignore-next-line unused-class-member
  async createCart(input: CreateCartInput): Promise<CartResult> {
    try {
      const cart = await this.#client.createCart(input);

      return {
        cart: normalizeUcpCart(cart),
        dataSource: 'ucp',
      };
    } catch (error) {
      throw wrapUcpError('UCP cart creation failed', error);
    }
  }

  // fallow-ignore-next-line unused-class-member
  async updateCart(input: UpdateCartInput): Promise<CartResult> {
    try {
      const cart = await this.#client.updateCart(input);

      return {
        cart: normalizeUcpCart(cart),
        dataSource: 'ucp',
      };
    } catch (error) {
      throw wrapUcpError('UCP cart update failed', error);
    }
  }

  // fallow-ignore-next-line unused-class-member
  async getCartSummary(input: { readonly cartId: string }): Promise<CartResult> {
    try {
      const cart = await this.#client.getCart(input);

      return {
        cart: normalizeUcpCart(cart),
        dataSource: 'ucp',
      };
    } catch (error) {
      throw wrapUcpError('UCP cart summary lookup failed', error);
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
      throw wrapUcpError('UCP checkout handoff failed', error);
    }
  }

  async completeCheckout(input: CompleteCheckoutInput): Promise<CompletedCheckoutResult> {
    try {
      const checkoutSession = await this.#client.getCheckout({ checkoutId: input.checkoutId });
      await this.#client.updateCheckout({
        checkoutId: input.checkoutId,
        lineItems: readCheckoutLineItems(checkoutSession),
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
      throw wrapUcpError('UCP checkout completion failed', error);
    }
  }
}

function wrapUcpError(message: string, error: unknown): Error {
  if (error instanceof Error && error.message.length > 0) {
    return new Error(`${message}: ${error.message}`, { cause: error });
  }

  return new Error(message, { cause: error });
}

function readCheckoutLineItems(checkout: UcpCart): readonly CartItemInput[] {
  const lineItems = checkout.lineItems ?? checkout.line_items ?? [];

  if (lineItems.length === 0) {
    throw new Error('UCP checkout completion failed because the checkout has no line items');
  }

  return lineItems.map(readCheckoutLineItem);
}

function readCheckoutLineItem(lineItem: UcpLineItem): CartItemInput {
  const productId = lineItem.item?.id;

  if (!productId) {
    throw new Error('UCP checkout line item is missing item.id');
  }

  if (!Number.isInteger(lineItem.quantity) || lineItem.quantity <= 0) {
    throw new Error(`UCP checkout line item ${productId} has an invalid quantity`);
  }

  return {
    productId,
    quantity: lineItem.quantity,
  };
}
