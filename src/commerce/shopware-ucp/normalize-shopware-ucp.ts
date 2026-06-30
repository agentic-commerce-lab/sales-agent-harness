import type {
  CartLineItem,
  CartSummary,
  Money,
  ProductDetails,
  ProductSummary,
} from '../../contracts/commerce.js';
import type {
  ShopwareUcpCart,
  ShopwareUcpLineItem,
  ShopwareUcpMoney,
  ShopwareUcpProduct,
} from './shopware-ucp-types.js';

const defaultCurrency = 'EUR';

export function normalizeUcpProduct(product: ShopwareUcpProduct): ProductSummary {
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

export function normalizeUcpProductDetails(product: ShopwareUcpProduct): ProductDetails {
  return {
    ...normalizeUcpProduct(product),
    attributes: {},
    variants: [],
  };
}

export function normalizeUcpCart(cart: ShopwareUcpCart): CartSummary {
  const currency = cart.currency ?? cart.moneySummary?.total?.currency ?? defaultCurrency;
  const lineItems = cart.lineItems ?? cart.line_items ?? [];
  const money = normalizeCartMoney(cart, currency);

  return {
    cartId: cart.id,
    items: lineItems.map((item) => normalizeLineItem(item, currency)),
    subtotal: money.subtotal,
    total: money.total,
    currency,
  };
}

export function readUcpContinueUrl(checkout: ShopwareUcpCart): string {
  const direct = checkout.continueUrl ?? checkout.continue_url;
  if (direct) {
    return direct;
  }

  const link = checkout.links?.find((candidate) => candidate.rel === 'continue');
  if (link?.href) {
    return link.href;
  }

  throw new Error('UCP checkout response did not include a continue URL');
}

function normalizeProductPrice(product: ShopwareUcpProduct): Money | undefined {
  if (typeof product.price === 'number') {
    return normalizeRequiredMoney(product.price, defaultCurrency);
  }

  if (product.price) {
    return product.price;
  }

  return product.priceRange?.min ?? product.price_range?.min;
}

function normalizeLineItem(item: ShopwareUcpLineItem, cartCurrency: string): CartLineItem {
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

function normalizeCartMoney(cart: ShopwareUcpCart, currency: string) {
  const summary = cart.moneySummary ?? cart.money_summary;

  return {
    subtotal: summary?.subtotal ?? normalizeRequiredMoney(0, currency),
    total: summary?.total ?? normalizeRequiredMoney(0, currency),
  };
}

function lineItemUnitPrice(item: ShopwareUcpLineItem, cartCurrency: string): Money {
  return item.unitPrice ?? item.unit_price ?? normalizeRequiredMoney(0, cartCurrency);
}

function lineItemTotalPrice(item: ShopwareUcpLineItem, unitPrice: Money): Money {
  return (
    item.totalPrice ??
    item.total_price ??
    normalizeRequiredMoney(unitPrice.amount * item.quantity, unitPrice.currency)
  );
}

function normalizeRequiredMoney(amount: number, currency: string): ShopwareUcpMoney {
  return { amount, currency };
}
