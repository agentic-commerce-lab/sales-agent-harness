import type { AgentRuntime, AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import { recordAppAudit } from './sales-agent-app-audit.js';
import type {
  AppContext,
  ChatInput,
  CreateSalesAgentHarnessAppInput,
} from './sales-agent-app-types.js';

export async function chat(
  input: CreateSalesAgentHarnessAppInput,
  context: AppContext,
  runtime: AgentRuntime,
  chatInput: ChatInput,
): Promise<AgentRuntimeResponse> {
  const session = context.sessionStore.getSession(
    chatInput.agentSessionId,
    input.config.merchantId,
  );

  if (!session) {
    throw new Error(`Agent session ${chatInput.agentSessionId} was not found`);
  }

  recordAppAudit(context.auditLogger, session, 'user_request', context.now);
  const response = await runtime.respond(chatInput);
  recordAppAudit(context.auditLogger, session, 'agent_response', context.now);

  return response;
}
