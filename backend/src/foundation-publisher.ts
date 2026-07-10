import { AtUri } from '@atproto/syntax';
import type { FoundationRecord } from './foundation-model.js';

export type PdsFetchHandler = (pathname: string, init?: RequestInit) => Promise<Response>;

export async function publishFoundationRecords(fetchHandler: PdsFetchHandler, repoDid: string, records: FoundationRecord[]) {
  const published: Array<{ uri: string; cid: string; commit?: unknown }> = [];
  for (const source of [...records].sort((left, right) => left.sequence - right.sequence)) {
    if (source.repoDid !== repoDid) throw new Error(`record ${source.uri} is not authored by ${repoDid}`);
    const uri = new AtUri(source.uri);
    const response = await fetchHandler('/xrpc/com.atproto.repo.putRecord', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: repoDid, collection: uri.collection, rkey: uri.rkey, record: source.record }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as { error?: unknown; message?: unknown };
      const code = typeof errorBody.error === 'string' ? ` ${errorBody.error}` : '';
      const message = typeof errorBody.message === 'string' ? `: ${errorBody.message.slice(0, 500)}` : '';
      throw new Error(`PDS rejected ${source.uri} with status ${response.status}${code}${message}`);
    }
    const output = await response.json() as { uri?: unknown; cid?: unknown; commit?: unknown };
    if (typeof output.uri !== 'string' || typeof output.cid !== 'string') throw new Error(`PDS returned an invalid response for ${source.uri}`);
    if (output.uri !== source.uri) throw new Error(`PDS selected unexpected URI ${output.uri} for ${source.uri}`);
    if (output.cid !== source.cid) throw new Error(`PDS CID ${output.cid} does not match canonical migration CID ${source.cid}`);
    published.push({ uri: output.uri, cid: output.cid, ...(output.commit ? { commit: output.commit } : {}) });
  }
  return published;
}
