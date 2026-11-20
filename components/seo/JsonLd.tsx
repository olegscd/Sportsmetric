import { headers } from "next/headers";
import { serializeJsonLd } from "@/lib/seo";

export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Browsers hide a nonce from the DOM once CSP has read it (the attribute
  // reads back as ""), so hydration always sees a different value. Only this
  // element's attributes are exempt from the check.
  return <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
