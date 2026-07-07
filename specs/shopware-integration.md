# Shopware Integration Technical Spec

## 1. Integration goal

The Seller Agent Harness should use Shopware as the first real commerce backend for the MVP.

Shopware provides the commerce capabilities, such as catalog, cart, and checkout functionality. The Seller Agent Harness consumes and controls access to these capabilities. The sales agent itself should not call Shopware directly.

The goal is to allow the sales agent to act on behalf of a customer in a limited, safe, policy-controlled way: product discovery, product details, cart preparation, checkout handoff, and explicitly enabled checkout completion through a completion-capable adapter.

## 2. Core integration principle

The agent must not access Shopware APIs directly.

All Shopware communication should go through the Seller Agent Harness.

```text
Sales Agent
    -> Harness Tool
        -> Policy / Capability Check
            -> Shopware Adapter
                -> Shopware Store API / later UCP
```

The harness is responsible for:

* validating the requested action
* checking whether the capability is enabled
* applying merchant configuration and policies
* managing the Shopware customer/cart context
* calling the correct Shopware capability
* filtering returned data before it reaches the model
* logging all relevant actions

## 3. Recommended MVP integration path

For the MVP, the main catalog and cart integration path should be the **Shopware Store API**.

The Store API should be used for customer-facing commerce operations such as:

* product search
* product detail retrieval
* cart creation
* cart updates
* cart summary
* checkout handoff preparation

The Store API path remains handoff-only. Full checkout completion requires an explicitly enabled capability, explicit buyer confirmation, merchant policy approval, and an adapter that supports completion.

## 4. Role of Shopware UCP

Shopware UCP should be treated as the optional protocol integration for checkout completion and future agentic commerce flows.

Shopware already exposes commerce capabilities. The seller agent should not be described as a Shopware UCP capability. Instead:

```text
Shopware exposes commerce capabilities
Seller Agent Harness consumes and controls them
Sales Agent creates the customer or buyer-agent experience
```

Long term, harness capabilities can map to UCP concepts:

| Harness capability   | UCP area                        |
| -------------------- | ------------------------------- |
| product search       | catalog                         |
| product details      | catalog lookup                  |
| cart creation        | cart                            |
| cart update          | cart                            |
| checkout handoff     | checkout                        |
| checkout completion  | checkout                        |
| customer linking     | identity linking                |
| order status         | order management                |
| future payment flows | payment / payment authorization |

For the MVP, Store API remains the concrete catalog/cart execution path. UCP is the concrete path for checkout completion when `completeCheckout` is enabled and policy allows it.

## 5. Role of Shopware MCP

Shopware MCP should not be the primary path for customer-facing cart and checkout flows.

MCP is more relevant for:

* internal experiments
* developer tooling
* merchant/admin assistants
* diagnostics
* admin-side workflows
* future configuration or backoffice use cases

The customer-facing sales-agent MVP should rely on Store API first, with UCP as the future commerce protocol path.

## 6. Agent capabilities for MVP

The initial Shopware adapter should implement a small set of stable commerce capabilities:

```text
searchProducts
getProductDetails
createCart
updateCart
getCartSummary
prepareCheckoutHandoff
```

These capabilities should be exposed to the agent only if enabled in the agent configuration.

Example capability configuration:

```json
{
  "agentId": "demo-sales-agent",
  "merchantId": "demo-shopware-merchant",
  "capabilities": {
    "productSearch": true,
    "productDetails": true,
    "cartCreation": true,
    "cartUpdate": true,
    "checkoutHandoff": true,
    "quotes": false,
    "negotiation": false,
    "payments": false,
    "orderCreation": false
  }
}
```

If a capability is disabled, the corresponding tool should not be available to the agent.

## 7. Acting on behalf of the customer

The agent can act on behalf of the customer only through typed, policy-checked harness capabilities.

Allowed in MVP:

* search products
* show product details
* prepare a cart
* add, remove, or update cart items
* show cart summary
* prepare checkout handoff
* complete checkout when `completeCheckout` is enabled, buyer confirmation is explicit, policy allows completion, and the selected adapter supports completion

Not allowed in MVP:

* place an order outside the typed `completeCheckout` harness capability
* execute payment outside an explicitly supported, merchant-approved checkout completion flow
* accept legal terms
* make binding commercial commitments
* modify customer account data
* negotiate custom discounts
* create binding quotes

## 8. Cart and context handling

Shopware cart handling is context-based. The harness should manage a Shopware cart context per agent session.

Conceptually:

```text
Agent session
    -> buyer/customer context
        -> Shopware sales channel
            -> Shopware context/cart token
                -> Shopware cart
```

The Shopware context token should be stored server-side by the harness or the app backend. It should not be exposed to the model, buyer agent, or customer URL.

There are two main modes:

### Customer UI mode

If the agent is embedded in a customer-facing Shopware storefront or frontend, the agent can work with the customer’s current cart context.

```text
Customer UI
    -> Sales Agent
        -> Harness
            -> Current Shopware cart context
```

### A2A mode

If an external buyer agent interacts with the seller agent, the harness creates or manages a separate cart context for that A2A session.

```text
Buyer Agent
    -> A2A
        -> Seller Agent Harness
            -> Shopware cart context
```

The buyer agent should receive a summary and handoff link, not raw Shopware session or context data.

## 9. Checkout handoff and completion principle

Checkout handoff means:

1. The agent prepares the cart.
2. The harness validates and logs the action.
3. Shopware calculates the cart.
4. The agent shows a clear cart summary.
5. The customer confirms they want to continue.
6. The customer is handed over to the merchant-controlled Shopware checkout.

The sales agent does not complete checkout directly. It can only request the typed `completeCheckout` harness capability when that tool is registered, the buyer has explicitly confirmed, and policy allows completion.

```text
Agent prepares cart
    -> Harness validates action
        -> Shopware calculates cart
            -> Agent shows summary
                -> Customer opens handoff
                    -> Shopware checkout
```

Checkout completion means:

1. The agent prepares or references a checkout session.
2. The buyer explicitly confirms the exact checkout.
3. The harness validates capability, policy, and approval requirements.
4. The adapter updates checkout buyer and fulfillment data.
5. The adapter completes checkout and returns the order result.
6. The harness records policy, commerce-call, and checkout-completion audit events.

With the current architecture, completion is UCP-backed. The Shopware Store API adapter remains handoff-only.

## 10. A2A checkout handoff

For A2A scenarios, the seller agent should return a `continueUrl`.

The URL should contain an opaque handoff token, not a Shopware context token.

Example:

```json
{
  "type": "checkout_handoff",
  "summary": {
    "items": [
      {
        "label": "Example Product",
        "quantity": 1,
        "price": "119.00 EUR"
      }
    ],
    "total": "119.00 EUR"
  },
  "continueUrl": "https://shop.example.com/agent-checkout?h=handoff_abc123"
}
```

The handoff token maps server-side to:

```json
{
  "handoffId": "handoff_abc123",
  "agentSessionId": "agent_session_123",
  "merchantId": "merchant_1",
  "shopwareSalesChannelId": "sales_channel_456",
  "shopwareContextToken": "stored_server_side_only",
  "cartSummary": {},
  "expiresAt": "2026-06-30T15:00:00Z",
  "status": "ready_for_checkout"
}
```

The handoff token should be:

* short-lived
* signed or securely generated
* one-time or limited-use
* scoped to a merchant and sales channel
* validated by the app backend or harness before use

## 11. Shopware app-based handoff

The A2A checkout handoff should use a **Shopware app-based approach**.

The flow:

```text
Buyer Agent / A2A Client
    -> Seller Agent Harness
        -> Shopware Store API
            -> Prepared cart / handoff record
                -> A2A continueUrl
                    -> Shopware app storefront page
                        -> Context Gateway
                            -> App server / harness validation
                                -> Cart applied to current customer context
                                    -> Redirect to Shopware checkout
```

The customer opens a handoff URL such as:

```text
https://shop.example.com/agent-checkout?h=handoff_abc123
```

The Shopware app handles this handoff inside the merchant storefront context.

## 12. Context Gateway usage

The Shopware app should use the Context Gateway for the handoff flow.

The Context Gateway allows the app to work with the current sales channel context and cart and communicate with the app server.

In the MVP, the Context Gateway should be used to:

* receive the current storefront/customer context
* pass the opaque handoff token to the app server
* validate the handoff with the Seller Agent Harness
* apply or recreate the prepared cart in the customer’s current context
* redirect the customer to checkout

The app should not expose the raw Shopware context token in the URL.

## 13. Cart restoration strategy

For the MVP, the recommended approach is to **recreate the prepared cart in the customer’s current Shopware context**.

This is safer than trying to transfer the A2A session’s Shopware context token into the customer’s browser session.

Recommended flow:

```text
handoff token
    -> resolve intended cart line items
        -> validate products and quantities
            -> add items to current customer cart
                -> show cart / checkout summary
                    -> redirect to checkout
```

This avoids leaking or misusing Shopware context tokens and fits better with customer-controlled checkout.

## 14. Checkout Gateway role

Checkout Gateway is not required for the first MVP handoff.

It can be added later to influence checkout-time behavior, such as:

* blocking checkout under certain conditions
* restricting payment methods
* restricting shipping methods
* enforcing policy checks during checkout
* validating cart state before order placement

Recommended phasing:

```text
MVP:
Context Gateway for A2A handoff into cart/checkout

Later:
Checkout Gateway for checkout-time validation and restrictions
```

## 15. Technical adapter design

The Seller Agent Harness should define its own internal commerce adapter contract.

Example:

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

Shopware should be the first implementation:

```text
ShopwareStoreApiAdapter
```

Later, additional implementations can be added:

```text
ShopwareUcpAdapter
ShopwareMcpAdapter
MockCommerceAdapter
OtherCommercePlatformAdapter
```

This keeps the agent and harness independent from a single Shopware integration method.

## 16. Policy checks

Before calling Shopware, the harness should check whether the requested capability is allowed.

Initial policy areas:

* enabled capabilities
* allowed channels: customer UI, A2A, internal demo
* allowed product categories
* blocked products
* maximum quantity
* maximum cart value
* checkout handoff allowed or blocked
* fields that must never be exposed
* unsupported regions or sales channels

Policy can be config-as-code for the MVP.

Example:

```json
{
  "policies": {
    "allowedChannels": ["customer_ui", "a2a"],
    "blockedCategories": ["restricted"],
    "maxCartValue": 1000,
    "allowCheckoutHandoff": true,
    "requireHumanApprovalForCheckout": false
  }
}
```

## 17. Observability

The Shopware integration should log all important activity.

MVP logs should include:

* agent session ID
* channel: customer UI or A2A
* requested capability
* policy decision
* Shopware sales channel
* Shopware API call
* cart creation/update
* cart summary
* handoff token creation
* checkout handoff URL creation
* blocked actions
* errors and fallbacks

The model should never receive raw backend responses unless they have been normalized and filtered by the harness.

## 18. Recommended MVP implementation sequence

### Phase 1: Store API adapter

Implement:

* product search
* product details
* create cart
* update cart
* get cart summary

### Phase 2: Harness session model

Implement:

* agent session
* channel context
* merchant config
* Shopware sales channel mapping
* secure context token storage

### Phase 3: Checkout handoff

Implement:

* handoff token creation
* cart summary generation
* A2A `continueUrl`
* handoff validation endpoint

### Phase 4: Shopware app handoff

Implement:

* app storefront entry point
* Context Gateway interaction
* handoff token resolution
* cart recreation in current customer context
* redirect to checkout

### Phase 5: Future protocol mapping

Add optional mappings to:

* Shopware UCP
* MCP for internal/admin use cases
* Checkout Gateway for checkout-time policy enforcement

## 19. Final technical decision

For the MVP, the Shopware integration should use:

* **Shopware Store API** for real catalog and cart execution
* **A2A** for buyer-agent interaction
* **a Shopware app-based handoff** for bringing the customer into the merchant-controlled checkout
* **Context Gateway** to connect the handoff flow to the current storefront/customer context
* **opaque handoff tokens** instead of exposing Shopware context tokens
* **UCP-ready capability design** for future protocol alignment
* **MCP only as a later/internal tooling path**

The agent may prepare the cart and guide the buyer toward checkout, but the final checkout remains under merchant control.
