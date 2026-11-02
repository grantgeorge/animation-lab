import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "test-results",
  testMatch: /\d\d-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /11-reduced-motion/ },
    { name: "chromium-reduced", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }, testMatch: /11-reduced-motion/ },
    {
      name: "chromium-gpu",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `pnpm start -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
