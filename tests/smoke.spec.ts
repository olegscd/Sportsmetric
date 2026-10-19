import { test, expect } from "@playwright/test";

test("match center is rendered on the server and loads play-by-play on demand", async ({ page, request }) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain("Test Arena");
  const policy = response.headers()["content-security-policy"];
  expect(policy).toContain("'nonce-");
  expect(policy.split(";").find(part => part.includes("script-src"))).not.toContain("unsafe-inline");
  let detailsRequests = 0;
  page.on("request", req => { if (req.url().includes("/api/games/")) detailsRequests++; });
  await page.goto("/");
  await page.getByRole("button", { name: "View details for AWY at HOM" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(detailsRequests).toBe(0);
  await dialog.getByRole("button", { name: "Play-by-Play", exact: true }).click();
  await expect(dialog.getByText("Play-by-play not available yet.")).toBeVisible();
  expect(detailsRequests).toBe(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "View details for AWY at HOM" })).toBeFocused();
});

test("standings, directories, archive and direct detail links load", async ({ page }) => {
  for (const path of ["/standings", "/players", "/teams", "/players/2025-26-home-player", "/teams/2025-26-home", "/uaap"]) {
    const errors: string[] = [];
    const onError = (error: Error) => errors.push(error.message);
    page.on("pageerror", onError);
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Something went wrong");
    if (path === "/players") await expect(page.locator("main")).toContainText("UAAP Home Player");
    if (path === "/teams/2025-26-home") await expect(page.locator("main")).toContainText("Roster");
    if (path === "/uaap") await expect(page.locator("main")).toContainText("Basketball");
    expect(errors).toEqual([]);
    page.off("pageerror", onError);
  }
});

test("league switches query only the selected season and omit play-by-play", async ({ page }) => {
  await page.goto("/");
  const pending = page.waitForResponse(response => response.url().includes("/api/sports?") && response.url().includes("league=PVL"));
  await page.getByRole("button", { name: "PVL", exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.teams.every((team: { league: string }) => team.league === "PVL")).toBe(true);
  expect(data.games[0].playByPlay).toEqual([]);
  await expect(page.locator("main")).toContainText("PVL Home");
});

test("login creates a revocable session; a copied cookie stops working after logout", async ({ page, request }) => {
  expect((await request.get("/api/sports?admin=1")).status()).toBe(401);
  expect((await request.post("/api/admin/mutate", { data: {} })).status()).toBe(401);
  await page.goto("/admin");
  const passwordInput = page.getByPlaceholder("Password", { exact: true });
  await expect(passwordInput).toHaveAttribute("type", "password");
  await page.getByLabel("Show password", { exact: true }).check();
  await expect(passwordInput).toHaveAttribute("type", "text");
  await page.getByLabel("Show password", { exact: true }).uncheck();
  await passwordInput.fill("incorrect-test-password");
  await page.getByRole("button", { name: "Enter Admin Panel" }).click();
  await expect(page.getByText("Incorrect password. Use the admin password configured for this site.", { exact: true })).toBeVisible();
  expect((await page.context().cookies()).find(cookie => cookie.name === "sportsmetric_admin")).toBeUndefined();
  await page.getByPlaceholder("Password", { exact: true }).fill("smoke-test-password");
  await page.getByRole("button", { name: "Enter Admin Panel" }).click();
  await expect(page.getByText("Admin Dashboard", { exact: true })).toBeVisible();
  const cookie = (await page.context().cookies()).find(cookie => cookie.name === "sportsmetric_admin")!;
  expect(cookie.value).toMatch(/^[a-f0-9]{64}$/);
  const headers = { Cookie: `${cookie.name}=${cookie.value}` };
  expect((await request.get("/api/sports?admin=1", { headers })).status()).toBe(200);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Admin Access", { exact: true })).toBeVisible();
  expect((await request.get("/api/sports?admin=1", { headers })).status()).toBe(401);
});

test("database outages keep navigation and a working retry instead of crashing the root layout", async ({ page, request }) => {
  await request.post("http://127.0.0.1:54329/_test/database?fail=1");
  try {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    await expect(page.getByText("Sportsmetric hit an error", { exact: true })).not.toBeVisible();
  } finally {
    await request.post("http://127.0.0.1:54329/_test/database?fail=0");
  }
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "View details for AWY at HOM" })).toBeVisible();
});
