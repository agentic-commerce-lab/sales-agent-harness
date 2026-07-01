export const agentChannels = ['customer_ui', 'a2a', 'internal_demo'] as const;

export type AgentChannel = (typeof agentChannels)[number];

export const harnessCapabilities = [
  'searchProducts',
  'getProductDetails',
  'createCart',
  'updateCart',
  'getCartSummary',
  'prepareCheckoutHandoff',
  'completeCheckout',
] as const;

export type HarnessCapability = (typeof harnessCapabilities)[number];

export const disabledCommerceCapabilities = [
  'quotes',
  'negotiation',
  'payments',
  'orderCreation',
  'bindingQuotes',
  'customDiscounts',
  'customerAccountMutation',
] as const;

export type DisabledCommerceCapability = (typeof disabledCommerceCapabilities)[number];

export interface MoneyLimit {
  readonly amount: number;
  readonly currency: string;
}

export interface AgentPolicyConfig {
  readonly allowedChannels: readonly AgentChannel[];
  readonly blockedCategories: readonly string[];
  readonly blockedProducts: readonly string[];
  readonly maxCartValue: MoneyLimit;
  readonly maxItemQuantity: number;
  readonly allowCheckoutHandoff: boolean;
  readonly allowCheckoutCompletion: boolean;
  readonly requireHumanApprovalForCheckout: boolean;
  readonly unsupportedRegions: readonly string[];
  readonly confidentialFields: readonly string[];
}

export interface ShopwareAgentConfig {
  readonly salesChannelId: string;
  readonly storefrontBaseUrl: string;
}

export interface AgentHarnessConfig {
  readonly agentId: string;
  readonly merchantId: string;
  readonly enabledCapabilities: readonly HarnessCapability[];
  readonly disabledCapabilities: readonly DisabledCommerceCapability[];
  readonly policies: AgentPolicyConfig;
  readonly shopware: ShopwareAgentConfig;
}
