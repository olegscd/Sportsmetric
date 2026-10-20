import { expect, test } from "@playwright/test";

test("replay admin and cron endpoints require authentication", async ({ request }) => {
  expect((await request.get("/api/admin/replay-sync")).status()).toBe(401);
  expect((await request.post("/api/admin/replay-sync", { data: { action: "scan" } })).status()).toBe(401);
  expect((await request.post("/api/cron/replay-suggest")).status()).toBe(401);
  expect((await request.post("/api/cron/replay-suggest", { headers: { Authorization: "Bearer wrong-token-with-valid-length-1234567890" } })).status()).toBe(401);
});

test("admin can review PVL/PBA suggestions and publish only the approved replay", async ({ page, request }, testInfo) => {
  const fixture = "http://127.0.0.1:54329";
  await request.get(`${fixture}/_test/reset`);
  await page.route("https://i.ytimg.com/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#202934"/><text x="80" y="65" text-anchor="middle" font-size="12" fill="white">Video thumbnail</text></svg>' }));
  const ids = { PVL: "00000000-0000-4000-8000-000000000001", PBA: "00000000-0000-4000-8000-000000000002" };
  try {
    for (const league of ["PVL", "PBA"] as const) {
      const season = `${league.toLowerCase()}-2026`;
      await request.post(`${fixture}/rest/v1/games`, { data: { id: `${season}-g1`, watch_url: `https://watch.example/${league}`, tickets_url: `https://tickets.example/${league}` } });
      await request.post(`${fixture}/rest/v1/replay_channels`, { data: { league, channel_id: "UCabcdefghijklmnopqrstuv", label: "Official broadcaster", enabled: true, league_specific: false } });
      await request.post(`${fixture}/rest/v1/replay_suggestions`, { data: {
        id: ids[league], game_id: `${season}-g1`, status: "pending", video_id: "abcdefghijk", video_url: "https://www.youtube.com/watch?v=abcdefghijk",
        title: `${league} Home vs Away FULL GAME`, channel_title: "Official broadcaster", channel_id: "UCabcdefghijklmnopqrstuv",
        published_at: "2026-10-18T14:00:00Z", duration_seconds: 5400, kind: "full", score: 0.95,
        match_reasons: ["Both teams found in the title.", "Uploader is on the league's official allowlist."], inferred_kind_reason: "Title identifies a full game.",
      } });
    }
    await page.goto("/admin");
    await page.getByPlaceholder("Password", { exact: true }).fill("smoke-test-password");
    await page.getByRole("button", { name: "Enter Admin Panel" }).click();
    await page.getByRole("tab", { name: "Games", exact: true }).click();
    await page.getByRole("combobox", { name: "Viewing Season", exact: true }).selectOption("pvl-2026");
    const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: "Replay suggestions", exact: true }) });
    await expect(panel.getByText("PVL Home vs Away FULL GAME", { exact: true })).toBeVisible();
    await expect(panel.getByText("PBA Home vs Away FULL GAME", { exact: true })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Find recent PVL replays", exact: true })).toBeDisabled(); // no production API key in browser fixtures
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.screenshot({ path: testInfo.outputPath("replay-review-mobile.png") });
    await panel.getByRole("button", { name: "Approve replay", exact: true }).click();
    await expect(panel.getByText("No pending suggestions for this season.", { exact: false })).toBeVisible();
    const game = (await (await request.get(`${fixture}/rest/v1/games?id=eq.pvl-2026-g1`)).json())[0];
    expect(game.replay_url).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(game.replay_label).toBe("Official broadcaster");
    expect(game.watch_url).toBe("https://watch.example/PVL");
    expect(game.tickets_url).toBe("https://tickets.example/PVL");
    await page.getByRole("combobox", { name: "Viewing Season", exact: true }).selectOption("pba-2026");
    await expect(panel.getByText("PBA Home vs Away FULL GAME", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(panel.getByText("No pending suggestions for this season.", { exact: false })).toBeVisible();
    const pba = (await (await request.get(`${fixture}/rest/v1/games?id=eq.pba-2026-g1`)).json())[0];
    expect(pba.replay_url).toBeUndefined();
    await page.goto("/");
    await page.getByRole("button", { name: "PVL", exact: true }).click();
    await expect(page.getByRole("link", { name: /Replay.*Official broadcaster/ })).toHaveAttribute("href", game.replay_url);
  } finally { await request.get(`${fixture}/_test/reset`); }
});
