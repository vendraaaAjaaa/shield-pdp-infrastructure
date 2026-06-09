import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "NEXT_PUBLIC_SHIELD_API_BASE_URL= SHIELD_API_BASE_URL= ./node_modules/.bin/next dev -H 127.0.0.1 -p 3210",
    url: "http://127.0.0.1:3210/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
