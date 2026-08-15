# Relics of War — relicsofwar.com

The curated discovery / identification / price-guide companion to
[ArtifactSearch.com](https://artifactsearch.com). A publication of Historical
Publications LLC (Blue Ridge, GA).

**ArtifactSearch** = the comprehensive marketplace search engine.
**Relics of War** = military antiques by war and category, identification guides,
and a price guide computed from recorded sales. Every listing links to its
ArtifactSearch page and on to the seller. Membership is free and lives on
ArtifactSearch. Relics of War sells nothing.

## How the site is made

Static HTML, rebuilt **every night** by GitHub Actions from a read-only export
of ArtifactSearch's public catalog, committed to this repo, and deployed by
Cloudflare Pages (repo root, no build command).

```
ArtifactSearch  ──/api/export/relicsofwar──▶  build/build.mjs  ──▶  repo root  ──▶  Cloudflare Pages
                                                  │
                          SEO INDEX-WORTHINESS ENGINE decides, per URL:
                          INDEX · NOINDEX · CANONICAL_TO_PARENT · CANONICAL_TO_ARTIFACTSEARCH · NOT_GENERATED
```

| Path | What |
|---|---|
| `build/` | The generator (Node, no dependencies). `build/lib/engine.mjs` is the index-worthiness engine. |
| `config/seo-index-policy.json` | **The administration.** Score weights, thresholds, minimums, growth gate, IndexNow. |
| `config/homepage-featured.json` | Homepage prominence (Top-25 style) — never indexability. |
| `content/` | Editorial: era / market / price-guide intros and site pages, each with a status. Only `VERIFIED` / `PUBLISHED` renders. |
| `identify/` | The Identification Library — hand-written guides (the build refreshes their header/footer). |
| `state/index-state.json` | Per-URL state, score, content hash, lastmod. Drives sitemaps, IndexNow and the growth gate. |
| `reports/seo-index-report.md` | The index-bloat dashboard, rewritten every build. |
| `docs/` | `SEO-INDEX-QUALITY-REQUIREMENTS.md` (the controlling brief) · `ARCHITECTURE.md` (how each requirement is met). |
| everything else at the root | Generated output. Don't edit — it is overwritten nightly. |

## Build it yourself

```bash
AS_EXPORT_TOKEN=… node build/build.mjs            # from the live export
node build/build.mjs --from-dir ../row-snapshot   # from a local snapshot
node build/build.mjs --check --from-dir …         # build to a temp dir + validate, touch nothing
```

Snapshots come from the ArtifactSearch repo:
`npx tsx scripts/relicsofwar-export-snapshot.ts --out ../row-snapshot`.

## Design

Rifle green · aged brass · ivory · copper — deliberately distinct from
ArtifactSearch's navy/brass/parchment. Typography per the Jack Melton Editorial &
Design Standard: Cinzel / Cinzel Decorative / Playfair Display / Crimson Text.

© Historical Publications LLC — "History Brought to Life"
