# Governance

The technical system only works if legitimacy, safety, and change management are explicit. AT Protocol can publish signed claims, but DSA needs governance to decide which claims are official, verified, disputed, revoked, archived, community-submitted, or merely self-declared.

## Core questions

- Who controls official handles?
- How are chapters verified?
- How are caucuses recognized or labeled?
- How are committee accounts created and rotated?
- Who can publish official endorsements?
- How are corrections issued?
- How are disputes represented?
- Who owns schema evolution?
- Which apps are official?
- What data must never be published?

## Handle policy

Recommended handle pattern:

```text
@dsausa.org
@chapter.dsausa.org
@committee.chapter.dsausa.org
@caucus.dsausa.org
```

Handle policy should define:

- Who can request a handle
- What proof is required
- Who approves requests
- What happens when leadership changes
- How account recovery works
- How defunct entities are archived
- How impersonation is handled

Handles are human-readable. DIDs are the durable identity. Apps should store DIDs and display current handles.

## Verification model

Verification should be represented as explicit signed records, not hardcoded assumptions.

Examples:

- National verifies a chapter.
- Chapter verifies a committee.
- Caucus verifies publication accounts.
- Chapter verifies an endorsement record.
- A member self-declares an affiliation.
- An app labels a source as community-submitted or uncertain.

Suggested trust labels:

```text
official
verified-by-national
verified-by-chapter
verified-by-caucus
self-declared
community-submitted
secondary-source
uncertain
disputed
revoked
archived
```

Local demo note: `org.dsa.verification.assertion` models how public verification, dispute, revocation, and self-declaration assertions could work. In production, these records need a trust root, issuer authorization checks, key custody, recovery, rotation, revocation, dispute handling, and audit policy before apps treat them as official legitimacy.

## Authority and status model

For official infrastructure, record trust is primarily institutional authority, not just a link to an external source.

Every official or verified record should identify:

- issuing DID and current handle;
- organizational unit or role represented by the issuer;
- authority path that permits this issuer to publish this record type;
- effective date and, when applicable, expiration date;
- superseded, amended, revoked, archived, or disputed records;
- public source URLs or evidence where useful for auditability.

An official signature proves control of a key, not permanent legitimacy. Apps should evaluate the signature together with the authority graph, current revocation state, disputes, and safety policy.

## Chapter verification

A chapter identity should be verified by national or by a delegated regional process.

Minimum record:

- Chapter DID
- Chapter handle
- Jurisdiction
- Recognizing authority
- Effective date
- Status
- Public source, if available

Statuses:

```text
active
inactive
merged
dissolved
disputed
revoked
archived
```

## Caucus legitimacy

Caucuses may be official, unofficial, national, local, independent, temporary, or disputed. The system should not pretend all caucuses have the same status.

Recommended approach:

- Let caucuses publish independently.
- Let national, chapters, or other bodies issue verification assertions.
- Label status clearly in apps.
- Do not suppress unofficial caucuses by default, but do not imply official recognition.

Useful labels:

```text
recognized
chapter-recognized
independent
self-declared
inactive
disputed
archived
```

## Endorsement authority

Endorsements are politically sensitive and should have explicit authority.

An endorsement record should identify:

- Candidate or ballot measure
- Office or jurisdiction
- Election date
- Publishing entity
- Decision date
- Decision authority, if public
- Official source URL
- Status

Statuses:

```text
draft
published
corrected
rescinded
disputed
archived
```

Corrections should be additive. Avoid silently replacing history. Publish a correction record and let indexers mark the current state.

## Disputes and corrections

Disputes should be first-class records.

Examples:

- A chapter says an endorsement record is inaccurate.
- A caucus says an account is impersonating them.
- A source URL no longer supports the claim.
- A chapter has dissolved or split.

Apps should display dispute status rather than simply deleting public history, except where safety or legal policy requires removal.

## Schema evolution

Create a lightweight schema governance process:

1. Propose a Lexicon change.
2. Publish rationale and examples.
3. Test in one or more apps.
4. Mark experimental fields clearly.
5. Stabilize after implementation feedback.
6. Deprecate old fields with migration notes.

Principles:

- Prefer additive changes.
- Avoid breaking existing appviews.
- Keep records minimal and source-linked.
- Avoid modeling private internal data.
- Use DIDs and AT URIs for durable references.

## Official vs unofficial apps

The data layer should support both official and unofficial apps. However, apps should label themselves clearly.

Possible app labels:

```text
official-dsa
official-chapter
official-caucus
community
experimental
archival
research
```

Official apps may choose stricter trust filters. Community apps may show broader records but should preserve confidence labels.

## Data safety policy

Default rule: if publishing a record could expose a member, address, sensitive plan, disciplinary process, or private deliberation, do not publish it to AT Protocol.

Never publish by default:

- Raw voter addresses
- Member addresses
- Private phone numbers or emails
- Dues/payment status
- Internal member rosters
- Disciplinary or grievance records
- Sensitive direct action logistics
- Internal votes
- Private meeting minutes
- Personal data scraped from private systems

Safe public records should still be reviewed for risk. Public does not mean harmless.

## Operational responsibilities

For official infrastructure, define owners for:

- PDS hosting
- Account recovery
- Key rotation
- Incident response
- Schema registry
- Indexer maintenance
- API uptime
- Moderation and dispute queues
- Documentation
- Security review

## Recommended governance structure

Start minimal:

1. A small technical working group maintains Lexicons and indexers.
2. National or delegated bodies verify chapters.
3. Chapters verify their own committees and endorsements.
4. Caucuses can self-publish and seek verification where appropriate.
5. Apps must display trust labels.
6. Sensitive member data remains in private systems.
7. Corrections and disputes are public records when safe.
