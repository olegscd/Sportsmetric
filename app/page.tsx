import { MatchCenter } from "@/components/match-center/MatchCenter";
import { pageMetadata, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";

export const metadata = pageMetadata(SITE_TITLE, SITE_DESCRIPTION, "/");

export default function HomePage() {
  return <MatchCenter />;
}
