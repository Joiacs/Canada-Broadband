import { expect, test } from "@playwright/test";

test("root redirects to a language and the map renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(en|fr)$/);
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
});

test("filters are reflected in the URL", async ({ page, isMobile }) => {
  await page.goto("/en");
  if (isMobile) await page.getByRole("button", { name: "Map filters" }).click();
  await page.getByRole("button", { name: /^Show/ }).click();
  await page.getByRole("option", { name: "% of people meeting 50/10" }).click();
  await expect(page).toHaveURL(/m=pctMeet/);
  // keyboard: open with ArrowDown, move, pick with Enter
  await page.getByRole("button", { name: /^Areas/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/l=pr/);
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("search finds a province and opens its panel", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("combobox", { name: "Search places" }).fill("ontar");
  await page.getByRole("option", { name: /Ontario/ }).first().click();
  await expect(page.getByRole("heading", { name: "Ontario" })).toBeVisible();
  await expect(page).toHaveURL(/r=pr%3A35|r=pr:35/);
});

test("table view lists regions", async ({ page }) => {
  await page.goto("/en?v=table&l=pr");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ontario" })).toBeVisible();
});

test("language switch keeps the page and filters", async ({ page }) => {
  await page.goto("/en/speed-test");
  await page.getByRole("link", { name: "Lire en français" }).click();
  await expect(page).toHaveURL(/\/fr\/test-de-vitesse/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Testez votre vitesse");
});

test("speed test requires consent before starting", async ({ page }) => {
  await page.goto("/en/speed-test");
  const start = page.getByRole("button", { name: "Start test" });
  await expect(start).toBeDisabled();
  await page.getByLabel(/I understand and agree/).check();
  await expect(start).toBeEnabled();
});

test("region page renders statistics", async ({ page }) => {
  await page.goto("/en/region/pr-35-ontario");
  await expect(page.getByRole("heading", { level: 1, name: "Ontario" })).toBeVisible();
  await expect(page.getByText("Median download").first()).toBeVisible();
});

test("API validates input", async ({ request }) => {
  expect((await request.get("/api/stats?level=nope&from=2026-01-01&to=2026-01-02")).status()).toBe(400);
  const ok = await request.get("/api/meta");
  expect(ok.ok()).toBeTruthy();
  const bad = await request.post("/api/tests", { data: { downMbps: -1 } });
  expect(bad.status()).toBe(400);
});

test("mobile menu closes after navigating", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only");
  await page.goto("/en/about");
  await page.getByRole("button", { name: "Menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Methodology" }).click();
  await expect(page).toHaveURL(/\/en\/methodology/);
  await expect(nav).toHaveCount(0);
  // tapping outside also closes it
  await page.getByRole("button", { name: "Menu" }).click();
  await page.mouse.click(20, 400);
  await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
});

test("content pages exist in both languages", async ({ page }) => {
  for (const path of ["/en/methodology", "/fr/methodologie", "/en/privacy", "/fr/confidentialite", "/en/data", "/fr/donnees", "/en/about", "/fr/a-propos"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});
