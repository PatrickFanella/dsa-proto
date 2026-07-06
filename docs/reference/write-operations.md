# Write Operations Reference

- `ENABLE_WRITE_GATEWAY=false` by default; `/api/write/records` stays closed unless enabled.
- `ENABLE_WRITE_PUBLISH=false` by default; non-dry-run publish requests are blocked unless it is enabled too.
- `DEMO_READ_ONLY=true` disables all write routes.
- The Almaz public demo keeps both write flags false and blocks `/api/write*` at Caddy as a second guard.
- Dry-run requests validate headers, scope, and optimistic concurrency without mutating public records.
- Review-required apps create private `pending_review` operations only.
- Publish-eligible apps append public records only after optimistic-concurrency checks pass.
- The first app-writable family is `org.dsa.event.public`; statements, articles, endorsements, identity, authority, verification, org graph, archive, dispute, revocation, and member-affiliation families remain closed to ordinary app writes.
