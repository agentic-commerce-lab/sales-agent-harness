import { createA2aAgentCard } from './a2a-agent-card.js';
import { a2aProtocolVersion } from './a2a-constants.js';
import { handleA2aSendMessage } from './a2a-message.js';
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

  if (url.pathname === '/.well-known/agent-card.json') {
    return a2aResponse(createA2aAgentCard(url.origin));
  }

  if (url.pathname === '/examples/customer-ui') {
    return htmlResponse(exampleCustomerUiHtml);
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

async function readJson(request: Request): Promise<unknown> {
  return request.json();
}

function assertA2aVersion(request: Request): void {
  if (request.headers.get('A2A-Version') !== a2aProtocolVersion) {
    throw new HttpInputError(`A2A-Version header must be ${a2aProtocolVersion}`);
  }
}
