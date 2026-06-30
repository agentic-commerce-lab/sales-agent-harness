export const projectName = 'sales-agent-harness';

export type AgentChannel = 'customer_ui' | 'a2a' | 'internal_demo';

export type HarnessCapability =
  | 'searchProducts'
  | 'getProductDetails'
  | 'createCart'
  | 'updateCart'
  | 'getCartSummary'
  | 'prepareCheckoutHandoff';

export interface AgentHarnessConfig {
  readonly agentId: string;
  readonly merchantId: string;
  readonly allowedChannels: readonly AgentChannel[];
  readonly enabledCapabilities: readonly HarnessCapability[];
}
