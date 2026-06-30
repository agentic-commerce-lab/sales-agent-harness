import type {
  ShopwareDeliveryTime,
  ShopwareProduct,
  ShopwareProductSearchResponse,
} from './shopware-store-api-client.js';
import { parsePrice } from './shopware-store-api-price-parser.js';
import {
  readOptionalBoolean,
  readOptionalRecord,
  readOptionalString,
  readRecord,
  readString,
} from './shopware-store-api-readers.js';

export function parseProductSearchResponse(payload: unknown): ShopwareProductSearchResponse {
  const record = readRecord(payload);
  const rawElements = Array.isArray(record.elements) ? record.elements : [];

  return {
    elements: rawElements.map(parseProduct),
  };
}

export function parseProduct(payload: unknown): ShopwareProduct {
  const record = readRecord(payload);
  const id = readString(record.id, 'Shopware product id');

  return {
    id,
    name: readOptionalString(record.name),
    productNumber: readOptionalString(record.productNumber),
    description: readOptionalString(record.description),
    available: readOptionalBoolean(record.available),
    calculatedPrice: parsePrice(record.calculatedPrice),
    categoryNames: parseStringArray(record.categoryNames),
    deliveryTime: parseDeliveryTime(record.deliveryTime),
    customFields: parseCustomFields(record.customFields),
    children: parseProductChildren(record.children),
  };
}

function parseProductChildren(payload: unknown): readonly ShopwareProduct[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map(parseProduct);
}

function parseDeliveryTime(payload: unknown): ShopwareDeliveryTime | undefined {
  const record = readOptionalRecord(payload);

  if (!record) {
    return undefined;
  }

  return {
    name: readOptionalString(record.name),
  };
}

function parseCustomFields(payload: unknown): Readonly<Record<string, unknown>> | undefined {
  return readOptionalRecord(payload);
}

function parseStringArray(payload: unknown): readonly string[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter((value) => typeof value === 'string');
}
