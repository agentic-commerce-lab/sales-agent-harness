import { describe, expect, test } from 'bun:test';
import { trace } from '@opentelemetry/api';

import { initLangfuseTracing } from '../../src/observability/langfuse-tracing.js';

describe('initLangfuseTracing', () => {
  test('does nothing when Langfuse is not configured', () => {
    expect(() => initLangfuseTracing(undefined)).not.toThrow();
  });

  test('registers a tracer provider and instruments LangChain without throwing', () => {
    try {
      expect(() =>
        initLangfuseTracing({
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
          baseUrl: 'https://langfuse.internal.example',
        }),
      ).not.toThrow();

      // A second call (e.g. a second app instance in the same process) must be a no-op,
      // not a re-registration attempt.
      expect(() =>
        initLangfuseTracing({
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
          baseUrl: 'https://langfuse.internal.example',
        }),
      ).not.toThrow();
    } finally {
      trace.disable();
    }
  });
});
