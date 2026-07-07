# Contributing

Thanks for your interest in the Sales Agent Harness. This is an experimental
MVP for controlled agentic commerce experiments; contributions are welcome.

## Getting started

Requirements: [Bun](https://bun.sh) (see `.bun-version`).

```bash
bun install
cp .env.example .env   # fill in real values for live testing
bun test               # unit/integration tests, no external services needed
bun run dev            # start the service with file watching
```

## Before opening a pull request

Run the standard checks:

```bash
bun run format:check
bun run lint
bun run typecheck
bun test
```

For larger changes, run the full quality gate (`bun run quality`). CI runs all
of this and is the final authority.

## Guidelines

- Keep the architecture boundaries intact: runtime-specific code stays behind
  `src/runtime/`, and `src/harness`, `src/commerce`, `src/policy`, and
  `src/contracts` must not import from it. See `docs/architecture.md` and
  `docs/extending.md`.
- Read environment variables only through the typed config accessors in
  `src/env/`, never `process.env` directly in application code.
- Add or update tests for behavior changes; new HTTP surface needs input
  validation and audit logging like the existing routes.
- Never commit real credentials. `.env` is gitignored; only placeholder values
  belong in `.env.example`.

## Reporting security issues

See [SECURITY.md](SECURITY.md) — please do not open public issues for
vulnerabilities.
