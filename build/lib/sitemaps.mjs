/* Sitemap index + children. Only INDEX-state, self-canonical URLs, with
   <lastmod> from the state file (the date the page's MEANINGFUL content hash
   last changed — never "today because we rebuilt"). §21–§23. */
import { esc } from './util.mjs';
import { SITE } from './render/layout.mjs';

export function buildSitemaps({ entries, config, today }) {
  // entries: [{ url, group, lastmod }] all INDEX + self-canonical
  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group).push(e);
  }
  const files = []; // { path, xml }
  const children = [];
  const max = config.sitemaps.maxUrlsPerFile;
  for (const [group, list] of groups) {
    list.sort((a, b) => a.url.localeCompare(b.url));
    const chunks = [];
    for (let i = 0; i < list.length; i += max) chunks.push(list.slice(i, i + max));
    chunks.forEach((chunk, i) => {
      const name = chunks.length > 1 ? `${group}-${i + 1}` : group;
      const path = `/sitemaps/${name}.xml`;
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${chunk.map((e) => `  <url><loc>${esc(SITE + e.url)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
      files.push({ path, xml });
      children.push({ path, lastmod: chunk.reduce((m, e) => (e.lastmod > m ? e.lastmod : m), '') || today });
    });
  }
  children.sort((a, b) => a.path.localeCompare(b.path));
  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${children.map((c) => `  <sitemap><loc>${SITE}${c.path}</loc><lastmod>${c.lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`;
  files.push({ path: '/sitemap.xml', xml: index });
  return files;
}

export function robotsTxt(config) {
  return `# RelicsOfWar.com — static site; there are no dynamic routes or crawl traps.
# Internal build/config folders are not pages. Nothing here substitutes for the
# per-page <meta name="robots"> directives (§28–§29).
User-agent: *
Disallow: /build/
Disallow: /config/
Disallow: /content/
Disallow: /state/
Disallow: /reports/
Disallow: /docs/
Disallow: /scripts/
Disallow: /data/
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
}
