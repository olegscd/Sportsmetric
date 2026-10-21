import { Badge } from "@/components/ui/Badge";
import { TableShell, Td, Th } from "@/components/ui/Table";
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
    return (
      <TableShell>
        <table className="w-full min-w-[300px] text-left text-xs">
          <thead>
            <tr>
              <Th sticky className="w-10 px-2 text-center">#</Th>
              <Th className="sticky left-10 z-20 px-2">Player</Th>
              <Th numeric className="w-16 px-2">PTS</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const player =
                players.find((p) => p.id === item.playerId) ||
                players.find((p) => p.personId && item.playerId.endsWith(p.personId));

              const jerseyNum =
                player?.jerseyNumber && player.jerseyNumber > 0
                  ? String(player.jerseyNumber)
                  : item.jersey && item.jersey > 0
                    ? String(item.jersey)
                    : "—";

              const displayName =
                player?.name
                  ? formatPvlPlayerName(player, item.playerId)
                  : item.playerName
                    ? item.playerName
                    : formatPvlPlayerName(undefined, item.playerId);

              const isLibero = player?.position === "L" || Boolean(item.is_libero);

              return (
                <tr key={`${item.playerId}-${idx}`} className="transition-colors hover:bg-elevated/50">
                  <Td sticky className="w-10 px-2 text-center text-xs font-medium text-muted">
                    {jerseyNum}
                  </Td>
                  <Td className="sticky left-10 z-10 bg-surface px-2 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{displayName}</span>
                      {isLibero && (
                        <Badge tone="archive" size="sm">
                          L
                        </Badge>
                      )}
                    </span>
                  </Td>
                  <Td numeric className="w-16 px-2 text-xs font-bold">
                    {item.pts}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>
    );
  }

  return (
    <TableShell>
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead>
          <tr>
            <Th sticky className="min-w-36">Player</Th>
            <Th numeric className="px-1.5">MIN</Th>
            <Th numeric className="px-1.5">PTS</Th>
            <Th numeric className="px-1.5">REB</Th>
            <Th numeric className="px-1.5">AST</Th>
            <Th numeric className="px-1.5">STL</Th>
            <Th numeric className="px-1.5">BLK</Th>
            <Th numeric className="px-1.5">TO</Th>
            <Th numeric className="px-1.5">PF</Th>
            <Th numeric className="px-1.5">FG</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            // Row position keeps keys unique even if two rows share a player id;
            // duplicate keys make React append rows on every live refresh.
            const itemKey = `${item.playerId || "box"}-${idx}`;
            const player =
              (item.playerId ? players.find((p) => p.id === item.playerId) : undefined) ||
              (item.playerId ? players.find((p) => p.personId && item.playerId.endsWith(p.personId)) : undefined);

            const displayName = player
              ? `#${player.jerseyNumber} ${player.name}`
              : item.playerId || `Player #${idx + 1}`;

            return (
              <tr key={itemKey} className="transition-colors hover:bg-elevated/50">
                <Td sticky className="max-w-36 truncate text-xs font-semibold">
                  {displayName}
                </Td>
                <Td numeric className="px-1.5 text-xs text-muted">{item.min}</Td>
                <Td numeric className="px-1.5 text-xs font-bold">{item.pts}</Td>
                <Td numeric className="px-1.5 text-xs text-muted">{item.reb}</Td>
                <Td numeric className="px-1.5 text-xs text-muted">{item.ast}</Td>
                <Td numeric className="px-1.5 text-xs text-muted">{item.stl ?? 0}</Td>
                <Td numeric className="px-1.5 text-xs text-muted">{item.blk ?? 0}</Td>
                <Td numeric className="px-1.5 text-xs text-muted">{item.to ?? 0}</Td>
                <Td numeric className="px-1.5 text-xs text-muted">{item.pf ?? 0}</Td>
                <Td numeric className="px-1.5 text-xs text-muted">
                  {item.fgM}-{item.fgA}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}
