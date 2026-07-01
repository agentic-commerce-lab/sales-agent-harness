import type {
  CartLineItem,
  CartSummary,
  Money,
  ProductDetails,
  ProductSummary,
} from '../../contracts/commerce.js';
import type { UcpCart, UcpLineItem, UcpMoney, UcpProduct } from './ucp-types.js';

const defaultCurrency = 'EUR';

export function normalizeUcpProduct(product: UcpProduct): ProductSummary {
  const price = normalizeProductPrice(product);

  return {
    id: product.id,
    label: product.title ?? product.name ?? 'Unnamed product',
    categories: product.categories ?? [],
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.available !== undefined ? { available: product.available } : {}),
    ...(price ? { price } : {}),
  };
}

export function normalizeUcpProductDetails(product: UcpProduct): ProductDetails {
  return {
    ...normalizeUcpProduct(product),
    attributes: {},
    variants: [],
  };
}

export function normalizeUcpCart(cart: UcpCart): CartSummary {
  const currency =
    cart.currency ??
    cart.money_summary?.total?.currency ??
    cart.moneySummary?.total?.currency ??
    defaultCurrency;
  const lineItems = cart.line_items ?? cart.lineItems ?? [];
  const money = normalizeCartMoney(cart, currency);

  return {
    cartId: cart.id,
    items: lineItems.map((item) => normalizeLineItem(item, currency)),
    subtotal: money.subtotal,
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
    return normalizeRequiredMoney(product.price, defaultCurrency);
  }

  if (product.price) {
    return product.price;
  }

  return product.priceRange?.min ?? product.price_range?.min;
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

function normalizeCartMoney(cart: UcpCart, currency: string) {
  const summary = cart.money_summary ?? cart.moneySummary;

  return {
    subtotal:
      summary?.subtotal ??
      totalByType(cart.totals, 'subtotal', currency) ??
      normalizeRequiredMoney(0, currency),
    total:
      summary?.total ??
      totalByType(cart.totals, 'total', currency) ??
      normalizeRequiredMoney(0, currency),
  };
}

function lineItemUnitPrice(item: UcpLineItem, cartCurrency: string): Money {
  const productPrice = normalizeProductPrice(item.item ?? { id: item.id ?? 'unknown-product' });

  return (
    item.unit_price ?? item.unitPrice ?? productPrice ?? normalizeRequiredMoney(0, cartCurrency)
  );
}

function lineItemTotalPrice(item: UcpLineItem, unitPrice: Money): Money {
  return (
    item.total_price ??
    item.totalPrice ??
    totalByType(item.totals, 'total', unitPrice.currency) ??
    totalByType(item.totals, 'subtotal', unitPrice.currency) ??
    normalizeRequiredMoney(unitPrice.amount * item.quantity, unitPrice.currency)
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

  return normalizeRequiredMoney(total.amount, total.currency ?? fallbackCurrency);
}

function normalizeRequiredMoney(amount: number, currency: string): UcpMoney {
  return { amount, currency };
}
