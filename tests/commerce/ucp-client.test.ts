import { describe, expect, test } from 'bun:test';
import { createPublicKey, verify } from 'node:crypto';

import { FetchUcpClient } from '../../src/commerce/ucp/ucp-client.js';
import { createUcpPlatformProfile } from '../../src/commerce/ucp/ucp-platform-profile.js';
import {
  ap2CapableProfile,
  assertCompleteCheckoutRequest,
  assertCreateCheckoutRequest,
  assertGetCheckoutRequest,
  assertUpdateCheckoutRequest,
  createEmptyCheckout,
  createRecordingUcpClient,
  createUcpConfig,
  minimalProfile,
  requestBody,
  requestUrl,
  testPrivateJwk,
} from './ucp-client-test-helpers.js';
import { createBuyer, createFulfillment, expectRejectsWith } from './ucp-common-test-helpers.js';

describe('FetchUcpClient', () => {
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

describe('FetchUcpClient AP2 mandates', () => {
  test('carries the checkout mandate under ap2 without a payment instrument', async () => {
    const { client, requests } = createRecordingUcpClient(ap2CapableProfile);

    await client.completeCheckout({
      checkoutId: 'checkout-1',
      ap2Mandate: { checkoutMandate: 'checkout-mandate-jwt' },
    });

    expect(requests[0]?.url).toBe(
      'https://shop.example.test/ucp/v1/checkout-sessions/checkout-1/complete',
    );
    expect(requests[0]?.body).toEqual({
      payment: { instruments: [] },
      ap2: { checkout_mandate: 'checkout-mandate-jwt' },
    });
  });

  test('omits the ap2 extension and sends empty instruments without a mandate', async () => {
    const { client, requests } = createRecordingUcpClient();

    await client.completeCheckout({ checkoutId: 'checkout-1' });

    expect(requests[0]?.body).toEqual({ payment: { instruments: [] } });
  });

  test('fails loudly instead of silently dropping a mandate the shop cannot verify', async () => {
    const { client } = createRecordingUcpClient(minimalProfile);

    await expectRejectsWith(
      client.completeCheckout({
        checkoutId: 'checkout-1',
        ap2Mandate: { checkoutMandate: 'checkout-mandate-jwt' },
      }),
      'does not advertise dev.ucp.shopping.ap2_mandate support',
    );
  });
});

describe('FetchUcpClient endpoint discovery', () => {
  test('caches the discovered endpoint across multiple API calls', async () => {
    const discoveryCalls: string[] = [];
    const fetchImplementation = Object.assign(
      async (url: string | URL | Request) => {
        const urlStr = requestUrl(url);
        if (urlStr.endsWith('/.well-known/ucp')) {
          discoveryCalls.push(urlStr);
          return new Response(JSON.stringify(minimalProfile), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(createEmptyCheckout()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      { preconnect: () => {} },
    ) satisfies typeof fetch;

    const client = new FetchUcpClient(createUcpConfig(), fetchImplementation);
    await client.createCheckout({ lineItems: [{ productId: 'p1', quantity: 1 }] });
    await client.completeCheckout({ checkoutId: 'checkout-1' });

    expect(discoveryCalls).toHaveLength(1);
  });

  test('throws a descriptive error when discovery returns 404', async () => {
    const client = new FetchUcpClient(
      createUcpConfig(),
      Object.assign(async () => new Response('Not Found', { status: 404 }), {
        preconnect: () => {},
      }) satisfies typeof fetch,
    );

    const rejected = client.createCheckout({ lineItems: [] });
    await expectRejectsWith(rejected, 'UCP endpoint discovery failed');
    await expectRejectsWith(rejected, 'returned 404');
  });

  test('throws a descriptive error when the profile is missing dev.ucp.shopping', async () => {
    const client = new FetchUcpClient(
      createUcpConfig(),
      Object.assign(
        async () =>
          new Response(JSON.stringify({ ucp: { services: {} } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        { preconnect: () => {} },
      ) satisfies typeof fetch,
    );

    await expectRejectsWith(
      client.createCheckout({ lineItems: [] }),
      'UCP profile missing dev.ucp.shopping',
    );
  });

  test('strips trailing slash from the discovered endpoint', async () => {
    const { client, requests } = createRecordingUcpClient({
      ucp: {
        services: { 'dev.ucp.shopping': { endpoint: 'https://shop.example.test/ucp/v1/' } },
      },
    });

    await client.createCheckout({ lineItems: [] });

    expect(requests[0]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions');
  });

  test('handles profile where services entry is an array', async () => {
    const { client, requests } = createRecordingUcpClient({
      ucp: {
        services: {
          'dev.ucp.shopping': [{ endpoint: 'https://shop.example.test/ucp/v1' }],
        },
      },
    });

    await client.createCheckout({ lineItems: [] });

    expect(requests[0]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions');
  });
});

describe('FetchUcpClient errors', () => {
  test('includes UCP error response details in failed requests', async () => {
    const client = new FetchUcpClient(
      {
        baseUrl: 'https://shop.example.test/',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
        ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
      },
      Object.assign(
        async (url: string | URL | Request) => {
          if (requestUrl(url).endsWith('/.well-known/ucp')) {
            return new Response(JSON.stringify(minimalProfile), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }
          return new Response(
            JSON.stringify({ errors: ['$.checkout_session.buyer.email is required'] }),
            { status: 422, headers: { 'content-type': 'application/json' } },
          );
        },
        { preconnect: () => {} },
      ) satisfies typeof fetch,
    );

    await expectRejectsWith(
      client.completeCheckout({ checkoutId: 'checkout-1' }),
      'UCP request failed with status 422',
    );
    await expectRejectsWith(
      client.completeCheckout({ checkoutId: 'checkout-1' }),
      '$.checkout_session.buyer.email is required',
    );
  });
});

describe('FetchUcpClient signing', () => {
  test('signs UCP REST requests with RFC 9421 headers when a platform key is configured', async () => {
    const requests: { readonly headers: Headers; readonly body: string }[] = [];
    const fetchImplementation = Object.assign(
      async (url: string | URL | Request, init?: RequestInit) => {
        if (requestUrl(url).endsWith('/.well-known/ucp')) {
          return new Response(JSON.stringify(minimalProfile), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        requests.push({
          headers: new Headers(init?.headers),
          body: requestBody(init?.body),
        });

        return new Response(JSON.stringify({ products: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      { preconnect: () => {} },
    ) satisfies typeof fetch;
    const client = new FetchUcpClient(
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
      /^sig1=\("@method" "@target-uri" "content-digest"\);created=\d+;expires=\d+;keyid="platform-test-key";alg="ES256"$/,
    );
    expect(headers?.get('signature')).toMatch(/^sig1=:[A-Za-z0-9+/]+=*:/);
    expect(requests[0]?.body).toBe('{"query":"jacket","limit":3}');
    expect(
      verifiesAsDerEcdsaSignature(headers, 'https://shop.example.test/ucp/v1/catalog/search'),
    ).toBe(true);
  });
});

/**
 * The shop's verifier (ucp-php-sdk) uses PHP's openssl_verify, which expects
 * DER-encoded ECDSA signatures over exactly this base string — confirm we
 * actually produce something a real verifier would accept, not just a
 * plausibly-shaped header.
 */
function verifiesAsDerEcdsaSignature(headers: Headers | undefined, targetUri: string): boolean {
  const signatureInput = headers?.get('signature-input') ?? '';
  const signatureParams = signatureInput.slice('sig1='.length);
  const signatureBase = [
    '"@method": POST',
    `"@target-uri": ${targetUri}`,
    `"content-digest": ${headers?.get('content-digest')}`,
    `"@signature-params": ${signatureParams}`,
  ].join('\n');
  const signatureBase64 = headers?.get('signature')?.match(/^sig1=:(.+):$/)?.[1] ?? '';
  const publicKey = createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: testPrivateJwk.x, y: testPrivateJwk.y },
    format: 'jwk',
  });

  return verify(
    'sha256',
    Buffer.from(signatureBase),
    publicKey,
    Buffer.from(signatureBase64, 'base64'),
  );
}

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

  test('advertises AP2 mandate support extending checkout, so the shop negotiates it', () => {
    const profile = createUcpPlatformProfile({
      profileUrl: 'https://platform.example/.well-known/ucp',
      signingKeyId: 'platform-test-key',
      signingPrivateKeyJwk: JSON.stringify(testPrivateJwk),
    });

    expect(profile.ucp.capabilities['dev.ucp.shopping.ap2_mandate']).toEqual([
      {
        version: '2026-04-08',
        spec: 'https://ucp.dev/latest/specification/ap2-mandates/',
        schema: 'https://ucp.dev/schemas/shopping/ap2-mandates.json',
        extends: ['dev.ucp.shopping.checkout'],
      },
    ]);
  });
});

describe('FetchUcpClient product parsing', () => {
  test('keeps attributes, variants, and delivery estimates from catalog lookups', async () => {
    const fetchImplementation = Object.assign(
      async (url: string | URL | Request) => {
        if (requestUrl(url).endsWith('/.well-known/ucp')) {
          return new Response(JSON.stringify(minimalProfile), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            products: [
              {
                id: 'product-1',
                title: 'Blue Jacket',
                price: { amount: 119, currency: 'EUR' },
                attributes: { color: 'blue', weight_kg: 1.2, waterproof: true, ignored: null },
                variants: [{ id: 'product-1-l', title: 'Blue Jacket L' }],
                delivery_estimate: '2-3 days',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
      { preconnect: () => {} },
    ) satisfies typeof fetch;
    const client = new FetchUcpClient(createUcpConfig(), fetchImplementation);

    const product = await client.getProductDetails({ productId: 'product-1' });

    expect(product.attributes).toEqual({ color: 'blue', weight_kg: '1.2', waterproof: 'true' });
    expect(product.variants).toEqual([{ id: 'product-1-l', title: 'Blue Jacket L' }]);
    expect(product.delivery_estimate).toBe('2-3 days');
  });
});
