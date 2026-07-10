# Local development

There are two local paths.

## Legacy fixture demo

The root `docker-compose.yml` preserves the existing API/web/Postgres demo. It is useful for reviewing the disposable `org.dsa.*` dataset and UI. Admin fixture ingest now defaults off; enable it explicitly only for local compatibility work:

```bash
ENABLE_ADMIN_INGEST=true docker compose up --build
```

It is not a PDS publication path and must remain disabled on public deployments.

## Foundation integration stack

`deploy/local/docker-compose.yml` starts:

- reference PDS;
- Tap with acknowledged delivery;
- AppView API and Tap worker;
- AppView Postgres;
- foundation-v1 web mode;
- networked integration runner.

Run:

```bash
make verify
make verify-integration
```

The offline gate never needs network access. The integration target pulls PDS/Tap images, creates a disposable local `did:plc` root account, publishes through its PDS, observes create/update/delete through Tap and the AppView, and proves the temporary namespace cannot return `official`. The test account and session stay in disposable Docker volumes. Browser OAuth consent remains an explicit staging step because the PDS account operator owns consent.

## Events publishing flow

In an OAuth-configured foundation environment, the Events app shows an organization publishing panel. Sign in with the controller handle, choose an organization profile authored by that DID, and publish deliberately public event content. Create/update/delete operations go to the controller PDS; the UI then waits separately for Tap and the AppView to observe the commit. Editing and deletion are shown only for records authored by the signed-in DID, and concurrent edits fail safely instead of overwriting a newer CID.

The default local Compose configuration leaves OAuth disabled until an operator supplies a PDS account and OAuth configuration. This keeps ordinary local startup deterministic and prevents demo credentials from entering source control.

## Canonical migration publication

For an OAuth-configured root account:

1. Visit `/oauth/login?handle=registry.pds-staging.dsaslate.us&mode=registry`.
2. Complete PDS consent for `authRegistryPublish`.
3. Run `make foundation-publish`.
4. Confirm records appear only after Tap delivers them to the AppView.

Never seed private membership, contact, payment, grievance, ballot, or internal logistics data.
