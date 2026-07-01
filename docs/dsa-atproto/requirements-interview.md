# Requirements Interview

Answer in bullets; partial answers are fine. The goal is to clarify the first implementation milestone before coding.

## 1. Goal

What are we trying to produce first?

- A working local prototype
- A public demo app
- A technical proof-of-concept for ATProto records/indexing
- A planning/spec package for others to review
- Something else

## 2. Audience

Who is this for initially?

- DSA members
- Chapter officers/admins
- National staff/committees
- Caucuses/working groups
- Public readers/voters
- Developers evaluating the idea

## 3. First Use Case

What should the first version let someone actually do?

Examples:

- Browse verified DSA chapters
- Publish/read public chapter profiles
- Browse events
- Browse endorsements
- Search statements/resolutions
- View caucus/publication records
- Demonstrate custom Lexicon records

## 4. Source Of Truth

Where should the first version’s data live?

- Hardcoded seed data
- Local Postgres only
- ATProto records only
- Hybrid: ATProto as public record layer, Postgres as indexed/read model
- Not sure yet

## 5. ATProto Depth

How real should the ATProto integration be in version one?

- No live ATProto yet; model the concepts locally
- Use mocked ATProto records shaped like Lexicons
- Publish/read from a real PDS
- Consume firehose/relay data
- Build a custom indexer
- Define Lexicons only, no runtime integration yet

## 6. Identity And Verification

What should “official” or “verified” mean in the prototype?

Examples:

- A manually curated allowlist
- Domain-based handles, like `nyc.dsausa.org`
- Admin-approved records in Postgres
- ATProto labels
- A separate verification service
- Deferred for now

## 7. Data Types

Which public records matter most for the first pass?

Pick up to 3 if possible:

- Chapter profiles
- Caucus/working group profiles
- Events
- Endorsements
- Candidates
- Public statements
- Resolutions
- Publications/articles
- Source-linked voter guide entries
- Member opt-in profiles

## 8. Safety Boundary

What should be explicitly out of scope?

Examples:

- Member rosters
- Internal votes
- Private deliberation
- Personal contact info
- Dues/payment status
- Casework/discipline
- High-risk organizing logistics

## 9. App Shape

What should the frontend feel like?

- Directory/search app
- Civic knowledge base
- Admin dashboard
- Developer/API explorer
- Public microsite
- Internal prototype with minimal UI

## 10. Backend Shape

What should the backend prioritize?

- Simple REST API
- Postgres schema and seed data
- ATProto record ingestion
- Lexicon validation
- Verification/labeling model
- Search/indexing
- Admin CRUD

## 11. Success Criteria

What would make you say “this prototype worked”?

Examples:

- We can demo a chapter directory from structured records
- We can show how ATProto identities map to DSA entities
- We can publish and index a custom record
- We can explain governance and safety clearly
- We can hand it to another developer
- We can deploy it

## 12. Constraints

Any constraints I should respect?

- Keep it very minimal
- Prioritize correctness over UI
- Prioritize demo value over architecture
- Must run with `docker compose`
- Must use the existing template stack
- Avoid external services for now
- Must be deployable soon

## 13. Timeline

What kind of first milestone do you want?

- 1 focused implementation pass
- A couple of small PR-sized steps
- A more complete prototype plan before coding
- Docs/spec first, implementation later

## 14. Preferred Next Output

After you answer, what should I produce?

- A concise implementation plan
- A phased roadmap
- GitHub issues
- A technical architecture doc
- Start coding immediately
- A demo script/user journey
