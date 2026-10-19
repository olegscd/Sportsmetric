import { test, expect } from "@playwright/test";

const title = "UAAP archive now identifies source-checked records";

test("news navigation, search, filters and article links work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main", exact: true }).filter({ visible: true }).getByRole("link", { name: "News", exact: true }).click();
  await expect(page.getByRole("heading", { name: "News", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: "PBA", exact: true }).click();
  await expect(page.getByText("No stories yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show all news", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search news" }).fill("not-a-matching-headline");
  await expect(page.getByText("No matching stories", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.locator("article")).toContainText("94 standings tables remain labeled unreviewed");
  await expect(page).toHaveTitle(`${title} | Sportsmetric`);
  await expect(page.getByRole("link", { name: "Explore the UAAP archive", exact: true })).toHaveAttribute("href", "/uaap");
  await page.getByRole("link", { name: "Back to news", exact: true }).click();
  await expect(page).toHaveURL(/\/news$/);
  await page.goto("/news/missing-story");
  await expect(page.getByText("Story not found", { exact: true })).toBeVisible();
});

test("news and the six-item navigation fit a narrow phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/news");
  const nav = page.locator("nav:visible").filter({ has: page.getByRole("link", { name: "News", exact: true }) });
  await expect(nav.getByRole("link")).toHaveCount(6);
  await expect(nav.getByRole("link", { name: "News", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("news-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("banner").filter({ visible: true }).getByRole("link", { name: "Go back", exact: true })).toHaveAttribute("href", "/news");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
