import {
  type AgentRuntimeEnvironmentConfig,
  type AgentRuntimeEnvironmentInput,
  loadAgentRuntimeEnvironmentConfig,
} from './agent-runtime-config.js';
import {
  type CommerceEnvironmentConfig,
  type CommerceEnvironmentInput,
  loadCommerceEnvironmentConfig,
} from './commerce-config.js';
import {
  loadObservabilityEnvironmentConfig,
  type ObservabilityEnvironmentConfig,
  type ObservabilityEnvironmentInput,
} from './observability-config.js';

export type AgentRuntimeProvider = 'deep_agents';
export type CommerceAdapterProvider = 'shopware' | 'ucp';

export type StorageEnvironmentConfig =
  | {
      readonly provider: 'memory';
    }
  | {
      readonly provider: 'sqlite';
      readonly sqlitePath: string;
    };

export interface ApplicationEnvironmentConfig {
  readonly agentConfigPath: string;
  readonly host: string;
  readonly port: number;
  readonly debugLogRequestBodies: boolean;
  readonly runtimeProvider: AgentRuntimeProvider;
  readonly commerceAdapterProvider: CommerceAdapterProvider;
  readonly storage: StorageEnvironmentConfig;
  readonly runtime: AgentRuntimeEnvironmentConfig;
  readonly commerce: CommerceEnvironmentConfig;
  readonly observability: ObservabilityEnvironmentConfig;
}

export interface ApplicationEnvironmentInput
  extends AgentRuntimeEnvironmentInput,
    CommerceEnvironmentInput,
    ObservabilityEnvironmentInput {
  readonly AGENT_CONFIG_PATH?: string | undefined;
  readonly HOST?: string | undefined;
  readonly PORT?: string | undefined;
  readonly DEBUG_LOG_REQUEST_BODIES?: string | undefined;
  readonly AGENT_RUNTIME_PROVIDER?: string | undefined;
  readonly COMMERCE_ADAPTER_PROVIDER?: string | undefined;
  readonly STORAGE_PROVIDER?: string | undefined;
  readonly SQLITE_DB_PATH?: string | undefined;
}

export function loadApplicationEnvironmentConfig(
  env: ApplicationEnvironmentInput = {
    AGENT_CONFIG_PATH: process.env.AGENT_CONFIG_PATH,
    HOST: process.env.HOST,
    PORT: process.env.PORT,
    DEBUG_LOG_REQUEST_BODIES: process.env.DEBUG_LOG_REQUEST_BODIES,
    AGENT_RUNTIME_PROVIDER: process.env.AGENT_RUNTIME_PROVIDER,
    COMMERCE_ADAPTER_PROVIDER: process.env.COMMERCE_ADAPTER_PROVIDER,
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    SQLITE_DB_PATH: process.env.SQLITE_DB_PATH,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AGENT_RUNTIME_MODEL: process.env.AGENT_RUNTIME_MODEL,
    SHOPWARE_BASE_URL: process.env.SHOPWARE_BASE_URL,
    SHOPWARE_STORE_API_ACCESS_KEY: process.env.SHOPWARE_STORE_API_ACCESS_KEY,
    SHOPWARE_DEFAULT_SALES_CHANNEL_ID: process.env.SHOPWARE_DEFAULT_SALES_CHANNEL_ID,
    SHOPWARE_UCP_AGENT_PROFILE_URL: process.env.SHOPWARE_UCP_AGENT_PROFILE_URL,
    SHOPWARE_UCP_SIGNING_KEY_ID: process.env.SHOPWARE_UCP_SIGNING_KEY_ID,
    SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK: process.env.SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK,
    SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL: process.env.SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
  },
): ApplicationEnvironmentConfig {
  return {
    agentConfigPath: env.AGENT_CONFIG_PATH ?? 'config/agents/demo-sales-agent.json',
    host: env.HOST ?? '127.0.0.1',
    port: parsePort(env.PORT),
    debugLogRequestBodies: env.DEBUG_LOG_REQUEST_BODIES === 'true',
    runtimeProvider: parseRuntimeProvider(env.AGENT_RUNTIME_PROVIDER ?? 'deep_agents'),
    commerceAdapterProvider: parseCommerceAdapterProvider(
      env.COMMERCE_ADAPTER_PROVIDER ?? 'shopware',
    ),
    storage: parseStorageConfig(env),
    runtime: loadAgentRuntimeEnvironmentConfig(env),
    commerce: loadCommerceEnvironmentConfig(env),
    observability: loadObservabilityEnvironmentConfig(env),
  };
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT ${value}`);
  }

  return port;
}

function parseRuntimeProvider(value: string): AgentRuntimeProvider {
  if (value === 'deep_agents') {
    return value;
  }

  throw new Error(`Unsupported AGENT_RUNTIME_PROVIDER ${value}`);
}

function parseCommerceAdapterProvider(value: string): CommerceAdapterProvider {
  if (value === 'shopware' || value === 'ucp') {
    return value;
  }

  if (value === 'ucp_shopware' || value === 'shopware-ucp') {
    return 'ucp';
  }

  throw new Error(`Unsupported COMMERCE_ADAPTER_PROVIDER ${value}`);
}

function parseStorageConfig(env: ApplicationEnvironmentInput): StorageEnvironmentConfig {
  const provider = env.STORAGE_PROVIDER ?? 'memory';

  if (provider === 'memory') {
    return { provider };
  }

  if (provider === 'sqlite') {
    return {
      provider,
      sqlitePath: env.SQLITE_DB_PATH ?? 'data/sales-agent-harness.sqlite',
    };
  }

  throw new Error(`Unsupported STORAGE_PROVIDER ${provider}`);
}
