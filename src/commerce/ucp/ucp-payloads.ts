import type { BuyerInput, CartItemInput, FulfillmentInput } from '../../contracts/commerce.js';

export function toUcpLineItemPayload(item: CartItemInput) {
  return {
    item: { id: item.productId },
    quantity: item.quantity,
  };
}

export function toUcpBuyerPayload(buyer: BuyerInput) {
  return {
    email: buyer.email,
    ...(buyer.firstName ? { first_name: buyer.firstName } : {}),
    ...(buyer.lastName ? { last_name: buyer.lastName } : {}),
    ...(buyer.phoneNumber ? { phone_number: buyer.phoneNumber } : {}),
  };
}

export function toUcpFulfillmentPayload(fulfillment: FulfillmentInput) {
  return {
    type: fulfillment.type,
    extra: {
      shipping_address: {
        street: fulfillment.shippingAddress.street,
        zipcode: fulfillment.shippingAddress.zipcode,
        city: fulfillment.shippingAddress.city,
        country_code: fulfillment.shippingAddress.countryCode,
      },
    },
  };
}
