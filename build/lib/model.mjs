/* Build the site model from the ArtifactSearch export + editorial content.
   Pure data — no HTML here. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { median, percentile, readMarkdownFile, PUBLISHABLE_STATES, uniq } from './util.mjs';

/** Categories that never earn a page: the catalog's junk drawer. */
const NEVER_PAGE_CATEGORIES = new Set(['uncategorized']);

export function buildModel(data, { root, config }) {
  const asBase = config.artifactsearch;

  /* ── taxonomy ─────────────────────────────────────────── */
  const catBySlug = new Map(data.categories.map((c) => [c.slug, c]));
  const topOf = (slug) => {
    const c = catBySlug.get(slug);
    if (!c) return null;
    return c.parentSlug && catBySlug.has(c.parentSlug) ? c.parentSlug : c.slug;
  };
  const childrenOf = new Map();
  for (const c of data.categories) if (c.parentSlug) {
    if (!childrenOf.has(c.parentSlug)) childrenOf.set(c.parentSlug, []);
    childrenOf.get(c.parentSlug).push(c);
  }
  const eras = data.eras
    .filter((e) => e.slug && e.name)
    .sort((a, b) => a.order - b.order)
    .map((e) => ({ ...e, url: `/${e.slug}/`, items: [], sold: [], nodes: new Map(), itemIds: new Set() }));
  const eraBySlug = new Map(eras.map((e) => [e.slug, e]));
  const sourceBySlug = new Map(data.sources.map((s) => [s.slug, s]));

  /* ── era × category nodes ─────────────────────────────── */
  const nodes = new Map(); // key era/top → node
  const nodeFor = (era, top) => {
    const key = `${era.slug}/${top}`;
    let n = nodes.get(key);
    if (!n) {
      const cat = catBySlug.get(top);
      n = {
        key,
        type: 'market',
        era,
        category: cat,
        url: `/${era.slug}/${top}/`,
        priceGuideUrl: `/price-guide/${era.slug}/${top}/`,
        items: [],
        itemIds: new Set(),
        subcats: new Map(),
        sold: [],
        content: null,
        guides: [],
        asSearchUrl: `${asBase}/search?era=${encodeURIComponent(era.slug)}&category=${encodeURIComponent(top)}`,
        asSoldUrl: `${asBase}/sold?era=${encodeURIComponent(era.slug)}&category=${encodeURIComponent(top)}`,
      };
      nodes.set(key, n);
      era.nodes.set(top, n);
    }
    return n;
  };

  let unplacedItems = 0;
  for (const l of data.listings) {
    const era = l.eraSlug ? eraBySlug.get(l.eraSlug) : null;
    if (!era) { unplacedItems++; continue; }
    era.items.push(l);
    era.itemIds.add(l.id);
    const cats = uniq([l.categorySlug, ...(l.additionalCategorySlugs || [])].filter(Boolean));
    const tops = uniq(cats.map(topOf).filter((t) => t && !NEVER_PAGE_CATEGORIES.has(t)));
    for (const top of tops) {
      const n = nodeFor(era, top);
      if (n.itemIds.has(l.id)) continue;
      n.itemIds.add(l.id);
      n.items.push(l);
      for (const c of cats) {
        if (topOf(c) !== top || c === top) continue;
        n.subcats.set(c, (n.subcats.get(c) || 0) + 1);
      }
    }
  }

  let unplacedSold = 0;
  for (const s of data.sold) {
    const era = s.eraSlug ? eraBySlug.get(s.eraSlug) : null;
    const top = s.categorySlug ? topOf(s.categorySlug) : null;
    if (!era || !top || NEVER_PAGE_CATEGORIES.has(top)) { unplacedSold++; continue; }
    era.sold.push(s);
    nodeFor(era, top).sold.push(s);
  }

  /* ── per-node derived data ────────────────────────────── */
  const byRecency = (a, b) => (b.firstSeenAt || '').localeCompare(a.firstSeenAt || '');
  for (const n of nodes.values()) {
    n.items.sort(byRecency);
    n.sourceSlugs = uniq(n.items.map((i) => i.sourceSlug));
    n.sourceCount = n.sourceSlugs.length;
    n.subcatList = [...n.subcats.entries()]
      .map(([slug, count]) => ({ cat: catBySlug.get(slug), slug, count }))
      .filter((x) => x.cat)
      .sort((a, b) => b.count - a.count);
    n.stats = soldStats(n.sold, config);
    n.content = loadEditorial(join(root, 'content', 'era-category', `${n.era.slug}--${n.category.slug}.md`));
    n.priceContent = loadEditorial(join(root, 'content', 'price-guide', `${n.era.slug}--${n.category.slug}.md`));
  }
  for (const e of eras) {
    e.items.sort(byRecency);
    e.itemCount = e.items.length;
    e.soldCount = e.sold.length;
    e.sourceCount = uniq(e.items.map((i) => i.sourceSlug)).length;
    e.content = loadEditorial(join(root, 'content', 'eras', `${e.slug}.md`));
    e.nodeList = [...e.nodes.values()].sort((a, b) => b.items.length - a.items.length || a.category.name.localeCompare(b.category.name));
  }

  /* ── guides (Identification Library) ─────────────────── */
  const guides = loadGuides(root);
  for (const g of guides) {
    const era = eraBySlug.get(g.era);
    if (!era) continue;
    era.guides = era.guides || [];
    era.guides.push(g);
    for (const c of g.categories) {
      const n = nodes.get(`${g.era}/${c}`);
      if (n) n.guides.push(g);
    }
  }

  /* ── trust / site pages ───────────────────────────────── */
  const pages = loadPages(root);

  return {
    generatedAt: data.generatedAt,
    eras,
    eraBySlug,
    catBySlug,
    childrenOf,
    topOf,
    sourceBySlug,
    sources: data.sources,
    nodes: [...nodes.values()].sort((a, b) => b.items.length - a.items.length),
    guides,
    pages,
    totals: {
      listings: data.listings.length,
      sold: data.sold.length,
      sources: data.sources.length,
      unplacedItems,
      unplacedSold,
    },
  };
}

/** Sold-price statistics for one era × category. Never more precision than the
 *  data supports: everything carries n, and by-year rows need minSalesForYearRow. */
export function soldStats(sold, config) {
  const pg = config.priceGuide;
  const usable = sold.filter((s) => Number.isFinite(s.realizedCents) && s.realizedCents > 0);
  if (!usable.length) return { n: 0 };
  const cents = usable.map((s) => s.realizedCents);
  const dated = usable.filter((s) => s.saleDate).sort((a, b) => a.saleDate.localeCompare(b.saleDate));
  const byYear = new Map();
  for (const s of dated) {
    const y = s.saleDate.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(s.realizedCents);
  }
  const years = [...byYear.entries()]
    .filter(([, arr]) => arr.length >= pg.minSalesForYearRow)
    .map(([year, arr]) => ({ year, n: arr.length, median: median(arr), low: Math.min(...arr), high: Math.max(...arr) }))
    .sort((a, b) => a.year.localeCompare(b.year));
  const sources = uniq(usable.map((s) => s.sourceSlug || s.sourceName).filter(Boolean));
  const auctions = usable.filter((s) => s.saleType === 'AUCTION').length;
  return {
    n: usable.length,
    median: median(cents),
    p25: percentile(cents, 0.25),
    p75: percentile(cents, 0.75),
    low: Math.min(...cents),
    high: Math.max(...cents),
    from: dated[0]?.saleDate ?? null,
    to: dated[dated.length - 1]?.saleDate ?? null,
    years,
    sourceCount: sources.length,
    auctionShare: usable.length ? auctions / usable.length : 0,
    recent: [...usable].sort((a, b) => (b.saleDate || '').localeCompare(a.saleDate || '')).slice(0, pg.recentSalesShown),
  };
}

function loadEditorial(path) {
  const md = readMarkdownFile(path);
  if (!md) return null;
  const status = (md.meta.status || 'DRAFT').toUpperCase();
  return { ...md, status, publishable: PUBLISHABLE_STATES.has(status), path };
}

function loadGuides(root) {
  const cfg = JSON.parse(readFileSync(join(root, 'content', 'guides.json'), 'utf8'));
  return cfg.guides.map((g) => {
    const file = join(root, g.url.replace(/^\//, '') + '.html');
    const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.replace(/\s*[—|-]\s*Relics of War\s*$/i, '') ?? g.url;
    const description = /<meta name="description" content="([^"]*)"/i.exec(html)?.[1] ?? '';
    return { ...g, file, exists: existsSync(file), title: decodeEntities(title), description: decodeEntities(description) };
  });
}

function loadPages(root) {
  const dir = join(root, 'content', 'pages');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const md = readMarkdownFile(join(dir, f));
    const slug = md.meta.slug || f.replace(/\.md$/, '');
    const status = (md.meta.status || 'DRAFT').toUpperCase();
    return { slug, url: `/${slug}/`, title: md.meta.title || slug, description: md.meta.description || '', status, publishable: PUBLISHABLE_STATES.has(status), html: md.html, words: md.words, nav: md.meta.nav || '', order: Number(md.meta.order || 99), lastReviewed: md.meta.lastReviewed || '' };
  }).sort((a, b) => a.order - b.order);
}

function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
