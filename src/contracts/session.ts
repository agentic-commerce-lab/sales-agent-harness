import type { AgentChannel } from './config.ts';

export interface CustomerContext {
  readonly customerId?: string;
  readonly customerGroup?: string;
  readonly region?: string;
}

export interface CommerceContext {
  readonly shopwareSalesChannelId: string;
  /**
   * Server-side only. Never return this value to the model, buyer agent, customer, URL, or audit payload.
   */
  readonly shopwareContextToken: string;
}

export interface AgentSession {
  readonly agentSessionId: string;
  readonly merchantId: string;
  readonly agentId: string;
  readonly channel: AgentChannel;
  readonly customerContext: CustomerContext;
  readonly commerceContext?: CommerceContext;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

export interface PublicAgentSession {
  readonly agentSessionId: string;
  readonly merchantId: string;
  readonly agentId: string;
  readonly channel: AgentChannel;
  readonly customerContext: CustomerContext;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}
