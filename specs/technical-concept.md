## Technical concept: Seller Agent Harness with LangGraph Deep Agents in TypeScript

The MVP can be implemented as a **TypeScript-based Seller Agent Harness Service** using **LangGraph Deep Agents** as the agent runtime. Deep Agents provides higher-level agent capabilities such as planning, tool usage, subagents, context handling, and memory, while LangGraph provides the underlying orchestration runtime for stateful agent workflows.

The core idea is to use LangGraph Deep Agents for the **sales-agent experience**, while keeping all merchant-specific commerce execution inside a separate harness layer. The agent can understand customer or buyer-agent requests, plan the next step, and request tools, but it should not access Shopware or commerce systems directly.

The architecture should look like this:

```text id="6jc6lb"
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

The **LangGraph Deep Agent** is responsible for conversation flow, intent handling, tool selection, and response generation. It can support richer demo and evaluation scenarios because it can plan multi-step tasks and manage context across the interaction.

The **Seller Agent Harness Core** remains the control layer. It validates tool calls, applies merchant policies, filters data, logs actions, and ensures the agent only uses approved commerce capabilities. This keeps the architecture safe and avoids coupling business-critical commerce logic directly to the agent framework.

A key MVP requirement is that the **capabilities of the sales agent should be configurable on a code basis**, for example through a JSON or YAML configuration file. This allows the internal team or merchant developer to define which tools and capabilities are available for a specific sales agent without changing the core harness implementation.

Example configuration:

```json id="b7bpu2"
{
  "agentId": "demo-sales-agent",
  "merchantId": "demo-shopware-merchant",
  "capabilities": {
    "productSearch": true,
    "productDetails": true,
    "cartCreation": true,
    "cartUpdate": true,
    "checkoutHandoff": true,
    "checkoutCompletion": false,
    "quotes": false,
    "negotiation": false,
    "payments": false,
    "orderCreation": false
  },
  "policies": {
    "allowedChannels": ["customer_ui", "a2a"],
    "blockedCategories": ["restricted"],
    "maxCartValue": 1000,
    "allowCheckoutHandoff": true,
    "allowCheckoutCompletion": false,
    "requireHumanApprovalForCheckout": false
  }
}
```

Based on this configuration, the harness decides which tools are registered with the Deep Agent and which actions are allowed at runtime. For example, if `quotes` is set to `false`, quote-related tools are not exposed to the agent at all. If `checkoutHandoff` is enabled, the agent may request checkout preparation, but the harness still performs policy checks before executing the action. If `checkoutCompletion` is enabled, the harness must also require explicit buyer confirmation, checkout-completion policy approval, and a completion-capable adapter.

For the MVP, the Deep Agent should only receive typed tools such as:

```text id="2swk87"
searchProducts
getProductDetails
createCartDraft
updateCartDraft
prepareCheckoutHandoff
completeCheckout
```

Each tool should call the harness core first. The harness then checks the merchant configuration, executes the allowed action through the Shopware adapter, normalizes the response, and returns only safe data back to the agent.

Shopware should be the first real commerce backend, focused on catalog and cart capabilities through Store API and checkout completion through UCP when available. The initial integration should support product search, product details, cart creation, cart updates, checkout handoff, and policy-gated checkout completion for completion-capable adapters. Quotes, negotiation, custom discounts, and customer-account mutation should remain later additions and can be enabled later through the same capability configuration model.

A2A should be the first external agent interface, so the seller agent can be tested with buyer agents. In parallel, a simple customer UI API should use the same harness capabilities, allowing the MVP to support both direct customer interaction and agent-to-agent commerce scenarios.

The MVP should use config-as-code for merchant policies and agent capabilities. These policies can define which actions are allowed, which products or categories are exposed, whether cart creation is allowed, when checkout handoff is possible, and which fields must never be shown to the model or customer.

Observability should be included from the beginning. The service should log conversations, tool calls, policy decisions, Shopware/UCP calls, cart changes, blocked actions, checkout handoffs, and checkout completions. This makes the system useful for merchant validation as well as internal experiments, demos, and evaluations.

The main technical decision is to use **LangGraph Deep Agents as the replaceable agent runtime**, not as the complete commerce control layer. The long-term architecture should keep the harness, commerce capabilities, policies, capability configuration, and Shopware adapter independent from the agent framework. This makes it possible to later add other runtimes, deeper Shopware integration, Universal Commerce Protocol, Agent Payment Protocol, MCP, or additional ecommerce backends.
