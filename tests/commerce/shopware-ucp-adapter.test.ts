import { describe, expect, test } from 'bun:test';

import { ShopwareUcpAdapter } from '../../src/commerce/shopware-ucp/shopware-ucp-adapter.js';
import { FetchShopwareUcpClient } from '../../src/commerce/shopware-ucp/shopware-ucp-client.js';

describe('FetchShopwareUcpClient', () => {
  test('calls Agentic Commerce UCP REST endpoints without Store API credentials', async () => {
    const requests: {
      readonly url: string;
      readonly headers: Headers;
      readonly body: unknown;
    }[] = [];
    const fetchImplementation = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({
          url: requestUrl(url),
          headers: new Headers(init?.headers),
          body: JSON.parse(requestBody(init?.body)),
        });

        return new Response(
          JSON.stringify({
            id: 'checkout-1',
            currency: 'EUR',
            line_items: [],
            money_summary: {
              subtotal: { amount: 0, currency: 'EUR' },
              total: { amount: 0, currency: 'EUR' },
            },
            continue_url: 'https://shop.example.test/ucp/embedded/checkout/checkout-1',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
      { preconnect: () => {} },
    ) satisfies typeof fetch;
    const client = new FetchShopwareUcpClient(
      {
        baseUrl: 'https://shop.example.test/',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
      },
      fetchImplementation,
    );

    await client.createCheckout({
      lineItems: [{ productId: 'product-1', quantity: 2 }],
      cartId: 'cart-1',
    });

    expect(requests[0]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions');
    expect(requests[0]?.headers.get('sw-access-key')).toBeNull();
    expect(requests[0]?.headers.get('sw-context-token')).toBeNull();
    expect(requests[0]?.body).toEqual({
      cart_id: 'cart-1',
      line_items: [
        {
          item: { id: 'product-1' },
          quantity: 2,
        },
      ],
    });
  });
});

describe('ShopwareUcpAdapter', () => {
  test('creates checkout handoff from a UCP checkout continue URL', async () => {
    const adapter = new ShopwareUcpAdapter({
      client: {
        searchProducts: async () => ({ products: [] }),
        getProductDetails: async () => ({
          id: 'product-1',
          title: 'Blue Jacket',
          price: { amount: 119, currency: 'EUR' },
        }),
        createCart: async () => createUcpCart(),
        updateCart: async () => createUcpCart(),
        getCart: async () => createUcpCart(),
        createCheckout: async () => ({
          ...createUcpCart(),
          id: 'checkout-1',
          continueUrl: 'https://shop.example.test/ucp/embedded/checkout/checkout-1',
        }),
      },
    });

    const handoff = await adapter.prepareCheckoutHandoff({
      cartId: 'cart-1',
      executionContext: {
        shopwareSalesChannelId: 'sales-channel-1',
        shopwareContextToken: 'secret-context-token',
      },
    });

    expect(handoff.continueUrl).toBe('https://shop.example.test/ucp/embedded/checkout/checkout-1');
    expect(handoff.summary.cartId).toBe('cart-1');
    expect(JSON.stringify(handoff)).not.toContain('secret-context-token');
  });
});

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

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

function requestBody(body: unknown): string {
  return typeof body === 'string' ? body : '{}';
}
