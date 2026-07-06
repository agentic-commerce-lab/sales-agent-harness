import { z } from 'zod';

const metadataSchema = z.record(z.string(), z.unknown()).optional();

const a2aPartSchema = z.object({
  kind: z.enum(['text', 'data', 'file', 'url']).optional(),
  text: z.string().optional(),
  data: z.unknown().optional(),
  mediaType: z.string().optional(),
  metadata: metadataSchema,
});

const a2aMessageSchema = z.object({
  messageId: z.string().min(1),
  contextId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  role: z.enum(['user', 'ROLE_USER']),
  parts: z.array(a2aPartSchema).min(1),
  metadata: metadataSchema,
});

export const sendMessageSchema = z.object({
  message: a2aMessageSchema,
});

export type A2aMessage = z.infer<typeof a2aMessageSchema>;
export type A2aPart = z.infer<typeof a2aPartSchema>;
