# Contributing

This repository is the `dsa-proto` prototype. Keep changes small, reviewable, and aligned with the public-data safety boundary in `docs/dsa-atproto/`.

## Development flow

1. Create or pick an issue before making non-trivial changes.
2. Create a branch from `main`.
3. Make the smallest change that satisfies the issue.
4. Run verification:

   ```bash
   make verify
   ```

5. Open a pull request using the PR template.
6. Link the issue with `Closes #N` when appropriate.

## Commit style

Prefer concise conventional-style subjects:

```text
feat: add stack recipe
docs: update Open Pilot guidance
fix: correct make target detection
chore: refresh project metadata
```

## Open Pilot issues

Use `.gitea/ISSUE_TEMPLATE/open-pilot-task.yaml` for tasks that Open Pilot should implement.

Open Pilot requires:

- `ready-for-agent`
- `agent:queued`
- a deterministic `Test Command`

The issue template adds `ready-for-agent`; add `agent:queued` only after the issue is complete and ready for automation.

Good Open Pilot tasks are:

- one focused outcome
- clear context and constraints
- explicit out-of-scope notes
- verifiable from the repository root

## Verification commands

Use the narrowest deterministic command that proves the change.

Default full check:

```bash
make verify
```

Examples for narrower checks:

```bash
go test ./...
pnpm --dir web run test
uv run pytest
cargo test --all
docker compose config --quiet
```

## Prototype boundaries

Keep sensitive internal organizing data out of scope unless a future issue explicitly introduces privacy architecture and security review.
