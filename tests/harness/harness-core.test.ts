import { describe, expect, test } from 'bun:test';
import type {
  CartResult,
  CheckoutHandoffResult,
  CommerceAdapter,
  CompletedCheckoutResult,
  ProductDetailsResult,
  ProductSearchResult,
} from '../../src/contracts/commerce.js';
import type { AgentHarnessConfig } from '../../src/contracts/config.js';
import { InMemoryHandoffStore } from '../../src/handoff/handoff-store.js';
import { InMemoryCheckoutIdempotencyStore } from '../../src/harness/checkout-idempotency-store.js';
import { HarnessCore } from '../../src/harness/harness-core.js';
import { InMemoryAuditLogger } from '../../src/observability/audit-log.js';
import { InMemorySessionStore } from '../../src/session/session-store.js';

function createConfig(): AgentHarnessConfig {
  return {
    agentId: 'agent-1',
    merchantId: 'merchant-1',
    enabledCapabilities: [
      'searchProducts',
      'createCart',
      'getCartSummary',
      'prepareCheckoutHandoff',
      'completeCheckout',
    ],
    disabledCapabilities: ['quotes', 'negotiation', 'payments', 'orderCreation'],
    policies: {
      allowedChannels: ['a2a'],
      blockedCategories: [],
      blockedProducts: [],
      maxCartValue: { amount: 1000, currency: 'EUR' },
      maxItemQuantity: 5,
      allowCheckoutHandoff: true,
      allowCheckoutCompletion: true,
      requireHumanApprovalForCheckout: false,
      unsupportedRegions: [],
      confidentialFields: ['shopwareContextToken'],
    },
    shopware: {
      salesChannelId: 'sales-channel-1',
      storefrontBaseUrl: 'https://shop.example.test',
    },
  };
}

function createHarness(adapter: CommerceAdapter = createAdapter()) {
  const sessionStore = new InMemorySessionStore();
  sessionStore.createSession({
    agentSessionId: 'session-1',
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    channel: 'a2a',
    customerContext: {},
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
  });
  sessionStore.setCommerceContext('session-1', {
    shopwareSalesChannelId: 'sales-channel-1',
    shopwareContextToken: 'secret-context-token',
  });

  const auditLogger = new InMemoryAuditLogger();
  const handoffStore = new InMemoryHandoffStore({
    now: () => new Date('2026-06-30T12:00:00.000Z'),
  });

  return {
    auditLogger,
    handoffStore,
    harness: new HarnessCore({
      config: createConfig(),
      adapter,
      auditLogger,
      handoffStore,
      sessionStore,
      now: () => new Date('2026-06-30T12:00:00.000Z'),
    }),
  };
}

function createIdempotentHarness() {
  let calls = 0;
  const adapter = {
    ...createAdapter(),
    completeCheckout: async (): Promise<CompletedCheckoutResult> => {
      calls += 1;
      return {
        summary: {
          cartId: 'cart-1',
          items: [],
          subtotal: { amount: 119, currency: 'EUR' },
          total: { amount: 119, currency: 'EUR' },
          currency: 'EUR',
        },
        orderId: `order-${calls}`,
        status: 'completed',
      };
    },
  };
  const sessionStore = new InMemorySessionStore();
  sessionStore.createSession({
    agentSessionId: 'session-1',
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    channel: 'a2a',
    customerContext: {},
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
  });
  sessionStore.setCommerceContext('session-1', {
    shopwareSalesChannelId: 'sales-channel-1',
    shopwareContextToken: 'secret-context-token',
  });

  const auditLogger = new InMemoryAuditLogger();
  const handoffStore = new InMemoryHandoffStore();

  return {
    adapterCalls: () => calls,
    harness: new HarnessCore({
      config: createConfig(),
      adapter,
      auditLogger,
      handoffStore,
      sessionStore,
      checkoutIdempotencyStore: new InMemoryCheckoutIdempotencyStore(),
      now: () => new Date('2026-06-30T12:00:00.000Z'),
    }),
  };
}

function createAdapter(): CommerceAdapter {
  const cartResult: CartResult = {
    dataSource: 'shopware_store_api',
    cart: {
      cartId: 'cart-1',
      items: [],
      subtotal: { amount: 119, currency: 'EUR' },
      total: { amount: 119, currency: 'EUR' },
      currency: 'EUR',
    },
  };

  return {
    searchProducts: async (): Promise<ProductSearchResult> => ({
      dataSource: 'shopware_store_api',
      products: [{ id: 'product-1', label: 'Blue Jacket', categories: [] }],
    }),
    getProductDetails: async (): Promise<ProductDetailsResult> => {
      throw new Error('Unexpected product details call');
    },
    createCart: async (): Promise<CartResult> => cartResult,
    updateCart: async (): Promise<CartResult> => cartResult,
    getCartSummary: async (): Promise<CartResult> => cartResult,
    prepareCheckoutHandoff: async (): Promise<CheckoutHandoffResult> => {
      throw new Error('Harness creates opaque handoffs itself');
    },
    completeCheckout: async (): Promise<CompletedCheckoutResult> => ({
      summary: cartResult.cart,
      orderId: 'order-1',
      status: 'completed',
    }),
  };
}

function createCheckoutCompletionDisabledHarness() {
  let adapterCalls = 0;
  const sessionStore = new InMemorySessionStore();
  sessionStore.createSession({
    agentSessionId: 'session-1',
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    channel: 'a2a',
    customerContext: {},
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
  });
  sessionStore.setCommerceContext('session-1', {
    shopwareSalesChannelId: 'sales-channel-1',
    shopwareContextToken: 'secret-context-token',
  });

  return {
    adapterCalls: () => adapterCalls,
    harness: new HarnessCore({
      config: {
        ...createConfig(),
        policies: { ...createConfig().policies, allowCheckoutCompletion: false },
      },
      adapter: {
        ...createAdapter(),
        completeCheckout: async () => {
          adapterCalls += 1;
          throw new Error('Adapter should not be called');
        },
      },
      auditLogger: new InMemoryAuditLogger(),
      handoffStore: new InMemoryHandoffStore({
        now: () => new Date('2026-06-30T12:00:00.000Z'),
      }),
      sessionStore,
      now: () => new Date('2026-06-30T12:00:00.000Z'),
    }),
  };
}

describe('HarnessCore', () => {
  test('returns blocked responses without calling the adapter for disabled capabilities', async () => {
    let adapterCalls = 0;
    const adapter = {
      ...createAdapter(),
      getProductDetails: async () => {
        adapterCalls += 1;
        throw new Error('Adapter should not be called');
      },
    } satisfies CommerceAdapter;
    const { harness, auditLogger } = createHarness(adapter);

    const result = await harness.getProductDetails({
      agentSessionId: 'session-1',
      productId: 'product-1',
    });

    expect(result.status).toBe('blocked');
    expect(adapterCalls).toBe(0);
    expect(auditLogger.events.some((event) => event.type === 'blocked_action')).toBe(true);
  });

  test('executes allowed adapter calls and emits tool and policy audit events', async () => {
    const { harness, auditLogger } = createHarness();

    const result = await harness.searchProducts({ agentSessionId: 'session-1', query: 'jacket' });

    expect(result.status).toBe('ok');
    expect(auditLogger.events.map((event) => event.type)).toContain('policy_decision');
    expect(auditLogger.events.map((event) => event.type)).toContain('tool_call');
  });

  test('creates opaque checkout handoffs from server-side session context', async () => {
    const { harness } = createHarness();

    const result = await harness.prepareCheckoutHandoff({
      agentSessionId: 'session-1',
      cartId: 'cart-1',
    });

    expect(result.status).toBe('ok');
    expect(JSON.stringify(result)).not.toContain('secret-context-token');
    expect(result.value?.continueUrl).toContain('/agent-checkout?h=handoff_');
  });
});

describe('HarnessCore cart value limits', () => {
  test('blocks cart results whose real total exceeds the configured max cart value', async () => {
    const { harness, auditLogger } = createHarness(createExpensiveCartAdapter());

    const result = await harness.createCart({
      agentSessionId: 'session-1',
      items: [{ productId: 'product-1', quantity: 1 }],
    });

    expect(result.status).toBe('blocked');
    expect(result.value).toBeUndefined();
    expect(result.policyDecision?.reason).toBe('cart_value_limit_exceeded');
    expect(auditLogger.events.some((event) => event.type === 'blocked_action')).toBe(true);
  });

  test('blocks checkout handoffs for carts above the configured max cart value', async () => {
    const { harness } = createHarness(createExpensiveCartAdapter());

    const result = await harness.prepareCheckoutHandoff({
      agentSessionId: 'session-1',
      cartId: 'cart-1',
    });

    expect(result.status).toBe('blocked');
    expect(result.value).toBeUndefined();
    expect(result.policyDecision?.reason).toBe('cart_value_limit_exceeded');
  });
});

function createExpensiveCartAdapter(): CommerceAdapter {
  const cartResult: CartResult = {
    dataSource: 'shopware_store_api',
    cart: {
      cartId: 'cart-1',
      items: [
        {
          productId: 'product-1',
          label: 'Gold Jacket',
          quantity: 1,
          unitPrice: { amount: 1500, currency: 'EUR' },
          totalPrice: { amount: 1500, currency: 'EUR' },
        },
      ],
      subtotal: { amount: 1500, currency: 'EUR' },
      total: { amount: 1500, currency: 'EUR' },
      currency: 'EUR',
    },
  };

  return {
    ...createAdapter(),
    createCart: async (): Promise<CartResult> => cartResult,
    getCartSummary: async (): Promise<CartResult> => cartResult,
  };
}

describe('HarnessCore checkout completion', () => {
  test('blocks checkout completion when the policy disables automated selling', async () => {
    const { adapterCalls, harness } = createCheckoutCompletionDisabledHarness();

    const result = await harness.completeCheckout({
      agentSessionId: 'session-1',
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    expect(result.status).toBe('blocked');
    expect(adapterCalls()).toBe(0);
    expect(result.policyDecision?.reason).toBe('checkout_completion_disabled');
  });

  test('completes checkouts through the adapter when automated selling is explicitly enabled', async () => {
    const { harness, auditLogger } = createHarness();

    const result = await harness.completeCheckout({
      agentSessionId: 'session-1',
      checkoutId: 'checkout-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    });

    expect(result.status).toBe('ok');
    expect(result.value?.orderId).toBe('order-1');
    expect(JSON.stringify(result)).not.toContain('secret-context-token');
    expect(auditLogger.events.map((event) => event.type)).toContain('checkout_completion');
  });

  test('returns stored checkout completion for repeated idempotency keys', async () => {
    const { adapterCalls, harness } = createIdempotentHarness();
    const input = {
      agentSessionId: 'session-1',
      checkoutId: 'checkout-1',
      idempotencyKey: 'checkout-key-1',
      buyer: createBuyer(),
      fulfillment: createFulfillment(),
    };

    const first = await harness.completeCheckout(input);
    const second = await harness.completeCheckout(input);

    expect(first.value?.orderId).toBe('order-1');
    expect(second.value?.orderId).toBe('order-1');
    expect(adapterCalls()).toBe(1);
  });
});

function createBuyer() {
  return {
    email: 'buyer@example.test',
    firstName: 'Ada',
    lastName: 'Buyer',
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

test('commerce request with an unknown agentSessionId auto-creates the session (get-or-create)', async () => {
  const sessionStore = new InMemorySessionStore({
    now: () => new Date('2026-06-30T12:00:00.000Z'),
  });
  const harness = new HarnessCore({
    config: createConfig(),
    adapter: createAdapter(),
    auditLogger: new InMemoryAuditLogger(),
    handoffStore: new InMemoryHandoffStore({ now: () => new Date('2026-06-30T12:00:00.000Z') }),
    sessionStore,
    now: () => new Date('2026-06-30T12:00:00.000Z'),
  });

  expect(sessionStore.getSession('fresh-id', 'merchant-1')).toBeUndefined();

  const result = await harness.searchProducts({ agentSessionId: 'fresh-id', query: 'jacket' });
  expect(result.status).toBe('ok');

  const created = sessionStore.getSession('fresh-id', 'merchant-1');
  expect(created).toBeDefined();
  expect(created?.commerceContext?.shopwareSalesChannelId).toBe('sales-channel-1');
});
