import { expect, test } from "@playwright/test";

test("game cards and details use a single game-specific replay or livestream", async ({ page, request }, testInfo) => {
  const fixtureServer = "http://127.0.0.1:54329";
  await request.get(`${fixtureServer}/_test/reset`);
  try {
    await request.post(`${fixtureServer}/rest/v1/seasons`, { data: {
      id: "2025-26", watch_url: "https://season.example/watch", watch_label: "Season broadcaster",
      tickets_url: "https://season.example/tickets", tickets_label: "Season tickets",
    } });
    for (const status of ["UPCOMING", "LIVE", "FINAL"] as const) {
      await request.post(`${fixtureServer}/rest/v1/games`, { data: {
        id: "2025-26-g1", status, watch_url: "https://stream.example/current-game",
        replay_url: "https://replay.example/this-game", replay_kind: "full", replay_label: "Official channel",
      } });
      await page.goto("/");
      const card = page.locator("article").filter({ has: page.getByRole("button", { name: "View details for AWY at HOM" }) });
      const externalLinks = card.locator('a[target="_blank"]');
      await expect(externalLinks).toHaveCount(status === "UPCOMING" ? 2 : 1);
      if (status === "UPCOMING") {
        await expect(card.getByRole("link", { name: /Tickets/ })).toHaveAttribute("href", "https://season.example/tickets");
        await expect(card.getByRole("link", { name: /Watch/ })).toHaveAttribute("href", "https://stream.example/current-game");
        continue;
      }
      const url = status === "FINAL" ? "https://replay.example/this-game" : "https://stream.example/current-game";
      await expect(externalLinks).toHaveAttribute("href", url);
      await expect(externalLinks).toContainText(status === "FINAL" ? "Replay" : "Livestream");
      expect((await externalLinks.boundingBox())!.height).toBeLessThanOrEqual(32);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(externalLinks).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${status.toLowerCase()}-link-mobile.png`), fullPage: true });
      await card.getByRole("button", { name: "View details for AWY at HOM" }).click();
      const dialogLinks = page.getByRole("dialog").locator('a[target="_blank"]');
      await expect(dialogLinks).toHaveCount(1);
      await expect(dialogLinks).toHaveAttribute("href", url);
      await page.keyboard.press("Escape");
    }
    for (const status of ["LIVE", "FINAL"] as const) {
      await request.post(`${fixtureServer}/rest/v1/games`, { data: {
        id: "2025-26-g1", status, watch_url: null, replay_url: null, replay_kind: null,
      } });
      await page.goto("/");
      const card = page.locator("article").filter({ has: page.getByRole("button", { name: "View details for AWY at HOM" }) });
      await expect(card).toBeVisible();
      await expect(card.locator('a[target="_blank"]')).toHaveCount(0);
    }
  } finally {
    await request.get(`${fixtureServer}/_test/reset`);
  }
});
