import type { CommerceExecutionContext } from '../../contracts/commerce.js';
import type { ShopwareEnvironmentConfig } from '../../env/shopware-config.js';

export interface ShopwareStoreApiHttpClient {
  readonly postJson: (
    path: string,
    body: unknown,
    executionContext?: CommerceExecutionContext,
  ) => Promise<unknown>;
  readonly getCheckoutBaseUrl: () => string;
}

export function createFetchShopwareStoreApiHttpClient(
  config: ShopwareEnvironmentConfig,
  fetchImplementation: typeof fetch = fetch,
): ShopwareStoreApiHttpClient {
  const baseUrl = () => config.baseUrl.replace(/\/$/, '');

  return {
    postJson: async (path, body, executionContext) => {
      const response = await fetchImplementation(`${baseUrl()}${path}`, {
        method: 'POST',
        headers: createHeaders(config, executionContext),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Shopware Store API request failed with status ${response.status}`);
      }

      return response.json();
    },
    getCheckoutBaseUrl: () => `${baseUrl()}/checkout`,
  };
}

function createHeaders(
  config: ShopwareEnvironmentConfig,
  executionContext: CommerceExecutionContext | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'sw-access-key': config.storeApiAccessKey,
  };

  if (executionContext) {
    headers['sw-context-token'] = executionContext.shopwareContextToken;
  }

  return headers;
}
