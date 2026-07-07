import { expect } from 'bun:test';

export async function expectRejectsWith(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error('Expected rejection to be an Error', { cause: error });
    }

    expect(error.message).toContain(message);

    return;
  }

  throw new Error(`Expected promise to reject with ${message}`);
}

export function createBuyer() {
  return {
    email: 'buyer@example.test',
    firstName: 'Ada',
    lastName: 'Buyer',
    phoneNumber: '+49123456789',
  };
}

export function createFulfillment() {
  return {
    type: 'shipping' as const,
    shippingAddress: {
      street: 'Test Street 1',
      zipcode: '12345',
      city: 'Berlin',
      countryCode: 'DE',
    },
  };
}
