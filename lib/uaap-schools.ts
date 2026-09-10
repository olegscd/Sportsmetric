export interface UAAPSchool {
  code: string;
  name: string;
  /** Juniors/high school programs are listed separately in the picker. */
  juniors?: boolean;
}

export const UAAP_SCHOOLS: UAAPSchool[] = [
  { code: "ADMU", name: "Ateneo de Manila University" },
  { code: "DLSU", name: "De La Salle University" },
  { code: "FEU", name: "Far Eastern University" },
  { code: "UST", name: "University of Santo Tomas" },
  { code: "UP", name: "University of the Philippines" },
  { code: "UE", name: "University of the East" },
  { code: "AdU", name: "Adamson University" },
  { code: "NU", name: "National University" },
  { code: "DLSZ", name: "De La Salle Santiago Zobel School", juniors: true },
  { code: "UPIS", name: "UP Integrated School", juniors: true },
  { code: "USTHS", name: "UST High School", juniors: true },
  { code: "FEU-FERN", name: "FEU Diliman (FERN)", juniors: true },
  { code: "AHS", name: "Ateneo High School", juniors: true },
  { code: "UEHS", name: "UE High School", juniors: true },
  { code: "NU-HS", name: "NU Nazareth School", juniors: true },
];

export interface SchoolTheme {
  bg: string;
  text: string;
  name: string;
}

const SCHOOL_THEMES: Record<string, SchoolTheme> = {
  ADMU: { bg: "bg-blue-600/15 border-blue-500/30", text: "text-blue-400", name: "Ateneo de Manila University" },
  AHS: { bg: "bg-blue-600/15 border-blue-500/30", text: "text-blue-400", name: "Ateneo High School" },
  DLSU: { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "De La Salle University" },
  DLSZ: { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "De La Salle Zobel" },
  "DLS-Z": { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "De La Salle Zobel" },
  FEU: { bg: "bg-green-600/15 border-yellow-500/30", text: "text-yellow-400", name: "Far Eastern University" },
  "FEU-FERN": { bg: "bg-green-600/15 border-yellow-500/30", text: "text-yellow-400", name: "FEU Diliman" },
  UST: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", name: "University of Santo Tomas" },
  USTHS: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", name: "UST High School" },
  UP: { bg: "bg-rose-700/15 border-rose-500/30", text: "text-rose-400", name: "University of the Philippines" },
  UPIS: { bg: "bg-rose-700/15 border-rose-500/30", text: "text-rose-400", name: "UP Integrated School" },
  UE: { bg: "bg-red-600/15 border-red-500/30", text: "text-red-400", name: "University of the East" },
  UEHS: { bg: "bg-red-600/15 border-red-500/30", text: "text-red-400", name: "UE High School" },
  ADU: { bg: "bg-sky-600/15 border-sky-500/30", text: "text-sky-400", name: "Adamson University" },
  NU: { bg: "bg-indigo-600/15 border-yellow-500/30", text: "text-indigo-400", name: "National University" },
  "NU-HS": { bg: "bg-indigo-600/15 border-yellow-500/30", text: "text-indigo-400", name: "NU High School" },
};

const NEUTRAL_THEME: SchoolTheme = {
  bg: "bg-elevated border-border",
  text: "text-foreground",
  name: "",
};

export function getSchoolTheme(codeOrName: string): SchoolTheme {
  if (!codeOrName) return { ...NEUTRAL_THEME, name: "Unknown" };
  const exact = SCHOOL_THEMES[codeOrName];
  if (exact) return exact;
  const upper = SCHOOL_THEMES[codeOrName.toUpperCase()];
  if (upper) return upper;
  const matched = matchSchoolCode(codeOrName);
  if (matched && SCHOOL_THEMES[matched]) return SCHOOL_THEMES[matched];
  return { ...NEUTRAL_THEME, name: codeOrName };
}

export function getSchoolName(codeOrName: string): string {
  if (!codeOrName) return "";
  const matched = matchSchoolCode(codeOrName);
  if (matched) {
    const found = UAAP_SCHOOLS.find((s) => s.code.toUpperCase() === matched.toUpperCase());
    if (found?.name) return found.name;
    const theme = SCHOOL_THEMES[matched];
    if (theme?.name) return theme.name;
  }
  const exact = UAAP_SCHOOLS.find(
    (s) =>
      s.code.toUpperCase() === codeOrName.toUpperCase() ||
      s.name.toLowerCase() === codeOrName.toLowerCase()
  );
  if (exact?.name) return exact.name;
  return codeOrName;
}

export function getSchoolCode(codeOrName: string): string {
  if (!codeOrName) return "";
  return matchSchoolCode(codeOrName) || codeOrName.trim().toUpperCase();
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
