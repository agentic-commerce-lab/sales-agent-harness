import type { CommerceEnvironmentConfig } from '../../env/commerce-config.js';
import { discoverUcpShoppingService, type UcpDiscoveredService } from './ucp-discovery.js';
import { escapeSfString, UcpHttpSigner } from './ucp-http-signature.js';

export interface UcpHttpClient {
  readonly baseUrl: string;
  discoverEndpoint(): Promise<string>;
  supportsAp2Mandate(): Promise<boolean>;
  requestJson(method: string, url: string, body?: unknown): Promise<unknown>;
}

export function createUcpHttpClient(
  config: CommerceEnvironmentConfig,
  fetchImplementation: typeof fetch = fetch,
): UcpHttpClient {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const agentProfileUrl = config.ucpAgentProfileUrl ?? `${baseUrl}/.well-known/ucp`;
  const signer = createSigner(config);
  let servicePromise: Promise<UcpDiscoveredService> | undefined;

  const discoverService = (): Promise<UcpDiscoveredService> => {
    servicePromise ??= discoverUcpShoppingService(fetchImplementation, baseUrl);
    return servicePromise;
  };

  return {
    baseUrl,
    discoverEndpoint: async () => (await discoverService()).endpoint,
    supportsAp2Mandate: async () => (await discoverService()).supportsAp2Mandate,
    requestJson: (method, url, body) =>
      requestJson({ fetchImplementation, agentProfileUrl, signer }, method, url, body),
  };
}

interface UcpRequestContext {
  readonly fetchImplementation: typeof fetch;
  readonly agentProfileUrl: string;
  readonly signer: UcpHttpSigner | undefined;
}

function createSigner(config: CommerceEnvironmentConfig): UcpHttpSigner | undefined {
  if (!config.ucpSigningKeyId || !config.ucpSigningPrivateKeyJwk) {
    return undefined;
  }

  return new UcpHttpSigner({
    keyId: config.ucpSigningKeyId,
    privateKeyJwk: config.ucpSigningPrivateKeyJwk,
  });
}

async function requestJson(
  context: UcpRequestContext,
  method: string,
  url: string,
  body?: unknown,
): Promise<unknown> {
  const parsedUrl = new URL(url);
  const bodyString = body === undefined ? undefined : JSON.stringify(body);
  const headers = createHeaders(context.agentProfileUrl, bodyString);
  signHeaders(context.signer, method, parsedUrl, headers, bodyString ?? '');
  const response = await context.fetchImplementation(parsedUrl, {
    method,
    headers: Object.fromEntries(headers.entries()),
    ...(bodyString !== undefined ? { body: bodyString } : {}),
  });

  if (!response.ok) {
    throw new Error(
      `UCP request failed with status ${response.status}: ${await readErrorBody(response)}`,
    );
  }

  return response.json();
}

function createHeaders(agentProfileUrl: string, bodyString: string | undefined) {
  const headers = new Map<string, string>([
    ['accept', 'application/json'],
    ['idempotency-key', createIdempotencyKey()],
    ['ucp-agent', `profile="${escapeSfString(agentProfileUrl)}"`],
  ]);

  if (bodyString !== undefined) {
    headers.set('content-type', 'application/json');
  }

  return headers;
}

function signHeaders(
  signer: UcpHttpSigner | undefined,
  method: string,
  url: URL,
  headers: Map<string, string>,
  body: string,
): void {
  const signatureHeaders = signer?.sign({ method, url, body });

  if (!signatureHeaders) {
    return;
  }

  headers.set('content-digest', signatureHeaders.contentDigest);
  headers.set('signature-input', signatureHeaders.signatureInput);
  headers.set('signature', signatureHeaders.signature);
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return 'empty response body';
  }

  return text.slice(0, 1000);
}

function createIdempotencyKey(): string {
  return `sales-agent-harness-${globalThis.crypto.randomUUID()}`;
}
