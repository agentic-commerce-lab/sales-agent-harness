# Sales Agent Harness

Sales Agent Harness is a merchant-side research preview for controlled agentic commerce
experiments. It lets a merchant run a seller agent that can answer catalog questions, prepare
carts, and create checkout handoffs through trusted commerce systems instead of letting a model
invent product, price, stock, or checkout data.

This is not a production selling system. It is intended for local demos, prototypes, evaluations,
and protocol research. It does not include production authentication, tenant isolation, rate
limiting, payment authorization, fraud controls, compliance review, admin operations, or an
operations-grade persistence and deployment model.

## What It Does

- Searches products from trusted commerce data.
- Retrieves product details, prices, availability, and delivery information when the adapter
  returns it.
- Creates and updates cart drafts or carts through the configured commerce adapter.
- Summarizes cart totals, line items, and shipping costs.
- Prepares checkout handoff URLs using opaque harness tokens or adapter-owned UCP checkout
  sessions.
- Completes checkout only in the explicit UCP research path, when the capability and merchant
  policy are both enabled and buyer confirmation data is present.
- Exposes the same controlled flow through a customer chat UI, direct HTTP commerce routes, and an
  A2A-compatible HTTP+JSON surface.

## What It Does Not Do

- Uncontrolled autonomous selling.
- Payment execution outside an explicitly supported, merchant-approved checkout completion flow.
- Legal-term acceptance on behalf of the buyer.
- Binding quotes, custom discount negotiation, or customer account mutation.
- Direct model access to Shopware, Store API, UCP, MCP, PSPs, or other commerce systems.

## Quick Start

Use this path for a local smoke test against a real Shopware Store API.

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Fill in the required values:

   ```bash
   OPENAI_API_KEY=sk-...
   SHOPWARE_BASE_URL=https://your-shop.example
   SHOPWARE_STORE_API_ACCESS_KEY=store-api-access-key
   SHOPWARE_DEFAULT_SALES_CHANNEL_ID=sales-channel-id
   AGENT_RUNTIME_MODEL=gpt-5-mini
   STORAGE_PROVIDER=sqlite
   SQLITE_DB_PATH=data/sales-agent-harness.sqlite
   HOST=127.0.0.1
   PORT=3000
   ```

3. Start with Docker:

   ```bash
   docker compose up --build
   ```

   Or start with Bun:

   ```bash
   bun install
   set -a
   source .env
   set +a
   bun run start
   ```

4. Check health:

   ```bash
   curl http://127.0.0.1:3000/health
   ```

5. Open the example UI:

   ```text
   http://127.0.0.1:3000/examples/customer-ui
   ```

6. Create a session and send a chat message:

   ```bash
   curl -X POST http://127.0.0.1:3000/sessions \
     -H 'content-type: application/json' \
     -d '{"channel":"customer_ui","customerContext":{"region":"DE"}}'

   curl -X POST http://127.0.0.1:3000/chat \
     -H 'content-type: application/json' \
     -d '{"agentSessionId":"session-id-from-create-session","message":"Find waterproof jackets"}'
   ```

For the full local runbook, real-agent test flow, endpoint list, and troubleshooting, see
[Running The Harness](docs/running.md).

## Documentation

- [Running The Harness](docs/running.md): environment variables, Docker/Bun startup, smoke tests,
  real-agent testing, A2A requests, and troubleshooting.
- [Configuration](docs/configuration.md): agent profile, capability flags, policy config, commerce
  adapter choice, UCP profile signing, and runtime/storage settings.
- [Architecture](docs/architecture.md): request flow, module boundaries, runtime boundary, commerce
  adapter boundary, and persistence structure.
- [Checkout And UCP](docs/checkout.md): checkout handoff, automated UCP checkout, idempotency, and
  non-production full-checkout testing.
- [Observability](docs/observability.md): audit events, SQLite persistence, LangGraph checkpoints,
  and exported store classes.
- [Demo Journey](docs/demo-journey.md): a narrated merchant, customer, and A2A buyer-agent demo.
- [Extending The Harness](docs/extending.md): how to add adapters, capabilities, policy rules,
  runtimes, routes, storage, and observability sinks without bypassing the harness.
- [A2A Buyer Agent Demo](examples/a2a-demo/README.md): standalone buyer-agent UI for local
  agent-to-agent experiments.

## Development

Install dependencies:

```bash
bun install
```

Run focused tests:

```bash
bun test
```

Run the standard checks:

```bash
bun run format:check
bun run lint
bun run typecheck
```

Run architecture and quality checks:

```bash
bun run quality:fallow
bun run quality:health
bun run quality
```

CI remains the final authority.

## Research Preview Limits

Current known limits are tracked in [Running The Harness](docs/running.md#research-preview-limits).
The short version: A2A support is intentionally narrow, checkout completion is UCP-only and opt-in,
SQLite is for durable local demos, and this repository does not include production authentication,
tenant isolation, payment authorization, fraud controls, or an admin audit UI.
