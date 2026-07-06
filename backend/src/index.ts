import { bootstrapRepository, createApp, getConfig } from './server.js';

const config = getConfig();
const repository = await bootstrapRepository(config.DATABASE_URL, config);
createApp(repository, config).listen(config.PORT, () => {
  console.log(`api listening on ${config.PORT}`);
});
