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
import { initLangfuseTracing } from '../observability/langfuse-tracing.js';
import {
  createLangGraphDeepAgentRuntime,
  createSqliteLangGraphCheckpointSaver,
} from '../runtime/langgraph/langgraph-runtime.js';
import type { CreateLangGraphDeepAgentRuntimeInput } from '../runtime/langgraph/langgraph-types.js';
import {
  SqliteAgentRunStore,
  SqliteAuditLogger,
  SqliteCheckoutIdempotencyStore,
  SqliteHandoffStore,
  SqliteSessionStore,
} from '../storage/sqlite-stores.js';
import { createSalesAgentHarnessApp, type SalesAgentHarnessApp } from './sales-agent-app.js';

export interface CreateRunnableSalesAgentHarnessAppInput {
  readonly agentConfig: AgentHarnessConfig;
  readonly environment: ApplicationEnvironmentConfig;
  readonly fetchImplementation?: typeof fetch;
  readonly createDeepAgent?: CreateLangGraphDeepAgentRuntimeInput['createDeepAgent'] | undefined;
  readonly createModel?: CreateLangGraphDeepAgentRuntimeInput['createModel'] | undefined;
}

export function createRunnableSalesAgentHarnessApp(
  input: CreateRunnableSalesAgentHarnessAppInput,
): SalesAgentHarnessApp {
  initLangfuseTracing(input.environment.observability.langfuse);
  const agentConfig = withRuntimeCommerceConfig(input.agentConfig, input.environment);
  const runStore =
    input.environment.storage.provider === 'sqlite'
      ? new SqliteAgentRunStore({ databasePath: input.environment.storage.sqlitePath })
      : undefined;
  const checkpointSaver =
    input.environment.storage.provider === 'sqlite'
      ? createSqliteLangGraphCheckpointSaver(input.environment.storage.sqlitePath)
      : undefined;
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
    ...createStorageOverrides(input.environment),
    runtimeFactory: ({ tools }) =>
      createLangGraphDeepAgentRuntime({
        apiKey: input.environment.runtime.apiKey,
        modelName: input.environment.runtime.modelName,
        tools,
        systemPrompt: agentConfig.systemPrompt,
        ...(checkpointSaver ? { checkpointSaver } : {}),
        ...(input.createDeepAgent ? { createDeepAgent: input.createDeepAgent } : {}),
        ...(input.createModel ? { createModel: input.createModel } : {}),
        ...(runStore ? { runStore } : {}),
      }),
  });
}

function createStorageOverrides(environment: ApplicationEnvironmentConfig) {
  if (environment.storage.provider === 'memory') {
    return {};
  }

  return {
    auditLogger: new SqliteAuditLogger({ databasePath: environment.storage.sqlitePath }),
    checkoutIdempotencyStore: new SqliteCheckoutIdempotencyStore({
      databasePath: environment.storage.sqlitePath,
    }),
    handoffStore: new SqliteHandoffStore({ databasePath: environment.storage.sqlitePath }),
    sessionStore: new SqliteSessionStore({ databasePath: environment.storage.sqlitePath }),
  };
}

export async function createConfiguredSalesAgentHarnessApp(
  env?: Parameters<typeof loadApplicationEnvironmentConfig>[0],
): Promise<{
  readonly app: SalesAgentHarnessApp;
  readonly agentConfig: AgentHarnessConfig;
  readonly environment: ApplicationEnvironmentConfig;
}> {
  const environment = loadApplicationEnvironmentConfig(env);
  const agentConfig = await loadAgentHarnessConfig(environment.agentConfigPath);

  return {
    app: createRunnableSalesAgentHarnessApp({ agentConfig, environment }),
    agentConfig,
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
