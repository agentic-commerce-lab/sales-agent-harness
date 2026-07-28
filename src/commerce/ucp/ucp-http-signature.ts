import { createHash, createPrivateKey, sign, type webcrypto } from 'node:crypto';

import { readRecord, readString } from '../shopware/shopware-store-api-readers.js';

export interface UcpHttpSigningConfig {
  readonly keyId: string;
  readonly privateKeyJwk: string;
}

export interface UcpHttpSignatureInput {
  readonly method: string;
  readonly url: URL;
  readonly body: string;
}

export interface UcpHttpSignatureHeaders {
  readonly contentDigest: string;
  readonly signatureInput: string;
  readonly signature: string;
}

/**
 * Matches the shop's verifier (ucp-php-sdk Rfc9421RequestSignatureService),
 * not the general RFC 9421 spec text: it signs exactly @method/@target-uri/
 * content-digest (nothing else), requires created+expires+keyid on every
 * signature, and verifies with PHP's openssl_verify — which expects DER
 * ECDSA signatures, not the raw r||s encoding RFC 9421 examples show.
 */
const SIGNATURE_LIFETIME_SECONDS = 300;

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

  sign(input: UcpHttpSignatureInput): UcpHttpSignatureHeaders {
    const contentDigest = createContentDigest(input.body);
    const created = Math.floor(Date.now() / 1000);
    const expires = created + SIGNATURE_LIFETIME_SECONDS;
    const signatureParams =
      `("@method" "@target-uri" "content-digest");created=${created};expires=${expires};` +
      `keyid="${escapeSfString(this.#keyId)}";alg="ES256"`;
    const signatureBase = [
      `"@method": ${input.method.toUpperCase()}`,
      `"@target-uri": ${input.url.toString()}`,
      `"content-digest": ${contentDigest}`,
      `"@signature-params": ${signatureParams}`,
    ].join('\n');
    const signatureBytes = sign('sha256', Buffer.from(signatureBase), { key: this.#privateKey });

    return {
      contentDigest,
      signatureInput: `sig1=${signatureParams}`,
      signature: `sig1=:${signatureBytes.toString('base64')}:`,
    };
  }
}

function createContentDigest(body: string): string {
  return `sha-256=:${createHash('sha256').update(body).digest('base64')}:`;
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
