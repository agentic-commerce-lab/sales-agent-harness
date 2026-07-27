import { describe, expect, test } from 'bun:test';

import { loadAgentRuntimeEnvironmentConfig } from '../../src/env/agent-runtime-config.js';

describe('loadAgentRuntimeEnvironmentConfig', () => {
  test('loads OpenAI-backed Deep Agents runtime config from typed environment input', () => {
    const config = loadAgentRuntimeEnvironmentConfig({
      OPENAI_API_KEY: 'test-key',
      AGENT_RUNTIME_MODEL: 'gpt-5-mini',
    });

    expect(config).toEqual({
      provider: 'openai',
      apiKey: 'test-key',
      modelName: 'gpt-5-mini',
    });
  });

  test('defaults the model and rejects missing API keys', () => {
    expect(loadAgentRuntimeEnvironmentConfig({ OPENAI_API_KEY: 'test-key' }).modelName).toBe(
      'gpt-5-mini',
    );
    expect(() => loadAgentRuntimeEnvironmentConfig({})).toThrow(
      'Missing required environment variable OPENAI_API_KEY',
    );
  });

  test('loads OpenRouter-backed runtime config with its own defaults', () => {
    const config = loadAgentRuntimeEnvironmentConfig({
      AGENT_MODEL_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'or-test-key',
    });

    expect(config).toEqual({
      provider: 'openrouter',
      apiKey: 'or-test-key',
      modelName: 'openai/gpt-5-mini',
      baseURL: 'https://openrouter.ai/api/v1',
    });
  });

  test('allows overriding the OpenRouter model and base URL', () => {
    const config = loadAgentRuntimeEnvironmentConfig({
      AGENT_MODEL_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'or-test-key',
      OPENROUTER_BASE_URL: 'https://proxy.example/api/v1',
      AGENT_RUNTIME_MODEL: 'anthropic/claude-3.5-sonnet',
    });

    expect(config.modelName).toBe('anthropic/claude-3.5-sonnet');
    expect(config.baseURL).toBe('https://proxy.example/api/v1');
  });

  test('rejects missing OpenRouter API key and unsupported providers', () => {
    expect(() => loadAgentRuntimeEnvironmentConfig({ AGENT_MODEL_PROVIDER: 'openrouter' })).toThrow(
      'Missing required environment variable OPENROUTER_API_KEY',
    );

    expect(() => loadAgentRuntimeEnvironmentConfig({ AGENT_MODEL_PROVIDER: 'other' })).toThrow(
      'Unsupported AGENT_MODEL_PROVIDER other',
    );
  });
});
