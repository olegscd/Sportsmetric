import photos from "../data/uaap_source_photos.json";
import { archiveContentHash } from "./uaap-publication";
import { normalizeDivision, type UAAPReview } from "./uaap-schema";

export interface UAAPSourceReviewInput {
  reviewer: string;
  images: string[];
  section: string;
}

/** An authenticated editor's explicit original-source attestation, never inferred from a save. */
export function recordSourceReview(data: unknown, scope: { season: string; sport: string; division: string },
  input: UAAPSourceReviewInput): UAAPReview {
  if (typeof input.reviewer !== "string" || input.reviewer.trim().length < 2 || input.reviewer.length > 120 ||
    typeof input.section !== "string" || input.section.trim().length < 8 || input.section.length > 300 ||
    !Array.isArray(input.images) || !input.images.length || input.images.length > 12 ||
    input.images.some(id => typeof id !== "string" || !/^IMG_\d+$/.test(id))) {
    throw new Error("Source review requires your name, original IMG page IDs, and a precise section heading.");
  }
  const catalog = photos as Record<string, Record<string, string>>;
  const sources = [...new Set(input.images)].map(image => {
    const sha256 = catalog[scope.season]?.[image];
    if (!sha256) throw new Error(`${image} is not an original source page for ${scope.season}.`);
    return { ...scope, division: normalizeDivision(scope.division), image, section: input.section.trim(), sha256 };
  });
  return { status: "verified", reason: "Every published table value and award was checked against the cited original pages by the named editor.",
    reviewer: input.reviewer.trim(), reviewed_at: new Date().toISOString().slice(0, 10), sources,
    content_hash: archiveContentHash(data) };
}
