"use server";

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "sportsmetric_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (in seconds)

function getAdminSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    console.error("[Admin Auth] ADMIN_PASSWORD is not defined in environment variables.");
  }
  return secret || "";
}

function generateAuthToken(secret: string): string {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac("sha256", secret).update(`admin:${timestamp}`).digest("hex");
  return `${timestamp}.${hmac}`;
}

function verifyAuthToken(token: string | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [timestampStr, providedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (Number.isNaN(timestamp)) return false;

  // Check token age (must be within COOKIE_MAX_AGE)
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0 || ageMs > COOKIE_MAX_AGE * 1000) {
    return false;
  }

  const expectedHmac = crypto.createHmac("sha256", secret).update(`admin:${timestampStr}`).digest("hex");
  try {
    const bufProvided = Buffer.from(providedHmac, "hex");
    const bufExpected = Buffer.from(expectedHmac, "hex");
    if (bufProvided.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufProvided, bufExpected);
  } catch {
    return false;
  }
}

export async function loginAdmin(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const password = formData.get("password");
  const secret = getAdminSecret();

  if (!secret) {
    return { error: "Server authentication is misconfigured (missing ADMIN_PASSWORD)." };
  }

  if (typeof password !== "string" || password !== secret) {
    return { error: "Incorrect password." };
  }

  const token = generateAuthToken(secret);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return { error: null };
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyAuthToken(token, secret);
}

// ---------------------------------------------------------------------------
// UAAP Archive Manual Management Actions
// ---------------------------------------------------------------------------

export interface UAAPStandingEntry {
  rank: number;
  team: string;
  wins?: number | null;
  losses?: number | null;
  pct?: number | null;
  points?: number | null;
  details?: string | null;
}

export interface UAAPSavePayload {
  season: string;
  sport: string;
  division: string;
  standings: UAAPStandingEntry[];
  awards?: {
    mvp?: { player: string; school: string } | null;
    rookie_of_the_year?: { player: string; school: string } | null;
    mythical_five?: Array<{ player: string; school: string; position?: string }> | null;
  } | null;
  chess_medalists?: Record<string, Array<{ medal: "gold" | "silver" | "bronze"; player: string; school: string }>> | null;
}

export async function saveUAAPArchiveData(payload: UAAPSavePayload): Promise<{ success: boolean; error?: string; count?: number }> {
  const auth = await isAdminAuthenticated();
  if (!auth) {
    return { success: false, error: "Unauthorized. Please log in as admin." };
  }

  const { season, sport, division, standings, awards, chess_medalists } = payload;
  if (!season || !sport || !division) {
    return { success: false, error: "Missing required fields (season, sport, or division)." };
  }

  try {
    const dataDir = path.resolve(process.cwd(), "data");
    const standingsPath = path.join(dataDir, "uaap_standings.json");
    const extrasPath = path.join(dataDir, "uaap_archive_extras.json");

    // 1. Update uaap_standings.json
    let allStandings: any[] = [];
    try {
      const content = await fs.readFile(standingsPath, "utf-8");
      allStandings = JSON.parse(content);
    } catch {
      allStandings = [];
    }

    // Filter out existing records for this (season, sport, division)
    allStandings = allStandings.filter(
      (item) => !(item.season === season && item.sport === sport && item.division === division)
    );

    // Map new records
    const newRecords = standings.map((item, idx) => {
      const w = item.wins !== undefined && item.wins !== null && item.wins !== ("" as any) ? Number(item.wins) : null;
      const l = item.losses !== undefined && item.losses !== null && item.losses !== ("" as any) ? Number(item.losses) : null;
      const pts = item.points !== undefined && item.points !== null && item.points !== ("" as any) ? Number(item.points) : null;

      let pct = item.pct ?? null;
      if (w !== null && l !== null && w + l > 0) {
        pct = Number((w / (w + l)).toFixed(3));
      }

      return {
        season,
        sport,
        division,
        stage: "Final Standings",
        rank: item.rank || idx + 1,
        team: item.team.trim().toUpperCase(),
        wins: w,
        losses: l,
        pct,
        points: pts,
        details: item.details?.trim() || (pts !== null ? `${pts} pts` : null),
        source_page: "Manual Entry / Curated",
      };
    });

    allStandings.push(...newRecords);
    await fs.writeFile(standingsPath, JSON.stringify(allStandings, null, 2), "utf-8");

    // 2. Update uaap_archive_extras.json (Awards & Chess Medalists)
    let allExtras: any = { awards: {}, games: {}, chess_medalists: {}, leaderboards: {} };
    try {
      const extrasContent = await fs.readFile(extrasPath, "utf-8");
      allExtras = JSON.parse(extrasContent);
    } catch {
      allExtras = { awards: {}, games: {}, chess_medalists: {}, leaderboards: {} };
    }

    const extrasKey = `${sport}|${season}`;

    if (awards) {
      if (!allExtras.awards) allExtras.awards = {};
      if (!allExtras.awards[extrasKey]) allExtras.awards[extrasKey] = {};
      allExtras.awards[extrasKey][division] = awards;
    }

    if (chess_medalists) {
      if (!allExtras.chess_medalists) allExtras.chess_medalists = {};
      if (!allExtras.chess_medalists[extrasKey]) allExtras.chess_medalists[extrasKey] = {};
      allExtras.chess_medalists[extrasKey][division] = chess_medalists;
    }

    await fs.writeFile(extrasPath, JSON.stringify(allExtras, null, 2), "utf-8");

    // 3. Revalidate live route
    revalidatePath("/uaap");

    return { success: true, count: newRecords.length };
  } catch (err: any) {
    console.error("[saveUAAPArchiveData] error:", err);
    return { success: false, error: err.message || "Failed to save UAAP archive data." };
  }
}

export async function deleteUAAPArchiveDivision(season: string, sport: string, division: string): Promise<{ success: boolean; error?: string }> {
  const auth = await isAdminAuthenticated();
  if (!auth) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    const standingsPath = path.resolve(process.cwd(), "data", "uaap_standings.json");
    const content = await fs.readFile(standingsPath, "utf-8");
    let allStandings = JSON.parse(content);

    allStandings = allStandings.filter(
      (item: any) => !(item.season === season && item.sport === sport && item.division === division)
    );

    await fs.writeFile(standingsPath, JSON.stringify(allStandings, null, 2), "utf-8");
    revalidatePath("/uaap");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getUAAPAnnualReportSnippet(season: string, sport?: string): Promise<{ content: string; sourceFile?: string }> {
  try {
    const seasonDir = path.resolve(process.cwd(), "data", "seasons", season);
    const files = await fs.readdir(seasonDir);
    const reportFile = files.find((f) => f.endsWith(".md") && !f.startsWith("IMG_"));

    if (!reportFile) {
      return { content: `No report found for season ${season}.` };
    }

    const fullPath = path.join(seasonDir, reportFile);
    const text = await fs.readFile(fullPath, "utf-8");

    if (!sport || sport === "All") {
      return { content: text.slice(0, 15000), sourceFile: reportFile };
    }

    // Filter lines relevant to sport
    const sportKeyword = sport.toLowerCase().replace(/lawn |general /g, "");
    const lines = text.split("\n");
    const matchingSections: string[] = [];
    let inSection = false;
    let sectionLines: string[] = [];

    for (const line of lines) {
      const lu = line.toUpperCase();
      if (line.startsWith("#") || line.startsWith("<!-- START PAGE")) {
        if (lu.includes(sportKeyword.toUpperCase())) {
          inSection = true;
          sectionLines.push(line);
        } else if (inSection && line.startsWith("#") && !lu.includes(sportKeyword.toUpperCase())) {
          inSection = false;
          if (sectionLines.length > 0) {
            matchingSections.push(sectionLines.join("\n"));
            sectionLines = [];
          }
        } else if (inSection) {
          sectionLines.push(line);
        }
      } else if (inSection) {
        sectionLines.push(line);
      }
    }

    if (sectionLines.length > 0) {
      matchingSections.push(sectionLines.join("\n"));
    }

    const result = matchingSections.length > 0 ? matchingSections.join("\n\n---\n\n") : text.slice(0, 15000);
    return { content: result.slice(0, 20000), sourceFile: reportFile };
  } catch (err: any) {
    return { content: `Error reading report: ${err.message}` };
  }
}


