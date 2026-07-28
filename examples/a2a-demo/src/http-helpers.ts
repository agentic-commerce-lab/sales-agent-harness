import type { IncomingMessage, ServerResponse } from 'node:http';

export function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function logError(message: string, detail: string): void {
  process.stderr.write(`${message}: ${detail}\n`);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function send(res: ServerResponse, status: number, contentType: string, body: string): void {
  // The demo page inlines its JavaScript; a cached page keeps running stale
  // event handlers, so never let the browser reuse it.
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
}

export function json(res: ServerResponse, status: number, data: unknown): void {
  send(res, status, 'application/json', JSON.stringify(data));
}
