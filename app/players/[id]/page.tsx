import { PlayerDetailView } from "@/components/player/PlayerDetailView";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayerDetailView id={id} />;
}
