import assert from "node:assert/strict";
import test from "node:test";
import { getPublishedNews, type NewsArticle } from "../../lib/news";
import { formatNewsDate } from "../../lib/news-format";

test("news publication hides drafts, scheduled and invalid dates, and sorts without mutating content", () => {
  const story: NewsArticle = { slug: "older", title: "Story", summary: "Summary", category: "Site updates",
    author: "Sportsmetric", status: "published", publishedAt: "2026-10-18T12:00:00+08:00", paragraphs: ["Body"] };
  const candidates: NewsArticle[] = [story,
    { ...story, slug: "draft", status: "draft" },
    { ...story, slug: "later", publishedAt: "2026-10-20T12:00:00+08:00" },
    { ...story, slug: "invalid", publishedAt: "invalid" },
    { ...story, slug: "newer", publishedAt: "2026-10-19T00:00:00+08:00" }];
  const result = getPublishedNews(candidates, Date.parse("2026-10-19T12:00:00+08:00"));
  assert.deepEqual(result.map(article => article.slug), ["newer", "older"]);
  assert.equal(candidates[0].slug, "older");
});

test("news dates keep the Philippine publication day around UTC midnight", () => {
  assert.equal(formatNewsDate("2026-10-18T18:00:00Z"), "October 19, 2026");
});
