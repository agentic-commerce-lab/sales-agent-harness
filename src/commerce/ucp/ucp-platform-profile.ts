import { createPublicKey } from 'node:crypto';

import { readRecord, readString } from '../shopware/shopware-store-api-readers.js';
import { parsePrivateEcJwk } from './ucp-http-signature.js';
import {
  createProfileDocument,
  type PublicEcJwk,
  type UcpPlatformProfile,
} from './ucp-profile-document.js';

export interface UcpPlatformProfileInput {
  readonly profileUrl: string;
  readonly signingKeyId: string;
  readonly signingPrivateKeyJwk: string;
  readonly allowInsecureProfileUrl?: boolean | undefined;
}

export function createUcpPlatformProfile(input: UcpPlatformProfileInput): UcpPlatformProfile {
  assertProfileUrl(input.profileUrl, input.allowInsecureProfileUrl ?? false);
  const privateJwk = parsePrivateEcJwk(input.signingPrivateKeyJwk, input.signingKeyId);
  const publicJwk = createPublicKey({ key: privateJwk, format: 'jwk' }).export({
    format: 'jwk',
  });

  return createProfileDocument(
    profileOrigin(input.profileUrl),
    parsePublicEcJwk(publicJwk, input.signingKeyId),
  );
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
