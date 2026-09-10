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

import {
  saveUAAPAdminOverride,
  deleteUAAPAdminDivision as deleteUAAPAdminDivisionHelper,
  getMergedUAAPData,
  type MergedUAAPData,
  type UAAPSavePayload,
} from "@/lib/uaap-data";

export async function loginAdmin(
  _prevState: { error: string | null; success?: boolean },
  formData: FormData
): Promise<{ error: string | null; success?: boolean }> {
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

  return { error: null, success: true };
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
// UAAP Archive Manual Management Actions (Prioritized Admin Overrides)
// ---------------------------------------------------------------------------

export async function getLatestUAAPData(): Promise<MergedUAAPData> {
  return getMergedUAAPData();
}

export async function saveUAAPArchiveData(payload: UAAPSavePayload): Promise<{
  success: boolean;
  error?: string;
  warning?: string;
  count?: number;
  data?: MergedUAAPData;
}> {
  const auth = await isAdminAuthenticated();
  if (!auth) {
    return { success: false, error: "Unauthorized. Please log in as admin." };
  }

  const res = await saveUAAPAdminOverride(payload);
  if (res.success) {
    revalidatePath("/uaap");
    revalidatePath("/admin");
  }
  return res;
}

export async function deleteUAAPArchiveDivision(
  season: string,
  sport: string,
  division: string
): Promise<{ success: boolean; error?: string; warning?: string; data?: MergedUAAPData }> {
  const auth = await isAdminAuthenticated();
  if (!auth) {
    return { success: false, error: "Unauthorized." };
  }

  const res = await deleteUAAPAdminDivisionHelper(season, sport, division);
  if (res.success) {
    revalidatePath("/uaap");
    revalidatePath("/admin");
  }
  return res;
}

export async function getUAAPAnnualReportSnippet(season: string, sport?: string): Promise<{ content: string; sourceFile?: string }> {
  try {
    const seasonDir = path.resolve(process.cwd(), "data", "seasons", season);
    const files = await fs.readdir(seasonDir);
    const reportFile = files.find((f) => f.endsWith(".md") && !f.startsWith("IMG_"));

    if (!reportFile) {
      return { content: `No report found for season ${season}.` };
    }

    const fullPath = path.join(/*turbopackIgnore: true*/ seasonDir, reportFile);
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


