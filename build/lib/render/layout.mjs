/* Page chrome shared by every generated page. */
import { esc, attr } from '../util.mjs';

export const SITE = 'https://relicsofwar.com';
export const SITE_NAME = 'Relics of War';
export const AS = 'https://artifactsearch.com';

const FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cinzel+Decorative:wght@700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Text:ital@0;1&display=swap';

/**
 * @param {object} o
 * @param {string} o.title       full <title> (already includes the suffix)
 * @param {string} o.description
 * @param {string} o.path        site-relative path of THIS page (e.g. /civil-war/firearms/)
 * @param {string} o.canonical   absolute canonical URL (self, parent, or ArtifactSearch)
 * @param {'INDEX'|'NOINDEX'|'CANONICAL_TO_PARENT'|'CANONICAL_TO_ARTIFACTSEARCH'} o.state
 * @param {object[]} [o.jsonld]
 * @param {string} [o.ogImage]
 * @param {string} [o.ogType]
 * @param {string} [o.stateNote] one-line engine explanation, emitted as an HTML comment
 */
export function head(o) {
  const noindex = o.state === 'NOINDEX';
  const robots = noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large';
  const jsonld = (o.jsonld || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
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
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${attr(o.title)}">
<meta property="og:description" content="${attr(o.description)}">
<meta property="og:url" content="${attr(SITE + o.path)}">
${o.ogImage ? `<meta property="og:image" content="${attr(o.ogImage)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="${AS}">
<link href="${FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/assets/relics.css">
<link rel="stylesheet" href="/assets/site.css">
${jsonld}
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
      Blue Ridge, Georgia &nbsp;&middot;&nbsp; <a href="tel:+18007771862">800-777-1862</a><br>
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

export function breadcrumbs(items) {
  // items: [{name, url}] — last one is the current page (no link)
  const html = items.map((it, i) => (i < items.length - 1 ? `<a href="${attr(it.url)}">${esc(it.name)}</a>` : `<span aria-current="page">${esc(it.name)}</span>`)).join(' <span class="sep">&rsaquo;</span> ');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(i < items.length - 1 ? { item: SITE + it.url } : {}) })),
  };
  return { html: `<nav class="breadcrumb" aria-label="Breadcrumb">${html}</nav>`, ld };
}

export const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://historicalpublicationsllc.com/#organization',
  name: 'Historical Publications LLC',
  url: 'https://historicalpublicationsllc.com/',
  telephone: '+1-800-777-1862',
  email: 'info@historicalpublicationsllc.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Blue Ridge', addressRegion: 'GA', addressCountry: 'US' },
};

export const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: SITE_NAME,
  url: `${SITE}/`,
  publisher: { '@id': 'https://historicalpublicationsllc.com/#organization' },
};
