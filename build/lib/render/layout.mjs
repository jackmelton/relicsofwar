/* Page chrome shared by every generated page. */
import { esc, attr } from '../util.mjs';

export const SITE = 'https://relicsofwar.com';
export const SITE_NAME = 'Relics of War';
export const AS = 'https://artifactsearch.com';
export const SITE_DESCRIPTION = 'Military antiques by war and category, Revolution through Vietnam — recorded sold prices, identification guides, and current listings from vetted dealers and auction houses.';

/** Site-wide share image (master brief §9): used wherever a page shows no
 *  representative artifact image of its own. 1200×630 PNG committed under
 *  assets/og/ — the build never generates it, so it is the same URL forever. */
export const FALLBACK_IMAGE = {
  url: `${SITE}/assets/og/relics-of-war-social.png`,
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Relics of War — military antiques by war and era, identification guides, and recorded sold prices',
};

const FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cinzel+Decorative:wght@700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Text:ital@0;1&display=swap';

/** Normalize a share-image spec: a bare URL string or { url, width, height, type, alt }. */
export function socialImage(img) {
  if (!img) return FALLBACK_IMAGE;
  if (typeof img === 'string') return { url: img, alt: SITE_NAME };
  return { alt: SITE_NAME, ...img };
}

/** Open Graph + Twitter card tags for one image. Width/height/type only when known. */
export function socialImageTags(img, { title, description }) {
  const lines = [
    `<meta property="og:image" content="${attr(img.url)}">`,
    `<meta property="og:image:secure_url" content="${attr(img.url)}">`,
  ];
  if (img.type) lines.push(`<meta property="og:image:type" content="${attr(img.type)}">`);
  if (img.width && img.height) lines.push(`<meta property="og:image:width" content="${img.width}">`, `<meta property="og:image:height" content="${img.height}">`);
  lines.push(
    `<meta property="og:image:alt" content="${attr(img.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(description)}">`,
    `<meta name="twitter:image" content="${attr(img.url)}">`,
    `<meta name="twitter:image:alt" content="${attr(img.alt)}">`,
  );
  return lines.join('\n');
}

/** One JSON-LD block: every entity on the page in a single @graph (§8). */
export function jsonLdScript(entities) {
  const graph = (entities || []).filter(Boolean).map(({ '@context': _ctx, ...rest }) => rest);
  if (!graph.length) return '';
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
}

/**
 * @param {object} o
 * @param {string} o.title       full <title> (already includes the suffix)
 * @param {string} o.description
 * @param {string} o.path        site-relative path of THIS page (e.g. /civil-war/firearms/)
 * @param {string} o.canonical   absolute canonical URL (self, parent, or ArtifactSearch)
 * @param {'INDEX'|'NOINDEX'|'CANONICAL_TO_PARENT'|'CANONICAL_TO_ARTIFACTSEARCH'} o.state
 * @param {object[]} [o.jsonld]  schema.org entities; emitted as one @graph
 * @param {string|object} [o.ogImage] share image — a representative image the page shows, else the site fallback
 * @param {string} [o.ogType]
 * @param {string} [o.stateNote] one-line engine explanation, emitted as an HTML comment
 */
export function head(o) {
  const noindex = o.state === 'NOINDEX';
  const robots = noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large';
  const img = socialImage(o.ogImage);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(o.title)}</title>
<meta name="description" content="${attr(o.description)}">
<meta name="robots" content="${robots}">
<meta name="msvalidate.01" content="C8B0ADE1253C8CE114D93C615D8C5255">
<link rel="canonical" href="${attr(o.canonical)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${attr(o.title)}">
<meta property="og:description" content="${attr(o.description)}">
<meta property="og:url" content="${attr(SITE + o.path)}">
${socialImageTags(img, o)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="${AS}">
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/assets/relics.css">
<link rel="stylesheet" href="/assets/site.css">
${jsonLdScript(o.jsonld)}
${o.stateNote ? `<!-- index-worthiness: ${esc(o.stateNote)} -->` : ''}
</head>
<body>
${nav(o.path)}
`;
}

export function nav(path) {
  const active = (p) => (path === p || (p !== '/' && path.startsWith(p)) ? ' class="active"' : '');
  return `<header class="site">
  <div class="wrap navbar">
    <a class="brand" href="/">Relics <span class="mark">of</span> War</a>
    <nav class="links" aria-label="Primary">
      <a href="/eras/"${active('/eras/')}>Browse</a>
      <a href="/price-guide/"${active('/price-guide/')}>Price Guide</a>
      <a href="/identify/"${active('/identify/')}>Identify</a>
      <a href="/about/"${active('/about/')}>About</a>
      <a href="${AS}/" class="ext" rel="noopener">Marketplace&nbsp;&#8599;</a>
    </nav>
  </div>
</header>
<div class="wrap"><aside class="row-ad" data-zone="leaderboard" aria-label="Advertisement"></aside></div>
`;
}

export function foot(pages = []) {
  const trust = pages.filter((p) => p.publishable && p.nav === 'footer').map((p) => `<a href="${p.url}">${esc(p.title)}</a>`).join(' &nbsp;&middot;&nbsp; ');
  return `
<footer class="site">
  <div class="wrap">
    <aside class="row-ad" data-zone="medium_rectangle" aria-label="Advertisement"></aside>
    <a class="brand" href="/">Relics <span class="mark">of</span> War</a>
    <div class="meta">
      A publication of <a href="https://historicalpublicationsllc.com">Historical Publications LLC</a><br>
      Mount Pleasant, South Carolina &nbsp;&middot;&nbsp; <a href="tel:+18007771862">800-777-1862</a><br>
      <a href="mailto:info@historicalpublicationsllc.com">info@historicalpublicationsllc.com</a>
    </div>
    <p class="meta" style="margin-top:1rem">
      <a href="/eras/">Browse by Era</a> &nbsp;&middot;&nbsp;
      <a href="/price-guide/">Price Guide</a> &nbsp;&middot;&nbsp;
      <a href="/identify/">Identification Library</a> &nbsp;&middot;&nbsp;
      <a href="${AS}/" rel="noopener">ArtifactSearch Marketplace</a> &nbsp;&middot;&nbsp;
      <a href="${AS}/account/register" rel="noopener">Free Membership</a>
    </p>
    ${trust ? `<p class="meta small">${trust}</p>` : ''}
    <div class="fine">&copy; <span id="yr">2026</span> Historical Publications LLC — History Brought to Life &nbsp;&middot;&nbsp; Listing data via <a href="${AS}/" rel="noopener">ArtifactSearch.com</a>; every listing links to the dealer or auction house that offers it.</div>
  </div>
</footer>
<script>document.getElementById('yr').textContent=new Date().getFullYear()</script>
<script src="/assets/ads.js" defer></script>
</body>
</html>
`;
}

/** Visible breadcrumb trail + matching BreadcrumbList entity (§57).
 *  items: [{name, url}] — the last one is the current page (no link). */
export function breadcrumbs(items) {
  const html = items.map((it, i) => (i < items.length - 1 ? `<a href="${attr(it.url)}">${esc(it.name)}</a>` : `<span aria-current="page">${esc(it.name)}</span>`)).join(' <span class="sep">&rsaquo;</span> ');
  const current = items[items.length - 1];
  const ld = {
    '@type': 'BreadcrumbList',
    '@id': `${SITE}${current?.url || '/'}#breadcrumb`,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(i < items.length - 1 ? { item: SITE + it.url } : {}) })),
  };
  return { html: `<nav class="breadcrumb" aria-label="Breadcrumb">${html}</nav>`, ld };
}

export function imageObjectLd(img) {
  const i = socialImage(img);
  const o = { '@type': 'ImageObject', url: i.url };
  if (i.width) o.width = i.width;
  if (i.height) o.height = i.height;
  if (i.alt) o.caption = i.alt;
  return o;
}

/** The page entity (§8 "Web Pages"): WebPage / CollectionPage / AboutPage / ContactPage
 *  with a stable @id, isPartOf the site, its share image, and its breadcrumb. */
export function pageLd({ type = 'WebPage', path, name, description, image, breadcrumb, about, mainEntity }) {
  const url = SITE + path;
  const ld = {
    '@type': type,
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE}/#website` },
    primaryImageOfPage: imageObjectLd(image),
  };
  if (breadcrumb) ld.breadcrumb = { '@id': breadcrumb['@id'] };
  if (about) ld.about = about;
  if (mainEntity) ld.mainEntity = mainEntity;
  return ld;
}

/** ItemList of things that are actually visible on the page (§8 "Category, Archive,
 *  and Directory Pages") — names and links only, never hidden records. */
export function itemListLd({ name, items }) {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url, ...(it.image ? { image: it.image } : {}) })),
  };
}

export const ORG_LD = {
  '@type': 'Organization',
  '@id': 'https://historicalpublicationsllc.com/#organization',
  name: 'Historical Publications LLC',
  url: 'https://historicalpublicationsllc.com/',
  telephone: '+1-800-777-1862',
  email: 'info@historicalpublicationsllc.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Mount Pleasant', addressRegion: 'SC', addressCountry: 'US' },
};

export const WEBSITE_LD = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: SITE_NAME,
  url: `${SITE}/`,
  description: SITE_DESCRIPTION,
  inLanguage: 'en-US',
  publisher: { '@id': 'https://historicalpublicationsllc.com/#organization' },
};
