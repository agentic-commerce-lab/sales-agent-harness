import type { LangGraphRuntimeResponse } from './langgraph-types.js';

export function normalizeDeepAgentResponse(result: unknown): LangGraphRuntimeResponse {
  const messages = readMessages(result);
  const finalAssistantMessage = findFinalAssistantMessage(messages);

  return {
    message: finalAssistantMessage ? readMessageContent(finalAssistantMessage) : '',
    toolCalls: messages.flatMap(readToolCallNames),
  };
}

function readMessages(result: unknown): readonly Record<string, unknown>[] {
  if (!isRecord(result) || !Array.isArray(result.messages)) {
    return [];
  }

  return result.messages.filter(isRecord);
}

function findFinalAssistantMessage(
  messages: readonly Record<string, unknown>[],
): Record<string, unknown> | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message && isAssistantMessage(message)) {
      return message;
    }
  }

  return undefined;
}

function isAssistantMessage(message: Record<string, unknown>): boolean {
  return message.role === 'assistant' || message.type === 'ai' || message.getType === 'ai';
}

function readMessageContent(message: Record<string, unknown>): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return '';
  }

  return message.content.map(readContentPart).join('');
}

function readContentPart(part: unknown): string {
  if (typeof part === 'string') {
    return part;
  }

  if (isRecord(part) && typeof part.text === 'string') {
    return part.text;
  }

  return '';
}

function readToolCallNames(message: Record<string, unknown>): readonly string[] {
  const toolCalls = readToolCalls(message.tool_calls) ?? readToolCalls(message.toolCalls);

  return toolCalls?.map((toolCall) => toolCall.name) ?? [];
}

function readToolCalls(value: unknown): readonly { readonly name: string }[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(isNamedToolCall);
}

function isNamedToolCall(value: unknown): value is { readonly name: string } {
  return isRecord(value) && typeof value.name === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
