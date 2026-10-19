import { PAGE_FRAME } from "@/components/layout/page-shell";
import { PageHeading } from "@/components/ui/PageHeading";
import { NewsFeed } from "@/components/news/NewsFeed";
import { getPublishedNews } from "@/lib/news";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("News", "Philippine sports stories and Sportsmetric updates, covering athlete performance, league statistics and the historical archive.", "/news");

export default function NewsPage() {
  return (
    <div className={PAGE_FRAME}>
      <PageHeading title="News" eyebrow="Sportsmetric / Newsroom" description="Stories from Philippine sports, plus the latest updates to Sportsmetric." />
      <NewsFeed articles={getPublishedNews()} />
    </div>
  );
}
