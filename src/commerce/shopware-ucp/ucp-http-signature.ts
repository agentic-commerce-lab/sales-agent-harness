import { createHash, createPrivateKey, sign, type webcrypto } from 'node:crypto';

import { readRecord, readString } from '../shopware/shopware-store-api-readers.js';

export interface UcpHttpSigningConfig {
  readonly keyId: string;
  readonly privateKeyJwk: string;
}

export interface UcpHttpSignatureInput {
  readonly method: string;
  readonly url: URL;
  readonly headers: ReadonlyMap<string, string>;
  readonly body?: string | undefined;
}

export interface UcpHttpSignatureHeaders {
  readonly contentDigest?: string | undefined;
  readonly signatureInput: string;
  readonly signature: string;
}

export class UcpHttpSigner {
  readonly #keyId: string;
  readonly #privateKey: ReturnType<typeof createPrivateKey>;

  constructor(config: UcpHttpSigningConfig) {
    this.#keyId = config.keyId;
    this.#privateKey = createPrivateKey({
      key: parsePrivateEcJwk(config.privateKeyJwk, config.keyId),
      format: 'jwk',
    });
  }

  // fallow-ignore-next-line unused-class-member
  sign(input: UcpHttpSignatureInput): UcpHttpSignatureHeaders {
    const headers = new Map(input.headers);
    const contentDigest = input.body === undefined ? undefined : createContentDigest(input.body);

    if (contentDigest) {
      headers.set('content-digest', contentDigest);
    }

    const components = [
      '@method',
      '@authority',
      '@path',
      'ucp-agent',
      'idempotency-key',
      ...(input.body === undefined ? [] : ['content-digest', 'content-type']),
    ];
    const created = Math.floor(Date.now() / 1000);
    const signatureParams = `${formatComponentList(components)};created=${created};keyid="${escapeSfString(
      this.#keyId,
    )}"`;
    const signatureBase = buildSignatureBase({
      components,
      signatureParams,
      input,
      headers,
    });
    const signatureBytes = sign('sha256', Buffer.from(signatureBase), {
      key: this.#privateKey,
      dsaEncoding: 'ieee-p1363',
    });

    return {
      ...(contentDigest ? { contentDigest } : {}),
      signatureInput: `sig1=${signatureParams}`,
      signature: `sig1=:${signatureBytes.toString('base64')}:`,
    };
  }
}

function createContentDigest(body: string): string {
  return `sha-256=:${createHash('sha256').update(body).digest('base64')}:`;
}

function buildSignatureBase(input: {
  readonly components: readonly string[];
  readonly signatureParams: string;
  readonly input: UcpHttpSignatureInput;
  readonly headers: ReadonlyMap<string, string>;
}): string {
  const lines = input.components.map((component) => {
    return `"${component}": ${readComponentValue(component, input.input, input.headers)}`;
  });
  lines.push(`"@signature-params": ${input.signatureParams}`);

  return lines.join('\n');
}

function readComponentValue(
  component: string,
  input: UcpHttpSignatureInput,
  headers: ReadonlyMap<string, string>,
): string {
  switch (component) {
    case '@method':
      return input.method.toUpperCase();
    case '@authority':
      return input.url.host;
    case '@path':
      return input.url.pathname;
    default:
      return readHeader(headers, component);
  }
}

function readHeader(headers: ReadonlyMap<string, string>, name: string): string {
  const value = headers.get(name);
  if (value === undefined) {
    throw new Error(`Cannot sign UCP request without ${name} header`);
  }

  return value;
}

function formatComponentList(components: readonly string[]): string {
  return `(${components.map((component) => `"${component}"`).join(' ')})`;
}

export function escapeSfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function parsePrivateEcJwk(value: string, expectedKeyId: string): webcrypto.JsonWebKey {
  const record = readRecord(JSON.parse(value));
  const keyId = readString(record.kid, 'UCP signing key kid');

  if (keyId !== expectedKeyId) {
    throw new Error(`UCP signing key kid ${keyId} does not match ${expectedKeyId}`);
  }

  const keyType = readString(record.kty, 'UCP signing key kty');
  const curve = readString(record.crv, 'UCP signing key crv');
  const x = readString(record.x, 'UCP signing key x');
  const y = readString(record.y, 'UCP signing key y');
  const d = readString(record.d, 'UCP signing key d');

  if (keyType !== 'EC' || curve !== 'P-256') {
    throw new Error('UCP signing currently supports EC P-256 keys only');
  }

  return {
    kty: keyType,
    crv: curve,
    x,
    y,
    d,
  };
}
