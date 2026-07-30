import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';

import { resolveBuyerModelName, runTurn } from './buyer-agent.js';
import { errorMessage, json, log, logError, readBody, send } from './http-helpers.js';
import { demoPageHtml } from './page.js';
import { parseGoal, parseTurnInput } from './request-parsers.js';
import { type Emit, streamConversation } from './run-stream.js';

const PORT = Number(process.env.PORT ?? 3001);

async function handleRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const goal = parseGoal(await readBody(req));

  if (!goal) {
    json(res, 400, { error: 'goal is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const emit: Emit = (event, data) => {
    if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await streamConversation(goal, res, emit);
  } catch (err) {
    const message = errorMessage(err);
    logError('Run error', message);
    emit('error', { message });
  }

  if (!res.destroyed) res.end();
}

async function handleTurn(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const input = parseTurnInput(await readBody(req));

    if (!input) {
      json(res, 400, { error: 'goal is required' });
      return;
    }

    json(res, 200, await runTurn(input));
  } catch (err) {
    const message = errorMessage(err);
    logError('Turn error', message);
    json(res, 500, { error: message });
  }
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

async function handleHome(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  send(res, 200, 'text/html; charset=utf-8', demoPageHtml(resolveBuyerModelName()));
}

const postRoutes: Record<string, RouteHandler> = {
  '/run': handleRun,
  '/turn': handleTurn,
};

function findHandler(req: IncomingMessage, url: URL): RouteHandler | undefined {
  if (req.method === 'GET' && url.pathname === '/') {
    return handleHome;
  }

  return req.method === 'POST' ? postRoutes[url.pathname] : undefined;
}

async function routeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const handler = findHandler(req, url);

  if (handler) {
    return handler(req, res);
  }

  json(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  routeRequest(req, res).catch((err: unknown) => {
    const message = errorMessage(err);
    logError('Request error', message);
    if (!res.headersSent) json(res, 500, { error: message });
  });
});

server.listen(PORT, () => {
  const sellerUrl = process.env.SELLER_URL ?? 'http://localhost:3000';
  log(`A2A demo buyer agent running at http://localhost:${PORT}`);
  log(`Seller agent URL: ${sellerUrl}`);
});
