/* Shared helpers — no dependencies. */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const attr = esc;

export const money = (n) => (n == null || !Number.isFinite(Number(n))) ? '' : '$' + Math.round(Number(n)).toLocaleString('en-US');
export const cents = (c) => money(c / 100);
export const num = (n) => Number(n ?? 0).toLocaleString('en-US');

export const isoDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
};
export const prettyDate = (d) => {
  const iso = isoDate(d);
  if (!iso) return '';
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};
export const monthYear = (d) => {
  const iso = isoDate(d);
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
};

export const sha1 = (s) => createHash('sha1').update(String(s)).digest('hex');

export const median = (arr) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
export const percentile = (arr, p) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (idx - lo);
};

export const titleCase = (s) => String(s).replace(/(^|[\s-])(\w)/g, (m, p, c) => p + c.toUpperCase());

/** Slug-safe: lowercase, hyphens, ascii only. Slugs from ArtifactSearch are already
 *  clean; this guards the URL contract (§17) for anything we compose ourselves. */
export const cleanSlug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');

export const uniq = (arr) => [...new Set(arr)];

export function jaccard(aSet, bSet) {
  if (!aSet.size && !bSet.size) return 0;
  let inter = 0;
  const [small, big] = aSet.size < bSet.size ? [aSet, bSet] : [bSet, aSet];
  for (const x of small) if (big.has(x)) inter++;
  return inter / (aSet.size + bSet.size - inter);
}

/** Tiny front-matter + markdown reader for content/*.md. Supports: `key: value`
 *  front matter between --- lines; headings (##, ###), paragraphs, unordered
 *  and ordered lists, **bold**, *italic*, [text](url), inline `code`. That is
 *  deliberately all — editorial content is prose, not layout. */
export function readMarkdownFile(path) {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  const meta = {};
  let body = raw;
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
    }
    body = m[2];
  }
  return { meta, body: body.trim(), html: markdownToHtml(body.trim()), words: body.trim().split(/\s+/).filter(Boolean).length };
}

export function inlineMd(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (m, t, u) => `<a href="${u}"${u.startsWith('http') ? ' rel="noopener"' : ''}>${t}</a>`);
}

export function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inlineMd(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    let h;
    if ((h = /^(#{2,4})\s+(.*)$/.exec(line))) { flushPara(); flushList(); out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`); continue; }
    let li;
    if ((li = /^[-*]\s+(.*)$/.exec(line))) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(li[1]); continue; }
    if ((li = /^\d+[.)]\s+(.*)$/.exec(line))) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(li[1]); continue; }
    if (list) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join('\n');
}

export const PUBLISHABLE_STATES = new Set(['VERIFIED', 'PUBLISHED']);
export const CONTENT_STATES = ['DRAFT', 'AI_ASSISTED', 'HUMAN_REVIEW_REQUIRED', 'VERIFIED', 'PUBLISHED'];
