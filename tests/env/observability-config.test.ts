import { describe, expect, test } from 'bun:test';

import { loadObservabilityEnvironmentConfig } from '../../src/env/observability-config.js';

describe('loadObservabilityEnvironmentConfig', () => {
  test('disables Langfuse tracing when no LANGFUSE_* variables are set', () => {
    expect(loadObservabilityEnvironmentConfig({})).toEqual({ langfuse: undefined });
  });

  test('loads Langfuse tracing config when all three variables are set', () => {
    const config = loadObservabilityEnvironmentConfig({
      LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      LANGFUSE_SECRET_KEY: 'sk-lf-test',
      LANGFUSE_BASE_URL: 'https://langfuse.internal.example',
    });

    expect(config).toEqual({
      langfuse: {
        publicKey: 'pk-lf-test',
        secretKey: 'sk-lf-test',
        baseUrl: 'https://langfuse.internal.example',
      },
    });
  });

  test('rejects a partial Langfuse configuration', () => {
    expect(() =>
      loadObservabilityEnvironmentConfig({
        LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
        LANGFUSE_SECRET_KEY: 'sk-lf-test',
      }),
    ).toThrow('Missing required environment variable LANGFUSE_BASE_URL');

    expect(() =>
      loadObservabilityEnvironmentConfig({
        LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
        LANGFUSE_BASE_URL: 'https://langfuse.internal.example',
      }),
    ).toThrow('Missing required environment variable LANGFUSE_SECRET_KEY');

    expect(() =>
      loadObservabilityEnvironmentConfig({
        LANGFUSE_SECRET_KEY: 'sk-lf-test',
        LANGFUSE_BASE_URL: 'https://langfuse.internal.example',
      }),
    ).toThrow('Missing required environment variable LANGFUSE_PUBLIC_KEY');
  });
});
