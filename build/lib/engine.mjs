/* ============================================================================
   SEO INDEX-WORTHINESS ENGINE  (docs/SEO-INDEX-QUALITY-REQUIREMENTS.md §3–§10)

   Every generated page is scored 0–100 and assigned exactly one state before it
   is written:

     INDEX                      self-canonical, in the sitemap, IndexNow-eligible
     NOINDEX                    exists for visitors; <meta robots noindex,follow>; not in sitemap
     CANONICAL_TO_PARENT        exists; canonical points at the page it duplicates
     CANONICAL_TO_ARTIFACTSEARCH exists; canonical points at artifactsearch.com (mirrored listing)
     NOT_GENERATED              the page would be empty/thin — no file is written at all

   404 / 410 / REDIRECT are lifecycle states handled by the output diff and
   _redirects, not by scoring.

   The score is a sum of factor contributions bounded by config.weights. Nothing
   here invents content: UniqueContent only counts editorial that a human has
   marked VERIFIED/PUBLISHED, and UserUtility only counts real recorded sales.
   ========================================================================== */
import { jaccard } from './util.mjs';

/** log-ish ramp: 0 at 0, ~half at `mid`, → 1 at `full`. */
const ramp = (n, mid, full) => {
  if (n <= 0) return 0;
  if (n >= full) return 1;
  const v = Math.log1p(n) / Math.log1p(full);
  return Math.max(0, Math.min(1, v));
};

export function evaluate(model, config, demand = {}) {
  const W = config.weights;
  const T = config.thresholds;
  const inv = config.inventory;
  const pg = config.priceGuide;
  const decisions = new Map();

  const decide = (url, type, factors, extras = {}) => {
    const score = Math.round(Object.values(factors).reduce((a, b) => a + b, 0));
    decisions.set(url, { url, type, score, factors, state: 'NOINDEX', canonical: url, reasons: [], ...extras });
    return decisions.get(url);
  };

  /* ── market pages (era × category) ─────────────────────── */
  for (const n of model.nodes) {
    const items = n.items.length;
    const sales = n.stats.n;
    if (items === 0) {
      decide(n.url, 'market', {}, { state: 'NOT_GENERATED', reasons: ['no active listings'], node: n });
      continue;
    }
    const f = {
      inventoryDepth: W.inventoryDepth * ramp(items, 25, 200),
      sourceDiversity: W.sourceDiversity * ramp(n.sourceCount, 3, 8),
      uniqueContent: n.content?.publishable ? W.uniqueContent * (n.content.words >= 120 ? 1 : n.content.words >= 60 ? 0.66 : 0.4) : 0,
      historicalContext: Math.min(W.historicalContext, n.guides.length * (W.historicalContext / 2) + (n.era.content?.publishable ? W.historicalContext / 2 : 0)),
      userUtility: sales >= pg.minSalesToIndex ? W.userUtility : sales >= pg.minSalesToGenerate ? W.userUtility * 0.5 : 0,
      internalLinkValue: W.internalLinkValue * Math.min(1, 0.7 + 0.15 * Math.min(2, n.guides.length)), // every market page is linked from its era hub, /eras/ and (when INDEX) the home page
      searchDemand: Math.min(W.searchDemand, Number(demand[n.key] || 0)),
      duplicateContentRisk: 0,
      thinContentRisk: items < inv.thinItems ? W.thinContentRisk : items < inv.minItemsForIndex ? W.thinContentRisk / 2 : 0,
    };
    const d = decide(n.url, 'market', f, { node: n, key: n.key });
    if (items < inv.minItemsForIndex) d.reasons.push(`only ${items} active listings (< ${inv.minItemsForIndex})`);
    if (n.sourceCount < inv.minSourcesForIndex) d.reasons.push(`only ${n.sourceCount} source(s) (< ${inv.minSourcesForIndex})`);
  }

  /* ── duplicate clusters among market pages in the same era ─ */
  for (const era of model.eras) {
    const list = era.nodeList.filter((n) => decisions.get(n.url)?.state !== 'NOT_GENERATED');
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const sim = jaccard(a.itemIds, b.itemIds);
      if (sim >= config.duplicate.jaccardThreshold) {
        // the smaller page canonicalizes to the larger
        const [big, small] = a.items.length >= b.items.length ? [a, b] : [b, a];
        const ds = decisions.get(small.url);
        ds.factors.duplicateContentRisk = W.duplicateContentRisk;
        ds.state = 'CANONICAL_TO_PARENT';
        ds.canonical = big.url;
        ds.reasons.push(`listing set ${Math.round(sim * 100)}% identical to ${big.url}`);
        ds.locked = true;
      }
    }
    // an era whose inventory is ≥ eraDominanceShare in one category: hub ≈ that page
    if (era.itemCount >= inv.minItemsForIndex && list.length) {
      const top = list[0];
      if (top.items.length / era.itemCount >= config.duplicate.eraDominanceShare && list.length < 3) {
        const d = decisions.get(top.url);
        if (!d.locked) {
          d.factors.duplicateContentRisk = W.duplicateContentRisk / 2;
          d.reasons.push(`holds ${Math.round(100 * top.items.length / era.itemCount)}% of the ${era.name} inventory — near-duplicate of the era hub`);
        }
      }
    }
  }

  /* ── price-guide pages (era × category, from recorded sales) ── */
  for (const n of model.nodes) {
    const s = n.stats;
    if (s.n < pg.minSalesToGenerate) {
      decide(n.priceGuideUrl, 'price-guide', {}, { state: 'NOT_GENERATED', reasons: [`${s.n} recorded sales (< ${pg.minSalesToGenerate})`], node: n });
      continue;
    }
    const f = {
      inventoryDepth: W.inventoryDepth * ramp(s.n, 20, 150),
      sourceDiversity: W.sourceDiversity * ramp(s.sourceCount, 2, 6),
      uniqueContent: n.priceContent?.publishable ? W.uniqueContent * (n.priceContent.words >= 120 ? 1 : 0.6) : 0,
      historicalContext: Math.min(W.historicalContext, n.guides.length * (W.historicalContext / 2)),
      userUtility: W.userUtility * (s.years.length >= 3 ? 1 : s.years.length >= 1 ? 0.8 : 0.6),
      internalLinkValue: W.internalLinkValue * (n.items.length ? 0.8 : 0.5),
      searchDemand: Math.min(W.searchDemand, Number(demand[`price-guide/${n.key}`] || 0)),
      duplicateContentRisk: 0,
      thinContentRisk: s.n < pg.minSalesToIndex ? W.thinContentRisk : 0,
    };
    const d = decide(n.priceGuideUrl, 'price-guide', f, { node: n, key: `price-guide/${n.key}` });
    if (s.n < pg.minSalesToIndex) d.reasons.push(`${s.n} recorded sales (< ${pg.minSalesToIndex} for INDEX)`);
    if (s.sourceCount < pg.minSourcesToIndex) d.reasons.push(`${s.sourceCount} sale source(s) (< ${pg.minSourcesToIndex} for INDEX)`);
  }

  /* ── era hubs ──────────────────────────────────────────── */
  for (const era of model.eras) {
    const generated = era.nodeList.filter((n) => decisions.get(n.url)?.state !== 'NOT_GENERATED');
    if (!era.itemCount && !era.soldCount) {
      decide(era.url, 'era', {}, { state: 'NOT_GENERATED', reasons: ['no listings or sales'], era });
      continue;
    }
    const f = {
      inventoryDepth: W.inventoryDepth * ramp(era.itemCount, 100, 1000),
      sourceDiversity: W.sourceDiversity * ramp(era.sourceCount, 4, 12),
      uniqueContent: era.content?.publishable ? W.uniqueContent : 0,
      historicalContext: Math.min(W.historicalContext, (era.guides?.length || 0) * (W.historicalContext / 2)),
      userUtility: W.userUtility * ramp(generated.length, 3, 12),
      internalLinkValue: W.internalLinkValue,
      searchDemand: Math.min(W.searchDemand, Number(demand[era.slug] || 0)),
      duplicateContentRisk: 0,
      thinContentRisk: era.itemCount < config.eraHub.minItemsForIndex ? W.thinContentRisk : 0,
    };
    const d = decide(era.url, 'era', f, { era });
    if (era.itemCount < config.eraHub.minItemsForIndex) d.reasons.push(`${era.itemCount} listings (< ${config.eraHub.minItemsForIndex})`);
    if (generated.length < config.eraHub.minCategoriesForIndex) d.reasons.push(`${generated.length} category page(s) (< ${config.eraHub.minCategoriesForIndex})`);
  }

  /* ── resolve states from scores ────────────────────────── */
  for (const d of decisions.values()) {
    if (d.state === 'NOT_GENERATED' || d.locked) continue;
    const hasUniqueValue = (d.factors.uniqueContent || 0) > 0 || (d.factors.userUtility || 0) >= (W.userUtility * 0.5);
    const hardBlock = d.reasons.length > 0; // any minimum-threshold failure blocks INDEX outright
    if (hardBlock) d.state = 'NOINDEX';
    else if (d.score >= T.index) d.state = 'INDEX';
    else if (d.score >= T.reviewBand) d.state = hasUniqueValue ? 'INDEX' : 'NOINDEX';
    else d.state = 'NOINDEX';
    if (d.state === 'NOINDEX' && !hardBlock) d.reasons.push(d.score >= T.reviewBand ? `score ${d.score} in review band without verified editorial or price data` : `score ${d.score} < ${T.reviewBand}`);
  }

  return decisions;
}

/** Explain a decision in one line — used by the report and the HTML comment. */
export function explain(d) {
  const f = Object.entries(d.factors).filter(([, v]) => v).map(([k, v]) => `${k}=${Math.round(v)}`).join(' ');
  return `${d.state} score=${d.score} ${f}${d.reasons.length ? ' — ' + d.reasons.join('; ') : ''}`;
}
