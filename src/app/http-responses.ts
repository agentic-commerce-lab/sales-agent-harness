import { z } from 'zod';

import { a2aContentType, a2aProtocolVersion } from './a2a-constants.js';

export class HttpInputError extends Error {}

export function jsonResponse(
  body: unknown,
  status = 200,
  contentType = 'application/json',
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': contentType },
  });
}

export function a2aResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': a2aContentType,
      'A2A-Version': a2aProtocolVersion,
    },
  });
}

export function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export function toErrorResponse(error: unknown): { readonly error: string } {
  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: 'Unexpected error' };
}

export function isInputError(error: unknown): boolean {
  return (
    error instanceof z.ZodError || error instanceof SyntaxError || error instanceof HttpInputError
  );
}
