import { TeamDetailView } from "@/components/team/TeamDetailView";
import { mockTeams } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return mockTeams.map((team) => ({ id: team.id }));
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!mockTeams.some((t) => t.id === id)) {
    notFound();
  }

  return <TeamDetailView id={id} />;
}
