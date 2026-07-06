export interface SellerA2AResult {
  message: string;
  toolCalls: string[];
  contextId: string;
}

export async function callSellerA2A(message: string, contextId?: string): Promise<SellerA2AResult> {
  const sellerUrl = process.env.SELLER_URL ?? 'http://localhost:3000';

  const res = await fetch(`${sellerUrl}/message:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/a2a+json',
      'A2A-Version': '1.0.0',
    },
    body: JSON.stringify(createSendMessageBody(message, contextId)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Seller A2A error ${res.status}: ${err}`);
  }

  return parseSellerResponse(await res.json());
}

function createSendMessageBody(message: string, contextId?: string): unknown {
  const messageId = `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    message: {
      messageId,
      role: 'user',
      parts: [{ kind: 'text', text: message }],
      ...(contextId && {
        contextId,
        metadata: { agentSessionId: contextId },
      }),
    },
  };
}

function parseSellerResponse(payload: unknown): SellerA2AResult {
  const root = asRecord(payload);

  return {
    message: readStatusMessageText(root),
    toolCalls: parseToolCalls(root?.artifacts),
    contextId: readString(root?.contextId),
  };
}

function readStatusMessageText(root: Record<string, unknown> | undefined): string {
  const statusMessage = asRecord(asRecord(root?.status)?.message);
  const parts = asArray(statusMessage?.parts);

  return parts.map((part) => readString(asRecord(part)?.text)).join('');
}

function parseToolCalls(artifacts: unknown): string[] {
  const metadata = asRecord(asRecord(asArray(artifacts)[0])?.metadata);

  return filterStrings(asArray(metadata?.toolCalls));
}

function filterStrings(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string');
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(value));
}
