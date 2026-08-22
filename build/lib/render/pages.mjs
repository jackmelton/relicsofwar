/* Page templates. Every renderer returns { path, html } (path = site-relative
   URL; the writer maps /a/b/ → a/b/index.html). Nothing here decides
   indexability — that arrived in `d` (the engine decision). */
import { esc, attr, money, cents, num, prettyDate, monthYear, isoDate } from '../util.mjs';
import { head, foot, breadcrumbs, SITE, AS, ORG_LD, WEBSITE_LD, FALLBACK_IMAGE, pageLd, itemListLd } from './layout.mjs';

const T = (s, config) => `${s}${config.titles.suffix}`;
/* Short era names for <title> only (the H1 keeps the full name). */
const ERA_SHORT = { 'pre-wwi': 'Pre-WWI', 'early-republic': 'Early Republic', 'antebellum-frontier': 'Antebellum', 'indian-wars': 'Indian Wars', 'postwar-occupation': 'Postwar', 'early-american': 'Early American', 'colonial': 'Colonial' };
const eraT = (era) => ERA_SHORT[era.slug] || era.name;
/* Category names for <title>: drop an "& …" tail when the whole title would run long. */
const catT = (name, budget = 40) => (name.length > budget && name.includes(' & ') ? name.split(' & ')[0] : name);
const span = (from, to) => { if (!from) return ''; const a = from.slice(0, 4), b = (to || from).slice(0, 4); return a === b ? a : `${a}–${b}`; };

/* ── shared fragments ─────────────────────────────────────── */

export function imgUrl(raw, w = 480) {
  if (!raw) return null;
  if (raw.startsWith('/')) return `${AS}${raw}`;
  return `${AS}/api/img?url=${encodeURIComponent(raw)}&w=${w}`;
}

function priceLabel(l) {
  if (l.price != null && l.price > 0) return money(l.price);
  if (l.estimateLow != null || l.estimateHigh != null) {
    const lo = l.estimateLow != null ? money(l.estimateLow) : '';
    const hi = l.estimateHigh != null ? money(l.estimateHigh) : '';
    return `Est. ${lo}${lo && hi ? '–' : ''}${hi}`;
  }
  if (l.saleType === 'AUCTION') return 'At auction';
  if (l.saleType === 'MAKE_OFFER') return 'Make offer';
  return 'Inquire';
}

function availabilityBadge(l) {
  switch (l.availability) {
    case 'BIDDING_OPEN': return '<span class="badge-sm live">Bidding open</span>';
    case 'UPCOMING_AUCTION': return `<span class="badge-sm">Upcoming auction${l.auctionDate ? ' · ' + monthYear(l.auctionDate) : ''}</span>`;
    case 'PENDING_SALE': return '<span class="badge-sm">Sale pending</span>';
    default: return '';
  }
}

export function itemCard(l, { eager = false } = {}) {
  const src = imgUrl(l.imageUrl, 480);
  const img = src
    ? `<img src="${attr(src)}" srcset="${attr(imgUrl(l.imageUrl, 320))} 320w, ${attr(src)} 480w, ${attr(imgUrl(l.imageUrl, 800))} 800w" sizes="(max-width:600px) 92vw, (max-width:1000px) 44vw, 300px" width="480" height="360" alt="${attr(l.title)}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>`
    : `<div class="noimg" aria-hidden="true">No photo</div>`;
  return `<a class="item" href="${attr(l.url)}" rel="noopener">
  <div class="ph">${img}</div>
  <div class="body">
    <h3>${esc(l.title)}</h3>
    <div class="row"><span class="price">${esc(priceLabel(l))}</span>${availabilityBadge(l)}</div>
    <div class="src">${esc(l.sourceName)}</div>
  </div>
</a>`;
}

function statTiles(tiles) {
  return `<div class="stats">${tiles.map((t) => `<div class="stat"><div class="v">${t.v}</div><div class="k">${t.k}</div></div>`).join('')}</div>`;
}

function editorial(content, cls = 'editorial') {
  if (!content?.publishable) return '';
  return `<div class="${cls}">${content.html}</div>`;
}

function guideCards(guides) {
  if (!guides.length) return '';
  return `<section class="band">
  <h2>Identification &amp; Authentication</h2>
  <div class="grid">${guides.map((g) => `<a class="card" href="${attr(g.url)}"><div class="num">&#10070;</div><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><span class="go">Read the guide &rarr;</span></a>`).join('')}</div>
</section>`;
}

function statusStrip(d) {
  return `<p class="fine data-note">Live listing data via <a href="${AS}/" rel="noopener">ArtifactSearch.com</a>, refreshed nightly. Each item links to the dealer or auction house offering it — Relics of War sells nothing and takes no commission.</p>`;
}

/* ── home ─────────────────────────────────────────────────── */

export function renderHome({ model, decisions, config, featured }) {
  const eras = model.eras.filter((e) => decisions.get(e.url)?.state !== 'NOT_GENERATED');
  const civilWar = model.eraBySlug.get('civil-war');
  const title = 'Relics of War — Military Antiques by Era, Guides & Prices';
  const description = 'Military antiques by war and category, Revolution through Vietnam — recorded sold prices, identification guides, and current listings from vetted dealers and auction houses.';
  const jsonld = [WEBSITE_LD, ORG_LD, pageLd({ path: '/', name: title, description, image: FALLBACK_IMAGE })];
  const html = head({ title, description, path: '/', canonical: `${SITE}/`, state: 'INDEX', jsonld }) + `
<main>
  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">Discovery · Identification · Values</div>
      <h1>Relics <span class="amp">of</span> War</h1>
      <div class="rule"></div>
      <p class="lede">Authentic military antiques by war and category — ${num(model.totals.listings)} current listings from ${num(model.totals.sources)} vetted dealers and auction houses, ${num(model.totals.sold)} recorded sales for the price guide, and free identification guides.</p>
      <a href="/eras/" class="cta">Browse by Era</a>
      <a href="/price-guide/" class="cta ghost">Price Guide</a>
    </div>
  </section>

  <section id="eras">
    <div class="wrap">
      <div class="section-head"><div class="eyebrow">Browse by War &amp; Era</div><h2>Where Do You Collect?</h2></div>
      <div class="era-grid">
        ${eras.map((e) => `<a class="era-tile" href="${e.url}"><h3>${esc(e.name)}</h3><span class="yrs">${e.startYear ?? ''}${e.endYear ? '–' + e.endYear : ''}</span><span class="count">${num(e.itemCount)} listings${e.soldCount ? ' · ' + num(e.soldCount) + ' recorded sales' : ''}</span></a>`).join('')}
      </div>
    </div>
  </section>

  ${featured.length ? `<section class="alt">
    <div class="wrap">
      <div class="section-head"><div class="eyebrow">Most Active Right Now</div><h2>Featured Categories</h2><p>The deepest current inventory across the marketplace, updated nightly.</p></div>
      <div class="cat-grid">
        ${featured.map((n) => `<a class="cat-tile" href="${n.url}"><h3>${esc(n.era.name)} ${esc(n.category.name)}</h3><p>${num(n.items.length)} listings from ${n.sourceCount} source${n.sourceCount === 1 ? '' : 's'}${n.stats.n ? ` · median sold ${cents(n.stats.median)}` : ''}</p><span class="count">Browse &rarr;</span></a>`).join('')}
      </div>
    </div>
  </section>` : ''}

  <section>
    <div class="wrap">
      <div class="section-head"><div class="eyebrow">Know Before You Buy</div><h2>Identify &amp; Authenticate</h2><p>Free guides to tell an original from a reproduction before money changes hands.</p></div>
      <div class="grid">
        ${model.guides.filter((g) => g.exists).slice(0, 5).map((g) => `<a class="card" href="${attr(g.url)}"><div class="num">&#10070;</div><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><span class="go">Read the guide &rarr;</span></a>`).join('')}
        <a class="card" href="/identify/"><div class="num">&plus;</div><h3>The Identification Library</h3><p>All guides, with more added as they are researched and verified.</p><span class="go">Browse the library &rarr;</span></a>
      </div>
    </div>
  </section>

  <section class="submitband">
    <div class="wrap">
      <div class="section-head"><div class="eyebrow" style="color:var(--brass-bright)">Free Membership</div><h2>Save Searches, Get Alerts, Track Values</h2></div>
      <p>Membership is free and lives on ArtifactSearch.com — save searches, get alerts when a piece like yours comes to market, and keep your favorites in one place.</p>
      <a href="${AS}/account/register" class="cta" rel="noopener">Join Free on ArtifactSearch</a>
    </div>
  </section>

  <section class="alt">
    <div class="wrap narrow" style="text-align:center">
      <div class="section-head"><div class="eyebrow">Two Sites, One Purpose</div><h2>How Relics of War Fits With ArtifactSearch</h2></div>
      <p style="font-size:1.1rem;color:#39342a"><a href="${AS}/" rel="noopener">ArtifactSearch.com</a> is the comprehensive marketplace search engine — every listing, every dealer, every auction, searchable. <strong>Relics of War</strong> is the curated companion: discovery by war and category, identification guides, and a price guide built from recorded sales. Every listing you see here links straight to its page on ArtifactSearch and on to the seller.</p>
      <p style="color:var(--muted)">Both are publications of Historical Publications LLC — publishers of <strong>Civil War News</strong> and <strong>Military Antique Collector</strong>. <a href="/how-listings-work/">How marketplace listings work</a> &middot; <a href="/how-prices-work/">How the price guide works</a></p>
    </div>
  </section>
</main>` + foot(model.pages);
  return { path: '/', html };
}

/* ── eras index (/eras/) ──────────────────────────────────── */

export function renderErasIndex({ model, decisions, config }) {
  const eras = model.eras.filter((e) => decisions.get(e.url)?.state !== 'NOT_GENERATED');
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Browse by Era', url: '/eras/' }]);
  const title = T('Browse Military Antiques by War & Era', config);
  const description = `Every war and era in the marketplace, from ${eras[0]?.name ?? 'the Colonial period'} to ${eras.at(-1)?.name ?? 'Vietnam'} — current listings by category and recorded sold prices for each.`;
  const jsonld = [bc.ld, pageLd({ type: 'CollectionPage', path: '/eras/', name: 'Browse Military Antiques by War & Era', description, breadcrumb: bc.ld, mainEntity: itemListLd({ name: 'Wars and eras', items: eras.map((e) => ({ name: e.name, url: SITE + e.url })) }) })];
  const html = head({ title, description, path: '/eras/', canonical: `${SITE}/eras/`, state: 'INDEX', jsonld }) + `
<main class="wrap">
  ${bc.html}
  <article class="hub">
    <div class="eyebrow">Browse</div>
    <h1>By War &amp; Era</h1>
    <p class="standfirst">Pick the period you collect. Each era page breaks the current marketplace down by category, with recorded sold prices where the price guide has enough data to be honest.</p>
    ${eras.map((e) => {
      const gen = e.nodeList.filter((n) => decisions.get(n.url)?.state !== 'NOT_GENERATED');
      return `<section class="era-block">
      <h2><a href="${e.url}">${esc(e.name)}</a> <span class="yrs">${e.startYear ?? ''}${e.endYear ? '–' + e.endYear : ''}</span></h2>
      <p class="muted">${num(e.itemCount)} current listings${e.soldCount ? ` · ${num(e.soldCount)} recorded sales` : ''}</p>
      <ul class="chip-list">${gen.slice(0, 14).map((n) => `<li><a href="${n.url}">${esc(n.category.name)} <span>${num(n.items.length)}</span></a></li>`).join('')}${gen.length > 14 ? `<li><a href="${e.url}">All ${gen.length} categories &rarr;</a></li>` : ''}</ul>
    </section>`;
    }).join('')}
  </article>
</main>` + foot(model.pages);
  return { path: '/eras/', html };
}

/* ── era hub ──────────────────────────────────────────────── */

export function renderEra({ era, model, decisions, d, config }) {
  const gen = era.nodeList.filter((n) => decisions.get(n.url)?.state !== 'NOT_GENERATED');
  const priced = era.nodeList.filter((n) => decisions.get(n.priceGuideUrl)?.state !== 'NOT_GENERATED').sort((a, b) => b.stats.n - a.stats.n);
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Browse by Era', url: '/eras/' }, { name: era.name, url: era.url }]);
  const yrs = `${era.startYear ?? ''}${era.endYear ? '–' + era.endYear : ''}`;
  const title = T(`${eraT(era)} Military Antiques & Relics`, config);
  const description = `${era.name} (${yrs}) military antiques — ${gen.slice(0, 2).map((n) => catT(n.category.name, 24).toLowerCase()).join(', ')}${gen.length > 2 ? ' and more' : ''}: ${num(era.itemCount)} listings from vetted sellers${era.soldCount ? `, ${num(era.soldCount)} recorded sales` : ''}.`;
  const jsonld = [bc.ld, pageLd({ type: 'CollectionPage', path: era.url, name: `${era.name} Military Antiques`, description, breadcrumb: bc.ld, about: { '@type': 'Thing', name: era.name }, mainEntity: itemListLd({ name: `${era.name} categories`, items: gen.map((n) => ({ name: n.category.name, url: SITE + n.url })) }) })];
  const canonical = SITE + d.canonical;
  const html = head({ title, description, path: era.url, canonical, state: d.state, jsonld, stateNote: d.note }) + `
<main class="wrap">
  ${bc.html}
  <article class="hub">
    <div class="eyebrow">${esc(yrs)}</div>
    <h1>${esc(era.name)}</h1>
    ${era.description ? `<p class="standfirst">${esc(era.description)}</p>` : ''}
    ${statTiles([{ v: num(era.itemCount), k: 'current listings' }, { v: num(era.sourceCount), k: 'dealers & auction houses' }, { v: num(era.soldCount), k: 'recorded sales' }, { v: num(gen.length), k: 'categories' }])}
    ${editorial(era.content)}

    <h2>Browse ${esc(era.name)} by Category</h2>
    <div class="cat-grid">
      ${gen.map((n) => `<a class="cat-tile" href="${n.url}"><h3>${esc(n.category.name)}</h3><p>${num(n.items.length)} listing${n.items.length === 1 ? '' : 's'} · ${n.sourceCount} source${n.sourceCount === 1 ? '' : 's'}${n.stats.n >= config.priceGuide.minSalesToGenerate ? ` · ${num(n.stats.n)} recorded sales` : ''}</p><span class="count">Browse &rarr;</span></a>`).join('')}
    </div>

    ${priced.length ? `<h2>${esc(era.name)} Price Guide</h2>
    <p class="muted">Median realized prices from recorded auction and dealer sales. Small samples are shown with their size — never as more than they are.</p>
    <table class="pg-table">
      <thead><tr><th>Category</th><th>Recorded sales</th><th>Median</th><th>Range</th><th></th></tr></thead>
      <tbody>${priced.slice(0, 20).map((n) => `<tr><td><a href="${n.priceGuideUrl}">${esc(n.category.name)}</a></td><td>${num(n.stats.n)}</td><td>${cents(n.stats.median)}</td><td>${cents(n.stats.low)}–${cents(n.stats.high)}</td><td><a href="${n.priceGuideUrl}">Guide &rarr;</a></td></tr>`).join('')}</tbody>
    </table>` : ''}

    ${guideCards(era.guides || [])}

    <p class="handoff">Want every ${esc(era.name)} listing with full search and filters? <a href="${AS}/eras/${attr(era.slug)}" rel="noopener">Open ${esc(era.name)} on ArtifactSearch &#8599;</a></p>
    ${statusStrip()}
  </article>
</main>` + foot(model.pages);
  return { path: era.url, html };
}

/* ── market page (era × category) with pagination ────────── */

export function renderMarket({ node: n, model, decisions, d, config }) {
  const inv = config.inventory;
  const per = inv.cardsPerPage;
  const totalPages = Math.min(inv.maxPages, Math.max(1, Math.ceil(n.items.length / per)));
  const pages = [];
  const pd = decisions.get(n.priceGuideUrl);
  const hasGuide = pd && pd.state !== 'NOT_GENERATED';
  const catName = n.category.name;
  const eraName = n.era.name;
  const bcBase = [{ name: 'Home', url: '/' }, { name: 'Browse by Era', url: '/eras/' }, { name: eraName, url: n.era.url }, { name: catName, url: n.url }];

  for (let p = 1; p <= totalPages; p++) {
    const path = p === 1 ? n.url : `${n.url}page/${p}/`;
    const slice = n.items.slice((p - 1) * per, p * per);
    const bc = breadcrumbs(p === 1 ? bcBase : [...bcBase, { name: `Page ${p}`, url: path }]);
    const baseTitle = `${eraT(n.era)} ${catT(catName)}`;
    const title = T(p === 1 ? `${baseTitle} for Sale` : `${baseTitle} — Page ${p}`, config);
    const description = p === 1
      ? `${num(n.items.length)} ${eraName} ${catName.toLowerCase()} listings from ${n.sourceCount} dealer${n.sourceCount === 1 ? '' : 's'} and auction house${n.sourceCount === 1 ? '' : 's'}${n.stats.n >= config.priceGuide.minSalesToGenerate ? `, plus sold prices from ${num(n.stats.n)} recorded sales` : ''}. Each links to its seller.`
      : `${eraName} ${catName.toLowerCase()} — page ${p} of ${totalPages}. Current listings from vetted dealers and auction houses.`;
    const state = p === 1 ? d.state : 'NOINDEX';
    const canonical = p === 1 ? SITE + d.canonical : SITE + path;
    // Share image: the first listing photo on this page (a representative artifact the page shows), else the site image.
    const ogImage = slice[0]?.imageUrl ? { url: imgUrl(slice[0].imageUrl, 1200), alt: slice[0].title } : FALLBACK_IMAGE;
    const jsonld = [bc.ld, pageLd({
      type: 'CollectionPage', path, name: p === 1 ? `${eraName} ${catName}` : `${eraName} ${catName} — page ${p}`, description, image: ogImage, breadcrumb: bc.ld,
      about: { '@type': 'Thing', name: `${eraName} ${catName}` },
      // Only the cards actually rendered on page 1 (§8: never hidden records); pagination pages are noindex and carry just the page entity.
      mainEntity: p === 1 ? itemListLd({ name: `${eraName} ${catName} listings`, items: slice.map((l) => ({ name: l.title, url: l.url, ...(l.imageUrl ? { image: imgUrl(l.imageUrl, 800) } : {}) })) }) : undefined,
    })];

    const pager = totalPages > 1 ? `<nav class="pager" aria-label="Pagination">
      ${p > 1 ? `<a href="${p === 2 ? n.url : `${n.url}page/${p - 1}/`}" rel="prev">&larr; Newer</a>` : '<span></span>'}
      <span>Page ${p} of ${totalPages}</span>
      ${p < totalPages ? `<a href="${n.url}page/${p + 1}/" rel="next">Older &rarr;</a>` : `<a href="${attr(n.asSearchUrl)}" rel="noopener">All ${num(n.items.length)} on ArtifactSearch &#8599;</a>`}
    </nav>` : '';

    const html = head({ title, description, path, canonical, state, jsonld, ogImage, stateNote: p === 1 ? d.note : 'pagination page: noindex,follow' }) + `
<main class="wrap">
  ${bc.html}
  <article class="market">
    <div class="eyebrow"><a href="${n.era.url}">${esc(eraName)}</a></div>
    <h1>${esc(eraName)} ${esc(catName)}${p > 1 ? ` <span class="pg">— page ${p}</span>` : ''}</h1>
    ${p === 1 ? `${statTiles([{ v: num(n.items.length), k: 'current listings' }, { v: num(n.sourceCount), k: 'dealers & auction houses' }, ...(n.stats.n >= config.priceGuide.minSalesToGenerate ? [{ v: cents(n.stats.median), k: `median of ${num(n.stats.n)} recorded sales` }] : [])])}
    ${editorial(n.content)}
    ${n.subcatList.length ? `<div class="subcats"><span class="lbl">Within ${esc(catName)}:</span> ${n.subcatList.slice(0, 12).map((s) => `<a href="${AS}/search?era=${attr(n.era.slug)}&category=${attr(s.slug)}" rel="noopener">${esc(s.cat.name)} <span>${num(s.count)}</span></a>`).join('')}</div>` : ''}
    ${hasGuide ? `<div class="pg-callout"><div><strong>${esc(eraName)} ${esc(catName)} Price Guide</strong> — ${num(n.stats.n)} recorded sales, median ${cents(n.stats.median)}, range ${cents(n.stats.low)}–${cents(n.stats.high)}.</div><a class="cta dark" href="${n.priceGuideUrl}">See the price guide</a></div>` : ''}` : ''}

    <h2 class="vh">Listings</h2>
    <div class="items">${slice.map((l, i) => itemCard(l, { eager: p === 1 && i < 4 })).join('\n')}</div>
    ${pager}

    ${p === 1 ? guideCards(n.guides) : ''}
    ${p === 1 && n.subcatList.length === 0 && n.items.length > per * totalPages ? `<p class="handoff"><a href="${attr(n.asSearchUrl)}" rel="noopener">See all ${num(n.items.length)} ${esc(eraName)} ${esc(catName.toLowerCase())} on ArtifactSearch &#8599;</a></p>` : ''}
    <p class="handoff">Search, filter and sort every ${esc(eraName)} ${esc(catName.toLowerCase())} listing on <a href="${attr(n.asSearchUrl)}" rel="noopener">ArtifactSearch &#8599;</a></p>
    ${statusStrip()}
  </article>
</main>` + foot(model.pages);
    pages.push({ path, html, state, isPagination: p > 1 });
  }
  return pages;
}

/* ── price guide index (/price-guide/) ────────────────────── */

export function renderPriceGuideIndex({ model, decisions, config, methodologyUrl }) {
  const nodes = model.nodes.filter((n) => decisions.get(n.priceGuideUrl)?.state !== 'NOT_GENERATED');
  const byEra = new Map();
  for (const n of nodes) { if (!byEra.has(n.era.slug)) byEra.set(n.era.slug, []); byEra.get(n.era.slug).push(n); }
  const eras = model.eras.filter((e) => byEra.has(e.slug));
  const totalSales = nodes.reduce((a, n) => a + n.stats.n, 0);
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Price Guide', url: '/price-guide/' }]);
  const title = T('Military Antique Price Guide — Recorded Sold Prices', config);
  const description = `What military antiques actually sell for: medians and ranges from ${num(totalSales)} recorded auction and dealer sales, by war and category, with the sample size on every figure.`;
  for (const list of byEra.values()) list.sort((a, b) => b.stats.n - a.stats.n);
  const jsonld = [bc.ld, pageLd({ type: 'CollectionPage', path: '/price-guide/', name: 'Military Antique Price Guide — Recorded Sold Prices', description, breadcrumb: bc.ld, mainEntity: itemListLd({ name: 'Price guides by war and category', items: eras.flatMap((e) => byEra.get(e.slug).map((n) => ({ name: `${e.name} ${n.category.name} Price Guide`, url: SITE + n.priceGuideUrl }))) }) })];
  const html = head({ title, description, path: '/price-guide/', canonical: `${SITE}/price-guide/`, state: 'INDEX', jsonld }) + `
<main class="wrap">
  ${bc.html}
  <article class="hub">
    <div class="eyebrow">Recorded Sold Prices</div>
    <h1>The Price Guide</h1>
    <p class="standfirst">Every figure below is computed from recorded sales — hammer prices and realized totals from auction houses, and recorded dealer sales — never from asking prices, and never estimated. Sample sizes are shown everywhere. <a href="${methodologyUrl}">How the price guide works &rarr;</a></p>
    ${statTiles([{ v: num(totalSales), k: 'recorded sales in the guide' }, { v: num(nodes.length), k: 'era × category guides' }, { v: num(eras.length), k: 'eras covered' }])}
    ${eras.map((e) => {
      const list = byEra.get(e.slug).sort((a, b) => b.stats.n - a.stats.n);
      return `<section class="era-block">
      <h2><a href="${e.url}">${esc(e.name)}</a></h2>
      <table class="pg-table">
        <thead><tr><th>Category</th><th>Recorded sales</th><th>Median</th><th>Range</th><th>Span</th></tr></thead>
        <tbody>${list.map((n) => `<tr><td><a href="${n.priceGuideUrl}">${esc(n.category.name)}</a></td><td>${num(n.stats.n)}</td><td>${cents(n.stats.median)}</td><td>${cents(n.stats.low)}–${cents(n.stats.high)}</td><td>${span(n.stats.from, n.stats.to)}</td></tr>`).join('')}</tbody>
      </table>
    </section>`;
    }).join('')}
    <p class="handoff">Looking for a specific piece? Search the full sold archive on <a href="${AS}/sold" rel="noopener">ArtifactSearch &#8599;</a></p>
  </article>
</main>` + foot(model.pages);
  return { path: '/price-guide/', html };
}

/* ── price guide page (era × category) ────────────────────── */

export function renderPriceGuide({ node: n, model, decisions, d, config, methodologyUrl }) {
  const s = n.stats;
  const eraName = n.era.name, catName = n.category.name;
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Price Guide', url: '/price-guide/' }, { name: eraName, url: n.era.url }, { name: `${catName} Price Guide`, url: n.priceGuideUrl }]);
  const title = T(`${eraT(n.era)} ${catT(catName)} Price Guide`, config);
  const description = `${eraName} ${catName.toLowerCase()} values from ${num(s.n)} recorded sales${s.from ? ` (${span(s.from, s.to)})` : ''}: median ${cents(s.median)}, range ${cents(s.low)}–${cents(s.high)}, with every sale listed.`;
  const md = decisions.get(n.url);
  const hasMarket = md && md.state !== 'NOT_GENERATED';
  const jsonld = [bc.ld, pageLd({ type: 'CollectionPage', path: n.priceGuideUrl, name: `${eraName} ${catName} Price Guide`, description, breadcrumb: bc.ld, about: { '@type': 'Thing', name: `${eraName} ${catName}` }, mainEntity: itemListLd({ name: `Recent recorded ${eraName} ${catName.toLowerCase()} sales`, items: s.recent.map((r) => ({ name: r.title, url: r.url })) }) })];
  const html = head({ title, description, path: n.priceGuideUrl, canonical: SITE + d.canonical, state: d.state, jsonld, stateNote: d.note }) + `
<main class="wrap">
  ${bc.html}
  <article class="pg">
    <div class="eyebrow"><a href="/price-guide/">Price Guide</a> · <a href="${n.era.url}">${esc(eraName)}</a></div>
    <h1>${esc(eraName)} ${esc(catName)} Price Guide</h1>
    <p class="standfirst">What ${esc(eraName)} ${esc(catName.toLowerCase())} have actually sold for — ${num(s.n)} recorded sales${s.sourceCount ? ` from ${s.sourceCount} auction house${s.sourceCount === 1 ? '' : 's'} and dealer${s.sourceCount === 1 ? '' : 's'}` : ''}${s.from ? `, ${span(s.from, s.to)}` : ''}.</p>
    ${statTiles([{ v: cents(s.median), k: 'median realized' }, { v: `${cents(s.p25)}–${cents(s.p75)}`, k: 'middle half of sales' }, { v: `${cents(s.low)}–${cents(s.high)}`, k: 'full range' }, { v: num(s.n), k: 'recorded sales' }])}
    <p class="fine">Figures are computed from realized prices (hammer or total with premium, as reported by the seller) — never asking prices. ${s.n < 25 ? `<strong>Small sample:</strong> ${num(s.n)} sales is enough to show a range, not to price a specific piece. ` : ''}Condition, attribution, and provenance move individual results far outside these bands. <a href="${methodologyUrl}">How these numbers are calculated &rarr;</a></p>
    ${editorial(n.priceContent)}

    ${s.years.length >= 2 ? `<h2>By Year</h2>
    <table class="pg-table">
      <thead><tr><th>Year</th><th>Sales</th><th>Median</th><th>Low</th><th>High</th></tr></thead>
      <tbody>${s.years.map((y) => `<tr><td>${y.year}</td><td>${num(y.n)}</td><td>${cents(y.median)}</td><td>${cents(y.low)}</td><td>${cents(y.high)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="fine">Years with fewer than ${config.priceGuide.minSalesForYearRow} recorded sales are omitted from the table (they are still in the totals above).</p>` : ''}

    <h2>Recent Recorded Sales</h2>
    <table class="pg-table sales">
      <thead><tr><th>Item</th><th>Sold</th><th>Seller</th><th>Realized</th></tr></thead>
      <tbody>${s.recent.map((r) => `<tr><td><a href="${attr(r.url)}" rel="noopener">${esc(r.title)}</a></td><td>${r.saleDate ? prettyDate(r.saleDate) : '—'}</td><td>${esc(r.sourceName || '—')}</td><td>${cents(r.realizedCents)}</td></tr>`).join('')}</tbody>
    </table>
    ${s.n > s.recent.length ? `<p class="handoff">Showing the ${s.recent.length} most recent of ${num(s.n)}. <a href="${attr(n.asSoldUrl)}" rel="noopener">See every recorded ${esc(eraName)} ${esc(catName.toLowerCase())} sale on ArtifactSearch &#8599;</a></p>` : ''}

    ${hasMarket ? `<div class="pg-callout"><div><strong>Currently for sale:</strong> ${num(n.items.length)} ${esc(eraName)} ${esc(catName.toLowerCase())} listings from ${n.sourceCount} source${n.sourceCount === 1 ? '' : 's'}.</div><a class="cta dark" href="${n.url}">Browse listings</a></div>` : ''}
    ${guideCards(n.guides)}
    <p class="fine data-note">Sold-price data via <a href="${AS}/sold" rel="noopener">ArtifactSearch.com</a>'s sold archive; each sale links to its record. Relics of War does not appraise, authenticate, or sell.</p>
  </article>
</main>` + foot(model.pages);
  return { path: n.priceGuideUrl, html };
}

/* ── static / trust pages from content/pages/*.md ─────────── */

export function renderStaticPage({ page, model, config }) {
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: page.title, url: page.url }]);
  const title = T(page.title, config);
  const pageType = page.slug === 'about' ? 'AboutPage' : page.slug === 'contact' ? 'ContactPage' : 'WebPage';
  const jsonld = [bc.ld, pageLd({ type: pageType, path: page.url, name: page.title, description: page.description, breadcrumb: bc.ld })];
  const html = head({ title, description: page.description, path: page.url, canonical: SITE + page.url, state: 'INDEX', jsonld }) + `
<main class="wrap">
  ${bc.html}
  <article class="prose">
    <h1>${esc(page.title)}</h1>
    ${page.lastReviewed ? `<p class="fine">Last reviewed ${esc(page.lastReviewed)}</p>` : ''}
    ${page.html}
  </article>
</main>` + foot(model.pages);
  return { path: page.url, html };
}

export function render404({ model, config }) {
  const html = head({ title: T('Page Not Found', config), description: 'That page is not here. Browse by era, open the price guide, or search the marketplace on ArtifactSearch.', path: '/404', canonical: `${SITE}/404`, state: 'NOINDEX' }) + `
<main class="wrap">
  <article class="prose" style="text-align:center;padding-top:3rem">
    <div class="eyebrow">404</div>
    <h1>Not Found</h1>
    <p>That page has moved or was never here. Listings come and go nightly; the categories stay.</p>
    <p><a class="cta" href="/eras/">Browse by Era</a> &nbsp; <a class="cta ghost dark-text" href="/price-guide/">Price Guide</a></p>
    <p class="muted">Looking for a specific piece? <a href="${AS}/search" rel="noopener">Search ArtifactSearch &#8599;</a></p>
  </article>
</main>` + foot(model.pages);
  return { path: '/404.html', html, raw: true };
}
