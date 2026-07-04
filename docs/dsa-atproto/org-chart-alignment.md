# Org chart alignment

This prototype maps a small, public slice of the 2020 DSA national organization chart into two record types:

- `org.dsa.profile.orgUnit` for public organizational bodies
- `org.dsa.relationship.governance` for chart-derived governance links

## Covered

- National Political Committee
- NPC Steering Committee
- YDSA National Coordinating Committee
- National Director
- National Staff
- Publications: Democratic Left and Socialist Forum
- Priority Committees
- Working Groups and Commissions
- Local Chapters as a chapter-network unit
- Membership body
- Chapter Delegates
- Core public relationships such as elects, sits-on, appoints, supports, can-join, can-volunteer, can-submit, approves-charter-for, creates-priorities-for, hires-and-directs, and hires-with-approval

## Not covered

- Internal voting detail
- Private deliberations
- Dues/payment data
- Member rosters
- Sensitive organizing logistics
- Detailed committee bylaws or procedural text

## Safety and authority caveats

- This is a prototype model, not an authoritative governance registry.
- Relationships are source-linked to the public chart image and should be treated as bounded, public-only alignment data.
- Where the chart is ambiguous, the prototype prefers conservative, minimal records over implied structure.
- Public chart alignment does not prove current legal status, internal legitimacy, or operational authority.

## Mapping notes

- `kind` groups chart entities into coarse public categories like `national-committee`, `steering-committee`, `publication`, and `membership-body`.
- `relationship` captures only visible chart relationships, not hidden org logic.
- `sourceUrl` points to the 2020 organization chart image for provenance.
- These records are intentionally kept out of ordinary chapter/caucus/member directory cards and are exposed through `/api/org-chart`.
