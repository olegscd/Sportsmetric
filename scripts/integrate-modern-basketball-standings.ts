import fs from "fs";
import path from "path";
import { mockTeams, mockGames } from "../lib/mock-data";
import { deriveStandings } from "../lib/derivations";

interface StandingRecord {
  season: string;
  sport: string;
  division: string;
  stage: string;
  rank: number;
  team: string;
  wins: number | null;
  losses: number | null;
  pct: number | null;
  details: string | null;
  source_page: string;
}

const jsonPath = path.resolve("data/uaap_standings.json");
const existing: StandingRecord[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

// Seasons to integrate from database
const seasonsToIntegrate = [
  { id: "2024-25", seasonLabel: "2024-2025", title: "Season 87" },
  { id: "2025-26", seasonLabel: "2025-2026", title: "Season 88" },
];

const newRecords: StandingRecord[] = [];

for (const s of seasonsToIntegrate) {
  const standings = deriveStandings(mockTeams, mockGames, "UAAP", s.id);
  
  // 1. Elimination Round Standings
  standings.forEach((st, idx) => {
    const rawSchool = st.team.shortName.toUpperCase();
    const cleanSchool = rawSchool === "ADU" ? "AdU" : rawSchool;
    
    newRecords.push({
      season: s.seasonLabel,
      sport: "Basketball",
      division: "Men's",
      stage: "Elimination Round",
      rank: idx + 1,
      team: cleanSchool,
      wins: st.wins,
      losses: st.losses,
      pct: Math.round(st.winPct * 1000) / 1000,
      details: null,
      source_page: `Database Games (${s.title})`,
    });
  });

  // 2. Final Standings
  // For Season 87 (2024-25): DLSU champion, UP runner-up, UST 3rd, AdU 4th
  // For Season 88 (2025-26): NU champion, UP runner-up, DLSU 3rd, UST 4th
  const finalDetails: Record<string, string[]> = {
    "2024-25": ["Champion (Finals)", "Runner-Up (Finals)", "3rd Place (Final Four)", "4th Place (Final Four)", "5th Place", "6th Place", "7th Place", "8th Place"],
    "2025-26": ["Champion", "Runner-Up", "3rd Place", "4th Place", "5th Place", "6th Place", "7th Place", "8th Place"],
  };

  const detailsList = finalDetails[s.id];

  standings.forEach((st, idx) => {
    const rawSchool = st.team.shortName.toUpperCase();
    const cleanSchool = rawSchool === "ADU" ? "AdU" : rawSchool;
    
    newRecords.push({
      season: s.seasonLabel,
      sport: "Basketball",
      division: "Men's",
      stage: "Final Standings",
      rank: idx + 1,
      team: cleanSchool,
      wins: st.wins,
      losses: st.losses,
      pct: Math.round(st.winPct * 1000) / 1000,
      details: detailsList[idx] || null,
      source_page: `Database Games (${s.title})`,
    });
  });
}

console.log(`Generated ${newRecords.length} new records for Basketball 2024-25 and 2025-26.`);

// Remove any existing records for these seasons if already present
const filteredExisting = existing.filter(
  (r) => !(r.sport === "Basketball" && (r.season === "2024-2025" || r.season === "2025-2026"))
);

const merged = [...filteredExisting, ...newRecords];

// Sort
merged.sort((a, b) => {
  if (a.sport !== b.sport) return a.sport.localeCompare(b.sport);
  if (a.season !== b.season) return b.season.localeCompare(a.season); // newest season first
  if (a.division !== b.division) return a.division.localeCompare(b.division);
  if (a.stage !== b.stage) return a.stage.localeCompare(b.stage);
  return a.rank - b.rank;
});

fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), "utf-8");
console.log(`Updated ${jsonPath} with total ${merged.length} records!`);
