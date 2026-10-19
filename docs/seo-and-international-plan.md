# Sportsmetric search visibility and International plan

20 October 2026. Brand direction: **Philippine sports and Filipino individual
excellence**, including future coverage of athletes competing abroad. International
navigation and profiles are intentionally deferred until verified content is ready.

## Initial audit and implemented foundations

The live `/robots.txt` and `/sitemap.xml` returned 404; `/players` used the generic
Sportsmetric title and had no canonical link. League selections lacked dedicated
public URLs. These observations are a baseline, not a search ranking report.

The implementation adds:

- A canonical `https://www.sportsmetric.ph` origin, individual titles/descriptions,
  share metadata, and a generated 1200x630 share image.
- Crawlable UAAP basketball, PBA and PVL pages containing actual published current
  season scores, team records and links to player profiles. These reuse the same
  request data as the site layout. No invented results or fixed "updated today" labels.
  The initial shell resolves before HTML is sent, and the site-wide streamed
  loading boundary is removed so league pages remain visible without JavaScript.
  Existing in-page loading states still cover interactive league/season changes.
- A dynamic sitemap of public pages, valid team/player records, published news and
  source-checked archive selections. Profile indexing fetches only lightweight
  identifiers; it does not load private data or the entire game history. Transient
  database failures fail the sitemap request instead of silently dropping profiles.
- Distinct canonical URLs for archive sport/season/division/tab selections. Pending
  and withheld detail views carry noindex; they remain available to visitors.
- Native JSON-LD for the organization/site, breadcrumbs, athlete/team identities
  and articles. Data is escaped and scripts carry the site's CSP nonce. Membership
  in a Philippine league is not treated as evidence of Filipino nationality.
- Server checks for missing player/team records, with not-found/noindex behavior.
  Admin and API responses are excluded from indexing. Admin remains crawlable so
  Google can read noindex; authentication continues to protect the workspace.
- An About page explaining scope, review status and the planned International section.

The sitemap does not claim artificial last-modified dates. Article publication
dates are used when a real date exists. Private and draft pages, unreviewed archive
details, nonexistent profiles and planned International URLs are excluded. Preview
deployments use noindex.

Validation: 45 unit tests and 21 production-build browser checks passed,
including visible league records with JavaScript disabled, canonical URLs,
profile/article markup, nonce safety, sitemap exclusions and the share image.
Application lint and type checking passed, including the full `npm run check`.
During initial Search Console validation, we found unescaped query
ampersands in this Next version's sitemap serializer; the route now generates
escaped XML explicitly, with an additional strict regression check.

## Search intent and useful pages

| Search intent | Destination | Content requirement |
| --- | --- | --- |
| Philippine sports scores / stats | `/` | Useful scores, league links, clear scope |
| UAAP basketball scores / standings | `/leagues/uaap` | Current available results and records; archive link |
| PBA scores / stats | `/leagues/pba` | Conference context, scores, teams and athletes |
| PVL results / player stats | `/leagues/pvl` | Volleyball context, match results and athlete records |
| Athlete name + stats | `/players/<id>` | Actual name, team/season, game logs and performance |
| Team name + roster / results | `/teams/<id>` | Named team, season, roster and records |
| UAAP year + sport + division | Canonical `/uaap?...` selection | Source-checked table/awards/leaders with provenance |
| Filipino athletes overseas / international results | Future `/international` and `/athletes/<stable-slug>` | Verified athlete profiles and substantial competition-specific results |

## Search Console and release procedure

Release status (20 October 2026): the production URL-prefix property is verified
in the owner's approved Google account using the published HTML verification file
`public/googleeba863a372e019b7.html`. Keep that file available to retain verification.
The homepage was already indexed; its updated live test passed and Google accepted
a fresh indexing request into its priority crawl queue.

The corrected sitemap returned HTTP 200 directly, with `application/xml`, no
redirect or authentication requirement, and 3,802 public URLs at the final local
validation. Strict XML parsing passed; all URLs use the production origin and none
point to admin/API routes. URL inventory changes with published data. Google
accepted the resubmission, and its own live inspection reported **Crawl allowed:
Yes; Page fetch: Successful** at 02:01 Philippine time. The separate Sitemaps
report still showed **Unknown / Couldn't fetch**, no last-read date and zero
discovered pages at the last check. Successful sitemap processing is therefore
**not yet confirmed**. Recheck that report after Google's next processing attempt;
do not equate a submission receipt or a successful live fetch with sitemap parsing
or indexing of every URL. If the fetch error persists, use Google's documented
[sitemap fetch diagnostics](https://support.google.com/webmasters/answer/7451001#fetch_errors).

For future releases:

1. Verify the production property in Google Search Console in the owner's account.
   Ownership confirmation is a separate account action. If using an HTML meta tag,
   put the supplied token in `GOOGLE_SITE_VERIFICATION` and redeploy. Bing's optional
   equivalent is `BING_SITE_VERIFICATION`. Do not commit account credentials.
2. Submit `https://www.sportsmetric.ph/sitemap.xml`. Inspect the homepage, each league
   page, selected player profiles and a checked archive selection. Confirm Google's
   rendered page includes names, results, canonical URLs and structured data.
3. Check Page Indexing, Sitemaps and Core Web Vitals. Use URL Inspection to request
   indexing for the key pages after deployment. Submission is not a ranking guarantee.
4. Record a baseline for impressions, clicks, CTR and average position, split by
   query and destination page. Review weekly rather than promising a numerical rank
   without Search Console evidence. No automated monitoring is configured here.

## Content and authority work

Publish reliable, original material around the existing records: source-backed
season summaries, useful athlete profiles, explanatory statistics and documented
corrections. Give news real bylines, dates, competition context and direct sources.
Never fabricate matches, awards, statistics, freshness dates or review claims to
fill a keyword page. Seek relevant editorial mentions and links from schools,
teams, athletes and sports publications; do not buy ranking links or mass-generate
near-identical pages. Existing imports and archive review work remain separate
data-quality responsibilities.

## International content contract

The future hub will connect stable athlete identities to results across clubs,
countries and competition seasons. Keep nationality, heritage and the country
represented in an event separate, and cite reliable public evidence for each.
Do not assume Filipino nationality from a name, birthplace or Philippine club.

Each profile needs a stable ID/slug, public display name, sport/events, verified
Filipino connection, club/national-team history with dates, competition/season,
achievement or statistic with unit and denominator, qualification/ranking scope,
source links, source/review dates and visible coverage limitations. Distinguish
world rankings, tournament placements, records and awards. Keep career totals
separate from a single league or national-team season.

Launch the hub and add navigation/sitemap entries when those profiles exist.
Use one enduring athlete URL; where existing season-level player URLs represent
the same identity, plan reviewed redirects/canonicals before merging. Keep old
URLs working, avoid duplicate nationality landing pages, and measure real search
queries before expanding coverage.

Primary references: [Google's SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide),
[canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
and [article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).

## International section: implementation (preview)

Built 20 October 2026, intentionally unlaunched.

- Schema: `supabase/migrations/20261020000000_international.sql` adds `intl_athletes`,
  `intl_competitions` and `intl_results`, separate from the league tables. Athletes
  record the Filipino connection type with a required https source; each result has
  its own source, representation (country/club) and a typed figure: placement,
  mark + unit, ranking, stat line or award. Photos are optional but require an
  attributed credit, license/permission note and https source link
  (`20261020010300_intl_photo_credits.sql`), enforced by validation and a database
  CHECK constraint. RLS exposes only published athletes and published results of
  published athletes. Competitions with results cannot be deleted; deleting an
  athlete removes their results.
- Public pages: `/international` (top performers, latest results, sport/level filters,
  athletes) and `/athletes/<slug>` (connection, medal summary, results by year,
  sources, coverage notes, optional link to the Philippine league profile via
  `person_id`). Photo credit, license and source appear under any top-performer card
  that displays a portrait. Five Commons portraits ship in `public/athletes/` with
  their attribution; until the photo-credit migration is applied, the public reads
  fill them in from `lib/international-photos.ts`. After applying the migration,
  `npm run seed:intl-photos` copies the same credit, license and source into the
  athlete rows, which always take precedence over the bundled defaults.
- Admin: Workspace → International. Writes go through `/api/admin/mutate`
  (`intl.*` operations); drafts load from the authenticated `/api/admin/international`.
- Launch switch: `INTERNATIONAL_LAUNCHED` in `lib/international.ts`. While false the
  pages render with noindex and a preview notice, and are excluded from navigation
  and the sitemap. When true they join the nav and sitemap; athlete pages index only
  if they have at least one published result.

To launch: apply the migration, enter and publish verified profiles, set the switch
to true, update the About page wording and the sitemap browser test (which currently
asserts no `/international` URLs), then request indexing in Search Console.
