import { describe, expect, test } from 'bun:test';

import { loadApplicationEnvironmentConfig } from '../../src/env/app-config.js';

const baseEnvironment = {
  OPENAI_API_KEY: 'test-key',
  SHOPWARE_BASE_URL: 'https://shop.example.test',
  SHOPWARE_STORE_API_ACCESS_KEY: 'store-api-key',
  SHOPWARE_DEFAULT_SALES_CHANNEL_ID: 'sales-channel-1',
};

describe('loadApplicationEnvironmentConfig', () => {
  test('loads runtime, commerce adapter, and server configuration with defaults', () => {
    expect(loadApplicationEnvironmentConfig(baseEnvironment)).toEqual({
      agentConfigPath: 'config/agents/demo-sales-agent.json',
      host: '127.0.0.1',
      port: 3000,
      debugLogRequestBodies: false,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'shopware',
      storage: {
        provider: 'memory',
      },
      runtime: {
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      commerce: {
        baseUrl: 'https://shop.example.test',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
        ucpAllowInsecureProfileUrl: false,
      },
      observability: {
        langfuse: undefined,
      },
    });
  });

  test('accepts SQLite storage configuration', () => {
    const config = loadApplicationEnvironmentConfig({
      ...baseEnvironment,
      STORAGE_PROVIDER: 'sqlite',
      SQLITE_DB_PATH: '/tmp/sales-agent-harness.sqlite',
    });

    expect(config.storage).toEqual({
      provider: 'sqlite',
      sqlitePath: '/tmp/sales-agent-harness.sqlite',
    });
  });

  test('accepts the Agentic Commerce UCP Shopware adapter provider', () => {
    const config = loadApplicationEnvironmentConfig({
      ...baseEnvironment,
      COMMERCE_ADAPTER_PROVIDER: 'ucp_shopware',
      SHOPWARE_UCP_AGENT_PROFILE_URL: 'https://platform.example/.well-known/ucp',
      SHOPWARE_UCP_SIGNING_KEY_ID: 'platform-key',
      SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK: '{"kty":"EC"}',
      SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL: 'true',
    });

    expect(config.commerceAdapterProvider).toBe('ucp');
    expect(config.commerce).toMatchObject({
      ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
      ucpSigningKeyId: 'platform-key',
      ucpSigningPrivateKeyJwk: '{"kty":"EC"}',
      ucpAllowInsecureProfileUrl: true,
    });
  });

  test('accepts the dashed Shopware UCP adapter provider alias', () => {
    const config = loadApplicationEnvironmentConfig({
      ...baseEnvironment,
      COMMERCE_ADAPTER_PROVIDER: 'shopware-ucp',
    });

    expect(config.commerceAdapterProvider).toBe('ucp');
  });

  test('enables request body logging only when DEBUG_LOG_REQUEST_BODIES is true', () => {
    expect(
      loadApplicationEnvironmentConfig({
        ...baseEnvironment,
        DEBUG_LOG_REQUEST_BODIES: 'true',
      }).debugLogRequestBodies,
    ).toBe(true);
  });
});

describe('loadApplicationEnvironmentConfig observability', () => {
  test('loads Langfuse tracing config when all three LANGFUSE_* variables are set', () => {
    const config = loadApplicationEnvironmentConfig({
      ...baseEnvironment,
      LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      LANGFUSE_SECRET_KEY: 'sk-lf-test',
      LANGFUSE_BASE_URL: 'https://langfuse.internal.example',
    });

    expect(config.observability).toEqual({
      langfuse: {
        publicKey: 'pk-lf-test',
        secretKey: 'sk-lf-test',
        baseUrl: 'https://langfuse.internal.example',
      },
    });
  });
});

describe('loadApplicationEnvironmentConfig validation', () => {
  test('requires both UCP signing key id and private key when either is configured', () => {
    expect(() =>
      loadApplicationEnvironmentConfig({
        ...baseEnvironment,
        SHOPWARE_UCP_SIGNING_KEY_ID: 'platform-key',
      }),
    ).toThrow('Missing required environment variable SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK');
  });

  test('rejects unsupported runtime or commerce providers', () => {
    expect(() =>
      loadApplicationEnvironmentConfig({
        ...baseEnvironment,
        AGENT_RUNTIME_PROVIDER: 'other',
      }),
    ).toThrow('Unsupported AGENT_RUNTIME_PROVIDER other');

    expect(() =>
      loadApplicationEnvironmentConfig({
        ...baseEnvironment,
        COMMERCE_ADAPTER_PROVIDER: 'other',
      }),
    ).toThrow('Unsupported COMMERCE_ADAPTER_PROVIDER other');

    expect(() =>
      loadApplicationEnvironmentConfig({
        ...baseEnvironment,
        STORAGE_PROVIDER: 'other',
      }),
    ).toThrow('Unsupported STORAGE_PROVIDER other');
  });
});
