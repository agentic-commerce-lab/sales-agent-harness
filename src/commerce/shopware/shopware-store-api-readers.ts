export function readRecord(value: unknown): Record<string, unknown> {
  const record = readOptionalRecord(value);

  if (!record) {
    throw new Error('Expected Shopware Store API object payload');
  }

  return record;
}

export function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(value));
}

export function readString(value: unknown, label: string): string {
  const parsed = readOptionalString(value);

  if (!parsed) {
    throw new Error(`Missing ${label}`);
  }

  return parsed;
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
