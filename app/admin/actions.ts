"use server";

import fs from "fs/promises";
import path from "path";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  checkLoginThrottle,
  clearLoginAttempts,
  generateAuthToken,
  getAdminSecret,
  isAdminAuthenticated as isAdminAuthenticatedInternal,
  passwordMatches,
  recordFailedLogin,
} from "@/lib/admin-auth";
import {
  saveUAAPAdminOverride,
  deleteUAAPAdminDivision as deleteUAAPAdminDivisionHelper,
  type MergedUAAPData,
  type UAAPSavePayload,
} from "@/lib/uaap-data";

export async function isAdminAuthenticated(): Promise<boolean> {
  return isAdminAuthenticatedInternal();
}

async function getClientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
}

export async function loginAdmin(
  _prevState: { error: string | null; success?: boolean },
  formData: FormData
): Promise<{ error: string | null; success?: boolean }> {
  const password = formData.get("password");
  const secret = getAdminSecret();

  if (!secret) {
    return { error: "Server authentication is misconfigured (missing ADMIN_PASSWORD)." };
  }

  const clientKey = await getClientKey();
  const throttle = checkLoginThrottle(clientKey);
  if (!throttle.allowed) {
    const minutes = Math.ceil(throttle.retryAfterSeconds / 60);
    return { error: `Too many failed attempts. Try again in ${minutes} minute(s).` };
  }

  if (typeof password !== "string" || !passwordMatches(password, secret)) {
    recordFailedLogin(clientKey);
    return { error: "Incorrect password." };
  }

  clearLoginAttempts(clientKey);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, generateAuthToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  return { error: null, success: true };
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// UAAP Archive Manual Management Actions (Prioritized Admin Overrides)
// ---------------------------------------------------------------------------

export async function saveUAAPArchiveData(payload: UAAPSavePayload): Promise<{
  success: boolean;
  error?: string;
  warning?: string;
  count?: number;
  data?: MergedUAAPData;
}> {
  if (!(await isAdminAuthenticatedInternal())) {
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
  if (!(await isAdminAuthenticatedInternal())) {
    return { success: false, error: "Unauthorized." };
  }

  const res = await deleteUAAPAdminDivisionHelper(season, sport, division);
  if (res.success) {
    revalidatePath("/uaap");
    revalidatePath("/admin");
  }
  return res;
}

/** Season folders are named like "1999-2000"; anything else is rejected. */
const SEASON_FOLDER = /^\d{4}-\d{4}$/;

export async function getUAAPAnnualReportSnippet(
  season: string,
  sport?: string
): Promise<{ content: string; sourceFile?: string }> {
  if (!(await isAdminAuthenticatedInternal())) {
    return { content: "Unauthorized." };
  }

  if (typeof season !== "string" || !SEASON_FOLDER.test(season)) {
    return { content: "Invalid season identifier." };
  }

  const seasonsRoot = path.resolve(process.cwd(), "data", "seasons");
  const seasonDir = path.resolve(seasonsRoot, season);

  // Defence in depth: the regex already blocks traversal, but confirm the
  // resolved path stayed inside the seasons directory before touching disk.
  if (seasonDir !== seasonsRoot && !seasonDir.startsWith(seasonsRoot + path.sep)) {
    return { content: "Invalid season identifier." };
  }

  try {
    const files = await fs.readdir(seasonDir);
    const reportFile = files.find((f) => f.endsWith(".md") && !f.startsWith("IMG_"));

    if (!reportFile) {
      return { content: `No report found for season ${season}.` };
    }

    const text = await fs.readFile(path.join(seasonDir, reportFile), "utf-8");

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
  } catch (err) {
    console.error(`[Admin] Failed to read annual report for ${season}:`, err);
    return { content: `Could not read the annual report for ${season}.` };
  }
}
