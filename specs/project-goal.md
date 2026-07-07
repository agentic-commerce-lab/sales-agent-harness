Project Goal
The goal of this project is to define and validate a Merchant-Side Seller Agent Harness: a controlled execution layer that enables AI seller agents to represent a merchant safely, accurately, and transparently across agentic commerce channels.

The harness should allow seller agents to expose product, pricing, availability, promotion, quote, cart, and checkout capabilities to external buyer agents or end customers, while ensuring that all actions follow merchant-defined rules, permissions, commercial policies, and compliance requirements.

In short, the project should make it possible for merchants to participate in agentic commerce without losing control over pricing, product representation, customer experience, checkout rules, or transaction governance. It should also be usable internally by the team to quickly spin up selling agents for experiments, demos, prototypes, and evaluations.

Top 5 Acceptance Criteria
1. The seller agent represents merchant data accurately
Acceptance criterion:
The seller agent can access and expose accurate merchant-side commerce data, including product information, pricing, availability, variants, delivery options, customer-specific conditions, and commercial rules.

Accepted when:

Product, price, inventory, and delivery data are retrieved from trusted merchant systems such as Shopware, PIM, ERP, OMS, or pricing engines.

The seller agent does not invent prices, stock levels, delivery promises, discounts, or product claims.

Customer-specific rules, such as B2B pricing, customer groups, regional restrictions, or contract terms, are respected.

Missing or uncertain data is surfaced clearly instead of being guessed.

2. Merchant policies control all seller-agent actions
Acceptance criterion:
The harness ensures that the seller agent can only act within merchant-defined permissions, rules, and commercial boundaries.

Accepted when:

The merchant can define what the seller agent may expose, recommend, negotiate, quote, reserve, or sell.

Configurable limits exist for discounts, order value, product categories, customer segments, regions, payment methods, and delivery promises.

High-impact actions, such as creating binding quotes, applying exceptional discounts, reserving inventory, or triggering checkout, require explicit approval or policy-based authorization.

Every action is linked to the seller agent, merchant account, customer context, timestamp, and policy decision.

3. The seller agent can support quote, cart, and checkout workflows safely
Acceptance criterion:
The seller agent can assist with commercial workflows on behalf of the merchant, including quote preparation, cart creation, checkout preparation, and order handoff.

Accepted when:

The seller agent can create or update carts based on valid product and customer data.

The seller agent can prepare quotes or offers using merchant-approved pricing and discount logic.

Shipping, taxes, promotions, payment options, and checkout constraints are calculated by merchant systems, not by the model.

Before any binding commercial action, the buyer or buyer agent receives a clear summary of products, price, delivery, terms, and required confirmation.

4. The harness protects the merchant from misuse, manipulation, and compliance risks
Acceptance criterion:
The harness prevents seller agents from taking unsafe, unauthorized, misleading, or commercially harmful actions.

Accepted when:

Prompt-injection risks from buyer-agent messages, product content, reviews, external websites, or uploaded files are mitigated.

The seller agent does not reveal confidential merchant data, internal margins, private pricing logic, hidden rules, or unauthorized customer information.

The harness can block restricted products, invalid discounts, unsupported regions, suspicious buyer behavior, or non-compliant transactions.

Audit logs exist for tool calls, policy checks, data sources, decisions, quotes, cart changes, and transaction handoffs.

5. Seller-agent behavior is observable, testable, and commercially measurable
Acceptance criterion:
The merchant can understand, evaluate, and improve how the seller agent behaves across commerce interactions.

Accepted when:

Seller-agent interactions are traceable through logs, traces, and structured event data.

The merchant can review what data the agent used, which tools it called, which policies were applied, and why a specific action was allowed or blocked.

Test scenarios exist for product discovery, buyer-agent negotiation, quote creation, cart updates, checkout handoff, rejected actions, and fallback to human sales or support.

Success metrics are defined, such as product-data accuracy, valid quote rate, policy-compliance rate, conversion contribution, unsafe-action prevention, escalation rate, and checkout handoff accuracy.

MVP definition
The MVP should create a starting point for merchants to build and validate their own AI-powered sales agent for agentic commerce.

The MVP should provide a controlled merchant-side harness that allows a sales agent to access and expose selected commerce capabilities, such as product information, pricing, availability, promotions, quote preparation, cart creation, checkout handoff, and explicitly enabled checkout completion, while ensuring that all actions are based on trusted merchant systems and governed by merchant-defined rules.

The harness should make it possible for merchants to experiment with agentic sales use cases without losing control over product data, pricing, customer conditions, policies, compliance, checkout rules, or transaction governance.

It should also be usable internally by the team to quickly spin up selling agents for experiments, demos, prototypes, and evaluations. This allows different sales-agent concepts, commerce flows, protocols, and buyer-agent interactions to be tested in a controlled environment before being productized or exposed to merchants.

The MVP should not aim to deliver an uncontrolled autonomous sales agent. Instead, it should establish the foundational layer that enables safe, observable, policy-controlled sales-agent behavior, including checkout completion only when a merchant explicitly enables it and the adapter supports it.

MVP scope
The MVP should include:

Access to merchant-side product, price, availability, delivery, and promotion data.

A basic policy layer to control what the sales agent may expose, recommend, quote, add to cart, or hand off to checkout.

Support for a simple quote, cart, checkout-preparation, and policy-gated checkout-completion flow.

Clear handling of missing or uncertain data instead of guessing.

Protection against unauthorized actions, confidential-data exposure, invalid discounts, and unsupported products or regions.

Logging of agent actions, data sources, policy checks, cart changes, quote drafts, checkout handoffs, and checkout completions.

A basic way for merchants to review agent behavior and test common sales scenarios.

Initial integration with an ecommerce platform such as Shopware as the merchant-side system of record for commerce data and transactional workflows.

MVP success criteria
The MVP is successful when a merchant can configure a limited sales-agent setup that can:

Answer product, price, availability, and delivery questions using trusted merchant data.

Respect basic merchant policies such as customer group, region, discount limits, product restrictions, and approval requirements.

Prepare a cart or quote draft based on valid commerce data.

Hand off to checkout with a clear summary or complete checkout only after explicit buyer confirmation, merchant policy approval, and adapter support.

Block or escalate unsafe, unsupported, or policy-violating actions.

Provide enough logs and traces for the merchant to understand what happened and why.

Later additions
After the MVP, the harness can be extended to support emerging agentic commerce protocols and external interfaces.

Possible later additions include:

Integration with commerce and agent interoperability protocols, such as a Universal Commerce Protocol or similar standards.

Integration with Agent Payment Protocol or payment-authorization protocols for controlled payment and checkout flows.

Support for standardized agent-to-agent communication between buyer agents and merchant sales agents.

Deeper platform integration with ecommerce systems such as Shopware, including catalog, pricing, rule builder, customer groups, promotions, cart, checkout, order, and admin workflows.

A merchant-facing configuration interface inside the ecommerce platform to manage sales-agent permissions, policies, approvals, observability, and connected channels.

Support for additional merchant systems such as PIM, ERP, OMS, pricing engines, tax services, shipping providers, and payment providers.
