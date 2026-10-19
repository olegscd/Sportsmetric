# Independent validation of the supplied DeepSeek review

19 October 2026. This follow-up validates the supplied review against the local
data and original photos, and records the implemented repairs. The earlier
[data audit](uaap-archive-data-audit.md) and inventory remain historical snapshots
of the pre-correction dataset. Production Supabase records were not changed.

## Verdict and qualifications

The central finding is correct: the storage and override architecture supports
curation, but the original extracted statistics contain substantial errors.
The numerical quality ratings are judgments, not measurements of an established
error rate.

Independent counts reproduce **105 sport-standings tables / 705 rows** when
excluding General Championship. Including the overall-standings files gives
112 tables / 759 rows. There are 55 sport tables with W/L, **12 with points but
no W/L**, and 38 with neither. Calling all 50 tables without W/L "placement-only"
is therefore inaccurate.

The legacy extras contain 105 MVP/ROTY objects, of which five have blank player
names, leaving 100 named person-awards. The reported "44 of 100" sport-page
screening result was not independently reproduced as a certified error count.
Matching a name somewhere in a PDF is not enough to verify an award's sport,
division, year, or foreground-page origin. The claimed comparison percentages
also depend on how multi-division pages and ambiguous source blocks were matched.
They should be treated as screening results, not a measured accuracy percentage.

Two more qualifications affect the proposed fixes:

- The Women's Badminton source IMG_1303 names **Kennie C. Asuncion (UP)**.
  **Kennevic C. Asuncion** belongs to the Men's source IMG_1292. The review's
  proposed Women's replacement conflated the two; the implemented correction
  follows the actual Women's photo.
- Ranks do not have to be unique. Explicit co-champions and ties must survive
  validation. Equal win counts alone are suspicious in some contexts, not a
  universal proof of an invalid table. Teams can also play unequal numbers of
  games; W+L is checked against an explicit games column rather than a presumed
  universal schedule.

## Confirmed repairs

The following replacement blocks were checked against the original photos,
not approved merely because a PDF and its transcription agreed:

| Competition | Implemented correction | Original source |
| --- | --- | --- |
| 1988-1989 Basketball Men's | Verified final order and printed W/L | IMG_0794 |
| 1988-1989 Volleyball Men's/Women's | Corrected division mapping, recovered Women's table, and corrected W/L transcription errors in both divisions | IMG_0846 |
| 1989-1990 Volleyball Men's | UST, UP, FEU, ADU, DLSU, NU, UE, ADMU; conflicting W/L withheld | IMG_0869 |
| 1998-1999 Basketball Men's | Corrected final order; labeled W/L as after two rounds; Allado MVP and Villanueva ROTY | IMG_1312 |
| 1998-1999 Badminton Women's | Corrected final table and Kennie Asuncion MVP; removed basketball show-through awards | IMG_1303; contamination checked against IMG_1311 |
| 1998-1999 Football Men's | Six teams in the correct order, with printed W/D/L/GF/GA/GD/points; no draw-excluding PCT | IMG_1329 |
| 1999-2000 Judo Men's/Women's | Six final team rows each; individual match/weight-class results no longer masquerade as team standings | IMG_0998, IMG_1002 |
| 2000-2001 Basketball Men's/Women's/Juniors | Corrected final orders; recovered missing division; removed unsupported constant W/L; recovered MVP/ROTY | IMG_1123, IMG_1127, IMG_1130 |
| 2000-2001 Fencing Men's/Women's | Corrected printed ranks and medal counts; preserved blank cells | IMG_1145 |
| 2003-2004 Basketball Men's/Women's/Juniors | Corrected/recovered final standings, MVP/ROTY and mythical selections | IMG_0592, IMG_0593, IMG_0594 |
| 2003-2004 Basketball leaders | Separated scoring average from the actual qualified 3PT% list; preserved printed values and minimum-makes rule | IMG_0601 |
| 2003-2004 Chess Juniors | Recovered six explicit board identifiers and gold distinctions; conflicting team placements and erroneous printed percentages remain withheld | IMG_0681 |
| 1987-1988 Swimming and Track and Field | Added source-backed champion-only records for Men's/Women's/Juniors | IMG_0894 |
| 1987-1988 Lawn Tennis Men's | Preserved ADU and UST as co-champions with equal rank | IMG_0894 |
| 1987-1988 Tae Kwon Do | Marked the summary's result as Exhibition, outside championship claims | IMG_0894 |
| 1989-1990 Swimming | Recovered the Men's/Women's/Boys team placements printed with the dated swimming results | IMG_0889 |

The source manifest retains the original-photo hashes. Each checked table or
extra block also records the competition identity, source image, section,
reviewer/date and exact content fingerprint. The source photos are unchanged.
The IMG_0846 and IMG_1311 page transcriptions and their compiled Markdown
sections were corrected; existing local PDFs remain pre-correction snapshots.

## Implemented structure and publication controls

- The runtime reads `data/uaap_archive_master.json`. Older flat JSON,
  structured files and compiled tables are retained as candidates/snapshots.
  The older extractors now write into `data/candidates/` and cannot overwrite
  the canonical runtime dataset.
- The public page and public API run publication gates **after** overrides.
  A changed block loses its source-checked status if its fingerprint no longer
  matches. Missing review metadata is never interpreted as approval.
- Unreviewed standings carry a visible status. Structural failures and explicit
  source conflicts produce a withheld table rather than a historical claim.
  Unreviewed awards, board distinctions and leaders are excluded from public
  payloads. The page no longer describes the whole archive as official.
- The editor's raw candidate API requires an authenticated admin session.
  Ordinary saves reset table review. An editor can explicitly record a source
  check with a reviewer name, known original page IDs and a section heading;
  the server creates the content-bound review for the saved table and awards.
  This is a human attestation, not an automated guarantee that the source agrees.
- Leader tabs and entries follow the selected division, retain qualifiers and
  source references, and include ties at the display cutoff. Awards-only or
  leaders-only verified coverage can be browsed without fabricated standings.
  Division deletion tombstones remove corresponding extras.
- Unknown Chess board numbers are no longer invented from array positions.
  Champion-only coverage and co-champions are explicit. Exhibition results do
  not become season-card championship claims. Decimal precision can be set per
  column; unknown values remain distinct from zero.
- Integrity gates cover repeated school identifiers, invalid numeric values,
  W/D/L versus reported games, PCT consistency, source identity/locators,
  original fingerprints, review staleness, named awards and leader definitions.
  Source verification remains necessary even after structural checks pass.

The canonical base currently contains **127 divisions: 28 source checked,
94 pending, and five withheld**, plus **16 source-checked extra blocks**.
These counts describe the canonical base. Live admin overrides can change the
effective counts; the same gates run on them before publication.

## Checks and remaining work

`npm run check` includes lint, type checking and `archive:check`. The local
`npm run archive:check -- --require-photos` additionally requires original
source assets. Unit and browser regressions cover the corrected orders,
division scoping, award contamination, stale approvals, nulls, co-champions,
leader ties, source conflicts and the authenticated review workflow.

Final validation passed: lint, type checking, the original-photo integrity
gate, all 37 unit tests and all 15 browser tests against a production build.
The browser checks include mobile layout, division-specific leader tabs,
source-review saves and navigation to the recovered Swimming/Track and Field
records. They use a local database fixture, not production records.

The remaining 94 pending tables still need row-by-row source review. Five
blocks remain withheld: 1987-1988 Baseball Men's, 1987-1988 Chess Juniors,
1988-1989 Basketball Juniors, 1988-1989 Football Men's, and the conflicting
2003-2004 Chess Juniors team table. Other unreviewed award and player-stat
candidates are retained for research but cannot become public awards/leaders
through an extraction run alone.

There is no 2002-2003 source material in the local placeholder. Filling that
season requires acquiring evidence; no statistics were fabricated for it.
The improvements do not certify the entire archive or all the older parser
outputs, and do not alter production database overrides.
