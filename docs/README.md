# Documentation

These docs are for external readers evaluating or extending the Sales Agent Harness research
preview. The project is not production software; see the root [README](../README.md) for the
research-preview scope, capabilities, quick start, and known limits.

## Start Here

- [Architecture](architecture.md) explains the control-layer design, request flow, boundaries,
  and replaceable runtime/adapter seams.
- [Demo Journey](demo-journey.md) walks through a local merchant/customer/A2A demo using the
  existing routes and capabilities.
- [Extending The Harness](extending.md) describes how to add runtimes, commerce adapters,
  capabilities, policy rules, transport routes, storage implementations, and observability without
  bypassing the harness.

## What Belongs Here

Keep `docs/` focused on material useful to someone outside the original implementation context:

- how the preview works
- how to run or evaluate it
- how to extend it safely
- what is intentionally out of scope

Implementation plans, internal research notes, scratch investigations, and agent workflow logs
should stay outside this external docs section unless they are rewritten as durable user-facing
guidance.
