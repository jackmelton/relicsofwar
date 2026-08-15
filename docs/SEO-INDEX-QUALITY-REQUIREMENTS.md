# RelicsOfWar.com — SEO Performance, Index Quality, and Search-Engine Spam Protection

_Brief received from Jack Melton 2026-08-15. **Controlling requirements document** for every
RelicsOfWar page, route, sitemap, and feed that draws on ArtifactSearch data. Hosting: Cloudflare._

> Status: REQUIREMENTS — not yet implemented. RelicsOfWar today is a static Cloudflare Pages site
> (price-guide generator + Identification Library). This document governs the build-out that will
> put ArtifactSearch records on RelicsOfWar. Nothing below is optional.

---

This section is a critical requirement for RelicsOfWar.com.

RelicsOfWar will potentially display tens or hundreds of thousands of records originating from ArtifactSearch.com.

That scale creates a significant SEO risk if implemented incorrectly.

The goal is NOT: Create as many indexable URLs as possible.

The goal is: Create the highest-quality, most useful, authoritative military-antique pages possible, while allowing search engines to index only pages that provide genuine value.

RelicsOfWar must never use mass page generation simply to capture search queries.

## 1. FOLLOW SEARCH-ENGINE QUALITY POLICIES

Build the site to comply with the current:

* Google Search Essentials
* Google Search spam policies
* Google people-first content guidance
* Google structured-data policies
* Google ecommerce crawling guidance
* Microsoft Bing Webmaster Guidelines
* Bing indexing and crawl guidance

Before implementation, Claude Code should review the current official versions of these policies because search-engine requirements change. Do not rely solely on old SEO blog posts or outdated third-party advice. Use official Google and Microsoft documentation as the controlling sources.

## 2. SPECIFICALLY PREVENT SCALED CONTENT ABUSE

Google currently uses the term: **Scaled Content Abuse**. RelicsOfWar must be specifically engineered to avoid behavior that could resemble this.

Do NOT automatically generate thousands of pages merely by combining:

```text
category
subcategory
era
maker
model
state
dealer
auction house
price
material
keyword
```

Example of what NOT to do:

```text
/civil-war/confederate/buckles/georgia/
/civil-war/confederate/buckles/alabama/
/civil-war/confederate/buckles/tennessee/
/civil-war/confederate/buckles/virginia/
```

unless each page has legitimate inventory and provides meaningful independent value. Do not create pages solely because a database combination mathematically exists.

## 3. INDEX-WORTHINESS ENGINE

Create an internal **SEO INDEX-WORTHINESS ENGINE**. Every dynamically generated page should be evaluated before being allowed into search-engine indexes.

Possible states:

```text
INDEX
NOINDEX
CANONICAL_TO_PARENT
CANONICAL_TO_ARTIFACTSEARCH
404
410
REDIRECT
```

Do not assume every database page deserves `INDEX`.

## 4. INDEX QUALITY SCORE

Create a configurable SEO quality score. For example:

```text
SEOIndexScore =
InventoryDepth
+ SourceDiversity
+ UniqueContent
+ HistoricalContext
+ UserUtility
+ InternalLinkValue
+ SearchDemand
- DuplicateContentRisk
- ThinContentRisk
```

The precise weights can be determined after auditing actual data. Possible thresholds:

```text
80–100   INDEX
60–79    INDEX only after review or sufficient unique content
30–59    NOINDEX
0–29     NOINDEX or do not generate page
```

This should be configurable in administration.

## 5. NEVER INDEX EMPTY CATEGORY PAGES

A page such as "Confederate Naval Belt Plates" should not be indexed merely because the taxonomy contains that classification. If it contains 0 items, do not index it. If appropriate:

```html
<meta name="robots" content="noindex,follow">
```

or do not generate the page at all.

## 6. AVOID THIN CATEGORY PAGES

Do not index thousands of category combinations containing 1 item, 2 items, or 3 nearly identical items unless the page provides substantial independent research or collector value.

Establish a minimum inventory threshold. Potential starting point: **5–10 meaningful active or historical records**, but do not use a rigid number blindly.

Also consider: historical sales · source diversity · identification information · collector usefulness · original editorial material.

## 7. CRITICAL CROSS-DOMAIN RULE

ArtifactSearch.com and RelicsOfWar.com must NOT accidentally compete with one another using nearly identical pages.

ArtifactSearch is the primary marketplace/search database. RelicsOfWar is the discovery/research/value platform.

**ARTIFACTSEARCH SHOULD GENERALLY BE CANONICAL FOR**

* raw marketplace listings
* original aggregated listing pages
* broad dealer inventory
* broad auction inventory
* basic marketplace search pages

**RELICSOFWAR SHOULD GENERALLY BE CANONICAL FOR**

* price-guide pages
* identification pages
* collector guides
* market-analysis pages
* historical price pages
* curated marketplace categories
* educational material
* artifact comparison pages
* substantial research-enhanced item pages

## 8. MIRRORED LISTING PROTECTION

If RelicsOfWar displays essentially the same marketplace listing as ArtifactSearch, DO NOT automatically create another indexable page. Use `NOINDEX` or `rel="canonical"` → ArtifactSearch canonical page, depending on the architecture.

## 9. WHEN A RELICSOFWAR ITEM PAGE MAY BECOME INDEXABLE

A RelicsOfWar artifact page may become independently indexable when it provides meaningful additional value. For example:

```text
Artifact Name
Current Listing
Historical Identification
Pattern Information
Manufacturer
Date Range
Military Usage
Collector Notes
Comparable Sales
Price History
Related Examples
Related Auction Results
Relevant Reference Material
```

At that point it is no longer merely a mirrored listing. It becomes a useful collector/research resource.

## 10. UNIQUE VALUE REQUIREMENT

Create a programmatic rule: **No indexable RelicsOfWar page may exist solely because ArtifactSearch supplied a record.** There must be a reason for that page to exist independently. Examples: useful aggregation · meaningful historical context · verified price intelligence · comparison information · identification guidance · market analysis · substantial curated inventory · useful collector reference material.

## 11. DO NOT GENERATE FAKE UNIQUE CONTENT

Never create meaningless paragraphs simply to make duplicate pages appear different. Do NOT use AI to produce "500 words of filler" around every artifact. Do not spin descriptions. Do not paraphrase dealer descriptions merely for SEO differentiation. Do not create synthetic historical facts. Do not generate invented provenance. Do not generate invented rarity claims. Do not generate invented valuations.

This is both an SEO requirement and a historical-integrity requirement.

## 12. AI CONTENT QUALITY GATE

If AI is used to assist with descriptions, category introductions, identification material, collector guides, market analysis, or historical context — require verification before publication when factual historical claims are involved. AI should help organize and summarize verified information. It must not mass-produce unverified text.

Content states:

```text
DRAFT
AI_ASSISTED
HUMAN_REVIEW_REQUIRED
VERIFIED
PUBLISHED
```

Only appropriate content should become indexable.

## 13. PROGRAMMATIC SEO SAFETY LIMIT

Create a deployment safeguard. If a new feature would suddenly create 10,000 / 50,000 / 100,000+ new indexable URLs, require an SEO-impact review before deployment. Claude Code should flag the change:

```text
SEO INDEX EXPANSION WARNING

This deployment will increase indexable URLs:

Current: 42,817
Proposed: 184,229
Increase: +330%

Review required before production deployment.
```

This should prevent accidental index explosions.

## 14. FACETED NAVIGATION CONTROL

RelicsOfWar will contain many filters (`?era=civil-war`, `?side=confederate`, `?category=firearms`, `?price=1000-5000`, `?sort=newest`, `?dealer=example`). Do not allow every possible filter combination to become an indexable URL. This could create millions of low-value URLs.

## 15. FACET INDEX RULES

Most filter combinations should be `NOINDEX` and/or excluded from unnecessary crawling when technically appropriate. Allow indexation only for deliberately approved landing pages.

GOOD: `/civil-war/firearms/` · `/civil-war/confederate/belt-plates/` · `/world-war-ii/helmets/`
Potentially bad: `/search?category=buckles&sort=price&dealer=17&page=4`

Do not make sorting parameters indexable.

## 16. URL PARAMETER CONTROL

Create an explicit parameter policy. Parameters such as `sort`, `view`, `page_size`, `session`, `tracking`, `utm_source`, `utm_medium`, `utm_campaign`, `ref` must not generate competing canonical pages. Normalize canonical URLs.

## 17. CLEAN URL STRUCTURE

Prefer `/civil-war/firearms/`, `/civil-war/belt-plates/`, `/price-guide/colt-model-1860-army/`, `/dealers/example-military-antiques/`. Avoid `/page?id=57392&cat=14&era=3&source=9&type=5`. Use lowercase URLs. Use hyphens. Keep them human-readable.

## 18. ONE CANONICAL URL PER RESOURCE

Prevent duplicate URL forms (`/item/123`, `/items/123`, `/artifact/123`, `/artifact/123?source=homepage`, `/artifact/123?ref=dealer`) from becoming separate search pages. All variants should resolve to a single canonical URL.

## 19. SELF-REFERENCING CANONICALS

Every legitimate indexable RelicsOfWar page should generally include a correct self-referencing canonical unless another page is intentionally canonical. Never emit conflicting canonical tags.

## 20. CANONICAL VALIDATION TESTS

Create automated tests detecting: missing canonical · multiple canonical tags · canonical to 404 · canonical to redirect · canonical to noindex · HTTP canonical on HTTPS page · incorrect hostname · wrong ArtifactSearch/RelicsOfWar assignment. Run these tests before deployment.

## 21. XML SITEMAP ARCHITECTURE

Do not create one enormous unmanaged sitemap. Use sitemap indexes:

```text
/sitemap.xml
/sitemaps/categories-1.xml
/sitemaps/categories-2.xml
/sitemaps/price-guide-1.xml
/sitemaps/research-1.xml
/sitemaps/dealers-1.xml
/sitemaps/auctions-1.xml
```

Only include canonical, indexable URLs.

## 22. NEVER INCLUDE NOINDEX PAGES IN SITEMAPS

Automatically validate: Sitemap URL → HTTP 200 → indexable → canonical to itself. Do not submit 404 / 301 / 302 / 410 / noindex / blocked / duplicate URLs inside XML sitemaps.

## 23. SITEMAP LAST-MODIFIED ACCURACY

Use `<lastmod>` only when the page meaningfully changes. Do not tell search engines that every page changed today merely because the database was rebuilt. Meaningful changes: new research · price change · item status change · new comparable sale · new inventory · substantive description update.

## 24. GOOGLE SEARCH CONSOLE

Configure and verify RelicsOfWar.com with Google Search Console. Monitor: indexed pages · discovered pages · crawled pages · duplicate pages · canonical conflicts · crawled currently not indexed · discovered currently not indexed · soft 404s · structured-data errors · Core Web Vitals · manual actions · security issues. Do not ignore large changes.

## 25. BING WEBMASTER TOOLS

Configure and verify RelicsOfWar.com with Microsoft Bing Webmaster Tools. Monitor: crawl status · indexed URLs · SEO errors · duplicate URLs · markup issues · blocked pages · sitemap health · crawl anomalies.

## 26. INDEXNOW

Implement IndexNow for Microsoft/Bing and other participating systems. Notify IndexNow when an indexable URL is ADDED / UPDATED / DELETED. Do not submit the entire website repeatedly. Submit meaningful URL changes: new collector guide · new price-guide page · updated auction result · removed page · new index-worthy category.

## 27. DO NOT USE INDEXNOW AS A SPAM ENGINE

Rate-limit submissions. Deduplicate notification queues. Do not repeatedly submit unchanged URLs. Maintain:

```text
url
last_content_hash
last_submitted_hash
last_submitted_at
```

Only resubmit when meaningful content has changed.

## 28. ROBOTS.TXT

Create a carefully designed robots.txt. Do NOT blindly block the entire dynamic system. Allow search engines to crawl the pages they need in order to understand canonical/index directives. Potentially block obvious crawl traps: internal searches · session URLs · certain infinite filter spaces · development routes · admin routes · API internals. Audit before deployment.

## 29. NEVER USE ROBOTS.TXT AS A SUBSTITUTE FOR NOINDEX

Understand the difference between ROBOTS.TXT and NOINDEX. Use the appropriate mechanism for the intended result. Do not accidentally prevent search engines from seeing a `noindex` instruction by blocking the page improperly.

## 30. INTERNAL SITE SEARCH

URLs generated by internal search (`/search?q=confederate+buckle`) should normally not be indexable. Use `noindex,follow` unless there is a deliberate SEO landing-page strategy. Do not create Google-search-targeted pages for every phrase users type into internal search.

## 31. PAGINATION

Inventory must remain crawlable. Do not depend solely on "Load More" or JavaScript interaction. Provide crawlable paginated URLs with real `<a href="">` links where pagination is required, e.g. `/civil-war/firearms/`, `/civil-war/firearms/page/2/`, `/civil-war/firearms/page/3/` — or another technically appropriate structure.

## 32. JAVASCRIPT SEO

Core marketplace and research content must be discoverable by search engines. Use server-side rendering, static generation, incremental static regeneration, or server components where appropriate. Do not require search crawlers to click buttons to reveal important content.

## 33. CORE WEB VITAL PERFORMANCE TARGETS

Target at minimum: LCP ≤ 2.5 s · INP < 200 ms · CLS < 0.1. Measure real-user performance, not just laboratory scores.

## 34. PERFORMANCE BUDGET

Create explicit performance budgets. Initial JS bundle: keep as small as practical · above-fold images: optimized and responsive · third-party scripts: strictly controlled · fonts: subset/preload only when necessary · layout shifts: near zero. Set measurable thresholds after profiling the production application.

## 35. IMAGE PERFORMANCE

Implement: responsive srcset · modern image formats · width/height attributes · lazy loading below fold · priority loading above fold · CDN delivery · cache headers · appropriate compression. Do not load a 4000-pixel dealer photograph into a 250-pixel card.

## 36. DO NOT LAZY LOAD THE PRIMARY ABOVE-FOLD IMAGE

The main visual on an important item or research page should load promptly. Avoid creating poor LCP by lazy-loading the primary hero/product image.

## 37. SERVER PERFORMANCE

Measure and optimize: database query time · search query time · cache hit rate · API latency · TTFB · render time · image latency. Avoid database queries that perform massive joins on every page load. Precompute or cache expensive marketplace statistics.

## 38. SEARCH RESULT SPEED

Target extremely responsive collector search. Use appropriate database indexes, search indexes, caching, pagination, query limits. Never fetch an entire category into the browser merely to filter it client-side.

## 39. STRUCTURED DATA

Implement structured data only when it truthfully describes the visible page. Potential schema types, where genuinely applicable: Organization · WebSite · BreadcrumbList · Product · ItemList · Article · Person · CollectionPage. Research current Google eligibility rules before implementing each type.

## 40. NEVER FAKE STRUCTURED DATA

Do not add fake reviews, fake ratings, fake prices, fake inventory, fake availability, fake author information, fake auction information. Do not place information in structured data that users cannot see on the page.

## 41. MARKETPLACE PRODUCT MARKUP

RelicsOfWar often displays an item that is actually sold by a third-party dealer. Structured data must accurately represent: seller · price · currency · availability · condition · URL · item identity. Do not imply RelicsOfWar is the seller if the dealer or auction company is the seller.

## 42. OUTBOUND DEALER LINKS

All dealer and auction links must have legitimate collector utility. Do not create thousands of keyword-rich outbound links solely for SEO. Where links are paid / sponsored / affiliate, apply appropriate link qualifications. Do not hide commercial relationships.

## 43. SPONSORED LISTINGS

Clearly label paid placement: Sponsored · Featured Dealer · Promoted Listing. Never disguise advertising as organic ranking. Organic category ranking and paid placement should be separate systems.

## 44. DEALER DIRECTORY QUALITY

Do not generate empty dealer pages. Dealer pages should provide genuine information: dealer name · business description · specialties · current inventory · categories · website · marketplace statistics · recently listed items. Only include information that can be supported.

## 45. AUCTION HOUSE QUALITY

Auction-house pages should contain meaningful information: current auctions · upcoming auctions · recent sales · categories represented · verified company information · links to original auctions. Do not generate a page containing only "Auction House Name / View Website" and expect it to rank.

## 46. SOLD ITEM STRATEGY

Do not automatically delete historically useful sold-item pages. Sold artifacts can have significant long-term research and valuation value. If a sold page contains useful historical information: retain page · mark SOLD · remove purchase CTA · add comparable sales · add related inventory · preserve research.

## 47. DISCONTINUED THIN LISTINGS

If an expired listing has no unique historical or research value: consider `410 Gone`, or `301` to a highly relevant replacement, or removal from the index. Do not redirect every discontinued artifact to the homepage.

## 48. SOFT 404 PREVENTION

An unavailable page that says "This item is no longer available." but otherwise contains virtually nothing should not return HTTP 200 indefinitely. Develop a proper lifecycle strategy.

## 49. AUTOMATIC INDEX CLEANUP

Create an SEO maintenance worker. Periodically identify: empty categories · thin pages · orphan pages · dead sources · duplicate URLs · canonical conflicts · expired searches · zero-result pages · bad pagination · soft 404 candidates · broken dealer links. Create an admin review queue.

## 50. INDEX BLOAT DASHBOARD

Build an admin dashboard showing: TOTAL PUBLIC URLS · INDEXABLE URLS · NOINDEX URLS · CANONICALIZED URLS · 404 URLs · 410 URLs · REDIRECTS · INDEXABLE CATEGORIES · INDEXABLE ITEM PAGES · INDEXABLE RESEARCH PAGES · INDEXABLE DEALER PAGES. Also track week-over-week change.

## 51. INDEX GROWTH ALERTS

Alert administrators if indexable page counts unexpectedly increase:

```text
WARNING
Indexable URLs increased 28% in 24 hours.
Cause: new faceted-navigation route
Review before sitemap submission.
```

## 52. DUPLICATE CONTENT DETECTION

Develop internal similarity testing. Check for pages that have extremely similar titles, H1 headings, descriptions, body text, item lists. Flag them before large-scale publication.

## 53. TITLE TAGS

Generate concise, accurate title tags, e.g. "Civil War Belt Plates & Buckles for Sale | Relics of War" · "Colt Model 1860 Army Price Guide | Relics of War" · "Civil War Firearms at Auction | Relics of War". Do not keyword-stuff.

## 54. META DESCRIPTIONS

Generate useful descriptions. Do not mass-insert identical descriptions. Do not create awkward keyword lists. Describe what the visitor will actually find.

## 55. HEADINGS

Use one clear primary H1. Maintain logical hierarchy H1 → H2 → H3. Do not stuff headings with repeated synonyms.

## 56. ENTITY CONSISTENCY

Use consistent names for firearm models, makers, manufacturers, battles, military units, dealers, auction houses, wars, artifact types. Tie the system to ArtifactSearch's controlled vocabulary.

## 57. BREADCRUMBS

Implement useful breadcrumbs (Home > Civil War > Firearms > Revolvers > Colt Model 1860 Army). Use appropriate structured data when valid.

## 58. INTERNAL LINKING

Create contextual links that help collectors navigate (Colt Model 1860 Army → Civil War Revolvers → Colt Firearms → .44-Caliber Revolvers → Comparable Sales → Identification Guide). Do not create huge hidden blocks of keyword links.

## 59. ORPHAN-PAGE DETECTION

Every indexable page should have a legitimate path through site navigation or contextual internal links. Create a crawler to detect indexable pages receiving zero internal links. Flag these as SEO ORPHAN.

## 60. HTML SITE ARCHITECTURE

Important pages should be reachable within relatively few clicks: Home → Era / Category → Subcategory → Artifact / Guide. Avoid excessively deep navigation.

## 61. TOP 25 CATEGORY SEO RULE

The dynamic Top 25 system must NOT cause URLs to disappear merely because a category falls from Rank 24 to Rank 28. Top 25 controls homepage prominence. It does not automatically control index existence. Separate POPULARITY from INDEXABILITY.

## 62. HISTORICAL AUTHORITY CONTENT

High-value pages should include, where appropriate: correct nomenclature · historical period · military use · manufacturing information · variations · markings · inspection marks · dimensions · ammunition/caliber · materials · provenance considerations · authentication considerations · known reproductions · collector terminology · comparable examples · documented references. Factual, original, useful.

## 63. SOURCE TRANSPARENCY

When historical or valuation claims are made, provide sources where appropriate: Official Records · Ordnance Manuals · Period Catalogs · Manufacturer Records · Museum Collections · Auction Archives · Published Reference Works. Do not invent citations.

## 64. EXPERTISE AND TRUST

Build clear site-level pages: About Relics of War · Editorial Standards · Research Standards · How Prices Are Calculated · How Marketplace Listings Work · How Dealer Data Is Collected · Corrections Policy · Contact · Privacy Policy · Terms of Use.

## 65. PRICE-GUIDE METHODOLOGY

Create a substantial public page: **How the Relics of War Price Guide Works**. Explain data sources · comparability · auction premiums · dealer asking prices · sold prices · condition differences · sample-size limits · date ranges · methodology · limitations. Never imply greater precision than the data supports.

## 66. SEO CONTENT SHOULD SERVE COLLECTORS FIRST

Before publishing an SEO-targeted page ask: "Would this page still be worth creating if Google did not exist?" If NO, reconsider whether it should exist.

## 67. NO DOORWAY-PAGE STRATEGY

Do not create nearly identical pages targeting minor keyword or geographic variations merely to send users to the same inventory (Civil War Relics Georgia / Atlanta / North Georgia / Georgia for Sale).

## 68. NO KEYWORD STUFFING

Write naturally for knowledgeable collectors.

## 69. NO HIDDEN SEO CONTENT

No hidden text · white-on-white keywords · offscreen keyword blocks · CSS-hidden SEO paragraphs · crawler-only descriptions. Users and search engines should receive substantially the same meaningful content.

## 70. NO CLOAKING

Never serve substantially different page content based on whether the visitor is Googlebot, Bingbot, or a human visitor, except normal legitimate technical adaptations.

## 71. SECURITY AND SEARCH SPAM

Monitor for hacked-content spam. Implement dependency scanning · malware monitoring · admin authentication · rate limiting · CSP where practical · security headers · audit logging · suspicious account monitoring. Watch for unauthorized pages appearing under RelicsOfWar.com.

## 72. USER-GENERATED CONTENT

If dealer accounts, comments, uploads, or user profiles are later introduced: do not automatically index untrusted user-created content. Use moderation. Consider `noindex` until content or accounts meet trust thresholds. Prevent spam accounts from generating thousands of indexable pages.

## 73. SEO MONITORING SYSTEM

Build an SEO monitoring dashboard combining Google Search Console data · Bing Webmaster data · Core Web Vitals · index counts · sitemap health · 404s · canonical issues · search impressions · search clicks · CTR · average position · organic landing pages — where APIs and permissions permit.

## 74. SEARCH-ENGINE TRAFFIC ANOMALY DETECTION

Alerts for: organic traffic −30% · indexed pages +200% · indexed pages −40% · crawled-not-indexed +300% · 404 rate +100% · Core Web Vitals failure · structured-data error spike. Do not make automatic destructive SEO changes based solely on these alerts. Flag them for review.

## 75. SEO RELEASE CHECKLIST

Before major production releases automatically test: robots.txt · sitemap.xml · canonical tags · robots meta tags · HTTP response codes · redirect loops · structured data · page titles · meta descriptions · H1 tags · pagination · internal links · mobile rendering · Core Web Vitals · JavaScript errors · broken images · broken outbound links · cross-domain canonical rules. Block deployment for severe SEO errors.

## 76. STAGING ENVIRONMENT PROTECTION

All staging, development, preview, and test environments (staging.relicsofwar.com, preview.relicsofwar.com, development builds, pull-request previews) must be protected from search-engine indexing. Use appropriate authentication and/or noindex controls. Never accidentally allow staging sites to become indexed.

## 77. PRODUCTION LAUNCH SEQUENCE

Do not release 100,000+ new indexable pages on day one. Use a controlled rollout:

* **Phase 1** — Core site · Major categories · Price guides · Best research pages
* **Phase 2** — High-quality subcategories · Dealer pages · Auction pages
* **Phase 3** — Selected research-enhanced artifact pages
* **Phase 4** — Additional pages that pass SEO quality thresholds

Monitor indexing and quality between phases.

## 78. SEO QUALITY OVER QUANTITY

Track: indexed pages generating impressions · indexed pages generating clicks · organic conversions · quality inbound links · return visitors · collector engagement. Do not celebrate merely "number of pages indexed." 20,000 excellent pages beat 2,000,000 thin pages.

## 79. IMPORTANT ARTIFACTSEARCH / RELICSOFWAR PRINCIPLE

The two sites should be complementary. ARTIFACTSEARCH.COM = comprehensive marketplace/search engine. RELICSOFWAR.COM = curated discovery + identification + research + valuation. This distinction should be evident to visitors, Google, Bing, AI search systems, dealers, and auction companies.

## 80. FINAL SEO RULE

Before allowing any dynamically generated page to become indexable, ask:

```text
1. Is this page meaningfully different from ArtifactSearch?
2. Does it provide substantial collector value?
3. Is the information accurate?
4. Does it contain enough useful content?
5. Is it internally linked?
6. Does it have a clear canonical?
7. Is it free of duplicate URL variants?
8. Does the user benefit from finding this page in Google or Bing?
9. Would we deliberately publish this page for collectors even without SEO?
10. Are we confident this page does not exist primarily to manipulate search rankings?
```

If these conditions are not met: **DO NOT INDEX THE PAGE.**

## FINAL OBJECTIVE

RelicsOfWar.com should become a large website because it contains a large amount of genuinely useful military-antique information. It should not look large because software generated millions of keyword pages.

**Build authority first. Let index growth follow authority.**

ArtifactSearch provides the data infrastructure. RelicsOfWar transforms selected portions of that data into a genuinely different, useful, research-oriented collector experience. SEO should be the consequence of creating that value, not the reason low-value pages exist.
