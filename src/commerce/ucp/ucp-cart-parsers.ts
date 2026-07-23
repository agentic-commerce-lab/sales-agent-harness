import {
  readOptionalRecord,
  readOptionalString,
  readRecord,
  readString,
} from '../shopware/shopware-store-api-readers.js';
import { parseMoney, parseProduct } from './ucp-product-parsers.js';
import type {
  UcpAp2Response,
  UcpCart,
  UcpProduct,
  UcpTotal,
  UcpX402Instructions,
} from './ucp-types.js';

export function parseCart(payload: unknown): UcpCart {
  const record = readRecord(payload);

  return {
    id: readString(record.id, 'UCP cart id'),
    status: readOptionalString(record.status),
    currency: typeof record.currency === 'string' ? record.currency : 'USD',
    lineItems: parseLineItems(record.lineItems),
    line_items: parseLineItems(record.line_items),
    moneySummary: parseMoneySummary(record.moneySummary),
    money_summary: parseMoneySummary(record.money_summary),
    continueUrl: readOptionalString(record.continueUrl),
    continue_url: readOptionalString(record.continue_url),
    links: parseLinks(record.links),
    totals: parseTotals(record.totals),
    order: parseOrder(record.order),
    x402: parseX402Instructions(record.x402),
    ap2: parseAp2Response(record.ap2),
  };
}

function parseX402Instructions(payload: unknown): UcpX402Instructions | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const record = readRecord(payload);

  return {
    handler_id: readOptionalString(record.handler_id),
    pay_url: readOptionalString(record.pay_url),
    deep_link_code: readOptionalString(record.deep_link_code),
    scheme: readOptionalString(record.scheme),
    network: readOptionalString(record.network),
    asset: readOptionalString(record.asset),
    asset_symbol: readOptionalString(record.asset_symbol),
    access_key: readOptionalString(record.access_key),
  };
}

function parseAp2Response(payload: unknown): UcpAp2Response | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  return { merchant_authorization: readOptionalString(readRecord(payload).merchant_authorization) };
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

function parseOptionalProduct(payload: unknown): UcpProduct | undefined {
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
    fulfillment: parseMoney(record.fulfillment),
    total: parseMoney(record.total),
  };
}

function parseRecordArray(payload: unknown): readonly Record<string, unknown>[] | undefined {
  if (!Array.isArray(payload)) {
    return undefined;
  }

  return payload.flatMap((item) => {
    const record = readOptionalRecord(item);
    return record ? [record] : [];
  });
}

function parseLinks(payload: unknown) {
  return parseRecordArray(payload)?.map((record) => {
    const link: { rel?: string; href?: string } = {};
    const rel = readOptionalString(record.rel);
    const href = readOptionalString(record.href);

    if (rel) {
      link.rel = rel;
    }

    if (href) {
      link.href = href;
    }

    return link;
  });
}

function parseTotals(payload: unknown) {
  return parseRecordArray(payload)?.flatMap((record) => {
    const total = parseTotal(record);
    return total ? [total] : [];
  });
}

function parseTotal(record: Record<string, unknown>): UcpTotal | undefined {
  const type = readOptionalString(record.type);
  if (!type) {
    return undefined;
  }

  // UCP spec form: amount is an object { amount, currency }
  const amountRecord = readOptionalRecord(record.amount);
  if (typeof amountRecord?.amount === 'number') {
    return {
      type,
      amount: amountRecord.amount,
      currency: readOptionalString(amountRecord.currency),
    };
  }

  // Flat form: amount is a plain number
  if (typeof record.amount === 'number') {
    return { type, amount: record.amount, currency: readOptionalString(record.currency) };
  }

  return undefined;
}
