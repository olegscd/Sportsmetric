import { TeamDetailView } from "@/components/team/TeamDetailView";
import { notFound } from "next/navigation";
import { getTeamPageData } from "@/lib/public-page-data";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ id: string }> };

async function profile(id: string) {
  const data = await getTeamPageData(id);
  const team = data.teams.find(team => team.id === id);
  if (!team) notFound();
  return { team, season: data.seasons.find(season => season.id === team.seasonId) };
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { team, season } = await profile(id);
  return pageMetadata(`${team.name} Roster, Results & Stats — ${team.league}`, `${team.name} team profile, roster, results and statistics for ${season?.label ?? team.seasonId}. Explore ${team.league} records on Sportsmetric.`, `/teams/${encodeURIComponent(id)}`);
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { team } = await profile(id);
  const path = `/teams/${encodeURIComponent(id)}`;
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "SportsTeam", name: team.name, alternateName: team.shortName, url: absoluteUrl(path) }} />
    <JsonLd data={breadcrumbJsonLd([{ name: "Teams", path: "/teams" }, { name: team.name, path }])} />
    <TeamDetailView id={id} />
  </>;
}
