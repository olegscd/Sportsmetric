import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/Badge";
import { getNewsArticle } from "@/lib/news";
import { formatNewsDate } from "@/lib/news-format";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getNewsArticle((await params).slug);
  if (!article) return { title: "Story not found | Sportsmetric", robots: { index: false } };
  const metadata = pageMetadata(article.title, article.summary, `/news/${article.slug}`);
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "article", publishedTime: article.publishedAt, authors: [article.author] } };
}

export default async function NewsArticlePage({ params }: Props) {
  const article = getNewsArticle((await params).slug);
  if (!article) notFound();

  return (
    <div className={PAGE_FRAME}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: article.title,
        description: article.summary, datePublished: article.publishedAt, mainEntityOfPage: absoluteUrl(`/news/${article.slug}`),
        author: { "@type": article.author === "Sportsmetric" ? "Organization" : "Person", name: article.author },
        publisher: { "@id": `${SITE_URL}/#organization` }, articleSection: article.category }} />
      <JsonLd data={breadcrumbJsonLd([{ name: "News", path: "/news" }, { name: article.title, path: `/news/${article.slug}` }])} />
      <Link href="/news" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft size={16} aria-hidden="true" />Back to news</Link>
      <article className="mx-auto w-full max-w-3xl space-y-7 pb-6">
        <header className="space-y-5 border-b border-border pb-7">
          <div className="flex flex-wrap gap-2"><Badge tone="primary">{article.category}</Badge>{article.league && <Badge tone="outline">{article.league}</Badge>}</div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">{article.title}</h1>
          <p className="text-base leading-relaxed text-muted md:text-lg">{article.summary}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"><span>By {article.author}</span><time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time></div>
        </header>
        <div className="space-y-6 text-base leading-8 text-foreground/90">
          {article.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        {article.sources?.length ? <aside className="space-y-3 rounded-card border border-border bg-surface p-5" aria-label="Story sources">
          <h2 className="text-sm font-bold text-foreground">Sources</h2>
          <ul className="space-y-2 text-sm">{article.sources.map(source => <li key={source.href}><a href={source.href} className="text-primary underline underline-offset-4">{source.label}</a></li>)}</ul>
        </aside> : null}
        {article.relatedLink && <Link href={article.relatedLink.href} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/40">{article.relatedLink.label}<ArrowRight size={16} aria-hidden="true" /></Link>}
      </article>
    </div>
  );
}
