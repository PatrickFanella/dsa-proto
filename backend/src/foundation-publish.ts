import { resolve } from 'node:path';
import { loadFixtureRecordsFromFile } from './fixture-files.js';
import { migrateLegacyRecords } from './legacy-migration.js';
import { bootstrapRepository, getConfig } from './server.js';

const config = getConfig();
if (!config.ENABLE_OAUTH) throw new Error('ENABLE_OAUTH=true is required for registry publication');
const fixturePath = resolve(process.argv[2] ?? 'fixtures/records.json');
const repository = await bootstrapRepository(config.DATABASE_URL, { ...config, AUTO_REPLAY_FIXTURES: false, REQUIRE_POSTGRES: true });
if (!repository.oauthService) throw new Error('OAuth service is unavailable');
const legacy = await loadFixtureRecordsFromFile(fixturePath);
const migration = migrateLegacyRecords(legacy, { rootDid: config.PROVISIONAL_ROOT_DID });
const published = await repository.oauthService.publishRegistryRecords(config.PROVISIONAL_ROOT_DID, migration.records);
console.info(JSON.stringify({ publishedCount: published.length, droppedCount: migration.dropped.length, warningCount: migration.warnings.length }));
