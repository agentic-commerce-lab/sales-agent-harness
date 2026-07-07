import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileHandoffStore } from '../../src/handoff/file-handoff-store.js';
import { FileAuditLogger } from '../../src/observability/file-audit-log.js';
import { FileSessionStore } from '../../src/session/file-session-store.js';

describe('file-backed session store', () => {
  test('persists commerce context while keeping public sessions token-free', () => {
    const path = tempPath('sessions.json');
    const store = new FileSessionStore({ path, now: fixedNow });

    store.createSession({
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      agentId: 'agent-1',
      channel: 'a2a',
      customerContext: { region: 'DE' },
      createdAt: fixedNow(),
    });
    store.setCommerceContext('session-1', {
      shopwareSalesChannelId: 'sales-channel-1',
      shopwareContextToken: 'secret-context-token',
    });

    const reopened = new FileSessionStore({ path, now: fixedNow });
    const privateSession = reopened.getSession('session-1', 'merchant-1');
    const publicSession = reopened.getPublicSession('session-1', 'merchant-1');

    expect(privateSession?.commerceContext?.shopwareContextToken).toBe('secret-context-token');
    expect(JSON.stringify(publicSession)).not.toContain('secret-context-token');
  });
});

describe('file-backed handoff store', () => {
  test('persists records and marks resolved handoffs as used', () => {
    const path = tempPath('handoffs.json');
    const store = new FileHandoffStore({ path, now: fixedNow });

    store.save({
      handoffId: 'handoff-1',
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      shopwareSalesChannelId: 'sales-channel-1',
      shopwareContextToken: 'secret-context-token',
      cartSummary: {
        cartId: 'cart-1',
        items: [],
        subtotal: { amount: 0, currency: 'EUR' },
        total: { amount: 0, currency: 'EUR' },
        currency: 'EUR',
      },
      expiresAt: new Date('2026-06-30T12:05:00.000Z'),
      status: 'ready_for_checkout',
    });

    const reopened = new FileHandoffStore({ path, now: fixedNow });
    const resolved = reopened.resolve('handoff-1', 'merchant-1', 'sales-channel-1');
    const usedAgain = new FileHandoffStore({ path, now: fixedNow }).resolve(
      'handoff-1',
      'merchant-1',
      'sales-channel-1',
    );

    expect(resolved?.shopwareContextToken).toBe('secret-context-token');
    expect(usedAgain).toBeUndefined();
  });
});

describe('file-backed audit logger', () => {
  test('persists audit events across logger instances', () => {
    const path = tempPath('audit.jsonl');
    const logger = new FileAuditLogger({ path });

    logger.record({
      type: 'policy_decision',
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      agentId: 'agent-1',
      channel: 'a2a',
      capability: 'completeCheckout',
      policyDecision: 'allow',
      dataSources: ['policy_config'],
      occurredAt: fixedNow(),
    });

    const reopened = new FileAuditLogger({ path });

    expect(reopened.events).toEqual([
      {
        type: 'policy_decision',
        agentSessionId: 'session-1',
        merchantId: 'merchant-1',
        agentId: 'agent-1',
        channel: 'a2a',
        capability: 'completeCheckout',
        policyDecision: 'allow',
        dataSources: ['policy_config'],
        occurredAt: fixedNow(),
      },
    ]);
  });
});

function tempPath(fileName: string): string {
  return join(mkdtempSync(join(tmpdir(), 'sales-agent-harness-')), fileName);
}

function fixedNow(): Date {
  return new Date('2026-06-30T12:00:00.000Z');
}
