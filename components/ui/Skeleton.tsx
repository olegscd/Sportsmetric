import { cn } from "@/lib/utils";

/**
 * Placeholder block shown while Supabase data loads. Sized to match the real
 * content so the layout does not jump when data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-elevated/70", className)}
    />
  );
}

export function SkeletonCardGrid({
  count = 6,
  height = "h-36",
}: {
  count?: number;
  height?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-2xl", height)} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
