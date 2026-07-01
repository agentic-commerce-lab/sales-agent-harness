export interface CommerceEnvironmentConfig {
  readonly baseUrl: string;
  readonly storeApiAccessKey: string;
  readonly defaultSalesChannelId: string;
  readonly ucpAgentProfileUrl?: string | undefined;
  readonly ucpSigningKeyId?: string | undefined;
  readonly ucpSigningPrivateKeyJwk?: string | undefined;
  readonly ucpAllowInsecureProfileUrl?: boolean | undefined;
}

export interface CommerceEnvironmentInput {
  readonly SHOPWARE_BASE_URL?: string | undefined;
  readonly SHOPWARE_STORE_API_ACCESS_KEY?: string | undefined;
  readonly SHOPWARE_DEFAULT_SALES_CHANNEL_ID?: string | undefined;
  readonly SHOPWARE_UCP_AGENT_PROFILE_URL?: string | undefined;
  readonly SHOPWARE_UCP_SIGNING_KEY_ID?: string | undefined;
  readonly SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK?: string | undefined;
  readonly SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL?: string | undefined;
}

export function loadCommerceEnvironmentConfig(
  env: CommerceEnvironmentInput = {
    SHOPWARE_BASE_URL: process.env.SHOPWARE_BASE_URL,
    SHOPWARE_STORE_API_ACCESS_KEY: process.env.SHOPWARE_STORE_API_ACCESS_KEY,
    SHOPWARE_DEFAULT_SALES_CHANNEL_ID: process.env.SHOPWARE_DEFAULT_SALES_CHANNEL_ID,
    SHOPWARE_UCP_AGENT_PROFILE_URL: process.env.SHOPWARE_UCP_AGENT_PROFILE_URL,
    SHOPWARE_UCP_SIGNING_KEY_ID: process.env.SHOPWARE_UCP_SIGNING_KEY_ID,
    SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK: process.env.SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK,
    SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL: process.env.SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL,
  },
): CommerceEnvironmentConfig {
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
    ucpAllowInsecureProfileUrl: env.SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL === 'true',
    ...(env.SHOPWARE_UCP_AGENT_PROFILE_URL
      ? { ucpAgentProfileUrl: env.SHOPWARE_UCP_AGENT_PROFILE_URL }
      : {}),
    ...readUcpSigningConfig(env),
  };
}

function readUcpSigningConfig(env: CommerceEnvironmentInput):
  | {
      readonly ucpSigningKeyId: string;
      readonly ucpSigningPrivateKeyJwk: string;
    }
  | Record<string, never> {
  if (!env.SHOPWARE_UCP_SIGNING_KEY_ID && !env.SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK) {
    return {};
  }

  return {
    ucpSigningKeyId: readRequiredEnv(
      env.SHOPWARE_UCP_SIGNING_KEY_ID,
      'SHOPWARE_UCP_SIGNING_KEY_ID',
    ),
    ucpSigningPrivateKeyJwk: readRequiredEnv(
      env.SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK,
      'SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK',
    ),
  };
}

function readRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}
