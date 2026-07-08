# Configuration

Sales Agent Harness uses config-as-code for merchant capabilities and policy, plus typed
environment accessors for runtime, storage, and commerce integration settings.

## Agent Profile

The public seller-agent identity lives in the agent config under `agentProfile`. The default demo
config includes:

```json
{
  "agentProfile": {
    "displayName": "Demo Store Sales Agent",
    "description": "Merchant-controlled seller agent for product discovery, cart preparation, checkout handoff, and opt-in UCP checkout completion.",
    "serviceSummary": "Search trusted Shopware catalog data, prepare carts, summarize totals, create checkout handoffs, and complete UCP checkout when merchant policy allows it.",
    "supportedLanguages": ["en"],
    "contactUrl": "https://shop.example.test/contact",
    "examples": [
      "Find waterproof jackets",
      "Prepare a cart with two of product product-1",
      "Complete checkout for checkout-1 after buyer confirmation"
    ]
  }
}
```

`GET /.well-known/agent-card.json` uses these fields for the A2A agent name, description, skill
summary, examples, and metadata. Capabilities and policies still come from the typed harness
config; the profile is public description, not authorization.

## Capabilities And Policy

Enabled capabilities are configured per agent in `config/agents/demo-sales-agent.json`:

- `searchProducts`
- `getProductDetails`
- `createCart`
- `updateCart`
- `getCartSummary`
- `prepareCheckoutHandoff`
- `completeCheckout` for explicitly enabled UCP-only automated checkout

Disabled capabilities are not registered as tools. Policy checks run before every commerce action,
and blocked or escalated actions do not call the adapter.

Cart limits such as `maxCartValue` and `maxItemQuantity` are additionally re-checked against the
real cart summary returned by the adapter for `createCart`, `updateCart`, and
`prepareCheckoutHandoff`; a violating result is withheld and reported as blocked, so an over-limit
cart cannot proceed to checkout handoff or completion.

Example policy shape:

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

## Commerce Adapter Choice

The default `shopware` adapter calls the Shopware Store API directly and keeps checkout handoff as a
harness-owned opaque token. Use it when you want the smallest dependency surface or are testing
against a plain Shopware Store API.

Set this when the Shopware Agentic Commerce plugin is installed and UCP is enabled for the target
sales channel:

```bash
COMMERCE_ADAPTER_PROVIDER=ucp_shopware
```

With `ucp_shopware`, catalog/cart calls go through the plugin's UCP REST endpoints under `/ucp/v1`,
and `prepareCheckoutHandoff` creates a UCP checkout session and returns the plugin-provided
`continueUrl`. The harness still owns runtime orchestration, policy checks, tool exposure, response
normalization, and audit logging.

## UCP Profile Signing

For strict UCP, set `SHOPWARE_UCP_AGENT_PROFILE_URL` to the public HTTPS URL where this harness
serves `/.well-known/ucp`, and configure `SHOPWARE_UCP_SIGNING_KEY_ID` plus
`SHOPWARE_UCP_SIGNING_PRIVATE_KEY_JWK`. The harness signs UCP REST requests with RFC 9421
`Signature-Input`/`Signature` headers and RFC 9530 `Content-Digest`, and the profile endpoint
publishes only the public JWK under `signing_keys`.

Generate a local P-256 signing key with:

```bash
node -e "const {generateKeyPairSync}=require('crypto'); const {privateKey}=generateKeyPairSync('ec',{namedCurve:'P-256'}); const jwk=privateKey.export({format:'jwk'}); jwk.kid='platform-2026'; console.log(JSON.stringify(jwk));"
```

For local HTTP Shopware/UCP testing, the Shopware Agentic Commerce plugin must allow local profile
fetching. In the Shopware container/environment, set:

```bash
SWAG_AGENTIC_COMMERCE_UCP_PROFILE_FETCHING_DEVELOPMENT_MODE=1
```

Without that Shopware setting, UCP calls fail with `Plain http is only allowed when profile fetching
development mode is enabled.`

The Shopware UCP sales-channel config must also allow this unsigned local harness flow:

- `active: true`
- `enabledCapabilities` includes `catalog`, `cart`, and `checkout`
- `enabledTransports` includes `rest`; include `embedded` when using the embedded checkout fallback
  URL
- `signaturePolicy: "strict"` for signed UCP testing, or `"log"` only for local unsigned smoke tests
- `embeddedAllowedOrigins` and `embeddedFrameAncestors` include the storefront origin, for example
  `http://localhost`

For any productionized version, keep strict signature enforcement, use an HTTPS profile URL without
redirects, and keep the private JWK only in server-side environment or secret storage. This
repository does not provide the surrounding production controls by itself.

## Runtime And Storage

Shopware environment access is centralized in `src/env/shopware-config.ts`:

- `SHOPWARE_BASE_URL`
- `SHOPWARE_STORE_API_ACCESS_KEY`
- `SHOPWARE_DEFAULT_SALES_CHANNEL_ID`

Deep Agents/OpenAI runtime access is centralized in `src/env/agent-runtime-config.ts`:

- `OPENAI_API_KEY`
- `AGENT_RUNTIME_MODEL`, defaulting to `gpt-5-mini`

When using the default runnable app, no manual checkpoint wiring is required. Setting
`STORAGE_PROVIDER=sqlite` makes `createRunnableSalesAgentHarnessApp()` create a Bun-native SQLite
LangGraph checkpointer from `SQLITE_DB_PATH` and pass it into Deep Agents automatically.

Manual runtime construction is available for custom embedding paths:

```ts
const tools = createExecutableToolRegistry(agentConfig, harnessCore);
const runtimeConfig = loadAgentRuntimeEnvironmentConfig();
const checkpointSaver = createSqliteLangGraphCheckpointSaver('data/langgraph-checkpoints.sqlite');

const runtime = createLangGraphDeepAgentRuntime({
  apiKey: runtimeConfig.apiKey,
  modelName: runtimeConfig.modelName,
  tools,
  checkpointSaver,
});
```

The runtime uses `deepagents` with `ChatOpenAI` and LangChain structured tools. Tool calls receive
the active `agentSessionId` from the runtime request and delegate back into the harness. The model
never receives direct Shopware, Store API, UCP, MCP, or adapter access.
