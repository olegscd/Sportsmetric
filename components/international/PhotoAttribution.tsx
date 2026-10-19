import type { IntlAthlete } from "@/lib/international";
import { cn } from "@/lib/utils";

/** Credit, license and source for an athlete portrait. Renders nothing without a complete attribution. */
export function PhotoAttribution({
  athlete,
  className,
}: {
  athlete: Pick<IntlAthlete, "photoUrl" | "photoCredit" | "photoLicense" | "photoSourceUrl">;
  className?: string;
}) {
  if (!athlete.photoUrl || !athlete.photoCredit || !athlete.photoLicense) return null;
  return <p className={cn("text-3xs leading-relaxed text-muted", className)}>
    Photo: {athlete.photoCredit} · {athlete.photoLicense}
    {athlete.photoSourceUrl ? <> · <a href={athlete.photoSourceUrl} target="_blank" rel="noopener noreferrer"
      className="font-semibold text-primary hover:underline">source<span className="sr-only"> (opens in a new tab)</span></a></> : null}
  </p>;
}
