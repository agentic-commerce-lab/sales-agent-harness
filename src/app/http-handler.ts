import { z } from 'zod';

import type { CommerceApiRequest } from '../api/harness-api.js';
import type { PublicAgentSession } from '../contracts/session.js';
import type { AgentRuntimeResponse } from '../runtime/agent-runtime.js';
import {
  chatSchema,
  handoffValidationSchema,
  parseCommerceRequest,
  parseSession,
} from './http-contracts.js';
import type {
  ChatInput,
  CheckoutHandoffValidationResult,
  CreateAgentSessionInput,
} from './sales-agent-app.js';

export interface SalesAgentHttpApp {
  readonly commerceA2aApi: { handle(input: CommerceApiRequest): Promise<unknown> };
  readonly commerceCustomerApi: { handle(input: CommerceApiRequest): Promise<unknown> };
  createSession(input: CreateAgentSessionInput): PublicAgentSession;
  chat(input: ChatInput): Promise<AgentRuntimeResponse>;
  validateCheckoutHandoff(input: { readonly handoffId: string }): CheckoutHandoffValidationResult;
}

export interface SalesAgentHttpHandler {
  handle(request: Request): Promise<Response>;
}

export interface CreateSalesAgentHttpHandlerInput {
  readonly app: SalesAgentHttpApp;
}

export function createSalesAgentHttpHandler(
  input: CreateSalesAgentHttpHandlerInput,
): SalesAgentHttpHandler {
  return {
    handle: async (request) => handleRequest(input.app, request),
  };
}

async function handleRequest(app: SalesAgentHttpApp, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);

    return request.method === 'GET'
      ? handleGetRequest(url)
      : await handlePostRequest(app, request, url);
  } catch (error) {
    return jsonResponse(toErrorResponse(error), isInputError(error) ? 400 : 500);
  }
}

function handleGetRequest(url: URL): Response {
  if (url.pathname === '/health') {
    return jsonResponse({ status: 'ok' });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

async function handlePostRequest(
  app: SalesAgentHttpApp,
  request: Request,
  url: URL,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  switch (url.pathname) {
    case '/sessions':
      return jsonResponse(app.createSession(parseSession(await readJson(request))), 201);
    case '/chat':
    case '/a2a/messages':
      return jsonResponse(await app.chat(chatSchema.parse(await readJson(request))));
    case '/commerce/customer':
      return jsonResponse(
        await app.commerceCustomerApi.handle(parseCommerceRequest(await readJson(request))),
      );
    case '/commerce/a2a':
      return jsonResponse(
        await app.commerceA2aApi.handle(parseCommerceRequest(await readJson(request))),
      );
    case '/handoff/validate':
      return jsonResponse(
        app.validateCheckoutHandoff(handoffValidationSchema.parse(await readJson(request))),
      );
    default:
      return jsonResponse({ error: 'Not found' }, 404);
  }
}

async function readJson(request: Request): Promise<unknown> {
  return request.json();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toErrorResponse(error: unknown): { readonly error: string } {
  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: 'Unexpected error' };
}

function isInputError(error: unknown): boolean {
  return error instanceof z.ZodError || error instanceof SyntaxError;
}
