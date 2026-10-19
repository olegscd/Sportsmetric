import type { Metadata } from "next";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { PageHeading } from "@/components/ui/PageHeading";
import { NewsFeed } from "@/components/news/NewsFeed";
import { getPublishedNews } from "@/lib/news";

export const metadata: Metadata = {
  title: "News | Sportsmetric",
  description: "Stories and updates from Sportsmetric, covering Philippine sports and the historical archive.",
};

export default function NewsPage() {
  return (
    <div className={PAGE_FRAME}>
      <PageHeading title="News" eyebrow="Sportsmetric / Newsroom" description="Stories from Philippine sports, plus the latest updates to Sportsmetric." />
      <NewsFeed articles={getPublishedNews()} />
    </div>
  );
}
