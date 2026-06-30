import { describe, expect, test } from 'bun:test';

import { ShopwareAdapter } from '../../src/commerce/shopware/shopware-adapter.js';
import type { ShopwareStoreApiClient } from '../../src/commerce/shopware/shopware-store-api-client.js';

function createClient(): ShopwareStoreApiClient {
  return {
    searchProducts: async () => ({
      elements: [
        {
          id: 'product-1',
          name: 'Blue Jacket',
          productNumber: 'BJ-1',
          description: 'Warm jacket',
          available: true,
          calculatedPrice: { unitPrice: 119, totalPrice: 119, currency: 'EUR' },
          categoryNames: ['outerwear'],
          deliveryTime: { name: '2-3 days' },
          margin: 42,
          shopwareContextToken: 'secret-context-token',
        },
      ],
    }),
    getProductDetails: async () => ({
      id: 'product-1',
      name: 'Blue Jacket',
      productNumber: 'BJ-1',
      description: 'Warm jacket',
      available: true,
      calculatedPrice: { unitPrice: 119, totalPrice: 119, currency: 'EUR' },
      categoryNames: ['outerwear'],
      deliveryTime: { name: '2-3 days' },
      customFields: {
        color: 'blue',
        margin: 'hidden',
      },
      children: [],
    }),
    createCart: async () => createRawCart(),
    updateCart: async () => createRawCart(),
    getCart: async () => createRawCart(),
    getCheckoutBaseUrl: async () => 'https://shop.example.test/checkout',
  };
}

function createRawCart() {
  return {
    token: 'secret-cart-token',
    lineItems: [
      {
        id: 'line-1',
        referencedId: 'product-1',
        label: 'Blue Jacket',
        quantity: 2,
        price: {
          unitPrice: 119,
          totalPrice: 238,
          currency: 'EUR',
        },
      },
    ],
    price: {
      positionPrice: 238,
      totalPrice: 238,
      currency: 'EUR',
    },
  };
}

describe('ShopwareAdapter', () => {
  test('normalizes product search results without leaking confidential fields', async () => {
    const adapter = new ShopwareAdapter({ client: createClient() });

    const result = await adapter.searchProducts({ query: 'jacket' });

    expect(result.dataSource).toBe('shopware_store_api');
    expect(result.products[0]).toEqual({
      id: 'product-1',
      label: 'Blue Jacket',
      sku: 'BJ-1',
      description: 'Warm jacket',
      available: true,
      price: { amount: 119, currency: 'EUR' },
      deliveryEstimate: '2-3 days',
      categories: ['outerwear'],
    });
    expect(JSON.stringify(result)).not.toContain('secret-context-token');
    expect(JSON.stringify(result)).not.toContain('margin');
  });

  test('normalizes product details and filters confidential custom fields', async () => {
    const adapter = new ShopwareAdapter({ client: createClient(), confidentialFields: ['margin'] });

    const result = await adapter.getProductDetails({ productId: 'product-1' });

    expect(result.product.attributes).toEqual({ color: 'blue' });
    expect(JSON.stringify(result)).not.toContain('hidden');
  });

  test('normalizes cart creation, update, and summary without exposing cart tokens', async () => {
    const adapter = new ShopwareAdapter({ client: createClient() });

    const created = await adapter.createCart({ items: [{ productId: 'product-1', quantity: 2 }] });
    const updated = await adapter.updateCart({
      cartId: 'cart-1',
      items: [{ productId: 'product-1', quantity: 2 }],
    });
    const summary = await adapter.getCartSummary({ cartId: 'cart-1' });

    expect(created.cart.total).toEqual({ amount: 238, currency: 'EUR' });
    expect(updated.cart.items[0]?.quantity).toBe(2);
    expect(summary.cart.cartId).toBe('cart');
    expect(JSON.stringify({ created, updated, summary })).not.toContain('secret-cart-token');
  });

  test('wraps Store API failures with cause', async () => {
    const cause = new Error('Store API unavailable');
    const client = {
      ...createClient(),
      searchProducts: async () => {
        throw cause;
      },
    } satisfies ShopwareStoreApiClient;
    const adapter = new ShopwareAdapter({ client });

    try {
      await adapter.searchProducts({ query: 'jacket' });
      throw new Error('Expected adapter search to fail');
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Shopware product search failed');
      expect(error.cause).toBe(cause);
    }
  });
});
