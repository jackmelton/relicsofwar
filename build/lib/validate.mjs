/* SEO release checks over the WRITTEN output (§20 canonical tests, §22 sitemap
   hygiene, §52 duplicate detection, §55 headings, §59 orphans, §75 checklist).
   Reads files back from disk so the tests see exactly what Cloudflare will
   serve. Returns { errors, warnings, stats }. Any error fails the build. */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from './render/layout.mjs';

const RX = {
  canonical: /<link\s+rel="canonical"\s+href="([^"]*)"/g,
  robots: /<meta\s+name="robots"\s+content="([^"]*)"/g,
  title: /<title>([^<]*)<\/title>/,
  desc: /<meta\s+name="description"\s+content="([^"]*)"/,
  h1: /<h1[\s>]/g,
  href: /href="([^"#]+)(?:#[^"]*)?"/g,
  jsonld: /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  loc: /<loc>([^<]+)<\/loc>/g,
};

function urlToFile(root, url) {
  const p = url.replace(/^https?:\/\/[^/]+/, '');
  if (p.endsWith('/')) return join(root, p, 'index.html');
  if (/\.[a-z0-9]+$/i.test(p)) return join(root, p);
  // extensionless: Cloudflare Pages serves /foo → /foo.html or /foo/index.html
  if (existsSync(join(root, p + '.html'))) return join(root, p + '.html');
  return join(root, p, 'index.html');
}

export function validateSite({ root, pages, decisions, config }) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const indexPages = pages.filter((p) => p.state === 'INDEX');
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const inbound = new Map(pages.map((p) => [p.path, 0]));
  const titles = new Map(), descs = new Map(), h1s = new Map();

  for (const p of pages) {
    const file = urlToFile(root, p.path);
    if (!existsSync(file)) { err(`missing file for ${p.path}`); continue; }
    const html = readFileSync(file, 'utf8');
    if (statSync(file).size > 1_500_000) warn(`${p.path}: ${Math.round(statSync(file).size / 1024)} KB — heavy page`);

    // canonical
    const canons = [...html.matchAll(RX.canonical)].map((m) => m[1]);
    if (canons.length !== 1) err(`${p.path}: ${canons.length} canonical tags`);
    const canon = canons[0] || '';
    if (canon && !canon.startsWith('https://')) err(`${p.path}: canonical not https (${canon})`);
    if (canon.startsWith(SITE) && !canon.startsWith(SITE + '/')) err(`${p.path}: canonical wrong host ${canon}`);
    if (canon.startsWith('https://') && !canon.startsWith(SITE) && !canon.startsWith(config.artifactsearch)) err(`${p.path}: canonical to foreign host ${canon}`);
    if (canon.startsWith(SITE)) {
      const target = canon.slice(SITE.length);
      const tfile = urlToFile(root, target);
      if (!existsSync(tfile)) err(`${p.path}: canonical → ${target} which does not exist`);
      const tp = byPath.get(target);
      if (p.state === 'INDEX' && target !== p.path) err(`${p.path}: INDEX page must self-canonicalize (points at ${target})`);
      if (tp && tp.state === 'NOINDEX' && target !== p.path) err(`${p.path}: canonical → noindex page ${target}`);
      if (p.state === 'CANONICAL_TO_PARENT' && target === p.path) err(`${p.path}: CANONICAL_TO_PARENT but self-canonical`);
    }
    if (p.state === 'CANONICAL_TO_ARTIFACTSEARCH' && !canon.startsWith(config.artifactsearch)) err(`${p.path}: CANONICAL_TO_ARTIFACTSEARCH but canonical is ${canon}`);

    // robots meta consistent with state
    const robots = [...html.matchAll(RX.robots)].map((m) => m[1]);
    if (robots.length > 1) err(`${p.path}: ${robots.length} robots meta tags`);
    const noindex = /noindex/.test(robots[0] || ''); // no tag = indexable (hand-written guides)
    if (p.state === 'INDEX' && noindex) err(`${p.path}: INDEX page carries noindex`);
    if (p.state === 'NOINDEX' && !noindex) err(`${p.path}: NOINDEX page lacks noindex`);

    // title / description / h1
    const title = RX.title.exec(html)?.[1] ?? '';
    const desc = RX.desc.exec(html)?.[1] ?? '';
    if (!title.trim()) err(`${p.path}: empty <title>`);
    if (!desc.trim()) err(`${p.path}: empty meta description`);
    if (title.length > config.titles.maxLength + 10) warn(`${p.path}: title ${title.length} chars`);
    if (desc.length > 170) warn(`${p.path}: description ${desc.length} chars`);
    const h1n = (html.match(RX.h1) || []).length;
    if (h1n !== 1) err(`${p.path}: ${h1n} <h1> elements`);
    if (p.state === 'INDEX') {
      const t = title.toLowerCase(), dsc = desc.toLowerCase();
      if (titles.has(t)) err(`duplicate <title> on INDEX pages: ${p.path} and ${titles.get(t)}`); else titles.set(t, p.path);
      if (descs.has(dsc)) err(`duplicate description on INDEX pages: ${p.path} and ${descs.get(dsc)}`); else descs.set(dsc, p.path);
    }

    // JSON-LD parses
    const ldBlocks = [...html.matchAll(RX.jsonld)];
    for (const m of ldBlocks) {
      try { JSON.parse(m[1]); } catch { err(`${p.path}: invalid JSON-LD`); }
    }

    // social metadata + structured data on every INDEX page (master brief §8–§9)
    const ogImage = (/<meta property="og:image" content="([^"]*)"/.exec(html)?.[1] ?? '').replace(/&amp;/g, '&');
    if (p.state === 'INDEX') {
      if (!ogImage) err(`${p.path}: missing og:image`);
      else if (!ogImage.startsWith('https://')) err(`${p.path}: og:image not https (${ogImage})`);
      else if (ogImage.startsWith(SITE + '/') && !existsSync(join(root, ogImage.slice(SITE.length + 1)))) err(`${p.path}: og:image ${ogImage} is not a file in the output`);
      if (!/<meta property="og:image:alt" content="[^"]+"/.test(html)) err(`${p.path}: missing og:image:alt`);
      if (!/<meta name="twitter:card" content="[^"]+"/.test(html)) err(`${p.path}: missing twitter:card`);
      if (!/<meta name="twitter:image" content="[^"]+"/.test(html)) err(`${p.path}: missing twitter:image`);
      if (!ldBlocks.length) err(`${p.path}: no JSON-LD`);
      if (p.path !== '/' && !/"@type":"BreadcrumbList"/.test(html)) err(`${p.path}: no BreadcrumbList JSON-LD`);
    }

    // every mailto: must sit inside <!--email_off--> … <!--/email_off-->, or Cloudflare's
    // Email Address Obfuscation turns it into a /cdn-cgi/l/email-protection link (404 to crawlers)
    for (const m of html.matchAll(/<a\b[^>]*href="mailto:/g)) {
      const before = html.slice(Math.max(0, m.index - 40), m.index);
      if (!/<!--email_off-->\s*$/.test(before)) warn(`${p.path}: mailto: link outside <!--email_off--> (Cloudflare will obfuscate it)`);
    }

    // internal links resolve; count inbound
    for (const m of html.matchAll(RX.href)) {
      let h = m[1];
      if (h.startsWith('mailto:') || h.startsWith('tel:') || h.startsWith('http') || h.startsWith('//')) continue;
      if (!h.startsWith('/')) continue;
      h = h.replace(/\?.*$/, '');
      const norm = h.endsWith('/') || /\.[a-z0-9]+$/i.test(h) ? h : (existsSync(join(root, h + '.html')) ? h : h + '/');
      const tf = urlToFile(root, norm);
      if (!existsSync(tf)) { err(`${p.path}: broken internal link ${h}`); continue; }
      const key = norm.endsWith('/index.html') ? norm.slice(0, -'index.html'.length) : norm;
      if (inbound.has(key) && key !== p.path) inbound.set(key, inbound.get(key) + 1);
      else if (inbound.has(norm) && norm !== p.path) inbound.set(norm, inbound.get(norm) + 1);
    }
  }

  // orphans: every INDEX page needs ≥1 inbound link from another generated page
  for (const p of indexPages) {
    if (p.path === '/') continue;
    if ((inbound.get(p.path) || 0) === 0) err(`SEO ORPHAN: ${p.path} is INDEX but no page links to it`);
  }

  // sitemap hygiene
  const smIndex = join(root, 'sitemap.xml');
  if (!existsSync(smIndex)) err('sitemap.xml missing');
  else {
    const idx = readFileSync(smIndex, 'utf8');
    const children = [...idx.matchAll(RX.loc)].map((m) => m[1]);
    const seen = new Set();
    for (const c of children) {
      const cf = urlToFile(root, c);
      if (!existsSync(cf)) { err(`sitemap child missing: ${c}`); continue; }
      const xml = readFileSync(cf, 'utf8');
      for (const m of xml.matchAll(RX.loc)) {
        const u = m[1];
        if (!u.startsWith(SITE + '/')) { err(`sitemap URL wrong host: ${u}`); continue; }
        const path = u.slice(SITE.length);
        if (seen.has(path)) err(`sitemap duplicate: ${path}`);
        seen.add(path);
        const pg = byPath.get(path);
        if (!pg) { err(`sitemap URL not a generated page: ${path}`); continue; }
        if (pg.state !== 'INDEX') err(`sitemap contains non-INDEX page: ${path} (${pg.state})`);
        if (!existsSync(urlToFile(root, path))) err(`sitemap URL 404: ${path}`);
      }
    }
    for (const p of indexPages) if (!seen.has(p.path)) err(`INDEX page missing from sitemap: ${p.path}`);
  }

  // robots.txt sanity
  const rb = join(root, 'robots.txt');
  if (!existsSync(rb)) err('robots.txt missing');
  else if (!/Sitemap:\s*https:\/\/relicsofwar\.com\/sitemap\.xml/.test(readFileSync(rb, 'utf8'))) err('robots.txt lacks Sitemap line');

  return {
    errors,
    warnings,
    stats: { pages: pages.length, index: indexPages.length, noindex: pages.filter((p) => p.state === 'NOINDEX').length, canonicalized: pages.filter((p) => p.state.startsWith('CANONICAL')).length },
  };
}
