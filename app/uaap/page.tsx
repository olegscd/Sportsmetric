import { Suspense } from "react";
import { UAAPArchiveView } from "@/components/uaap/UAAPArchiveView";
import { getMergedUAAPData } from "@/lib/uaap-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "UAAP Multi-Sport Archive | Sportsmetric",
  description: "Official historical team standings and win-loss records across all UAAP sports.",
};

export default async function UAAPPage() {
  // Load the base dataset and admin overrides on the server so the browser no
  // longer downloads the static JSON *and* refetches the same payload.
  const data = await getMergedUAAPData();

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted text-sm">Loading UAAP Archive...</div>}>
      <UAAPArchiveView initialData={data} />
    </Suspense>
  );
}
