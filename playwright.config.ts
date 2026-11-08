import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests. Needs a database with data:
 *   pnpm db:start && pnpm db:reset && pnpm pipeline:boundaries && pnpm pipeline:ised && pnpm pipeline:tiles && pnpm pipeline:dev-seed
 * then: pnpm test:e2e   (starts `next dev` on port 3200 unless E2E_BASE_URL is set)
 */
const PORT = 3200;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm dev --port ${PORT}`, url: `${baseURL}/api/meta`, reuseExistingServer: true, timeout: 120_000 },
});
