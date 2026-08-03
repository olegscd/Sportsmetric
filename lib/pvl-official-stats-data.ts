import pvlOfficialPlayerStats from "@/scripts/generated/pvl-official-player-stats.json";

export interface PvlOfficialPlayerStatItem {
  playerSlug: string;
  playerName: string;
  team: string | null;
  position: string | null;
  jersey: number | null;
  height: string | null;
  school: string | null;
  statType: "career" | "conference";
  conferenceId: number | null;
  conferenceName: string | null;
  setsPlayed: number;
  totalPoints: number;
  avgPerSet: number;
  ptsAtk: number;
  ptsBlk: number;
  ptsAce: number;
  exeSet: number;
  exeDig: number;
  exeRec: number;
  faultAtk: number;
  faultBlk: number;
  faultSrv: number;
  faultSet: number;
  faultDig: number;
  faultRec: number;
  totalAtk: number;
  totalBlk: number;
  totalAce: number;
  totalSet: number;
  totalDig: number;
  totalRec: number;
  avgAtk: number;
  avgBlk: number;
  avgAce: number;
  avgSet: number;
  avgDig: number;
  avgRec: number;
  successAtk: number;
  successBlk: number;
  successAce: number;
  successSet: number;
  successDig: number;
  successRec: number;
  efficiencyAtk: number;
  efficiencyBlk: number;
  efficiencyAce: number;
  efficiencySet: number;
  efficiencyDig: number;
  efficiencyRec: number;
}

export interface PvlOfficialPlayerRecord {
  playerSlug: string;
  playerName: string;
  position: string | null;
  jersey: number | null;
  height: string | null;
  school: string | null;
  career: PvlOfficialPlayerStatItem | null;
  conferences: PvlOfficialPlayerStatItem[];
}

const statsData = pvlOfficialPlayerStats as Record<string, PvlOfficialPlayerRecord>;

export function getOfficialPvlPlayerStats(personIdOrSlug: string, name?: string): PvlOfficialPlayerRecord | null {
  if (!personIdOrSlug) return null;
  const slug = personIdOrSlug.toLowerCase();
  if (statsData[slug]) return statsData[slug];

  if (name) {
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (statsData[nameSlug]) return statsData[nameSlug];
  }

  const foundKey = Object.keys(statsData).find(
    (k) => slug.endsWith(k) || k.endsWith(slug)
  );

  return foundKey ? statsData[foundKey] : null;
}
