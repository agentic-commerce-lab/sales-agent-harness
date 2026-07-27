import { z } from 'zod';

import { createA2aAgentCard } from './a2a-agent-card.js';
import { a2aProtocolVersion } from './a2a-constants.js';
import { handleA2aSendMessage } from './a2a-message.js';
import { checkoutResumeHtml } from './checkout-resume-page.js';
import { exampleCustomerUiHtml } from './example-customer-ui.js';
import {
  chatSchema,
  handoffValidationSchema,
  parseCommerceRequest,
  parseSession,
} from './http-contracts.js';
import type {
  CreateSalesAgentHttpHandlerInput,
  SalesAgentHttpApp,
  SalesAgentHttpHandler,
} from './http-handler-types.js';
import {
  a2aResponse,
  HttpInputError,
  htmlResponse,
  isInputError,
  jsonResponse,
  toErrorResponse,
} from './http-responses.js';

export type {
  CreateSalesAgentHttpHandlerInput,
  SalesAgentHttpApp,
  SalesAgentHttpHandler,
} from './http-handler-types.js';

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}: ${detail}\n`);
}

export function createSalesAgentHttpHandler(
  input: CreateSalesAgentHttpHandlerInput,
): SalesAgentHttpHandler {
  return {
    handle: async (request) => handleRequest(input, request),
  };
}

async function handleRequest(
  input: CreateSalesAgentHttpHandlerInput,
  request: Request,
): Promise<Response> {
  const start = Date.now();
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    // Bodies can contain buyer PII (email, phone, shipping address) and chat
    // content, so they are only logged when explicitly enabled for debugging.
    const body = input.debugLogRequestBodies ? ` ${await request.clone().text()}` : '';
    log(`→ ${request.method} ${url.pathname}${body}`);
  }

  try {
    const response =
      request.method === 'GET'
        ? handleGetRequest(input, url)
        : await handlePostRequest(input.app, request, url);
    log(`← ${response.status} (${Date.now() - start}ms)`);
    return response;
  } catch (error) {
    const status = isInputError(error) ? 400 : 500;
    logError(`← ${status} error (${Date.now() - start}ms)`, error);
    return jsonResponse(toErrorResponse(error), status);
  }
}

function handleGetRequest(input: CreateSalesAgentHttpHandlerInput, url: URL): Response {
  if (url.pathname === '/health') {
    return jsonResponse({ status: 'ok' });
  }

  if (url.pathname === '/.well-known/ucp' && input.ucpPlatformProfile) {
    return new Response(JSON.stringify(input.ucpPlatformProfile), {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=300',
        'content-type': 'application/json',
      },
    });
  }

  if (url.pathname === '/.well-known/agent-card.json') {
    return a2aResponse(createA2aAgentCard(url.origin, input.agentConfig));
  }

  if (url.pathname === '/examples/customer-ui') {
    return htmlResponse(exampleCustomerUiHtml);
  }

  if (url.pathname === '/checkout-resume' && input.checkoutResume) {
    return checkoutResumeResponse(url, input.checkoutResume);
  }

  if (url.pathname === '/') {
    return jsonResponse({
      service: 'sales-agent-harness',
      description: 'Seller commerce agent. Discover capabilities via the agent card.',
      endpoints: {
        agentCard: '/.well-known/agent-card.json',
        commerceA2a: '/commerce/a2a',
        commerceCustomer: '/commerce/customer',
        sessions: '/sessions',
        health: '/health',
      },
    });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

function checkoutResumeResponse(
  url: URL,
  checkoutResume: NonNullable<CreateSalesAgentHttpHandlerInput['checkoutResume']>,
): Response {
  const token = url.searchParams.get('token');
  if (!token) {
    return jsonResponse({ error: 'Missing token parameter' }, 400);
  }
  return htmlResponse(checkoutResumeHtml(token, checkoutResume));
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
    case '/':
      return handleJsonRpcRequest(app, await readJson(request));
    case '/sessions':
      return jsonResponse(app.createSession(parseSession(await readJson(request))), 201);
    case '/chat':
      return jsonResponse(await app.chat(chatSchema.parse(await readJson(request))));
    case '/message:send':
      assertA2aVersion(request);
      return a2aResponse(await handleA2aSendMessage(app, await readJson(request)));
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

async function handleJsonRpcRequest(app: SalesAgentHttpApp, body: unknown): Promise<Response> {
  const rpc = parseJsonRpcBody(body);

  try {
    switch (rpc.method) {
      case 'message/send': {
        const result = await handleA2aSendMessage(app, rpc.params);
        return jsonResponse({ jsonrpc: '2.0', id: rpc.id, result });
      }
      default:
        return jsonResponse(
          {
            jsonrpc: '2.0',
            id: rpc.id,
            error: { code: -32601, message: `Method not found: ${rpc.method}` },
          },
          404,
        );
    }
  } catch (error) {
    logError('JSONRPC error', error);
    const message =
      error instanceof Error && isInputError(error) ? error.message : 'Internal error';
    const code = isInputError(error) ? -32602 : -32603;
    return jsonResponse(
      { jsonrpc: '2.0', id: rpc.id, error: { code, message } },
      isInputError(error) ? 400 : 500,
    );
  }
}

const jsonRpcBodySchema = z.object({
  id: z.unknown(),
  method: z.string(),
  params: z.unknown().optional(),
});

function parseJsonRpcBody(body: unknown): { id: unknown; method: string; params: unknown } {
  const result = jsonRpcBodySchema.safeParse(body);
  if (!result.success) {
    throw new HttpInputError('Invalid JSON-RPC request');
  }
  return { id: result.data.id, method: result.data.method, params: result.data.params };
}

async function readJson(request: Request): Promise<unknown> {
  return request.json();
}

function assertA2aVersion(request: Request): void {
  if (request.headers.get('A2A-Version') !== a2aProtocolVersion) {
    throw new HttpInputError(`A2A-Version header must be ${a2aProtocolVersion}`);
  }
}
