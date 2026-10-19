import type { Metadata } from "next";

export const SITE_URL = "https://www.sportsmetric.ph";
export const SITE_TITLE = "Philippine Sports Scores & Player Statistics | Sportsmetric";
export const SITE_DESCRIPTION = "Philippine sports scores, results, standings and player statistics. Explore UAAP basketball, PBA, PVL volleyball and the UAAP historical archive on Sportsmetric.";

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}

export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  const fullTitle = title.endsWith("| Sportsmetric") ? title : `${title} | Sportsmetric`;
  const indexable = index && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
  return {
    title: fullTitle, description,
    alternates: { canonical: absoluteUrl(path) },
    robots: { index: indexable, follow: indexable, "max-image-preview": "large" },
    openGraph: { title: fullTitle, description, url: absoluteUrl(path), siteName: "Sportsmetric", locale: "en_PH", type: "website",
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "Sportsmetric — Philippine sports scores and player statistics" }] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [absoluteUrl("/opengraph-image")] },
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Sportsmetric", url: SITE_URL,
      logo: absoluteUrl("/sportsmetric-logo.png") },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Sportsmetric", url: SITE_URL,
      description: SITE_DESCRIPTION, inLanguage: "en-PH", publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
};

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ name: "Sportsmetric", path: "/" }, ...items].map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path),
    })) };
}
