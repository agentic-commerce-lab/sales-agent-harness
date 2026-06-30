# Extending The Sales Agent Harness

This application is meant to be extended by adding new implementations behind stable boundaries, not by letting the agent runtime call commerce systems directly. Keep the harness as the control layer for policy, capability checks, normalization, session context, and audit logging.

## Core Boundaries

The intended flow is:

```text
Customer UI / A2A Buyer Agent
        |
        v
HTTP API / A2A HTTP+JSON
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
Commerce Backend
```

Important ownership rules:

- Runtime code belongs under `src/runtime/*`.
- Commerce backend code belongs under `src/commerce/*`.
- Merchant policy and capability enforcement belongs under `src/policy` and `src/harness`.
- External HTTP and A2A transport code belongs under `src/app` and `src/api`.
- Shared request, response, config, policy, and commerce types belong under `src/contracts`.
- Raw backend tokens and private merchant data must stay server-side.

The agent runtime, customer API, and A2A API must call harness tools or `HarnessCore`. They must not call Shopware, Store API, UCP, MCP, payment systems, or other commerce systems directly.

## Adding A New Agent Runtime

Use this when replacing LangGraph Deep Agents with another runtime.

1. Implement the runtime interface in `src/runtime/agent-runtime.ts`.
2. Put provider-specific code under `src/runtime/<provider>/`.
3. Convert `HarnessToolDefinition` values into the provider's tool format inside that provider folder.
4. Keep provider SDK imports out of `src/harness`, `src/commerce`, `src/policy`, and `src/contracts`.
5. Add a provider value to `src/env/app-config.ts`.
6. Wire the provider in `src/app/bootstrap.ts`.
7. Add tests proving the runtime receives only enabled harness tools and passes tool calls back through the harness.

Do not duplicate commerce logic in runtime prompts or provider adapters. The prompt can instruct the model, but policy decisions and commerce execution must remain deterministic harness behavior.

## Adding A New Commerce Adapter

Use this when adding another ecommerce platform or provider transport. The built-in examples are:

- `src/commerce/shopware`: direct Shopware Store API adapter.
- `src/commerce/shopware-ucp`: Agentic Commerce plugin UCP REST adapter.

1. Implement the `CommerceAdapter` contract from `src/contracts/commerce.ts`.
2. Create a folder under `src/commerce/<provider>/`.
3. Add a typed client boundary for provider API calls.
4. Normalize provider responses into the existing commerce contracts before returning to the harness.
5. Filter raw backend responses, private pricing data, margins, internal rules, customer secrets, and tokens.
6. Add a provider value to `src/env/app-config.ts`.
7. Wire the provider in `src/app/bootstrap.ts`.
8. Add adapter tests with mocked provider responses.

If the provider owns checkout continuation, set `checkoutHandoffMode: 'adapter'` when creating the app. Otherwise leave the default local mode, where the harness creates an opaque handoff token and stores it server-side.

Adapters should not evaluate merchant policy. They should execute already-approved commerce operations and return normalized results. Policy remains in the harness.

## Adding A New Capability

Capabilities affect model tools, API contracts, policy, adapter contracts, and tests. Add them deliberately.

1. Add the capability name to `src/contracts/config.ts`.
2. Add input and output types to `src/contracts/commerce.ts`.
3. Extend `CommerceAdapter` if the capability needs backend execution.
4. Add policy checks in `src/policy`.
5. Add a `HarnessCore` method or action runner path under `src/harness`.
6. Add tool definitions under `src/harness/*-tool-definitions.ts`.
7. Ensure `createToolRegistry` only exposes the tool when enabled in agent config.
8. Add HTTP parsing only if the capability should be callable through direct API routes.
9. Add tests for allowed, blocked, disabled, and unsafe cases.

Never add MVP-forbidden behavior, such as order placement, payment execution, legal-term acceptance, binding quotes, custom discounts, or customer account mutation, without first changing the product/spec decision and adding explicit policy controls.

## Extending Agent Configuration

Agent configuration is config-as-code under `config/agents/*.json` and loaded through `AGENT_CONFIG_PATH`.

When adding config fields:

1. Extend `AgentHarnessConfig` and Zod validation in `src/contracts/config.ts`.
2. Update `config/agents/demo-sales-agent.json`.
3. Add config validation tests in `tests/contracts/config.test.ts`.
4. Use typed config accessors instead of reading raw JSON throughout the app.

Environment variables belong in `src/env/*`. Do not scatter `process.env` reads through application code.

## Extending Policy

Policy checks should be deterministic and auditable.

When adding a policy rule:

1. Add stable reason codes and typed inputs.
2. Evaluate the rule before adapter execution.
3. Return `allow`, `block`, or `escalate`.
4. Include merchant, agent, session, channel, capability, and timestamp context.
5. Add tests proving the adapter is not called when a request is blocked.

Missing, uncertain, unsupported, or unauthorized data should block or escalate. Do not guess prices, stock, discounts, delivery promises, taxes, or customer-specific conditions.

## Extending HTTP And A2A Interfaces

The HTTP handler in `src/app/http-handler.ts` is transport glue. Keep it thin.

- Customer chat uses `POST /chat`.
- A2A uses `GET /.well-known/agent-card.json` and `POST /message:send`.
- Direct commerce tests use `/commerce/customer` and `/commerce/a2a`.
- Do not add legacy aliases for new behavior.

When adding transport behavior:

1. Validate input with Zod in a contract module.
2. Convert transport-specific payloads into application or harness calls.
3. Return safe response shapes without backend tokens.
4. Add route tests in `tests/app`.
5. Keep A2A changes aligned with the current A2A specification.

## Extending Observability

Auditability is a core feature. New flows should emit structured events through `src/observability/audit-log.ts`.

Capture:

- session ID, merchant ID, agent ID, and channel
- requested capability and tool call
- policy decision and reason
- data source used
- cart and handoff changes
- blocked, escalated, fallback, and error outcomes

Log `Error` objects or `cause` when wrapping failures. Do not log secrets, raw context tokens, private merchant data, or PII.

## Storage And Production Extensions

The MVP uses in-memory session, handoff, and audit stores. Production extensions should replace these behind interfaces rather than changing call sites broadly.

Recommended next production boundaries:

- persistent session store
- persistent handoff token store with TTL
- audit event sink
- API authentication and authorization
- rate limiting and abuse controls
- deployment secret management

## Testing Expectations

Every extension should include focused tests around merchant trust, commercial correctness, and safety.

Run the narrow checks while developing:

```bash
bun test
bun run format:check
bun run lint
bun run typecheck
```

Run the full quality gate before sharing:

```bash
bun run quality
```

For risky changes, add acceptance tests under `tests/acceptance` that prove disabled capabilities are not exposed, blocked requests do not reach adapters, confidential fields are filtered, and audit events explain the outcome.

## Extension Checklist

- The agent runtime does not call commerce systems directly.
- Disabled capabilities are not registered as tools.
- Every high-impact action has a policy decision.
- Raw backend tokens stay server-side.
- Adapter responses are normalized and filtered.
- Missing or uncertain data is blocked or escalated.
- A2A uses the spec-shaped endpoints, not legacy aliases.
- Tests cover allowed, blocked, disabled, and unsafe behavior.
- `bun run quality` passes.
