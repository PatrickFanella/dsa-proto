# Scoped OAuth handoff

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

## Participant identity handoff

External applications can use the same state, HTTPS return-origin, PKCE, and
one-time-code flow with `mode=participant`. This mode requests only the base
`atproto` scope. Its exchange returns the authenticated DID and no bearer token
or record-write capability. The external application must still independently
prove control of any private contact channel before linking that DID to private
supporter data.
