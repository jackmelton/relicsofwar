/* Load the ArtifactSearch syndication export — from the token-gated API, or from
   a local snapshot directory written by ArtifactSearch's
   scripts/relicsofwar-export-snapshot.ts (`--from-dir`). Both yield the same
   shape: { eras, categories, sources, listings, sold } arrays. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RESOURCES = ['eras', 'categories', 'sources', 'listings', 'sold'];

export function loadFromDir(dir) {
  const data = {};
  for (const r of RESOURCES) {
    const page = JSON.parse(readFileSync(join(dir, `${r}.json`), 'utf8'));
    data[r] = page.items;
    data.generatedAt = page.generatedAt;
  }
  return data;
}

export async function loadFromApi({ baseUrl, token, pageSize = 1000, log = console.log }) {
  if (!token) throw new Error('AS_EXPORT_TOKEN is not set — cannot fetch from the ArtifactSearch export API');
  const data = {};
  for (const r of RESOURCES) {
    const items = [];
    let cursor = null;
    let pages = 0;
    do {
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/${r}`);
      url.searchParams.set('limit', String(pageSize));
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'RelicsOfWar-build/1.0 (+https://relicsofwar.com)' } });
      const page = await res.json();
      items.push(...page.items);
      cursor = page.nextCursor;
      data.generatedAt = page.generatedAt;
      pages++;
    } while (cursor);
    data[r] = items;
    log(`  fetched ${r}: ${items.length} (${pages} page${pages === 1 ? '' : 's'})`);
  }
  return data;
}

async function fetchWithRetry(url, init, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 401) throw new Error('ArtifactSearch export: 401 — AS_EXPORT_TOKEN rejected');
      if (res.status === 503) throw new Error('ArtifactSearch export: 503 — RELICSOFWAR_EXPORT_TOKEN not configured on ArtifactSearch');
      if (!res.ok) throw new Error(`ArtifactSearch export: HTTP ${res.status} for ${url}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (/401|503/.test(String(e.message))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}
