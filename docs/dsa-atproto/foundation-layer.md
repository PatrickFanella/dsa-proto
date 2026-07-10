# Foundation layer

The foundation is a reusable public organizational vocabulary plus a separate DSA policy layer. Apps consume entity, graph, provenance, lifecycle, and authority views rather than recreating those decisions.

| Data class | Public v1 stance |
| --- | --- |
| Stable non-person organization identity/profile | Included |
| Directed organization relationships | Included |
| Delegations, attestations, disputes, revocations, archives, supersession | Included |
| DSA unit classification and provisional policy | Included in policy layer |
| Deliberately public events | First app-writable family |
| Statements/publications/articles/endorsements | Deferred one family at a time |
| People, membership, interests, contacts, payments, grievances, ballots, private logistics | Rejected |

The canonical staging dataset is produced deterministically from legacy fixtures, but it is published to the registry PDS and learned through Tap. Fixture trust labels and timestamps are not authority. Bootstrap source URL, row hash, and import time are provenance only.

The old read-only demo remains available during staging. There is no dual-write path between `org.dsa.*` and `us.dsaslate.temp.*`.
