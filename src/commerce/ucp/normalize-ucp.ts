import type {
  CartLineItem,
  CartSummary,
  Money,
  ProductDetails,
  ProductSummary,
} from '../../contracts/commerce.js';
import type { UcpCart, UcpLineItem, UcpMoney, UcpProduct } from './ucp-types.js';

const defaultCurrency = 'EUR';

// UCP money amounts are integers in minor currency units (for example cents),
// while the harness Money contract uses decimal major units like the Shopware
// Store API adapter (10999 from UCP and 109.99 from Shopware are the same price).
const zeroDecimalCurrencies = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

function fromMinorUnits(amount: number, currency: string): Money {
  const factor = zeroDecimalCurrencies.has(currency.toUpperCase()) ? 1 : 100;
  return { amount: amount / factor, currency };
}

function fromUcpMoney(money: UcpMoney): Money {
  return fromMinorUnits(money.amount, money.currency);
}

function fromOptionalUcpMoney(money: UcpMoney | undefined): Money | undefined {
  return money ? fromUcpMoney(money) : undefined;
}

export function normalizeUcpProduct(product: UcpProduct): ProductSummary {
  const price = normalizeProductPrice(product);
  const deliveryEstimate = product.deliveryEstimate ?? product.delivery_estimate;

  return {
    id: product.id,
    label: product.title ?? product.name ?? 'Unnamed product',
    categories: product.categories ?? [],
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.available !== undefined ? { available: product.available } : {}),
    ...(price ? { price } : {}),
    ...(deliveryEstimate ? { deliveryEstimate } : {}),
  };
}

export function normalizeUcpProductDetails(product: UcpProduct): ProductDetails {
  return {
    ...normalizeUcpProduct(product),
    attributes: product.attributes ?? {},
    variants: product.variants?.map(normalizeUcpProduct) ?? [],
  };
}

export function normalizeUcpCart(cart: UcpCart): CartSummary {
  const currency = normalizeCartCurrency(cart);
  const lineItems = cart.line_items ?? cart.lineItems ?? [];
  const money = normalizeCartMoney(cart, currency);

  return {
    cartId: cart.id,
    items: lineItems.map((item) => normalizeLineItem(item, currency)),
    subtotal: money.subtotal,
    ...(money.shipping ? { shipping: money.shipping } : {}),
    ...(money.tax ? { tax: money.tax } : {}),
    total: money.total,
    currency,
  };
}

export function readUcpContinueUrl(checkout: UcpCart): string | undefined {
  const direct = checkout.continue_url ?? checkout.continueUrl;
  if (direct) {
    return direct;
  }

  const link = checkout.links?.find((candidate) => candidate.rel === 'continue');
  if (link?.href) {
    return link.href;
  }

  return undefined;
}

function normalizeProductPrice(product: UcpProduct): Money | undefined {
  if (typeof product.price === 'number') {
    return fromMinorUnits(product.price, defaultCurrency);
  }

  if (product.price) {
    return fromUcpMoney(product.price);
  }

  return fromOptionalUcpMoney(product.priceRange?.min ?? product.price_range?.min);
}

function normalizeLineItem(item: UcpLineItem, cartCurrency: string): CartLineItem {
  const product = item.item;
  const unitPrice = lineItemUnitPrice(item, cartCurrency);

  return {
    productId: product?.id ?? item.id ?? 'unknown-product',
    label: product?.title ?? product?.name ?? 'Unnamed product',
    quantity: item.quantity,
    unitPrice,
    totalPrice: lineItemTotalPrice(item, unitPrice),
  };
}

function normalizeCartCurrency(cart: UcpCart): string {
  return (
    cart.currency ??
    cart.money_summary?.total?.currency ??
    cart.moneySummary?.total?.currency ??
    defaultCurrency
  );
}

function normalizeCartMoney(cart: UcpCart, currency: string) {
  const summary = cart.money_summary ?? cart.moneySummary;

  return {
    subtotal: fromOptionalUcpMoney(summary?.subtotal) ??
      totalByType(cart.totals, 'subtotal', currency) ?? { amount: 0, currency },
    shipping: normalizeCartShipping(cart, summary, currency),
    tax: fromOptionalUcpMoney(summary?.tax) ?? totalByType(cart.totals, 'tax', currency),
    total: fromOptionalUcpMoney(summary?.total) ??
      totalByType(cart.totals, 'total', currency) ?? { amount: 0, currency },
  };
}

function normalizeCartShipping(
  cart: UcpCart,
  summary: UcpCart['money_summary'],
  currency: string,
): Money | undefined {
  return (
    fromOptionalUcpMoney(summary?.fulfillment) ??
    totalByType(cart.totals, 'fulfillment', currency) ??
    totalByType(cart.totals, 'shipping', currency)
  );
}

function lineItemUnitPrice(item: UcpLineItem, cartCurrency: string): Money {
  const productPrice = normalizeProductPrice(item.item ?? { id: item.id ?? 'unknown-product' });

  return (
    fromOptionalUcpMoney(item.unit_price ?? item.unitPrice) ??
    productPrice ?? { amount: 0, currency: cartCurrency }
  );
}

function lineItemTotalPrice(item: UcpLineItem, unitPrice: Money): Money {
  return (
    fromOptionalUcpMoney(item.total_price ?? item.totalPrice) ??
    totalByType(item.totals, 'total', unitPrice.currency) ??
    totalByType(item.totals, 'subtotal', unitPrice.currency) ?? {
      // unitPrice is already in major units here, so no conversion.
      amount: unitPrice.amount * item.quantity,
      currency: unitPrice.currency,
    }
  );
}

function totalByType(
  totals:
    | readonly {
        readonly type: string;
        readonly amount: number;
        readonly currency?: string | undefined;
      }[]
    | undefined,
  type: string,
  fallbackCurrency: string,
): Money | undefined {
  const total = totals?.find((candidate) => candidate.type === type);
  if (!total) {
    return undefined;
  }

  return fromMinorUnits(total.amount, total.currency ?? fallbackCurrency);
}
