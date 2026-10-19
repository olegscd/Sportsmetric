# UAAP archive data layers

`uaap_archive_master.json` is the single canonical base dataset used by the app.
It holds flexible team tables, candidate extras, source locators, review status,
and content fingerprints. Source-checked blocks have been compared with the
original photos; absence of that status must never imply verification.

`uaap_source_photos.json` indexes the SHA-256 fingerprints of the 751 original
photos. It enables authenticated editors to cite a known source page even when
the large photo collection is not packaged with the deployed app. This index
establishes file identity, not statistical accuracy or proof of a person's review.

The public loader merges versioned admin changes with the canonical base, then
checks review fingerprints and integrity. Pending standings are labeled;
malformed/disputed standings are withheld. Awards, board medalists and leader
categories require a matching source review to appear. The authenticated editor
can inspect the unresolved candidates and explicitly attest a new source review.
An ordinary save cannot silently inherit an old review.

The following are **candidates or historical snapshots**, not alternate public
datasets:

- `uaap_standings.json` and `uaap_archive_extras.json`: the pre-correction local
  snapshots used in the 19 October audit; retained for traceability.
- `structured/`: parser outputs, including known malformed player-stat rows.
- `compiled/`: generated CSV, spreadsheets, paste packs and compendia.
- `candidates/`: new outputs from the older extraction/compilation scripts.

`seasons/<season>/raw_photos/` preserves the original evidence.
`digital_pages/` and the season Markdown books are transcriptions. PDFs are
rendered snapshots of those transcriptions, not independent corroboration.
The two corrected transcription sections (1988-1989 IMG_0846 and 1998-1999
IMG_1311) are newer than the local PDF snapshots; use the original photos for
those checks. A complete local image/transcript pairing does not establish that
the original report collection is complete.

Follow [the selection protocol](../docs/uaap-archive-statistics-protocol.md).
Run `npm run archive:check -- --require-photos` locally to check canonical
reviews, source locators, original-photo fingerprints, awards and integrity.
CI uses `npm run archive:check` without requiring ignored photo assets.
Neither mode approves unresolved candidates or refreshes review hashes.
