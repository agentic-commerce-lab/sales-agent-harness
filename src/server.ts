import { createConfiguredSalesAgentHarnessApp } from './app/bootstrap.js';
import { createSalesAgentHttpHandler } from './app/http-handler.js';
import { createUcpPlatformProfile } from './commerce/shopware-ucp/ucp-platform-profile.js';

const { app, environment } = await createConfiguredSalesAgentHarnessApp();
const handler = createSalesAgentHttpHandler({
  app,
  ...(environment.shopware.ucpAgentProfileUrl &&
  environment.shopware.ucpSigningKeyId &&
  environment.shopware.ucpSigningPrivateKeyJwk
    ? {
        ucpPlatformProfile: createUcpPlatformProfile({
          profileUrl: environment.shopware.ucpAgentProfileUrl,
          signingKeyId: environment.shopware.ucpSigningKeyId,
          signingPrivateKeyJwk: environment.shopware.ucpSigningPrivateKeyJwk,
          allowInsecureProfileUrl: environment.shopware.ucpAllowInsecureProfileUrl,
        }),
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
