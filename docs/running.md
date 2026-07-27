# Running The Harness

Use this page for local setup, smoke tests, real-agent testing, A2A testing, and troubleshooting.
The root [README](../README.md) keeps only the short quick start.

## Environment

Copy the example file:

```bash
cp .env.example .env
```

Required values:

- `OPENAI_API_KEY`: OpenAI API key used by the Deep Agents runtime.
- `SHOPWARE_BASE_URL`: Shopware storefront base URL, without a trailing slash.
- `SHOPWARE_STORE_API_ACCESS_KEY`: Store API access key for the target sales channel.
- `SHOPWARE_DEFAULT_SALES_CHANNEL_ID`: sales channel ID used for sessions and handoff records.

Common optional values:

- `AGENT_CONFIG_PATH`, defaulting to `config/agents/demo-sales-agent.json`
- `AGENT_RUNTIME_MODEL`, defaulting to `gpt-5-mini`
- `OPENAI_BASE_URL`, optional: points the runtime at any OpenAI-compatible endpoint instead of
  `api.openai.com`, reusing `OPENAI_API_KEY` as-is
- `AGENT_RUNTIME_PROVIDER`, currently `deep_agents`
- `COMMERCE_ADAPTER_PROVIDER`, `shopware` by default, or `ucp_shopware`
- `STORAGE_PROVIDER`, `memory` by default, or `sqlite`
- `SQLITE_DB_PATH`, defaulting to `data/sales-agent-harness.sqlite` when SQLite storage is enabled
- `HOST`, defaulting to `127.0.0.1`
- `PORT`, defaulting to `3000`
- `DEBUG_LOG_REQUEST_BODIES`, defaulting to `false`

To use OpenRouter instead of OpenAI directly:

```bash
OPENAI_API_KEY=sk-or-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
AGENT_RUNTIME_MODEL=openai/gpt-5-mini
```

Any OpenRouter-hosted model works, for example `anthropic/claude-3.5-sonnet` or
`google/gemini-2.5-pro`.

The service reads environment variables through typed config accessors. Do not read `process.env`
from application code outside those accessors.

## Start The Service

Docker:

```bash
docker compose up --build
```

Bun:

```bash
bun install
set -a
source .env
set +a
bun run start
```

Expected output:

```text
Sales Agent Harness listening on http://127.0.0.1:3000
```

When running through Docker, the process listens on `0.0.0.0:3000` inside the container and is
available on the host at `http://127.0.0.1:3000`.

## Smoke Test

Check health:

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"status":"ok"}
```

Open the example customer UI:

```text
http://127.0.0.1:3000/examples/customer-ui
```

Create a session. For the public customer/demo flow, do not provide a Shopware context token; the
harness creates and stores the server-side commerce context for the session.

```bash
curl -X POST http://127.0.0.1:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"channel":"customer_ui","customerContext":{"region":"DE"}}'
```

Copy the returned `agentSessionId`, then send a chat message:

```bash
curl -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","message":"Find waterproof jackets"}'
```

Use a direct commerce call when you want to test the harness without waiting for model tool
selection:

```bash
curl -X POST http://127.0.0.1:3000/commerce/customer \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","capability":"searchProducts","query":"jacket","limit":3}'
```

## HTTP Surface

- `GET /health`
- `GET /examples/customer-ui`
- `GET /.well-known/agent-card.json`
- `POST /sessions`
- `POST /chat`
- `POST /message:send`
- `POST /commerce/customer`
- `POST /commerce/a2a`
- `POST /handoff/validate`

The optional Shopware context token is accepted only at session creation from trusted merchant
server/app integrations, stored server-side, sent to Store API as `sw-context-token`, and never
returned in session, chat, handoff, or commerce responses.

## Testing With A Real AI Agent

Use this flow when you want to test the full path through LangGraph Deep Agents, OpenAI, harness
tools, policy checks, and the Shopware Store API.

Your `.env` must contain real values:

```bash
OPENAI_API_KEY=sk-...
AGENT_RUNTIME_MODEL=gpt-5-mini
SHOPWARE_BASE_URL=https://your-shop.example
SHOPWARE_STORE_API_ACCESS_KEY=store-api-access-key
SHOPWARE_DEFAULT_SALES_CHANNEL_ID=sales-channel-id
```

The Shopware sales channel should have visible products. For customer-facing tests, create a
session without a `shopwareContextToken`; the harness creates one server-side.

Ask a question that should require a tool call:

```bash
curl -s -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "agentSessionId": "session-id-from-create-session",
    "message": "Find three waterproof jackets and tell me which one is cheapest."
  }'
```

A successful real-agent response should include:

- `message`: the generated seller-agent response.
- `toolCalls`: tool names the Deep Agent selected, such as `searchProducts` or
  `getProductDetails`.
- Product, price, and availability details only if Shopware returned them through the harness.

For cart preparation, use a real product ID from the product search response:

```bash
curl -s -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "agentSessionId": "session-id-from-create-session",
    "message": "Prepare a cart with 1 unit of product PRODUCT_ID and summarize the total. Do not place an order."
  }'
```

## A2A Testing

The service exposes an A2A-compatible HTTP+JSON surface for buyer-agent experiments:

- `GET /.well-known/agent-card.json`: discovery document with supported interface, capabilities,
  and commerce skill metadata.
- `POST /message:send`: buyer-agent message entrypoint using `application/a2a+json`.
- `POST /commerce/a2a`: harness-native commerce capability endpoint for direct A2A commerce tests.

Discover the seller agent through the Agent Card:

```bash
curl http://127.0.0.1:3000/.well-known/agent-card.json
```

Send a message with the existing harness `agentSessionId` in message metadata:

```bash
curl -X POST http://127.0.0.1:3000/message:send \
  -H 'content-type: application/a2a+json' \
  -H 'A2A-Version: 1.0' \
  -d '{
    "message": {
      "messageId": "msg-1",
      "role": "ROLE_USER",
      "parts": [{ "text": "Find waterproof jackets" }],
      "metadata": { "agentSessionId": "session-id-from-create-session" }
    }
  }'
```

The response is a completed A2A task with an agent message and response artifact. Commerce still
flows through harness tools, not directly from the model to Shopware.

For a scripted two-agent demo, see the [A2A Buyer Agent Demo](../examples/a2a-demo/README.md).

## Test Commands

Run the full test suite:

```bash
bun test
```

Run the checks used for normal code changes:

```bash
bun run format:check
bun run lint
bun run typecheck
```

Run the full quality gate before sharing the branch:

```bash
bun run quality
```

## Troubleshooting

- Missing `OPENAI_API_KEY`: set `OPENAI_API_KEY` and restart the service.
- Missing `SHOPWARE_*`: set all required Shopware variables and restart the service.
- OpenAI authentication errors: verify `OPENAI_API_KEY` and `AGENT_RUNTIME_MODEL` — if using
  `OPENAI_BASE_URL` to reach an alternate provider, confirm that provider serves the configured
  model.
- No tool calls: ask for a concrete commerce action, such as product search or cart preparation.
- Shopware `401` or `403`: verify the Store API access key and sales-channel mapping.
- Empty results: confirm products are visible in the configured Shopware sales channel.
- Policy block: check blocked products/categories, `maxItemQuantity`, `maxCartValue`, region, and
  enabled capabilities in the agent config file.
- Session not found: create a fresh session and reuse the returned `agentSessionId`.
- Checkout handoff returns a harness `/agent-checkout` URL: use
  `COMMERCE_ADAPTER_PROVIDER=ucp_shopware` when the Agentic Commerce plugin should own the UCP
  checkout continuation URL.

## Research Preview Limits

Current known limits:

- A2A support covers discovery and `message:send`; it does not yet implement the full task
  lifecycle, streaming, cancellation, auth, or conformance test suite.
- Runtime runs are persisted as records and LangGraph checkpoints survive restarts, but active runs
  are still executed synchronously in-process rather than by a background worker queue.
- Full checkout is UCP-only and opt-in; payment authorization, PSP tokenization, fraud/risk
  controls, and buyer-auth proof are not implemented here.
- SQLite is the durable local store for demos; database migrations, backups, retention, and
  multi-instance locking strategy for production operation are not defined.
- The public `agentProfile` customizes identity and A2A card metadata, but it does not grant
  capabilities or override policy.
- No production authentication, rate limiting, tenant isolation hardening, or admin audit UI is
  included.
