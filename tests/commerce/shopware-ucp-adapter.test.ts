import { describe, expect, test } from 'bun:test';

import { ShopwareUcpAdapter } from '../../src/commerce/shopware-ucp/shopware-ucp-adapter.js';
import {
  FetchShopwareUcpClient,
  type ShopwareUcpClient,
} from '../../src/commerce/shopware-ucp/shopware-ucp-client.js';
import { createUcpPlatformProfile } from '../../src/commerce/shopware-ucp/ucp-platform-profile.js';

const testPrivateJwk = {
  kty: 'EC',
  crv: 'P-256',
  kid: 'platform-test-key',
  x: 'cNpFIgz_e5udjwWFh6km39p7oY8rYQcEIcgaMHz1fxE',
  y: 'm89agkO4_9qqDusC-HdYWGEcIvZVo-nYrn0iD-cdLkk',
  d: 'RHeDokMvtGXfeoYZ7AcIcJLG-yI_SZgb3sUA-2RxgxI',
};

describe('FetchShopwareUcpClient', () => {
  test('calls Agentic Commerce UCP REST endpoints without Store API credentials', async () => {
    const { client, requests } = createRecordingUcpClient();

    await client.createCheckout({
      lineItems: [{ productId: 'product-1', quantity: 2 }],
      cartId: 'cart-1',
    });
    await client.getCheckout({ checkoutId: 'checkout-1' });
    await client.updateCheckout({
      checkoutId: 'checkout-1',
      lineItems: [{ productId: 'product-1', quantity: 2 }],
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });
    await client.completeCheckout({ checkoutId: 'checkout-1' });

    assertCreateCheckoutRequest(requests);
    assertGetCheckoutRequest(requests);
    assertUpdateCheckoutRequest(requests);
    assertCompleteCheckoutRequest(requests);
  });
});

describe('FetchShopwareUcpClient errors', () => {
  test('includes UCP error response details in failed requests', async () => {
    const client = new FetchShopwareUcpClient(
      {
        baseUrl: 'https://shop.example.test/',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
        ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
      },
      Object.assign(
        async () =>
          new Response(
            JSON.stringify({
              errors: ['$.checkout_session.buyer.email is required'],
            }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          ),
        { preconnect: () => {} },
      ) satisfies typeof fetch,
    );

    await expectRejectsWith(
      client.completeCheckout({ checkoutId: 'checkout-1' }),
      'Shopware UCP request failed with status 422',
    );
    await expectRejectsWith(
      client.completeCheckout({ checkoutId: 'checkout-1' }),
      '$.checkout_session.buyer.email is required',
    );
  });
});

describe('FetchShopwareUcpClient signing', () => {
  test('signs UCP REST requests with RFC 9421 headers when a platform key is configured', async () => {
    const requests: { readonly headers: Headers; readonly body: string }[] = [];
    const fetchImplementation = Object.assign(
      async (_url: string | URL | Request, init?: RequestInit) => {
        requests.push({
          headers: new Headers(init?.headers),
          body: requestBody(init?.body),
        });

        return new Response(
          JSON.stringify({
            products: [],
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
        ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
        ucpSigningKeyId: 'platform-test-key',
        ucpSigningPrivateKeyJwk: JSON.stringify(testPrivateJwk),
      },
      fetchImplementation,
    );

    await client.searchProducts({ query: 'jacket', limit: 3 });

    const headers = requests[0]?.headers;
    expect(headers?.get('ucp-agent')).toBe('profile="https://platform.example/.well-known/ucp"');
    expect(headers?.get('content-digest')).toBe(
      'sha-256=:xZpldSE/jTNNVo8XMFRmkL4Ev/M0rjUNbN08cQmZnfQ=:',
    );
    expect(headers?.get('signature-input')).toMatch(
      /^sig1=\("@method" "@authority" "@path" "ucp-agent" "idempotency-key" "content-digest" "content-type"\);created=\d+;keyid="platform-test-key"$/,
    );
    expect(headers?.get('signature')).toMatch(/^sig1=:[A-Za-z0-9+/]+=*:/);
    expect(requests[0]?.body).toBe('{"query":"jacket","limit":3}');
  });
});

describe('createUcpPlatformProfile', () => {
  test('creates a UCP platform profile with a public signing key only', () => {
    const profile = createUcpPlatformProfile({
      profileUrl: 'https://platform.example/.well-known/ucp',
      signingKeyId: 'platform-test-key',
      signingPrivateKeyJwk: JSON.stringify(testPrivateJwk),
    });

    expect(profile.signing_keys).toEqual([
      {
        kty: 'EC',
        crv: 'P-256',
        kid: 'platform-test-key',
        alg: 'ES256',
        use: 'sig',
        x: 'cNpFIgz_e5udjwWFh6km39p7oY8rYQcEIcgaMHz1fxE',
        y: 'm89agkO4_9qqDusC-HdYWGEcIvZVo-nYrn0iD-cdLkk',
      },
    ]);
    expect(profile.ucp.capabilities['dev.ucp.shopping.catalog'][0]?.version).toBe('2026-04-08');
    expect(JSON.stringify(profile)).not.toContain('"d"');
  });
});

describe('ShopwareUcpAdapter', () => {
  test('creates checkout handoff from a UCP checkout continue URL', async () => {
    const adapter = new ShopwareUcpAdapter({ client: createAdapterClient() });

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

  test('completes a UCP checkout without exposing server-side context tokens', async () => {
    const adapter = new ShopwareUcpAdapter({ client: createAdapterClient() });

    const completed = await adapter.completeCheckout({
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
      executionContext: {
        shopwareSalesChannelId: 'sales-channel-1',
        shopwareContextToken: 'secret-context-token',
      },
    });

    expect(completed.summary.cartId).toBe('checkout-1');
    expect(completed.orderId).toBe('order-1');
    expect(JSON.stringify(completed)).not.toContain('secret-context-token');
  });

  test('includes UCP checkout failure details in adapter errors', async () => {
    const adapter = new ShopwareUcpAdapter({
      client: {
        ...createAdapterClient(),
        completeCheckout: async () => {
          throw new Error(
            'Shopware UCP request failed with status 422: {"errors":["country_code is invalid"]}',
          );
        },
      },
    });

    const promise = adapter.completeCheckout({
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    await expectRejectsWith(promise, 'Shopware UCP checkout completion failed');
    await expectRejectsWith(
      promise,
      'Shopware UCP request failed with status 422: {"errors":["country_code is invalid"]}',
    );
  });
});

describe('ShopwareUcpAdapter total normalization', () => {
  test('normalizes UCP totals arrays and falls back to embedded checkout URLs', async () => {
    const adapter = new ShopwareUcpAdapter({
      client: {
        searchProducts: async () => ({ products: [] }),
        getProductDetails: async () => ({ id: 'product-1', title: 'Blue Jacket' }),
        createCart: async () => createTotalsCart(),
        updateCart: async () => createTotalsCart(),
        getCart: async () => createTotalsCart(),
        getCheckout: async () => createTotalsCart(),
        createCheckout: async () => ({
          ...createTotalsCart(),
          id: 'checkout-1',
        }),
        updateCheckout: async () => ({
          ...createTotalsCart(),
          id: 'checkout-1',
        }),
        completeCheckout: async () => ({
          ...createTotalsCart(),
          id: 'checkout-1',
          status: 'completed',
        }),
        getEmbeddedCheckoutUrl: (checkoutId) =>
          `https://shop.example.test/ucp/embedded/checkout/${checkoutId}`,
      },
    });

    const handoff = await adapter.prepareCheckoutHandoff({ cartId: 'cart-1' });

    expect(handoff.summary.total).toEqual({ amount: 2000, currency: 'EUR' });
    expect(handoff.summary.items[0]?.unitPrice).toEqual({ amount: 2000, currency: 'EUR' });
    expect(handoff.summary.items[0]?.totalPrice).toEqual({ amount: 2000, currency: 'EUR' });
    expect(handoff.continueUrl).toBe('https://shop.example.test/ucp/embedded/checkout/checkout-1');
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

function createTotalsCart() {
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
      { type: 'total', amount: 2000 },
    ],
  };
}

interface RecordedRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: unknown;
}

function createRecordingUcpClient(): {
  readonly client: FetchShopwareUcpClient;
  readonly requests: readonly RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetchImplementation = Object.assign(
    async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: requestUrl(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(requestBody(init?.body)),
      });

      return new Response(JSON.stringify(createEmptyCheckout()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    { preconnect: () => {} },
  ) satisfies typeof fetch;

  return {
    client: new FetchShopwareUcpClient(createUcpConfig(), fetchImplementation),
    requests,
  };
}

function createEmptyCheckout() {
  return {
    id: 'checkout-1',
    currency: 'EUR',
    line_items: [],
    money_summary: {
      subtotal: { amount: 0, currency: 'EUR' },
      total: { amount: 0, currency: 'EUR' },
    },
    continue_url: 'https://shop.example.test/ucp/embedded/checkout/checkout-1',
  };
}

function createUcpConfig() {
  return {
    baseUrl: 'https://shop.example.test/',
    storeApiAccessKey: 'store-api-key',
    defaultSalesChannelId: 'sales-channel-1',
    ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
  };
}

function createAdapterClient(): ShopwareUcpClient {
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

function assertCreateCheckoutRequest(requests: readonly RecordedRequest[]): void {
  expect(requests[0]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions');
  expect(requests[0]?.headers.get('sw-access-key')).toBeNull();
  expect(requests[0]?.headers.get('sw-context-token')).toBeNull();
  expect(requests[0]?.headers.get('ucp-agent')).toBe(
    'profile="https://platform.example/.well-known/ucp"',
  );
  expect(requests[0]?.headers.get('idempotency-key')).toStartWith('sales-agent-harness-');
  expect(requests[0]?.body).toEqual({
    cart_id: 'cart-1',
    line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
  });
}

function assertUpdateCheckoutRequest(requests: readonly RecordedRequest[]): void {
  expect(requests[2]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions/checkout-1');
  expect(requests[2]?.body).toEqual({
    id: 'checkout-1',
    line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
    buyer: {
      email: 'buyer@example.test',
      first_name: 'Ada',
      last_name: 'Buyer',
      phone_number: '+49123456789',
    },
    fulfillment: {
      type: 'shipping',
      extra: {
        shipping_address: {
          street: 'Test Street 1',
          zipcode: '12345',
          city: 'Berlin',
          country_code: 'DE',
        },
      },
    },
  });
}

function assertCompleteCheckoutRequest(requests: readonly RecordedRequest[]): void {
  expect(requests[3]?.url).toBe(
    'https://shop.example.test/ucp/v1/checkout-sessions/checkout-1/complete',
  );
  expect(requests[3]?.body).toEqual({ payment: { instruments: [] } });
}

function assertGetCheckoutRequest(requests: readonly RecordedRequest[]): void {
  expect(requests[1]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions/checkout-1');
}

async function expectRejectsWith(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error('Expected rejection to be an Error', { cause: error });
    }

    expect(error.message).toContain(message);

    return;
  }

  throw new Error(`Expected promise to reject with ${message}`);
}

function createBuyer() {
  return {
    email: 'buyer@example.test',
    firstName: 'Ada',
    lastName: 'Buyer',
    phoneNumber: '+49123456789',
  };
}

function createFulfillment() {
  return {
    type: 'shipping' as const,
    shippingAddress: {
      street: 'Test Street 1',
      zipcode: '12345',
      city: 'Berlin',
      countryCode: 'DE',
    },
  };
}

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

function requestBody(body: unknown): string {
  return typeof body === 'string' ? body : '{}';
}
