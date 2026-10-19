import Link from "next/link";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NewsNotFound() {
  return <div className={PAGE_FRAME}><EmptyState title="Story not found" description="This story is unavailable or has not been published yet."
    action={<Link href="/news" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Back to news</Link>} /></div>;
}
