import { recordAppAudit } from './sales-agent-app-audit.js';
import type {
  AppContext,
  CreateAgentSessionInput,
  CreateSalesAgentHarnessAppInput,
} from './sales-agent-app-types.js';

const DEFAULT_SESSION_TTL_MS = 1800000;

export function createSession(
  input: CreateSalesAgentHarnessAppInput,
  context: AppContext,
  sessionInput: CreateAgentSessionInput,
) {
  validateSessionInput(input, sessionInput);
  const createdAt = context.now();
  const session = context.sessionStore.createSession({
    agentSessionId: context.createId(),
    merchantId: input.config.merchantId,
    agentId: input.config.agentId,
    channel: sessionInput.channel,
    customerContext: sessionInput.customerContext ?? {},
    commerceContext: {
      shopwareSalesChannelId: input.config.shopware.salesChannelId,
      shopwareContextToken: sessionInput.shopwareContextToken,
    },
    createdAt,
    expiresAt: new Date(createdAt.getTime() + (sessionInput.ttlMs ?? DEFAULT_SESSION_TTL_MS)),
  });

  recordAppAudit(context.auditLogger, session, 'session_created', context.now);

  return requirePublicSession(input, context, session.agentSessionId);
}

function validateSessionInput(
  input: CreateSalesAgentHarnessAppInput,
  sessionInput: CreateAgentSessionInput,
): void {
  if (!input.config.policies.allowedChannels.includes(sessionInput.channel)) {
    throw new Error(`Channel ${sessionInput.channel} is not enabled for this agent`);
  }

  if (!sessionInput.shopwareContextToken) {
    throw new Error('Missing required Shopware context token for agent session');
  }
}

function requirePublicSession(
  input: CreateSalesAgentHarnessAppInput,
  context: AppContext,
  agentSessionId: string,
) {
  const publicSession = context.sessionStore.getPublicSession(
    agentSessionId,
    input.config.merchantId,
  );

  if (!publicSession) {
    throw new Error(`Agent session ${agentSessionId} was not found after creation`);
  }

  return publicSession;
}
