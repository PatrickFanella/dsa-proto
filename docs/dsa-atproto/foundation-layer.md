# Foundation Layer

The foundation layer is the shared public data base that downstream apps consume. In the current prototype it is implemented with curated ATProtocol-shaped fixtures, a resolver, graph validation, registry health checks, and read APIs.

## What the prototype proves now

- Public organizational identities can be represented as ATProto-shaped records.
- DIDs, handles, record URIs, and stable fixture IDs can support identity continuity.
- Authority, verification, dispute, revocation, archive, and lifecycle context can be attached to public records.
- Chapters, caucuses, org units, governance relationships, and opt-in public member-affiliation examples can be indexed into useful app views.
- App-layer public records can consume the foundation instead of redefining identity and authority.

## Source of truth

For this prototype, `backend/fixtures/records.json` is the canonical dataset. External public knowledge may inform fixture authorship, but the prototype does not model external citation/proof-chain records.

## Publication matrix

| Data class | Built stance | Current representation |
| --- | --- | --- |
| Public organizational identity | In scope | Chapter, caucus, org-unit profiles |
| Public organizational relationships | In scope | Governance relationship records and org-chart projection |
| Public verification/trust state | In scope | Verification assertion and authority records |
| Identity continuity | In scope | `org.dsa.identity.continuity` fixture records and projection helper |
| Optional public member affiliation | In scope with minimization | Opt-in public affiliation examples only |
| Public civic records | App-layer examples | Statements, publication profiles/articles, endorsements, events |
| Private/member/internal data | Out of scope | Rejected by policy; obvious unsafe payload keys rejected by guardrails |
| External citation/proof chains | Out of scope | Not modeled as records |
| Election/ballot systems | Out of scope | Not modeled as records or routes |

## Trust labels

Current trust labels are:

- `official`
- `verified-by-national`
- `verified-by-chapter`
- `verified-by-caucus`
- `self-declared`
- `community-submitted`
- `secondary-source`
- `uncertain`

`revoked`, `disputed`, `archived`, `superseded`, and `tombstoned` are lifecycle or resolver states, not trust labels.

## App boundary

Apps may consume foundation identities, graph relationships, lifecycle, trust labels, and resolver context. Apps should not self-upgrade trust labels, rewrite foundation identity, or publish foundation families through ordinary app-write paths.

The write gateway preview currently permits only scoped app-layer event submissions to become private pending-review operations for the demo registry app. The public Almaz demo keeps that gateway disabled.
