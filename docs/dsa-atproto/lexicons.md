# Proposed Lexicons

AT Protocol Lexicons define record types. A DSA ecosystem would need shared schemas so many apps can read and write compatible records.

Use a namespace such as:

```text
org.dsa.*
```

These examples are conceptual. They are not complete formal Lexicon JSON definitions yet.

## Profiles

### `org.dsa.profile.chapter`

Represents a public chapter identity.

```json
{
  "$type": "org.dsa.profile.chapter",
  "name": "New York City DSA",
  "shortName": "NYC-DSA",
  "jurisdiction": {
    "type": "city",
    "name": "New York City",
    "state": "NY",
    "country": "US"
  },
  "website": "https://socialists.nyc/",
  "contactUrl": "https://socialists.nyc/contact",
  "parentOrg": "did:plc:dsausa",
  "status": "active",
  "sources": ["at://did:plc:nycdsa/org.dsa.source.citation/example"]
}
```

### `org.dsa.profile.caucus`

Represents a caucus, tendency, or organized political formation.

```json
{
  "$type": "org.dsa.profile.caucus",
  "name": "Example Caucus",
  "scope": "national",
  "website": "https://example.org",
  "description": "Public caucus description.",
  "verificationStatus": "verified-by-national",
  "sources": []
}
```

### `org.dsa.profile.committee`

Represents a committee, working group, or subcommittee.

```json
{
  "$type": "org.dsa.profile.committee",
  "name": "Electoral Working Group",
  "parent": "did:plc:nycdsa",
  "scope": "chapter",
  "description": "Coordinates public electoral work.",
  "contactUrl": "https://example.org/contact"
}
```

## Affiliations

### `org.dsa.affiliation.member`

Represents an individual public self-declared affiliation. This should not imply verified membership unless accompanied by a separate verification record.

```json
{
  "$type": "org.dsa.affiliation.member",
  "member": "did:plc:member123",
  "organization": "did:plc:nycdsa",
  "relationship": "self-declared-member",
  "visibility": "public",
  "createdAt": "2026-06-30T00:00:00Z"
}
```

### `org.dsa.affiliation.chapter`

Represents a chapter's relationship to a parent organization.

```json
{
  "$type": "org.dsa.affiliation.chapter",
  "chapter": "did:plc:nycdsa",
  "parentOrg": "did:plc:dsausa",
  "relationship": "recognized-chapter",
  "status": "active",
  "effectiveDate": "2026-01-01"
}
```

## Verification

### `org.dsa.verification.assertion`

Represents a trust assertion from one identity about another identity or record.

```json
{
  "$type": "org.dsa.verification.assertion",
  "subject": "did:plc:nycdsa",
  "claim": "recognized-chapter",
  "issuer": "did:plc:dsausa",
  "status": "active",
  "effectiveDate": "2026-01-01",
  "expiresAt": null,
  "sources": []
}
```

Possible statuses:

```text
active
disputed
revoked
expired
archived
```

## Endorsements and electoral records

### `org.dsa.endorsement.candidate`

Represents a public endorsement or recommendation related to a candidate.

```json
{
  "$type": "org.dsa.endorsement.candidate",
  "candidate": {
    "name": "Jane Example",
    "externalIds": {
      "fec": null,
      "ballotpedia": "jane-example"
    }
  },
  "office": "City Council District 8",
  "jurisdiction": "New York City",
  "electionDate": "2026-11-03",
  "position": "endorse",
  "endorsedBy": "did:plc:nycdsa",
  "decisionDate": "2026-02-10",
  "sources": [
    {
      "url": "https://example.org/endorsements/jane-example",
      "label": "chapter endorsement page",
      "confidence": "official"
    }
  ],
  "confidence": "official"
}
```

Possible positions:

```text
endorse
recommend
oppose
no-endorsement
rescinded
```

### `org.dsa.guide.electoral`

Represents a voter guide or election guide.

```json
{
  "$type": "org.dsa.guide.electoral",
  "title": "2026 Primary Voter Guide",
  "publisher": "did:plc:nycdsa",
  "jurisdiction": "New York City",
  "electionDate": "2026-06-23",
  "recommendations": [
    "at://did:plc:nycdsa/org.dsa.endorsement.candidate/example"
  ],
  "sources": [],
  "publishedAt": "2026-05-01T00:00:00Z",
  "updatedAt": "2026-05-15T00:00:00Z"
}
```

## Events

### `org.dsa.event.meeting`

Represents a public meeting.

```json
{
  "$type": "org.dsa.event.meeting",
  "title": "General Membership Meeting",
  "host": "did:plc:nycdsa",
  "startsAt": "2026-07-15T23:00:00Z",
  "endsAt": "2026-07-16T01:00:00Z",
  "location": {
    "type": "public-venue",
    "name": "Example Hall",
    "locality": "Brooklyn",
    "region": "NY"
  },
  "registrationUrl": "https://example.org/events/gmm",
  "visibility": "public"
}
```

### `org.dsa.event.canvass`

Represents a public canvass or campaign event.

```json
{
  "$type": "org.dsa.event.canvass",
  "title": "Canvass for Jane Example",
  "host": "did:plc:nycdsa",
  "campaign": "did:plc:campaign123",
  "startsAt": "2026-08-01T15:00:00Z",
  "meetingPoint": {
    "type": "approximate-public-location",
    "locality": "Queens",
    "region": "NY"
  },
  "registrationUrl": "https://example.org/canvass",
  "safetyNotes": "Do not publish private staging locations without approval."
}
```

## Statements and publications

### `org.dsa.statement.public`

Represents a public statement, resolution, or announcement.

```json
{
  "$type": "org.dsa.statement.public",
  "title": "Statement on Housing Justice",
  "publisher": "did:plc:examplecaucus",
  "body": "Public statement text or summary.",
  "canonicalUrl": "https://example.org/statement",
  "topics": ["housing", "tenant-organizing"],
  "publishedAt": "2026-06-30T00:00:00Z",
  "sources": []
}
```

## Sources

### `org.dsa.source.citation`

Represents a source used by another record.

```json
{
  "$type": "org.dsa.source.citation",
  "url": "https://example.org/endorsement",
  "title": "Official Endorsement Page",
  "publisher": "NYC-DSA",
  "accessedAt": "2026-06-30T00:00:00Z",
  "archiveUrl": "https://web.archive.org/example",
  "confidence": "official",
  "notes": "Used as source for endorsement record."
}
```

Confidence labels:

```text
official
verified
self-declared
secondary-source
community-submitted
uncertain
disputed
revoked
```

## Schema evolution

Lexicons should be versioned and governed. Breaking changes should be rare. Indexers should support older records where possible and mark deprecated fields clearly.

Recommended fields across most records:

- `$type`
- `createdAt`
- `updatedAt`
- `sources`
- `confidence`
- `status`
- `issuer` or `publisher`
- Stable references to DIDs or AT URIs instead of handles where possible
