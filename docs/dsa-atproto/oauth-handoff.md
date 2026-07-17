# OAuth Handoffs

## Delegation handoff

External organizing applications can request a one-time delegation-management
handoff without receiving the AppView browser cookie or ATProto refresh token.

1. Generate a PKCE verifier, its S256 challenge, and an opaque client state.
2. Redirect to `/oauth/login` with `mode=delegations`, `handle`,
   `handoff_return_uri`, `handoff_state`, and `handoff_challenge`.
3. AppView completes ATProto OAuth and redirects to the allowlisted return URI
   with a short-lived one-time `code` and the original client state.
4. Exchange `code` and the PKCE `verifier` at `/oauth/handoff/exchange`.
5. Use the returned bearer once at `/api/v1/delegation-handoff/records` to
   create, update, or delete an `us.dsaslate.temp.authorityDelegation` record.

Return origins are configured through `OAUTH_HANDOFF_RETURN_ORIGINS` as a
comma-separated HTTPS allowlist. Codes expire after 60 seconds by default;
write bearers expire after five minutes and are consumed on first use. The
handoff never exposes AppView's browser session or the underlying ATProto OAuth
session to the external application.

## Identity-only handoff (v1)

`/oauth/identity/v1/*` is a separate, login-only flow. It uses the dedicated
metadata document at `/oauth/identity/v1/client-metadata.json`, callback at
`/oauth/identity/v1/callback`, and exactly the ATProto OAuth scope `atproto`.
It does not share delegation state, codes, metadata, or OAuth sessions.

1. A client calls `beginIdentityHandoff({ handle, audience, returnUri })`.
   It creates a 32-byte PKCE verifier/S256 challenge and 16-byte client state,
   then returns an authorization URL for `/oauth/identity/v1/authorize`.
2. The begin URL contains `handle`, canonical `audience`, `return_uri`, `state`,
   and `code_challenge`. The audience is an HTTPS origin string exactly equal
   to `new URL(audience).origin`; `return_uri` must be HTTPS, have that origin,
   may retain its path/query, and has its fragment removed. Origins must be in
   `OAUTH_IDENTITY_RETURN_ORIGINS` (separate from delegation's allowlist).
3. The callback correlates only its application state, fails closed if it is
   missing/expired, and redirects with `code` and the original client `state`.
4. `POST /oauth/identity/v1/exchange` accepts `{ code, verifier, audience }`
   and returns exactly `{ did, audience, authenticatedAt, expiresIn: 60 }`.

Expected identity errors have `{ contractVersion: "v1", error }`, with stable
`invalid_request`, `invalid_correlation`, or `invalid_code` codes. Unexpected
OAuth, database, and programming failures return stable `internal_error` (500)
without error details. Redirects
and identity responses use `Cache-Control: no-store` and `Referrer-Policy:
no-referrer`.

The login-only callback transiently persists encrypted OAuth authorization
state, including its DPoP private material, in a dedicated state namespace for
at most five minutes of logical validity. This lets callbacks work across
instances. A successful callback consumes that state; abandoned encrypted rows
are opportunistically physically deleted on identity-state reads and writes.
The identity client uses a non-persistent session store, extracts only the DID,
and discards the session: no completed OAuth session, access token, or refresh
token is persisted. Request/code rows retain only hashes for OAuth state and
code, plus the DID, bound audience/return URI/challenge and timestamps. Request
rows also retain the client state verbatim solely to return it after callback:
it is a 128-bit opaque CSRF correlation value, not a credential. Authentication
and the logical 60-second code expiry are anchored to PostgreSQL `now()`.
Expired code rows are opportunistically deleted before code issuance and
exchange. A successfully validated code is deleted in its exchange transaction
before commit, so it retains no post-consumption DID, audience, return URI, or
PKCE metadata; a replay finds no row and fails.
