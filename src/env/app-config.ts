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

export type AgentRuntimeProvider = 'deep_agents';
export type CommerceAdapterProvider = 'shopware' | 'ucp';

export interface ApplicationEnvironmentConfig {
  readonly agentConfigPath: string;
  readonly host: string;
  readonly port: number;
  readonly runtimeProvider: AgentRuntimeProvider;
  readonly commerceAdapterProvider: CommerceAdapterProvider;
  readonly runtime: AgentRuntimeEnvironmentConfig;
  readonly commerce: CommerceEnvironmentConfig;
}

export interface ApplicationEnvironmentInput
  extends AgentRuntimeEnvironmentInput,
    CommerceEnvironmentInput {
  readonly AGENT_CONFIG_PATH?: string | undefined;
  readonly HOST?: string | undefined;
  readonly PORT?: string | undefined;
  readonly AGENT_RUNTIME_PROVIDER?: string | undefined;
  readonly COMMERCE_ADAPTER_PROVIDER?: string | undefined;
}

export function loadApplicationEnvironmentConfig(
  env: ApplicationEnvironmentInput = {
    AGENT_CONFIG_PATH: process.env.AGENT_CONFIG_PATH,
    HOST: process.env.HOST,
    PORT: process.env.PORT,
    AGENT_RUNTIME_PROVIDER: process.env.AGENT_RUNTIME_PROVIDER,
    COMMERCE_ADAPTER_PROVIDER: process.env.COMMERCE_ADAPTER_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AGENT_RUNTIME_MODEL: process.env.AGENT_RUNTIME_MODEL,
    SHOPWARE_BASE_URL: process.env.SHOPWARE_BASE_URL,
    SHOPWARE_STORE_API_ACCESS_KEY: process.env.SHOPWARE_STORE_API_ACCESS_KEY,
    SHOPWARE_DEFAULT_SALES_CHANNEL_ID: process.env.SHOPWARE_DEFAULT_SALES_CHANNEL_ID,
    SHOPWARE_UCP_AGENT_PROFILE_URL: process.env.SHOPWARE_UCP_AGENT_PROFILE_URL,
    SHOPWARE_UCP_SIGNING_KEY_ID: process.env.SHOPWARE_UCP_SIGNING_KEY_ID,
    SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK: process.env.SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK,
    SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL: process.env.SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL,
  },
): ApplicationEnvironmentConfig {
  return {
    agentConfigPath: env.AGENT_CONFIG_PATH ?? 'config/agents/demo-sales-agent.json',
    host: env.HOST ?? '127.0.0.1',
    port: parsePort(env.PORT),
    runtimeProvider: parseRuntimeProvider(env.AGENT_RUNTIME_PROVIDER ?? 'deep_agents'),
    commerceAdapterProvider: parseCommerceAdapterProvider(
      env.COMMERCE_ADAPTER_PROVIDER ?? 'shopware',
    ),
    runtime: loadAgentRuntimeEnvironmentConfig(env),
    commerce: loadCommerceEnvironmentConfig(env),
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
