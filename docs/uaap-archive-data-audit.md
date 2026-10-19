# UAAP archive data audit

Inspected 19 October 2026. Scope: the local `data/` folder and archive-loading
code. Live Supabase overrides were not fetched, so the counts below describe
local files rather than a certified snapshot of the deployed page.

The [selection protocol](uaap-archive-statistics-protocol.md) defines which
records may be displayed. The [machine-readable inventory](uaap-archive-source-inventory.json)
records this audit's source PDF hashes and counts.

## Method and limits

- Enumerated season directories, source images, transcripts, structured JSON,
  base archive JSON, local overrides, compiled CSV, and every PDF under `data/`.
- Extracted text from all 1,601 physical PDF pages: 1,519 across seven season
  reports and 82 in the generated standings compendium. All pages yielded text.
- Compared source sections with stored records and inspected ten rendered PDF
  pages covering all seven seasons. Cross-checked three original photos for
  basketball leaders, award contamination, and Chess contradictions.
- This is a coverage and risk audit, not a cell-by-cell certification of every
  stored row. None of the candidate counts below imply publication approval.

## Stored seasons and coverage

"Source pages" counts matching image/transcript pairs, excluding `.gitkeep`,
Apple `.AAE` sidecars and `.MOV` files. "Groups" counts literal
season/sport/division labels before alias normalization, stage validation, or
deduplication. Sports counts include General Championship where present.

| Season | Source pages | PDF physical pages | Base rows | Base groups | Base sports | Compiled rows / groups |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1987-1988 | 41 | 97 | 98 | 15 | 9 | 125 / 20 |
| 1988-1989 | 71 | 230 | 82 | 11 | 8 | 103 / 16 |
| 1989-1990 | 30 | 60 | 33 | 5 | 5 | 91 / 14 |
| 1998-1999 | 98 | 177 | 148 | 23 | 13 | 198 / 31 |
| 1999-2000 | 90 | 163 | 171 | 22 | 12 | 176 / 27 |
| 2000-2001 | 220 | 377 | 120 | 18 | 11 | 158 / 25 |
| 2003-2004 | 201 | 415 | 123 | 20 | 11 | 188 / 30 |
| **Seven-season total** | **751** | **1,519** | **775** | **114** | - | **1,039 / 163** |
| 2002-2003 placeholder | 0 | 0 | 0 | 0 | 0 | 0 / 0 |

All 751 source images have matching `digital_pages/IMG_*.md` files. This only
establishes correspondence within the local collection, not completeness of the
original annual reports. Physical PDF pagination differs from the logical
source-page numbering because source pages can overflow onto multiple PDF pages.

The compiled CSV contains broader candidate coverage than the base JSON. Its
additional groups must still be checked for aliases, duplicates and extraction
errors; the difference does not equal a verified count of missing tournaments.

## What the current archive actually loads

| File/layer | Present data | Role |
| --- | --- | --- |
| `data/uaap_standings.json` | 775 rows, 114 raw groups; every row labeled `Final Standings` | Public archive's base standings |
| `data/uaap_archive_extras.json` | 45 sport-season award keys, 6 Chess medalist keys, 1 Basketball leaderboard key; `games` is empty | Public archive's base extras; key counts are not division or athlete counts |
| `data/uaap_admin_overrides.json` | 2 local legacy standings override groups | Read-only fallback for older admin edits |
| Supabase override tables | Not read in this audit | Can replace or delete base divisions and override awards/Chess data at runtime |
| `data/structured/` | 124 JSON files: 63 sport standings, 45 awards, 6 board medalists, 5 overall standings, 4 player-stat files, 1 leaderboard | Extraction candidates; not directly loaded by `/uaap` |
| `data/compiled/uaap_standings_master.csv` | 1,039 rows, 163 raw groups | Generated import candidates; not directly loaded by `/uaap` |
| Season PDFs and generated compendium | Seven rendered reports plus an 82-page compendium | Reading aids; not independent verification of their source transcriptions |

The loader is [lib/uaap-data.ts](../lib/uaap-data.ts); the public view is
[UAAPArchiveView.tsx](../components/uaap/UAAPArchiveView.tsx). Current merge
precedence is base records, legacy standings overrides, table overrides, then
deleted divisions. Versioned database rows are layered into the override data.

The view supports Standings, Awards and Leaders, with dynamic table columns.
It has no game-results or detailed player-stat display. Its season/division
options come from standings tables. Its leaderboards are selected by
sport-season and render all contained divisions, rather than filtering the
selected division. Leader entries are limited with `.slice(0, 10)`.

## Findings affecting publication

### 1. Derived files agree with each other without establishing accuracy

759 of the 775 base rows use the generic source `UAAP Annual Report`. The other
16 use manual-entry source labels. A precise source image/table is usually
missing. The season PDFs are typeset transcriptions, and the compendium derives
from compiled material. Repetition across these outputs is not corroboration.
The compendium's claims of verification should not be treated as review evidence.

### 2. Standings need source reconciliation

- **1998-1999 Men's Basketball:** base JSON ranks UP second and FEU third.
  [IMG_1312](../data/seasons/1998-1999/digital_pages/IMG_1312.md), PDF physical
  page 35, lists DLSU champion, FEU runner-up, UE third, UST fourth and UP fifth.
  The same page separately prints W/L after two rounds. Fix final placement and
  keep that W/L scope explicit before publishing a replacement table.
- **2000-2001 Men's Fencing:** base JSON ranks UP first and UE sixth.
  [IMG_1145](../data/seasons/2000-2001/digital_pages/IMG_1145.md), PDF page 103,
  prints UE first and UP second, alongside G/S/B columns. This is a rank conflict,
  not merely a missing optional medal column.
- Repeated school codes occur within six base season/sport/division groups:
  1987-1988 Baseball Men's (UP), 1987-1988 Chess Juniors (ADU), 1988-1989
  Basketball Juniors (UP and NU), 1988-1989 Football Men's (five schools), and
  both 1999-2000 Judo divisions. Review source event/stage boundaries before
  deduplicating; repeated schools can indicate event results mixed into team
  standings rather than identical duplicate rows.

### 3. A photographed page can contain unrelated text showing through

The Women's Badminton awards under `Badminton|1998-1999` name Don Carlos Ailado
and Jose Enrico Villanueva. The transcription of
[IMG_1311](../data/seasons/1998-1999/digital_pages/IMG_1311.md), PDF page 33 onward,
includes these awards after badminton results. Inspection of the original photo
shows the award text faintly showing through the paper, together with basketball
text. The adjacent Basketball source IMG_1312 explicitly prints Don Carlos
Allado and Jose Enrico Villanueva as its awards. Hold the badminton award claims;
do not attribute every legible word in a photo to its foreground section.

### 4. The Basketball leader category is demonstrably mislabeled

In both the structured file and base extras, `Basketball|2003-2004` / `men` /
`three_point_pct` begins with Mark Cardona, value `17.9`, total `232`, GP `13`.
[IMG_0601](../data/seasons/2003-2004/digital_pages/IMG_0601.md), PDF page 67 onward,
and the original photo show a multi-statistic scoring table with 232 total and
17.9 average; his 3-point entry is 12/42, 28.6%. A separate printed 3-point
percentage table starts with Tyrone Tang, 12/28, 42.9%, with a minimum of 12
makes. Rebuild category-to-heading mapping; simply relabeling all existing
leader data would not validate the other categories or their scope.

### 5. Player-stat files cannot yet support automatic averages

| Basketball season file | Extracted rows labeled players | Rows with GP=0 | Consequence |
| --- | ---: | ---: | --- |
| 1988-1989 | 2,246 | 2,246 | Appears to include individual game-scoring records; not a verified season-player table |
| 1999-2000 | 95 | 0 | Positive denominators alone do not establish full roster/stage coverage |
| 2000-2001 | 272 | 17 | Validate scope, identity and missing denominators |
| 2003-2004 | 166 | 166 | Contains rows named `Ave`; totals/average rows were misclassified as players |

These files are in `data/structured/basketball/player_stats/` and are not loaded
by the public archive. GP=0 must not become a divisor, and summary rows must not
be displayed as athletes. In the PDF render of 1999-2000 IMG_0966 (page 12), the
right side of the wide table is clipped; original photos are needed for QA.
The same clipping occurs in the 2003-2004 IMG_0601 render.

### 6. Chess lost metadata and contains a conflict in the original source

The 2003-2004 Juniors board-medalist extraction retains five names and schools
but no board, medal, score, games or percentage. The source
[IMG_0681](../data/seasons/2003-2004/digital_pages/IMG_0681.md), PDF page 220 onward,
prints six board rows. The current helper can infer board numbers from array
position; this must not stand in for recovered source board identifiers.

The original photo itself also contains conflicting final-place and points
lists, and prints John Queseng's 5/5 as 100.66%. This is not solely an OCR error.
Hold the affected placement/percentage claims pending documented resolution;
do not silently change the printed percentage or infer a medal color merely
from a list's order.

### 7. Important source material is absent from the base archive

Neither Swimming nor Track and Field appears as a sport in the 775 base rows.
Examples of recoverable candidates include:

| Season/source | Material available | Caution |
| --- | --- | --- |
| 1987-1988 IMG_0894 and IMG_0896 | Sport champions/co-champions and General Championship contribution points | Contribution points are not the underlying sport scores |
| 1988-1989 IMG_0791 | Swimming/athletics champions in the season's team-standing summary | Champion-only evidence does not establish full standings |
| 1989-1990 IMG_0889, PDF page 59 | Swimming Men's/Women's/Boys placements and a 1500m men's final with times | Preserve event and division; source coverage may be partial |
| 1989-1990 IMG_0877 / IMG_0879 | Chess placements and board distinctions | No corresponding Chess base standings/medalist key for this season |
| 1998-1999 IMG_1377 | Junior scoreboard alongside athletics material | Separate the scoreboard's sport-allocation points from athletics results |
| 1999-2000 IMG_1041 | Junior scoreboard including Swimming and Athletics | Does not supply event times or automatically establish complete sport standings |
| 2000-2001 IMG_1224 / IMG_1232 | Men's/Women's volleyball skill rankings | Determine actual round/match/set scope; some lists cover only selected teams |
| 2003-2004 IMG_0687 | Fencing medal summary | Preserve the printed final team rank and source blanks |

## Implementation backlog

Apply the protocol to candidate data before broadening the public archive:

1. Add block-level provenance and explicit review decisions; prevent unreviewed
   imports from becoming eligible solely because they contain values.
2. Reconcile the known standings/award/leader conflicts, starting with the
   examples above. Preserve source evidence and overrides' correction history.
3. Distinguish stage, event and statistic basis in staging and persistence.
   Current division keys omit stage, so multiple phases can collapse together.
4. Filter extras by selected division and verified non-empty categories;
   include ties at the leaderboard cutoff and retain qualification notes.
5. Recover board/event identifiers, support medal/decimal/time profiles, and
   make verified awards-only or leaders-only divisions discoverable.
6. Add source-backed Swimming/athletics coverage and detailed results only as
   those blocks pass review. Do not treat generated CSV rows as ready imports.

Future regression checks should include: final places kept separate from
two-round W/L; the Cardona scoring/3PT category distinction; no show-through
badminton awards; no GP=0 averages or `Ave` athletes; no fabricated Chess board
numbers; no Men's leaders under Women's; tied tenth-place entries retained;
nulls distinguished from zero; and explicit co-champions preserved.

No public data, parsers, UI, or database records were changed by this audit.
