import { createPublicKey } from 'node:crypto';

import { readRecord, readString } from '../shopware/shopware-store-api-readers.js';
import { parsePrivateEcJwk } from './ucp-http-signature.js';

export interface UcpPlatformProfileInput {
  readonly profileUrl: string;
  readonly signingKeyId: string;
  readonly signingPrivateKeyJwk: string;
  readonly allowInsecureProfileUrl?: boolean | undefined;
}

export interface UcpPlatformProfile {
  readonly ucp: {
    readonly version: '2026-04-08';
    readonly services: {
      readonly 'dev.ucp.shopping': readonly [
        {
          readonly transport: 'rest';
          readonly endpoint: string;
          readonly version: '2026-04-08';
          readonly spec: 'https://ucp.dev/specification/overview/';
          readonly schema: 'https://ucp.dev/2026-04-08/services/shopping/rest.openapi.json';
        },
      ];
    };
    readonly capabilities: {
      readonly 'dev.ucp.shopping.cart': readonly [UcpPlatformCapability];
      readonly 'dev.ucp.shopping.catalog': readonly [UcpPlatformCapability];
      readonly 'dev.ucp.shopping.checkout': readonly [UcpPlatformCapability];
    };
  };
  readonly signing_keys: readonly [PublicEcJwk];
}

interface UcpPlatformCapability {
  readonly version: '2026-04-08';
  readonly spec: string;
  readonly schema: string;
}

export interface PublicEcJwk {
  readonly kty: 'EC';
  readonly crv: 'P-256';
  readonly kid: string;
  readonly alg: 'ES256';
  readonly use: 'sig';
  readonly x: string;
  readonly y: string;
}

export function createUcpPlatformProfile(input: UcpPlatformProfileInput): UcpPlatformProfile {
  assertProfileUrl(input.profileUrl, input.allowInsecureProfileUrl ?? false);
  const privateJwk = parsePrivateEcJwk(input.signingPrivateKeyJwk, input.signingKeyId);
  const publicJwk = createPublicKey({ key: privateJwk, format: 'jwk' }).export({
    format: 'jwk',
  });

  return {
    ucp: {
      version: '2026-04-08',
      services: {
        'dev.ucp.shopping': [
          {
            transport: 'rest',
            endpoint: profileOrigin(input.profileUrl),
            version: '2026-04-08',
            spec: 'https://ucp.dev/specification/overview/',
            schema: 'https://ucp.dev/2026-04-08/services/shopping/rest.openapi.json',
          },
        ],
      },
      capabilities: {
        'dev.ucp.shopping.cart': [
          {
            version: '2026-04-08',
            spec: 'https://ucp.dev/specification/cart/',
            schema: 'https://ucp.dev/schemas/shopping/cart.json',
          },
        ],
        'dev.ucp.shopping.catalog': [
          {
            version: '2026-04-08',
            spec: 'https://ucp.dev/specification/catalog/',
            schema: 'https://ucp.dev/schemas/shopping/catalog.json',
          },
        ],
        'dev.ucp.shopping.checkout': [
          {
            version: '2026-04-08',
            spec: 'https://ucp.dev/specification/checkout/',
            schema: 'https://ucp.dev/schemas/shopping/checkout.json',
          },
        ],
      },
    },
    signing_keys: [parsePublicEcJwk(publicJwk, input.signingKeyId)],
  };
}

function profileOrigin(profileUrl: string): string {
  return `${new URL(profileUrl).origin}/ucp/v1`;
}

function assertProfileUrl(profileUrl: string, allowInsecureProfileUrl: boolean): void {
  const url = new URL(profileUrl);

  if (url.protocol !== 'https:' && !allowInsecureProfileUrl) {
    throw new Error('UCP platform profile URL must use HTTPS');
  }
}

function parsePublicEcJwk(value: unknown, expectedKeyId: string): PublicEcJwk {
  const record = readRecord(value);
  const keyType = readString(record.kty, 'UCP public signing key kty');
  const curve = readString(record.crv, 'UCP public signing key crv');

  if (keyType !== 'EC' || curve !== 'P-256') {
    throw new Error('UCP public signing key must be EC P-256');
  }

  return {
    kty: keyType,
    crv: curve,
    kid: expectedKeyId,
    alg: 'ES256',
    use: 'sig',
    x: readString(record.x, 'UCP public signing key x'),
    y: readString(record.y, 'UCP public signing key y'),
  };
}
