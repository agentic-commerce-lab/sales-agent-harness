import type { Database } from 'bun:sqlite';
import type { RunnableConfig } from '@langchain/core/runnables';
import type {
  Checkpoint,
  CheckpointListOptions,
  SerializerProtocol,
} from '@langchain/langgraph-checkpoint';
import { z } from 'zod';
import { readOptionalConfigurableString, readUnknown } from './sqlite-checkpoint-codec.js';

const checkpointRowSchema = z.object({
  thread_id: z.string(),
  checkpoint_ns: z.string(),
  checkpoint_id: z.string(),
  parent_checkpoint_id: z.string().nullable(),
  type: z.string().nullable(),
  checkpoint: z.instanceof(Uint8Array),
  metadata: z.instanceof(Uint8Array),
});

export const writeRowSchema = z.object({
  task_id: z.string(),
  channel: z.string(),
  type: z.string().nullable(),
  value: z.instanceof(Uint8Array),
});

export const pendingSendRowSchema = z.object({
  type: z.string().nullable(),
  value: z.instanceof(Uint8Array),
});

export type CheckpointRow = z.infer<typeof checkpointRowSchema>;

export function setupCheckpointTables(db: Database): void {
  db.query('pragma journal_mode = WAL').run();
  db.query(
    `create table if not exists checkpoints (
      thread_id text not null,
      checkpoint_ns text not null default '',
      checkpoint_id text not null,
      parent_checkpoint_id text,
      type text,
      checkpoint blob,
      metadata blob,
      primary key (thread_id, checkpoint_ns, checkpoint_id)
    )`,
  ).run();
  db.query(
    `create table if not exists writes (
      thread_id text not null,
      checkpoint_ns text not null default '',
      checkpoint_id text not null,
      task_id text not null,
      idx integer not null,
      channel text not null,
      type text,
      value blob,
      primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
    )`,
  ).run();
}

export function readCheckpointRow(db: Database, config: RunnableConfig): CheckpointRow | undefined {
  const threadId = readOptionalConfigurableString(config, 'thread_id');
  if (!threadId) {
    return undefined;
  }

  const checkpointNamespace = readCheckpointNamespace(config);
  const checkpointId = readOptionalConfigurableString(config, 'checkpoint_id');
  const row =
    typeof checkpointId === 'string'
      ? db
          .query(
            `select *
            from checkpoints
            where thread_id = ?
              and checkpoint_ns = ?
              and checkpoint_id = ?`,
          )
          .get(threadId, checkpointNamespace, checkpointId)
      : db
          .query(
            `select *
            from checkpoints
            where thread_id = ?
              and checkpoint_ns = ?
            order by checkpoint_id desc
            limit 1`,
          )
          .get(threadId, checkpointNamespace);

  return checkpointRowSchema.nullable().parse(row) ?? undefined;
}

export async function listCheckpointRows(
  db: Database,
  serde: SerializerProtocol,
  config: RunnableConfig,
  options?: CheckpointListOptions,
): Promise<CheckpointRow[]> {
  const query = buildListCheckpointQuery(config, options);
  const rows = db
    .query(query.sql)
    .all(...query.args)
    .map((row) => checkpointRowSchema.parse(row));
  const matches = await Promise.all(
    rows.map((row) => metadataMatchesFilter(row, options?.filter, serde)),
  );
  const filteredRows = rows.filter((_row, index) => matches[index]);

  return typeof options?.limit === 'number' ? filteredRows.slice(0, options.limit) : filteredRows;
}

function buildListCheckpointQuery(
  config: RunnableConfig,
  options?: CheckpointListOptions,
): { readonly sql: string; readonly args: string[] } {
  const filters = [
    ['thread_id', readOptionalConfigurableString(config, 'thread_id')],
    ['checkpoint_ns', readOptionalConfigurableString(config, 'checkpoint_ns')],
    ['checkpoint_id', readOptionalConfigurableString(options?.before, 'checkpoint_id'), '<'],
  ] as const;
  const clauses = filters.flatMap(([column, value, operator = '=']) =>
    typeof value === 'string' ? [`${column} ${operator} ?`] : [],
  );
  const args = filters.flatMap(([_column, value]) => (typeof value === 'string' ? [value] : []));

  return {
    sql: `select *
      from checkpoints
      ${clauses.length > 0 ? `where ${clauses.join(' and ')}` : ''}
      order by checkpoint_id desc`,
    args,
  };
}

export function readThreadId(config: RunnableConfig): string {
  const threadId = readOptionalConfigurableString(config, 'thread_id');
  if (typeof threadId !== 'string') {
    throw new Error('Missing "thread_id" field in passed "config.configurable".');
  }

  return threadId;
}

export function readCheckpointId(config: RunnableConfig): string {
  const checkpointId = readOptionalConfigurableString(config, 'checkpoint_id');
  if (typeof checkpointId !== 'string') {
    throw new Error('Missing "checkpoint_id" field in passed "config.configurable".');
  }

  return checkpointId;
}

export function readCheckpointNamespace(config: RunnableConfig): string {
  return readOptionalConfigurableString(config, 'checkpoint_ns') ?? '';
}

export function isLegacyCheckpoint(checkpoint: Checkpoint): boolean {
  return checkpoint.v < 4;
}

async function metadataMatchesFilter(
  row: CheckpointRow,
  filter: CheckpointListOptions['filter'],
  serde: SerializerProtocol,
): Promise<boolean> {
  if (!filter) {
    return true;
  }

  const metadata = await readUnknown(serde, row.type, row.metadata);
  return objectContainsFilter(metadata, filter);
}

function objectContainsFilter(value: unknown, filter: Record<string, unknown>): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.entries(filter).every(
    ([key, expectedValue]) => Reflect.get(value, key) === expectedValue,
  );
}
