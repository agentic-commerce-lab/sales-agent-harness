# Seller Agent Harness MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a TypeScript Seller Agent Harness MVP that lets a merchant-controlled sales agent safely search products, retrieve details, prepare carts, summarize carts, and create non-binding checkout handoffs through Shopware Store API data.

**Architecture:** Keep LangGraph Deep Agents and external interfaces behind runtime/API boundaries. Route every commerce action through typed harness tools, capability checks, policy decisions, response filtering, session context storage, and structured audit events before reaching the Shopware adapter. Treat Shopware Store API as the first concrete backend while keeping the `CommerceAdapter` contract platform-neutral.

**Tech Stack:** TypeScript strict mode, Bun scripts, Biome, oxlint, Fallow quality gate, Zod for runtime contracts, Shopware Store API, future LangGraph Deep Agents boundary.

---

## Source Specs

- `specs/project-goal.md`
- `specs/technical-concept.md`
- `specs/shopware-integration.md`
- `specs/system-architecture.md`
- `AGENTS.md`

## MVP Scope

Allowed capabilities:

- `searchProducts`
- `getProductDetails`
- `createCart`
- `updateCart`
- `getCartSummary`
- `prepareCheckoutHandoff`

Explicitly out of scope for MVP:

- Order placement
- Payment execution
- Legal-term acceptance
- Binding quotes
- Custom discount negotiation
- Customer account mutation
- Direct Shopware access from agent runtime

## Proposed File Structure

- Create `src/contracts/commerce.ts`: normalized product, cart, checkout, and adapter contracts.
- Create `src/contracts/config.ts`: agent, merchant, capability, channel, and policy contracts.
- Create `src/contracts/policy.ts`: policy decision, denial reason, and audit-safe decision types.
- Create `src/contracts/session.ts`: agent session and server-side commerce context contracts.
- Create `src/config/load-agent-config.ts`: JSON config loader and Zod validation.
- Create `config/agents/demo-sales-agent.json`: MVP config-as-code example.
- Create `src/policy/evaluate-policy.ts`: capability and policy checks.
- Create `src/policy/restricted-actions.ts`: constants for unsupported/binding action denials.
- Create `src/session/session-store.ts`: in-memory session and Shopware context token storage.
- Create `src/commerce/commerce-adapter.ts`: platform-neutral `CommerceAdapter` interface export.
- Create `src/commerce/shopware/shopware-store-api-client.ts`: typed Store API HTTP client boundary.
- Create `src/commerce/shopware/shopware-adapter.ts`: Shopware implementation of `CommerceAdapter`.
- Create `src/commerce/shopware/normalize-shopware.ts`: normalization and confidential-field filtering.
- Create `src/handoff/handoff-store.ts`: short-lived opaque handoff token storage.
- Create `src/handoff/prepare-checkout-handoff.ts`: handoff creation and URL generation.
- Create `src/harness/harness-core.ts`: policy-checked commerce execution facade.
- Create `src/harness/tool-registry.ts`: exposes only enabled tools to agent runtime.
- Create `src/runtime/agent-runtime.ts`: replaceable agent runtime interface.
- Create `src/runtime/langgraph/langgraph-runtime.ts`: LangGraph adapter placeholder boundary.
- Create `src/api/customer-api.ts`: customer UI request boundary.
- Create `src/api/a2a-api.ts`: A2A request boundary.
- Create `src/observability/audit-log.ts`: structured audit event contract and logger.
- Modify `src/index.ts`: export public contracts and factories only.
- Create `tests/contracts/config.test.ts`: config validation tests.
- Create `tests/policy/evaluate-policy.test.ts`: allow/block policy tests.
- Create `tests/session/session-store.test.ts`: context token protection tests.
- Create `tests/commerce/shopware-adapter.test.ts`: adapter normalization tests with mocked Store API.
- Create `tests/harness/harness-core.test.ts`: capability routing and blocked-action tests.
- Create `tests/handoff/prepare-checkout-handoff.test.ts`: opaque handoff token tests.
- Create `tests/harness/tool-registry.test.ts`: disabled tools are not registered.
- Create `tests/observability/audit-log.test.ts`: required event fields tests.

## Epic 1: Contracts and Config-as-Code Foundation

Establish typed contracts before runtime logic so all later work uses shared names and explicit boundaries.

- [x] Add Zod dependency with `bun add zod`.
- [x] Create `src/contracts/commerce.ts` with `CommerceAdapter`, product search/detail, cart, cart update, cart summary, and checkout handoff input/result types.
- [x] Create `src/contracts/config.ts` with `AgentChannel`, `HarnessCapability`, `AgentHarnessConfig`, and policy fields from the specs.
- [x] Create `src/contracts/policy.ts` with `PolicyDecision`, `PolicyDecisionReason`, and `PolicyAuditContext`.
- [x] Create `src/contracts/session.ts` with `AgentSession`, `CommerceContext`, and a `shopwareContextToken` field documented as server-side only.
- [x] Create `src/config/load-agent-config.ts` that validates JSON config through Zod and returns typed config.
- [x] Add `config/agents/demo-sales-agent.json` enabling only the MVP capabilities and disabling quotes, negotiation, payments, and order creation.
- [x] Update `src/index.ts` to export contracts and config loader through package public API.
- [x] Test config validation in `tests/contracts/config.test.ts`, including rejection of unknown capabilities and invalid channels.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 2: Policy and Capability Enforcement

Make policy checks central and deterministic before any Shopware or agent integration work.

- [x] Create `src/policy/restricted-actions.ts` with unsupported action constants: `placeOrder`, `executePayment`, `acceptLegalTerms`, `createBindingQuote`, `negotiateCustomDiscount`, and `modifyCustomerAccount`.
- [x] Create `src/policy/evaluate-policy.ts` with checks for enabled capability, allowed channel, blocked category, blocked product, max quantity, max cart value, unsupported region, checkout handoff permission, and human approval requirement.
- [x] Return structured allow/block/escalate decisions with stable reason codes.
- [x] Preserve merchant ID, agent ID, channel, session ID, capability, timestamp, and decision reason in every policy result.
- [x] Add unit tests for allowed search, disabled capability, blocked product, blocked category, unsupported region, cart value limit, quantity limit, and checkout requiring approval.
- [x] Add explicit tests proving MVP-forbidden actions are blocked even if requested indirectly.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 3: Session and Context Token Handling

Keep Shopware cart context server-side and scoped to agent sessions.

- [x] Create `src/session/session-store.ts` with an in-memory implementation for MVP demos.
- [x] Support creating sessions with `agentSessionId`, `merchantId`, `agentId`, `channel`, `customerContext`, and `createdAt`.
- [x] Support storing and reading Shopware sales channel ID and Store API context token by session ID.
- [x] Ensure public session snapshots never include raw Shopware context tokens.
- [x] Add tests proving context tokens are stored server-side and excluded from agent/customer/A2A response shapes.
- [x] Add tests for missing session, merchant mismatch, and expired session behavior.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 4: Shopware Store API Adapter

Implement the first real commerce backend behind the platform-neutral adapter contract.

- [x] Create `src/commerce/commerce-adapter.ts` that re-exports the adapter interface from `src/contracts/commerce.ts`.
- [x] Create `src/commerce/shopware/shopware-store-api-client.ts` with typed methods for product search, product detail lookup, cart creation, line-item update, cart read, and checkout URL base data.
- [x] Add typed config access for Shopware base URL, Store API access key, and default sales channel without scattering `process.env`.
- [x] Create `src/commerce/shopware/normalize-shopware.ts` to map Store API responses into safe product/cart contracts.
- [x] Filter confidential fields, raw API payloads, internal margins, private pricing logic, and raw context tokens.
- [x] Create `src/commerce/shopware/shopware-adapter.ts` implementing `searchProducts`, `getProductDetails`, `createCart`, `updateCart`, `getCartSummary`, and `prepareCheckoutHandoff` dependencies.
- [x] Wrap Store API errors with `Error` using `cause`.
- [x] Add adapter tests with mocked Store API responses for product search, details, cart create/update, cart summary, missing data, and token filtering.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 5: Harness Core and Tool Registry

Create the controlled execution layer that agent runtimes and APIs call instead of commerce systems.

- [x] Create `src/harness/harness-core.ts` with one method per MVP capability.
- [x] For each method, load session and config, evaluate policy, emit audit event, call the commerce adapter only when allowed, normalize the result, emit completion event, and return a safe response.
- [x] Return blocked or escalated responses without calling the adapter when policy denies the action.
- [x] Create `src/harness/tool-registry.ts` that registers only enabled capabilities for a specific agent config.
- [x] Ensure disabled capabilities are absent from the registry rather than present and self-blocking.
- [x] Add tests proving disabled tools are not registered.
- [x] Add harness tests proving every commerce method emits policy and tool-call audit events.
- [x] Add tests proving denied actions do not call the adapter.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 6: Checkout Handoff

Implement non-binding handoff with opaque, short-lived tokens and cart summary preservation.

- [x] Create `src/handoff/handoff-store.ts` with an in-memory MVP store for handoff records.
- [x] Handoff records must include `handoffId`, `agentSessionId`, `merchantId`, `shopwareSalesChannelId`, server-side Shopware context token reference, cart summary, `expiresAt`, and status.
- [x] Create `src/handoff/prepare-checkout-handoff.ts` that creates a securely generated opaque token and returns `continueUrl`.
- [x] Ensure `continueUrl` contains only the opaque handoff token, never the Shopware context token.
- [x] Add validation for expiry, merchant scope, sales-channel scope, and one-time or limited-use status.
- [x] Add tests for token opacity, expiry, merchant mismatch, sales-channel mismatch, and successful handoff resolution.
- [x] Add a follow-up checklist item for the future Shopware app Context Gateway endpoint without implementing Checkout Gateway in the MVP.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 7: Runtime and API Boundaries

Add replaceable boundaries for LangGraph, customer UI, and A2A without putting commerce logic into those layers.

- [x] Create `src/runtime/agent-runtime.ts` with a minimal interface for sending user input and receiving a response.
- [x] Create `src/runtime/langgraph/langgraph-runtime.ts` as the LangGraph integration boundary that consumes the tool registry.
- [x] Keep LangGraph-specific imports out of `src/harness`, `src/commerce`, `src/policy`, and `src/contracts`.
- [x] Create `src/api/customer-api.ts` that maps customer UI requests into harness calls.
- [x] Create `src/api/a2a-api.ts` that maps A2A buyer-agent requests into harness calls and returns safe response shapes.
- [x] Ensure both APIs use the same harness core and never call Shopware directly.
- [x] Add tests proving API handlers call harness methods rather than adapter/client methods.
- [x] Add tests proving A2A checkout handoff returns `continueUrl` with only an opaque token.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 8: Observability and Audit Trail

Make logs and traces part of MVP behavior, not a later add-on.

- [x] Create `src/observability/audit-log.ts` with structured event types for sessions, user requests, agent responses, tool calls, policy checks, Shopware calls, cart changes, blocked actions, errors, and handoffs.
- [x] Implement a logger interface and an in-memory test logger; avoid `console` in application code.
- [x] Include `agentSessionId`, `merchantId`, `agentId`, `channel`, `capability`, `policyDecision`, `dataSources`, and timestamp where applicable.
- [x] Ensure errors log the error object or `cause`, not only `error.message`.
- [x] Add tests that harness calls emit required audit events for allowed, blocked, errored, cart update, and handoff flows.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 9: MVP Acceptance and Safety Test Suite

Add behavior tests around merchant trust, commercial correctness, and safety.

- [x] Add product discovery tests proving results come from mocked trusted Shopware data.
- [x] Add product detail tests proving confidential fields and raw backend response fields are filtered.
- [x] Add missing/uncertain data tests proving the harness blocks or clearly marks unavailable data instead of guessing.
- [x] Add capability-disabled behavior tests for each MVP tool.
- [x] Add policy-allowed and policy-blocked tests for region, category, product, quantity, cart value, and checkout handoff.
- [x] Add cart creation and update flow tests using the harness core.
- [x] Add checkout handoff creation tests with cart summary and opaque `continueUrl`.
- [x] Add rejection tests for order placement, payment execution, legal-term acceptance, binding quotes, custom discount negotiation, and customer account mutation.
- [x] Add context-token protection tests across session, adapter, handoff, API, and audit response shapes.
- [x] Add logging tests for tool calls, policy decisions, cart changes, blocked actions, and handoffs.
- [x] Verify with `bun run format:check && bun run lint && bun run typecheck`.

## Epic 10: Quality Gate and Documentation Closeout

Keep the MVP maintainable and make the architecture decisions visible to future contributors.

- [x] Update `README.md` or create it if absent with MVP scope, setup, config example, and local verification commands.
- [x] Document that Checkout Gateway, UCP, MCP, payments, orders, quotes, and negotiations are future integrations.
- [x] Add an architecture note that the agent runtime is replaceable and must not call Shopware directly.
- [x] Run `bun run quality:fallow && bun run quality:health` after architecture/import boundaries are in place.
- [x] Run `bun run quality` before opening the MVP PR.
- [x] Review the final implementation against `AGENTS.md` conventions for TypeScript, logging, error handling, contracts, environment config, and structure.
- [x] Confirm CI remains the final authority.

## Execution Order

1. Epic 1: Contracts and config-as-code
2. Epic 2: Policy and capability enforcement
3. Epic 3: Session and context token handling
4. Epic 4: Shopware Store API adapter
5. Epic 8: Observability foundation, then wire it through Epic 5
6. Epic 5: Harness core and tool registry
7. Epic 6: Checkout handoff
8. Epic 7: Runtime and API boundaries
9. Epic 9: MVP acceptance and safety tests
10. Epic 10: Quality gate and documentation closeout

## Definition of Done

- Merchant config controls which tools are registered.
- Every commerce action goes through policy evaluation before adapter execution.
- The agent runtime, customer API, and A2A API never call Shopware directly.
- Shopware Store API responses are normalized before reaching the model, buyer agent, or customer.
- Raw Shopware context tokens are stored server-side only.
- Checkout handoff returns an opaque `continueUrl` and remains non-binding.
- Forbidden MVP actions are blocked or escalated.
- Missing or uncertain data is surfaced clearly instead of guessed.
- Structured audit events explain allowed, blocked, errored, cart, and handoff behavior.
- The narrow checks pass during implementation, and `bun run quality` passes before PR completion.

## Self-Review

- Spec coverage: The plan covers trusted merchant data, policy control, cart preparation, checkout handoff, safety controls, observability, Shopware Store API integration, A2A/customer UI boundaries, and future protocol separation.
- Explicit non-goals: The plan excludes autonomous orders, payments, legal acceptance, binding quotes, custom discount negotiation, customer account mutation, Checkout Gateway, UCP execution, and MCP customer-facing flows.
- Quality alignment: The plan uses typed contracts, runtime validation, structured logging, `Error` wrapping with `cause`, typed config access, boundary-oriented structure, and the repository quality commands from `AGENTS.md`.
