import { loadRawFixtureRecordsFromFile } from './fixture-files.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { createPostgresRepository, getConfig } from './server.js';

function isConnectionRefused(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNREFUSED') return true;
  if (error instanceof AggregateError) return error.errors.some(isConnectionRefused);
  return false;
}

async function main() {
  const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const fixtureFiles = files.length > 0 ? files : ['fixtures/records.json'];
  const config = getConfig();

  let repository;
  try {
    repository = await createPostgresRepository(config.DATABASE_URL);
  } catch (error) {
    if (isConnectionRefused(error)) {
      console.error(`Could not connect to Postgres at ${config.DATABASE_URL}. Start it with \`make compose-db\` or run \`make fixture-replay\`.`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  for (const file of fixtureFiles) {
    const records = await loadRawFixtureRecordsFromFile(file);
    const report = await replayFixtureRecords(records, repository);
    console.log(`${file}: accepted=${report.acceptedCount} rejected=${report.rejected.length} ingested=${report.ingestedCount}`);
    for (const rejection of report.rejected) {
      console.log(`  rejected[${rejection.index}]: ${rejection.reason}`);
    }
  }
}

await main();
