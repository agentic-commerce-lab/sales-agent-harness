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

LangGraph Deep Agents are represented by the replaceable runtime boundary in `src/runtime/`. Runtime-specific code must not be imported into `src/harness`, `src/commerce`, `src/policy`, or `src/contracts`.

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

Do not read `process.env` from application code outside typed config accessors.

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

