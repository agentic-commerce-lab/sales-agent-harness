import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  SqliteAgentRunStore,
  SqliteAuditLogger,
  SqliteCheckoutIdempotencyStore,
  SqliteHandoffStore,
  SqliteSessionStore,
} from '../../src/storage/sqlite-stores.js';

describe('SQLite-backed session store', () => {
  test('persists commerce context while keeping public sessions token-free', () => {
    const databasePath = tempDatabasePath();
    const store = new SqliteSessionStore({ databasePath, now: fixedNow });

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

    const reopened = new SqliteSessionStore({ databasePath, now: fixedNow });
    const privateSession = reopened.getSession('session-1', 'merchant-1');
    const publicSession = reopened.getPublicSession('session-1', 'merchant-1');

    expect(privateSession?.commerceContext?.shopwareContextToken).toBe('secret-context-token');
    expect(JSON.stringify(publicSession)).not.toContain('secret-context-token');
  });
});

describe('SQLite-backed handoff store', () => {
  test('persists records and marks resolved handoffs as used', () => {
    const databasePath = tempDatabasePath();
    const store = new SqliteHandoffStore({ databasePath, now: fixedNow });

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

    const reopened = new SqliteHandoffStore({ databasePath, now: fixedNow });
    const resolved = reopened.resolve('handoff-1', 'merchant-1', 'sales-channel-1');
    const usedAgain = new SqliteHandoffStore({ databasePath, now: fixedNow }).resolve(
      'handoff-1',
      'merchant-1',
      'sales-channel-1',
    );

    expect(resolved?.shopwareContextToken).toBe('secret-context-token');
    expect(usedAgain).toBeUndefined();
  });
});

describe('SQLite-backed audit logger', () => {
  test('persists audit events across logger instances', () => {
    const databasePath = tempDatabasePath();
    const logger = new SqliteAuditLogger({ databasePath });

    logger.record({
      type: 'checkout_completion',
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      agentId: 'agent-1',
      channel: 'a2a',
      capability: 'completeCheckout',
      policyDecision: 'allow',
      dataSources: ['ucp', 'policy_config'],
      cartId: 'cart-1',
      occurredAt: fixedNow(),
    });

    const reopened = new SqliteAuditLogger({ databasePath });

    expect(reopened.events).toEqual([
      {
        type: 'checkout_completion',
        agentSessionId: 'session-1',
        merchantId: 'merchant-1',
        agentId: 'agent-1',
        channel: 'a2a',
        capability: 'completeCheckout',
        policyDecision: 'allow',
        dataSources: ['ucp', 'policy_config'],
        cartId: 'cart-1',
        occurredAt: fixedNow(),
      },
    ]);
  });
});

describe('SQLite-backed agent run store', () => {
  test('persists run records across store instances', () => {
    const databasePath = tempDatabasePath();
    const store = new SqliteAgentRunStore({ databasePath });

    store.save({
      runId: 'run-1',
      agentSessionId: 'session-1',
      status: 'completed',
      input: {
        agentSessionId: 'session-1',
        message: 'Find jackets',
      },
      response: {
        message: 'Done',
        toolCalls: ['searchProducts'],
      },
      createdAt: fixedNow(),
      updatedAt: fixedNow(),
    });

    const reopened = new SqliteAgentRunStore({ databasePath });

    expect(reopened.get('run-1')).toEqual({
      runId: 'run-1',
      agentSessionId: 'session-1',
      status: 'completed',
      input: {
        agentSessionId: 'session-1',
        message: 'Find jackets',
      },
      response: {
        message: 'Done',
        toolCalls: ['searchProducts'],
      },
      createdAt: fixedNow(),
      updatedAt: fixedNow(),
    });
  });
});

describe('SQLite-backed checkout idempotency store', () => {
  test('persists completed checkout results by merchant, session, and key', () => {
    const databasePath = tempDatabasePath();
    const store = new SqliteCheckoutIdempotencyStore({ databasePath });

    store.save({
      merchantId: 'merchant-1',
      agentSessionId: 'session-1',
      idempotencyKey: 'checkout-key-1',
      result: {
        summary: {
          cartId: 'cart-1',
          items: [],
          subtotal: { amount: 0, currency: 'EUR' },
          total: { amount: 0, currency: 'EUR' },
          currency: 'EUR',
        },
        orderId: 'order-1',
        status: 'completed',
      },
      createdAt: fixedNow(),
    });

    const reopened = new SqliteCheckoutIdempotencyStore({ databasePath });

    expect(
      reopened.get({
        merchantId: 'merchant-1',
        agentSessionId: 'session-1',
        idempotencyKey: 'checkout-key-1',
      })?.result.orderId,
    ).toBe('order-1');
  });
});

function tempDatabasePath(): string {
  return join(mkdtempSync(join(tmpdir(), 'sales-agent-harness-sqlite-')), 'store.sqlite');
}

function fixedNow(): Date {
  return new Date('2026-06-30T12:00:00.000Z');
}
