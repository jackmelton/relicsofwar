#!/usr/bin/env node
/* ============================================================================
   Relics of War — site builder
   ----------------------------------------------------------------------------
   Nightly (GitHub Actions) or by hand:

     node build/build.mjs                       # fetch from ArtifactSearch (AS_EXPORT_TOKEN)
     node build/build.mjs --from-dir <snapshot> # build from a local export snapshot
     node build/build.mjs --check               # build to a temp dir, validate, don't touch the repo

   Pipeline: fetch → model → INDEX-WORTHINESS ENGINE → render → sitemaps/robots →
   validate → growth gate → IndexNow plan → state + report. Output is written to
   the repo root because Cloudflare Pages serves the repo root; the set of files
   the build owns is tracked in state/index-state.json and swept each run.
   Everything else in the repo (identify/, assets/, docs/, content/…) is left alone.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, appendFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { sha1, isoDate } from './lib/util.mjs';
import { loadFromDir, loadFromApi } from './lib/fetch.mjs';
import { buildModel } from './lib/model.mjs';
import { evaluate, explain } from './lib/engine.mjs';
import { renderHome, renderErasIndex, renderEra, renderMarket, renderPriceGuideIndex, renderPriceGuide, renderStaticPage, render404 } from './lib/render/pages.mjs';
import { nav, foot } from './lib/render/layout.mjs';
import { buildSitemaps, robotsTxt } from './lib/sitemaps.mjs';
import { validateSite } from './lib/validate.mjs';
import { planIndexNow, submitIndexNow } from './lib/indexnow.mjs';
import { buildReport } from './lib/report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const log = (...a) => console.log(...a);

const today = isoDate(new Date());
const config = JSON.parse(readFileSync(join(ROOT, 'config/seo-index-policy.json'), 'utf8'));
const demand = JSON.parse(readFileSync(join(ROOT, 'config/search-demand.json'), 'utf8')).demand || {};
const featuredCfg = JSON.parse(readFileSync(join(ROOT, 'config/homepage-featured.json'), 'utf8')).featured || [];
const statePath = join(ROOT, 'state/index-state.json');
const historyPath = join(ROOT, 'state/history.jsonl');
const prevState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
const history = existsSync(historyPath) ? readFileSync(historyPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const CHECK = flag('--check');
const OUT = CHECK ? mkdtempSync(join(tmpdir(), 'row-check-')) : ROOT;
// The 2026-07 sample-data price guide lived at /price-guide/<category>/ (retired 2026-08-15).
const LEGACY_PG_CATS = ['accoutrements', 'bayonets', 'belt-plates', 'buttons', 'currency', 'edged-weapons', 'firearms', 'headgear', 'photographs'];
const LEGACY_PG_MAP = { bayonets: 'edged-weapons', currency: 'currency-bonds', headgear: 'uniforms', photographs: 'photography' };

/* ── 1. data ─────────────────────────────────────────────── */
log(`Relics of War build — ${today}${CHECK ? ' (check mode → ' + OUT + ')' : ''}`);
const fromDir = opt('--from-dir');
const data = fromDir
  ? loadFromDir(resolve(fromDir))
  : await loadFromApi({ baseUrl: process.env.AS_EXPORT_URL || `${config.artifactsearch}/api/export/relicsofwar`, token: process.env.AS_EXPORT_TOKEN, log });
log(`  data: ${data.listings.length} listings · ${data.sold.length} sold · ${data.sources.length} sources · ${data.categories.length} categories · ${data.eras.length} eras (exported ${data.generatedAt})`);
if (data.listings.length < 1000) throw new Error(`Refusing to build from ${data.listings.length} listings — export looks truncated`);

/* ── 2. model + engine ───────────────────────────────────── */
const model = buildModel(data, { root: ROOT, config });
const decisions = evaluate(model, config, demand);
for (const d of decisions.values()) d.note = explain(d);
log(`  engine: ${[...decisions.values()].filter((d) => d.state === 'INDEX').length} INDEX · ${[...decisions.values()].filter((d) => d.state === 'NOINDEX').length} NOINDEX · ${[...decisions.values()].filter((d) => d.state.startsWith('CANONICAL')).length} canonicalized · ${[...decisions.values()].filter((d) => d.state === 'NOT_GENERATED').length} not generated`);

/* ── 3. render ───────────────────────────────────────────── */
const pages = []; // { path, html, type, state, group, hash, raw? }
const methodologyUrl = '/how-prices-work/';
const add = (r, type, state, group, hash) => pages.push({ ...r, type, state, group, hash });

const featured = (featuredCfg.length
  ? featuredCfg.map((k) => model.nodes.find((n) => n.key === k)).filter(Boolean)
  : model.nodes.filter((n) => decisions.get(n.url)?.state === 'INDEX').slice(0, 12));
add(renderHome({ model, decisions, config, featured }), 'static', 'INDEX', 'core', sha1(model.eras.map((e) => `${e.slug}:${e.itemCount}`).join('|') + featured.map((n) => n.key).join('|')));
add(renderErasIndex({ model, decisions, config }), 'static', 'INDEX', 'core', sha1(model.eras.map((e) => `${e.slug}:${e.itemCount}:${e.nodeList.map((n) => n.key + n.items.length).join(',')}`).join('|')));
add(renderPriceGuideIndex({ model, decisions, config, methodologyUrl }), 'static', 'INDEX', 'price-guide', sha1(model.nodes.map((n) => `${n.key}:${n.stats.n}:${n.stats.median}`).join('|')));

for (const era of model.eras) {
  const d = decisions.get(era.url);
  if (!d || d.state === 'NOT_GENERATED') continue;
  add(renderEra({ era, model, decisions, d, config }), 'era', d.state, 'eras', sha1(`${era.itemCount}|${era.soldCount}|${era.nodeList.map((n) => n.key + ':' + n.items.length + ':' + n.stats.n).join(',')}|${era.content?.publishable ? era.content.html : ''}`));
}
for (const n of model.nodes) {
  const d = decisions.get(n.url);
  if (d && d.state !== 'NOT_GENERATED') {
    const hash = sha1(`${[...n.itemIds].sort().join(',')}|${n.stats.n}:${n.stats.median}|${n.content?.publishable ? n.content.html : ''}|${n.guides.map((g) => g.url).join(',')}`);
    for (const pg of renderMarket({ node: n, model, decisions, d, config })) add(pg, pg.isPagination ? 'pagination' : 'market', pg.state, 'categories', pg.isPagination ? sha1(hash + pg.path) : hash);
  }
  const pd = decisions.get(n.priceGuideUrl);
  if (pd && pd.state !== 'NOT_GENERATED') {
    add(renderPriceGuide({ node: n, model, decisions, d: pd, config, methodologyUrl }), 'price-guide', pd.state, 'price-guide', sha1(`${n.sold.map((s) => s.slug).sort().join(',')}|${n.stats.median}|${n.priceContent?.publishable ? n.priceContent.html : ''}`));
  }
}
for (const p of model.pages) {
  if (!p.publishable) continue;
  add(renderStaticPage({ page: p, model, config }), 'static', 'INDEX', 'core', sha1(p.html));
}
add(render404({ model, config }), 'static', 'NOINDEX', 'core', sha1('404'));

// Identification Library — hand-written pages; the build refreshes their chrome
// (header/footer) so navigation never drifts, and registers them as INDEX pages
// so they get validated and sit in the sitemap.
const guidePages = [];
for (const g of model.guides.filter((x) => x.exists)) guidePages.push({ path: g.url, file: g.file });
if (existsSync(join(ROOT, 'identify/index.html'))) guidePages.push({ path: '/identify/', file: join(ROOT, 'identify/index.html') });
for (const gp of guidePages) {
  let html = readFileSync(gp.file, 'utf8');
  const fresh = refreshChrome(html, gp.path, model.pages, legacyPriceGuideTarget);
  if (fresh !== html && !CHECK) writeFileSync(gp.file, fresh);
  html = fresh;
  pages.push({ path: gp.path, html, type: 'guide', state: 'INDEX', group: 'research', hash: sha1(html.replace(/<footer[\s\S]*?<\/footer>/, '').replace(/<header[\s\S]*?<\/header>/, '')), external: true, file: gp.file });
}

/* ── 4. state, lastmod, growth gate ──────────────────────── */
const nextState = { generatedAt: new Date().toISOString(), dataGeneratedAt: data.generatedAt, urls: {}, generatedFiles: [] };
for (const p of pages) {
  const prev = prevState?.urls?.[p.path];
  const lastmod = prev && prev.contentHash === p.hash ? prev.lastmod : today;
  nextState.urls[p.path] = { type: p.type, state: p.state, contentHash: p.hash, lastmod, firstSeen: prev?.firstSeen || today, lastSubmittedHash: prev?.lastSubmittedHash || null };
}
const indexCount = pages.filter((p) => p.state === 'INDEX').length;
const growth = growthGate({ prevCount: prevState?.indexableCount, next: indexCount, config });
nextState.indexableCount = indexCount;
log(`  growth gate: ${growth.ok ? 'ok' : 'BLOCKED'} — ${growth.summary}`);

/* ── 5. write ────────────────────────────────────────────── */
const written = new Set();
const writeOut = (path, content) => {
  const rel = path === '/' ? 'index.html' : path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1);
  const abs = join(OUT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  written.add(rel);
};
// sweep what the previous build owned (only in real mode)
if (!CHECK && prevState?.generatedFiles) for (const rel of prevState.generatedFiles) { try { rmSync(join(ROOT, rel), { force: true }); } catch {} }
// legacy generated output from the sample-data price guide (retired 2026-08-15)
if (!CHECK) for (const legacy of ['membership.html', 'submit.html', 'sitemap.xml']) { try { rmSync(join(ROOT, legacy), { force: true }); } catch {} }
if (!CHECK && existsSync(join(ROOT, 'price-guide'))) rmSync(join(ROOT, 'price-guide'), { recursive: true, force: true });
if (!CHECK) for (const era of model.eras) if (existsSync(join(ROOT, era.slug))) rmSync(join(ROOT, era.slug), { recursive: true, force: true });

for (const p of pages) if (!p.external) writeOut(p.path, p.html);
// guides in check mode: write the refreshed copies so the validator sees what a real build would commit
if (CHECK) for (const p of pages.filter((x) => x.external)) { const rel = p.path.endsWith('/') ? p.path.slice(1) + 'index.html' : p.path.slice(1) + '.html'; mkdirSync(dirname(join(OUT, rel)), { recursive: true }); writeFileSync(join(OUT, rel), p.html); }
if (CHECK) { mkdirSync(join(OUT, 'assets'), { recursive: true }); for (const f of readdirSync(join(ROOT, 'assets'))) if (f.endsWith('.css') || f.endsWith('.js')) writeFileSync(join(OUT, 'assets', f), readFileSync(join(ROOT, 'assets', f))); }

const sitemapEntries = pages.filter((p) => p.state === 'INDEX').map((p) => ({ url: p.path, group: p.group, lastmod: nextState.urls[p.path].lastmod }));
for (const f of buildSitemaps({ entries: sitemapEntries, config, today })) writeOut(f.path, f.xml);
writeOut('/robots.txt', robotsTxt(config));
writeOut(`/${config.indexnow.key}.txt`, config.indexnow.key);
writeOut('/_headers', headersFile());
writeOut('/_redirects', redirectsFile({ model, decisions }));
nextState.generatedFiles = [...written].sort();

/* ── 6. validate ─────────────────────────────────────────── */
const validation = validateSite({ root: OUT, pages: pages.map((p) => ({ path: p.path, state: p.state, type: p.type })), decisions, config });
log(`  validate: ${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`);
for (const e of validation.errors.slice(0, 30)) log('   ❌', e);
for (const w of validation.warnings.slice(0, 10)) log('   ⚠️ ', w);

/* ── 7. IndexNow, report, state ──────────────────────────── */
const plan = planIndexNow({ prevState, nextState, config });
let indexnow = { ...plan, submitted: 0 };
const healthy = validation.errors.length === 0 && growth.ok;
if (healthy && !CHECK && process.env.ROW_INDEXNOW === '1') {
  try {
    const r = await submitIndexNow({ plan, config, log });
    indexnow.submitted = r.submitted;
    for (const u of plan.submit) if (nextState.urls[u]) nextState.urls[u].lastSubmittedHash = nextState.urls[u].contentHash;
  } catch (e) { log('  IndexNow failed (non-fatal):', e.message); }
} else {
  log(`  IndexNow plan: +${plan.added.length} ~${plan.updated.length} -${plan.removed.length}${process.env.ROW_INDEXNOW === '1' ? '' : ' (not submitted — set ROW_INDEXNOW=1)'}`);
}

const report = buildReport({ today, decisions, pages, validation, growth, indexnow, history, model, config, dataGeneratedAt: data.generatedAt });
if (!CHECK) {
  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  writeFileSync(join(ROOT, 'reports/seo-index-report.md'), report.md);
  if (healthy) {
    writeFileSync(statePath, JSON.stringify(nextState, null, 1));
    appendFileSync(historyPath, JSON.stringify({ date: today, ...report.totals }) + '\n');
  }
} else {
  writeFileSync(join(OUT, 'seo-index-report.md'), report.md);
  log(`  check report: ${join(OUT, 'seo-index-report.md')}`);
}

log(healthy ? `✓ build complete — ${pages.length} pages (${indexCount} INDEX)` : `✗ build has problems — see reports/seo-index-report.md`);
process.exit(healthy ? 0 : 1);

/* ── helpers ─────────────────────────────────────────────── */

function growthGate({ prevCount, next, config }) {
  const g = config.growthGate;
  const approved = Number(process.env.SEO_INDEX_EXPANSION_APPROVED || opt('--approve-expansion') || 0);
  if (next > g.hardCap) return { ok: false, summary: `${next} INDEX URLs exceeds hardCap ${g.hardCap}`, message: `**BLOCKED** — ${next} indexable URLs exceeds the hard cap of ${g.hardCap}. Raise \`growthGate.hardCap\` deliberately, after review.` };
  if (prevCount == null) return { ok: true, summary: `baseline set at ${next}`, message: `First recorded build — baseline set at **${next}** indexable URLs.` };
  const inc = next - prevCount;
  const pct = prevCount ? Math.round((inc / prevCount) * 100) : 100;
  const over = inc > g.maxIncreaseAbs && pct > g.maxIncreasePct;
  if (over && approved !== next) {
    return {
      ok: false,
      summary: `+${inc} (+${pct}%) exceeds limits`,
      message: `**SEO INDEX EXPANSION WARNING — BUILD BLOCKED**\n\nThis build would increase indexable URLs:\n\n- Current: ${prevCount}\n- Proposed: ${next}\n- Increase: +${inc} (+${pct}%)\n\nLimits: +${g.maxIncreaseAbs} and +${g.maxIncreasePct}%. Review the new pages in this report, then re-run with \`SEO_INDEX_EXPANSION_APPROVED=${next}\` to publish.`,
    };
  }
  return { ok: true, summary: `${prevCount} → ${next} (${inc >= 0 ? '+' : ''}${inc}, ${pct >= 0 ? '+' : ''}${pct}%)${over ? ' — approved' : ''}`, message: `${prevCount} → **${next}** indexable URLs (${inc >= 0 ? '+' : ''}${inc}, ${pct >= 0 ? '+' : ''}${pct}%).${over ? ' Expansion explicitly approved for this build.' : ''}` };
}

function headersFile() {
  return `# Cloudflare Pages headers
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/assets/*
  Cache-Control: public, max-age=604800
/sitemaps/*
  Cache-Control: public, max-age=3600
# Internal folders that ride along in the repo — never index them
/docs/*
  X-Robots-Tag: noindex
/build/*
  X-Robots-Tag: noindex
/config/*
  X-Robots-Tag: noindex
/content/*
  X-Robots-Tag: noindex
/state/*
  X-Robots-Tag: noindex
/reports/*
  X-Robots-Tag: noindex
`;
}

/** Where an old /price-guide/<category>/ URL should go now. */
function legacyPriceGuideTarget(cat) {
  const target = `/price-guide/civil-war/${LEGACY_PG_MAP[cat] || cat}/`;
  const d = decisions.get(target);
  return d && d.state !== 'NOT_GENERATED' ? target : '/price-guide/';
}

function redirectsFile({ model, decisions }) {
  const lines = [
    '# Cloudflare Pages redirects — one canonical URL per resource (§18).',
    '# Membership lives on ArtifactSearch (free).',
    '/membership https://artifactsearch.com/account/register 301',
    '/membership.html https://artifactsearch.com/account/register 301',
    '/submit /price-guide/ 301',
    '/submit.html /price-guide/ 301',
  ];
  // The 2026-07 sample-data price guide lived at /price-guide/<category>/; the
  // guide is now era × category. Send old category URLs to the Civil War guide
  // when it exists, otherwise to the index.
  for (const c of LEGACY_PG_CATS) {
    const target = legacyPriceGuideTarget(c);
    lines.push(`/price-guide/${c}/ ${target} 301`);
    lines.push(`/price-guide/${c}/* ${target} 301`);
  }
  return lines.join('\n') + '\n';
}

/** Replace the header/footer chrome inside a hand-written page (identify/*.html)
 *  with the current site chrome; add site.css. Idempotent. */
function refreshChrome(html, path, sitePages, legacyTarget) {
  let out = html;
  const navHtml = nav(path).trim();
  // header + the leaderboard slot that follows it (idempotent: the optional group swallows a previous run's slot)
  out = out.replace(/<header class="site">[\s\S]*?<\/header>(\s*<div class="wrap"><(?:div|aside) class="row-ad"[^>]*><\/(?:div|aside)><\/div>)?/, navHtml);
  const footHtml = foot(sitePages).replace(/^\s*/, '').replace(/<\/body>\s*<\/html>\s*$/, '').trim();
  out = out.replace(/<footer class="site">[\s\S]*?<\/footer>(\s*<script>document\.getElementById\('yr'\)[^<]*<\/script>)?(\s*<script src="\/assets\/ads\.js" defer><\/script>)?/, footHtml);
  if (!/assets\/site\.css/.test(out)) out = out.replace('<link rel="stylesheet" href="/assets/relics.css">', '<link rel="stylesheet" href="/assets/relics.css">\n<link rel="stylesheet" href="/assets/site.css">');
  // retired destinations inside guide bodies
  out = out.replace(/href="\/membership"/g, 'href="https://artifactsearch.com/account/register" rel="noopener"').replace(/href="\/submit"/g, 'href="/price-guide/"');
  out = out.replace(/href="\/price-guide\/([a-z-]+)\/"/g, (m, cat) => `href="${legacyTarget(cat)}"`);
  return out;
}
