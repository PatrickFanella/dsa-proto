# Local foundation integration stack

This stack is isolated from the legacy demo. It starts the reference PDS, Tap in acknowledged WebSocket mode, the AppView worker/API, Postgres, and the web client. A disposable initializer creates a local `did:plc` root account and shares only its DID with the AppView; its session material stays in an isolated local Docker volume.

Run `make verify-integration` after copying `.env.example` to an untracked `.env` if you need overrides. The automated runner creates the local root, publishes an organization and event to its PDS, observes both through Tap and the AppView as provisional, updates the event with CID concurrency, deletes it, and waits for the tombstone. It then restarts the API and Tap worker and proves the entity count and cursor survive unchanged. It also verifies that the temporary namespace can never resolve as `official`.

The runner authenticates directly to its disposable PDS account so it can remain non-interactive. Browser OAuth consent is tested separately in staging because consent belongs to the account operator and must not be bypassed by the application.

The default Tap image is intentionally local-only. Pin `TAP_IMAGE` and `PDS_IMAGE` to reviewed multi-architecture digests before promoting the topology to staging.
