import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3417",
    viewport: { width: 1480, height: 940 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/create-fixture.mjs && pnpm dev --port 3417",
    url: "http://127.0.0.1:3417",
    reuseExistingServer: !process.env.CI,
    env: { GITGROVE_DATA_DIR: path.resolve(".context/test-state") },
    timeout: 60000,
  },
});
