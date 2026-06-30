# Project Guidance for Agents

This project defines and validates a Merchant-Side Seller Agent Harness: a controlled execution layer that lets AI seller agents represent a merchant safely across agentic commerce channels.

The harness must preserve merchant control over product data, pricing, availability, policies, cart handling, checkout rules, and transaction governance. Treat the specs in `specs/` as the source of truth for product and architecture decisions.

## Product Goal

Build a TypeScript-based Seller Agent Harness Service that supports internal demos, experiments, prototypes, and evaluations for agentic commerce.

The MVP should let a merchant configure a limited sales-agent setup that can:

- Answer product, price, availability, delivery, and promotion questions using trusted merchant data.
- Respect merchant policies such as enabled capabilities, channel, region, customer group, category restrictions, quantity limits, cart value limits, and approval requirements.
- Prepare carts or quote-like drafts only from valid commerce data.
- Hand off checkout with a clear summary before any binding transaction.
- Block or escalate unsafe, unsupported, or policy-violating actions.
- Provide logs and traces that explain what happened and why.

Do not implement a fully autonomous selling agent for the MVP. The MVP is a controlled harness for safe, observable, non-binding commerce preparation.

## Architecture Principles

- Keep the sales-agent runtime separate from commerce execution.
- Use LangGraph Deep Agents as the replaceable agent runtime for conversation flow, planning, tool selection, context handling, and response generation.
- Keep merchant-specific commerce control in the Seller Agent Harness Core.
- Never let the agent runtime call Shopware, Store API, UCP, MCP, or other commerce systems directly.
- Route every commerce action through typed harness tools, policy checks, capability checks, normalization, filtering, and logging.
- Design capability contracts so Shopware Store API is the first backend, while UCP, MCP, payment protocols, and other commerce platforms can be added later.

Expected high-level flow:

```text
Customer UI / A2A Buyer Agent
        |
        v
A2A + Customer API Layer
        |
        v
LangGraph Deep Agent
        |
        v
Seller Agent Harness Core
        |
        v
Commerce Capability Layer
        |
        v
Shopware Adapter
        |
        v
Shopware Catalog / Cart / Checkout
```

## MVP Capabilities

Expose only enabled capabilities to the agent. Disabled capabilities should not be registered as tools.

Initial tools/capabilities:

- `searchProducts`
- `getProductDetails`
- `createCartDraft` or `createCart`
- `updateCartDraft` or `updateCart`
- `getCartSummary`
- `prepareCheckoutHandoff`

For the MVP, these actions are allowed:

- Search products.
- Show product details.
- Prepare a cart.
- Add, remove, or update cart items.
- Show cart summaries.
- Prepare checkout handoff.

For the MVP, these actions are not allowed:

- Place an order.
- Execute payment.
- Accept legal terms.
- Make binding commercial commitments.
- Modify customer account data.
- Negotiate custom discounts.
- Create binding quotes.

## Policy and Configuration

Use config-as-code for MVP capability and policy configuration, such as JSON or YAML.

Configurations should cover:

- Agent ID and merchant ID.
- Enabled capabilities.
- Allowed channels, such as `customer_ui`, `a2a`, and internal demo flows.
- Blocked categories and products.
- Maximum quantities and cart values.
- Checkout handoff permission.
- Human approval requirements.
- Unsupported regions or sales channels.
- Fields that must never be exposed to the model, buyer agent, or customer.

Every high-impact action must have a policy decision and audit trail. Missing or uncertain data must be surfaced clearly, not guessed.

## Shopware Integration Rules

Shopware is the first real commerce backend for the MVP.

- Use the Shopware Store API for customer-facing catalog and cart execution.
- Use Shopware UCP only as a future-facing capability design influence until an explicit protocol integration is needed.
- Use Shopware MCP only for later internal, developer, admin, diagnostic, or backoffice workflows.
- Define an internal `CommerceAdapter` contract and implement Shopware as the first adapter.
- Keep raw Shopware context tokens server-side. Never expose them to the model, buyer agent, customer URL, or external client.
- Normalize and filter Shopware responses before returning data to the agent.

Recommended adapter shape:

```ts
interface CommerceAdapter {
  searchProducts(input: SearchProductsInput): Promise<ProductSearchResult>;
  getProductDetails(input: ProductDetailsInput): Promise<ProductDetailsResult>;
  createCart(input: CreateCartInput): Promise<CartResult>;
  updateCart(input: UpdateCartInput): Promise<CartResult>;
  getCartSummary(input: CartSummaryInput): Promise<CartSummaryResult>;
  prepareCheckoutHandoff(input: CheckoutHandoffInput): Promise<CheckoutHandoffResult>;
}
```

## Cart and Checkout Handoff

Checkout handoff is preparation only. The agent must not complete checkout.

The expected flow is:

1. The agent requests cart preparation through a harness tool.
2. The harness validates capability and policy.
3. Shopware calculates the cart.
4. The agent shows a clear summary of products, quantities, prices, delivery, terms, and required confirmation.
5. The customer confirms they want to continue.
6. The harness creates a short-lived opaque handoff token.
7. The customer is sent to the merchant-controlled Shopware checkout flow.

For A2A scenarios, return a `continueUrl` containing an opaque handoff token, not a Shopware context token.

Use a Shopware app-based handoff for the MVP:

- The handoff URL opens a merchant storefront app page.
- The app uses Context Gateway to access the current storefront/customer context.
- The app server or harness validates the handoff token.
- The prepared cart is recreated in the customer's current Shopware context.
- The customer is redirected to checkout.

Checkout Gateway is not required for the first MVP. Add it later for checkout-time policy enforcement.

## Safety Requirements

The harness must protect merchants from misuse, manipulation, and compliance risk.

- Mitigate prompt injection from buyer-agent messages, product content, reviews, external websites, uploaded files, or other untrusted inputs.
- Do not reveal confidential merchant data, margins, private pricing logic, hidden rules, unauthorized customer information, raw backend responses, or sensitive tokens.
- Block restricted products, invalid discounts, unsupported regions, suspicious behavior, non-compliant transactions, and disabled capabilities.
- Use trusted merchant systems for prices, inventory, delivery promises, promotions, taxes, payment options, and checkout constraints.
- Do not invent prices, stock levels, discounts, delivery promises, product claims, or customer-specific conditions.

## Observability

Logging and traces are part of the MVP, not a later enhancement.

Capture structured events for:

- Agent session ID.
- Merchant ID and channel.
- User requests and agent responses.
- Tool calls and requested capabilities.
- Policy checks and decisions.
- Data sources used.
- Shopware sales channel and Store API calls.
- Cart creation, cart updates, and cart summaries.
- Handoff token creation and checkout handoff URLs.
- Blocked actions, errors, fallbacks, and escalations.

Merchants and internal evaluators must be able to review what data the agent used, which tools it called, which policies were applied, and why actions were allowed or blocked.

## Testing Expectations

Add tests around behavior that can affect merchant trust, commercial correctness, or safety.

Cover at least:

- Product discovery from trusted data.
- Product detail retrieval and response filtering.
- Missing or uncertain data handling.
- Capability-disabled tool behavior.
- Policy-allowed and policy-blocked actions.
- Cart creation and update flows.
- Checkout handoff creation.
- Rejection of order placement, payment execution, legal-term acceptance, binding quotes, and custom discount negotiation.
- Protection of context tokens and confidential fields.
- Logging of tool calls, policy decisions, cart changes, blocked actions, and handoffs.

## Implementation Sequence

Prefer this order for MVP work:

1. Store API adapter for product search, product details, cart creation, cart updates, and cart summary.
2. Harness session model for agent sessions, channel context, merchant config, Shopware sales channel mapping, and secure context token storage.
3. Checkout handoff support for handoff token creation, cart summary generation, A2A `continueUrl`, and validation endpoint.
4. Shopware app handoff using Context Gateway, handoff token resolution, cart recreation, and redirect to checkout.
5. Future protocol mapping for UCP, MCP, Checkout Gateway, payment authorization, and additional commerce backends.

## Working Rules

- Keep changes aligned with the specs in `specs/`.
- Prefer TypeScript for service and adapter implementation unless the project later establishes a different stack.
- Keep commerce contracts typed and explicit.
- Keep runtime-specific LangGraph code behind boundaries so the harness can support other runtimes later.
- Treat policy decisions, auditability, and response filtering as core behavior.
- Avoid coupling business-critical commerce logic directly to prompts or model behavior.
- When data is missing, uncertain, unsupported, or unauthorized, return a clear blocked/escalated response instead of guessing.
