# Sales Agent Harness

Merchant-side Seller Agent Harness for controlled agentic commerce demos and experiments.

The MVP is a TypeScript service boundary that lets a merchant-controlled sales agent search products, retrieve product details, prepare carts, summarize carts, and create non-binding checkout handoffs. It does not place orders, execute payments, accept legal terms, negotiate discounts, or create binding quotes.

## Quick Start

Use this path when you want the fastest local smoke test against a real Shopware Store API.

### 1. Create a local environment file

Copy the example:

```bash
cp .env.example .env
```

Then fill in the real values in `.env`.

Create `.env` in the project root:

```bash
OPENAI_API_KEY=sk-...
SHOPWARE_BASE_URL=https://your-shop.example
SHOPWARE_STORE_API_ACCESS_KEY=store-api-access-key
SHOPWARE_DEFAULT_SALES_CHANNEL_ID=sales-channel-id
SHOPWARE_UCP_AGENT_PROFILE_URL=https://platform.example/.well-known/ucp
SHOPWARE_UCP_SIGNING_KEY_ID=platform-2026
SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK={"kty":"EC","crv":"P-256","kid":"platform-2026","x":"...","y":"...","d":"..."}
SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL=false
AGENT_RUNTIME_MODEL=gpt-5-mini
HOST=127.0.0.1
PORT=3000
```

Required values:

- `OPENAI_API_KEY`: OpenAI API key used by the Deep Agents runtime.
- `SHOPWARE_BASE_URL`: Shopware storefront base URL, without a trailing slash.
- `SHOPWARE_STORE_API_ACCESS_KEY`: Store API access key for the target sales channel.
- `SHOPWARE_DEFAULT_SALES_CHANNEL_ID`: sales channel ID used for sessions and handoff records.
- `SHOPWARE_UCP_AGENT_PROFILE_URL`: optional UCP platform profile URL used by the `ucp_shopware` adapter; defaults to `${SHOPWARE_BASE_URL}/.well-known/ucp`.
- `SHOPWARE_UCP_SIGNING_KEY_ID` and `SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK`: optional ES256 signing key pair for strict UCP request signing. Configure both together.
- `SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL`: set to `true` only for local HTTP Shopware dev-mode profile fetching. Production profile URLs must use HTTPS.

Optional values:

- `AGENT_CONFIG_PATH`, defaulting to `config/agents/demo-sales-agent.json`
- `AGENT_RUNTIME_MODEL`, defaulting to `gpt-5-mini`
- `AGENT_RUNTIME_PROVIDER`, currently `deep_agents`
- `COMMERCE_ADAPTER_PROVIDER`, `shopware` by default, or `ucp_shopware` for the Agentic Commerce UCP plugin adapter
- `HOST`, defaulting to `127.0.0.1`
- `PORT`, defaulting to `3000`

The service reads environment variables through typed config accessors.

### Commerce Adapter Choice

The default `shopware` adapter calls the Shopware Store API directly and keeps checkout handoff as a harness-owned opaque token. Use it when you want the smallest dependency surface or are testing against a plain Shopware Store API.

Set this when the Shopware Agentic Commerce plugin is installed and UCP is enabled for the target sales channel:

```bash
COMMERCE_ADAPTER_PROVIDER=ucp_shopware
```

With `ucp_shopware`, catalog/cart calls go through the plugin's UCP REST endpoints under `/ucp/v1`, and `prepareCheckoutHandoff` creates a UCP checkout session and returns the plugin-provided `continueUrl`. The harness still owns runtime orchestration, policy checks, tool exposure, response normalization, and audit logging.

For strict UCP, set `SHOPWARE_UCP_AGENT_PROFILE_URL` to the public HTTPS URL where this harness serves `/.well-known/ucp`, and configure `SHOPWARE_UCP_SIGNING_KEY_ID` plus `SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK`. The harness signs UCP REST requests with RFC 9421 `Signature-Input`/`Signature` headers and RFC 9530 `Content-Digest`, and the profile endpoint publishes only the public JWK under `signing_keys`.

Generate a local P-256 signing key with:

```bash
node -e "const {generateKeyPairSync}=require('crypto'); const {privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'}); const jwk=privateKey.export({format:'jwk'}); jwk.kid='platform-2026'; console.log(JSON.stringify(jwk));"
```

For local HTTP Shopware/UCP testing, the Shopware Agentic Commerce plugin must allow local profile fetching. In the Shopware container/environment, set:

```bash
SWAG_AGENTIC_COMMERCE_UCP_PROFILE_FETCHING_DEVELOPMENT_MODE=1
```

Without that Shopware setting, UCP calls fail with `Plain http is only allowed when profile fetching development mode is enabled.`

The Shopware UCP sales-channel config must also allow this unsigned local harness flow:

- `active: true`
- `enabledCapabilities` includes `catalog`, `cart`, and `checkout`
- `enabledTransports` includes `rest`; include `embedded` when using the embedded checkout fallback URL
- `signaturePolicy: "strict"` for signed UCP testing, or `"log"` only for local unsigned smoke tests
- `embeddedAllowedOrigins` and `embeddedFrameAncestors` include the storefront origin, for example `http://localhost`

For production, keep strict signature enforcement, use an HTTPS profile URL without redirects, and keep the private JWK only in server-side environment or secret storage.

### 2. Start with Docker

```bash
docker compose up --build
```

Expected output:

```text
Sales Agent Harness listening on http://0.0.0.0:3000
```

The service is available on the host at:

```text
http://127.0.0.1:3000
```

Stop it with:

```bash
docker compose down
```

### 3. Or start with Bun

Install dependencies:

```bash
bun install
```

If your shell does not load `.env` automatically, export the file before starting:

```bash
set -a
source .env
set +a
```

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

### 5. Open the example UI

Open this URL in a browser:

```text
http://127.0.0.1:3000/examples/customer-ui
```

The example UI lets you create a harness session through `/sessions` and send a customer chat message through `/chat`. It is intentionally small and uses the same public HTTP routes as a merchant-owned customer frontend.

### 6. Create a session

For the public customer/demo flow, do not provide a Shopware context token. The harness creates and stores the server-side commerce context for the session:

```bash
curl -X POST http://127.0.0.1:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"channel":"customer_ui","customerContext":{"region":"DE"}}'
```

Copy the returned `agentSessionId`. If a trusted merchant storefront or Shopware app already has a server-side context token, it may pass `shopwareContextToken` during session creation. The raw token is stored server-side and is never returned.

### 7. Send a chat message

```bash
curl -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","message":"Find waterproof jackets"}'
```

The Deep Agents runtime can call only the registered harness tools. The harness applies capability checks, policy checks, response filtering, and audit logging before returning commerce data.

### 8. Try a direct commerce call

Use this when you want to test the harness without waiting for model tool selection:

```bash
curl -X POST http://127.0.0.1:3000/commerce/customer \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","capability":"searchProducts","query":"jacket","limit":3}'
```

## Testing The Harness

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

Fast manual smoke test:

1. Start the service with real `OPENAI_API_KEY` and `SHOPWARE_*` values.
2. Call `GET /health` and expect `{"status":"ok"}`.
3. Create a session with `POST /sessions`.
4. Use the returned `agentSessionId` in `POST /chat`.
5. Use `POST /commerce/customer` to test deterministic commerce calls without model tool selection.
6. Use `POST /message:send` to test the A2A-compatible HTTP+JSON entrypoint.

## Testing With A Real AI Agent

Use this flow when you want to test the full path through LangGraph Deep Agents, OpenAI, harness tools, policy checks, and the Shopware Store API.

### 1. Prepare real credentials

Your `.env` must contain real values:

```bash
OPENAI_API_KEY=sk-...
AGENT_RUNTIME_MODEL=gpt-5-mini
SHOPWARE_BASE_URL=https://your-shop.example
SHOPWARE_STORE_API_ACCESS_KEY=store-api-access-key
SHOPWARE_DEFAULT_SALES_CHANNEL_ID=sales-channel-id
```

The Shopware sales channel should have visible products. For customer-facing tests, create a session without a `shopwareContextToken`; the harness creates one server-side. For storefront/app integrations that already have a trusted server-side context token, pass it during session creation and the harness forwards it to Shopware as `sw-context-token`.

### 2. Start the harness

Docker:

```bash
docker compose up --build
```

Bun:

```bash
set -a
source .env
set +a
bun run start
```

### 3. Create an agent session

```bash
curl -s -X POST http://127.0.0.1:3000/sessions \
  -H 'content-type: application/json' \
  -d '{
    "channel": "customer_ui",
    "customerContext": { "region": "DE" }
  }'
```

Copy the returned `agentSessionId`.

### 4. Ask a question that should require a tool call

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
- `toolCalls`: tool names the Deep Agent selected, such as `searchProducts` or `getProductDetails`.
- Product, price, and availability details only if Shopware returned them through the harness.

If `toolCalls` is empty, ask a more commerce-specific question, or check that the capability is enabled in `config/agents/demo-sales-agent.json`.

### 5. Test cart preparation

Use a real product ID from the product search response:

```bash
curl -s -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "agentSessionId": "session-id-from-create-session",
    "message": "Prepare a cart with 1 unit of product PRODUCT_ID and summarize the total. Do not place an order."
  }'
```

The agent may call `createCart`, `getCartSummary`, or `prepareCheckoutHandoff`, depending on the phrasing and enabled capabilities. The harness still blocks order placement, payment execution, legal-term acceptance, binding quotes, and custom discounts.

### 6. Test through A2A

```bash
curl -s -X POST http://127.0.0.1:3000/message:send \
  -H 'content-type: application/a2a+json' \
  -H 'A2A-Version: 1.0' \
  -d '{
    "message": {
      "messageId": "real-agent-msg-1",
      "role": "ROLE_USER",
      "parts": [{ "text": "Find waterproof jackets and recommend one under 100 EUR." }],
      "metadata": { "agentSessionId": "session-id-from-create-session" }
    }
  }'
```

The A2A response wraps the same real-agent output in a completed task. Commerce still flows through harness tools, not directly from the model to Shopware.

### Real-Agent Troubleshooting

- OpenAI authentication errors: verify `OPENAI_API_KEY` and `AGENT_RUNTIME_MODEL`.
- No tool calls: ask for a concrete commerce action, such as product search or cart preparation.
- Shopware `401` or `403`: verify the Store API access key and sales-channel mapping.
- Empty results: confirm products are visible in the configured Shopware sales channel.
- Policy block: check blocked products/categories, `maxItemQuantity`, `maxCartValue`, region, and enabled capabilities in the agent config file.
- Checkout handoff returns a harness `/agent-checkout` URL: use `COMMERCE_ADAPTER_PROVIDER=ucp_shopware` with the Agentic Commerce plugin if you want the plugin-generated UCP checkout `continueUrl` instead.

## A2A Connection

The service exposes an A2A-compatible HTTP+JSON surface for buyer-agent experiments:

- `GET /.well-known/agent-card.json`: discovery document with supported interface, capabilities, and commerce skill metadata.
- `POST /message:send`: buyer-agent message entrypoint using `application/a2a+json`.
- `POST /commerce/a2a`: harness-native commerce capability endpoint for direct A2A commerce tests.

An A2A buyer agent should discover the seller through the Agent Card:

```bash
curl http://127.0.0.1:3000/.well-known/agent-card.json
```

Then send a message with the existing harness `agentSessionId` in message metadata:

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

The response is a completed A2A task with an agent message and response artifact. The harness still owns all commerce execution: A2A traffic goes through the same chat runtime, typed tools, policy checks, Shopware adapter, response filtering, and audit log as the customer UI.

### Fast Troubleshooting

- `Missing OPENAI_API_KEY`: set `OPENAI_API_KEY` and restart the service.
- `Missing SHOPWARE_*`: set all required Shopware variables and restart the service.
- `401` or `403` from Shopware: verify the Store API access key belongs to the configured sales channel.
- Empty product results: verify the Shopware sales channel has visible products and the query matches catalog data.
- Session not found: create a fresh session and reuse the returned `agentSessionId`.
- Checkout handoff URL is a harness opaque-token URL: use `COMMERCE_ADAPTER_PROVIDER=ucp_shopware` when the Agentic Commerce plugin should own the UCP checkout continuation URL.

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

For extension guidance, see [docs/extending.md](docs/extending.md).

## MVP Capabilities

Enabled capabilities are configured per agent in `config/agents/demo-sales-agent.json`:

- `searchProducts`
- `getProductDetails`
- `createCart`
- `updateCart`
- `getCartSummary`
- `prepareCheckoutHandoff`
- `completeCheckout` for explicitly enabled UCP-only automated checkout

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
    "allowCheckoutCompletion": false,
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

## Running Locally

Set the runtime and Shopware environment:

```bash
export OPENAI_API_KEY=...
export SHOPWARE_BASE_URL=https://your-shop.example
export SHOPWARE_STORE_API_ACCESS_KEY=...
export SHOPWARE_DEFAULT_SALES_CHANNEL_ID=...
export SHOPWARE_UCP_AGENT_PROFILE_URL=https://platform.example/.well-known/ucp
export SHOPWARE_UCP_SIGNING_KEY_ID=platform-2026
export SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK='{"kty":"EC","crv":"P-256","x":"...","y":"...","d":"...","kid":"platform-2026"}'
export SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL=false
```

Optional environment:

- `AGENT_CONFIG_PATH`, defaulting to `config/agents/demo-sales-agent.json`
- `AGENT_RUNTIME_MODEL`, defaulting to `gpt-5-mini`
- `AGENT_RUNTIME_PROVIDER`, currently `deep_agents`
- `COMMERCE_ADAPTER_PROVIDER`, `shopware` by default, or `ucp_shopware`
- `SHOPWARE_UCP_SIGNING_KEY_ID` and `SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK`, required together for strict signed UCP requests
- `SHOPWARE_UCP_ALLOW_INSECURE_PROFILE_URL`, local-only escape hatch for HTTP profile URLs when Shopware plugin development mode is enabled
- `HOST`, defaulting to `127.0.0.1`
- `PORT`, defaulting to `3000`

Start the service:

```bash
bun run start
```

Create a session. The customer-facing path does not require a Shopware context token:

```bash
curl -X POST http://127.0.0.1:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"channel":"customer_ui","customerContext":{"region":"DE"}}'
```

Then send a chat message:

```bash
curl -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"session-id-from-create-session","message":"Find waterproof jackets"}'
```

The HTTP surface also exposes:

- `GET /health`
- `GET /examples/customer-ui`
- `GET /.well-known/agent-card.json`
- `POST /message:send`
- `POST /commerce/customer`
- `POST /commerce/a2a`
- `POST /handoff/validate`

The optional Shopware context token is accepted only at session creation from trusted merchant server/app integrations, stored server-side, sent to Store API as `sw-context-token`, and never returned in session, chat, handoff, or commerce responses. Customer-facing UIs should not ask the buyer for this token.

## Checkout Handoff

Checkout handoff is preparation only. With the default `shopware` adapter, the harness creates a short-lived opaque handoff token and returns a `continueUrl` like:

```text
https://shop.example.test/agent-checkout?h=handoff_...
```

Raw Shopware context tokens stay server-side in session and handoff stores.

With `COMMERCE_ADAPTER_PROVIDER=ucp_shopware`, the harness delegates handoff creation to the `ShopwareUcpAdapter`. That adapter reads the UCP cart, creates a UCP checkout session through the Agentic Commerce plugin, and returns the plugin's `continueUrl`, for example an embedded UCP checkout URL.

## Automated UCP Checkout

Automated selling is opt-in and only supported through the Shopware UCP adapter. To let the agent place a real order, configure all of the following:

- `COMMERCE_ADAPTER_PROVIDER=ucp_shopware` or `COMMERCE_ADAPTER_PROVIDER=shopware-ucp`
- include `completeCheckout` in the agent `enabledCapabilities`
- set `policies.allowCheckoutCompletion` to `true`
- keep `policies.requireHumanApprovalForCheckout` set to `false` for the demo flow

The `completeCheckout` tool requires `explicitBuyerConfirmation: true`, buyer details, and a complete shipping address. The harness first updates the UCP checkout session with:

```json
{
  "buyer": {
    "email": "buyer@example.test",
    "firstName": "Ada",
    "lastName": "Buyer",
    "phoneNumber": "+49123456789"
  },
  "fulfillment": {
    "type": "shipping",
    "shippingAddress": {
      "street": "Test Street 1",
      "zipcode": "12345",
      "city": "Berlin",
      "countryCode": "DE"
    }
  }
}
```

Then it calls:

```http
POST /ucp/v1/checkout-sessions/{checkoutId}/complete
```

This creates a real Shopware order through the Agentic Commerce plugin. Do not enable it for production unless buyer authorization, payment handling, order limits, idempotency, and audit review are acceptable for the target sales channel.

## Observability

Structured audit events cover sessions, user requests, agent responses, tool calls, policy decisions, Shopware calls, cart changes, blocked actions, errors, and checkout handoffs. Events include merchant, agent, session, channel, capability, policy decision, data source, and timestamp fields where applicable.

## Future Integrations

The MVP intentionally leaves these as future integrations:

- Shopware MCP admin, diagnostic, and backoffice workflows
- Checkout Gateway enforcement
- Payment authorization protocols
- Production-grade autonomous order placement with payment mandates and PSP tokenization
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
