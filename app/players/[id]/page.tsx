import { PlayerDetailView } from "@/components/player/PlayerDetailView";
import { getPlayerById } from "@/lib/data";
import { mockPlayers } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return mockPlayers.map((player) => ({ id: player.id }));
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!getPlayerById(id)) {
    notFound();
  }

  return <PlayerDetailView id={id} />;
}
