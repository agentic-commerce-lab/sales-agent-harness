import type {
  CartSummary,
  Money,
  ProductDetails,
  ProductSummary,
} from '../../contracts/commerce.js';
import type { ShopwareCart, ShopwareProduct } from './shopware-store-api-client.js';

const defaultCurrency = 'EUR';

export function normalizeShopwareProduct(product: ShopwareProduct): ProductSummary {
  const summary: ProductSummary = {
    id: product.id,
    label: product.name ?? 'Unnamed product',
    categories: product.categoryNames ?? [],
  };

  return { ...summary, ...createProductOptionalFields(product) };
}

function createProductOptionalFields(product: ShopwareProduct): Partial<ProductSummary> {
  const price = normalizePrice(
    product.calculatedPrice?.unitPrice,
    product.calculatedPrice?.currency,
  );

  return {
    ...(product.productNumber ? { sku: product.productNumber } : {}),
    ...(product.description ? { description: product.description } : {}),
    ...(product.available !== undefined ? { available: product.available } : {}),
    ...(price ? { price } : {}),
    ...(product.deliveryTime?.name ? { deliveryEstimate: product.deliveryTime.name } : {}),
  };
}

export function normalizeShopwareProductDetails(
  product: ShopwareProduct,
  confidentialFields: readonly string[] = [],
): ProductDetails {
  return {
    ...normalizeShopwareProduct(product),
    attributes: normalizeAttributes(product.customFields, confidentialFields),
    variants: product.children?.map(normalizeShopwareProduct) ?? [],
  };
}

export function normalizeShopwareCart(cart: ShopwareCart): CartSummary {
  const currency = cart.price?.currency ?? defaultCurrency;
  const items = cart.lineItems?.map((item) => normalizeLineItem(item, currency)) ?? [];
  const shipping = normalizeShippingCosts(cart, currency);

  return {
    cartId: 'cart',
    items,
    subtotal: normalizeRequiredPrice(cart.price?.positionPrice ?? 0, currency),
    ...(shipping ? { shipping } : {}),
    total: normalizeRequiredPrice(cart.price?.totalPrice ?? 0, currency),
    currency,
  };
}

function normalizeShippingCosts(cart: ShopwareCart, currency: string): Money | undefined {
  const shippingCosts = cart.deliveries?.flatMap((delivery) =>
    delivery.shippingCosts ? [delivery.shippingCosts] : [],
  );

  if (!shippingCosts || shippingCosts.length === 0) {
    return undefined;
  }

  const amount = shippingCosts.reduce((sum, costs) => sum + costs.totalPrice, 0);

  return normalizeRequiredPrice(amount, shippingCosts[0]?.currency ?? currency);
}

function normalizeLineItem(
  item: NonNullable<ShopwareCart['lineItems']>[number],
  cartCurrency: string,
) {
  const unitAmount = item.price?.unitPrice ?? 0;
  const totalAmount = item.price?.totalPrice ?? unitAmount * item.quantity;
  const currency = item.price?.currency ?? cartCurrency;

  return {
    productId: item.referencedId ?? item.id,
    label: item.label ?? 'Unnamed product',
    quantity: item.quantity,
    unitPrice: normalizeRequiredPrice(unitAmount, currency),
    totalPrice: normalizeRequiredPrice(totalAmount, currency),
  };
}

function normalizeAttributes(
  customFields: Readonly<Record<string, unknown>> | undefined,
  confidentialFields: readonly string[],
): Readonly<Record<string, string>> {
  if (!customFields) {
    return {};
  }

  const entries = Object.entries(customFields)
    .filter(([key]) => !confidentialFields.includes(key))
    .flatMap(([key, value]) => {
      if (typeof value !== 'string') {
        return [];
      }

      return [[key, value] as const];
    });

  return Object.fromEntries(entries);
}

function normalizePrice(
  amount: number | undefined,
  currency: string | undefined,
): Money | undefined {
  if (amount === undefined) {
    return undefined;
  }

  return normalizeRequiredPrice(amount, currency ?? defaultCurrency);
}

function normalizeRequiredPrice(amount: number, currency: string): Money {
  return { amount, currency };
}
