import type { AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import type { A2aMessage, A2aPart } from './a2a-schemas.js';
import { sendMessageSchema } from './a2a-schemas.js';
import type { ChatInput, CreateAgentSessionInput } from './sales-agent-app.js';

export interface A2aHttpApp {
  createSession(input: CreateAgentSessionInput): { readonly agentSessionId: string };
  chat(input: ChatInput): Promise<AgentRuntimeResponse>;
}

export async function handleA2aSendMessage(app: A2aHttpApp, input: unknown): Promise<unknown> {
  const parsed = sendMessageSchema.parse(input);
  const agentSessionId = extractAgentSessionId(parsed.message) ?? createA2aSession(app);
  const message = extractTextMessage(parsed.message.parts);
  const response = await app.chat({ agentSessionId, message });

  return createCompletedTask(parsed.message, agentSessionId, response);
}

function createA2aSession(app: A2aHttpApp): string {
  const session = app.createSession({ channel: 'a2a' });
  return session.agentSessionId;
}

function createCompletedTask(
  message: A2aMessage,
  agentSessionId: string,
  response: AgentRuntimeResponse,
): unknown {
  const taskId = message.taskId ?? message.messageId;

  return {
    id: taskId,
    contextId: agentSessionId,
    status: {
      state: 'completed',
      message: {
        messageId: `${message.messageId}-response`,
        role: 'agent',
        parts: [{ text: response.message }],
      },
    },
    artifacts: [
      {
        artifactId: `${taskId}-artifact`,
        name: 'Seller agent response',
        parts: [{ text: response.message }],
        metadata: { toolCalls: [...response.toolCalls] },
      },
    ],
  };
}

function extractAgentSessionId(message: A2aMessage): string | null {
  const metadataSessionId = message.metadata?.agentSessionId;

  if (typeof metadataSessionId === 'string' && metadataSessionId.length > 0) {
    return metadataSessionId;
  }

  return message.contextId ?? null;
}

function extractTextMessage(parts: readonly A2aPart[]): string {
  const text = parts
    .map((part) => part.text)
    .filter((partText): partText is string => Boolean(partText))
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('A2A message requires at least one text part');
  }

  return text;
}
