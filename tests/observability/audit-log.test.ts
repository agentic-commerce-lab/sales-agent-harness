import { describe, expect, test } from 'bun:test';

import { InMemoryAuditLogger } from '../../src/observability/audit-log.js';

describe('InMemoryAuditLogger', () => {
  test('captures structured audit events with required commerce context', () => {
    const logger = new InMemoryAuditLogger();

    logger.record({
      type: 'policy_decision',
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      agentId: 'agent-1',
      channel: 'a2a',
      capability: 'createCart',
      policyDecision: 'allow',
      dataSources: ['shopware_store_api'],
      occurredAt: new Date('2026-06-30T12:00:00.000Z'),
    });

    expect(logger.events).toHaveLength(1);
    expect(logger.events[0]?.merchantId).toBe('merchant-1');
    expect(logger.events[0]?.policyDecision).toBe('allow');
  });

  test('records errors with the original error object', () => {
    const logger = new InMemoryAuditLogger();
    const error = new Error('Shopware unavailable');

    logger.record({
      type: 'error',
      agentSessionId: 'session-1',
      merchantId: 'merchant-1',
      agentId: 'agent-1',
      channel: 'customer_ui',
      capability: 'searchProducts',
      occurredAt: new Date('2026-06-30T12:00:00.000Z'),
      error,
    });

    expect(logger.events[0]?.error).toBe(error);
    expect(JSON.stringify(logger.events[0])).toContain('searchProducts');
  });
});
