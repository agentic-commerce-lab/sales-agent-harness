import { z } from 'zod';

import { commerceRequestSchema } from './http-contracts.js';

const responseEnvelope = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'blocked', 'error'] },
    policyDecision: { type: 'object' },
    value: {},
  },
  required: ['status'],
};

/**
 * Machine-readable self-description of the harness's structured commerce surface.
 * The `/commerce/a2a` request body is generated from the single source of truth
 * (`commerceRequestSchema`) via Zod 4's native JSON Schema export, so it can never
 * drift from what the endpoint actually accepts. Buyer agents (and ChatGPT custom-GPT
 * Actions) can consume this instead of an out-of-band recipe.
 */
export function createOpenApiDocument(origin: string): object {
  // `io: 'input'` describes what a client SENDS (correct for a request body) and
  // sidesteps output-only transforms; `unrepresentable: 'any'` degrades anything
  // JSON Schema can't express to `{}` rather than throwing.
  const commerceRequest = z.toJSONSchema(commerceRequestSchema, {
    io: 'input',
    unrepresentable: 'any',
  });

  return {
    openapi: '3.1.0',
    info: {
      title: 'Sales Agent Harness — commerce A2A',
      version: '0.1.0',
      description:
        'Structured, deterministic commerce endpoint. POST /commerce/a2a with a capability-tagged body; the harness signs UCP requests to the merchant shop and never holds funds.',
    },
    servers: [{ url: origin }],
    paths: {
      '/commerce/a2a': {
        post: {
          operationId: 'commerceA2a',
          summary: 'Run a commerce capability (search, cart, checkout).',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: commerceRequest } },
          },
          responses: {
            '200': {
              description: 'Capability result envelope',
              content: { 'application/json': { schema: responseEnvelope } },
            },
          },
        },
      },
      '/sessions': {
        post: {
          operationId: 'createSession',
          summary:
            'Optional: create an explicit agent session. The harness auto-creates one on first /commerce/a2a use, so a stable client-chosen agentSessionId works without calling this.',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { channel: { type: 'string' } },
                },
              },
            },
          },
          responses: { '201': { description: 'Created agent session' } },
        },
      },
      '/health': {
        get: { operationId: 'health', responses: { '200': { description: 'ok' } } },
      },
    },
  };
}
