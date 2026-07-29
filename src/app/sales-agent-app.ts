import { createA2aApi } from '../api/a2a-api.js';
import { createCustomerApi } from '../api/customer-api.js';
import { createExecutableToolRegistry } from '../harness/executable-tool-registry.js';
import { createAppContext, createHarness } from './sales-agent-app-actions.js';
import type {
  CreateSalesAgentHarnessAppInput,
  SalesAgentHarnessApp,
} from './sales-agent-app-types.js';
import { chat } from './sales-agent-chat-actions.js';
import { validateCheckoutHandoff } from './sales-agent-handoff-actions.js';
import { createSession } from './sales-agent-session-actions.js';

export type {
  ChatInput,
  CheckoutHandoffValidationResult,
  CreateAgentSessionInput,
  CreateSalesAgentHarnessAppInput,
  SalesAgentHarnessApp,
} from './sales-agent-app-types.js';

export function createSalesAgentHarnessApp(
  input: CreateSalesAgentHarnessAppInput,
): SalesAgentHarnessApp {
  const context = createAppContext(input);
  const harness = createHarness(input, context);
  const runtime = input.runtimeFactory({
    tools: createExecutableToolRegistry(input.config, harness),
  });

  return {
    auditLogger: context.auditLogger,
    commerceA2aApi: createA2aApi(harness),
    commerceCustomerApi: createCustomerApi(harness),
    handoffStore: context.handoffStore,
    harness,
    sessionStore: context.sessionStore,
    createSession: (sessionInput) => createSession(input, context, sessionInput),
    chat: (chatInput) => chat(input, context, runtime, harness, chatInput),
    validateCheckoutHandoff: (handoffInput) =>
      validateCheckoutHandoff(input, context, handoffInput),
    recordAp2Mandate: (agentSessionId, mandate) =>
      harness.recordAp2Mandate(agentSessionId, mandate),
    recordPaymentCapability: (agentSessionId, supportedPaymentHandlers) =>
      harness.recordPaymentCapability(agentSessionId, supportedPaymentHandlers),
  };
}
