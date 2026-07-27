export interface LangfuseTracingConfig {
  readonly publicKey: string;
  readonly secretKey: string;
  readonly baseUrl: string;
}

export interface ObservabilityEnvironmentConfig {
  readonly langfuse: LangfuseTracingConfig | undefined;
}

export interface ObservabilityEnvironmentInput {
  readonly LANGFUSE_PUBLIC_KEY?: string | undefined;
  readonly LANGFUSE_SECRET_KEY?: string | undefined;
  readonly LANGFUSE_BASE_URL?: string | undefined;
}

export function loadObservabilityEnvironmentConfig(
  env: ObservabilityEnvironmentInput = {
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
  },
): ObservabilityEnvironmentConfig {
  return { langfuse: readLangfuseTracingConfig(env) };
}

function readLangfuseTracingConfig(
  env: ObservabilityEnvironmentInput,
): LangfuseTracingConfig | undefined {
  if (!env.LANGFUSE_PUBLIC_KEY && !env.LANGFUSE_SECRET_KEY && !env.LANGFUSE_BASE_URL) {
    return undefined;
  }

  return {
    publicKey: readRequiredEnv(env.LANGFUSE_PUBLIC_KEY, 'LANGFUSE_PUBLIC_KEY'),
    secretKey: readRequiredEnv(env.LANGFUSE_SECRET_KEY, 'LANGFUSE_SECRET_KEY'),
    baseUrl: readRequiredEnv(env.LANGFUSE_BASE_URL, 'LANGFUSE_BASE_URL'),
  };
}

function readRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}
