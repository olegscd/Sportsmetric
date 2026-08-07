import { TeamDetailView } from "@/components/team/TeamDetailView";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeamDetailView id={id} />;
}
