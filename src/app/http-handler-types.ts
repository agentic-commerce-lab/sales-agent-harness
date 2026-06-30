import type { CommerceApiRequest } from '../api/harness-api.js';
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
}

export interface SalesAgentHttpHandler {
  handle(request: Request): Promise<Response>;
}

export interface CreateSalesAgentHttpHandlerInput {
  readonly app: SalesAgentHttpApp;
}
