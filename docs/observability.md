# Observability

Logging and traces are part of the research preview because merchants and internal evaluators need
to review what data the agent used, which tools it called, which policies were applied, and why
actions were allowed or blocked.

## Audit Events

Structured audit events cover:

- sessions
- user requests and agent responses
- tool calls and requested capabilities
- policy checks and decisions
- data sources used
- Shopware Store API and UCP calls
- cart creation, cart updates, and cart summaries
- checkout handoff URL creation
- blocked actions, errors, fallbacks, and escalations
- checkout completions in the explicit UCP research path

Events include merchant, agent, session, channel, capability, policy decision, data source, and
timestamp fields where applicable.

## SQLite Persistence

The default app uses in-memory stores for demos. Set `STORAGE_PROVIDER=sqlite` to persist sessions,
handoff records, audit events, runtime run records, checkout idempotency keys, and native LangGraph
checkpoints in one SQLite database. `SQLITE_DB_PATH` controls the database location and defaults to
`data/sales-agent-harness.sqlite`.

For the default runnable app, SQLite checkpointing is automatic:
`createRunnableSalesAgentHarnessApp()` creates a Bun-native SQLite LangGraph checkpointer and passes
it to Deep Agents.

For custom embeddings that construct `createLangGraphDeepAgentRuntime()` directly, call
`createSqliteLangGraphCheckpointSaver(databasePath)` and pass it as `checkpointSaver`.

## Exported Stores

The SQLite-backed classes are exported for direct embedding:

- `SqliteSessionStore`
- `SqliteHandoffStore`
- `SqliteAuditLogger`
- `SqliteAgentRunStore`
- `SqliteCheckoutIdempotencyStore`

These implementations keep raw Shopware context tokens server-side while allowing sessions, handoff
records, audit events, run records, and checkout idempotency records to survive process restarts.

The app-level SQLite runtime smoke test covers this path with a fake Deep Agent: one app instance
writes a LangGraph checkpoint through the runtime, a second app instance reopens the same SQLite
database, and the runtime reads the checkpoint back through the configured `thread_id`.
