import { describe, expect, test } from 'bun:test';

import { UcpAdapter } from '../../src/commerce/ucp/ucp-adapter.js';
import { createAdapterClient, createTotalsCart } from './ucp-adapter-test-helpers.js';
import { createBuyer, createFulfillment, expectRejectsWith } from './ucp-common-test-helpers.js';

describe('UcpAdapter', () => {
  test('normalizes product details including attributes, variants, and delivery estimate', async () => {
    const adapter = new UcpAdapter({
      client: {
        ...createAdapterClient(),
        getProductDetails: async () => ({
          id: 'product-1',
          title: 'Blue Jacket',
          price: { amount: 119, currency: 'EUR' },
          attributes: { color: 'blue' },
          variants: [{ id: 'product-1-l', title: 'Blue Jacket L' }],
          delivery_estimate: '2-3 days',
        }),
      },
    });

    const result = await adapter.getProductDetails({ productId: 'product-1' });

    expect(result.product.attributes).toEqual({ color: 'blue' });
    expect(result.product.variants).toEqual([
      { id: 'product-1-l', label: 'Blue Jacket L', categories: [] },
    ]);
    expect(result.product.deliveryEstimate).toBe('2-3 days');
  });

  test('creates checkout handoff from a UCP checkout continue URL', async () => {
    const adapter = new UcpAdapter({ client: createAdapterClient() });

    const handoff = await adapter.prepareCheckoutHandoff({
      cartId: 'cart-1',
      executionContext: {
        shopwareSalesChannelId: 'sales-channel-1',
        shopwareContextToken: 'secret-context-token',
      },
    });

    expect(handoff.continueUrl).toBe('https://shop.example.test/ucp/embedded/checkout/checkout-1');
    expect(handoff.summary.cartId).toBe('cart-1');
    expect(handoff.checkoutId).toBe('checkout-1');
    expect(JSON.stringify(handoff)).not.toContain('secret-context-token');
  });

  test('completes a UCP checkout without exposing server-side context tokens', async () => {
    const adapter = new UcpAdapter({ client: createAdapterClient() });

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
    expect(completed.x402).toBeUndefined();
    expect(JSON.stringify(completed)).not.toContain('secret-context-token');
  });
});

describe('UcpAdapter x402 passthrough', () => {
  test('passes x402 payment instructions through from completed checkouts', async () => {
    const adapter = new UcpAdapter({
      client: {
        ...createAdapterClient(),
        completeCheckout: async () => ({
          id: 'checkout-1',
          currency: 'USD',
          status: 'completed',
          order: { id: 'order-1' },
          x402: {
            handler_id: 'com.shopware.x402',
            pay_url: 'https://shop.example.test/store-api/x402/order/order-1/pay',
            deep_link_code: 'deep-link-code-1',
            scheme: 'exact',
            network: 'base-sepolia',
            asset: '0xasset',
            asset_symbol: 'USDC',
            access_key: 'SWSC-ACCESS-KEY',
          },
        }),
      },
    });

    const completed = await adapter.completeCheckout({
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    expect(completed.x402).toEqual({
      handlerId: 'com.shopware.x402',
      payUrl: 'https://shop.example.test/store-api/x402/order/order-1/pay',
      deepLinkCode: 'deep-link-code-1',
      scheme: 'exact',
      network: 'base-sepolia',
      asset: '0xasset',
      assetSymbol: 'USDC',
      accessKey: 'SWSC-ACCESS-KEY',
    });
  });

  test('omits x402 instructions when the completion response lacks the ownership proof', async () => {
    const adapter = new UcpAdapter({
      client: {
        ...createAdapterClient(),
        completeCheckout: async () => ({
          id: 'checkout-1',
          currency: 'USD',
          status: 'completed',
          order: { id: 'order-1' },
          x402: { pay_url: 'https://shop.example.test/pay' },
        }),
      },
    });

    const completed = await adapter.completeCheckout({
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    expect(completed.x402).toBeUndefined();
  });
});

describe('UcpAdapter AP2 mandate passthrough', () => {
  test('forwards the ap2Mandate to the client and surfaces the merchant authorization', async () => {
    let receivedMandate: unknown;
    const adapter = new UcpAdapter({
      client: {
        ...createAdapterClient(),
        completeCheckout: async (input) => {
          receivedMandate = input.ap2Mandate;

          return {
            id: 'checkout-1',
            currency: 'USD',
            status: 'completed',
            order: { id: 'order-1' },
            ap2: { merchant_authorization: 'merchant-authorization-jws' },
          };
        },
      },
    });

    const completed = await adapter.completeCheckout({
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
      ap2Mandate: { checkoutMandate: 'checkout-mandate-jwt' },
    });

    expect(receivedMandate).toEqual({ checkoutMandate: 'checkout-mandate-jwt' });
    expect(completed.ap2MerchantAuthorization).toBe('merchant-authorization-jws');
  });

  test('omits ap2MerchantAuthorization when the shop does not return one', async () => {
    const adapter = new UcpAdapter({ client: createAdapterClient() });

    const completed = await adapter.completeCheckout({
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    expect(completed.ap2MerchantAuthorization).toBeUndefined();
  });
});

describe('UcpAdapter error handling', () => {
  test('includes UCP checkout failure details in adapter errors', async () => {
    const adapter = new UcpAdapter({
      client: {
        ...createAdapterClient(),
        completeCheckout: async () => {
          throw new Error(
            'UCP request failed with status 422: {"errors":["country_code is invalid"]}',
          );
        },
      },
    });

    const promise = adapter.completeCheckout({
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    await expectRejectsWith(promise, 'UCP checkout completion failed');
    await expectRejectsWith(
      promise,
      'UCP request failed with status 422: {"errors":["country_code is invalid"]}',
    );
  });
});

describe('UcpAdapter total normalization', () => {
  test('normalizes UCP totals arrays and falls back to embedded checkout URLs', async () => {
    const adapter = new UcpAdapter({
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

    expect(handoff.summary.total).toEqual({ amount: 28.7, currency: 'EUR' });
    expect(handoff.summary.shipping).toEqual({ amount: 4.9, currency: 'EUR' });
    expect(handoff.summary.tax).toEqual({ amount: 3.8, currency: 'EUR' });
    expect(handoff.summary.items[0]?.unitPrice).toEqual({ amount: 20, currency: 'EUR' });
    expect(handoff.summary.items[0]?.totalPrice).toEqual({ amount: 20, currency: 'EUR' });
    expect(handoff.continueUrl).toBe('https://shop.example.test/ucp/embedded/checkout/checkout-1');
  });

  test('converts UCP integer minor-unit prices to major currency units', async () => {
    const adapter = new UcpAdapter({
      client: {
        ...createAdapterClient(),
        searchProducts: async () => ({
          products: [
            { id: 'product-1', title: 'Rain Jacket', price: { amount: 10999, currency: 'EUR' } },
          ],
        }),
      },
    });

    const search = await adapter.searchProducts({ query: 'jacket' });
    const cart = await adapter.getCartSummary({ cartId: 'cart-1' });

    expect(search.products[0]?.price).toEqual({ amount: 109.99, currency: 'EUR' });
    expect(cart.cart.items[0]?.unitPrice).toEqual({ amount: 1.19, currency: 'EUR' });
    expect(cart.cart.items[0]?.totalPrice).toEqual({ amount: 2.38, currency: 'EUR' });
    expect(cart.cart.subtotal).toEqual({ amount: 2.38, currency: 'EUR' });
    expect(cart.cart.total).toEqual({ amount: 2.38, currency: 'EUR' });
  });
});
