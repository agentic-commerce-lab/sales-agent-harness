# Documentation

These docs are for external readers evaluating or extending the Sales Agent Harness research
preview. The project is not production software; see the root [README](../README.md) for the
research-preview scope, capabilities, quick start, and known limits.

## Start Here

- To get the demo running, start with the root [Quick Start](../README.md#quick-start), then follow
  the [Demo Journey](demo-journey.md). For buyer-agent testing, use the
  [A2A buyer demo](../examples/a2a-demo/README.md).
- To customize the harness, read [Extending The Harness](extending.md). It covers where to add
  commerce adapters, capabilities, policy rules, runtimes, routes, storage, and observability
  without bypassing the harness.
- Use [Architecture](architecture.md) as supporting context when you need the request flow,
  boundaries, and replaceable runtime/adapter structure.

## What Belongs Here

Keep `docs/` focused on material useful to someone outside the original implementation context:

- how the preview works
- how to run or evaluate it
- how to extend it safely
- what is intentionally out of scope

Implementation plans, internal research notes, scratch investigations, and agent workflow logs
should stay outside this external docs section unless they are rewritten as durable user-facing
guidance.
