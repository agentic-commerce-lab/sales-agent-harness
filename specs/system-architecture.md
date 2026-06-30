## Proposed system architecture and workflows

The MVP should be built as a separate **Seller Agent Harness Service** that can run locally or in a merchant-controlled environment. The service connects to an ecommerce platform such as Shopware as the first commerce backend, while remaining flexible enough to support other systems later.

The architecture should separate the sales agent experience from the commerce execution layer. The sales agent can understand user intent, guide the conversation, and request actions, but all commerce-related operations should go through the harness. The harness is responsible for policy checks, trusted data access, cart preparation, checkout handoff, logging, and safety controls.

At a high level, the system consists of:

* **Agent interfaces** for customer UI integration and agent-to-agent communication, such as A2A.
* **Sales agent orchestrator** that handles conversation flow and decides which capabilities are needed.
* **Seller Agent Harness Service** that controls tool access, policies, permissions, data handling, and observability.
* **Commerce adapter layer** that connects the harness to Shopware catalog and cart APIs.
* **Future protocol adapters** for Universal Commerce Protocol, Agent Payment Protocol, MCP, or other agentic commerce standards.

For the MVP, Shopware should act as the first system of record for catalog and cart functionality. The initial architecture should support product search, product details, cart creation, cart updates, and checkout handoff. Quote creation, negotiation, approvals, payments, and autonomous order placement can be added later.

### Main workflow

A typical MVP workflow starts when a customer or buyer agent interacts with the sales agent through a customer UI or A2A interface.

The sales agent identifies the user’s intent and requests the required commerce capability from the harness. Before any action is executed, the harness checks whether the action is allowed based on the merchant configuration. If allowed, the harness retrieves product data or prepares a cart through the Shopware adapter.

The sales agent then presents the result back to the customer or buyer agent using only the trusted data returned by the harness. If the user wants to proceed, the harness can prepare a checkout handoff. The final checkout remains under merchant control and is not completed autonomously by the agent in the MVP.

### Example workflow

1. A customer or buyer agent asks for a product.
2. The request enters through the customer UI or A2A interface.
3. The sales agent identifies the intent as product discovery.
4. The harness checks whether product search is allowed.
5. The harness retrieves product information from Shopware.
6. The sales agent presents the product result.
7. The customer asks to add the product to a cart.
8. The harness checks whether cart preparation is allowed.
9. The harness creates or updates a Shopware cart.
10. The sales agent shows a cart summary.
11. The customer confirms they want to continue.
12. The harness prepares a checkout handoff.
13. The customer completes checkout through the merchant-controlled checkout flow.

### Observability

The MVP should log the important parts of each interaction, including user requests, agent responses, tool calls, policy checks, Shopware calls, cart changes, blocked actions, and checkout handoffs. This allows the merchant or internal team to review how the sales agent behaved, understand why actions were allowed or blocked, and evaluate the quality of the sales-agent experience.

Overall, the architecture should provide a controlled foundation for experimenting with merchant sales agents while keeping commerce data, cart handling, checkout, and policy enforcement under merchant control.
