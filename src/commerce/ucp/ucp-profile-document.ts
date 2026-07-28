const ucpVersion = '2026-04-08';

export interface UcpPlatformProfile {
  readonly ucp: {
    readonly version: typeof ucpVersion;
    readonly services: {
      readonly 'dev.ucp.shopping': readonly [
        {
          readonly transport: 'rest';
          readonly endpoint: string;
          readonly version: typeof ucpVersion;
          readonly spec: 'https://ucp.dev/specification/overview/';
          readonly schema: 'https://ucp.dev/2026-04-08/services/shopping/rest.openapi.json';
        },
      ];
    };
    readonly capabilities: {
      readonly 'dev.ucp.shopping.cart': readonly [UcpPlatformCapability];
      readonly 'dev.ucp.shopping.catalog': readonly [UcpPlatformCapability];
      readonly 'dev.ucp.shopping.checkout': readonly [UcpPlatformCapability];
      readonly 'dev.ucp.shopping.ap2_mandate': readonly [UcpPlatformCapability];
    };
  };
  readonly signing_keys: readonly [PublicEcJwk];
}

interface UcpPlatformCapability {
  readonly version: typeof ucpVersion;
  readonly spec: string;
  readonly schema: string;
  readonly extends?: readonly string[] | undefined;
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

export function createProfileDocument(
  endpoint: string,
  signingKey: PublicEcJwk,
): UcpPlatformProfile {
  return {
    ucp: {
      version: ucpVersion,
      services: {
        'dev.ucp.shopping': [
          {
            transport: 'rest',
            endpoint,
            version: ucpVersion,
            spec: 'https://ucp.dev/specification/overview/',
            schema: 'https://ucp.dev/2026-04-08/services/shopping/rest.openapi.json',
          },
        ],
      },
      capabilities: {
        'dev.ucp.shopping.cart': capability('cart'),
        'dev.ucp.shopping.catalog': capability('catalog'),
        'dev.ucp.shopping.checkout': capability('checkout'),
        // Negotiated fresh per request against the shop's own registered
        // capabilities (see DefaultCapabilityNegotiator in ucp-php-sdk) — the
        // shop only activates AP2 for a checkout when this intersects with
        // its own enabled capabilities and a registered mandate verifier.
        'dev.ucp.shopping.ap2_mandate': [
          {
            version: ucpVersion,
            spec: 'https://ucp.dev/latest/specification/ap2-mandates/',
            schema: 'https://ucp.dev/schemas/shopping/ap2-mandates.json',
            extends: ['dev.ucp.shopping.checkout'],
          },
        ],
      },
    },
    signing_keys: [signingKey],
  };
}

function capability(name: 'cart' | 'catalog' | 'checkout'): readonly [UcpPlatformCapability] {
  return [
    {
      version: ucpVersion,
      spec: `https://ucp.dev/specification/${name}/`,
      schema: `https://ucp.dev/schemas/shopping/${name}.json`,
    },
  ];
}
