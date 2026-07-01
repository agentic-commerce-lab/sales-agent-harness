import { describe, expect, test } from 'bun:test';

import { ShopwareUcpAdapter } from '../../src/commerce/shopware-ucp/shopware-ucp-adapter.js';
import { FetchShopwareUcpClient } from '../../src/commerce/shopware-ucp/shopware-ucp-client.js';
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
        ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
      },
      fetchImplementation,
    );

    await client.createCheckout({
      lineItems: [{ productId: 'product-1', quantity: 2 }],
      cartId: 'cart-1',
    });
    await client.completeCheckout({ checkoutId: 'checkout-1' });

    expect(requests[0]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions');
    expect(requests[0]?.headers.get('sw-access-key')).toBeNull();
    expect(requests[0]?.headers.get('sw-context-token')).toBeNull();
    expect(requests[0]?.headers.get('ucp-agent')).toBe(
      'profile="https://platform.example/.well-known/ucp"',
    );
    expect(requests[0]?.headers.get('idempotency-key')).toStartWith('sales-agent-harness-');
    expect(requests[0]?.body).toEqual({
      cart_id: 'cart-1',
      line_items: [
        {
          item: { id: 'product-1' },
          quantity: 2,
        },
      ],
    });
    expect(requests[1]?.url).toBe(
      'https://shop.example.test/ucp/v1/checkout-sessions/checkout-1/complete',
    );
    expect(requests[1]?.body).toEqual({});
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
        completeCheckout: async () => ({
          ...createUcpCart(),
          id: 'checkout-1',
          status: 'completed',
          order: { id: 'order-1' },
        }),
        getEmbeddedCheckoutUrl: (checkoutId) =>
          `https://shop.example.test/ucp/embedded/checkout/${checkoutId}`,
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

  test('completes a UCP checkout without exposing server-side context tokens', async () => {
    const adapter = new ShopwareUcpAdapter({
      client: {
        searchProducts: async () => ({ products: [] }),
        getProductDetails: async () => ({ id: 'product-1', title: 'Blue Jacket' }),
        createCart: async () => createUcpCart(),
        updateCart: async () => createUcpCart(),
        getCart: async () => createUcpCart(),
        createCheckout: async () => ({
          ...createUcpCart(),
          id: 'checkout-1',
        }),
        completeCheckout: async () => ({
          ...createUcpCart(),
          id: 'checkout-1',
          status: 'completed',
          order: { id: 'order-1' },
        }),
        getEmbeddedCheckoutUrl: (checkoutId) =>
          `https://shop.example.test/ucp/embedded/checkout/${checkoutId}`,
      },
    });

    const completed = await adapter.completeCheckout({
      checkoutId: 'checkout-1',
      executionContext: {
        shopwareSalesChannelId: 'sales-channel-1',
        shopwareContextToken: 'secret-context-token',
      },
    });

    expect(completed.summary.cartId).toBe('checkout-1');
    expect(completed.orderId).toBe('order-1');
    expect(JSON.stringify(completed)).not.toContain('secret-context-token');
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
        createCheckout: async () => ({
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

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

function requestBody(body: unknown): string {
  return typeof body === 'string' ? body : '{}';
}
