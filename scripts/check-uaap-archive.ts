/** Read-only integrity gate. Never refreshes hashes or approves candidate data. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import archive from "../data/uaap_archive_master.json";
import photoManifest from "../data/uaap_source_photos.json";
import { awardIntegrityIssues, chessIntegrityIssues, leaderIntegrityIssues, reviewIssues, tablePublicationReview } from "../lib/uaap-publication";
import { makeDivisionKey, makeReviewKey, type UAAPArchiveExtras, type UAAPReview, type UAAPTable } from "../lib/uaap-schema";

const tables = archive.tables as unknown as UAAPTable[];
const extras = archive.extras as unknown as UAAPArchiveExtras;
const failures: string[] = [];
const keys = new Set<string>();
const statuses = { verified: 0, needs_review: 0, blocked: 0 };
const requirePhotos = process.argv.includes("--require-photos");
const checkedPhotos = new Set<string>();

function checkSources(review: UAAPReview | undefined, label: string) {
  for (const source of review?.sources ?? []) {
    const knownHash = (photoManifest as Record<string, Record<string, string>>)[source.season]?.[source.image];
    if (knownHash !== source.sha256) failures.push(`${label}: original source does not match the photo catalog.`);
    const dir = path.join("data", "seasons", source.season);
    const transcript = path.join(dir, "digital_pages", `${source.image}.md`);
    const photo = path.join(dir, "raw_photos", `${source.image}.JPG`);
    if (!fs.existsSync(transcript)) failures.push(`${label}: missing transcript ${transcript}`);
    if (fs.existsSync(photo)) {
      if (createHash("sha256").update(fs.readFileSync(photo)).digest("hex") !== source.sha256) {
        failures.push(`${label}: original photo changed since review: ${photo}`);
      }
      checkedPhotos.add(photo);
    } else if (requirePhotos) failures.push(`${label}: missing original photo ${photo}`);
  }
}

if (archive.version !== 1) failures.push("Unsupported canonical archive version.");
for (const table of tables) {
  const key = makeDivisionKey(table.season, table.sport, table.division);
  if (keys.has(key)) failures.push(`Duplicate canonical division: ${key}`);
  keys.add(key);
  const review = tablePublicationReview(table);
  statuses[review.status]++;
  if (table.review?.status === "verified") {
    if (review.status !== "verified") failures.push(`${key}: ${review.reason}`);
    if (!table.rows.length) failures.push(`${key}: verified table is empty.`);
    checkSources(table.review, key);
  }
}

let verifiedExtras = 0;
for (const kind of ["awards", "chess_medalists", "leaderboards"] as const) {
  for (const [extrasKey, divisions] of Object.entries(extras[kind] ?? {})) {
    const [sport, season] = extrasKey.split("|");
    for (const [division, block] of Object.entries(divisions)) {
      const candidates: Array<[string, unknown]> = kind === "leaderboards" && block && typeof block === "object"
        ? Object.entries(block) : [["", block]];
      for (const [category, value] of candidates) {
        const key = makeReviewKey(kind, season, sport, division, category || undefined);
        const review = extras.reviews?.[key];
        if (review?.status !== "verified") continue;
        verifiedExtras++;
        const problems = reviewIssues(value, review, { season, sport, division });
        if (kind === "awards") problems.push(...awardIntegrityIssues(value));
        if (kind === "leaderboards") problems.push(...leaderIntegrityIssues(value));
        if (kind === "chess_medalists") problems.push(...chessIntegrityIssues(value));
        if (problems.length) failures.push(`${key}: ${problems.join(" ")}`);
        checkSources(review, key);
        if (kind === "awards") {
          const text = (review.sources ?? []).map(s => {
            const p = path.join("data", "seasons", s.season, "digital_pages", `${s.image}.md`);
            return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
          }).join("\n");
          const normalized = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const awards = value as { mvp?: { player: string }; rookie_of_the_year?: { player: string }; mythical_five?: { player: string }[] };
          for (const person of [awards.mvp, awards.rookie_of_the_year, ...(awards.mythical_five ?? [])]) {
            if (person && !normalized(text).includes(normalized(person.player))) failures.push(`${key}: athlete absent from cited transcript: ${person.player}`);
          }
        }
      }
    }
  }
}

console.log(`Canonical standings: ${tables.length} divisions; ${statuses.verified} source checked, ${statuses.needs_review} pending, ${statuses.blocked} withheld.`);
console.log(`Source-checked extra blocks: ${verifiedExtras}. Original-photo fingerprints checked locally: ${checkedPhotos.size}.`);
if (!requirePhotos) console.log("Use --require-photos for the local original-photo gate; CI can validate without ignored photo assets.");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log("Archive integrity gate passed. Pending entries are not certified by this check.");
