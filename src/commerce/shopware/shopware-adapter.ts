import type {
  CartResult,
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
  normalizeShopwareCart,
  normalizeShopwareProduct,
  normalizeShopwareProductDetails,
} from './normalize-shopware.js';
import type { ShopwareStoreApiClient } from './shopware-store-api-client.js';

export interface ShopwareAdapterOptions {
  readonly client: ShopwareStoreApiClient;
  readonly confidentialFields?: readonly string[];
}

export class ShopwareAdapter implements CommerceAdapter {
  readonly #client: ShopwareStoreApiClient;
  readonly #confidentialFields: readonly string[];

  constructor(options: ShopwareAdapterOptions) {
    this.#client = options.client;
    this.#confidentialFields = options.confidentialFields ?? [];
  }

  async searchProducts(input: SearchProductsInput): Promise<ProductSearchResult> {
    try {
      const result = await this.#client.searchProducts(input);

      return {
        products: result.elements.map(normalizeShopwareProduct),
        dataSource: 'shopware_store_api',
      };
    } catch (error) {
      throw new Error('Shopware product search failed', { cause: error });
    }
  }

  async getProductDetails(input: ProductDetailsInput): Promise<ProductDetailsResult> {
    try {
      const product = await this.#client.getProductDetails(input);

      return {
        product: normalizeShopwareProductDetails(product, this.#confidentialFields),
        dataSource: 'shopware_store_api',
      };
    } catch (error) {
      throw new Error('Shopware product detail lookup failed', { cause: error });
    }
  }

  async createCart(input: CreateCartInput): Promise<CartResult> {
    try {
      const cart = await this.#client.createCart(input);

      return {
        cart: normalizeShopwareCart(cart),
        dataSource: 'shopware_store_api',
      };
    } catch (error) {
      throw new Error('Shopware cart creation failed', { cause: error });
    }
  }

  async updateCart(input: UpdateCartInput): Promise<CartResult> {
    try {
      const cart = await this.#client.updateCart(input);

      return {
        cart: normalizeShopwareCart(cart),
        dataSource: 'shopware_store_api',
      };
    } catch (error) {
      throw new Error('Shopware cart update failed', { cause: error });
    }
  }

  async getCartSummary(input: { readonly cartId: string }): Promise<CartResult> {
    try {
      const cart = await this.#client.getCart(input);

      return {
        cart: normalizeShopwareCart(cart),
        dataSource: 'shopware_store_api',
      };
    } catch (error) {
      throw new Error('Shopware cart summary lookup failed', { cause: error });
    }
  }

  // fallow-ignore-next-line unused-class-member
  async prepareCheckoutHandoff(input: { readonly cartId: string }) {
    const [summaryResult, checkoutBaseUrl] = await Promise.all([
      this.getCartSummary(input),
      this.#client.getCheckoutBaseUrl(),
    ]);

    return {
      summary: summaryResult.cart,
      continueUrl: checkoutBaseUrl,
    };
  }

  // fallow-ignore-next-line unused-class-member
  async completeCheckout(_input: CompleteCheckoutInput): Promise<CompletedCheckoutResult> {
    throw new Error('Automated checkout completion requires the Shopware UCP adapter');
  }
}
