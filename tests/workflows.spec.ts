import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, section: string) {
  await page.goto(`/admin#${section}`);
  await page.getByPlaceholder("Password", { exact: true }).fill("smoke-test-password");
  await page.getByRole("button", { name: "Enter Admin Panel" }).click();
  await expect(page.getByText("Admin Dashboard", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: section === "schedule" ? "Schedule" : section === "players" ? "Players" : "Importer", exact: true }).click();
}

test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:54329/_test/reset");
});

test("match search, Philippine dates, and reset work on a narrow phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every game");
  await page.getByRole("searchbox", { name: "Search matches" }).fill("test arena");
  await expect(page.getByRole("button", { name: "View details for AWY at HOM" })).toBeVisible();
  await page.getByLabel("Match date (PHT)").fill("2026-10-17");
  await expect(page.getByText("No games match these filters", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByRole("searchbox", { name: "Search matches" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "View details for AWY at HOM" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("match-center-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("match-center-desktop.png"), fullPage: true });
});

test("All Leagues shows the current season from every league in both directories", async ({ page }) => {
  for (const path of ["/players", "/teams"]) {
    await page.goto(path);
    await page.getByRole("button", { name: "All Leagues", exact: true }).click();
    for (const league of ["UAAP", "PBA", "PVL"]) {
      await expect(page.locator("main")).toContainText(`${league} Home`);
    }
    await expect(page.getByText("Current season in each league", { exact: true })).toBeVisible();
  }
});

test("schedule drafts survive reloads and scope changes, validate duplicates, and publish one batch", async ({ page, request }, testInfo) => {
  await login(page, "schedule");
  let fixture = page.getByRole("group", { name: "Match 1", exact: true });
  await fixture.getByLabel("Match Date", { exact: true }).fill("2099-04-19");
  await fixture.getByLabel("Tip-off Time", { exact: true }).fill("16:00");
  await fixture.getByRole("combobox", { name: "Home Team", exact: true }).selectOption("2025-26-home");
  await fixture.getByRole("combobox", { name: "Away Team", exact: true }).selectOption("2025-26-away");
  await fixture.getByLabel("Venue / Location", { exact: true }).fill("Draft Arena");
  await page.getByRole("combobox", { name: "League", exact: true }).selectOption("PBA");
  await expect(page.getByRole("combobox", { name: "Home Team", exact: true })).toHaveValue("");
  await page.getByRole("combobox", { name: "League", exact: true }).selectOption("UAAP");
  await expect(page.getByLabel("Venue / Location", { exact: true })).toHaveValue("Draft Arena");
  await page.getByRole("tab", { name: "Games", exact: true }).click();
  await page.getByRole("tab", { name: "Schedule", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Home Team", exact: true })).toHaveValue("2025-26-home");
  fixture = page.getByRole("group", { name: "Match 1", exact: true });
  await fixture.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByRole("button", { name: "Review 2 fixtures", exact: true }).click();
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText("also scheduled in match 1");
  await page.getByRole("group", { name: "Match 2", exact: true }).getByLabel("Tip-off Time", { exact: true }).fill("18:00");
  await page.getByRole("button", { name: "Review 2 fixtures", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review fixtures before publishing" })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("schedule-review-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("schedule-review-mobile.png"), fullPage: true });

  const writes: unknown[] = [];
  let failOnce = true;
  await page.route("**/api/admin/mutate", async route => {
    const body = route.request().postDataJSON();
    if (body.op === "game.batchUpsert") {
      writes.push(body);
      if (failOnce) { failOnce = false; await route.fulfill({ status: 500, json: { error: "Test write failure" } }); return; }
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Publish 2 fixtures", exact: true }).click();
  await expect(page.getByText("The fixtures could not be published. Your draft is still here; try again.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish 2 fixtures", exact: true }).click();
  await expect(page.getByText("Scheduled 2 matches.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  for (const value of writes) {
    const body = value as { games: { startTime: string }[] };
    expect(body.games).toHaveLength(2);
    expect(body.games[0].startTime).toBe("2099-04-19T08:00:00.000Z");
  }
  await expect(page.getByRole("combobox", { name: "Home Team", exact: true })).toHaveValue("");
  const data = await (await request.get("/api/sports?league=UAAP&season=2025-26")).json();
  expect(data.games.filter((game: { venue: string }) => game.venue === "Draft Arena")).toHaveLength(2);
  await page.getByRole("link", { name: "View site", exact: true }).click();
  await page.getByRole("button", { name: /^Upcoming ·/ }).click();
  await page.getByRole("combobox", { name: "Sort by", exact: true }).selectOption("oldest");
  await expect(page.getByRole("button", { name: "View details for AWY at HOM" })).toHaveCount(2);
  await page.getByLabel("Match date (PHT)").fill("2099-04-19");
  await expect(page.locator("main")).toContainText("2 matches");
});

test("roster paste surfaces bad lines and duplicates, then saves a corrected roster", async ({ page }, testInfo) => {
  await login(page, "players");
  await page.getByLabel("Target Team:", { exact: true }).selectOption("2025-26-home");
  await page.getByRole("button", { name: /Paste Bulk Roster/ }).click();
  const paste = page.getByRole("textbox", { name: "Paste roster (jersey, name, position, height)", exact: true });
  await paste.fill("7, New Player, PG, 6-0\n7, Another Player, SG, 6-1\ninvalid row");
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText("Line 2");
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText("Line 3");
  await expect(page.getByRole("button", { name: /^Import \d+ Players/ })).toBeDisabled();
  await paste.fill("1, New Player, PG, 6-0");
  await expect(page.getByRole("tabpanel").getByRole("alert")).toContainText("already in use");
  await paste.fill("7, New Player, PG, 6-0\n8, Another Player, SG, 6-1");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("roster-preview-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Import 2 Players", exact: true }).click();
  await expect(page.getByText("Successfully imported 2 players to roster!", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Players Roster (4)" })).toBeVisible();
  await page.getByRole("textbox", { name: "Quick player name", exact: true }).fill("Quick Player");
  await page.getByLabel("Quick jersey number", { exact: true }).fill("9");
  await page.getByRole("button", { name: "+ Add Row", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Quick player name", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Quick player name", exact: true })).toHaveValue("");
});

test("import previews deduplicate input and lock competition settings until the queue is cleared", async ({ page, request }) => {
  const { games } = await (await request.get("/api/sports?league=PBA")).json();
  await page.route("**/api/admin/ingest-game", route => route.fulfill({ json: { game: games[0], parsedPayload: { boxScore: { home: [], away: [] } } } }));
  await login(page, "importer");
  await page.getByRole("textbox", { name: /Game URLs or Match IDs/ }).fill("553\n553\n554");
  await page.getByRole("button", { name: "Fetch & Preview (2) Matches", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish 2 ready matches", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Target Season", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "UAAP", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Clear queue", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Target Season", exact: true })).toBeEnabled();
});
