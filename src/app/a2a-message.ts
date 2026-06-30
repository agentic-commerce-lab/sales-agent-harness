import type { AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import type { A2aMessage, A2aPart } from './a2a-schemas.js';
import { sendMessageSchema } from './a2a-schemas.js';
import type { ChatInput } from './sales-agent-app.js';

export interface A2aHttpApp {
  chat(input: ChatInput): Promise<AgentRuntimeResponse>;
}

export async function handleA2aSendMessage(app: A2aHttpApp, input: unknown): Promise<unknown> {
  const parsed = sendMessageSchema.parse(input);
  const agentSessionId = extractAgentSessionId(parsed.message);
  const message = extractTextMessage(parsed.message.parts);
  const response = await app.chat({ agentSessionId, message });

  return createCompletedTask(parsed.message, agentSessionId, response);
}

function createCompletedTask(
  message: A2aMessage,
  agentSessionId: string,
  response: AgentRuntimeResponse,
): unknown {
  const taskId = message.taskId ?? message.messageId;

  return {
    task: {
      id: taskId,
      contextId: agentSessionId,
      status: {
        state: 'TASK_STATE_COMPLETED',
        message: {
          messageId: `${message.messageId}-response`,
          role: 'ROLE_AGENT',
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
    },
  };
}

function extractAgentSessionId(message: A2aMessage): string {
  const metadataSessionId = message.metadata?.agentSessionId;

  if (typeof metadataSessionId === 'string' && metadataSessionId.length > 0) {
    return metadataSessionId;
  }

  if (message.contextId) {
    return message.contextId;
  }

  throw new Error('A2A message requires metadata.agentSessionId or contextId');
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
