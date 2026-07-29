/**
 * Small defensive helpers for reading untyped JSON coming off the wire
 * (LLM completions, seller responses, x402 payloads). Kept in their own module
 * so both seller-client and x402-payment can share them without importing each
 * other (which would form a dependency cycle).
 */

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(value));
}

/** Drop `undefined` entries, so optional fields can be built without per-key ternaries. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}
