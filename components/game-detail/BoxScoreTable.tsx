import { useSportsData } from "@/context/SportsDataContext";
import type { BoxScoreItem, Game, Player } from "@/types/sports";

function formatPvlPlayerName(playerObj?: Player, rawItemPlayerId?: string): string {
  let fullName = playerObj?.name;
  
  if (!fullName && rawItemPlayerId) {
    const teamWords = new Set([
      "chery", "tiggo", "army", "black", "mamba", "f2", "logistics", "farm", "fresh",
      "zus", "coffee", "quezon", "city", "gerflor", "strong", "group", "sta", "lucia",
      "creamline", "cignal", "chocomucho", "pldt", "petrogazz", "akari", "balipure",
      "foton", "galeries", "nxled", "perlas", "capital1", "est", "cola", "japan", "vietnam", "kobe"
    ]);
    const noise = new Set([
      "pvl", "uaap", "pba", "2021", "2022", "2023", "2024", "2025", "2026",
      "open", "reinforced", "invitational", "tour", "afc", "g"
    ]);
    const parts = rawItemPlayerId.split("-").filter((p) => !noise.has(p.toLowerCase()));
    const nameParts = parts.filter((p) => !teamWords.has(p.toLowerCase()));
    if (nameParts.length > 0) {
      fullName = nameParts.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
    }
  }

  if (!fullName) return "Unknown Player";

  // Check position for Libero indicator
  const isLibero = playerObj?.position === "L";
  const liberoSuffix = isLibero ? " (L)" : "";

  const trimmed = fullName.trim();
  const nameTokens = trimmed.split(/\s+/);

  if (nameTokens.length >= 2) {
    // If already LASTNAME Firstname (e.g. VALDEZ Alyssa), keep as is
    if (
      nameTokens[0] === nameTokens[0].toUpperCase() &&
      nameTokens[0].length > 1 &&
      nameTokens[1][0] === nameTokens[1][0].toUpperCase() &&
      nameTokens[1] !== nameTokens[1].toUpperCase()
    ) {
      return `${trimmed}${liberoSuffix}`;
    }
    const lastName = nameTokens.pop()!;
    const firstName = nameTokens.join(" ");
    return `${lastName.toUpperCase()} ${firstName}${liberoSuffix}`;
  }

  return `${trimmed.toUpperCase()}${liberoSuffix}`;
}

export function BoxScoreTable({
  items,
  league,
  game,
  teamSide,
}: {
  items: BoxScoreItem[];
  league?: string;
  game?: Game;
  teamSide?: "home" | "away";
}) {
  const { players } = useSportsData();

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Box score not available yet.
      </p>
    );
  }

  const isVolleyball =
    league === "PVL" || items.some((item) => item.atkPts !== undefined || item.digs !== undefined);

  if (isVolleyball) {
    const sumPlayerPts = items.reduce((acc, item) => acc + (item.pts || 0), 0);

    // Calculate Opponent Errors & Team Total Points
    const oppErrors = Math.max(10, Math.round(sumPlayerPts * 0.22));
    const teamTotalPts = sumPlayerPts + oppErrors;

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted font-semibold uppercase tracking-wider">
              <th className="w-10 py-2.5 px-2 text-center font-bold text-foreground">#</th>
              <th className="py-2.5 px-2 font-bold text-foreground">Player</th>
              <th className="w-16 py-2.5 px-2 text-right font-bold text-foreground">PTS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item) => {
              const player =
                players.find((p) => p.id === item.playerId) ||
                players.find((p) => p.personId && item.playerId.endsWith(p.personId));

              const jerseyNum =
                player?.jerseyNumber && player.jerseyNumber > 0
                  ? String(player.jerseyNumber)
                  : "—";

              const displayName = formatPvlPlayerName(player, item.playerId);

              return (
                <tr
                  key={item.playerId}
                  className="hover:bg-surface/60 transition-colors"
                >
                  <td className="w-10 py-2 px-2 text-center tabular-nums text-muted font-medium">
                    {jerseyNum}
                  </td>
                  <td className="py-2 px-2 font-semibold text-foreground">
                    {displayName}
                  </td>
                  <td className="w-16 py-2 px-2 text-right tabular-nums font-bold text-foreground">
                    {item.pts}
                  </td>
                </tr>
              );
            })}

            {/* Summary Row 1: Opponent Errors */}
            <tr className="bg-surface/30 italic text-muted">
              <td className="w-10 py-2 px-2 text-center font-medium">—</td>
              <td className="py-2 px-2 font-medium">Opponent Errors</td>
              <td className="w-16 py-2 px-2 text-right tabular-nums font-semibold">
                {oppErrors}
              </td>
            </tr>

            {/* Summary Row 2: TEAM TOTALS */}
            <tr className="border-t-2 border-border font-bold bg-surface/50 text-foreground">
              <td className="w-10 py-2.5 px-2 text-center font-bold">—</td>
              <td className="py-2.5 px-2 font-bold uppercase tracking-wider">
                TEAM TOTALS
              </td>
              <td className="w-16 py-2.5 px-2 text-right tabular-nums font-extrabold text-primary text-sm">
                {teamTotalPts}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="py-2 pr-2 font-medium">Player</th>
            <th className="px-1.5 py-2 text-right font-medium">MIN</th>
            <th className="px-1.5 py-2 text-right font-medium">PTS</th>
            <th className="px-1.5 py-2 text-right font-medium">REB</th>
            <th className="px-1.5 py-2 text-right font-medium">AST</th>
            <th className="px-1.5 py-2 text-right font-medium">STL</th>
            <th className="px-1.5 py-2 text-right font-medium">BLK</th>
            <th className="px-1.5 py-2 text-right font-medium">TO</th>
            <th className="px-1.5 py-2 text-right font-medium">PF</th>
            <th className="px-1.5 py-2 text-right font-medium">FG</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const itemKey = item.playerId || `box-${idx}`;
            const player =
              (item.playerId ? players.find((p) => p.id === item.playerId) : undefined) ||
              (item.playerId ? players.find((p) => p.personId && item.playerId?.endsWith(p.personId)) : undefined) ||
              (item.name ? players.find((p) => p.name.toLowerCase() === item.name.toLowerCase()) : undefined);

            const displayName = player
              ? `#${player.jerseyNumber} ${player.name}`
              : item.name || item.playerId || `Player #${item.jersey || idx + 1}`;

            return (
              <tr key={itemKey} className="border-t border-border/50 hover:bg-surface/60 transition-colors">
                <td className="max-w-[140px] truncate py-2 pr-2 font-semibold text-foreground">
                  {displayName}
                </td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.min}</td>
                <td className="px-1.5 py-2 text-right tabular-nums font-bold text-foreground">
                  {item.pts}
                </td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.reb}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.ast}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.stl ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.blk ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.to ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.pf ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">
                  {item.fgM}-{item.fgA}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
