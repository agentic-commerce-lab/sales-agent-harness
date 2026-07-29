import type { Ap2Mandate } from './ap2-mandate.js';
import { asArray, asRecord, compact, readString } from './json.js';
import { isX402Enabled, type X402Instructions } from './x402-payment.js';

/** The shop's x402 UCP payment handler id (what this demo can settle). */
const X402_HANDLER_ID = 'com.shopware.x402';

export interface CheckoutTerms {
  checkoutId: string;
  totalAmount: number;
  currency: string;
}

export interface SellerA2AResult {
  message: string;
  toolCalls: string[];
  contextId: string;
  orderId?: string;
  x402?: X402Instructions;
  /** Fallback browser checkout URL (UCP continue_url) when x402 can't be used. */
  continueUrl?: string;
  ap2MerchantAuthorization?: string;
  checkoutTerms?: CheckoutTerms;
}

export async function callSellerA2A(
  message: string,
  contextId?: string,
  ap2Mandate?: Ap2Mandate,
): Promise<SellerA2AResult> {
  const sellerUrl = process.env.SELLER_URL ?? 'http://localhost:3000';

  const res = await fetch(`${sellerUrl}/message:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/a2a+json',
      'A2A-Version': '1.0.0',
    },
    body: JSON.stringify(createSendMessageBody(message, contextId, ap2Mandate)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Seller A2A error ${res.status}: ${err}`);
  }

  return parseSellerResponse(await res.json());
}

function createSendMessageBody(
  message: string,
  contextId: string | undefined,
  ap2Mandate: Ap2Mandate | undefined,
): unknown {
  const messageId = `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const metadata: Record<string, unknown> = {};

  if (contextId) metadata.agentSessionId = contextId;
  if (ap2Mandate) metadata.ap2Mandate = ap2Mandate;
  // Declare the payment handlers this client can settle. Empty (x402 disabled)
  // → the shop finds no shared method and hands off to a browser checkout.
  metadata.supportedPaymentHandlers = isX402Enabled() ? [X402_HANDLER_ID] : [];

  return {
    message: {
      messageId,
      role: 'user',
      parts: [{ kind: 'text', text: message }],
      ...(contextId ? { contextId } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    },
  };
}

function parseSellerResponse(payload: unknown): SellerA2AResult {
  const root = asRecord(payload);
  const metadata = readArtifactMetadata(root?.artifacts);

  return {
    message: readStatusMessageText(root),
    toolCalls: filterStrings(asArray(metadata?.toolCalls)),
    contextId: readString(root?.contextId),
    ...parseOptionalFields(metadata),
  };
}

function parseOptionalFields(
  metadata: Record<string, unknown> | undefined,
): Partial<SellerA2AResult> {
  return compact({
    orderId: readString(metadata?.orderId) || undefined,
    x402: parseX402Instructions(metadata?.x402),
    continueUrl: readString(metadata?.continueUrl) || undefined,
    ap2MerchantAuthorization: readString(metadata?.ap2MerchantAuthorization) || undefined,
    checkoutTerms: parseCheckoutTerms(metadata?.checkoutTerms),
  });
}

function parseCheckoutTerms(value: unknown): CheckoutTerms | undefined {
  const record = asRecord(value);
  const checkoutId = readString(record?.checkoutId);
  const total = asRecord(record?.total);
  const currency = readString(total?.currency);
  const totalAmount = typeof total?.amount === 'number' ? total.amount : undefined;

  if (!checkoutId || !currency || totalAmount === undefined) {
    return undefined;
  }

  return { checkoutId, totalAmount, currency };
}

function readArtifactMetadata(artifacts: unknown): Record<string, unknown> | undefined {
  return asRecord(asRecord(asArray(artifacts)[0])?.metadata);
}

function parseX402Instructions(value: unknown): X402Instructions | undefined {
  const record = asRecord(value);
  const payUrl = readString(record?.payUrl);
  const deepLinkCode = readString(record?.deepLinkCode);

  if (!payUrl || !deepLinkCode) {
    return undefined;
  }

  const instructions: X402Instructions = { payUrl, deepLinkCode };

  assignOptionalString(instructions, 'accessKey', record?.accessKey);
  assignOptionalString(instructions, 'network', record?.network);
  assignOptionalString(instructions, 'assetSymbol', record?.assetSymbol);

  return instructions;
}

function assignOptionalString(
  instructions: X402Instructions,
  key: 'accessKey' | 'network' | 'assetSymbol',
  value: unknown,
): void {
  const parsed = readString(value);

  if (parsed) {
    instructions[key] = parsed;
  }
}

function readStatusMessageText(root: Record<string, unknown> | undefined): string {
  const statusMessage = asRecord(asRecord(root?.status)?.message);
  const parts = asArray(statusMessage?.parts);

  return parts.map((part) => readString(asRecord(part)?.text)).join('');
}

function filterStrings(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string');
}
