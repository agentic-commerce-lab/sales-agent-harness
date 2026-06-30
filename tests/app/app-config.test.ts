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
      },
    });
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
