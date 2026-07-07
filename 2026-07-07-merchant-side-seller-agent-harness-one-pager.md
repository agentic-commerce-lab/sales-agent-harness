# Merchant-Side Seller Agent Harness: Initiative One-Pager

## Executive summary

By 2030, AI agents will mediate a meaningful share of the global economy. Every merchant will rely on specialized agents to represent their business, negotiate, sell, and support customers autonomously.

Building agent demos is easy. Building agents that merchants can trust with their reputation, prices, policies, customer promises, and commercial outcomes is hard. Security, identity, governance, negotiation, reliability, and merchant control become foundational capabilities.

Shopware Agent Seller Harness is our first open-source step toward lowering the barrier to entry into agentic commerce. It gives merchants a practical starting point for building external-facing seller agents faster, using good primitives that reduce development effort and time to market. It is intentionally small, but it sets the foundation for safe seller agents, merchant control, and a Lab test bed we can keep building on as protocols, model runtimes, trust patterns, and agentic-commerce technologies evolve.

## Problem

Merchants need a way to participate in agentic commerce without giving autonomous agents uncontrolled access to product data, prices, promotions, carts, checkout, customer conditions, or commercial rules.

Today, a seller agent can easily become commercially unsafe if it guesses prices, invents stock levels, exposes confidential business logic, applies unauthorized discounts, creates misleading product claims, or hands a buyer into checkout without clear confirmation.

At the same time, merchants should not need to start from scratch every time they want to build an external-facing seller agent. The harness gives them reusable primitives for trusted data access, policy-controlled commerce actions, handoff flows, and observability so they can move faster and reduce time to market.

The harness solves this by putting a merchant-controlled layer between the AI seller agent and the commerce system of record. The agent can guide the conversation, but every commerce action flows through trusted merchant data, policy checks, capability limits, response filtering, and audit logs.

## Target persona

**Primary:** A merchant or commerce operator who wants to experiment with AI-powered sales agents without losing control over pricing, product representation, customer conditions, checkout rules, or transaction governance.

**Secondary:** Shopware product, engineering, sales, partner, and Lab teams who need a reusable way to spin up safe seller-agent demos, prototypes, evaluations, and protocol experiments.

**Beneficiary:** The Agentic Commerce Lab, using the harness as an open test bed to explore future protocols and technologies in agentic commerce, including REST-based agent flows, UCP commerce capabilities, future MCP-style tool surfaces, identity and governance patterns, negotiation flows, and model/runtime interoperability.

## Goals

1. Give merchants a strong starting point for external-facing seller agents by providing reusable primitives for product search, product detail retrieval, cart handling, checkout handoff, policy checks, and observability.
2. Keep merchants in control of agentic commerce by routing commerce actions through merchant-approved capabilities, trusted data, policy decisions, buyer confirmation where required, and audit logs.
3. Prove safe seller-agent patterns in a real Shopware-backed research preview, including trusted product data, cart drafts, handoffs, explicit UCP research checkout paths, and controlled external interfaces.
4. Create a reusable Lab test bed for future agentic-commerce work, including protocols, model runtimes, input interfaces, identity and governance patterns, payment authorization, observability, and trust mechanisms.
5. Lower the barrier to the agentic economy through open primitives that others can inspect, extend, and adapt without needing to start from scratch.

## Non-goals

- **Not uncontrolled autonomous selling.** The research preview should not let an agent sell without merchant-approved capabilities, policy checks, buyer confirmation where required, and auditability.
- **Not direct model access to commerce systems.** The agent runtime must not call Shopware, Store API, UCP, MCP, PSPs, or other commerce systems directly. Commerce access goes through the harness.
- **Not general payment execution.** Payment execution is out of scope except for an explicitly supported, merchant-approved checkout-completion flow.
- **Not legal-term acceptance on behalf of the buyer.** The harness must not accept legal terms for a buyer.
- **Not binding quotes, custom discount negotiation, or customer-account mutation.** These are intentionally out of scope for the preview.
- **Not a generic chatbot wrapper.** The value is the controlled commerce execution layer: trusted data, policy enforcement, response filtering, auditability, and safe handoff.
- **Not a production-grade omnichannel agent on day one.** The research preview establishes the foundational layer for safe, observable, policy-controlled sales-agent behavior before deeper channels, protocols, and merchant UI are productized.

## FAQ

**What is the harness?**

Shopware Agent Seller Harness is an open-source, framework-agnostic agentic commerce stack powered by Shopware. It is the merchant-owned control layer between an AI seller agent and the merchant's commerce systems. It lets an agent help with product discovery, product details, cart preparation, cart summaries, and checkout handoff while preserving merchant rules, data integrity, and auditability.

**Why does this need to exist?**

Agentic commerce creates a new seller-side problem: external buyer agents and AI shopping assistants need structured access to merchant capabilities, but merchants cannot safely expose raw systems or let a model decide prices, discounts, availability, checkout terms, or commercial commitments on its own.

The deeper industry challenge is not whether agents can be prototyped. They can. The challenge is whether agents can become secure, trusted, business-facing representatives of real merchants. That requires identity, governance, security, negotiation, reliability, observability, and open standards.

**Why open source it?**

Open sourcing the harness lowers the barrier for millions of merchants to participate in the agentic economy while keeping merchant sovereignty at the center. It also creates a shared stack the ecosystem can inspect, extend, and adapt across model providers, agent frameworks, and emerging commerce protocols.

**Why does it matter for the Agentic Commerce Lab?**

The harness gives the Lab a reusable test bed for agentic-commerce exploration. Instead of building a new demo shell for every protocol or model experiment, the Lab can use one merchant-controlled foundation to test REST flows, UCP research paths, future MCP-style tool surfaces, identity flows, policy enforcement, negotiation patterns, payment authorization, checkout handoff, observability, and future standards.

**What can the research preview do today?**

The current research preview can:

- Search products from trusted commerce data.
- Retrieve product details, price, availability, attributes, variants, and delivery information when the configured adapter returns it.
- Create and update cart drafts or carts through the configured commerce adapter.
- Summarize cart totals, line items, and shipping costs.
- Prepare checkout handoff URLs using opaque harness tokens or adapter-owned UCP checkout sessions.
- Complete checkout only in the explicit UCP research path, when the capability and merchant policy are both enabled and the buyer confirmation payload is present.
- Expose the same controlled flow through a small customer chat UI, direct HTTP commerce routes, and an A2A-compatible HTTP+JSON surface.
- Persist local demo state with SQLite when enabled, including sessions, handoffs, audit events, run records, checkout idempotency records, and LangGraph checkpoints.

**What systems does it connect to first?**

Shopware is the first commerce backend for the research preview. The harness uses the configured commerce adapter to access trusted catalog, pricing, availability, cart, checkout handoff, and explicit UCP research checkout-completion flows.

**Which interfaces does the preview expose?**

The preview exposes the same controlled commerce flow through a small customer chat UI, direct HTTP commerce routes, and an A2A-compatible HTTP+JSON surface. UCP is used in the explicit research path for adapter-owned checkout sessions and checkout completion when capability, merchant policy, and buyer confirmation are present.

**How does it keep merchant data accurate?**

Product, price, inventory, delivery, promotion, and checkout data should come from trusted merchant systems. Missing or uncertain data should be surfaced clearly instead of guessed.

**How does it enforce merchant policies?**

The harness should define what the seller agent may expose, recommend, quote, add to cart, reserve, hand off to checkout, or escalate. Policies can include customer group, region, product category, blocked products, discount limits, quantity limits, cart value limits, approval requirements, payment methods, and delivery constraints.

**What actions are intentionally out of scope for the preview?**

The preview intentionally excludes uncontrolled autonomous selling, payment execution outside an explicitly supported merchant-approved checkout-completion flow, legal-term acceptance on behalf of the buyer, binding quotes, custom discount negotiation, customer account mutation, and direct model access to Shopware, Store API, UCP, MCP, PSPs, or other commerce systems.

**How does the harness reduce misuse and compliance risk?**

It mitigates prompt-injection risks, filters raw backend responses, blocks disabled or restricted actions, protects confidential fields and tokens, prevents unauthorized discounts or unsupported regions, and creates audit logs for tool calls, policy checks, data sources, decisions, cart changes, checkout handoffs, and explicit checkout-completion attempts.

**What should be observable?**

Merchants and internal evaluators should be able to review which data the agent used, which tools it called, which policies were applied, why an action was allowed or blocked, what cart changes happened, where the buyer was handed off, and whether any explicit UCP checkout-completion attempt met capability, policy, and buyer-confirmation requirements.

**What comes later?**

Later additions can include Agent Payment Protocol or payment-authorization integrations, support for new input interfaces to the agent, merchant-facing configuration UI, and support for additional merchant systems.

**What is the long-term ambition?**

The ambition is to make Shopware Agent Seller Harness a practical bridge into the agentic economy: open enough for the ecosystem, flexible enough for different models and frameworks, secure enough for real merchants, and useful enough for the Lab to continuously test the next generation of agentic-commerce protocols and technologies.
