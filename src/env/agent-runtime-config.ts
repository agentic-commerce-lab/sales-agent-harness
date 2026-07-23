export type AgentModelProvider = 'openai' | 'openrouter';

export interface AgentRuntimeEnvironmentConfig {
  readonly provider: AgentModelProvider;
  readonly apiKey: string;
  readonly modelName: string;
  readonly baseUrl?: string | undefined;
}

export interface AgentRuntimeEnvironmentInput {
  readonly AGENT_MODEL_PROVIDER?: string | undefined;
  readonly OPENAI_API_KEY?: string | undefined;
  readonly OPENROUTER_API_KEY?: string | undefined;
  readonly OPENROUTER_BASE_URL?: string | undefined;
  readonly AGENT_RUNTIME_MODEL?: string | undefined;
}

const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-5-mini';
const OPENAI_DEFAULT_MODEL = 'gpt-5-mini';

export function loadAgentRuntimeEnvironmentConfig(
  env: AgentRuntimeEnvironmentInput = {
    AGENT_MODEL_PROVIDER: process.env.AGENT_MODEL_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    AGENT_RUNTIME_MODEL: process.env.AGENT_RUNTIME_MODEL,
  },
): AgentRuntimeEnvironmentConfig {
  const provider = parseAgentModelProvider(env.AGENT_MODEL_PROVIDER ?? 'openai');

  if (provider === 'openrouter') {
    return {
      provider,
      apiKey: readRequiredEnv(env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY'),
      modelName: env.AGENT_RUNTIME_MODEL ?? OPENROUTER_DEFAULT_MODEL,
      baseUrl: env.OPENROUTER_BASE_URL ?? OPENROUTER_DEFAULT_BASE_URL,
    };
  }

  return {
    provider,
    apiKey: readRequiredEnv(env.OPENAI_API_KEY, 'OPENAI_API_KEY'),
    modelName: env.AGENT_RUNTIME_MODEL ?? OPENAI_DEFAULT_MODEL,
  };
}

function parseAgentModelProvider(value: string): AgentModelProvider {
  if (value === 'openai' || value === 'openrouter') {
    return value;
  }

  throw new Error(`Unsupported AGENT_MODEL_PROVIDER ${value}`);
}

function readRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}
