# Sales Agent Harness

Merchant-side Seller Agent Harness for controlled agentic commerce demos and experiments.

The MVP is a TypeScript service boundary that lets a merchant-controlled sales agent search products, retrieve product details, prepare carts, summarize carts, and create non-binding checkout handoffs. It does not place orders, execute payments, accept legal terms, negotiate discounts, or create binding quotes.

## Architecture

The harness keeps conversation orchestration separate from commerce execution:

```text
Customer UI / A2A Buyer Agent
        |
        v
Customer API / A2A API
        |
        v
Replaceable Agent Runtime
        |
        v
Seller Agent Harness Core
        |
        v
CommerceAdapter
        |
        v
Shopware Store API
```

LangGraph Deep Agents are implemented behind the replaceable runtime boundary in `src/runtime/langgraph/`. Runtime-specific code must not be imported into `src/harness`, `src/commerce`, `src/policy`, or `src/contracts`.

Shopware is the first commerce backend through the platform-neutral `CommerceAdapter` contract. The agent runtime, customer API, and A2A API call the harness only; they never call Shopware directly.

## MVP Capabilities

Enabled capabilities are configured per agent in `config/agents/demo-sales-agent.json`:

- `searchProducts`
- `getProductDetails`
- `createCart`
- `updateCart`
- `getCartSummary`
- `prepareCheckoutHandoff`

Disabled capabilities are not registered as tools. Policy checks run before every commerce action, and blocked or escalated actions do not call the adapter.

## Configuration

Agent and merchant policy configuration is config-as-code JSON:

```json
{
  "agentId": "demo-sales-agent",
  "merchantId": "demo-shopware-merchant",
  "enabledCapabilities": ["searchProducts", "getProductDetails"],
  "policies": {
    "allowedChannels": ["customer_ui", "a2a"],
    "blockedCategories": [],
    "blockedProducts": [],
    "maxCartValue": { "amount": 1000, "currency": "EUR" },
    "maxItemQuantity": 5,
    "allowCheckoutHandoff": true,
    "requireHumanApprovalForCheckout": false,
    "unsupportedRegions": [],
    "confidentialFields": ["shopwareContextToken", "margin"]
  }
}
```

Shopware environment access is centralized in `src/env/shopware-config.ts`:

- `SHOPWARE_BASE_URL`
- `SHOPWARE_STORE_API_ACCESS_KEY`
- `SHOPWARE_DEFAULT_SALES_CHANNEL_ID`

Deep Agents/OpenAI runtime access is centralized in `src/env/agent-runtime-config.ts`:

- `OPENAI_API_KEY`
- `AGENT_RUNTIME_MODEL`, defaulting to `gpt-5-mini`

Do not read `process.env` from application code outside typed config accessors.

## Deep Agents Runtime

Create executable harness tools from a config and `HarnessCore`, then pass them into the Deep Agents runtime:

```ts
const tools = createExecutableToolRegistry(agentConfig, harnessCore);
const runtimeConfig = loadAgentRuntimeEnvironmentConfig();
const runtime = createLangGraphDeepAgentRuntime({
  apiKey: runtimeConfig.apiKey,
  modelName: runtimeConfig.modelName,
  tools,
});
```

The runtime uses `deepagents` with `ChatOpenAI` and LangChain structured tools. Tool calls receive the active `agentSessionId` from the runtime request and delegate back into the harness. The model never receives direct Shopware, Store API, UCP, MCP, or adapter access.

## Quick Start

Use this path when you want the fastest local smoke test against a real Shopware Store API.

### 1. Install dependencies

```bash
bun install
```

### 2. Create a local environment file

Create `.env` in the project root:

```bash
OPENAI_API_KEY=sk-...
SHOPWARE_BASE_URL=https://your-shop.example
SHOPWARE_STORE_API_ACCESS_KEY=store-api-access-key
SHOPWARE_DEFAULT_SALES_CHANNEL_ID=sales-channel-id
AGENT_RUNTIME_MODEL=gpt-5-mini
HOST=127.0.0.1
PORT=3000
```

Required values:

- `OPENAI_API_KEY`: OpenAI API key used by the Deep Agents runtime.
- `SHOPWARE_BASE_URL`: Shopware storefront base URL, without a trailing slash.
- `SHOPWARE_STORE_API_ACCESS_KEY`: Store API access key for the target sales channel.
- `SHOPWARE_DEFAULT_SALES_CHANNEL_ID`: sales channel ID used for sessions and handoff records.

Optional values:

- `AGENT_CONFIG_PATH`, defaulting to `config/agents/demo-sales-agent.json`
- `AGENT_RUNTIME_MODEL`, defaulting to `gpt-5-mini`
- `AGENT_RUNTIME_PROVIDER`, currently `deep_agents`
- `COMMERCE_ADAPTER_PROVIDER`, currently `shopware`
- `HOST`, defaulting to `127.0.0.1`
- `PORT`, defaulting to `3000`

The service reads environment variables through typed config accessors. If your shell does not load `.env` automatically, export the file before starting:

```bash
set -a
source .env
set +a
```

### 3. Start the service

```bash
bun run start
```

Expected output:

```text
Sales Agent Harness listening on http://127.0.0.1:3000
```

### 4. Check health

In another terminal:

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"status":"ok"}
```

### 5. Create a session

Use a server-side Shopware context token from the merchant storefront or app context:

```bash
curl -X POST http://127.0.0.1:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"channel":"customer_ui","shopwareContextToken":"server-side-context-token","customerContext":{"region":"DE"}}'
```

Copy the returned `agentSessionId`. The raw Shopware context token is stored server-side and is not returned.

### 6. Send a chat message

```bash
curl -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","message":"Find waterproof jackets"}'
```

The Deep Agents runtime can call only the registered harness tools. The harness applies capability checks, policy checks, response filtering, and audit logging before returning commerce data.

### 7. Try a direct commerce call

Use this when you want to test the harness without waiting for model tool selection:

```bash
curl -X POST http://127.0.0.1:3000/commerce/customer \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","capability":"searchProducts","input":{"query":"jacket","limit":3}}'
```

### Fast Troubleshooting

- `Missing OPENAI_API_KEY`: set `OPENAI_API_KEY` and restart the service.
- `Missing SHOPWARE_*`: set all required Shopware variables and restart the service.
- `401` or `403` from Shopware: verify the Store API access key belongs to the configured sales channel.
- Empty product results: verify the Shopware sales channel has visible products and the query matches catalog data.
- Session not found: create a fresh session and reuse the returned `agentSessionId`.
- Checkout handoff URL is returned but not usable in a storefront yet: the harness side exists; the Shopware app page that resolves the opaque token and redirects to checkout is future integration work.

## Running Locally

Set the runtime and Shopware environment:

```bash
export OPENAI_API_KEY=...
export SHOPWARE_BASE_URL=https://your-shop.example
export SHOPWARE_STORE_API_ACCESS_KEY=...
export SHOPWARE_DEFAULT_SALES_CHANNEL_ID=...
```

Optional environment:

- `AGENT_CONFIG_PATH`, defaulting to `config/agents/demo-sales-agent.json`
- `AGENT_RUNTIME_MODEL`, defaulting to `gpt-5-mini`
- `AGENT_RUNTIME_PROVIDER`, currently `deep_agents`
- `COMMERCE_ADAPTER_PROVIDER`, currently `shopware`
- `HOST`, defaulting to `127.0.0.1`
- `PORT`, defaulting to `3000`

Start the service:

```bash
bun run start
```

Create a session with a server-side Shopware context token from the merchant storefront/app context:

```bash
curl -X POST http://127.0.0.1:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"channel":"customer_ui","shopwareContextToken":"server-side-context-token","customerContext":{"region":"DE"}}'
```

Then send a chat message:

```bash
curl -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","message":"Find waterproof jackets"}'
```

The HTTP surface also exposes:

- `GET /health`
- `POST /commerce/customer`
- `POST /commerce/a2a`
- `POST /a2a/messages`
- `POST /handoff/validate`

The Shopware context token is accepted only at session creation, stored server-side, sent to Store API as `sw-context-token`, and never returned in session, chat, handoff, or commerce responses.

## Checkout Handoff

Checkout handoff is preparation only. The harness creates a short-lived opaque handoff token and returns a `continueUrl` like:

```text
https://shop.example.test/agent-checkout?h=handoff_...
```

Raw Shopware context tokens stay server-side in session and handoff stores. A future Shopware app page can resolve the opaque token, recreate the prepared cart in the customer context through Context Gateway, and redirect the customer to merchant-controlled checkout.

## Observability

Structured audit events cover sessions, user requests, agent responses, tool calls, policy decisions, Shopware calls, cart changes, blocked actions, errors, and checkout handoffs. Events include merchant, agent, session, channel, capability, policy decision, data source, and timestamp fields where applicable.

## Future Integrations

The MVP intentionally leaves these as future integrations:

- Shopware UCP protocol execution
- Shopware MCP admin, diagnostic, and backoffice workflows
- Checkout Gateway enforcement
- Payment authorization protocols
- Autonomous order placement
- Binding quotes
- Custom discount negotiation
- Customer account mutation
- Additional ecommerce adapters beyond Shopware

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
