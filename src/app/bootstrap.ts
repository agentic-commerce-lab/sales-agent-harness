import { ShopwareAdapter } from '../commerce/shopware/shopware-adapter.js';
import { FetchShopwareStoreApiClient } from '../commerce/shopware/shopware-store-api-client.js';
import { UcpAdapter } from '../commerce/ucp/ucp-adapter.js';
import { FetchUcpClient } from '../commerce/ucp/ucp-client.js';
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
  const agentConfig = withRuntimeCommerceConfig(input.agentConfig, input.environment);
  const adapter =
    input.environment.commerceAdapterProvider === 'ucp'
      ? new UcpAdapter({
          client: new FetchUcpClient(input.environment.commerce, input.fetchImplementation),
        })
      : new ShopwareAdapter({
          client: new FetchShopwareStoreApiClient(
            input.environment.commerce,
            input.fetchImplementation,
          ),
          confidentialFields: agentConfig.policies.confidentialFields,
        });

  return createSalesAgentHarnessApp({
    config: agentConfig,
    adapter,
    checkoutHandoffMode: input.environment.commerceAdapterProvider === 'ucp' ? 'adapter' : 'local',
    runtimeFactory: ({ tools }) =>
      createLangGraphDeepAgentRuntime({
        apiKey: input.environment.runtime.apiKey,
        modelName: input.environment.runtime.modelName,
        tools,
        systemPrompt: agentConfig.systemPrompt,
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

function withRuntimeCommerceConfig(
  agentConfig: AgentHarnessConfig,
  environment: ApplicationEnvironmentConfig,
): AgentHarnessConfig {
  return {
    ...agentConfig,
    shopware: {
      ...agentConfig.shopware,
      salesChannelId: environment.commerce.defaultSalesChannelId,
      storefrontBaseUrl: environment.commerce.baseUrl,
    },
  };
}
