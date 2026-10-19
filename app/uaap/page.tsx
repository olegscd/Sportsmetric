import { cache, Suspense } from "react";
import { UAAPArchiveView } from "@/components/uaap/UAAPArchiveView";
import { getPublicUAAPData } from "@/lib/uaap-data";
import { archiveSeo } from "@/lib/uaap-seo";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const getData = cache(getPublicUAAPData);

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const selection = archiveSeo(await getData(), await searchParams);
  return pageMetadata(selection.title, selection.description, selection.path, selection.index);
}

export default async function UAAPPage() {
  // Load the base dataset and admin overrides on the server so the browser no
  // longer downloads the static JSON *and* refetches the same payload.
  const data = await getData();

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted text-sm">Loading UAAP Archive...</div>}>
      <UAAPArchiveView initialData={data} />
    </Suspense>
  );
}
