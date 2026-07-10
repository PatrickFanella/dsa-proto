import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

const config = z.object({
  LOCAL_PDS_URL: z.string().url().default('http://pds:3000'),
  LOCAL_ROOT_HANDLE: z.string().default('registry.test'),
  LOCAL_ROOT_EMAIL: z.string().email().default('registry@example.test'),
  LOCAL_ROOT_PASSWORD: z.string().min(8),
  LOCAL_ROOT_STATE_FILE: z.string().default('/run/local-root/root.json'),
  LOCAL_ROOT_DID_FILE: z.string().default('/run/local-root/root.did'),
}).parse(process.env);

type Session = { accessJwt: string; refreshJwt: string; handle: string; did: string };

async function waitForPds(attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${config.LOCAL_PDS_URL}/xrpc/_health`);
      if (response.ok) return;
    } catch {
      // The disposable local PDS may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('local PDS did not become ready');
}

async function call(method: string, body: unknown) {
  return fetch(`${config.LOCAL_PDS_URL}/xrpc/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

await waitForPds();
let response = await call('com.atproto.server.createAccount', {
  email: config.LOCAL_ROOT_EMAIL,
  handle: config.LOCAL_ROOT_HANDLE,
  password: config.LOCAL_ROOT_PASSWORD,
});
if (response.status === 400 || response.status === 409) {
  response = await call('com.atproto.server.createSession', {
    identifier: config.LOCAL_ROOT_HANDLE,
    password: config.LOCAL_ROOT_PASSWORD,
  });
}
if (!response.ok) throw new Error(`local root account initialization failed with HTTP ${response.status}: ${await response.text()}`);
const session = z.object({ accessJwt: z.string(), refreshJwt: z.string(), handle: z.string(), did: z.string() }).parse(await response.json()) as Session;

await mkdir(dirname(config.LOCAL_ROOT_STATE_FILE), { recursive: true });
await writeFile(config.LOCAL_ROOT_STATE_FILE, `${JSON.stringify(session)}\n`, { mode: 0o600 });
await writeFile(config.LOCAL_ROOT_DID_FILE, `${session.did}\n`, { mode: 0o644 });
console.info(JSON.stringify({ status: 'ready', did: session.did, handle: session.handle }));
