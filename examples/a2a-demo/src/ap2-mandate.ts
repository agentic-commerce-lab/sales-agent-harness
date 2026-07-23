import { generateKeyPairSync, type KeyObject, randomUUID, sign } from 'node:crypto';

/**
 * Demo-only AP2 mandate signer.
 *
 * A real AP2 mandate is an SD-JWT+kb verifiable credential issued by a
 * Credentials Provider the buyer actually trusts (e.g. a wallet or passkey
 * holder), after genuine user consent, and verified against a registered,
 * independently-discoverable public key. This demo has no such provider, no
 * real user in the loop, and no key-distribution mechanism for a "buyer"
 * identity separate from the shop's own trusted platforms — so it signs a
 * plain JWT with an ephemeral keypair and embeds the public half directly in
 * the JWT header (`jwk`, RFC 7515 §4.1.3). A verifier can confirm the token
 * is internally self-consistent (untampered since signing), but this is not
 * a real trust anchor: anyone can mint a new keypair and sign anything.
 *
 * Signed with DER-encoded ECDSA (PHP's openssl_verify default), not the raw
 * r||s encoding RFC 9421 examples show elsewhere in this codebase.
 */

export interface Ap2Mandate {
  readonly checkoutMandate: string;
}

export interface Ap2MandateInput {
  readonly contextId: string | undefined;
  readonly goal: string;
  /**
   * The checkout's real id/total/currency, once known. Omitting these
   * produces a mandate the shop will reject as invalid rather than one that
   * silently claims the wrong transaction — see ShopwareAp2CheckoutMandateVerifier.
   */
  readonly checkoutTerms?:
    | {
        readonly checkoutId: string;
        /** Major currency units (29.99 means €29.99) — converted to minor units below. */
        readonly totalAmount: number;
        readonly currency: string;
      }
    | undefined;
}

/** ISO 4217 currencies with no minor unit (amounts are already whole). */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK']);

function toMinorUnits(amount: number, currency: string): number {
  const exponent = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;

  return Math.round(amount * 10 ** exponent);
}

interface SigningKey {
  readonly privateKey: KeyObject;
  readonly keyId: string;
  readonly jwk: {
    readonly kty: 'EC';
    readonly crv: 'P-256';
    readonly x: string;
    readonly y: string;
  };
}

let signingKey: SigningKey | undefined;

function getSigningKey(): SigningKey {
  if (!signingKey) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = publicKey.export({ format: 'jwk' });

    if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
      throw new Error('Generated EC P-256 public key JWK is missing x/y coordinates');
    }

    signingKey = {
      privateKey,
      keyId: `demo-buyer-platform-${randomUUID()}`,
      jwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
    };
  }

  return signingKey;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function signJwt(claims: Record<string, unknown>): string {
  const { privateKey, keyId, jwk } = getSigningKey();
  const encodedHeader = base64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: keyId, jwk }));
  const encodedPayload = base64url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign('sha256', Buffer.from(signingInput), { key: privateKey });

  return `${signingInput}.${base64url(signature)}`;
}

export function createAp2Mandate(input: Ap2MandateInput): Ap2Mandate {
  const issuedAt = Math.floor(Date.now() / 1000);
  const terms = input.checkoutTerms;

  return {
    checkoutMandate: signJwt({
      iss: 'demo-buyer-platform',
      sub: input.contextId ?? 'pending',
      typ: 'checkout_mandate',
      iat: issuedAt,
      exp: issuedAt + 300,
      ...(terms
        ? {
            checkout_id: terms.checkoutId,
            currency: terms.currency,
            total: {
              amount: toMinorUnits(terms.totalAmount, terms.currency),
              currency: terms.currency,
            },
          }
        : {}),
    }),
  };
}

export function describeMandateToken(token: string): string {
  return token.length > 24 ? `${token.slice(0, 12)}…${token.slice(-8)}` : token;
}
