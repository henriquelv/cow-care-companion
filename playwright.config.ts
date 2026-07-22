import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: "qa-ui.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4177",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --mode qa --host 127.0.0.1 --port 4177",
    url: "http://127.0.0.1:4177",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
