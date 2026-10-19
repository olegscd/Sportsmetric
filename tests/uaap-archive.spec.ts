import { test, expect } from "@playwright/test";

const detail = (sport: string, season: string, division: string, tab = "standings") =>
  `/uaap?${new URLSearchParams({ sport, season, division, tab })}`;

test("corrected placements retain round scope, source references and matching awards", async ({ page }) => {
  await page.goto(detail("Basketball", "1998-1999", "Men's"));
  const main = page.locator("main");
  await expect(main).toContainText("Source checked");
  await expect(main).toContainText("W/L and calculated PCT are the record after two rounds");
  await expect(main).toContainText("IMG_1312");
  const rows = page.locator("tbody tr");
  await expect(rows.nth(0)).toContainText("DLSU");
  await expect(rows.nth(1)).toContainText("FEU");
  await expect(rows.nth(4)).toContainText("UP");
  await page.getByRole("link", { name: "Awards", exact: true }).click();
  await expect(main).toContainText("Don Carlos Allado");
  await expect(main).toContainText("Jose Enrico Villanueva");
  await expect(main).not.toContainText("Anton Paolo del Mundo");
});

test("awards exclude show-through contamination and leaders follow the selected division", async ({ page }, testInfo) => {
  await page.goto(detail("Badminton", "1998-1999", "Women's", "awards"));
  await expect(page.locator("main")).toContainText("Kennie C. Asuncion");
  await expect(page.locator("main")).not.toContainText("Don Carlos");
  await expect(page.locator("main")).not.toContainText("Villanueva");
  await page.goto(detail("Basketball", "2003-2004", "Men's", "leaders"));
  await expect(page.getByRole("heading", { name: "Scoring average (PTS/G)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Three-point percentage (%)" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Minimum 12 three-point field goals made");
  await expect(page.locator("main")).toContainText("Tang, Tyrone");
  await page.screenshot({ path: testInfo.outputPath("archive-leaders-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("archive-leaders-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Women's", exact: true }).click();
  await expect(page.getByRole("link", { name: "Leaders", exact: true })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Cardona, Mark");
  await expect(page.locator("main")).not.toContainText("Tang, Tyrone");
});

test("disputed records are withheld and limited coverage is explicit", async ({ page }) => {
  await page.goto(detail("Chess", "2003-2004", "Juniors"));
  await expect(page.locator("main")).toContainText("Withheld for source review");
  await expect(page.locator("tbody:visible")).toContainText("withheld while the source conflict is resolved");
  await page.getByRole("link", { name: "Awards", exact: true }).click();
  await expect(page.locator("main")).toContainText("Board 6");
  await expect(page.locator("main")).toContainText("Queseng, John");
  await expect(page.locator("main")).not.toContainText("100.66");
  await page.goto(detail("Track and Field", "1987-1988", "Men's"));
  await expect(page.locator("main")).toContainText("Champion-only coverage");
  await expect(page.locator("tbody:visible tr")).toHaveCount(1);
  await expect(page.locator("main")).toContainText("other placements");
});

test("public API withholds blocked rows and unreviewed extras; candidate access requires login", async ({ request }) => {
  expect((await request.get("/api/uaap/data?admin=1")).status()).toBe(401);
  const response = await request.get("/api/uaap/data");
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.extras.awards["Badminton|1998-1999"]["Women's"].mvp.player).toBe("Kennie C. Asuncion");
  expect(data.extras.awards["Badminton|1998-1999"]["Men's"]).toBeUndefined();
  expect(data.tables.filter((t: { review: { status: string }; rows: unknown[] }) =>
    t.review.status === "blocked").every((t: { rows: unknown[] }) => t.rows.length === 0)).toBe(true);
});

test("an authenticated source check publishes an edited award and ordinary saves revoke table approval", async ({ page, request }) => {
  await request.get("http://127.0.0.1:54329/_test/reset");
  await page.goto("/admin?tab=uaap");
  await page.getByPlaceholder("Password", { exact: true }).fill("smoke-test-password");
  await page.getByRole("button", { name: "Enter Admin Panel" }).click();
  await page.getByRole("tab", { name: "UAAP Archive", exact: true }).click();
  await page.getByLabel("Season", { exact: true }).selectOption("1998-1999");
  await page.getByLabel("Sport", { exact: true }).selectOption("Basketball");
  await page.getByLabel("I checked every table value and award against the original source pages.").check();
  await page.getByLabel("Reviewer name", { exact: true }).fill("Test source reviewer");
  await page.getByLabel("Original source page IDs", { exact: true }).fill("IMG_1312");
  await page.getByLabel("Source section heading", { exact: true }).fill("Men's final results and individual awards");
  await Promise.all([
    page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/admin"),
    page.getByRole("button", { name: "Save (Ctrl+S)", exact: true }).click(),
  ]);
  await expect(page.getByText(/Saved 1998-1999 Basketball/)).toBeVisible();
  let data = await (await request.get("/api/uaap/data")).json();
  expect(data.extras.awards["Basketball|1998-1999"]["Men's"].mvp.player).toBe("Don Carlos Allado");
  expect(data.tables.find((t: { season: string; sport: string; division: string }) =>
    t.season === "1998-1999" && t.sport === "Basketball" && t.division === "Men's").review.reviewer).toBe("Test source reviewer");
  // Reloaded data clears the checkbox. Saving again must not copy the old review.
  await expect(page.getByLabel("I checked every table value and award against the original source pages.")).not.toBeChecked();
  await Promise.all([
    page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/admin"),
    page.getByRole("button", { name: "Save (Ctrl+S)", exact: true }).click(),
  ]);
  data = await (await request.get("/api/uaap/data")).json();
  // The table cannot copy its loaded approval during an ordinary save.
  expect(data.tables.find((t: { season: string; sport: string; division: string }) =>
    t.season === "1998-1999" && t.sport === "Basketball" && t.division === "Men's").review.status).toBe("needs_review");
  await request.get("http://127.0.0.1:54329/_test/reset");
});
