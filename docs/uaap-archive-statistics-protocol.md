# UAAP archive statistics selection protocol

Version 1.0 - 19 October 2026

Implementation status: the [review validation](uaap-archive-review-validation.md)
documents the canonical dataset, source checks, publication gates and editor
review workflow now implementing this protocol. The original inventory remains
a snapshot of the files before those corrections.

The archive should first answer **who finished where**, then **how the result
was achieved**, then **which athletes earned distinctions or led a statistic**.
Choose statistics separately for each season, sport, division, and competition
stage. A statistic qualifies through source verification, not merely because
an extraction script populated a field.

This is the publication protocol for future archive curation and implementation.
It does not itself change the public page or certify the existing datasets.
The [data audit](uaap-archive-data-audit.md) records the evidence and current
problems; the [inventory snapshot](uaap-archive-source-inventory.json) records
the counts and PDF fingerprints used in that audit.

## 1. Define the record being selected

Use this identity before matching, ranking, or merging any records:

`season | sport | division | stage | event-or-category | statistic | basis`

For team standings, add the school identifier. For individual records, add the
athlete identifier and school; for games, add the match identifier. `basis`
distinguishes a total, per-game average, per-set average, percentage, time,
distance, or championship points. Board number and weight class are event
identifiers, not ranks.

- Keep Men's, Women's, Boys, Girls, Juniors, and Collegiate separate. Normalize
  spelling variants such as Junior/Juniors. Map Seniors to Men's only when the
  section establishes that meaning. Do not automatically equate Boys with all
  Juniors, or a junior school with its collegiate parent.
- Preserve the source's school name alongside a canonical code. Resolve `AdU`
  and `ADU` as Adamson; retain source-specific junior affiliations.
- Resolve season and sport from the section and surrounding pages. A filename,
  isolated heading, or the word "overall" is insufficient: badminton's
  "Over-All Standing" is not the General Championship.
- Keep exhibition results separate from championship competitions.
- An absent season or sport means **no verified record available**, not that
  the competition did not take place.

## 2. Establish the source and record provenance

Read in this order:

1. The original report photo in `data/seasons/<season>/raw_photos/`, including
   the full page, adjacent section headings, captions, and footnotes.
2. The corresponding `digital_pages/IMG_*.md` transcription and season PDF.
3. Structured JSON, compiled CSV/Excel, paste packs, and compendia as extraction
   candidates to compare against the source.

The season PDFs are rendered transcriptions. Agreement between a PDF and its
Markdown is not independent confirmation. Some wide PDF tables are clipped;
use the original photo to recover headers and rightmost columns. Exclude faint
reverse-page text, crossed-out material, and unrelated adjacent sections.

A documented correction or erratum may supersede the report; retain both the
original value and correction evidence. An admin override takes precedence in
the current application's merge, but that precedence alone does not establish
historical accuracy. Review the effective merged record before publication.

For every proposed table or category, record:

| Field | Required content |
| --- | --- |
| Identity | Season, sport, division, stage, event/category, statistic, basis |
| Source | Report path, original image ID, source section/table heading |
| Locator | PDF physical page (1-based) and printed/logical page if available; keep them separate |
| Meaning | Unit, period covered, qualification rule, source ranking rule |
| Extraction | Input path, original text/value, normalized value, extractor/version if applicable |
| Coverage | Expected rows from the source, extracted rows, verified rows, missing fields |
| Decision | `needs_review`, `verified`, `blocked`, or `source_missing`, with reason |
| Review | Reviewer, review date, source fingerprint, correction history |

One table-level reference is sufficient only if every row shares that source.
Attach row/cell references when combining pages. A label such as "UAAP Annual
Report" or "Manual Entry" alone is insufficient for verification.

## 3. Apply the publication gates

Evaluate each table, award, and leader category independently. Every displayed
non-null value must be verified against the original source, including the
heading, unit, athlete/school, division, and stage.

| Gate | Pass condition | Failure action |
| --- | --- | --- |
| Identity | Season, sport, division, event and period established | Hold the affected block |
| Source | Legible source and precise locator recorded | Hold the affected block |
| Meaning | Statistic, unit, denominator and qualification understood | Hold that statistic |
| Extraction | All intended source rows captured once; all published cells checked | Repair extraction before release |
| Consistency | No unresolved identity, rank, arithmetic or source conflict affecting the claim | Block the affected claim and record the conflict |
| Review | A named reviewer records a decision and date | Keep as `needs_review` |

Distinguish **extraction completeness** from **source completeness**. A source
that prints only the champion can support a champion card, but not a complete
standings table. A source that prints ten leaders can support "Published top
10," without implying that a full player dataset exists.

Preserve legitimate source blanks as null and display an em dash. Never replace
unknown, unreadable, or unreported values with zero. Zero is publishable only
when the source or an explicit source convention establishes it. Hide a numeric
column when all its cells are null. A partly populated column may appear with
"Records available for X of Y listed teams" after every populated cell is
verified; do not use it to rank the teams with missing values.

Do not resolve a contradiction through majority voting among derived files,
by choosing the larger total, or by silently recalculating the source. Record
the conflict; hold the affected statistic until an erratum or documented review
resolves it. Independent, verified fields may still be published.

## 4. Choose the display in a fixed priority order

Only blocks that pass the gates enter this ordering. A higher-priority blocked
block does not prevent an independent lower-priority verified block appearing.

| Priority | Display | Selection rule |
| --- | --- | --- |
| 1 | Champion(s) and final standings | Explicit final placements for the selected competition; champion-only card if that is all the source reports |
| 2 | Supporting team statistics | Only source-supported columns appropriate to that tournament: W/L, draws, points or medals; identify their stage |
| 3 | Individual awards and medalists | MVP, Rookie of the Year, named all-star selections, sport awards, board/event/weight-class medalists |
| 4 | Published statistical leaders | A verified category with a defined unit, population, period, qualification and ranking |
| 5 | Detailed player/team statistics and game results | Complete source blocks with stable identities and a supported display; preserve partial scope explicitly |

Use **Standings** as the default when verified final standings exist. If only
awards or leaders are verified, make those independently discoverable. Never
invent a standings row to unlock a season or division in navigation.

Show Awards and Leaders only when the selected division has at least one
verified, non-empty block. A populated category in Men's must not expose an
empty Women's tab or display Men's records under a Women's selection. Keep the
full qualifier and source accessible beside every displayed block.

Preserve official final order, ties and co-champions. Never infer the champion
from the first array element, the best W/L record, or the highest general-
championship allocation. Do not infer silver/bronze medals from second/third
team place unless the source explicitly awards those medals.

## 5. Select columns according to the source's scoring system

These are candidate profiles, not a declaration that every listed statistic
exists in every stored season.

| Competition/source type | Primary display | Optional verified detail | Prohibited shortcut |
| --- | --- | --- | --- |
| General Championship | Rank, school, total championship points | Per-sport contribution breakdown | Treating allocation points as sport scores, W/L or a universal cross-era points system |
| Basketball | Final place and school | Stage-specific W/L; scoring, rebounds, assists, steals, blocks, shooting percentages | Rebuilding averages from unknown GP or mixing elimination and postseason totals |
| Volleyball | Final place and school | Round W/L; sets/points when reported; scorer, attacker, blocker, server, setter, digger, receiver categories | Treating attack percentage, efficiency and success per set as interchangeable |
| Football | Final place and school | W/D/L, competition points, GF/GA/GD when reported | Applying a modern points-for-a-win rule to an undocumented season |
| Baseball / Softball | Final place and school | Stage W/L, runs, published batting/pitching categories and awards | Treating a "Batting Champion" award as a numeric batting-average leaderboard |
| Badminton / Lawn Tennis / Table Tennis | Final place and school | Team-tie W/L; individual match/game/set details under their own scope | Counting individual rubbers or sets as team wins |
| Chess | Final place, school, reported chess points | Tiebreaks, board number, board score/games and explicitly awarded medals | Converting chess points to W/L or assigning board numbers from array positions |
| Fencing / Judo / Tae Kwon Do | Official team rank, school; G/S/B or points if reported | Event/weapon/weight-class results and named awards | Re-ranking by medals when the source's team ranking uses different rules |
| Swimming / Track and Field | Official team place/points when available | Event, division, distance/stroke, athlete, time/distance, result status, source medal | Pooling heats and finals or comparing unlike distances, strokes or units |
| Placement-only source | Place, school, result note | Explicit co-champion/tie/partial-coverage annotation | Inventing W/L, points, medals or missing placements |

Choose one primary scoring profile for each team table. Combine points, medals,
or W/L only when their meanings and competition stages are explicitly known.
When only final place is established, placement-only is the valid fallback.

### Final placement and round records

A page can print final placements and "win-loss record after two rounds" in
separate sections. Keep them as two stage-specific blocks, or put an explicit
"W/L after two rounds" heading and source note over those columns. Do not label
those records as a final-season W/L total. A final placement must never be
re-sorted by its accompanying elimination record.

The current `makeDivisionKey`/legacy conversion groups by season, sport and
division without stage. Keep multi-stage candidates separate in staging until
that limitation is addressed or use a reviewed single table with explicit
column scope and notes.

### Derived statistics and precision

- Win percentage: `W / (W + L)` only when W and L are known, the denominator is
  positive, and the competition scope has no excluded draws or other outcomes.
  Label it calculated and use three decimals. Preserve the official rank.
- Per-game/per-set averages: require verified totals and a positive, matching
  denominator. Do not borrow GP or sets from another category or stage.
- Shooting percentages: require made and attempted counts from the same scope;
  `100 * made / attempted`, with attempted > 0. Preserve source qualification
  rules. Weighted totals require sums of makes/attempts, not averages of rates.
- Preserve half-points in chess and decimal championship points. Preserve the
  source's time/distance format and reported precision; do not apply the current
  generic three-decimal formatting to every sport.
- Flag impossible or inconsistent values, including made > attempted, a rate
  over 100%, or a total incompatible with its components. Printed errors remain
  part of the source record; they do not become silently corrected public data.

## 6. Choose leader categories and entries

1. Match the printed category heading to an explicit statistic identifier and
   unit. Do not classify a multi-statistic table by whichever heading keyword
   appears last or by the last numeric column alone.
2. Preserve the published list's rank/order and qualification footnote. If the
   source specifies minimum makes, do not replace it with minimum attempts.
   If no qualifying rule is available, label it "Published leaders; qualification
   not stated" and do not manufacture a league-wide ranking from partial rows.
3. If calculating a new leaderboard, require the full eligible population,
   an explicit reviewed qualification rule, a consistent scope, and the required
   denominators. Label that result calculated rather than an official award.
4. Default to ten entries per category, or every entry if fewer were published;
   include all entries tied at the cutoff. Do not use array slicing that drops
   an official tie. Preserve the source's tie-ranking convention.
5. For a supplied ranking with incomplete or conflicting values, hold the
   affected category; never promote the next athlete by silently deleting a row.
6. Order eligible basketball categories as scoring average, rebounds, assists,
   steals, blocks, FG%, 3PT%, FT%, followed by other printed categories. Order
   volleyball categories as scorers, attackers, blockers, servers, setters,
   diggers, receivers. Use printed event/board/weight-class order elsewhere.
   Skip unavailable categories without borrowing data from another season.

## 7. Decisions for the currently stored years

All entries below are curation priorities, **not publication approvals**.

| Season | First selection after verification | Additional candidates / required work |
| --- | --- | --- |
| 1987-1988 | General Championship points and final team placements | Preserve co-champions from IMG_0894; reconcile duplicate school rows; review chess board distinctions |
| 1988-1989 | Final placements and the W/L explicitly printed with them | Review individual game-scoring records separately; the 2,246 player extraction rows all have GP=0 |
| 1989-1990 | General Championship and explicit sport placements | Recover source chess and swimming results absent from the base; scope swimming event times separately |
| 1998-1999 | Final placements, separately labeled round W/L, verified awards | Fix Men's basketball order; remove reverse-page award contamination from badminton candidates; review swimming/athletics sources |
| 1999-2000 | Final placements and applicable points/W/L profiles | Split duplicate Judo event/weight-class rows from team standings; verify player totals and denominators before averages |
| 2000-2001 | Final placements, Fencing medal tally and source-specific team records | Resolve Fencing rank disagreement; extract volleyball skill lists with their actual match/set scope; review basketball rows |
| 2003-2004 | Final placements and verified awards | Rebuild mislabeled basketball leader categories; resolve Chess source conflicts and missing board metadata before release |
| 2002-2003 | No selection | Empty placeholder: acquire source material before adding archive statistics |

Do not create "all-time" records from these seven nonconsecutive seasons.
Any aggregate must say "within the digitized seasons," list the included
seasons/divisions/stages, count co-champions explicitly, and exclude blocked
claims. Championship-points totals from different systems are not comparable
without a documented normalization method.

## 8. Curation and release procedure

1. Recount source images, transcripts and PDFs; compare the inventory snapshot.
   Record source changes before reusing a prior verification decision.
2. Build candidate blocks from the source sections. Compare base JSON,
   structured files, compiled tables and the effective admin overrides; identify
   omissions, duplicates, conflicts, and phase/category leakage.
3. Record the provenance fields and publication-gate decision for each block.
   Check every row and cell proposed for display, plus headings and footnotes.
4. Select the primary table profile and eligible extras with the priority rules
   above. Record why each candidate was chosen, held, or source-missing.
5. Preview the exact season/sport/division selection. Verify order, ties,
   columns, nulls, scope labels, sources, tab visibility and mobile overflow.
   A generic empty-object truthiness check is not a publication gate.
6. Apply reviewed changes through the versioned archive workflow. Retain the
   prior record, reviewer/date, and correction evidence; never overwrite a
   documented correction with a fresh unreviewed extraction.
7. Recheck the effective public data after saving, including remote overrides.
   Re-review affected blocks whenever their source, parser, mapping, or override
   changes. Unaffected verified blocks retain their decisions.

The implementation backlog and concrete examples that should become regression
checks are listed in the [audit](uaap-archive-data-audit.md#implementation-backlog).
