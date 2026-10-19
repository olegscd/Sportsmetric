import articles from "@/data/news.json";

export interface NewsArticle {
  slug: string;
  title: string;
  summary: string;
  category: string;
  league?: "UAAP" | "PBA" | "PVL";
  author: string;
  publishedAt: string;
  status: "draft" | "published";
  paragraphs: string[];
  relatedLink?: { label: string; href: string };
  sources?: { label: string; href: string }[];
}

/** Drafts and scheduled stories must not reach either the index or a direct URL. */
export function getPublishedNews(
  candidates: readonly NewsArticle[] = articles as NewsArticle[],
  now = Date.now(),
): NewsArticle[] {
  return candidates.filter(article => article.status === "published" &&
    Number.isFinite(Date.parse(article.publishedAt)) && Date.parse(article.publishedAt) <= now)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function getNewsArticle(slug: string): NewsArticle | undefined {
  return getPublishedNews().find(article => article.slug === slug);
}
