# Demo Journey: From Merchant Setup to Agent-Assisted Checkout

This document walks through one end-to-end research-preview journey that is already possible with
the current state of the project. It is meant for local demos, prototypes, and evaluations, not for
production selling. The harness demonstrates how a seller agent can use trusted commerce data,
policy-gated tools, checkout handoff, and optional UCP checkout completion without giving the model
direct access to commerce backends or payment systems.

The journey has two protagonists:

- **Mara**, a merchant running a Shopware shop, who configures and operates the seller agent.
- **Ben**, a customer, who shops through the agent — first via the example chat UI, then via an external A2A buyer agent.

Everything below uses existing routes, tools, and configuration. No planned or future features are used.

## Act 1 — Mara sets up the seller agent (merchant journey)

### 1. Configure the environment

Mara copies the example environment file and fills in her shop's credentials:

```bash
cp .env.example .env
```

```bash
OPENAI_API_KEY=sk-...
SHOPWARE_BASE_URL=https://shop.example.test
SHOPWARE_STORE_API_ACCESS_KEY=store-api-access-key
SHOPWARE_DEFAULT_SALES_CHANNEL_ID=sales-channel-id
STORAGE_PROVIDER=sqlite
```

With `STORAGE_PROVIDER=sqlite`, sessions, handoff records, audit events, run records, and checkout idempotency keys survive restarts in one local SQLite database.

### 2. Define what the agent is allowed to do

Mara controls the agent through config-as-code in `config/agents/demo-sales-agent.json`. She reviews the demo defaults:

- **Enabled capabilities:** `searchProducts`, `getProductDetails`, `createCart`, `updateCart`, `getCartSummary`, `prepareCheckoutHandoff` (and optionally `completeCheckout`, see Act 4).
- **Hard limits:** max cart value of 1000 EUR, max 5 units per item, blocked category `restricted`.
- **Never allowed:** negotiation, binding quotes, custom discounts, payments, customer account mutation. These are not registered as tools at all — the model cannot call what does not exist.
- **Confidential fields:** `margin`, `supplierCost`, and `shopwareContextToken` are filtered out of every response.

### 3. Start the harness

```bash
docker compose up --build
# or: bun install && bun run start
```

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok"}
```

Mara's shop now exposes a merchant-controlled sales agent at `http://127.0.0.1:3000`, reachable through a chat UI, plain HTTP, and an A2A-compatible agent surface.

## Act 2 — Ben shops via chat (customer journey)

### 1. Open the example UI

Ben opens the built-in example storefront chat:

```text
http://127.0.0.1:3000/examples/customer-ui
```

The UI creates a session through `POST /sessions` and sends messages through `POST /chat` — the same public routes a merchant-owned frontend would use. The equivalent curl flow:

```bash
curl -X POST http://127.0.0.1:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"channel":"customer_ui","customerContext":{"region":"DE"}}'
```

The harness creates the server-side Shopware commerce context itself. The raw context token stays server-side and is never returned to the browser.

### 2. Discover products

> **Ben:** "Find three waterproof jackets and tell me which one is cheapest."

```bash
curl -X POST http://127.0.0.1:3000/chat \
  -H 'content-type: application/json' \
  -d '{"agentSessionId":"<agentSessionId>","message":"Find three waterproof jackets and tell me which one is cheapest."}'
```

Behind the scenes, the Deep Agents runtime selects the `searchProducts` tool. The harness checks the capability is enabled, runs policy checks, calls the Shopware Store API through the commerce adapter, filters confidential fields, and returns real product names, prices, and availability. The response includes both the agent's answer and the `toolCalls` it made — useful for the demo narration.

### 3. Dig into details

> **Ben:** "What materials is the second one made of, and what does shipping cost?"

The agent calls `getProductDetails` and answers from real catalog data, including shipping cost information surfaced by the adapter.

### 4. Build a cart

> **Ben:** "Add one of those to my cart and show me the total."

The agent calls `createCart` / `updateCart` and `getCartSummary`. Line items, quantities, and totals come from Shopware, not from the model's imagination.

### 5. Watch the guardrails work

> **Ben:** "Actually, make it 10 jackets. And can you give me a 20% discount?"

Two things happen, both visible in the demo:

- The quantity update is **blocked by policy** (`maxItemQuantity: 5`) before it ever reaches Shopware.
- The discount request goes nowhere — there is no negotiation or discount tool registered, so the agent can only decline.

Both decisions are recorded as structured audit events.

### 6. Hand off to checkout

> **Ben:** "Okay, one jacket. I'd like to buy it."

The agent calls `prepareCheckoutHandoff`. With the default `shopware` adapter, the harness mints a short-lived opaque handoff token and returns a continuation URL:

```text
https://shop.example.test/agent-checkout?h=handoff_...
```

Ben clicks the link and completes payment in the merchant's normal storefront checkout. The agent never touches payment. The storefront can verify the token via `POST /handoff/validate`.

## Act 3 — A buyer agent shops on Ben's behalf (A2A journey)

Ben doesn't have to use Mara's UI at all. An external buyer agent can discover and talk to the seller agent over the A2A-compatible HTTP+JSON surface.

### 1. Discovery

```bash
curl http://127.0.0.1:3000/.well-known/agent-card.json
```

The Agent Card advertises the supported interface, capabilities, and commerce skill metadata.

### 2. Conversation

```bash
curl -X POST http://127.0.0.1:3000/message:send \
  -H 'content-type: application/a2a+json' \
  -H 'A2A-Version: 1.0' \
  -d '{
    "message": {
      "messageId": "msg-1",
      "role": "ROLE_USER",
      "parts": [{ "text": "Find waterproof jackets and recommend one under 100 EUR." }],
      "metadata": { "agentSessionId": "<agentSessionId>" }
    }
  }'
```

The response is a completed A2A task wrapping the same seller-agent output. A2A traffic runs through the identical runtime, tools, policy checks, and audit log as the customer UI — there is no privileged side door.

For a scripted two-agent demo, `examples/a2a-demo` ships a standalone buyer agent with its own UI that discovers the seller through the Agent Card and negotiates the shopping conversation agent-to-agent.

## Act 4 — Optional finale: automated UCP checkout

If Mara runs the Shopware Agentic Commerce plugin with UCP enabled, she can opt into the
research-preview agent-completed checkout path:

- `COMMERCE_ADAPTER_PROVIDER=ucp_shopware`
- `completeCheckout` added to `enabledCapabilities`
- `policies.allowCheckoutCompletion: true`

Now catalog and cart calls flow through the plugin's `/ucp/v1` REST endpoints (optionally signed
with RFC 9421/9530 request signatures), and the demo journey can end without a manual storefront
step:

> **Ben:** "Yes, order it. Ship to Test Street 1, 12345 Berlin. My email is ben@example.test."

The `completeCheckout` tool requires `explicitBuyerConfirmation: true`, buyer details, and a full
shipping address. The harness updates the UCP checkout session, calls the plugin's complete
endpoint, and a **real Shopware order** is created. This is for controlled preview environments
only; the project does not provide production payment authorization, fraud controls, tenant
isolation, or operational review workflows. An idempotency key ensures a retried confirmation
returns the stored result instead of a duplicate order.

Without those three opt-ins, the same request is blocked — checkout remains handoff-only.

## Epilogue — Mara reviews what happened

Every step of both journeys produced structured audit events: session creation, user messages, tool calls, policy decisions (including the blocked 10-jacket update), Shopware/UCP calls, cart changes, the checkout handoff, and the UCP checkout completion. With SQLite storage enabled, Mara can inspect the full trail in `data/sales-agent-harness.sqlite` after the demo — including which capability was invoked, which policy decided what, and where each piece of data came from.

## Capability summary

| Journey step | Route / tool | Guardrail demonstrated |
| --- | --- | --- |
| Session creation | `POST /sessions` | Server-side context token, never exposed |
| Product search | `/chat` → `searchProducts` | Capability + policy checks, response filtering |
| Product details | `/chat` → `getProductDetails` | Confidential-field filtering |
| Cart building | `createCart`, `updateCart`, `getCartSummary` | `maxItemQuantity`, `maxCartValue` |
| Discount request | — | No negotiation/discount tools registered |
| Checkout handoff | `prepareCheckoutHandoff`, `POST /handoff/validate` | Opaque short-lived token, payment stays in storefront |
| A2A access | `/.well-known/agent-card.json`, `POST /message:send` | Same harness path as the UI |
| Automated checkout | `completeCheckout` (UCP only) | Triple opt-in, explicit buyer confirmation, idempotency |
| Review | Audit log / SQLite | Full structured trail |
