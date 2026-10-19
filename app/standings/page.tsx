import { StandingsView } from "@/components/standings/StandingsView";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Philippine League Standings & Statistical Leaders", "Compare UAAP, PBA and PVL team standings and statistical leaders by season. Explore published team records and athlete performance on Sportsmetric.", "/standings");

export default function StandingsPage() {
  return <StandingsView />;
}
