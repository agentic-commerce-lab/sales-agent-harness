import type { BuyerInput, CartItemInput, FulfillmentInput } from '../../contracts/commerce.js';
import type { ShopwareEnvironmentConfig } from '../../env/shopware-config.js';
import {
  readOptionalString,
  readRecord,
  readString,
} from '../shopware/shopware-store-api-readers.js';
import type {
  ShopwareUcpCart,
  ShopwareUcpClient,
  ShopwareUcpMoney,
  ShopwareUcpProduct,
  ShopwareUcpProductSearchResponse,
} from './shopware-ucp-types.js';
import { escapeSfString, UcpHttpSigner } from './ucp-http-signature.js';

export type * from './shopware-ucp-types.js';

export class FetchShopwareUcpClient implements ShopwareUcpClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #agentProfileUrl: string;
  readonly #signer: UcpHttpSigner | undefined;
  #endpointPromise: Promise<string> | undefined;

  constructor(config: ShopwareEnvironmentConfig, fetchImplementation: typeof fetch = fetch) {
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
    this.#fetch = fetchImplementation;
    this.#agentProfileUrl = config.ucpAgentProfileUrl ?? `${this.#baseUrl}/.well-known/ucp`;
    this.#signer =
      config.ucpSigningKeyId && config.ucpSigningPrivateKeyJwk
        ? new UcpHttpSigner({
            keyId: config.ucpSigningKeyId,
            privateKeyJwk: config.ucpSigningPrivateKeyJwk,
          })
        : undefined;
  }

  async searchProducts(input: {
    readonly query: string;
    readonly limit?: number;
  }): Promise<ShopwareUcpProductSearchResponse> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson('POST', `${ep}/catalog/search`, {
      query: input.query,
      limit: input.limit,
    });

    return parseProductSearchResponse(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getProductDetails(input: { readonly productId: string }): Promise<ShopwareUcpProduct> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson('POST', `${ep}/catalog/lookup`, {
      ids: [input.productId],
    });
    const products = parseProductSearchResponse(payload).products;
    const product = products.find((candidate) => candidate.id === input.productId) ?? products[0];

    if (!product) {
      throw new Error(`UCP product lookup returned no product for ${input.productId}`);
    }

    return product;
  }

  // fallow-ignore-next-line unused-class-member
  async createCart(input: { readonly items: readonly CartItemInput[] }): Promise<ShopwareUcpCart> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson('POST', `${ep}/carts`, {
      line_items: input.items.map(toUcpLineItemPayload),
    });

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
  }): Promise<ShopwareUcpCart> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson('PATCH', `${ep}/carts/${input.cartId}`, {
      id: input.cartId,
      line_items: input.items.map(toUcpLineItemPayload),
    });

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getCart(input: { readonly cartId: string }): Promise<ShopwareUcpCart> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson('GET', `${ep}/carts/${input.cartId}`);

    return parseCart(payload);
  }

  async createCheckout(input: {
    readonly cartId?: string | undefined;
    readonly lineItems: readonly CartItemInput[];
  }): Promise<ShopwareUcpCart> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson('POST', `${ep}/checkout-sessions`, {
      ...(input.cartId ? { cart_id: input.cartId } : {}),
      line_items: input.lineItems.map(toUcpLineItemPayload),
    });

    return parseCart(payload);
  }

  async getCheckout(input: { readonly checkoutId: string }): Promise<ShopwareUcpCart> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson(
      'GET',
      `${ep}/checkout-sessions/${encodeURIComponent(input.checkoutId)}`,
    );

    return parseCart(payload);
  }

  async updateCheckout(input: {
    readonly checkoutId: string;
    readonly lineItems: readonly CartItemInput[];
    readonly buyer: BuyerInput;
    readonly fulfillment: FulfillmentInput;
  }): Promise<ShopwareUcpCart> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson(
      'PATCH',
      `${ep}/checkout-sessions/${encodeURIComponent(input.checkoutId)}`,
      {
        id: input.checkoutId,
        line_items: input.lineItems.map(toUcpLineItemPayload),
        buyer: toUcpBuyerPayload(input.buyer),
        fulfillment: toUcpFulfillmentPayload(input.fulfillment),
      },
    );

    return parseCart(payload);
  }

  async completeCheckout(input: { readonly checkoutId: string }): Promise<ShopwareUcpCart> {
    const ep = await this.#discoverEndpoint();
    const payload = await this.#requestJson(
      'POST',
      `${ep}/checkout-sessions/${encodeURIComponent(input.checkoutId)}/complete`,
      { payment: { instruments: [] } },
    );

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  getEmbeddedCheckoutUrl(checkoutId: string): string {
    // Shopware-specific fallback URL; used only when the vendor response lacks continue_url
    return `${this.#baseUrl}/ucp/embedded/checkout/${encodeURIComponent(checkoutId)}`;
  }

  async #discoverEndpoint(): Promise<string> {
    this.#endpointPromise ??= this.#fetchEndpoint();
    return this.#endpointPromise;
  }

  async #fetchEndpoint(): Promise<string> {
    const discoveryUrl = new URL('/.well-known/ucp', this.#baseUrl);
    let response: Response;
    try {
      response = await this.#fetch(discoveryUrl);
    } catch (cause) {
      throw new Error(
        `UCP endpoint discovery failed: network error fetching ${discoveryUrl.toString()}`,
        { cause },
      );
    }
    if (!response.ok) {
      throw new Error(
        `UCP endpoint discovery failed: ${discoveryUrl.toString()} returned ${response.status}`,
      );
    }
    const profile = await response.json();
    return parseShoppingServiceEndpoint(profile);
  }

  async #requestJson(method: string, url: string, body?: unknown): Promise<unknown> {
    const parsedUrl = new URL(url);
    const bodyString = body === undefined ? undefined : JSON.stringify(body);
    const headers = new Map<string, string>([
      ['accept', 'application/json'],
      ['idempotency-key', createIdempotencyKey()],
      ['ucp-agent', `profile="${escapeSfString(this.#agentProfileUrl)}"`],
      ...(bodyString === undefined ? [] : ([['content-type', 'application/json']] as const)),
    ]);
    const signatureHeaders = this.#signer?.sign({
      method,
      url: parsedUrl,
      headers,
      body: bodyString,
    });
    const response = await this.#fetch(parsedUrl, {
      method,
      headers: Object.fromEntries([
        ...headers.entries(),
        ...(signatureHeaders?.contentDigest
          ? [['content-digest', signatureHeaders.contentDigest] as const]
          : []),
        ...(signatureHeaders
          ? [
              ['signature-input', signatureHeaders.signatureInput] as const,
              ['signature', signatureHeaders.signature] as const,
            ]
          : []),
      ]),
      ...(bodyString !== undefined ? { body: bodyString } : {}),
    });

    if (!response.ok) {
      throw new Error(
        `Shopware UCP request failed with status ${response.status}: ${await readErrorBody(response)}`,
      );
    }

    return response.json();
  }
}

function parseShoppingServiceEndpoint(profile: unknown): string {
  const root = readRecord(profile);
  const ucp = readRecord(root.ucp);
  const services = readRecord(ucp.services);
  const shopping = services['dev.ucp.shopping'];

  if (!shopping) {
    throw new Error('UCP profile missing dev.ucp.shopping service');
  }

  // Handle both object form (spec) and array form (our own emitted profile uses arrays)
  const service: unknown = Array.isArray(shopping) ? (shopping as readonly unknown[])[0] : shopping;
  const serviceRecord = readRecord(service);
  const endpoint = serviceRecord.endpoint;

  if (typeof endpoint !== 'string' || !endpoint) {
    throw new Error('UCP profile missing dev.ucp.shopping REST endpoint');
  }

  return endpoint.replace(/\/$/, '');
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return 'empty response body';
  }

  return text.slice(0, 1000);
}

function createIdempotencyKey(): string {
  return `sales-agent-harness-${globalThis.crypto.randomUUID()}`;
}

function toUcpLineItemPayload(item: CartItemInput) {
  return {
    item: { id: item.productId },
    quantity: item.quantity,
  };
}

function toUcpBuyerPayload(buyer: BuyerInput) {
  return {
    email: buyer.email,
    ...(buyer.firstName ? { first_name: buyer.firstName } : {}),
    ...(buyer.lastName ? { last_name: buyer.lastName } : {}),
    ...(buyer.phoneNumber ? { phone_number: buyer.phoneNumber } : {}),
  };
}

function toUcpFulfillmentPayload(fulfillment: FulfillmentInput) {
  return {
    type: fulfillment.type,
    extra: {
      shipping_address: {
        street: fulfillment.shippingAddress.street,
        zipcode: fulfillment.shippingAddress.zipcode,
        city: fulfillment.shippingAddress.city,
        country_code: fulfillment.shippingAddress.countryCode,
      },
    },
  };
}

function parseProductSearchResponse(payload: unknown): ShopwareUcpProductSearchResponse {
  const record = readRecord(payload);
  const products = record.products ?? record.items ?? record.results;

  if (!Array.isArray(products)) {
    throw new Error('Expected UCP catalog response products array');
  }

  return {
    products: products.map(parseProduct),
  };
}

function parseProduct(payload: unknown): ShopwareUcpProduct {
  const record = readRecord(payload);
  const id = readString(record.id, 'UCP product id');

  return {
    id,
    title: readOptionalString(record.title),
    name: readOptionalString(record.name),
    sku: readOptionalString(record.sku),
    description: readOptionalString(record.description),
    available: typeof record.available === 'boolean' ? record.available : undefined,
    categories: parseStringArray(record.categories),
    price: parseMoneyOrNumber(record.price),
    priceRange: parsePriceRange(record.priceRange),
    price_range: parsePriceRange(record.price_range),
  };
}

function parseCart(payload: unknown): ShopwareUcpCart {
  const record = readRecord(payload);

  return {
    id: readString(record.id, 'UCP cart id'),
    status: readOptionalString(record.status),
    currency: typeof record.currency === 'string' ? record.currency : 'EUR',
    lineItems: parseLineItems(record.lineItems),
    line_items: parseLineItems(record.line_items),
    moneySummary: parseMoneySummary(record.moneySummary),
    money_summary: parseMoneySummary(record.money_summary),
    continueUrl: readOptionalString(record.continueUrl),
    continue_url: readOptionalString(record.continue_url),
    links: parseLinks(record.links),
    totals: parseTotals(record.totals),
    order: parseOrder(record.order),
  };
}

function parseOrder(payload: unknown): { readonly id?: string | undefined } | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  return { id: readOptionalString(readRecord(payload).id) };
}

function parseLineItems(payload: unknown) {
  if (!Array.isArray(payload)) {
    return undefined;
  }

  return payload.map((item) => {
    const record = readRecord(item);

    return {
      id: readOptionalString(record.id),
      item: parseOptionalProduct(record.item),
      quantity: typeof record.quantity === 'number' ? record.quantity : 0,
      unitPrice: parseMoney(record.unitPrice),
      unit_price: parseMoney(record.unit_price),
      totalPrice: parseMoney(record.totalPrice),
      total_price: parseMoney(record.total_price),
      totals: parseTotals(record.totals),
    };
  });
}

function parseOptionalProduct(payload: unknown): ShopwareUcpProduct | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  return parseProduct(payload);
}

function parseMoneySummary(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const record = readRecord(payload);

  return {
    subtotal: parseMoney(record.subtotal),
    total: parseMoney(record.total),
  };
}

function parseMoneyOrNumber(payload: unknown): ShopwareUcpMoney | number | undefined {
  return typeof payload === 'number' ? payload : parseMoney(payload);
}

function parseMoney(payload: unknown): ShopwareUcpMoney | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const record = readRecord(payload);
  if (typeof record.amount !== 'number') {
    return undefined;
  }

  return {
    amount: record.amount,
    currency: readOptionalString(record.currency) ?? 'EUR',
  };
}

function parsePriceRange(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  return { min: parseMoney(readRecord(payload).min) };
}

function parseLinks(payload: unknown) {
  if (!Array.isArray(payload)) {
    return undefined;
  }

  return payload.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const record = readRecord(item);
    const rel = readOptionalString(record.rel);
    const href = readOptionalString(record.href);

    return [
      {
        ...(rel ? { rel } : {}),
        ...(href ? { href } : {}),
      },
    ];
  });
}

function parseTotals(payload: unknown) {
  if (!Array.isArray(payload)) {
    return undefined;
  }

  return payload.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const record = readRecord(item);
    const type = readOptionalString(record.type);
    if (!type) {
      return [];
    }

    // UCP spec form: amount is an object { amount, currency }
    if (record.amount && typeof record.amount === 'object' && !Array.isArray(record.amount)) {
      const inner = readRecord(record.amount);
      if (typeof inner.amount === 'number') {
        return [{ type, amount: inner.amount, currency: readOptionalString(inner.currency) }];
      }
    }

    // Shopware flat form: amount is a plain number
    if (typeof record.amount === 'number') {
      return [{ type, amount: record.amount, currency: readOptionalString(record.currency) }];
    }

    return [];
  });
}

function parseStringArray(payload: unknown): readonly string[] | undefined {
  return Array.isArray(payload) ? payload.filter((value) => typeof value === 'string') : undefined;
}
