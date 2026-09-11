import { defineConfig } from "@playwright/test";
import path from "node:path";

if (!process.env.TEST_GATEWAY_URL) throw new Error("Set TEST_GATEWAY_URL to the isolated integration gateway.");
const root = process.cwd();
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 25_000 },
  use: { browserName: "chromium", viewport: { width: 1280, height: 900 }, trace: "retain-on-failure" },
  reporter: "list",
  webServer: [
    { command: "../../node_modules/.bin/next dev -p 13001", cwd: path.join(root, "apps/platform"), url: "http://localhost:13001/login", timeout: 180_000, env: { PLAYWRIGHT_TEST: "1", NEXT_PUBLIC_GATEWAY_URL: process.env.TEST_GATEWAY_URL } },
    { command: "../../node_modules/.bin/next dev -p 13002", cwd: path.join(root, "apps/admin"), url: "http://localhost:13002/login", timeout: 180_000, env: { PLAYWRIGHT_TEST: "1", NEXT_PUBLIC_GATEWAY_URL: process.env.TEST_GATEWAY_URL } },
  ],
});
