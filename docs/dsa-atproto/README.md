# DSA AT Protocol Prototype Docs

This directory documents what is currently built in `dsa-proto`: a fixture-backed, read-focused civic data layer prototype using AT Protocol-shaped records.

The public demo is read-only. Local developer tooling can author and replay fixtures, but it is not a production write system.

## Current built-state docs

- [current-state.md](current-state.md) — concise implementation summary
- [technical-architecture.md](technical-architecture.md) — built stack, storage, routes, and deployment posture
- [foundation-layer.md](foundation-layer.md) — current foundation boundary and publication matrix
- [foundation-contracts.md](foundation-contracts.md) — app-facing invariants implemented by the prototype
- [lexicons.md](lexicons.md) — implemented record families and vocabularies
- [governance.md](governance.md) — current trust, lifecycle, safety, and app-write governance rules
- [local-demo.md](local-demo.md) — local run, fixture replay, and UI walkthrough
- [production-demo-safety-guards.md](production-demo-safety-guards.md) — Almaz read-only guardrails
- [org-chart-alignment.md](org-chart-alignment.md) — current org graph fixture mapping notes

## Stable references

- [../reference/foundation-read-contract-v1.md](../reference/foundation-read-contract-v1.md) — supported app-facing read contract
- [../reference/write-operations.md](../reference/write-operations.md) — fail-closed write gateway and operation rules
- [../reference/stack.md](../reference/stack.md) — stack reference

## Historical and future-reference notes

These are not active implementation plans. They are retained for rationale or future production design context.

- [../why-at-proto.md](../why-at-proto.md)
- [authority-chain-validation.md](authority-chain-validation.md)
- [atproto-ingestion-spike.md](atproto-ingestion-spike.md)
- [app-ideas.md](app-ideas.md)
