import type { League, Team, TeamRecord } from "@/types/sports";

export const TEAM_SEASON_IDS = ["2025-26", "2024-25", "2023-24"] as const;

type TeamSeed = {
  slug: string;
  name: string;
  shortName: string;
  accentColor: string;
  record?: TeamRecord;
};

function teamId(seasonId: string, slug: string): string {
  if (seasonId === "2025-26") return slug;
  return `${slug}-${seasonId}`;
}

function pseudoRecord(seed: string, league: League): TeamRecord {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  const games = league === "PVL" ? 12 : league === "UAAP" ? 14 : 11;
  const wins = 3 + (hash % (games - 3));
  return { wins, losses: games - wins };
}

function buildSeasonTeams(seasonId: string, league: League, seeds: TeamSeed[]): Team[] {
  return seeds.map((seed) => ({
    id: teamId(seasonId, seed.slug),
    name: seed.name,
    shortName: seed.shortName,
    logo: null,
    league,
    accentColor: seed.accentColor,
    seasonId,
    record: seed.record ?? pseudoRecord(`${seasonId}-${seed.slug}`, league),
  }));
}

/** UAAP men's basketball — 8 member schools each season. */
const UAAP_SEEDS: TeamSeed[] = [
  { slug: "adamson", name: "Adamson Soaring Falcons", shortName: "ADU", accentColor: "#0033A0" },
  { slug: "ateneo", name: "Ateneo Blue Eagles", shortName: "ADMU", accentColor: "#0038A8" },
  { slug: "dlsu", name: "DLSU Green Archers", shortName: "DLSU", accentColor: "#00693E" },
  { slug: "feu", name: "FEU Tamaraws", shortName: "FEU", accentColor: "#006633" },
  { slug: "nu", name: "NU Bulldogs", shortName: "NU", accentColor: "#FFD700" },
  { slug: "ue", name: "UE Red Warriors", shortName: "UE", accentColor: "#DC143C" },
  { slug: "up", name: "UP Fighting Maroons", shortName: "UP", accentColor: "#7A1F2B" },
  { slug: "ust", name: "UST Growling Tigers", shortName: "UST", accentColor: "#FFC72C" },
];

/** PBA core franchises (stable across recent seasons). */
const PBA_CORE: TeamSeed[] = [
  {
    slug: "ginebra",
    name: "Barangay Ginebra San Miguel",
    shortName: "GIN",
    accentColor: "#CE1126",
  },
  { slug: "blackwater", name: "Blackwater Bossing", shortName: "BLK", accentColor: "#FF6600" },
  { slug: "converge", name: "Converge FiberXers", shortName: "CFX", accentColor: "#00AEEF" },
  {
    slug: "magnolia",
    name: "Magnolia Chicken Timplados Hotshots",
    shortName: "MAG",
    accentColor: "#7D2248",
  },
  { slug: "meralco", name: "Meralco Bolts", shortName: "MER", accentColor: "#F58220" },
  { slug: "nlex", name: "NLEX Road Warriors", shortName: "NLEX", accentColor: "#FF6B00" },
  {
    slug: "phoenix",
    name: "Phoenix Super LPG Fuel Masters",
    shortName: "PHX",
    accentColor: "#0072CE",
  },
  {
    slug: "rainorshine",
    name: "Rain or Shine Elasto Painters",
    shortName: "ROS",
    accentColor: "#FFD700",
  },
  { slug: "smb", name: "San Miguel Beermen", shortName: "SMB", accentColor: "#0B3D91" },
  { slug: "terrafirma", name: "Terrafirma Dyip", shortName: "TERRA", accentColor: "#00843D" },
  { slug: "tnt", name: "TNT Tropang 5G", shortName: "TNT", accentColor: "#FFD100" },
];

const PBA_2025_26: TeamSeed[] = [
  ...PBA_CORE,
  {
    slug: "titan",
    name: "Titan Ultra Giant Risers",
    shortName: "TITAN",
    accentColor: "#512888",
  },
];

const PBA_2024_25: TeamSeed[] = [
  ...PBA_CORE,
  {
    slug: "northport",
    name: "NorthPort Batang Pier",
    shortName: "NP",
    accentColor: "#8B0000",
  },
];

const PBA_2023_24: TeamSeed[] = [
  {
    slug: "ginebra",
    name: "Barangay Ginebra San Miguel",
    shortName: "GIN",
    accentColor: "#CE1126",
  },
  { slug: "blackwater", name: "Blackwater Bossing", shortName: "BLK", accentColor: "#FF6600" },
  { slug: "converge", name: "Converge FiberXers", shortName: "CFX", accentColor: "#00AEEF" },
  {
    slug: "magnolia",
    name: "Magnolia Chicken Timplados Hotshots",
    shortName: "MAG",
    accentColor: "#7D2248",
  },
  { slug: "meralco", name: "Meralco Bolts", shortName: "MER", accentColor: "#F58220" },
  { slug: "nlex", name: "NLEX Road Warriors", shortName: "NLEX", accentColor: "#FF6B00" },
  {
    slug: "phoenix",
    name: "Phoenix Super LPG Fuel Masters",
    shortName: "PHX",
    accentColor: "#0072CE",
  },
  {
    slug: "rainorshine",
    name: "Rain or Shine Elasto Painters",
    shortName: "ROS",
    accentColor: "#FFD700",
  },
  { slug: "smb", name: "San Miguel Beermen", shortName: "SMB", accentColor: "#0B3D91" },
  { slug: "terrafirma", name: "Terrafirma Dyip", shortName: "TERRA", accentColor: "#00843D" },
  { slug: "tnt", name: "TNT Tropang Giga", shortName: "TNT", accentColor: "#FFD100" },
  {
    slug: "northport",
    name: "NorthPort Batang Pier",
    shortName: "NP",
    accentColor: "#8B0000",
  },
];

/** PVL teams by season (reflects real league membership changes). */
const PVL_2025_26: TeamSeed[] = [
  { slug: "akari", name: "Akari Chargers", shortName: "AKARI", accentColor: "#FF4500" },
  { slug: "capital1", name: "Capital1 Solar Spikers", shortName: "CAP1", accentColor: "#F4C430" },
  {
    slug: "chery-tiggo",
    name: "Chery Tiggo Crossovers",
    shortName: "CTC",
    accentColor: "#C8102E",
  },
  {
    slug: "chocomucho",
    name: "Choco Mucho Flying Titans",
    shortName: "CMF",
    accentColor: "#5C3A21",
  },
  { slug: "cignal", name: "Cignal HD Spikers", shortName: "CIG", accentColor: "#E31837" },
  { slug: "creamline", name: "Creamline Cool Smashers", shortName: "CREAM", accentColor: "#B08D57" },
  { slug: "farm-fresh", name: "Farm Fresh Foxies", shortName: "FFF", accentColor: "#228B22" },
  {
    slug: "galeries",
    name: "Galeries Tower Highrisers",
    shortName: "GTH",
    accentColor: "#4B0082",
  },
  { slug: "nxled", name: "Nxled Chameleons", shortName: "NXL", accentColor: "#32CD32" },
  { slug: "petrogazz", name: "Petro Gazz Angels", shortName: "PGA", accentColor: "#2E8B57" },
  { slug: "pldt", name: "PLDT High Speed Hitters", shortName: "PLDT", accentColor: "#FFD700" },
  {
    slug: "zus",
    name: "Zus Coffee Thunderbelles",
    shortName: "ZUS",
    accentColor: "#6F4E37",
  },
];

const PVL_2024_25: TeamSeed[] = [
  { slug: "akari", name: "Akari Chargers", shortName: "AKARI", accentColor: "#FF4500" },
  { slug: "capital1", name: "Capital1 Solar Spikers", shortName: "CAP1", accentColor: "#F4C430" },
  {
    slug: "chery-tiggo",
    name: "Chery Tiggo Crossovers",
    shortName: "CTC",
    accentColor: "#C8102E",
  },
  {
    slug: "chocomucho",
    name: "Choco Mucho Flying Titans",
    shortName: "CMF",
    accentColor: "#5C3A21",
  },
  { slug: "cignal", name: "Cignal HD Spikers", shortName: "CIG", accentColor: "#E31837" },
  { slug: "creamline", name: "Creamline Cool Smashers", shortName: "CREAM", accentColor: "#B08D57" },
  { slug: "farm-fresh", name: "Farm Fresh Foxies", shortName: "FFF", accentColor: "#228B22" },
  {
    slug: "galeries",
    name: "Galeries Tower Highrisers",
    shortName: "GTH",
    accentColor: "#4B0082",
  },
  { slug: "nxled", name: "Nxled Chameleons", shortName: "NXL", accentColor: "#32CD32" },
  { slug: "petrogazz", name: "Petro Gazz Angels", shortName: "PGA", accentColor: "#2E8B57" },
  { slug: "pldt", name: "PLDT High Speed Hitters", shortName: "PLDT", accentColor: "#FFD700" },
  {
    slug: "strong-group",
    name: "Strong Group Athletics",
    shortName: "SGA",
    accentColor: "#1E3A8A",
  },
];

const PVL_2023_24: TeamSeed[] = [
  { slug: "akari", name: "Akari Chargers", shortName: "AKARI", accentColor: "#FF4500" },
  {
    slug: "army",
    name: "Army Black Mamba Lady Troopers",
    shortName: "ARMY",
    accentColor: "#355E3B",
  },
  {
    slug: "chery-tiggo",
    name: "Chery Tiggo Crossovers",
    shortName: "CTC",
    accentColor: "#C8102E",
  },
  {
    slug: "chocomucho",
    name: "Choco Mucho Flying Titans",
    shortName: "CMF",
    accentColor: "#5C3A21",
  },
  { slug: "cignal", name: "Cignal HD Spikers", shortName: "CIG", accentColor: "#E31837" },
  { slug: "creamline", name: "Creamline Cool Smashers", shortName: "CREAM", accentColor: "#B08D57" },
  {
    slug: "f2-logistics",
    name: "F2 Logistics Cargo Movers",
    shortName: "F2",
    accentColor: "#FFD700",
  },
  { slug: "farm-fresh", name: "Farm Fresh Foxies", shortName: "FFF", accentColor: "#228B22" },
  { slug: "foton", name: "Foton Tornadoes", shortName: "FOTON", accentColor: "#003DA5" },
  {
    slug: "galeries",
    name: "Galeries Tower Highrisers",
    shortName: "GTH",
    accentColor: "#4B0082",
  },
  { slug: "gerflor", name: "Quezon City Gerflor Defenders", shortName: "GER", accentColor: "#008080" },
  { slug: "nxled", name: "Nxled Chameleons", shortName: "NXL", accentColor: "#32CD32" },
  { slug: "petrogazz", name: "Petro Gazz Angels", shortName: "PGA", accentColor: "#2E8B57" },
  { slug: "pldt", name: "PLDT High Speed Hitters", shortName: "PLDT", accentColor: "#FFD700" },
];

const LEAGUE_TEAMS_BY_SEASON: Record<string, Record<League, TeamSeed[]>> = {
  "2026-27": {
    UAAP: UAAP_SEEDS,
    PBA: PBA_2025_26,
    PVL: PVL_2025_26,
  },
  "2025-26": {
    UAAP: UAAP_SEEDS,
    PBA: PBA_2025_26,
    PVL: PVL_2025_26,
  },
  "2024-25": {
    UAAP: UAAP_SEEDS,
    PBA: PBA_2024_25,
    PVL: PVL_2024_25,
  },
  "2023-24": {
    UAAP: UAAP_SEEDS,
    PBA: PBA_2023_24,
    PVL: PVL_2023_24,
  },
};

/** Every team across UAAP, PBA, and PVL for the current and previous two seasons. */
export function buildAllTeams(): Team[] {
  const teams: Team[] = [];

  for (const seasonId of TEAM_SEASON_IDS) {
    const leagues = LEAGUE_TEAMS_BY_SEASON[seasonId];
    for (const league of ["UAAP", "PBA", "PVL"] as const) {
      teams.push(...buildSeasonTeams(seasonId, league, leagues[league]));
    }
  }

  return teams;
}

