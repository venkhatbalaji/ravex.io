import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

const gateway = process.env.TEST_GATEWAY_URL!;
const platform = "http://localhost:13001";
const admin = "http://localhost:13002";
const adminCredentials = { email: "admin@integration.test", password: "integration-only-admin-password-123" };

async function adminHeaders(request: APIRequestContext) {
  const response = await request.post(`${gateway}/auth/login`, { data: adminCredentials });
  expect(response.ok()).toBeTruthy();
  return { Authorization: `Bearer ${(await response.json()).accessToken}` };
}

test("players and operators can search, filter and page market lists", async ({ page, request }) => {
  const headers = await adminHeaders(request);
  const prefix = `Browse ${randomUUID().slice(0, 8)}`;
  const categoryResponse = await request.post(`${gateway}/categories`, { headers, data: { name: prefix } });
  expect(categoryResponse.ok()).toBeTruthy();
  const category = await categoryResponse.json();
  const items = [];
  for (let i = 0; i < 22; i++) {
    const response = await request.post(`${gateway}/markets`, { headers, data: {
      title: `${prefix} ${i}`, eventStartAt: new Date(Date.now() + 86_400_000).toISOString(), outcomes: ["Home", "Away"],
      categoryId: i < 21 ? category.id : null,
    } });
    expect(response.ok()).toBeTruthy(); items.push(await response.json());
  }
  await page.goto(platform);
  await page.getByLabel("Search markets", { exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Filter by category").selectOption(category.id);
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(20);
  const firstTitles = await page.getByRole("heading", { level: 3 }).allTextContents();
  const pages = page.getByRole("navigation", { name: "Market pages" });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pages).toContainText("Page 2");
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
  expect(firstTitles).not.toContain(await page.getByRole("heading", { level: 3 }).textContent());
  await expect(pages.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByLabel("Market phase").selectOption("completed");
  await expect(pages).toContainText("Page 1");
  await expect(page.getByText("No markets match these filters. Try clearing them.")).toBeVisible();
  const cancelled = items[0];
  expect((await request.post(`${gateway}/markets/${cancelled.id}/cancel`, { headers, data: { reason: "Browser filter fixture" } })).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 3, name: cancelled.title, exact: true })).toBeVisible();
  await page.getByLabel("Market phase").selectOption("upcoming");
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(20);
  await expect(page.getByRole("heading", { level: 3, name: cancelled.title, exact: true })).toHaveCount(0);
  await page.route("**/markets/browse?*", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Unavailable"}' }));
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Cannot load markets" })).toBeVisible();
  await page.unroute("**/markets/browse?*");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Cannot load markets" })).toHaveCount(0);

  await page.goto(`${admin}/login`);
  await page.getByLabel("Email", { exact: true }).fill(adminCredentials.email);
  await page.getByLabel("Password", { exact: true }).fill(adminCredentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Markets", exact: true })).toBeVisible();
  await page.getByLabel("Search markets", { exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page.getByRole("navigation", { name: "Market pages" }).getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Market status", exact: true }).selectOption("cancelled");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText(cancelled.title);
});

test("cutoff disables new stakes while a lost-response retry keeps its original key", async ({ page, request }) => {
  const headers = await adminHeaders(request);
  const now = Date.now();
  const response = await request.post(`${gateway}/markets`, { headers, data: {
    title: `Cutoff ${randomUUID()}`, eventStartAt: new Date(now + 60_000).toISOString(), outcomes: ["Home", "Away"],
  } });
  expect(response.ok()).toBeTruthy();
  const item = await response.json();
  const email = `cutoff-${randomUUID()}@example.test`;
  const password = "browser-test-password-123";
  expect((await request.post(`${gateway}/auth/register`, { data: { email, password, displayName: "Cutoff Player" } })).ok()).toBeTruthy();
  await page.clock.install({ time: new Date(now) });
  await page.goto(`${platform}/login`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.goto(`${platform}/wallet`);
  await page.getByRole("button", { name: "Daily login bonus +50", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("+50 coins");
  await page.goto(`${platform}/markets/${item.id}`);
  await expect(page.getByText(/IST$/)).toBeVisible();
  await expect(page.getByText(/do not guarantee a payout/)).toBeVisible();
  await page.getByRole("combobox", { name: "Outcome", exact: true }).selectOption(item.outcomes[0].id);
  await page.getByLabel("Amount", { exact: true }).fill("10");
  let attemptKey: string | undefined;
  await page.route(`**/pools/${item.id}/stakes`, async route => {
    attemptKey = route.request().headers()["idempotency-key"];
    expect((await route.fetch()).ok()).toBeTruthy();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Stake", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check prediction", exact: true })).toBeEnabled();
  expect(attemptKey).toBeTruthy();
  expect((await request.post(`${gateway}/markets/${item.id}/lock`, { headers })).ok()).toBeTruthy();
  await page.clock.fastForward(65_000);
  await expect(page.getByText("This market is closed to new predictions.")).toBeVisible();
  await page.unroute(`**/pools/${item.id}/stakes`);
  const retry = page.waitForRequest(req => req.url().endsWith(`/pools/${item.id}/stakes`) && req.method() === "POST");
  await page.getByRole("button", { name: "Check prediction", exact: true }).click();
  expect((await retry).headers()["idempotency-key"]).toBe(attemptKey);
  await expect(page.getByRole("status")).toContainText("Staked 10 coins");
  await expect(page.getByText("40 coins", { exact: true })).toBeVisible();

  // Exercise automatic cutoff on an open market, without an admin lock.
  const other = await request.post(`${gateway}/markets`, { headers, data: {
    title: `Clock cutoff ${randomUUID()}`, eventStartAt: new Date(now + 120_000).toISOString(), outcomes: ["Home", "Away"],
  } });
  expect(other.ok()).toBeTruthy();
  await page.goto(`${platform}/markets/${(await other.json()).id}`);
  await expect(page.getByRole("button", { name: "Stake", exact: true })).toBeEnabled();
  await page.clock.fastForward(65_000);
  await expect(page.getByRole("button", { name: "Predictions closed", exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Outcome", exact: true })).toBeDisabled();
});
