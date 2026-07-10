DELETE FROM foundation_current_records AS current
USING foundation_record_versions AS tombstone
WHERE tombstone.uri = current.uri
  AND tombstone.action = 'delete'
  AND (
    tombstone.repo_rev > current.repo_rev
    OR (tombstone.repo_rev = current.repo_rev AND tombstone.sequence >= current.sequence)
  );
