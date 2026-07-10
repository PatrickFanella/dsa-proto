# DSA Slate AT Protocol foundation docs

These documents describe the implemented `us.dsaslate.temp.*` AppView foundation and its explicit provisional boundary. The existing `org.dsa.*` fixture demo is retained as a read-only compatibility surface, not as the new protocol contract.

## Current sources of truth

- [current-state.md](current-state.md) — implemented and externally pending work
- [technical-architecture.md](technical-architecture.md) — PDS, Tap, AppView, OAuth, storage, and deployment
- [foundation-layer.md](foundation-layer.md) — public-data and application boundaries
- [foundation-contracts.md](foundation-contracts.md) — app-facing invariants
- [lexicons.md](lexicons.md) — canonical temporary record and permission Lexicons
- [governance.md](governance.md) — authority policy and activation gate
- [local-demo.md](local-demo.md) — legacy demo and new local integration stack
- [oauth-handoff.md](oauth-handoff.md) — one-time delegation OAuth handoff for external apps
- [production-demo-safety-guards.md](production-demo-safety-guards.md) — preserved read-only demo controls
- [../../deploy/almaz-staging/README.md](../../deploy/almaz-staging/README.md) — isolated staging runbook

## Stable references

- [../reference/foundation-read-contract-v1.md](../reference/foundation-read-contract-v1.md)
- [../reference/write-operations.md](../reference/write-operations.md)
- [../reference/stack.md](../reference/stack.md)

`app-ideas.md`, `authority-chain-validation.md`, and `atproto-ingestion-spike.md` are historical design notes. They may describe discarded `org.dsa.*` or raw-firehose approaches and are not the current contract.
