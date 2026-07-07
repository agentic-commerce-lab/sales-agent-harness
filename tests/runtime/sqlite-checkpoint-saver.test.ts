import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Checkpoint, CheckpointMetadata } from '@langchain/langgraph-checkpoint';

import { createSqliteLangGraphCheckpointSaver } from '../../src/runtime/langgraph/langgraph-runtime.js';

describe('createSqliteLangGraphCheckpointSaver', () => {
  test('persists LangGraph checkpoints and pending writes with Bun SQLite', async () => {
    const databasePath = tempDatabasePath();
    const checkpoint: Checkpoint = {
      v: 4,
      id: 'checkpoint-1',
      ts: '2026-07-06T00:00:00.000Z',
      channel_values: { messages: ['hello'] },
      channel_versions: { messages: 1 },
      versions_seen: { start: { messages: 1 } },
    };
    const metadata: CheckpointMetadata = {
      source: 'input',
      step: 1,
      parents: {},
    };
    const saver = createSqliteLangGraphCheckpointSaver(databasePath);

    const storedConfig = await saver.put(
      { configurable: { thread_id: 'session-1' } },
      checkpoint,
      metadata,
      {},
    );
    await saver.putWrites(storedConfig, [['messages', ['pending']]], 'task-1');

    const reopened = createSqliteLangGraphCheckpointSaver(databasePath);
    const tuple = await reopened.getTuple({ configurable: { thread_id: 'session-1' } });
    const listed = [];
    for await (const listedTuple of reopened.list({ configurable: { thread_id: 'session-1' } })) {
      listed.push(listedTuple);
    }

    expect(tuple?.checkpoint).toEqual(checkpoint);
    expect(tuple?.metadata).toEqual(metadata);
    expect(tuple?.pendingWrites).toEqual([['task-1', 'messages', ['pending']]]);
    expect(tuple?.config.configurable?.checkpoint_id).toBe('checkpoint-1');
    expect(listed).toHaveLength(1);

    await reopened.deleteThread('session-1');

    expect(await reopened.getTuple({ configurable: { thread_id: 'session-1' } })).toBeUndefined();
  });
});

function tempDatabasePath(): string {
  return join(mkdtempSync(join(tmpdir(), 'sales-agent-harness-langgraph-')), 'checkpoints.sqlite');
}
