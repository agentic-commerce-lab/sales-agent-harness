import type { CommerceApiRequest } from '../api/harness-api.js';
import type { Ap2PaymentMandate } from '../contracts/commerce.js';
import type { AgentHarnessConfig } from '../contracts/config.js';
import type { PublicAgentSession } from '../contracts/session.js';
import type { AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import type {
  ChatInput,
  CheckoutHandoffValidationResult,
  CreateAgentSessionInput,
} from './sales-agent-app.js';

export interface SalesAgentHttpApp {
  readonly commerceA2aApi: { handle(input: CommerceApiRequest): Promise<unknown> };
  readonly commerceCustomerApi: { handle(input: CommerceApiRequest): Promise<unknown> };
  createSession(input: CreateAgentSessionInput): PublicAgentSession;
  chat(input: ChatInput): Promise<AgentRuntimeResponse>;
  validateCheckoutHandoff(input: { readonly handoffId: string }): CheckoutHandoffValidationResult;
  recordAp2Mandate(agentSessionId: string, mandate: Ap2PaymentMandate): void;
  recordPaymentCapability(
    agentSessionId: string,
    supportedPaymentHandlers: readonly string[],
  ): void;
}

export interface SalesAgentHttpHandler {
  handle(request: Request): Promise<Response>;
}

export interface CheckoutResumeConfig {
  readonly shopwareBaseUrl: string;
  readonly shopwareAccessKey: string;
}

export interface CreateSalesAgentHttpHandlerInput {
  readonly app: SalesAgentHttpApp;
  readonly agentConfig?: AgentHarnessConfig | undefined;
  readonly ucpPlatformProfile?: unknown;
  readonly checkoutResume?: CheckoutResumeConfig;
  /** Log full request bodies (may contain buyer PII). Off by default. */
  readonly debugLogRequestBodies?: boolean | undefined;
}
