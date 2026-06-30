import { ShopwareAdapter } from '../commerce/shopware/shopware-adapter.js';
import { FetchShopwareStoreApiClient } from '../commerce/shopware/shopware-store-api-client.js';
import { loadAgentHarnessConfig } from '../config/load-agent-config.js';
import type { AgentHarnessConfig } from '../contracts/config.js';
import {
  type ApplicationEnvironmentConfig,
  loadApplicationEnvironmentConfig,
} from '../env/app-config.js';
import { createLangGraphDeepAgentRuntime } from '../runtime/langgraph/langgraph-runtime.js';
import { createSalesAgentHarnessApp, type SalesAgentHarnessApp } from './sales-agent-app.js';

export interface CreateRunnableSalesAgentHarnessAppInput {
  readonly agentConfig: AgentHarnessConfig;
  readonly environment: ApplicationEnvironmentConfig;
  readonly fetchImplementation?: typeof fetch;
}

export function createRunnableSalesAgentHarnessApp(
  input: CreateRunnableSalesAgentHarnessAppInput,
): SalesAgentHarnessApp {
  const agentConfig = withRuntimeShopwareConfig(input.agentConfig, input.environment);
  const adapter = new ShopwareAdapter({
    client: new FetchShopwareStoreApiClient(input.environment.shopware, input.fetchImplementation),
    confidentialFields: agentConfig.policies.confidentialFields,
  });

  return createSalesAgentHarnessApp({
    config: agentConfig,
    adapter,
    runtimeFactory: ({ tools }) =>
      createLangGraphDeepAgentRuntime({
        apiKey: input.environment.runtime.apiKey,
        modelName: input.environment.runtime.modelName,
        tools,
      }),
  });
}

export async function createConfiguredSalesAgentHarnessApp(
  env?: Parameters<typeof loadApplicationEnvironmentConfig>[0],
): Promise<{
  readonly app: SalesAgentHarnessApp;
  readonly environment: ApplicationEnvironmentConfig;
}> {
  const environment = loadApplicationEnvironmentConfig(env);
  const agentConfig = await loadAgentHarnessConfig(environment.agentConfigPath);

  return {
    app: createRunnableSalesAgentHarnessApp({ agentConfig, environment }),
    environment,
  };
}

function withRuntimeShopwareConfig(
  agentConfig: AgentHarnessConfig,
  environment: ApplicationEnvironmentConfig,
): AgentHarnessConfig {
  return {
    ...agentConfig,
    shopware: {
      ...agentConfig.shopware,
      salesChannelId: environment.shopware.defaultSalesChannelId,
      storefrontBaseUrl: environment.shopware.baseUrl,
    },
  };
}
