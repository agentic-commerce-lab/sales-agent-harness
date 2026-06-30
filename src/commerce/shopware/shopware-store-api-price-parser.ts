import type { ShopwarePrice } from './shopware-store-api-client.js';
import {
  readOptionalNumber,
  readOptionalRecord,
  readOptionalString,
} from './shopware-store-api-readers.js';

export function parsePrice(payload: unknown): ShopwarePrice | undefined {
  const record = readOptionalRecord(payload);

  if (!record) {
    return undefined;
  }

  const unitPrice = readOptionalNumber(record.unitPrice);
  const totalPrice = readOptionalNumber(record.totalPrice);

  if (unitPrice === undefined || totalPrice === undefined) {
    return undefined;
  }

  return {
    unitPrice,
    totalPrice,
    currency: readOptionalString(record.currency),
  };
}
