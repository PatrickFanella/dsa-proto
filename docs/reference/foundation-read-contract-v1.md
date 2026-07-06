# Foundation Read Contract v1

Status: frozen for prototype app development.

This reference is the supported read surface for apps built on the DSA AT Protocol foundation prototype. It freezes the read contract only. It does not grant write access.

## Stability rules

- Changes to this v1 contract should be additive by default.
- Required fields should not be removed without a migration note and deprecation window.
- Enum values should not be repurposed.
- New optional response fields may be added.
- Prototype fixture caveats remain part of the contract until production source-of-truth rules replace them.

## Read endpoints

All endpoints return JSON and include `prototype: true` at the top level unless noted.

| Endpoint | Purpose | Stable for apps |
| --- | --- | --- |
| `GET /api/entities` | Directory entities with filters. | Yes |
| `GET /api/entities/:id` | Single directory entity. | Yes |
| `GET /api/org-chart` | Public organizational graph projection. | Yes |
| `GET /api/records/resolve?uri=...` | Authority, lifecycle, trust, dispute, revocation, archive, and revision context for a record URI. | Yes |
| `GET /api/statements` / `GET /api/statements/:id` | Public statements. | Experimental app-layer read |
| `GET /api/publications` / `GET /api/publications/:id` | Publication profiles. | Experimental app-layer read |
| `GET /api/articles` / `GET /api/articles/:id` | Publication articles. | Experimental app-layer read |
| `GET /api/endorsements` / `GET /api/endorsements/:id` | Public endorsements. | Experimental app-layer read |
| `GET /api/events` / `GET /api/events/:id` | Public events. | Experimental app-layer read |
| `GET /api/activity` | Mixed public activity feed. | Experimental app-layer read |

`POST /api/admin/fixtures/ingest` is not part of this contract. It is local/dev fixture tooling and must not be used by apps.

## Directory entity shape

Directory entities expose a normalized current projection over chapter, caucus, org-unit, and opt-in public member-affiliation records.

Stable fields:

- `id`
- `recordUri`
- `type`
- `name`
- `shortName`
- `collection`
- `handle`
- `did`
- `jurisdiction`
- `trustLabel`
- `verificationStatus`
- `status`
- `record`

Optional fields may include `jurisdictionState`, `jurisdictionType`, `focusArea`, `publicRole`, `memberHandle`, `organizationHandle`, `verifiedBy`, `verificationReason`, `website`, and `searchText`.

Apps should link to `recordUri`, display `name`/`handle`, and use resolver data when authority or lifecycle context matters.

## Resolver shape

`GET /api/records/resolve?uri=...` returns:

- `uri`
- `record` when known
- `revisions`
- `authorityRecords`
- `lifecycleState`
- `trustLabel`
- `supportingAuthorityRecords`
- `activeDisputes`
- `activeRevocations`
- `archiveMarkers`
- `status`
- `caveats`
- `fixtureSourceOfTruthCaveat`

Resolver `status` values are:

- `valid`
- `expired`
- `unresolved`
- any canonical lifecycle state listed below when that state controls current interpretation.

Apps should treat `activeDisputes`, `activeRevocations`, and `archiveMarkers` as first-class context, not as hidden implementation details.

## Canonical vocabularies

### Trust labels

Trust labels describe confidence and institutional authority. They are not lifecycle states.

- `official`
- `verified-by-national`
- `verified-by-chapter`
- `verified-by-caucus`
- `self-declared`
- `community-submitted`
- `secondary-source`
- `uncertain`

### Lifecycle states

Lifecycle states describe currentness and record interpretation.

- `active`
- `inactive`
- `superseded`
- `deprecated`
- `revoked`
- `disputed`
- `archived`
- `tombstoned`

### Record-family workflow states

Some app-layer record families have their own workflow status values, such as `draft`, `published`, `withdrawn`, `cancelled`, `resolved`, or `scheduled`. These are not trust labels and should not be treated as canonical foundation lifecycle unless explicitly mapped by the API.

## Fixture caveat

For this prototype, the maintained fixture dataset is the source of truth. Apps must not present fixture data as externally validated production authority. Public UIs should preserve caveats for disputed, revoked, archived, uncertain, community-submitted, or fixture-only records.

## Write boundary

This v1 read contract does not include app writes. Future write APIs must use a dedicated `/api/write/*` surface with app registry scopes, idempotency, audit, and moderation. Apps must not use fixture replay/admin ingest as a write path.
