/* The "index bloat dashboard" (§50), growth alert (§51), review queue (§49) and
   release-check summary (§75) — written as Markdown into reports/ on every
   build and committed, so the history is in git. RelicsOfWar has no admin UI. */
import { num } from './util.mjs';
import { explain } from './engine.mjs';

export function buildReport({ today, decisions, pages, validation, growth, indexnow, history, model, config, dataGeneratedAt }) {
  const count = (pred) => pages.filter(pred).length;
  const byType = (type, state) => pages.filter((p) => p.type === type && p.state === state).length;
  const lastWeek = history.filter((h) => h.date <= addDays(today, -7)).at(-1);
  const wow = (k, cur) => (lastWeek ? `${cur} (${delta(cur, lastWeek[k])} vs ${lastWeek.date})` : `${cur}`);
  const totals = {
    total: pages.length,
    index: count((p) => p.state === 'INDEX'),
    noindex: count((p) => p.state === 'NOINDEX'),
    canonicalized: count((p) => p.state.startsWith('CANONICAL')),
    notGenerated: [...decisions.values()].filter((d) => d.state === 'NOT_GENERATED').length,
  };

  const nearMiss = [...decisions.values()]
    .filter((d) => d.state === 'NOINDEX' && d.type !== 'era' && d.score >= config.thresholds.reviewBand - 10)
    .sort((a, b) => b.score - a.score).slice(0, 25);
  const dupes = [...decisions.values()].filter((d) => d.state === 'CANONICAL_TO_PARENT');
  const unverified = [
    ...model.nodes.filter((n) => n.content && !n.content.publishable).map((n) => ({ what: `market intro ${n.key}`, status: n.content.status, path: n.content.path })),
    ...model.nodes.filter((n) => n.priceContent && !n.priceContent.publishable).map((n) => ({ what: `price-guide intro ${n.key}`, status: n.priceContent.status, path: n.priceContent.path })),
    ...model.eras.filter((e) => e.content && !e.content.publishable).map((e) => ({ what: `era intro ${e.slug}`, status: e.content.status, path: e.content.path })),
    ...model.pages.filter((p) => !p.publishable).map((p) => ({ what: `page ${p.slug}`, status: p.status, path: `content/pages/${p.slug}.md` })),
  ];

  const md = `# RelicsOfWar — SEO Index Report

_Generated ${today} from ArtifactSearch data exported ${dataGeneratedAt || 'n/a'}. This file is the index-bloat dashboard (§50); it is rewritten by every build and committed so the history lives in git._

## Index state (${today})

| | Count | Week-over-week |
|---|---:|---|
| Total public URLs generated | ${totals.total} | ${wow('total', totals.total)} |
| **INDEX** | **${totals.index}** | ${wow('index', totals.index)} |
| NOINDEX | ${totals.noindex} | ${wow('noindex', totals.noindex)} |
| Canonicalized (to parent / ArtifactSearch) | ${totals.canonicalized} | ${wow('canonicalized', totals.canonicalized)} |
| Not generated (would be empty/thin) | ${totals.notGenerated} | ${wow('notGenerated', totals.notGenerated)} |

| Page type | INDEX | NOINDEX | Canonicalized |
|---|---:|---:|---:|
| Era hubs | ${byType('era', 'INDEX')} | ${byType('era', 'NOINDEX')} | — |
| Market pages (era × category) | ${byType('market', 'INDEX')} | ${byType('market', 'NOINDEX')} | ${byType('market', 'CANONICAL_TO_PARENT')} |
| Pagination pages | 0 | ${byType('pagination', 'NOINDEX')} | — |
| Price-guide pages | ${byType('price-guide', 'INDEX')} | ${byType('price-guide', 'NOINDEX')} | — |
| Research / identification guides | ${byType('guide', 'INDEX')} | ${byType('guide', 'NOINDEX')} | — |
| Site & trust pages | ${byType('static', 'INDEX')} | ${byType('static', 'NOINDEX')} | — |
| Item pages | 0 | 0 | 0 |

Data: ${num(model.totals.listings)} public listings (${num(model.totals.unplacedItems)} without an era, so on no market page), ${num(model.totals.sold)} recorded sales (${num(model.totals.unplacedSold)} without era+category), ${model.totals.sources} sources.

## Growth gate (§13 / §51)

${growth.message}

## Release checks (§75)

- Errors: **${validation.errors.length}** ${validation.errors.length ? '— BUILD BLOCKED' : '✓'}
- Warnings: ${validation.warnings.length}
${validation.errors.map((e) => `- ❌ ${e}`).join('\n')}
${validation.warnings.slice(0, 40).map((w) => `- ⚠️ ${w}`).join('\n')}${validation.warnings.length > 40 ? `\n- … ${validation.warnings.length - 40} more warnings` : ''}

## IndexNow (§26–§27)

Added ${indexnow.added.length} · Updated ${indexnow.updated.length} · Removed ${indexnow.removed.length} · Submitted this run ${indexnow.submitted ?? 0}${indexnow.dropped ? ` · deferred ${indexnow.dropped} (per-run cap)` : ''}

## Review queue (§49)

### Editorial content awaiting review (not rendered until VERIFIED/PUBLISHED)
${unverified.length ? unverified.map((u) => `- ${u.what} — \`${u.status}\` — ${u.path}`).join('\n') : '- none'}

### Nearest to INDEX — a verified intro or more inventory would tip these
${nearMiss.length ? nearMiss.map((d) => `- ${d.url} — ${explain(d)}`).join('\n') : '- none'}

### Duplicate clusters (canonicalized)
${dupes.length ? dupes.map((d) => `- ${d.url} → ${d.canonical} — ${d.reasons.join('; ')}`).join('\n') : '- none'}

## Every decision

<details><summary>${decisions.size} evaluated URLs</summary>

| URL | Type | State | Score | Why |
|---|---|---|---:|---|
${[...decisions.values()].sort((a, b) => a.url.localeCompare(b.url)).map((d) => `| ${d.url} | ${d.type} | ${d.state} | ${d.score} | ${d.reasons.join('; ') || ''} |`).join('\n')}

</details>
`;
  return { md, totals };
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function delta(cur, prev) {
  if (prev == null) return 'n/a';
  const d = cur - prev;
  const pct = prev ? Math.round((d / prev) * 100) : 0;
  return `${d >= 0 ? '+' : ''}${d}, ${pct >= 0 ? '+' : ''}${pct}%`;
}
