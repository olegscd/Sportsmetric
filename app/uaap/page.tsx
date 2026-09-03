import { Suspense } from "react";
import { UAAPArchiveView } from "@/components/uaap/UAAPArchiveView";

export const metadata = {
  title: "UAAP Multi-Sport Archive | Sportsmetric",
  description: "Official historical team standings and win-loss records across all UAAP sports.",
};

export default function UAAPPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted text-sm">Loading UAAP Archive...</div>}>
      <UAAPArchiveView />
    </Suspense>
  );
}
