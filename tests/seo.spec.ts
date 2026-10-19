import { test, expect } from "@playwright/test";
import { load } from "cheerio";

const origin = "https://www.sportsmetric.ph";
const crawler = { "User-Agent": "Googlebot" };

test("crawl endpoints expose public canonical URLs and exclude private, future and withheld pages", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = load(await response.text(), { xmlMode: true });
  const urls = xml("loc").map((_, node) => xml(node).text()).get();
  expect(urls).toContain(`${origin}/leagues/pba`);
  expect(urls).toContain(`${origin}/players/pba-2026-home-player`);
  expect(urls).toContain(`${origin}/teams/pvl-2026-home`);
  expect(urls.some(url => url.includes("/admin") || url.includes("/api/") || url.includes("/international"))).toBe(false);
  expect(urls.filter(url => url.includes("Chess") && url.includes("2003-2004") && url.includes("Juniors")).every(url => url.includes("tab=awards"))).toBe(true);
  expect(new Set(urls).size).toBe(urls.length);
  const admin = await request.get("/admin");
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");
  expect(load(await admin.text())('meta[name="robots"]').attr("content")).toContain("noindex");
});

test("player and team metadata are specific, server rendered and bound to safe structured data", async ({ request }) => {
  const response = await request.get("/players/2025-26-home-player", { headers: crawler });
  const html = load(await response.text());
  expect(html("title").text()).toContain("UAAP Home Player Stats & Profile");
  expect(html('link[rel="canonical"]').attr("href")).toBe(`${origin}/players/2025-26-home-player`);
  expect(html("h1").text()).toContain("UAAP Home Player");
  const scripts = html('script[type="application/ld+json"]');
  const person = scripts.map((_, script) => JSON.parse(html(script).html()!)).get().find(data => data["@type"] === "Person");
  expect(person.name).toBe("UAAP Home Player");
  expect(person.nationality).toBeUndefined();
  for (const script of scripts.toArray()) expect(response.headers()["content-security-policy"]).toContain(`'nonce-${html(script).attr("nonce")}'`);
  const team = load(await (await request.get("/teams/pvl-2026-home", { headers: crawler })).text());
  expect(team("title").text()).toContain("PVL Home Roster, Results & Stats");
  expect(team('link[rel="canonical"]').attr("href")).toBe(`${origin}/teams/pvl-2026-home`);
  const missing = load(await (await request.get("/players/not-a-player", { headers: crawler })).text());
  expect(missing('meta[name="robots"]').map((_, node) => missing(node).attr("content")).get().some(value => value?.includes("noindex"))).toBe(true);
});

test("league pages show the matching league and work without client JavaScript", async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("/leagues/pba");
    await expect(page.getByRole("heading", { name: "PBA scores, standings and player stats", exact: true })).toBeVisible();
    await expect(page.locator("main")).toContainText("PBA Home Player");
    await expect(page.locator("main")).not.toContainText("PVL Home Player");
    await expect(page.getByRole("link", { name: "PBA Home Player", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "PVL", exact: true }).click();
    await expect(page.getByRole("heading", { name: "PVL scores, standings and player stats", exact: true })).toBeVisible();
    const missing = load(await (await request.get("/leagues/invalid", { headers: crawler })).text());
    expect(missing('meta[name="robots"]').map((_, node) => missing(node).attr("content")).get().some(value => value?.includes("noindex"))).toBe(true);
  } finally { await context.close(); }
});

test("archive selections, news schema and the social card expose accurate search metadata", async ({ request }) => {
  const archive = load(await (await request.get("/uaap?sport=Basketball&season=1998-1999&division=Men&tab=standings&utm_source=test", { headers: crawler })).text());
  expect(archive("title").text()).toContain("1998-1999 UAAP Basketball Men's Standings");
  expect(archive('link[rel="canonical"]').attr("href")).not.toContain("utm_source");
  expect(archive('link[rel="canonical"]').attr("href")).toContain("division=Men%27s");
  const article = load(await (await request.get("/news/uaap-archive-source-checked-records", { headers: crawler })).text());
  expect(article('script[type="application/ld+json"]').toArray().some(script => JSON.parse(article(script).html()!)["@type"] === "Article")).toBe(true);
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
});
