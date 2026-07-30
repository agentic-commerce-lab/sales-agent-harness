import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';

import { asArray, asRecord, readString } from './json.js';

/**
 * Buyer-side x402 payment executor. Deterministic code, not the model: the
 * LLM decides WHAT to buy; once the seller relays x402 payment instructions
 * for a placed order, the wallet signs and settles via the HTTP 402
 * handshake (402 -> sign EIP-3009 -> retry with X-PAYMENT).
 */

export interface X402Instructions {
  payUrl: string;
  deepLinkCode: string;
  accessKey?: string;
  network?: string;
  assetSymbol?: string;
}

export interface X402PaymentOutcome {
  paid: boolean;
  orderNumber?: string;
  transactionHash?: string;
  explorerUrl?: string;
  amountAtomic?: string;
  error?: string;
}

interface PaymentRequirement {
  maxAmountRequired: string;
  network: string;
}

/**
 * Whether this buyer client supports x402 programmatic payment at all.
 * Defaults on (the demo's showcased behavior). Set X402_ENABLED=false to
 * simulate a client that cannot pay via x402, so it falls back to the shop's
 * `continue_url` (checkout handoff link) — the UCP fallback web experience.
 */
export function isX402Enabled(): boolean {
  return process.env.X402_ENABLED !== 'false';
}

export async function payWithX402(instructions: X402Instructions): Promise<X402PaymentOutcome> {
  const payerKey = process.env.PAYER_PK ?? '';

  if (!isHexPrivateKey(payerKey)) {
    return { paid: false, error: 'PAYER_PK is not set — cannot execute x402 payment' };
  }

  const url = `${instructions.payUrl}?deepLinkCode=${encodeURIComponent(instructions.deepLinkCode)}`;
  const headers: Record<string, string> = {
    'Idempotency-Key': crypto.randomUUID(),
    ...(instructions.accessKey ? { 'sw-access-key': instructions.accessKey } : {}),
  };

  const requirement = await requestPaymentRequirement(url, headers);

  if (typeof requirement === 'string') {
    return { paid: false, error: requirement };
  }

  return submitPayment(url, headers, payerKey, requirement);
}

function isHexPrivateKey(value: string): value is `0x${string}` {
  return value.startsWith('0x');
}

async function requestPaymentRequirement(
  url: string,
  headers: Record<string, string>,
): Promise<PaymentRequirement | string> {
  const response = await fetch(url, { method: 'POST', headers });
  const body: unknown = await response.json();

  if (response.status !== 402) {
    return `expected HTTP 402, got ${response.status}: ${JSON.stringify(body)}`;
  }

  const requirement = asRecord(asArray(asRecord(body)?.accepts)[0]);
  const maxAmountRequired = readString(requirement?.maxAmountRequired);

  if (!maxAmountRequired) {
    return 'payment requirements are missing maxAmountRequired';
  }

  return { maxAmountRequired, network: readString(requirement?.network) };
}

async function submitPayment(
  url: string,
  headers: Record<string, string>,
  payerKey: `0x${string}`,
  requirement: PaymentRequirement,
): Promise<X402PaymentOutcome> {
  const account = privateKeyToAccount(payerKey);
  const fetchWithPayment = wrapFetchWithPayment(
    fetch,
    account,
    BigInt(requirement.maxAmountRequired),
  );

  const response = await fetchWithPayment(url, { method: 'POST', headers });
  const body: unknown = await response.json();
  const result = asRecord(body);

  if (!response.ok) {
    const detail = readString(asRecord(asArray(result?.errors)[0])?.detail);
    return { paid: false, error: detail || `payment failed with HTTP ${response.status}` };
  }

  const transactionHash = readString(asRecord(result?.payment)?.transactionHash);

  return {
    paid: true,
    orderNumber: readString(result?.orderNumber),
    transactionHash,
    amountAtomic: requirement.maxAmountRequired,
    ...(transactionHash && requirement.network === 'base-sepolia'
      ? { explorerUrl: `https://sepolia.basescan.org/tx/${transactionHash}` }
      : {}),
  };
}

export function describePayment(outcome: X402PaymentOutcome): string {
  if (!outcome.paid) {
    return `I tried to pay via x402 but it failed: ${outcome.error ?? 'unknown error'}.`;
  }

  const parts = [
    `I have paid order ${outcome.orderNumber ?? ''} via x402 with my wallet.`,
    outcome.transactionHash ? `Settlement transaction: ${outcome.transactionHash}.` : '',
    'The order is paid — we are done.',
  ];

  return parts.filter((part) => part.length > 0).join(' ');
}
