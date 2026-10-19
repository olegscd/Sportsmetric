export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-6 md:py-8"
    >
      <div className="h-44 animate-pulse rounded-panel border border-border bg-surface" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-card border border-border bg-surface"
          />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
