# Architecture

This document describes how the Sales Agent Harness is put together today: the layers, the
contracts between them, and which components are designed to be swapped out. For step-by-step
instructions on how to perform a swap, see [docs/extending.md](extending.md). For the product
rules behind these boundaries, see `specs/` and `AGENTS.md`.

## Design principle

The sales-agent runtime (the LLM/tool-calling loop) and commerce execution (talking to a real
storefront backend) are deliberately kept apart. Everything commercial — policy, capability
gating, normalization, secrets, audit — lives in the harness core, not in the runtime and not in
the transport layer. The runtime only ever sees typed tools; it never holds a Shopware token, a
UCP client, or a database handle.

```text
Customer UI / A2A Buyer Agent
        |
        v
Transport: HTTP + A2A (src/app, src/api)
        |
        v
AgentRuntime  (src/runtime/*)            <-- swappable
        |
        v
HarnessCore  (src/harness/*)             <-- fixed control layer
        |
        v
PolicyDecision  (src/policy/*)
        |
        v
CommerceAdapter  (src/commerce/*)        <-- swappable
        |
        v
Commerce backend (Shopware Store API, UCP, ...)
```

`HarnessCore` is the only thing allowed to call `PolicyEngine` and `CommerceAdapter`. The runtime
and the HTTP/A2A layers call `HarnessCore` (or the executable tool registry built on top of it)
and nothing below it.

## Layers

### Transport — `src/app`, `src/api`

Thin, stateless request/response glue. Owns HTTP routing, Zod input parsing, A2A envelope
shaping, and response-shape safety (never leaking backend tokens).

- `src/app/http-handler.ts` — the single `fetch` entrypoint (`Bun.serve` calls into it from
  `src/server.ts`). Routes: `/health`, `/.well-known/agent-card.json`, `/.well-known/ucp`,
  `/examples/customer-ui`, `/checkout-resume`, and POST routes `/`, `/sessions`, `/chat`,
  `/message:send`, `/commerce/customer`, `/commerce/a2a`, `/handoff/validate`.
- `src/app/http-contracts.ts` — Zod schemas that validate transport input before it reaches the
  app layer.
- `src/app/sales-agent-app.ts` (+ `sales-agent-app-*.ts`) — composes a `SalesAgentHarnessApp`:
  wires config, adapter, stores, and the runtime factory into one object exposing
  `createSession`, `chat`, `validateCheckoutHandoff`, and the two commerce APIs.
- `src/api/customer-api.ts`, `src/api/a2a-api.ts`, `src/api/harness-api.ts` — deterministic,
  non-LLM commerce entrypoints (`CommerceApiRequest` → `HarnessCore` method) used by
  `/commerce/customer` and `/commerce/a2a`. The A2A variant strips the checkout handoff response
  down to `summary` + `continueUrl` only.
- `src/app/a2a-*.ts` — A2A agent card, message parsing/response shaping, protocol constants.

Transport code must not import from `src/commerce` or hold commerce secrets.

### Agent runtime — `src/runtime` — **swappable**

The conversational loop: takes a user message, decides which harness tools to call, and returns
a natural-language response plus the list of tool names it invoked.

```ts
// src/runtime/agent-runtime.ts
export interface AgentRuntime {
  respond(input: AgentRuntimeInput): Promise<AgentRuntimeResponse>;
}
```

`AgentRuntimeInput` carries `agentSessionId` and the message/history; `AgentRuntimeResponse` is
just `{ message, toolCalls }`. Everything provider-specific lives behind this interface.

Current implementation: `src/runtime/langgraph/` — LangGraph Deep Agents (`deepagents` +
`@langchain/openai`).

- `langgraph-runtime.ts` — implements `AgentRuntime`, using an `AsyncLocalStorage` to thread the
  current `agentSessionId` into tool execution.
- `langgraph-tooling.ts` — converts `ExecutableLangGraphRuntimeTool` (harness tool + Zod schema)
  into LangChain `StructuredToolInterface` values, and serializes harness `HarnessResponse`
  results (`ok` / `blocked` / `escalated`) back to the model as JSON strings.
- `langgraph-agent.ts` / `langgraph-response.ts` / `langgraph-types.ts` — graph construction and
  response normalization.

The factory boundary is `AgentRuntimeFactoryInput { tools }`. `src/app/bootstrap.ts` passes a
`runtimeFactory` closure into `createSalesAgentHarnessApp`, so the app layer never imports
LangGraph directly — it only calls whatever factory it was given.

### Harness core — `src/harness`

The fixed control layer. One method per capability
(`searchProducts`, `getProductDetails`, `createCart`, `updateCart`, `getCartSummary`,
`prepareCheckoutHandoff`, `completeCheckout`), each going through the same pipeline:

```text
HarnessCore.<capability>(input)
  -> HarnessExecutor.execute(capability, request, run, cartLimits?)
       -> load session (InMemorySessionStore)
       -> evaluatePolicy(...)            allow | block | escalate
       -> if allow: run(session) against CommerceAdapter
       -> normalize into HarnessResponse<T>
       -> recordAudit(...) / recordExecutorResult(...)
```

- `harness-core.ts` — the public class; injects `CommerceAdapter`, `AuditLogger`,
  `InMemoryHandoffStore`, `InMemorySessionStore`, and `checkoutHandoffMode`.
- `harness-executor.ts` / `harness-executor-run.ts` / `harness-executor-audit.ts` — the shared
  execute-policy-then-adapter-then-audit pipeline every capability method uses.
- `harness-commerce-context.ts` — attaches the session's `CommerceExecutionContext` (sales
  channel + server-side context token) to outgoing adapter calls; this is the only place raw
  backend tokens are reattached before an adapter call.
- `tool-registry.ts` / `executable-tool-registry.ts` / `cart-tool-definitions.ts` /
  `catalog-tool-definitions.ts` — build the list of tools exposed to the agent runtime from
  `config.enabledCapabilities`. Disabled capabilities are simply never constructed, so they never
  reach the model.
- `harness-types.ts`, `harness-errors.ts` — shared request/response and error shapes.

`HarnessResponse<T>` is always one of `{status:'ok', value:T}`,
`{status:'blocked'|'escalated', policyDecision}`, matching `PolicyDecision` from
`src/contracts/policy.ts`.

### Policy — `src/policy`

Pure, deterministic decision functions — no I/O, no adapter calls. `evaluate-policy.ts` runs a
fixed ordered chain of checks and returns on the first non-`allow` result:

```text
evaluateForbiddenAction   (MVP-forbidden actions, e.g. placeOrder, executePayment)
evaluateCapability        (is this capability enabled for the agent?)
evaluateChannel           (is the request channel allowed?)
evaluateProduct           (blocked category / blocked product)
evaluateCustomer          (unsupported region)
evaluateCart              (max item quantity, max cart value)
evaluateCheckout          (checkout handoff / completion allowed, human approval)
-> allow
```

Every decision carries a `PolicyAuditContext` (session, merchant, agent, channel, capability,
timestamp) so it can be logged regardless of outcome. `HarnessExecutor` calls this before ever
touching the adapter — a blocked/escalated decision never reaches `CommerceAdapter`.

### Commerce adapter — `src/commerce` — **swappable**

The only place that talks to a real commerce backend. All commerce types are backend-agnostic
(`src/contracts/commerce.ts`):

```ts
export interface CommerceAdapter {
  searchProducts(input: SearchProductsInput): Promise<ProductSearchResult>;
  getProductDetails(input: ProductDetailsInput): Promise<ProductDetailsResult>;
  createCart(input: CreateCartInput): Promise<CartResult>;
  updateCart(input: UpdateCartInput): Promise<CartResult>;
  getCartSummary(input: CartSummaryInput): Promise<CartResult>;
  prepareCheckoutHandoff(input: CheckoutHandoffInput): Promise<CheckoutHandoffResult>;
  completeCheckout(input: CompleteCheckoutInput): Promise<CompletedCheckoutResult>;
}
```

Two reference implementations exist today, selected by `COMMERCE_ADAPTER_PROVIDER`:

| Provider value | Class | Backend transport | Checkout handoff |
| --- | --- | --- | --- |
| `shopware` (default) | `ShopwareAdapter` (`src/commerce/shopware/`) | Shopware Store API, via `FetchShopwareStoreApiClient` | `local`: harness issues its own opaque handoff token |
| `ucp`, or the legacy aliases `ucp_shopware` / `shopware-ucp` | `UcpAdapter` (`src/commerce/ucp/`) | Shopware Agentic Commerce plugin's UCP REST endpoints (`/ucp/v1`), via `FetchUcpClient` | `adapter`: adapter creates a UCP checkout session and returns its own `continueUrl` |

Each adapter folder follows the same internal shape, which is the template for adding a new one:

1. A typed HTTP client boundary (`shopware-store-api-client.ts` / `ucp-client.ts`) — the only
   file that knows the backend's wire format.
2. Response parsers (`shopware-store-api-*-parsers.ts` / `ucp-product-parsers.ts`) that turn raw
   backend JSON into a backend-specific intermediate type.
3. A `normalize-*.ts` module that maps the backend-specific type onto the shared
   `ProductSummary` / `ProductDetails` / `CartSummary` contracts, stripping fields listed in
   `confidentialFields` (Shopware) or backend fields that were never meant to leave the adapter
   (UCP).
4. The adapter class itself, implementing `CommerceAdapter`, wrapping every client call in a
   domain-specific `Error` with `cause` set to the original error.

The UCP adapter additionally owns HTTP request signing (`ucp-http-signature.ts`, RFC 9421/9530)
and platform profile publishing (`ucp-platform-profile.ts`, served at `/.well-known/ucp`).

Adapters never evaluate policy — `evaluatePolicy` already ran before `HarnessCore` calls the
adapter. Adapters only execute already-approved operations and normalize the result.

### Contracts — `src/contracts`

Shared types with no runtime behavior: `commerce.ts` (adapter I/O), `config.ts`
(`AgentHarnessConfig`, capability enum, channel enum), `policy.ts` (`PolicyDecision` shape),
`session.ts` (`AgentSession`, `CommerceExecutionContext`). Nothing here imports from `src/runtime`
or `src/commerce`, so both can depend on contracts without depending on each other.

### Config — `src/config`, `src/env`

Two distinct kinds of configuration, kept apart:

- **Config-as-code** (`config/agents/*.json`, loaded by `src/config/load-agent-config.ts`):
  per-agent business configuration — enabled capabilities, policy limits, blocked
  categories/products, confidential fields, an optional `systemPromptFile`. Validated with Zod
  (`agentHarnessConfigSchema`) before use.
- **Environment** (`src/env/*.ts`): infrastructure config — API keys, base URLs, which provider
  to instantiate. `app-config.ts` composes `agent-runtime-config.ts` (OpenAI/model) and
  `commerce-config.ts` (Shopware/UCP endpoints and signing keys) and resolves the
  `AgentRuntimeProvider` / `CommerceAdapterProvider` enum values used for wiring.

`src/app/bootstrap.ts` is where both are read and turned into concrete instances — it is the one
file that imports both `ShopwareAdapter`/`UcpAdapter` and `createLangGraphDeepAgentRuntime`. This
is intentional: it is the composition root, and it is the only file that should need to change
when a *new* adapter or runtime provider is registered (see "Adding a seam" below).

### Session, handoff, and audit stores — `src/session`, `src/handoff`, `src/observability`

All three are in-memory today (`InMemorySessionStore`, `InMemoryHandoffStore`,
`InMemoryAuditLogger`, `InMemoryConversationStore`), each behind a small class with an explicit
public surface (`createSession`/`getSession`, `save`/`resolve`, `record`/`events`). They are
constructor-injected into `createSalesAgentHarnessApp` (see `CreateSalesAgentHarnessAppInput` in
`src/app/sales-agent-app-types.ts`), so replacing an in-memory store with a persistent one means
implementing the same class shape and passing it in — no call sites elsewhere change.

`AgentSession.commerceContext` holds the server-side-only `CommerceExecutionContext`
(`shopwareSalesChannelId` + `shopwareContextToken`). It is attached to adapter calls by
`withCommerceContext` and is never present in `PublicAgentSession`, chat responses, or audit
events.

## Request lifecycles

**Session creation** (`POST /sessions`): app layer creates an `AgentSession`, optionally stores a
caller-supplied `shopwareContextToken` server-side (trusted storefront/app integrations only), and
returns a `PublicAgentSession` with no token.

**Chat** (`POST /chat`): app layer loads the session, calls `AgentRuntime.respond`, which runs the
LangGraph agent; every tool the model calls is one of the `ExecutableHarnessToolDefinition`s built
from `config.enabledCapabilities`, so it always re-enters `HarnessCore` → policy → adapter →
normalize → audit before any result reaches the model.

**Direct commerce call** (`POST /commerce/customer`, `POST /commerce/a2a`): bypasses the LLM
entirely. `dispatchCommerceRequest` (`src/api/harness-api.ts`) maps a typed `CommerceApiRequest`
straight onto the matching `HarnessCore` method. Useful for deterministic testing and for A2A
callers that already know which capability they want.

**A2A message** (`POST /message:send`): parsed by `src/app/a2a-message.ts`, resolves the
`agentSessionId` from message metadata, and otherwise runs the same `chat` path as the customer
UI. Response is wrapped in an A2A task/artifact envelope.

**Checkout handoff**: `HarnessCore.prepareCheckoutHandoff` branches on `checkoutHandoffMode`:

- `local` (default, `shopware` provider): harness fetches the cart summary from the adapter,
  then `prepareCheckoutHandoff` (`src/handoff/`) creates a short-lived opaque token in
  `InMemoryHandoffStore` and returns a harness-owned `continueUrl`
  (`{storefrontBaseUrl}/agent-checkout?h=...`).
- `adapter` (`ucp` provider): harness delegates straight to `adapter.prepareCheckoutHandoff`,
  which creates a UCP checkout session and returns the plugin's own `continueUrl`.

`completeCheckout` is UCP-only today — `ShopwareAdapter.completeCheckout` always throws; only
`UcpAdapter` implements it, gated by `enabledCapabilities` + `policies.allowCheckoutCompletion`.

## Exchangeable components ("the seams")

These are the boundaries designed to be swapped without touching the layers above or below them.
Each is a constructor/factory parameter into `createSalesAgentHarnessApp`
(`src/app/sales-agent-app-types.ts`), wired concretely in `src/app/bootstrap.ts`.

| Seam | Interface | Swap by | Current implementation(s) |
| --- | --- | --- | --- |
| Agent runtime | `AgentRuntime` (`src/runtime/agent-runtime.ts`) | Implement the interface under `src/runtime/<provider>/`, add a factory, wire it as `runtimeFactory` in `bootstrap.ts`, add an `AgentRuntimeProvider` value in `src/env/app-config.ts` | `LangGraphDeepAgentRuntime` (`deep_agents`) |
| Commerce backend | `CommerceAdapter` (`src/contracts/commerce.ts`) | Implement the interface under `src/commerce/<provider>/`, add a `CommerceAdapterProvider` value, wire it in `bootstrap.ts` | `ShopwareAdapter` (`shopware`), `UcpAdapter` (`ucp`) |
| Checkout handoff ownership | `checkoutHandoffMode: 'local' \| 'adapter'` | Pass the mode alongside the adapter in `bootstrap.ts` | `local` for Shopware, `adapter` for UCP |
| Session / handoff / audit / conversation storage | `InMemorySessionStore`, `InMemoryHandoffStore`, `InMemoryAuditLogger`, `InMemoryConversationStore` (constructor-injectable) | Implement a class with the same public methods, pass it into `createSalesAgentHarnessApp` | In-memory `Map`-backed implementations |
| Capability set / policy limits | `AgentHarnessConfig` (`src/contracts/config.ts`), loaded from `config/agents/*.json` | Add/remove entries in the agent config JSON; extend `harnessCapabilities` / `AgentPolicyConfig` for a genuinely new capability | `config/agents/demo-sales-agent.json` |

What is *not* a seam: `HarnessCore`, `evaluatePolicy`, and the contracts in `src/contracts` are
the fixed control layer. A new runtime or adapter must conform to the existing interfaces rather
than changing them — see the "MVP-forbidden actions" list in `AGENTS.md` for behavior that must
stay policy-gated regardless of which adapter is active.

## Boundary rules

- `src/runtime/*` may depend on `src/harness` tool definitions, never on `src/commerce`.
- `src/commerce/*` may depend on `src/contracts`, never on `src/runtime`.
- `src/harness`, `src/policy`, `src/contracts` must stay free of provider SDK imports
  (no LangChain, no fetch clients) — they are pure orchestration and pure decision logic.
- Only `src/harness/harness-commerce-context.ts` reattaches a server-side commerce token to an
  outgoing request; no other module should read `commerceContext.shopwareContextToken`.
- `src/app/bootstrap.ts` is the single composition root that is allowed to import concrete
  runtime and adapter implementations together.

## Where to go next

- Adding a new runtime, adapter, capability, or storage backend: [docs/extending.md](extending.md)
  has the concrete step lists and test expectations for each.
- Product and safety constraints behind these boundaries: `AGENTS.md` and `specs/`.
