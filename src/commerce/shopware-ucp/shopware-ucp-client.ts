import type { CartItemInput } from '../../contracts/commerce.js';
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
    const payload = await this.#requestJson('POST', '/ucp/v1/catalog/search', {
      query: input.query,
      limit: input.limit,
    });

    return parseProductSearchResponse(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getProductDetails(input: { readonly productId: string }): Promise<ShopwareUcpProduct> {
    const payload = await this.#requestJson('POST', '/ucp/v1/catalog/lookup', {
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
    const payload = await this.#requestJson('POST', '/ucp/v1/carts', {
      line_items: input.items.map(toUcpLineItemPayload),
    });

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async updateCart(input: {
    readonly cartId: string;
    readonly items: readonly CartItemInput[];
  }): Promise<ShopwareUcpCart> {
    const payload = await this.#requestJson('PATCH', `/ucp/v1/carts/${input.cartId}`, {
      id: input.cartId,
      line_items: input.items.map(toUcpLineItemPayload),
    });

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  async getCart(input: { readonly cartId: string }): Promise<ShopwareUcpCart> {
    const payload = await this.#requestJson('GET', `/ucp/v1/carts/${input.cartId}`);

    return parseCart(payload);
  }

  async createCheckout(input: {
    readonly cartId?: string | undefined;
    readonly lineItems: readonly CartItemInput[];
  }): Promise<ShopwareUcpCart> {
    const payload = await this.#requestJson('POST', '/ucp/v1/checkout-sessions', {
      ...(input.cartId ? { cart_id: input.cartId } : {}),
      line_items: input.lineItems.map(toUcpLineItemPayload),
    });

    return parseCart(payload);
  }

  async completeCheckout(input: { readonly checkoutId: string }): Promise<ShopwareUcpCart> {
    const payload = await this.#requestJson(
      'POST',
      `/ucp/v1/checkout-sessions/${encodeURIComponent(input.checkoutId)}/complete`,
      {},
    );

    return parseCart(payload);
  }

  // fallow-ignore-next-line unused-class-member
  getEmbeddedCheckoutUrl(checkoutId: string): string {
    return `${this.#baseUrl}/ucp/embedded/checkout/${encodeURIComponent(checkoutId)}`;
  }

  async #requestJson(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = new URL(`${this.#baseUrl}${path}`);
    const bodyString = body === undefined ? undefined : JSON.stringify(body);
    const headers = new Map<string, string>([
      ['accept', 'application/json'],
      ['idempotency-key', createIdempotencyKey()],
      ['ucp-agent', `profile="${escapeSfString(this.#agentProfileUrl)}"`],
      ...(bodyString === undefined ? [] : ([['content-type', 'application/json']] as const)),
    ]);
    const signatureHeaders = this.#signer?.sign({
      method,
      url,
      headers,
      body: bodyString,
    });
    const response = await this.#fetch(url, {
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
      throw new Error(`Shopware UCP request failed with status ${response.status}`);
    }

    return response.json();
  }
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

  const record = readRecord(payload);

  return {
    min: parseMoney(record.min),
  };
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
    if (!type || typeof record.amount !== 'number') {
      return [];
    }

    const currency = readOptionalString(record.currency);
    return [
      {
        type,
        amount: record.amount,
        ...(currency ? { currency } : {}),
      },
    ];
  });
}

function parseStringArray(payload: unknown): readonly string[] | undefined {
  if (!Array.isArray(payload)) {
    return undefined;
  }

  return payload.filter((value) => typeof value === 'string');
}
