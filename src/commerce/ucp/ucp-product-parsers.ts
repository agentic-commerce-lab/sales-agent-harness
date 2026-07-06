import {
  readOptionalString,
  readRecord,
  readString,
} from '../shopware/shopware-store-api-readers.js';
import type { UcpMoney, UcpProduct, UcpProductSearchResponse } from './ucp-types.js';

export function parseProductSearchResponse(payload: unknown): UcpProductSearchResponse {
  const record = readRecord(payload);
  const products = record.products ?? record.items ?? record.results;

  if (!Array.isArray(products)) {
    throw new Error('Expected UCP catalog response products array');
  }

  return {
    products: products.map(parseProduct),
  };
}

export function parseProduct(payload: unknown): UcpProduct {
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
    attributes: parseAttributes(record.attributes),
    variants: parseVariants(record.variants),
    deliveryEstimate: readOptionalString(record.deliveryEstimate),
    delivery_estimate: readOptionalString(record.delivery_estimate),
  };
}

export function parseMoney(payload: unknown): UcpMoney | undefined {
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

function parseAttributes(payload: unknown): Readonly<Record<string, string>> | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const entries = Object.entries(readRecord(payload)).flatMap(([key, value]) => {
    if (typeof value === 'string') {
      return [[key, value] as const];
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return [[key, String(value)] as const];
    }

    return [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseVariants(payload: unknown): readonly UcpProduct[] | undefined {
  if (!Array.isArray(payload)) {
    return undefined;
  }

  return payload.map(parseProduct);
}

function parseMoneyOrNumber(payload: unknown): UcpMoney | number | undefined {
  return typeof payload === 'number' ? payload : parseMoney(payload);
}

function parsePriceRange(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  return { min: parseMoney(readRecord(payload).min) };
}

function parseStringArray(payload: unknown): readonly string[] | undefined {
  return Array.isArray(payload) ? payload.filter((value) => typeof value === 'string') : undefined;
}
