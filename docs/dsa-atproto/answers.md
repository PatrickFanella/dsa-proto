# Requirements Interview

Answer in bullets; partial answers are fine. The goal is to clarify the first implementation milestone before coding.

## 1. Goal

What are we trying to produce first?

- A working local prototype

## 2. Audience

Who is this for initially?

- DSA members

## 3. First Use Case

What should the first version let someone actually do?

- Browse verified DSA chapters
- Publish/read public chapter profiles
- Browse events
- Browse endorsements
- Search statements/resolutions
- View caucus/publication records
- Demonstrate custom Lexicon records

## 4. Source Of Truth

Where should the first version’s data live?

- Hybrid: ATProto as public record layer, Postgres as indexed/read model

## 5. ATProto Depth

How real should the ATProto integration be in version one?

- Use mocked ATProto records shaped like Lexicons
- Consume firehose/relay data

## 6. Identity And Verification

What should “official” or “verified” mean in the prototype?

Examples:

- Deferred for now

## 7. Data Types

Which public records matter most for the first pass?

Pick up to 3 if possible:

- Chapter profiles
- Caucus/working group profiles
- Member opt-in profiles

## 8. Safety Boundary

What should be explicitly out of scope?

Examples:

- Internal votes
- Private deliberation
- Dues/payment status
- Casework/discipline
- High-risk organizing logistics

## 9. App Shape

What should the frontend feel like?

- Directory/search app
- Public microsite

## 10. Backend Shape

What should the backend prioritize?

- Simple REST API
- Postgres schema and seed data
- ATProto record ingestion
- Lexicon validation
- Admin CRUD

## 11. Success Criteria

What would make you say “this prototype worked”?

Examples:

- We can demo a chapter directory from structured records
- We can show how ATProto identities map to DSA entities
- We can deploy it

## 12. Constraints

Any constraints I should respect?

- Prioritize correctness over UI
- Must run with `docker compose`
- Must use the existing template stack

## 13. Timeline

What kind of first milestone do you want?

- A more complete prototype plan before coding

## 14. Preferred Next Output

After you answer, what should I produce?

- A concise implementation plan
- A phased roadmap
- Gitea issues
- A technical architecture doc
