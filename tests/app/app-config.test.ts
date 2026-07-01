import { describe, expect, test } from 'bun:test';

import { loadApplicationEnvironmentConfig } from '../../src/env/app-config.js';

describe('loadApplicationEnvironmentConfig', () => {
  test('loads runtime, commerce adapter, and server configuration with defaults', () => {
    expect(
      loadApplicationEnvironmentConfig({
        OPENAI_API_KEY: 'test-key',
        SHOPWARE_BASE_URL: 'https://shop.example.test',
        SHOPWARE_STORE_API_ACCESS_KEY: 'store-api-key',
        SHOPWARE_DEFAULT_SALES_CHANNEL_ID: 'sales-channel-1',
      }),
    ).toEqual({
      agentConfigPath: 'config/agents/demo-sales-agent.json',
      host: '127.0.0.1',
      port: 3000,
      runtimeProvider: 'deep_agents',
      commerceAdapterProvider: 'shopware',
      runtime: {
        apiKey: 'test-key',
        modelName: 'gpt-5-mini',
      },
      shopware: {
        baseUrl: 'https://shop.example.test',
        storeApiAccessKey: 'store-api-key',
        defaultSalesChannelId: 'sales-channel-1',
        ucpAllowInsecureProfileUrl: false,
      },
    });
  });

  test('accepts the Agentic Commerce UCP Shopware adapter provider', () => {
    const config = loadApplicationEnvironmentConfig({
      OPENAI_API_KEY: 'test-key',
      SHOPWARE_BASE_URL: 'https://shop.example.test',
      SHOPWARE_STORE_API_ACCESS_KEY: 'store-api-key',
      SHOPWARE_DEFAULT_SALES_CHANNEL_ID: 'sales-channel-1',
      COMMERCE_ADAPTER_PROVIDER: 'ucp_shopware',
      SHOPWARE_UCP_AGENT_PROFILE_URL: 'https://platform.example/.well-known/ucp',
      SHOPWARE_UCP_SIGNING_KEY_ID: 'platform-key',
      SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK: '{"kty":"EC"}',
      SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL: 'true',
    });

    expect(config.commerceAdapterProvider).toBe('ucp_shopware');
    expect(config.shopware).toMatchObject({
      ucpAgentProfileUrl: 'https://platform.example/.well-known/ucp',
      ucpSigningKeyId: 'platform-key',
      ucpSigningPrivateKeyJwk: '{"kty":"EC"}',
      ucpAllowInsecureProfileUrl: true,
    });
  });

  test('accepts the dashed Shopware UCP adapter provider alias', () => {
    const config = loadApplicationEnvironmentConfig({
      OPENAI_API_KEY: 'test-key',
      SHOPWARE_BASE_URL: 'https://shop.example.test',
      SHOPWARE_STORE_API_ACCESS_KEY: 'store-api-key',
      SHOPWARE_DEFAULT_SALES_CHANNEL_ID: 'sales-channel-1',
      COMMERCE_ADAPTER_PROVIDER: 'shopware-ucp',
    });

    expect(config.commerceAdapterProvider).toBe('ucp_shopware');
  });
});

describe('loadApplicationEnvironmentConfig validation', () => {
  test('requires both UCP signing key id and private key when either is configured', () => {
    expect(() =>
      loadApplicationEnvironmentConfig({
        OPENAI_API_KEY: 'test-key',
        SHOPWARE_BASE_URL: 'https://shop.example.test',
        SHOPWARE_STORE_API_ACCESS_KEY: 'store-api-key',
        SHOPWARE_DEFAULT_SALES_CHANNEL_ID: 'sales-channel-1',
        SHOPWARE_UCP_SIGNING_KEY_ID: 'platform-key',
      }),
    ).toThrow('Missing required environment variable SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK');
  });

  test('rejects unsupported runtime or commerce providers', () => {
    expect(() =>
      loadApplicationEnvironmentConfig({
        OPENAI_API_KEY: 'test-key',
        SHOPWARE_BASE_URL: 'https://shop.example.test',
        SHOPWARE_STORE_API_ACCESS_KEY: 'store-api-key',
        SHOPWARE_DEFAULT_SALES_CHANNEL_ID: 'sales-channel-1',
        AGENT_RUNTIME_PROVIDER: 'other',
      }),
    ).toThrow('Unsupported AGENT_RUNTIME_PROVIDER other');

    expect(() =>
      loadApplicationEnvironmentConfig({
        OPENAI_API_KEY: 'test-key',
        SHOPWARE_BASE_URL: 'https://shop.example.test',
        SHOPWARE_STORE_API_ACCESS_KEY: 'store-api-key',
        SHOPWARE_DEFAULT_SALES_CHANNEL_ID: 'sales-channel-1',
        COMMERCE_ADAPTER_PROVIDER: 'other',
      }),
    ).toThrow('Unsupported COMMERCE_ADAPTER_PROVIDER other');
  });
});
