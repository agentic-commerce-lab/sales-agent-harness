import { describe, expect, test } from 'bun:test';

import { loadAgentRuntimeEnvironmentConfig } from '../../src/env/agent-runtime-config.js';

describe('loadAgentRuntimeEnvironmentConfig', () => {
  test('loads OpenAI-backed Deep Agents runtime config from typed environment input', () => {
    const config = loadAgentRuntimeEnvironmentConfig({
      OPENAI_API_KEY: 'test-key',
      AGENT_RUNTIME_MODEL: 'gpt-5-mini',
    });

    expect(config).toEqual({
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

  test('points at an OpenAI-compatible endpoint when OPENAI_BASE_URL is set', () => {
    const config = loadAgentRuntimeEnvironmentConfig({
      OPENAI_API_KEY: 'or-test-key',
      OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
      AGENT_RUNTIME_MODEL: 'anthropic/claude-3.5-sonnet',
    });

    expect(config).toEqual({
      apiKey: 'or-test-key',
      modelName: 'anthropic/claude-3.5-sonnet',
      baseURL: 'https://openrouter.ai/api/v1',
    });
  });
});
