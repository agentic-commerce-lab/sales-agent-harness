import type { ShopwareCart, ShopwareLineItem } from './shopware-store-api-client.js';
import { parsePrice } from './shopware-store-api-price-parser.js';
import {
  readOptionalNumber,
  readOptionalRecord,
  readOptionalString,
  readRecord,
  readString,
} from './shopware-store-api-readers.js';

export function parseCart(payload: unknown): ShopwareCart {
  const record = readRecord(payload);

  return {
    token: readOptionalString(record.token),
    lineItems: parseLineItems(record.lineItems),
    price: parseCartPrice(record.price),
  };
}

function parseLineItems(payload: unknown): readonly ShopwareLineItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map(parseLineItem);
}

function parseLineItem(payload: unknown): ShopwareLineItem {
  const record = readRecord(payload);

  return {
    id: readString(record.id, 'Shopware line item id'),
    referencedId: readOptionalString(record.referencedId),
    label: readOptionalString(record.label),
    quantity: readOptionalNumber(record.quantity) ?? 0,
    price: parsePrice(record.price),
  };
}

function parseCartPrice(payload: unknown): ShopwareCart['price'] {
  const record = readOptionalRecord(payload);

  if (!record) {
    return undefined;
  }

  return {
    positionPrice: readOptionalNumber(record.positionPrice),
    totalPrice: readOptionalNumber(record.totalPrice),
    currency: readOptionalString(record.currency),
  };
}
