# Relics of War — Operations Runbook

The goal: **100,000+ visitors/month** built on three engines — a programmatic
**sold-price guide** (SEO volume), **original visual content** (Discover/Pinterest/FB
magnets), and **distribution** across the audience we already own. This file is the
week-to-week operating manual.

---

## 1. The site at a glance

| Area | Path | What it is |
|------|------|------------|
| Homepage | `/` | Leads with "What is your relic worth?" → funnels to price guide |
| **Price Guide** | `/price-guide/` | The engine. Category + item pages generated from data |
| Identification Library | `/identify/` | Free reference guides (content magnet + SEO) |
| Membership | `/membership.html` | Buyer subscription (founding-member capture today) |

Static site. Hosted on **Cloudflare Pages**, auto-deploys on every push to `main`.
No server, no build command — the price-guide pages are pre-generated HTML.

---

## 2. The sold-price engine — how it works

Everything flows from one data file:

```
data/sales.json        ← the dataset (one object per recorded sale)
data/categories.json   ← the category taxonomy
scripts/build-archive.mjs   ← the generator
```

Run the generator any time the data changes:

```bash
node scripts/build-archive.mjs
```

It (re)creates every page under `/price-guide/` and rewrites `sitemap.xml`.
Then commit + push — Cloudflare deploys automatically.

### Adding a real sale (the core weekly task)

Add an object to `data/sales.json`:

```json
{
  "slug": "us-m1839-oval-belt-plate",   // URL-safe, unique
  "name": "U.S. Model 1839 Oval Belt Plate",
  "category": "belt-plates",            // must match a key in categories.json
  "soldPrice": 425,
  "saleDate": "2025-11-14",             // YYYY-MM-DD
  "source": "Heritage Auctions",
  "lot": "Lot 214",
  "condition": "Excavated, strong detail",
  "markings": "Lead-filled reverse, arrow hook",
  "dimensions": "3.4 x 2.2 in",
  "provenance": "",
  "description": "One honest paragraph — real detail, not filler.",
  "image": "/assets/img/us-m1839-oval-belt-plate.jpg"
}
```

Then: `node scripts/build-archive.mjs` → commit → push. Done.

### The `sample` flag (IMPORTANT)

Records with `"sample": true` get a visible "sample data" banner, a `noindex`
tag, and are **kept out of the sitemap** — so no placeholder price is ever
treated as real by Google. **The site ships seeded with sample records.**
Replace them with real sales (omit `sample`, or delete and add your own) to make
pages indexable and live for SEO.

> ⚠️ Never publish a made-up price without `sample: true`. Accuracy is the brand.

### Why this scales

~200 well-ranked pages ≈ ~100k organic visits/month in a niche. Each real sale
you add is a permanent, indexable "what X sold for" page — exactly the query
collectors search. Target **≥8–12 real data fields per record** (we do): thin
pages don't get indexed. **Volume of real records is the flywheel.**

---

## 3. Free vs. paid (the revenue line)

- **Free / indexed:** one recorded sold price per item, full details, images.
  This is the SEO magnet — it must be visible to rank.
- **Members ($79/yr or $8/mo, adjustable):** full sold-price *history* per piece,
  value trends, every comparable, and alerts. This is the locked panel on each
  item page and the `/membership.html` product.

Today membership captures **founding-member interest by email**. The next build
step is **Stripe checkout** so members pay and unlock instantly — ask Claude to
wire it when you're ready (needs a Stripe account + a serverless function).

---

## 4. Weekly operating cadence

The number comes from consistency, not bursts. A sustainable week:

- **Price guide (the SEO base):** add **10–25 real recorded sales**. Batch from
  auction results you already follow. Regenerate + push.
- **Visual magnet (Discover/Pinterest/FB):** publish **1–2 original pieces** —
  a colorized photo, a "most valuable X ever sold," or a strong identification
  guide. Original photography wins on Google Discover.
- **Distribution (below):** seed everything you publish.

Realistically this is a part-time content role. The colorization and expert
voice are yours; the page generation is automated.

---

## 5. Distribution checklist (every new page)

| Channel | Action | Why |
|---------|--------|-----|
| **Facebook** (90k) | Post the piece with the image + link | Early engagement = ranking signal + direct traffic |
| **Pinterest** | Pin the image; keyword the title/description | Evergreen — pins drive traffic for years |
| **Google Discover** | Ship original photos, faces/emotion, fast mobile pages | One placement can beat weeks of search |
| **Email** (8k Constant Contact) | Include in the newsletter | Loyal recirculation + engagement |
| **Cross-links** | Link from civilwarnews / historicalpublicationsllc / civilwarartillery | Passes domain authority to a new domain |

The last row is the unfair advantage: internal links from the established sites
jump-start authority that a cold domain lacks. Do this early.

---

## 6. Measurement

- **Google Search Console** — submit `sitemap.xml`; watch indexed-page count and
  Discover impressions. (Indexed pages is the leading indicator.)
- **Cloudflare Web Analytics** — traffic by source (already available on the zone).
- **North-star:** real indexed price-guide pages. More indexed real records →
  more long-tail traffic → more members.

---

## 7. Guardrails

- **No fabricated prices live** — sample flag or real data only.
- **Rights** — only publish images we own or that are public domain / licensed; credit sources.
- **Thin pages hurt** — every record carries real, specific data.
- **Discover/Pinterest are rented land** — great volume, volatile; the durable
  half is the price-guide SEO base, so never skip adding real records.

---

## 8. Quick reference

```bash
# regenerate the price guide after editing data/sales.json
node scripts/build-archive.mjs

# preview locally
python3 -m http.server 8791    # then open http://localhost:8791/

# publish (auto-deploys via Cloudflare Pages)
git add -A && git commit -m "price guide: add sales" && git push
```
