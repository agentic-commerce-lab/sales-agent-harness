import type { RunnableConfig } from '@langchain/core/runnables';
import type {
  Checkpoint,
  CheckpointMetadata,
  SerializerProtocol,
} from '@langchain/langgraph-checkpoint';
import { z } from 'zod';

const channelVersionSchema = z.union([z.number(), z.string()]);

const checkpointSchema = z.object({
  v: z.number(),
  id: z.string(),
  ts: z.string(),
  channel_values: z.record(z.string(), z.unknown()),
  channel_versions: z.record(z.string(), channelVersionSchema),
  versions_seen: z.record(z.string(), z.record(z.string(), channelVersionSchema)),
});

const checkpointMetadataSchema = z.looseObject({
  source: z.enum(['input', 'loop', 'update', 'fork']),
  step: z.number(),
  parents: z.record(z.string(), z.string()),
});

const configurableSchema = z.record(z.string(), z.unknown()).optional();

export type SerializedValue = {
  readonly type: string;
  readonly value: Uint8Array;
};

export async function dumpValue(
  serde: SerializerProtocol,
  value: unknown,
): Promise<SerializedValue> {
  const [type, serializedValue] = await serde.dumpsTyped(value);
  return { type, value: serializedValue };
}

export async function readCheckpoint(
  serde: SerializerProtocol,
  type: string | null,
  value: Uint8Array,
): Promise<Checkpoint> {
  return checkpointSchema.parse(await readUnknown(serde, type, value));
}

export async function readCheckpointMetadata(
  serde: SerializerProtocol,
  type: string | null,
  value: Uint8Array,
): Promise<CheckpointMetadata> {
  return checkpointMetadataSchema.parse(await readUnknown(serde, type, value));
}

export async function readUnknown(
  serde: SerializerProtocol,
  type: string | null,
  value: Uint8Array,
): Promise<unknown> {
  return serde.loadsTyped(type ?? 'json', value);
}

export function readOptionalConfigurableString(
  config: RunnableConfig | undefined,
  key: string,
): string | undefined {
  const configurable = configurableSchema.parse(config?.configurable);
  const value = configurable?.[key];
  return typeof value === 'string' ? value : undefined;
}
