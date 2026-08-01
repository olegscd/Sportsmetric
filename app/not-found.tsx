import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-lg font-bold text-foreground">Not found</p>
      <p className="text-sm text-muted">
        We couldn&apos;t find what you were looking for.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Back to Match Center
      </Link>
    </div>
  );
}
