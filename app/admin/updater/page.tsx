import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { pageMetadata } from "@/lib/seo";
import { AdminLoginGate } from "../AdminLoginGate";
import { GameSyncPanel } from "@/components/admin/GameSyncPanel";

export const metadata = pageMetadata("Game updater", "Automatic schedule and result updates.", "/admin/updater", false);

export default async function UpdaterPage() {
  if (!(await isAdminAuthenticated())) return <AdminLoginGate />;
  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
    <Link href="/admin" className="text-sm text-primary underline">Back to workspace</Link>
    <div><p className="text-xs uppercase tracking-widest text-muted">Sportsmetric / Workspace</p><h1 className="mt-2 text-3xl font-bold">Game updater</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Official schedules and confirmed final scores, checked every 15 minutes. Player box scores stay with the existing report importer.</p></div>
    <GameSyncPanel />
  </main>;
}
