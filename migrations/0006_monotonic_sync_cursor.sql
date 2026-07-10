ALTER TABLE repo_sync_state
  ADD COLUMN IF NOT EXISTS rev_sequence BIGINT NOT NULL DEFAULT 0;

UPDATE repo_sync_state AS state
SET last_sequence = greatest(state.last_sequence, observed.version_count),
    cursor = greatest(state.cursor, observed.version_count),
    rev_sequence = observed.rev_sequence
FROM (
  SELECT foundation_record_versions.repo_did,
         count(*)::bigint AS version_count,
         coalesce(max(foundation_record_versions.sequence) FILTER (WHERE foundation_record_versions.repo_rev = latest_repo.repo_rev), 0)::bigint AS rev_sequence
  FROM foundation_record_versions
  JOIN (
    SELECT did, repo_rev
    FROM repo_sync_state
  ) AS latest_repo ON latest_repo.did = foundation_record_versions.repo_did
  GROUP BY foundation_record_versions.repo_did, latest_repo.repo_rev
) AS observed
WHERE observed.repo_did = state.did;
