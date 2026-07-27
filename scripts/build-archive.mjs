#!/usr/bin/env node
/* ============================================================================
   Relics of War — Price Guide generator
   Reads data/categories.json + data/sales.json and writes static, indexable
   price-guide pages plus sitemap.xml.

   Run:  node scripts/build-archive.mjs
   ----------------------------------------------------------------------------
   Each record in data/sales.json becomes one page at:
     /price-guide/<category>/<slug>.html   ->  clean URL /price-guide/<category>/<slug>
   Records with "sample": true are marked noindex + get a visible banner and are
   kept OUT of the sitemap, so no placeholder price is ever treated as real.
   Remove "sample": true (or export your real archive over data/sales.json) to
   make a page indexable.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://relicsofwar.com';

const categories = JSON.parse(readFileSync(join(ROOT, 'data/categories.json'), 'utf8'));
const sales = JSON.parse(readFileSync(join(ROOT, 'data/sales.json'), 'utf8'));

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = n => '$' + Number(n).toLocaleString('en-US');
const prettyDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};
const FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cinzel+Decorative:wght@700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Text:ital@0;1&family=IM+Fell+English:ital@0;1&display=swap';

function head(title, desc, canonical, { noindex = false, image = '' } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,follow">\n' : ''}<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<link rel="canonical" href="${esc(canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/assets/relics.css">
<link rel="stylesheet" href="/assets/price-guide.css">`;
}

const NAV = `
<header class="site">
  <div class="wrap navbar">
    <a class="brand" href="/">Relics <span class="mark">of</span> War</a>
    <nav class="links">
      <a href="/price-guide/">Price Guide</a>
      <a href="/identify/">Identify</a>
      <a href="/membership">Membership</a>
    </nav>
  </div>
</header>`;

const FOOT = `
<footer class="site">
  <div class="wrap">
    <a class="brand" href="/">Relics <span class="mark">of</span> War</a>
    <div class="meta">A publication of <a href="https://historicalpublicationsllc.com">Historical Publications LLC</a><br>
      Blue Ridge, Georgia &nbsp;&middot;&nbsp; <a href="tel:+18007771862">800-777-1862</a><br>
      <a href="mailto:info@historicalpublicationsllc.com">info@historicalpublicationsllc.com</a></div>
    <p class="meta" style="margin-top:1rem"><a href="/price-guide/">Price Guide</a> &middot; <a href="/identify/">Identification Library</a> &middot; <a href="/membership">Membership</a> &nbsp;&middot;&nbsp;
      <a href="https://historicalpublicationsllc.com/mission" rel="noopener">Mission Statement</a></p>
    <div class="fine">&copy; 2026 Historical Publications LLC — History Brought to Life</div>
  </div>
</footer>
</body>
</html>`;

function write(relPath, html) {
  const full = join(ROOT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
}

/* ---------- membership lock panel (reused on every item page) ---------- */
function lockPanel(cat) {
  const catName = categories[cat]?.name || 'this category';
  return `
    <div class="lockpanel">
      <h3>Full Sold-Price History &amp; Value Trend</h3>
      <p>See <strong>every recorded sale</strong> of pieces like this, the price trend over time, and set an alert when a new one sells &mdash; with a Relics of War membership.</p>
      <div class="lockrows">
        <div class="lockrow"><span>Comparable sale &mdash; excavated, strong detail</span><span>$0,000</span></div>
        <div class="lockrow"><span>Comparable sale &mdash; non-dug, gilt traces</span><span>$0,000</span></div>
        <div class="lockrow"><span>Comparable sale &mdash; relic condition</span><span>$000</span></div>
        <div class="lockrow"><span>5-year average &amp; trend</span><span>&#9650; 00%</span></div>
      </div>
      <div class="veil">
        <div class="lockicon">&#9679;</div>
        <div><a href="/membership" class="cta">Unlock the Full ${esc(catName)} Price History</a></div>
      </div>
    </div>`;
}

/* ---------- item page ---------- */
function itemPage(rec) {
  const cat = rec.category;
  const catName = categories[cat]?.name || cat;
  const url = `${SITE}/price-guide/${cat}/${rec.slug}`;
  const title = `${rec.name} — Sold for ${money(rec.soldPrice)} | Civil War Price Guide`;
  const desc = `${rec.name} sold for ${money(rec.soldPrice)} on ${prettyDate(rec.saleDate)}. Condition, markings, and comparable sold prices in the Relics of War Civil War price guide.`;

  const specRows = [
    ['Category', `<a href="/price-guide/${cat}/">${esc(catName)}</a>`],
    ['Sold price', `<strong>${money(rec.soldPrice)}</strong>`],
    ['Sale date', esc(prettyDate(rec.saleDate))],
    ['Source', esc([rec.source, rec.lot].filter(Boolean).join(', '))],
    ['Condition', esc(rec.condition)],
    ['Markings', esc(rec.markings)],
    ['Dimensions', esc(rec.dimensions)],
    ['Provenance', esc(rec.provenance)]
  ].filter(([, v]) => v && v !== '' ).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('\n');

  // Related items in same category
  const related = sales.filter(s => s.category === cat && s.slug !== rec.slug).slice(0, 4)
    .map(s => `<a class="sale-row" href="/price-guide/${s.category}/${s.slug}"><span class="t">${esc(s.name)}<small>${esc(prettyDate(s.saleDate))}</small></span><span class="p">${money(s.soldPrice)}</span></a>`).join('\n');

  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: rec.name,
    category: catName, description: rec.description,
    offers: { '@type': 'Offer', price: rec.soldPrice, priceCurrency: 'USD', availability: 'https://schema.org/SoldOut', validFrom: rec.saleDate }
  };

  return `${head(title, desc, url, { noindex: !!rec.sample })}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
${rec.sample ? `<div class="samplebanner">Sample data for layout only &mdash; not an actual sale. <a href="/membership">How real data works &rsaquo;</a></div>` : ''}
${NAV}
<main>
  <div class="wrap narrow pg-breadcrumb"><div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/price-guide/">Price Guide</a> &rsaquo; <a href="/price-guide/${cat}/">${esc(catName)}</a> &rsaquo; ${esc(rec.name)}</div></div>
  <article class="wrap narrow">
    <div class="eyebrow">Civil War Price Guide</div>
    <h1>${esc(rec.name)}</h1>

    <div class="pricehero">
      <div>
        <div class="label">Sold Price</div>
        <div class="figure">${money(rec.soldPrice)}</div>
        <div class="meta">${esc(prettyDate(rec.saleDate))}${rec.source ? ' &middot; ' + esc(rec.source) : ''}</div>
      </div>
      <a href="/membership" class="cta">See Comparable Sales</a>
    </div>

    <div class="pg-img">${rec.image ? `<img src="${esc(rec.image)}" alt="${esc(rec.name)}">` : `${esc(rec.name)} — add photo`}</div>
    <!-- To add a photo: set "image": "/assets/img/${rec.slug}.jpg" on this record in data/sales.json and re-run the generator. -->

    <p class="standfirst">${esc(rec.description)}</p>

    <h2>Details of This Sale</h2>
    <table class="spec">${specRows}</table>

    ${lockPanel(cat)}

    ${related ? `<h2>Other ${esc(catName)} Sales</h2><div class="sales-list">${related}</div>` : ''}
  </article>
</main>
${FOOT}`;
}

/* ---------- category index ---------- */
function categoryPage(cat) {
  const c = categories[cat];
  const items = sales.filter(s => s.category === cat).sort((a, b) => (b.saleDate || '').localeCompare(a.saleDate || ''));
  const url = `${SITE}/price-guide/${cat}/`;
  const title = `${c.name} — Civil War Price Guide & Sold Prices | Relics of War`;
  const desc = `What ${c.name.toLowerCase()} sell for. Recorded sold prices, conditions, and comparables in the Relics of War Civil War price guide.`;
  const anySample = items.some(i => i.sample);
  const rows = items.map(s => `<a class="sale-row" href="/price-guide/${s.category}/${s.slug}"><span class="t">${esc(s.name)}<small>${esc(prettyDate(s.saleDate))}${s.condition ? ' — ' + esc(s.condition) : ''}</small></span><span class="p">${money(s.soldPrice)}</span></a>`).join('\n');

  return `${head(title, desc, url, { noindex: anySample && items.every(i => i.sample) })}
</head>
<body>
${anySample ? `<div class="samplebanner">Sample data for layout only &mdash; not actual sales. <a href="/membership">How real data works &rsaquo;</a></div>` : ''}
${NAV}
<main>
  <div class="wrap pg-breadcrumb"><div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/price-guide/">Price Guide</a> &rsaquo; ${esc(c.name)}</div></div>
  <section style="padding-top:1.5rem">
    <div class="wrap narrow">
      <div class="eyebrow">Civil War Price Guide</div>
      <h1 style="font-size:clamp(2rem,4.5vw,3rem);color:var(--navy);margin:.4rem 0 .6rem">${esc(c.name)} — Sold Prices</h1>
      <p style="color:var(--muted);font-size:1.1rem;margin-bottom:1.5rem">${esc(c.blurb)} Below are recorded sales; open any entry for full details and comparables.</p>
      <div class="sales-list">${rows || '<p>No recorded sales yet in this category.</p>'}</div>
    </div>
  </section>
  <section class="submitband">
    <div class="wrap"><div class="section-head"><div class="eyebrow" style="color:var(--gold-bright)">Members See Everything</div><h2>Full ${esc(c.name)} Price History</h2></div>
    <p>Every recorded sale, value trends, and alerts when a new one sells.</p>
    <a href="/membership" class="cta">View Membership</a></div>
  </section>
</main>
${FOOT}`;
}

/* ---------- price guide hub ---------- */
function hubPage() {
  const url = `${SITE}/price-guide/`;
  const title = 'Civil War Price Guide — What Relics Sell For | Relics of War';
  const desc = 'The Civil War relic price guide: recorded sold prices for belt plates, buttons, swords, firearms, photographs, and more. See what your artifact is worth.';
  const catTiles = Object.entries(categories).map(([slug, c]) => {
    const n = sales.filter(s => s.category === slug).length;
    return `<a class="cat-tile" href="/price-guide/${slug}/"><h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p><span class="count">${n} recorded ${n === 1 ? 'sale' : 'sales'} &rarr;</span></a>`;
  }).join('\n');
  const recent = [...sales].sort((a, b) => (b.saleDate || '').localeCompare(a.saleDate || '')).slice(0, 8)
    .map(s => `<a class="sale-row" href="/price-guide/${s.category}/${s.slug}"><span class="t">${esc(s.name)}<small>${esc(categories[s.category]?.name || '')} — ${esc(prettyDate(s.saleDate))}</small></span><span class="p">${money(s.soldPrice)}</span></a>`).join('\n');
  const anySample = sales.some(s => s.sample);

  return `${head(title, desc, url)}
</head>
<body>
${anySample ? `<div class="samplebanner">Preview built with sample data &mdash; not actual sales. <a href="/membership">How real data works &rsaquo;</a></div>` : ''}
${NAV}
<main>
  <section class="pg-intro">
    <div class="wrap">
      <div class="eyebrow">Civil War Price Guide</div>
      <h1>What Is Your Civil War Relic Worth?</h1>
      <div class="rule"></div>
      <p>Browse recorded sold prices for authentic Civil War artifacts — the real numbers pieces actually bring at auction and private sale.</p>
    </div>
  </section>
  <section>
    <div class="wrap">
      <div class="section-head"><div class="eyebrow">Browse by Category</div><h2>Find Your Artifact</h2></div>
      <div class="cat-grid">${catTiles}</div>
    </div>
  </section>
  <section class="alt">
    <div class="wrap narrow">
      <div class="section-head"><div class="eyebrow">Latest Additions</div><h2>Recently Recorded Sales</h2></div>
      <div class="sales-list">${recent}</div>
    </div>
  </section>
  <section class="submitband">
    <div class="wrap"><div class="section-head"><div class="eyebrow" style="color:var(--gold-bright)">Go Deeper</div><h2>Unlock the Full Price History</h2></div>
    <p>Members see every recorded sale, value trends over time, and get alerts when pieces like theirs come to market.</p>
    <a href="/membership" class="cta">View Membership</a></div>
  </section>
</main>
${FOOT}`;
}

/* ---------- sitemap (static pages + indexable generated pages) ---------- */
function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10); // note: fine at build time
  const staticUrls = [
    ['/', '1.0', 'weekly'], ['/price-guide/', '0.9', 'daily'], ['/identify/', '0.8', 'weekly'],
    ['/membership', '0.7', 'monthly'],
    ['/identify/confederate-belt-plates', '0.7', 'monthly'], ['/identify/civil-war-buttons', '0.7', 'monthly'],
    ['/identify/civil-war-bayonets', '0.7', 'monthly'], ['/identify/soldier-id-discs', '0.7', 'monthly'],
    ['/identify/cartridge-boxes', '0.7', 'monthly']
  ];
  const catUrls = Object.keys(categories)
    .filter(cat => sales.some(s => s.category === cat && !s.sample))
    .map(cat => [`/price-guide/${cat}/`, '0.7', 'weekly']);
  const itemUrls = sales.filter(s => !s.sample).map(s => [`/price-guide/${s.category}/${s.slug}`, '0.6', 'monthly']);
  const all = [...staticUrls, ...catUrls, ...itemUrls];
  const body = all.map(([loc, pri, freq]) =>
    `  <url><loc>${SITE}${loc}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`).join('\n');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

/* ---------- run ---------- */
// clean previously generated price-guide dir so removed records don't linger
const pgDir = join(ROOT, 'price-guide');
if (existsSync(pgDir)) rmSync(pgDir, { recursive: true, force: true });

write('price-guide/index.html', hubPage());
let itemCount = 0;
for (const cat of Object.keys(categories)) {
  if (!sales.some(s => s.category === cat)) continue;       // only build categories that have data
  write(`price-guide/${cat}/index.html`, categoryPage(cat));
}
for (const rec of sales) {
  write(`price-guide/${rec.category}/${rec.slug}.html`, itemPage(rec));
  itemCount++;
}
buildSitemap();

const indexable = sales.filter(s => !s.sample).length;
console.log(`Price Guide built: ${itemCount} item pages across ${new Set(sales.map(s => s.category)).size} categories.`);
console.log(`Indexable (real) records: ${indexable}. Sample (noindex) records: ${itemCount - indexable}.`);
