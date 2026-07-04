import { loadRawFixtureRecordsFromFile } from './fixture-files.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { createPostgresRepository, getConfig } from './server.js';

const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const fixtureFiles = files.length > 0 ? files : ['fixtures/records.json'];
const config = getConfig();
const repository = await createPostgresRepository(config.DATABASE_URL);

for (const file of fixtureFiles) {
  const records = await loadRawFixtureRecordsFromFile(file);
  const report = await replayFixtureRecords(records, repository);
  console.log(`${file}: accepted=${report.acceptedCount} rejected=${report.rejected.length} ingested=${report.ingestedCount}`);
  for (const rejection of report.rejected) {
    console.log(`  rejected[${rejection.index}]: ${rejection.reason}`);
  }
}
