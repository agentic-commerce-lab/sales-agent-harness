import { createConfiguredSalesAgentHarnessApp } from './app/bootstrap.js';
import { createSalesAgentHttpHandler } from './app/http-handler.js';

const { app, environment } = await createConfiguredSalesAgentHarnessApp();
const handler = createSalesAgentHttpHandler({ app });

Bun.serve({
  hostname: environment.host,
  port: environment.port,
  fetch: (request) => handler.handle(request),
});

process.stdout.write(
  `Sales Agent Harness listening on http://${environment.host}:${environment.port}\n`,
);
