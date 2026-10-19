import { PlayerDirectory } from "@/components/player/PlayerDirectory";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Player Statistics & Athlete Profiles", "Explore player profiles, rosters, game logs and season statistics from UAAP, PBA and PVL. Follow individual performance across the seasons available on Sportsmetric.", "/players");

export default function PlayersPage() {
  return <PlayerDirectory />;
}
