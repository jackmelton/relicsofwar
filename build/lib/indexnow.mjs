/* IndexNow (§26–§27): tell Bing & friends which INDEX URLs were added, changed
   or removed since the last build. Dedupe by content hash; rate-limit per run.
   Only fires when ROW_INDEXNOW=1 (CI); local builds just report what they
   would have sent. */
import { SITE } from './render/layout.mjs';

export function planIndexNow({ prevState, nextState, config }) {
  const prev = prevState?.urls || {};
  const next = nextState.urls;
  const added = [], updated = [], removed = [];
  for (const [url, s] of Object.entries(next)) {
    if (s.state !== 'INDEX') continue;
    const p = prev[url];
    if (!p || p.state !== 'INDEX') added.push(url);
    else if (p.contentHash !== s.contentHash && p.lastSubmittedHash !== s.contentHash) updated.push(url);
  }
  for (const [url, p] of Object.entries(prev)) {
    if (p.state === 'INDEX' && (!next[url] || next[url].state !== 'INDEX')) removed.push(url);
  }
  const all = [...added, ...updated, ...removed];
  const cap = config.indexnow.maxUrlsPerRun;
  return { added, updated, removed, submit: all.slice(0, cap), dropped: Math.max(0, all.length - cap) };
}

export async function submitIndexNow({ plan, config, log = console.log }) {
  if (!config.indexnow.enabled) { log('IndexNow disabled in config'); return { submitted: 0 }; }
  if (!plan.submit.length) { log('IndexNow: nothing to submit'); return { submitted: 0 }; }
  const body = { host: SITE.replace('https://', ''), key: config.indexnow.key, keyLocation: `${SITE}/${config.indexnow.key}.txt`, urlList: plan.submit.map((u) => SITE + u) };
  const res = await fetch(config.indexnow.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
  log(`IndexNow: submitted ${plan.submit.length} URL(s) → HTTP ${res.status}`);
  if (!res.ok && res.status !== 202) throw new Error(`IndexNow HTTP ${res.status}`);
  return { submitted: plan.submit.length, status: res.status };
}
