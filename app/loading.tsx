export default function Loading() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-border bg-surface"
        />
      ))}
    </div>
  );
}
