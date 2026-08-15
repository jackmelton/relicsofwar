# RelicsOfWar.com — Architecture and how each SEO requirement is met

_Companion to `SEO-INDEX-QUALITY-REQUIREMENTS.md` (the controlling brief, §1–§80). Written 2026-08-15._

## The shape

**Static site on Cloudflare Pages, rebuilt nightly by GitHub Actions from a read-only export of ArtifactSearch's public catalog.** No server, no admin UI, no database of its own.

Why static, when the brief speaks of "tens or hundreds of thousands of records": because the brief's own rules mean RelicsOfWar should *not* have a page per record. Listings are canonical on ArtifactSearch (§7–§8) and are shown here only inside curated pages; a page exists on RelicsOfWar only when it aggregates, contextualizes, or values. That is a few hundred to a few thousand pages, well inside Cloudflare Pages' 20,000-file limit — and every one of them is a plain HTML file with perfect Core Web Vitals, zero runtime cost, and nothing to break at 3 AM.

```
ArtifactSearch (Render, Postgres)
  └─ GET /api/export/relicsofwar/{eras,categories,sources,listings,sold}   token-gated, allowlisted DTOs,
       shared public-visibility predicates                                    cursor-paginated
        │  nightly 11:30 UTC (after AS's own overnight pipeline)
        ▼
GitHub Actions: node build/build.mjs
  1. fetch          build/lib/fetch.mjs
  2. model          build/lib/model.mjs      eras × top-level categories; inventory, source diversity,
                                             sub-category breakdown, sold-price statistics, editorial, guides
  3. ENGINE         build/lib/engine.mjs     score 0–100 → INDEX / NOINDEX / CANONICAL_TO_PARENT /
                                             CANONICAL_TO_ARTIFACTSEARCH / NOT_GENERATED   (config-driven)
  4. render         build/lib/render/*.mjs   home, /eras/, era hubs, market pages (+ pagination), price-guide
                                             index + pages, site pages, 404; refreshes chrome on identify/*.html
  5. sitemaps       build/lib/sitemaps.mjs   sitemap index → per-group children; INDEX + self-canonical only;
                                             lastmod = date the content hash last changed
  6. validate       build/lib/validate.mjs   canonical / robots / H1 / title / description / JSON-LD / links /
                                             orphans / sitemap hygiene / robots.txt — errors fail the build
  7. growth gate    build/build.mjs          refuses to publish an index explosion without explicit approval
  8. IndexNow       build/lib/indexnow.mjs   added / changed / removed INDEX URLs, hash-deduped, capped
  9. state+report   state/index-state.json, state/history.jsonl, reports/seo-index-report.md
  └─ git commit → push → Cloudflare Pages deploys the repo root
```

## Page inventory (Phase 1)

| URL | Type | Generated when | INDEX when |
|---|---|---|---|
| `/` | home | always | always |
| `/eras/` | browse index | always | always |
| `/{era}/` | era hub | any listings or sales | score ≥ threshold; ≥ 25 listings and ≥ 2 category pages |
| `/{era}/{category}/` | market page | ≥ 1 active listing | score, ≥ 10 listings, ≥ 2 sources, and unique value (price data or verified intro) |
| `/{era}/{category}/page/N/` | pagination | > 24 listings, N ≤ 5 | never (`noindex,follow`, self-canonical) |
| `/price-guide/` | price-guide index | always | always |
| `/price-guide/{era}/{category}/` | price guide | ≥ 5 recorded sales | score, ≥ 10 sales, ≥ 2 sale sources |
| `/identify/…` | research guides | hand-written | always (they are the editorial) |
| `/about/`, `/editorial-standards/`, `/research-standards/`, `/how-prices-work/`, `/how-listings-work/`, `/how-dealer-data-is-collected/`, `/corrections/`, `/contact/`, `/privacy/`, `/terms/` | trust pages | `content/pages/*.md` status PUBLISHED/VERIFIED | always |
| item pages | — | **not generated** (`itemPages.policy = none`) | — |

First build against the 2026-08-15 mirror: 770 pages written, **77 INDEX** (30 market, 26 price-guide, 11 era hubs, guides + site pages), 413 NOINDEX (mostly thin market/price pages that exist for visitors), 258 not generated.

## The score (§4)

`SEOIndexScore = InventoryDepth(25) + SourceDiversity(15) + UniqueContent(15) + HistoricalContext(10) + UserUtility(15) + InternalLinkValue(10) + SearchDemand(10) − DuplicateContentRisk(15) − ThinContentRisk(20)`

- InventoryDepth / SourceDiversity: log ramps on active listings / distinct sources (sales / sale sources for price pages).
- **UniqueContent is awarded only for editorial a person marked VERIFIED or PUBLISHED.** Nothing the build writes itself counts.
- HistoricalContext: linked identification guides (+ verified era intro).
- UserUtility: real recorded-sale statistics on the page (≥ 10 sales full, ≥ 5 half).
- InternalLinkValue: structural — every generated page is reachable Home → /eras/ → era → category in ≤ 3 clicks; guides add.
- SearchDemand: from `config/search-demand.json` (Search Console), 0 until populated.
- DuplicateContentRisk: Jaccard ≥ 0.8 between two pages' listing sets → the smaller is `CANONICAL_TO_PARENT` (canonical to the larger); one category holding ≥ 90% of an era also penalized.
- ThinContentRisk: < 5 listings full penalty, < 10 half; < 10 sales full.

Thresholds (`config/seo-index-policy.json`): ≥ 80 INDEX · 60–79 INDEX **only** with unique value (verified intro or price data) · < 60 NOINDEX · plus hard minimums that block INDEX regardless of score. Without any editorial the ceiling for a market page is ≈ 62, so today's INDEX set is exactly the pages with deep inventory *and* real price intelligence — the brief's Phase 1. Editorial is the lever that lifts the rest (see OPERATIONS §4).

## Requirement → mechanism

| § | Requirement | Where |
|---|---|---|
| 1 | Follow current Google/Bing policy | Checked 2026-08-15 against the live Google spam-policies page (scaled content abuse = "large amounts of unoriginal content that provides little to no value"; doorway pages; thin affiliate; hidden text/cloaking; site-reputation abuse — first-party syndication between two HPLLC sites is not third-party hosting) and the IndexNow protocol spec (key file, body fields, 10,000-URL cap, 429 on resubmission). Bing's Webmaster Guidelines page is JS-rendered and could not be fetched headlessly — re-read it by hand when verifying the site in Bing Webmaster Tools. Nothing here depends on a deprecated feature. |
| 2, 67 | No scaled combination pages / doorway pages | Only era × top-level category is generated; sub-categories, affiliation, maker, state, dealer, price are **not** URL dimensions — they are in-page links to ArtifactSearch search. |
| 3 | Index-worthiness engine + states | `build/lib/engine.mjs`; every generated page carries `<!-- index-worthiness: … -->` with its score and reasons |
| 4 | Configurable score | `config/seo-index-policy.json` (no admin UI by decision — Jack, 2026-08-15) |
| 5–6 | Never index empty / thin pages | NOT_GENERATED at 0 items; ThinContentRisk + hard minimums (10 listings, 2 sources; 5/10 sales) |
| 7–8, 10 | Cross-domain canonical rule; no page just because AS supplied a record | Listings link to `artifactsearch.com/artifact/<slug>`; sold records to `/sold/<slug>`; **no item pages**; RelicsOfWar pages are aggregations (market), values (price guide), or research (guides) |
| 9 | Research-enhanced item pages | Later phase; `itemPages.policy` + `CANONICAL_TO_ARTIFACTSEARCH` state reserved |
| 11–12 | No fake unique content; AI gate | Build writes only data-derived sentences; editorial requires a status; only VERIFIED/PUBLISHED renders; report lists everything waiting in review |
| 13, 51 | Index expansion warning / growth alert | Growth gate in `build.mjs`: > +300 **and** > +25% blocks the build; `SEO_INDEX_EXPANSION_APPROVED=<count>` (workflow input) approves once; hard cap 15,000; report shows week-over-week |
| 14–16 | Facets, parameters | Static site: there are no parameters. Facets are outbound links to AS search. |
| 17–19 | Clean, lowercase, one canonical, self-canonical | Slugs come from AS; every page emits exactly one `<link rel=canonical>`; validator enforces |
| 20 | Canonical validation tests | `build/lib/validate.mjs`: count, https, host, exists, not-noindex, INDEX ⇒ self, state consistency |
| 21–23 | Sitemap index; only INDEX; honest lastmod | `build/lib/sitemaps.mjs`; lastmod from `state/index-state.json` content hashes (meaningful content only: listing set, stats, editorial) |
| 24–25 | GSC / Bing | Manual one-time verification (OPERATIONS §2) |
| 26–27 | IndexNow, not as spam | `build/lib/indexnow.mjs`: only added/changed/removed INDEX URLs, `lastSubmittedHash` dedupe, 500/run cap, key at `/<key>.txt` |
| 28–29 | robots.txt vs noindex | robots.txt disallows only internal repo folders (not pages); indexability is always `<meta name=robots>` |
| 30 | Internal search | None on RelicsOfWar — search hands off to ArtifactSearch |
| 31 | Crawlable pagination | `/page/N/` real links, `rel=prev/next`, capped at 5, then hand-off |
| 32 | JS SEO | Static HTML; the only script sets the © year |
| 33–37 | CWV, budgets, images | Static; fonts preconnected; first 4 cards eager + `fetchpriority=high`, rest lazy; explicit width/height + aspect boxes (CLS 0); `srcset` 320/480/800 via AS's `/api/img` (WebP, edge-cached a week); `_headers` sets asset caching |
| 38 | Fast search | Not on this site by design |
| 39–41 | Truthful structured data | WebSite + Organization (home), BreadcrumbList everywhere, CollectionPage on hubs/market pages, Article on trust pages. **No Product/Offer markup** — RelicsOfWar is not the seller |
| 42–43 | Outbound links, sponsorship | Every card links to the AS listing (which links to the seller); no paid placement exists; if added it will be labeled and separate |
| 44–45 | Dealer/auction pages | Not generated in Phase 1 (would be thin duplicates of AS `/sources/*`); export already carries the allowlisted source DTO for Phase 2 |
| 46–48 | Sold lifecycle, soft 404 | No item pages ⇒ nothing to expire; a market/price page that empties out is NOT_GENERATED and its file is swept (true 404); Pages `_redirects` for retired URLs |
| 49–50 | Maintenance worker + dashboard | Every build IS the worker: `reports/seo-index-report.md` = dashboard + review queue, `state/history.jsonl` = trend |
| 52 | Duplicate detection | Engine (Jaccard clusters) + validator (duplicate titles/descriptions among INDEX pages) |
| 53–55 | Titles, descriptions, one H1 | Templates; validator warns > 75-char titles, errors on missing/duplicate/≠1 H1 |
| 56 | Entity consistency | Names and slugs are ArtifactSearch's controlled vocabulary, verbatim |
| 57–60 | Breadcrumbs, internal links, orphans, depth | Breadcrumbs + BreadcrumbList; hub → category → guides/price links; validator fails on any INDEX orphan; max depth 3 |
| 61 | Top 25 ≠ indexability | `config/homepage-featured.json` is prominence only |
| 62–63 | Authority content, sources | `identify/` guides + `content/` with the research standard; `/research-standards/` |
| 64–65 | Trust pages, methodology | `content/pages/*.md` → `/about/` … `/terms/`; `/how-prices-work/` explains median/percentiles/thresholds/limits |
| 66, 78, 80 | Collectors first, quality over quantity | The engine's whole design; report tracks INDEX count, not page count |
| 68–70 | No stuffing / hidden text / cloaking | Same HTML for everyone; no hidden blocks; the engine comment is an HTML comment, not content |
| 71 | Security | Static; `_headers`: nosniff, frame, referrer, permissions policies; no accounts |
| 72 | UGC | None |
| 73–74 | Monitoring, anomaly alerts | Report + history in git; growth gate blocks; GSC/Bing manual. (Programmatic GSC pull is a follow-up.) |
| 75 | Release checklist | Validator + workflow: any error ⇒ nothing committed |
| 76 | Staging protection | No staging environment; `--check` builds to a temp dir |
| 77 | Phased rollout | Phase 1 = what the engine indexes today (77 URLs). Phase 2 (dealers/auction houses) and 3 (research-enhanced items) are deliberate config/code changes gated by §13 |
| 79 | Complementary sites | Home explains it; every page's footer says it; nav links "Marketplace ↗" |

## Data contract with ArtifactSearch

`lib/relicsofwar-export.ts` (AS repo, PR #1196). Visibility predicates are imported from ArtifactSearch's own `listing-predicates` / `sold-predicates` / `source-visibility` — never restated — plus the feed's sensitive-syndication guard. Source DTOs carry no PII, billing, or crawl config. Listing DTOs are card fields + AS canonical URL + primary image; sold DTOs are realized price + AS `/sold/` URL. Export runs after AS's overnight pipeline so RelicsOfWar never ships something the sensitive scan is about to hide.

## Not built (deliberately) and why

- **Admin UI / dashboards** — Jack: "no admin needed" (2026-08-15). Config is a JSON file; the dashboard is a Markdown report in git.
- **Membership / paywall** — lives on ArtifactSearch, free. `/membership` 301s there.
- **Item pages, dealer pages, auction-house pages** — Phase 2/3 per §77; the brief forbids thin mirrors and Phase 1 has no editorial to justify them.
- **Search on RelicsOfWar** — ArtifactSearch is the search engine (§79).
- **Programmatic Search Console / Bing API monitoring (§73–74)** — needs OAuth credentials Jack must create; the manual step is in OPERATIONS §2. Follow-up.
