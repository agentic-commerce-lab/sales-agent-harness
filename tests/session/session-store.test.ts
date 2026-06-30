import { describe, expect, test } from 'bun:test';

import { InMemorySessionStore } from '../../src/session/session-store.js';

function createSessionInput() {
  return {
    agentSessionId: 'session-1',
    merchantId: 'merchant-1',
    agentId: 'agent-1',
    channel: 'a2a' as const,
    customerContext: {
      customerGroup: 'b2b',
      region: 'DE',
    },
    createdAt: new Date('2026-06-30T12:00:00.000Z'),
    expiresAt: new Date('2026-06-30T13:00:00.000Z'),
  };
}

describe('InMemorySessionStore', () => {
  test('stores Shopware context tokens server-side only', () => {
    const store = new InMemorySessionStore();

    store.createSession(createSessionInput());
    store.setCommerceContext('session-1', {
      shopwareSalesChannelId: 'sales-channel-1',
      shopwareContextToken: 'secret-context-token',
    });

    const serverSession = store.getSession('session-1', 'merchant-1');
    const publicSession = store.getPublicSession('session-1', 'merchant-1');

    expect(serverSession?.commerceContext?.shopwareContextToken).toBe('secret-context-token');
    expect(JSON.stringify(publicSession)).not.toContain('secret-context-token');
    expect(publicSession).not.toHaveProperty('commerceContext');
  });

  test('rejects missing sessions and merchant mismatches', () => {
    const store = new InMemorySessionStore();

    store.createSession(createSessionInput());

    expect(store.getSession('missing-session', 'merchant-1')).toBeUndefined();
    expect(store.getSession('session-1', 'wrong-merchant')).toBeUndefined();
    expect(store.getPublicSession('session-1', 'wrong-merchant')).toBeUndefined();
  });

  test('treats expired sessions as unavailable', () => {
    const store = new InMemorySessionStore({
      now: () => new Date('2026-06-30T14:00:00.000Z'),
    });

    store.createSession(createSessionInput());

    expect(store.getSession('session-1', 'merchant-1')).toBeUndefined();
    expect(store.getPublicSession('session-1', 'merchant-1')).toBeUndefined();
  });
});
