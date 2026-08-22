# Relics of War — Operations Runbook

_Rewritten 2026-08-15 for the ArtifactSearch-fed build. The 2026-07 sample-data
price guide (`data/sales.json` + `scripts/build-archive.mjs`) is retired; nothing
here requires typing a sale in by hand._

## 1. What runs by itself

Every night at 11:30 UTC (about 7:30 AM Eastern) GitHub Actions
(`.github/workflows/nightly-build.yml`):

1. pulls the public catalog from ArtifactSearch (`/api/export/relicsofwar`),
2. rebuilds every page, runs the **index-worthiness engine**, sitemaps, robots,
3. runs the SEO release checks (canonicals, robots meta, H1s, titles,
   descriptions, sitemap hygiene, orphans, broken links) and the **growth gate**,
4. pings IndexNow for INDEX URLs that were added / changed / removed,
5. commits — Cloudflare Pages deploys the commit within a minute or two.

If any step fails, **nothing is committed** and the live site is unchanged that
night. The report is attached to the failed run (Actions → run → Artifacts).

You never need to touch the generated files at the repo root.

## 2. One-time setup

- ✅ **Token secret** (done 2026-08-15, stored as `RELICSOFWAR_EXPORT_TOKEN`). Render → `artifactsearch-web` →
  Environment → copy `RELICSOFWAR_EXPORT_TOKEN` → GitHub → jackmelton/relicsofwar
  → Settings → Secrets and variables → Actions → New secret `AS_EXPORT_TOKEN` (the workflow also accepts the name `RELICSOFWAR_EXPORT_TOKEN`).
  Until this exists the nightly job fails at step 1 and the site stays on the
  last committed build.
- ✅ **Google Search Console** — property `https://relicsofwar.com/` verified
  2026-08-15 by HTML file (`/google504039a36c16289e.html` — committed at the repo
  root; **never delete it**); `/sitemap.xml` submitted, status Success.
- ✅ **Bing Webmaster Tools** — property `https://relicsofwar.com/` verified
  2026-08-15 (Google sign-in, jackmelton@gmail.com) via `/BingSiteAuth.xml` +
  the `msvalidate.01` meta tag the build emits on every page — **keep both**;
  `/sitemap.xml` submitted. IndexNow is keyed (`config/seo-index-policy.json` →
  `indexnow.key`, served at `/<key>.txt`) and Bing acknowledged the first batch.
- ⬜ **`www` → apex redirect** (Cloudflare dashboard, zone `relicsofwar.com`).
  `https://www.relicsofwar.com/` currently answers 200 with a copy of the site
  (canonical tags point at the apex, so it is not indexed, but it is still a
  duplicate host). Cloudflare Pages `_redirects` cannot match on hostname, so
  this has to be a zone Redirect Rule — Rules → Redirect Rules → Create rule:
  *When incoming requests match* — Field `Hostname`, Operator `equals`, Value
  `www.relicsofwar.com`; *Then* — Dynamic redirect, expression
  `concat("https://relicsofwar.com", http.request.uri.path)`, status `301`,
  *Preserve query string* on. (Same as the built-in "Redirect from WWW to
  root" template.) Verify with
  `curl -sI https://www.relicsofwar.com/about/` → `301` + `location: https://relicsofwar.com/about/`.
- ⬜ **Search Console sitemap children.** `/sitemap.xml` is a sitemap *index*
  (five children under `/sitemaps/`). Google read the index once at submission
  and reports 0 discovered URLs until it gets round to the children, which for
  a new property can take weeks. Submit the children directly in Search Console
  → Sitemaps (each is processed at once and reports its own count):
  `/sitemaps/core.xml`, `/sitemaps/eras.xml`, `/sitemaps/categories.xml`,
  `/sitemaps/price-guide.xml`, `/sitemaps/research.xml`. Leave `/sitemap.xml`
  submitted as well.
- ℹ️ **Cloudflare managed robots.txt.** The zone has Cloudflare's *Content
  Signals* managed robots.txt on, so the live `/robots.txt` is prefixed with a
  Cloudflare block (`Content-Signal: search=yes,ai-train=no,use=reference` plus
  `Disallow: /` for GPTBot, ClaudeBot, CCBot, Bytespider, Google-Extended and
  similar AI crawlers). Our own rules and the `Sitemap:` line follow it intact;
  Googlebot and Bingbot are unaffected. Turn it off under Security → Bots if
  AI-search visibility is wanted.
- ✅ **ArtifactSearch banner ads** on every page (`assets/ads.js`,
  publisher=relicsofwar): leaderboard under the header, rectangle in the footer;
  house ads when nothing is booked; viewable-impression counting; paid links
  carry rel="sponsored". Reports break out in ArtifactSearch's ad analytics under
  publisher **relicsofwar**.

## 3. Weekly: read the report

`reports/seo-index-report.md` (rewritten every build, history in git):

- **Index state table** — INDEX / NOINDEX / canonicalized counts by page type,
  with week-over-week change.
- **Growth gate** — did the indexable count jump? (See §5.)
- **Release checks** — should always be 0 errors; warnings are long titles etc.
- **Review queue** — (a) editorial content sitting in DRAFT / REVIEW that will
  render as soon as it is VERIFIED; (b) *nearest to INDEX*: pages a verified
  intro would tip over the line; (c) duplicate clusters.

## 4. The main lever: editorial content

The engine cannot award `UniqueContent` or full `HistoricalContext` on its own —
those points exist only for text a person has verified. That is by design (brief
§11–§12). To lift a page:

1. Create `content/era-category/<era>--<category>.md` (market page intro) or
   `content/price-guide/<era>--<category>.md` (price-guide intro) or
   `content/eras/<era>.md` (era hub intro). Slugs are ArtifactSearch's.
2. Front matter:
   ```
   ---
   status: HUMAN_REVIEW_REQUIRED     # DRAFT | AI_ASSISTED | HUMAN_REVIEW_REQUIRED | VERIFIED | PUBLISHED
   ---
   ```
   then the intro in plain Markdown (paragraphs, ## headings, lists, links).
3. When you have checked every factual claim, change status to `VERIFIED` (or
   `PUBLISHED`), commit, push. The push triggers a build; the intro renders and
   the page rescored that night.

**Never publish invented history, provenance, rarity or values.** Text that is
not `VERIFIED`/`PUBLISHED` is not rendered anywhere — it only shows up in the
report's review queue.

New identification guides: add the HTML under `identify/`, then map it in
`content/guides.json` (era + categories) so the market and price-guide pages link
to it and it counts toward `HistoricalContext`.

## 5. Growth gate — when a build is BLOCKED

If a change (a new page type, a loosened threshold, a big data jump) would raise
the INDEX count by more than **both** `growthGate.maxIncreaseAbs` (300) and
`growthGate.maxIncreasePct` (25%) at once, the build fails with

```
SEO INDEX EXPANSION WARNING — BUILD BLOCKED
Current: N  Proposed: M  Increase: +X (+Y%)
```

Read the report's "Every decision" table, and if the new pages are wanted:
Actions → *Nightly build* → *Run workflow* → `approve_expansion` = **M** (the
proposed count). Approval is for that exact number, once.

## 6. Tuning the engine

`config/seo-index-policy.json` — weights, thresholds, minimums, pagination,
price-guide minimums, duplicate detection, growth gate, IndexNow cap. Change,
commit, push; the next build applies it and the report shows the effect. Loosen
in small steps and watch Search Console for a week before the next step.

`config/homepage-featured.json` — hand-pick up to 25 `era/category` keys for
homepage prominence. Empty = the build features the largest INDEXed market pages.
This never affects index state (brief §61).

`config/search-demand.json` — optional 0–10 `SearchDemand` per page key from
Search Console data.

## 7. Things the site does on purpose

- **No item pages.** A listing shown here is canonical on ArtifactSearch; the
  card links there. Research-enhanced item pages are a later phase and would
  need verified editorial before one is generated at all.
- **Pagination pages are `noindex,follow`**, self-canonical, and capped at 5;
  page 5 hands off to ArtifactSearch search.
- **Price-guide figures never appear below 5 recorded sales**, and pages under
  10 sales or from a single seller stay NOINDEX. Medians, not averages.
- **Retired URLs** (`/membership`, `/submit`, `/price-guide/<category>/`)
  301 via `_redirects` — membership goes to ArtifactSearch's free registration.

## 8. If the site looks wrong

- Check the latest run in GitHub Actions; a red run means last night didn't
  publish — the error is in the log and the report artifact.
- `node build/build.mjs --check --from-dir <snapshot>` reproduces the whole
  build locally without touching the repo.
- Rolling back = `git revert` the nightly commit; Pages redeploys.
