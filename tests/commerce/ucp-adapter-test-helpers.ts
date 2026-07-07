import { expect } from 'bun:test';

import type { UcpClient } from '../../src/commerce/ucp/ucp-client.js';
import { createBuyer, createFulfillment } from './ucp-common-test-helpers.js';

function createUcpCart() {
  return {
    id: 'cart-1',
    currency: 'EUR',
    lineItems: [
      {
        id: 'line-1',
        item: { id: 'product-1', title: 'Blue Jacket' },
        quantity: 2,
        unitPrice: { amount: 119, currency: 'EUR' },
        totalPrice: { amount: 238, currency: 'EUR' },
      },
    ],
    moneySummary: {
      subtotal: { amount: 238, currency: 'EUR' },
      total: { amount: 238, currency: 'EUR' },
    },
  };
}

export function createTotalsCart() {
  return {
    id: 'cart-1',
    currency: 'EUR',
    line_items: [
      {
        id: 'line-1',
        item: { id: 'product-1', title: 'Blue Jacket', price: 2000 },
        quantity: 1,
        totals: [
          { type: 'subtotal', amount: 2000 },
          { type: 'total', amount: 2000 },
        ],
      },
    ],
    totals: [
      { type: 'subtotal', amount: 2000 },
      { type: 'fulfillment', amount: 490 },
      { type: 'tax', amount: 380 },
      { type: 'total', amount: 2870 },
    ],
  };
}

export function createAdapterClient(): UcpClient {
  return {
    searchProducts: async () => ({ products: [] }),
    getProductDetails: async () => ({
      id: 'product-1',
      title: 'Blue Jacket',
      price: { amount: 119, currency: 'EUR' },
    }),
    createCart: async () => createUcpCart(),
    updateCart: async () => createUcpCart(),
    getCart: async () => createUcpCart(),
    getCheckout: async () => ({ ...createUcpCart(), id: 'checkout-1' }),
    createCheckout: async () => ({
      ...createUcpCart(),
      id: 'checkout-1',
      continueUrl: 'https://shop.example.test/ucp/embedded/checkout/checkout-1',
    }),
    updateCheckout: async (input) => {
      expect(input).toEqual({
        checkoutId: 'checkout-1',
        lineItems: [{ productId: 'product-1', quantity: 2 }],
        buyer: createBuyer(),
        fulfillment: createFulfillment(),
      });

      return { ...createUcpCart(), id: 'checkout-1' };
    },
    completeCheckout: async () => ({
      ...createUcpCart(),
      id: 'checkout-1',
      status: 'completed',
      order: { id: 'order-1' },
    }),
    getEmbeddedCheckoutUrl: (checkoutId) =>
      `https://shop.example.test/ucp/embedded/checkout/${checkoutId}`,
  };
}
