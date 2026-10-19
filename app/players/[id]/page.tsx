import { PlayerDetailView } from "@/components/player/PlayerDetailView";
import { notFound } from "next/navigation";
import { getPlayerPageData } from "@/lib/public-page-data";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ id: string }> };

async function profile(id: string) {
  const data = await getPlayerPageData(id);
  const player = data.players.find(player => player.id === id);
  const team = data.teams.find(team => team.id === player?.teamId);
  if (!player || !team) notFound();
  const season = data.seasons.find(season => season.id === player.seasonId);
  return { player, team, season };
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { player, team, season } = await profile(id);
  return pageMetadata(`${player.name} Stats & Profile — ${team.league}`, `${player.name} player statistics, game logs and career performance. Explore ${team.name} and ${season?.label ?? player.seasonId} records on Sportsmetric.`, `/players/${encodeURIComponent(id)}`);
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { player, team } = await profile(id);
  const path = `/players/${encodeURIComponent(id)}`;
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Person", name: player.name, url: absoluteUrl(path),
      memberOf: { "@type": "SportsTeam", name: team.name, url: absoluteUrl(`/teams/${encodeURIComponent(team.id)}`) } }} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Players", path: "/players" }, { name: player.name, path }])} />
    <PlayerDetailView id={id} />
  </>;
}
