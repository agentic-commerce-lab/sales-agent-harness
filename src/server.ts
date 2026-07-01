import { createConfiguredSalesAgentHarnessApp } from './app/bootstrap.js';
import { createSalesAgentHttpHandler } from './app/http-handler.js';
import { createUcpPlatformProfile } from './commerce/ucp/ucp-platform-profile.js';

const { app, environment } = await createConfiguredSalesAgentHarnessApp();
const handler = createSalesAgentHttpHandler({
  app,
  ...(environment.commerce.ucpAgentProfileUrl &&
  environment.commerce.ucpSigningKeyId &&
  environment.commerce.ucpSigningPrivateKeyJwk
    ? {
        ucpPlatformProfile: createUcpPlatformProfile({
          profileUrl: environment.commerce.ucpAgentProfileUrl,
          signingKeyId: environment.commerce.ucpSigningKeyId,
          signingPrivateKeyJwk: environment.commerce.ucpSigningPrivateKeyJwk,
          allowInsecureProfileUrl: environment.commerce.ucpAllowInsecureProfileUrl,
        }),
      }
    : {}),
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
