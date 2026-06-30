import { describe, expect, test } from 'bun:test';

import { FetchShopwareStoreApiClient } from '../../src/commerce/shopware/shopware-store-api-client.js';

describe('FetchShopwareStoreApiClient', () => {
  test('keeps Shopware context tokens server-side by sending them as Store API headers', async () => {
    const requests: RequestInit[] = [];
    const fetchImplementation: typeof fetch = Object.assign(
      async (_url: string | URL | Request, init?: RequestInit) => {
        requests.push(init ?? {});

        return new Response(
          JSON.stringify({
            token: 'raw-cart-token',
            lineItems: [],
            price: { positionPrice: 0, totalPrice: 0, currency: 'EUR' },
          }),
          { status: 200 },
        );
      },
      { preconnect: fetch.preconnect },
    );
    const client = new FetchShopwareStoreApiClient(
      {
        baseUrl: 'https://shop.example.test',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
      },
      fetchImplementation,
    );

    await client.createCart({
      items: [{ productId: 'product-1', quantity: 1 }],
      executionContext: {
        shopwareSalesChannelId: 'sales-channel-1',
        shopwareContextToken: 'secret-shopware-context',
      },
    });

    expect(requests[0]?.headers).toEqual({
      'content-type': 'application/json',
      'sw-access-key': 'store-api-key',
      'sw-context-token': 'secret-shopware-context',
    });
  });
});
