"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChip } from "@/components/ui/FilterChip";
import { SearchInput } from "@/components/ui/SearchInput";
import type { NewsArticle } from "@/lib/news";
import { formatNewsDate } from "@/lib/news-format";

const filters = ["All news", "UAAP", "PBA", "PVL", "Site updates"];

export function NewsFeed({ articles }: { articles: NewsArticle[] }) {
  const [filter, setFilter] = useState("All news");
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const visible = articles.filter(article =>
    (filter === "All news" || article.league === filter || article.category === filter) &&
    (!term || [article.title, article.summary, article.author, article.league, article.category]
      .join(" ").toLowerCase().includes(term)));

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter news" className="h-scroll flex min-w-0 gap-2 overflow-x-auto pb-1">
          {filters.map(label => <FilterChip key={label} selected={filter === label} onClick={() => setFilter(label)}>{label}</FilterChip>)}
        </div>
        <SearchInput label="Search news" placeholder="Search stories…" value={query} onChange={setQuery} className="w-full lg:max-w-xs" />
      </div>
      <p role="status" className="text-xs text-muted">{visible.length} {visible.length === 1 ? "story" : "stories"}{filter !== "All news" ? ` · ${filter}` : ""}</p>
      {visible.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {visible.map((article, index) => (
            <article
              key={article.slug}
              className={`group relative overflow-hidden rounded-card border border-white/[0.1] p-5 transition-all duration-150 ease-standard hover:border-primary/45 md:p-7 ${index === 0 ? "scoreboard-hero lg:col-span-2" : "translucent-card"}`}
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="primary">{article.category}</Badge>
                {article.league && <Badge tone="outline">{article.league}</Badge>}
                <time dateTime={article.publishedAt} className="text-xs font-medium text-muted">{formatNewsDate(article.publishedAt)}</time>
              </div>
              <h2 className={`font-display max-w-3xl font-extrabold leading-[1.08] tracking-tight text-foreground transition-colors group-hover:text-primary ${index === 0 ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"}`}>
                <Link href={`/news/${article.slug}`} className="rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{article.title}</Link>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{article.summary}</p>
              <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4 text-xs">
                <span className="font-semibold text-muted">{article.author}</span>
                <span className="inline-flex items-center gap-1 font-bold text-primary transition-transform group-hover:translate-x-0.5">Read story <ArrowUpRight size={15} aria-hidden="true" /></span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Newspaper size={21} />} title={term ? "No matching stories" : "No stories yet"}
          description={term ? "Try another search or choose a different news filter." : "Check back for published stories and updates."}
          action={(term || filter !== "All news") ? <button type="button" onClick={() => { setQuery(""); setFilter("All news"); }} className="min-h-11 rounded-control border border-border px-4 text-xs font-semibold text-foreground hover:bg-elevated">Show all news</button> : undefined} />
      )}
    </div>
  );
}
