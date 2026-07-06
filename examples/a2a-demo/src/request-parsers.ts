import type { ConversationEntry, TurnInput } from './buyer-agent.js';
import { asRecord } from './seller-client.js';

function parseJsonRecord(raw: string): Record<string, unknown> | undefined {
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function parseGoal(raw: string): string | undefined {
  return readNonEmptyString(parseJsonRecord(raw)?.goal);
}

export function parseTurnInput(raw: string): TurnInput | undefined {
  const record = parseJsonRecord(raw) ?? {};
  const goal = readNonEmptyString(record.goal);

  if (!goal) {
    return undefined;
  }

  return {
    goal,
    ...contextIdField(record.contextId),
    history: parseHistory(record.history),
  };
}

function contextIdField(value: unknown): { contextId?: string } {
  const contextId = readNonEmptyString(value);
  return contextId ? { contextId } : {};
}

function parseHistory(value: unknown): ConversationEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): ConversationEntry[] => {
    const parsed = parseHistoryEntry(entry);
    return parsed ? [parsed] : [];
  });
}

function parseHistoryEntry(entry: unknown): ConversationEntry | undefined {
  const record = asRecord(entry) ?? {};
  const role = readRole(record.role);
  const message = readNonEmptyString(record.message);

  if (!role || !message) {
    return undefined;
  }

  return { role, message, ...toolCallsField(record.toolCalls) };
}

function toolCallsField(value: unknown): { toolCalls?: string[] } {
  const toolCalls = parseEntryToolCalls(value);
  return toolCalls ? { toolCalls } : {};
}

function readRole(value: unknown): ConversationEntry['role'] | undefined {
  return value === 'buyer' || value === 'seller' ? value : undefined;
}

function parseEntryToolCalls(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((call): call is string => typeof call === 'string');
}
