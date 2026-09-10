export interface UAAPSchool {
  code: string;
  name: string;
  /** Juniors/high school programs are listed separately in the picker. */
  juniors?: boolean;
}

export const UAAP_SCHOOLS: UAAPSchool[] = [
  { code: "ADMU", name: "Ateneo de Manila" },
  { code: "DLSU", name: "De La Salle" },
  { code: "FEU", name: "Far Eastern" },
  { code: "UST", name: "Univ. of Santo Tomas" },
  { code: "UP", name: "Univ. of the Philippines" },
  { code: "UE", name: "Univ. of the East" },
  { code: "AdU", name: "Adamson University" },
  { code: "NU", name: "National University" },
  { code: "DLSZ", name: "De La Salle Zobel", juniors: true },
  { code: "UPIS", name: "UP Integrated School", juniors: true },
  { code: "USTHS", name: "UST High School", juniors: true },
  { code: "FEU-FERN", name: "FEU Diliman (FERN)", juniors: true },
  { code: "AHS", name: "Ateneo High School", juniors: true },
  { code: "UEHS", name: "UE High School", juniors: true },
  { code: "NU-HS", name: "NU Nazareth", juniors: true },
];

export interface SchoolTheme {
  bg: string;
  text: string;
  name: string;
}

const SCHOOL_THEMES: Record<string, SchoolTheme> = {
  ADMU: { bg: "bg-blue-600/15 border-blue-500/30", text: "text-blue-400", name: "Ateneo" },
  AHS: { bg: "bg-blue-600/15 border-blue-500/30", text: "text-blue-400", name: "Ateneo High" },
  DLSU: { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "La Salle" },
  DLSZ: { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "DLSZ" },
  "DLS-Z": { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "DLSZ" },
  FEU: { bg: "bg-green-600/15 border-yellow-500/30", text: "text-yellow-400", name: "Far Eastern" },
  "FEU-FERN": { bg: "bg-green-600/15 border-yellow-500/30", text: "text-yellow-400", name: "FEU Diliman" },
  UST: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", name: "Santo Tomas" },
  USTHS: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", name: "UST High" },
  UP: { bg: "bg-rose-700/15 border-rose-500/30", text: "text-rose-400", name: "Univ. of the Philippines" },
  UPIS: { bg: "bg-rose-700/15 border-rose-500/30", text: "text-rose-400", name: "UPIS" },
  UE: { bg: "bg-red-600/15 border-red-500/30", text: "text-red-400", name: "Univ. of the East" },
  UEHS: { bg: "bg-red-600/15 border-red-500/30", text: "text-red-400", name: "UE High" },
  ADU: { bg: "bg-sky-600/15 border-sky-500/30", text: "text-sky-400", name: "Adamson" },
  NU: { bg: "bg-indigo-600/15 border-yellow-500/30", text: "text-indigo-400", name: "National U" },
  "NU-HS": { bg: "bg-indigo-600/15 border-yellow-500/30", text: "text-indigo-400", name: "NU High" },
};

const NEUTRAL_THEME: SchoolTheme = {
  bg: "bg-elevated border-border",
  text: "text-foreground",
  name: "",
};

export function getSchoolTheme(code: string): SchoolTheme {
  if (!code) return { ...NEUTRAL_THEME, name: "Unknown" };
  const exact = SCHOOL_THEMES[code];
  if (exact) return exact;
  const upper = SCHOOL_THEMES[code.toUpperCase()];
  if (upper) return upper;
  return { ...NEUTRAL_THEME, name: code };
}

/**
 * Resolves free-text school names from OCR'd annual reports to a school code.
 * Returns null when nothing matches so the caller can keep the raw text rather
 * than silently guessing wrong.
 */
export function matchSchoolCode(text: string): string | null {
  const upper = (text || "").toUpperCase();
  if (!upper.trim()) return null;

  // Longest codes first so "NU-HS" wins over "NU" and "FEU-FERN" over "FEU".
  const byLength = [...UAAP_SCHOOLS].sort((a, b) => b.code.length - a.code.length);
  for (const school of byLength) {
    if (new RegExp(`\\b${school.code.toUpperCase().replace(/[-]/g, "[- ]?")}\\b`).test(upper)) {
      return school.code;
    }
  }

  const aliases: Array<[RegExp, string]> = [
    [/\bATENEO\b.*\bHIGH\b/, "AHS"],
    [/\bATENEO\b/, "ADMU"],
    [/\bLA\s*SALLE\b.*\bZOBEL\b/, "DLSZ"],
    [/\bLA\s*SALLE\b/, "DLSU"],
    [/\bSANTO\s*TOMAS\b/, "UST"],
    [/\bFAR\s*EASTERN\b/, "FEU"],
    [/\bPHILIPPINES\b/, "UP"],
    [/\bEAST\b/, "UE"],
    [/\bADAMSON\b/, "AdU"],
    [/\bNATIONAL\b/, "NU"],
  ];

  for (const [pattern, code] of aliases) {
    if (pattern.test(upper)) return code;
  }

  return null;
}
