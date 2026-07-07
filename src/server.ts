import { createConfiguredSalesAgentHarnessApp } from './app/bootstrap.js';
import { createSalesAgentHttpHandler } from './app/http-handler.js';
import { createUcpPlatformProfile } from './commerce/ucp/ucp-platform-profile.js';

const { app, agentConfig, environment } = await createConfiguredSalesAgentHarnessApp();

const ucpPlatformProfile = (() => {
  const {
    ucpAgentProfileUrl,
    ucpSigningKeyId,
    ucpSigningPrivateKeyJwk,
    ucpAllowInsecureProfileUrl,
  } = environment.commerce;
  if (!ucpAgentProfileUrl) return undefined;
  if (ucpSigningKeyId && ucpSigningPrivateKeyJwk) {
    return createUcpPlatformProfile({
      profileUrl: ucpAgentProfileUrl,
      signingKeyId: ucpSigningKeyId,
      signingPrivateKeyJwk: ucpSigningPrivateKeyJwk,
      allowInsecureProfileUrl: ucpAllowInsecureProfileUrl,
    });
  }
  // No signing keys configured — serve a minimal unsigned profile so Shopware
  // can fetch it without requiring HTTP signatures on UCP requests.
  return { ucp: { version: '2026-04-08' as const, capabilities: {} } };
})();

const handler = createSalesAgentHttpHandler({
  app,
  agentConfig,
  debugLogRequestBodies: environment.debugLogRequestBodies,
  ...(ucpPlatformProfile ? { ucpPlatformProfile } : {}),
  ...(environment.commerce.storeApiAccessKey
    ? {
        checkoutResume: {
          shopwareBaseUrl: environment.commerce.baseUrl,
          shopwareAccessKey: environment.commerce.storeApiAccessKey,
        },
      }
    : {}),
});

Bun.serve({
  hostname: environment.host,
  port: environment.port,
  fetch: (request) => handler.handle(request),
});

process.stdout.write(
  `Sales Agent Harness listening on http://${environment.host}:${environment.port}\n`,
);
