export interface SitemapEntry { url: string; lastModified?: Date }

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

/** Explicit serialization: this Next version's metadata sitemap leaves query ampersands unescaped. */
export function sitemapXml(entries: SitemapEntry[]): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map(entry => `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastModified ? `<lastmod>${entry.lastModified.toISOString()}</lastmod>` : ""}</url>`).join("\n") +
    "\n</urlset>";
}
