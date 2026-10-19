import { createHash } from "node:crypto";
import { tableIntegrityIssues } from "./uaap-integrity";
import {
  makeDivisionKey, makeReviewKey, normalizeDivision, normalizeChessMedalists,
  type MergedUAAPData, type UAAPArchiveExtras, type UAAPDivisionAwards,
  type UAAPLeaderCategory, type UAAPReview, type UAAPTable,
} from "./uaap-schema";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key, v]) => key !== "review" && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, stable(v)]));
  return value;
}

export function archiveContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

export function reviewIssues(data: unknown, review: UAAPReview | undefined,
  scope: { season: string; sport: string; division: string }): string[] {
  if (review?.status !== "verified") return [review?.reason || "Original source review is pending."];
  const issues: string[] = [];
  if (!review.reviewer?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewed_at || "")) {
    issues.push("Missing reviewer or review date.");
  }
  if (review.content_hash !== archiveContentHash(data)) issues.push("Data changed since its source review.");
  if (!review.sources?.length) issues.push("Missing original source locator.");
  for (const source of review.sources ?? []) {
    if (makeDivisionKey(source.season, source.sport, source.division) !==
      makeDivisionKey(scope.season, scope.sport, scope.division)) issues.push("Source belongs to a different competition.");
    if (!/^IMG_\d+$/.test(source.image) || !source.section?.trim() || !/^[a-f0-9]{64}$/.test(source.sha256)) {
      issues.push("Incomplete original source reference.");
    }
  }
  return issues;
}

export function tablePublicationReview(table: UAAPTable): UAAPReview {
  const structural = tableIntegrityIssues(table);
  if (table.review?.status === "verified" && table.rows.length === 0) structural.push("A source-checked table must contain a result.");
  if (structural.length || table.review?.status === "blocked") return {
    ...table.review, status: "blocked", reason: table.review?.status === "blocked"
      ? table.review.reason : structural.join(" "),
  };
  if (table.review?.status !== "verified") return table.review ?? {
    status: "needs_review", reason: "This transcription has not been checked against the original report.",
  };
  const issues = reviewIssues(table, table.review, table);
  return issues.length ? { status: "needs_review", reason: issues.join(" ") } : table.review;
}

export function awardIntegrityIssues(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["Invalid award block."];
  const awards = raw as UAAPDivisionAwards;
  const people = [awards.mvp, awards.rookie_of_the_year, ...(awards.mythical_five ?? [])].filter(Boolean);
  if (!people.length) return ["Empty award block."];
  return people.some(p => typeof p === "string" || !p ||
    !(("player" in p ? p.player : p.name) || "").trim() ||
    /^(none|n\/a|nil|-|ave\.?|average|total)$/i.test(("player" in p ? p.player : p.name) || "") || !p.school?.trim())
    ? ["Award requires a named athlete and school; placeholders are not awards."] : [];
}

export function leaderIntegrityIssues(raw: unknown): string[] {
  const category = raw as UAAPLeaderCategory | null;
  if (!category || !category.label || !category.unit || !category.scope || !category.qualification ||
    !Array.isArray(category.entries) || !category.entries.length) return ["Missing leader category definition."];
  const people = new Set<string>();
  for (const entry of category.entries) {
    const key = `${entry.player?.trim().toLowerCase()}|${entry.school?.trim().toLowerCase()}`;
    if (!entry.player?.trim() || !entry.school?.trim() || entry.value === undefined ||
      !Number.isInteger(entry.rank) || (entry.rank ?? 0) < 1 || people.has(key)) return ["Invalid or duplicate leader."];
    people.add(key);
    if (category.unit === "%") {
      const value = Number(String(entry.value).replace(/\s*%$/, ""));
      if (!Number.isFinite(value) || value < 0 || value > 100) return ["Invalid percentage leader."];
    }
  }
  return [];
}

export function chessIntegrityIssues(raw: unknown): string[] {
  const boards = normalizeChessMedalists(raw);
  if (!boards) return ["Missing source board identifiers."];
  for (const people of Object.values(boards)) {
    if (people.some(p => !p.player.trim() || !p.school.trim() || !p.medal)) {
      return ["A board distinction requires a named athlete, school and explicit medal."];
    }
  }
  return [];
}

/** Apply AFTER overrides, so an admin edit cannot inherit an obsolete approval. */
export function preparePublicUAAPData(data: MergedUAAPData): MergedUAAPData {
  const tables = data.tables.map(table => {
    const review = tablePublicationReview(table);
    return { ...table, review, rows: review.status === "blocked" ? [] : table.rows };
  });
  const extras: UAAPArchiveExtras = { awards: {}, chess_medalists: {}, leaderboards: {}, reviews: {} };
  for (const kind of ["awards", "chess_medalists", "leaderboards"] as const) {
    for (const [extrasKey, divisions] of Object.entries(data.extras[kind] ?? {})) {
      const [sport, season] = extrasKey.split("|");
      for (const [rawDivision, block] of Object.entries(divisions ?? {})) {
        const division = normalizeDivision(rawDivision);
        const scope = { season, sport, division };
        // Extras may be independently verified even when no standings survive.
        // Explicit division deletions are applied by the merge before this gate.
        const candidates: Array<[string, unknown]> = kind === "leaderboards" && block && typeof block === "object"
          ? Object.entries(block) : [["", block]];
        for (const [category, value] of candidates) {
          const key = makeReviewKey(kind, season, sport, division, category || undefined);
          const embedded = value && typeof value === "object" ? (value as { review?: UAAPReview }).review : undefined;
          const review = embedded ?? data.extras.reviews?.[key];
          if (reviewIssues(value, review, scope).length) continue;
          if (kind === "awards" && awardIntegrityIssues(value).length) continue;
          if (kind === "leaderboards" && leaderIntegrityIssues(value).length) continue;
          if (kind === "chess_medalists" && chessIntegrityIssues(value).length) continue;
          const target = (extras[kind]![extrasKey] ??= {});
          if (category) ((target[division] ??= {}) as Record<string, unknown>)[category] = value;
          else target[division] = value;
          extras.reviews![key] = review!;
        }
      }
    }
  }
  return { ...data, tables, extras };
}
