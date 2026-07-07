import { Database } from 'bun:sqlite';
import type { RunnableConfig } from '@langchain/core/runnables';
import type {
  ChannelVersions,
  Checkpoint,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointPendingWrite,
  CheckpointTuple,
  PendingWrite,
  SerializerProtocol,
} from '@langchain/langgraph-checkpoint';
import {
  BaseCheckpointSaver,
  copyCheckpoint,
  maxChannelVersion,
  TASKS,
  WRITES_IDX_MAP,
} from '@langchain/langgraph-checkpoint';
import {
  dumpValue,
  readCheckpoint,
  readCheckpointMetadata,
  readOptionalConfigurableString,
  readUnknown,
} from './sqlite-checkpoint-codec.js';
import {
  type CheckpointRow,
  isLegacyCheckpoint,
  listCheckpointRows,
  pendingSendRowSchema,
  readCheckpointId,
  readCheckpointNamespace,
  readCheckpointRow,
  readThreadId,
  setupCheckpointTables,
  writeRowSchema,
} from './sqlite-checkpoint-saver-support.js';

class BunSqliteLangGraphCheckpointSaver extends BaseCheckpointSaver {
  readonly #db: Database;
  #isSetup = false;

  constructor(databasePath: string, serde?: SerializerProtocol) {
    super(serde);
    this.#db = new Database(databasePath);
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    this.#setup();

    const row = readCheckpointRow(this.#db, config);
    if (!row) {
      return undefined;
    }

    const checkpoint = await this.#readCheckpointFromRow(row);
    return this.#tupleFromRow(row, checkpoint);
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    this.#setup();

    const rows = await listCheckpointRows(this.#db, this.serde, config, options);
    const tuples = await Promise.all(
      rows.map(async (row) => {
        const checkpoint = await this.#readCheckpointFromRow(row);
        return this.#tupleFromRow(row, checkpoint);
      }),
    );

    for (const tuple of tuples) {
      yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    this.#setup();

    const threadId = readThreadId(config);
    const checkpointNamespace = readCheckpointNamespace(config);
    const parentCheckpointId = readOptionalConfigurableString(config, 'checkpoint_id');
    const preparedCheckpoint = copyCheckpoint(checkpoint);
    const [serializedCheckpoint, serializedMetadata] = await Promise.all([
      dumpValue(this.serde, preparedCheckpoint),
      dumpValue(this.serde, metadata),
    ]);

    if (serializedCheckpoint.type !== serializedMetadata.type) {
      throw new Error('Failed to serialize checkpoint and metadata to the same type.');
    }

    this.#db
      .query(
        `insert or replace into checkpoints (
          thread_id,
          checkpoint_ns,
          checkpoint_id,
          parent_checkpoint_id,
          type,
          checkpoint,
          metadata
        ) values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        threadId,
        checkpointNamespace,
        checkpoint.id,
        parentCheckpointId ?? null,
        serializedCheckpoint.type,
        serializedCheckpoint.value,
        serializedMetadata.value,
      );

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNamespace,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    this.#setup();

    const threadId = readThreadId(config);
    const checkpointId = readCheckpointId(config);
    const checkpointNamespace = readCheckpointNamespace(config);
    const allSpecialWrites = writes.every(([channel]) => channel in WRITES_IDX_MAP);
    const statement = this.#db.query(
      `insert ${allSpecialWrites ? 'or replace' : 'or ignore'} into writes (
        thread_id,
        checkpoint_ns,
        checkpoint_id,
        task_id,
        idx,
        channel,
        type,
        value
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const serializedWrites = await Promise.all(
      writes.map(async (write, index) => ({
        channel: write[0],
        index,
        serialized: await dumpValue(this.serde, write[1]),
      })),
    );

    for (const write of serializedWrites) {
      statement.run(
        threadId,
        checkpointNamespace,
        checkpointId,
        taskId,
        WRITES_IDX_MAP[write.channel] ?? write.index,
        write.channel,
        write.serialized.type,
        write.serialized.value,
      );
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    this.#setup();

    const transaction = this.#db.transaction((id: string) => {
      this.#db.query('delete from checkpoints where thread_id = ?').run(id);
      this.#db.query('delete from writes where thread_id = ?').run(id);
    });
    transaction(threadId);
  }

  #setup(): void {
    if (this.#isSetup) {
      return;
    }

    setupCheckpointTables(this.#db);
    this.#isSetup = true;
  }

  async #readCheckpointFromRow(row: CheckpointRow): Promise<Checkpoint> {
    const checkpoint = await readCheckpoint(this.serde, row.type, row.checkpoint);
    if (isLegacyCheckpoint(checkpoint) && row.parent_checkpoint_id) {
      await this.#migratePendingSends(checkpoint, row.thread_id, row.parent_checkpoint_id);
    }

    return checkpoint;
  }

  async #tupleFromRow(row: CheckpointRow, checkpoint: Checkpoint): Promise<CheckpointTuple> {
    const checkpointNamespace = row.checkpoint_ns;
    const config = {
      configurable: {
        thread_id: row.thread_id,
        checkpoint_ns: checkpointNamespace,
        checkpoint_id: row.checkpoint_id,
      },
    };
    const tuple: CheckpointTuple = {
      config,
      checkpoint,
      metadata: await readCheckpointMetadata(this.serde, row.type, row.metadata),
      pendingWrites: await this.#readPendingWrites(row),
    };

    if (row.parent_checkpoint_id) {
      return {
        ...tuple,
        parentConfig: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: checkpointNamespace,
            checkpoint_id: row.parent_checkpoint_id,
          },
        },
      };
    }

    return tuple;
  }

  async #readPendingWrites(row: CheckpointRow): Promise<CheckpointPendingWrite[]> {
    const rows = this.#db
      .query(
        `select task_id, channel, type, value
        from writes
        where thread_id = ?
          and checkpoint_ns = ?
          and checkpoint_id = ?
        order by task_id, idx`,
      )
      .all(row.thread_id, row.checkpoint_ns, row.checkpoint_id)
      .map((writeRow) => writeRowSchema.parse(writeRow));

    return Promise.all(
      rows.map(async (writeRow) => [
        writeRow.task_id,
        writeRow.channel,
        await readUnknown(this.serde, writeRow.type, writeRow.value),
      ]),
    );
  }

  async #migratePendingSends(
    checkpoint: Checkpoint,
    threadId: string,
    parentCheckpointId: string,
  ): Promise<void> {
    const rows = this.#db
      .query(
        `select type, value
        from writes
        where thread_id = ?
          and checkpoint_id = ?
          and channel = ?
        order by idx`,
      )
      .all(threadId, parentCheckpointId, TASKS)
      .map((row) => pendingSendRowSchema.parse(row));

    checkpoint.channel_values[TASKS] = await Promise.all(
      rows.map((row) => readUnknown(this.serde, row.type, row.value)),
    );
    checkpoint.channel_versions[TASKS] =
      Object.keys(checkpoint.channel_versions).length > 0
        ? maxChannelVersion(...Object.values(checkpoint.channel_versions))
        : this.getNextVersion(undefined);
  }
}

export function createSqliteLangGraphCheckpointSaver(databasePath: string): BaseCheckpointSaver {
  return new BunSqliteLangGraphCheckpointSaver(databasePath);
}
