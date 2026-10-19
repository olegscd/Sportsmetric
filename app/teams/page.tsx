import { TeamDirectory } from "@/components/team/TeamDirectory";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Philippine Sports Teams, Rosters & Records", "Find UAAP, PBA and PVL teams, season rosters, results and team statistics. Explore basketball and volleyball records on Sportsmetric.", "/teams");

export default function TeamsPage() {
  return <TeamDirectory />;
}
