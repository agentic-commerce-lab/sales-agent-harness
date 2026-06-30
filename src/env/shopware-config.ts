export interface ShopwareEnvironmentConfig {
  readonly baseUrl: string;
  readonly storeApiAccessKey: string;
  readonly defaultSalesChannelId: string;
}

export interface ShopwareEnvironmentInput {
  readonly SHOPWARE_BASE_URL?: string | undefined;
  readonly SHOPWARE_STORE_API_ACCESS_KEY?: string | undefined;
  readonly SHOPWARE_DEFAULT_SALES_CHANNEL_ID?: string | undefined;
}

export function loadShopwareEnvironmentConfig(
  env: ShopwareEnvironmentInput = {
    SHOPWARE_BASE_URL: process.env.SHOPWARE_BASE_URL,
    SHOPWARE_STORE_API_ACCESS_KEY: process.env.SHOPWARE_STORE_API_ACCESS_KEY,
    SHOPWARE_DEFAULT_SALES_CHANNEL_ID: process.env.SHOPWARE_DEFAULT_SALES_CHANNEL_ID,
  },
): ShopwareEnvironmentConfig {
  const baseUrl = readRequiredEnv(env.SHOPWARE_BASE_URL, 'SHOPWARE_BASE_URL');
  const storeApiAccessKey = readRequiredEnv(
    env.SHOPWARE_STORE_API_ACCESS_KEY,
    'SHOPWARE_STORE_API_ACCESS_KEY',
  );
  const defaultSalesChannelId = readRequiredEnv(
    env.SHOPWARE_DEFAULT_SALES_CHANNEL_ID,
    'SHOPWARE_DEFAULT_SALES_CHANNEL_ID',
  );

  return {
    baseUrl,
    storeApiAccessKey,
    defaultSalesChannelId,
  };
}

function readRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}
