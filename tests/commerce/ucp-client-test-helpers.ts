import { expect } from 'bun:test';

import { FetchUcpClient } from '../../src/commerce/ucp/ucp-client.js';
import { createBuyer, createFulfillment } from './ucp-common-test-helpers.js';

export const minimalProfile = {
  ucp: { services: { 'dev.ucp.shopping': { endpoint: 'https://shop.example.test/ucp/v1' } } },
};

export const ap2CapableProfile = {
  ucp: {
    services: { 'dev.ucp.shopping': { endpoint: 'https://shop.example.test/ucp/v1' } },
    capabilities: {
      'dev.ucp.shopping.ap2_mandate': [
        { version: '2026-04-08', spec: 'https://ucp.dev/2026-04-08/specification/ap2-mandates' },
      ],
    },
  },
};

export const testPrivateJwk = {
  kty: 'EC',
  crv: 'P-256',
  kid: 'platform-test-key',
  x: 'cNpFIgz_e5udjwWFh6km39p7oY8rYQcEIcgaMHz1fxE',
  y: 'm89agkO4_9qqDusC-HdYWGEcIvZVo-nYrn0iD-cdLkk',
  d: 'RHeDokMvtGXfeoYZ7AcIcJLG-yI_SZgb3sUA-2RxgxI',
};

export interface RecordedRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: unknown;
}

export function createRecordingUcpClient(profile: unknown = minimalProfile): {
  readonly client: FetchUcpClient;
  readonly requests: readonly RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetchImplementation = Object.assign(
    async (url: string | URL | Request, init?: RequestInit) => {
      if (requestUrl(url).endsWith('/.well-known/ucp')) {
        return new Response(JSON.stringify(profile), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
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
    client: new FetchUcpClient(createUcpConfig(), fetchImplementation),
    requests,
  };
}

export function createEmptyCheckout() {
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

export function createUcpConfig() {
  return {
    baseUrl: 'https://shop.example.test/',
    storeApiAccessKey: 'store-api-key',
    defaultSalesChannelId: 'sales-channel-1',
    ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
  };
}

export function assertCreateCheckoutRequest(requests: readonly RecordedRequest[]): void {
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

export function assertUpdateCheckoutRequest(requests: readonly RecordedRequest[]): void {
  expect(requests[2]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions/checkout-1');
  expect(requests[2]?.body).toEqual({
    id: 'checkout-1',
    line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
    buyer: {
      email: createBuyer().email,
      first_name: createBuyer().firstName,
      last_name: createBuyer().lastName,
      phone_number: createBuyer().phoneNumber,
    },
    fulfillment: {
      type: createFulfillment().type,
      extra: {
        shipping_address: {
          street: createFulfillment().shippingAddress.street,
          zipcode: createFulfillment().shippingAddress.zipcode,
          city: createFulfillment().shippingAddress.city,
          country_code: createFulfillment().shippingAddress.countryCode,
        },
      },
    },
  });
}

export function assertCompleteCheckoutRequest(requests: readonly RecordedRequest[]): void {
  expect(requests[3]?.url).toBe(
    'https://shop.example.test/ucp/v1/checkout-sessions/checkout-1/complete',
  );
  expect(requests[3]?.body).toEqual({ payment: { instruments: [] } });
}

export function assertGetCheckoutRequest(requests: readonly RecordedRequest[]): void {
  expect(requests[1]?.url).toBe('https://shop.example.test/ucp/v1/checkout-sessions/checkout-1');
}

export function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : input.toString();
}

export function requestBody(body: unknown): string {
  return typeof body === 'string' ? body : '{}';
}
