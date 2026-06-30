export interface AgentRuntimeEnvironmentConfig {
  readonly apiKey: string;
  readonly modelName: string;
}

export interface AgentRuntimeEnvironmentInput {
  readonly OPENAI_API_KEY?: string | undefined;
  readonly AGENT_RUNTIME_MODEL?: string | undefined;
}

export function loadAgentRuntimeEnvironmentConfig(
  env: AgentRuntimeEnvironmentInput = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AGENT_RUNTIME_MODEL: process.env.AGENT_RUNTIME_MODEL,
  },
): AgentRuntimeEnvironmentConfig {
  return {
    apiKey: readRequiredEnv(env.OPENAI_API_KEY, 'OPENAI_API_KEY'),
    modelName: env.AGENT_RUNTIME_MODEL ?? 'gpt-5-mini',
  };
}

function readRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}
