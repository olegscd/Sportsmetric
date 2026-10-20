import type { ExtractedBoxRow } from "@/lib/game-extractor";
import type { Player, Team } from "@/types/sports";

/** Loose identity matching shared by the admin importer and CLI imports. */
export function normalizeStr(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

const TEAM_CODE_ALIASES: Record<string, string[]> = {
  // PBA
  bwb: ["blackwater", "blackwaterbossing", "bossing"],
  con: ["converge", "convergefiberxers", "fiberxers"],
  gin: ["ginebra", "barangayginebra", "ginebrasanmiguel"],
  mag: ["magnolia", "magnoliahotshots", "hotshots"],
  mer: ["meralco", "meralcobolts", "bolts"],
  mgp: ["macau", "macaugiantpandas", "giantpandas", "mbk"],
  mbk: ["macau", "macaublackbears", "blackbears", "mgp"],
  nlx: ["nlex", "nlexroadwarriors", "roadwarriors"],
  phx: ["phoenix", "phoenixfuelmasters", "fuelmasters"],
  ros: ["rainorshine", "rainorshineelastopainters", "elastopainters"],
  smb: ["smb", "sanmiguel", "sanmiguelbeermen", "beermen"],
  ter: ["terrafirma", "terrafirmadyip", "dyip"],
  tgr: ["titan", "titanultragiantrisers", "giantrisers"],
  tnt: ["tnt", "tnttropang5g", "tnttropanggiga", "tropang5g", "tropang"],
  // UAAP
  up: ["up", "upfightingmaroons", "fightingmaroons", "maroons", "upis", "upisjrs", "juniorfightingmaroons"],
  upis: ["up", "upfightingmaroons", "fightingmaroons", "maroons", "upis", "upisjrs", "juniorfightingmaroons"],
  dlsu: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  lasalle: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  la: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  dlsz: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  ust: ["ust", "growlingtigers", "tigers", "ustjrs", "tigercubs", "juniorgoldentigers"],
  admu: ["admu", "ateneo", "blueeagles", "eagles", "ateneojrs", "blueeaglets", "eaglets"],
  ateneo: ["admu", "ateneo", "blueeagles", "eagles", "ateneojrs", "blueeaglets", "eaglets"],
  feu: ["feu", "tamaraws", "feujrs", "feud", "babytamaraws"],
  feud: ["feu", "tamaraws", "feujrs", "feud", "babytamaraws"],
  ue: ["ue", "redwarriors", "warriors", "uejrs", "juniorwarriors"],
  nu: ["nu", "bulldogs", "nujrs", "nuns", "bullpups"],
  nuns: ["nu", "bulldogs", "nujrs", "nuns", "bullpups"],
  adu: ["adu", "adamson", "soaringfalcons", "falcons", "adujrs", "babyfalcons"],
  // PVL
  ccs: ["creamline", "creamlinecoolsmashers", "coolsmashers", "cream"],
  cream: ["creamline", "creamlinecoolsmashers", "coolsmashers", "ccs"],
  cmf: ["chocomucho", "chocomuchoflyingtitans", "flyingtitans"],
  pga: ["petrogazz", "petrogazzangels", "angels", "pet"],
  pet: ["petrogazz", "petrogazzangels", "angels", "pga"],
  ctc: ["cignal", "cignalhdspikers", "hdspikers", "cig"],
  cig: ["cignal", "cignalhdspikers", "hdspikers", "ctc"],
  pldt: ["pldt", "pldthighspeedhitters", "highspeedhitters", "hsh"],
  hsh: ["pldt", "pldthighspeedhitters", "highspeedhitters", "hsh"],
  akr: ["akari", "akarichargers", "powerchargers", "aka", "akari"],
  aka: ["akari", "akarichargers", "powerchargers", "akr", "akari"],
  akari: ["akari", "akarichargers", "powerchargers", "akr", "aka"],
  nxg: ["nxled", "nxledchameleons", "chameleons", "nxl"],
  nxl: ["nxled", "nxledchameleons", "chameleons", "nxg"],
  zus: ["zus", "zuscoffee", "thunderbelles"],
  cap: ["capital1", "capital1solarspikers", "solarspikers", "cap1"],
  cap1: ["capital1", "capital1solarspikers", "solarspikers", "cap"],
  gal: ["galeries", "galeriestower", "galeriestowerhighrisers", "highrisers", "gth"],
  gth: ["galeries", "galeriestower", "galeriestowerhighrisers", "highrisers", "gal"],
  che: ["chery", "cherytiggo", "crossovers"],
  ftl: ["f2", "f2logistics", "cargomovers"],
  fff: ["farmfresh", "farmfreshfoxies", "foxies"],
  est: ["est", "estcola"],
  estcola: ["est", "estcola"],
  hvf: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
  hcmc: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
  hochiminh: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
  hochiminhcity: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
};

export function findBestTeamMatch(extracted: { name: string; shortName: string }, teams: Team[]): Team | undefined {
  const shortTarget = normalizeStr(extracted.shortName);
  const nameTarget = normalizeStr(extracted.name);

  // 1. Exact shortName match
  const byShort = teams.find((t) => normalizeStr(t.shortName) === shortTarget);
  if (byShort) return byShort;

  // 2. Exact full name match
  const byName = teams.find((t) => normalizeStr(t.name) === nameTarget);
  if (byName) return byName;

  // 3. Known code alias match
  const aliases = Object.hasOwn(TEAM_CODE_ALIASES, shortTarget)
    ? TEAM_CODE_ALIASES[shortTarget]
    : [];
  for (const alias of aliases) {
    const matched = teams.find((t) => {
      const tNorm = normalizeStr(t.name);
      const tShortNorm = normalizeStr(t.shortName);
      const tIdNorm = normalizeStr(t.id);
      return tNorm.includes(alias) || alias.includes(tNorm) || tShortNorm === alias || tIdNorm.includes(alias);
    });
    if (matched) return matched;
  }

  // 4. Substring or prefix match
  return teams.find((t) => {
    const tName = normalizeStr(t.name);
    const tShort = normalizeStr(t.shortName);
    const tId = normalizeStr(t.id);
    return (
      tName.includes(nameTarget) ||
      nameTarget.includes(tName) ||
      tName.includes(shortTarget) ||
      shortTarget.includes(tShort) ||
      tId.includes(shortTarget) ||
      shortTarget.includes(tId)
    );
  });
}

function extractNameTokens(name: string): { initials: string[]; lastName: string; fullNorm: string } {
  const clean = name.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ").trim().toLowerCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  const lastName = parts.length > 0 ? parts[parts.length - 1] : "";
  const initials = parts.map((p) => p[0]);
  return {
    initials,
    lastName,
    fullNorm: normalizeStr(name),
  };
}

export function findBestPlayerMatch(row: ExtractedBoxRow, teamRoster: Player[]): Player | undefined {
  const rowTokens = extractNameTokens(row.playerName);

  // 1. Exact full normalized name match
  const byExact = teamRoster.find((p) => normalizeStr(p.name) === rowTokens.fullNorm);
  if (byExact) return byExact;

  // 2. Jersey number match + last name similarity check
  if (row.jersey !== null && row.jersey !== undefined) {
    const byJerseyList = teamRoster.filter((p) => p.jerseyNumber === row.jersey);
    if (byJerseyList.length === 1) {
      return byJerseyList[0];
    }
    if (byJerseyList.length > 1) {
      // Disambiguate by last name
      const matched = byJerseyList.find((p) => {
        const pTokens = extractNameTokens(p.name);
        return (
          pTokens.lastName.includes(rowTokens.lastName) ||
          rowTokens.lastName.includes(pTokens.lastName)
        );
      });
      if (matched) return matched;
    }
  }

  // 3. Last name + First Initial match (e.g. "J. Franklin" <-> "John Franklin" or "Franklin, J.")
  if (rowTokens.lastName && rowTokens.lastName.length > 2) {
    const byLastName = teamRoster.find((p) => {
      const pTokens = extractNameTokens(p.name);
      const sameLastName =
        pTokens.lastName === rowTokens.lastName ||
        pTokens.fullNorm.includes(rowTokens.lastName) ||
        rowTokens.fullNorm.includes(pTokens.lastName);

      if (!sameLastName) return false;

      // If both have initials, check if any initial matches
      const hasSharedInitial = rowTokens.initials.some((init) => pTokens.initials.includes(init));
      return hasSharedInitial || sameLastName;
    });

    if (byLastName) return byLastName;
  }

  // 4. Substring fallback
  return teamRoster.find((p) => {
    const pNorm = normalizeStr(p.name);
    return pNorm.includes(rowTokens.fullNorm) || rowTokens.fullNorm.includes(pNorm);
  });
}
