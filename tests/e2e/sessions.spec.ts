import { test, expect, type APIRequestContext, type Page, type Route } from "@playwright/test";
import { randomUUID } from "node:crypto";

const gateway = process.env.TEST_GATEWAY_URL!;
const adminCredentials = { email: "admin@integration.test", password: "integration-only-admin-password-123" };
const apps = [
  { name: "platform", origin: "http://localhost:13001", destination: "/wallet", privatePath: "/wallet/me/rewards", button: "Log in" },
  { name: "admin", origin: "http://localhost:13002", destination: "/operations", privatePath: "/operations/settlement?*", button: "Sign in" },
] as const;

async function player(request: APIRequestContext) {
  const credentials = { email: `session-${randomUUID()}@example.test`, password: "browser-test-password-123" };
  expect((await request.post(`${gateway}/auth/register`, { data: { ...credentials, displayName: "Session Player" } })).ok()).toBeTruthy();
  return credentials;
}
async function login(page: Page, app: typeof apps[number], credentials: typeof adminCredentials) {
  await page.goto(`${app.origin}/login`);
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: app.button, exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.getByText(credentials.email, { exact: true })).toBeVisible();
}
async function savedToken(page: Page, app: typeof apps[number]) {
  return page.evaluate(key => localStorage.getItem(key), `ravex.${app.name}.token`);
}
async function expectNotice(page: Page, text: string) {
  // Next.js also renders a route-announcement alert.
  await expect(page.getByRole("alert").filter({ hasText: text })).toBeVisible();
}

for (const app of apps) {
  test(`${app.name}: auth forms wait for saved-session restoration`, async ({ page, request }) => {
    const credentials = app.name === "admin" ? adminCredentials : await player(request);
    await login(page, app, credentials);
    for (const path of app.name === "platform" ? ["/login", "/register"] : ["/login"]) {
      let delayed: Route | undefined;
      await page.route(`${gateway}/me`, route => { delayed = route; });
      await page.goto(`${app.origin}${path}`);
      await expect.poll(() => Boolean(delayed)).toBeTruthy();
      await expect(page.getByText("Checking saved session…", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
      await delayed!.fulfill({ response: await delayed!.fetch() });
      await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
      await page.getByLabel("Email", { exact: true }).fill("next-account@example.test");
      await expect(page.getByLabel("Email", { exact: true })).toHaveValue("next-account@example.test");
      await page.unroute(`${gateway}/me`);
    }
  });

  test(`${app.name}: verification timeout retains the session and reconnecting retries it`, async ({ page, request }) => {
    const credentials = app.name === "admin" ? adminCredentials : await player(request);
    await login(page, app, credentials);
    const token = await savedToken(page, app);
    await page.clock.install();
    let delayed: Route | undefined;
    await page.route(`${gateway}/me`, route => { delayed = route; });
    await page.goto(`${app.origin}${app.destination}`);
    await expect.poll(() => Boolean(delayed)).toBeTruthy();
    await page.clock.fastForward(16_000);
    await expectNotice(page, "Cannot verify your saved session");
    expect(await savedToken(page, app)).toBe(token);
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(app.destination);
    await delayed!.abort();
    await page.unroute(`${gateway}/me`);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    expect(await savedToken(page, app)).toBe(token);
  });

  test(`${app.name}: invalid saved expiry is cleared before private requests`, async ({ page }) => {
    await page.goto(`${app.origin}/login`);
    const privateRequests: string[] = [];
    page.on("request", req => {
      if (req.url().startsWith(gateway) && req.headers().authorization) privateRequests.push(req.url());
    });
    const expired = Math.floor(Date.now() / 1000) - 60;
    for (const token of ["malformed", ...[{}, { exp: "invalid" }, { exp: expired }].map(payload =>
      `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`)]) {
      await page.evaluate(({ key, token }) => localStorage.setItem(key, token), {
        key: `ravex.${app.name}.token`, token,
      });
      await page.goto(`${app.origin}${app.destination}`);
      await expect.poll(() => savedToken(page, app)).toBeNull();
      if (app.name === "admin") {
        await expect(page.getByRole("heading", { name: "Admin sign in", exact: true })).toBeVisible();
      } else {
        await expect(page.getByText("to view your wallet and claim rewards.", { exact: false })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
    }
    expect(privateRequests).toEqual([]);
  });

  test(`${app.name}: restoration failures are retryable; protected 401 clears the session`, async ({ page, request }) => {
    const credentials = app.name === "admin" ? adminCredentials : await player(request);
    await login(page, app, credentials);
    const token = await savedToken(page, app);
    expect(token).toBeTruthy();
    for (const status of [503, 429, 403]) {
      await page.route(`${gateway}/me`, route => route.fulfill({ status, json: { error: "Temporary test failure" } }));
      await page.goto(`${app.origin}${app.destination}`);
      await expectNotice(page, "Cannot verify your saved session");
      expect(await savedToken(page, app)).toBe(token);
      await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe(app.destination);
      await page.unroute(`${gateway}/me`);
      await page.getByRole("button", { name: "Retry session verification" }).click();
      await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    }

    // A forbidden operation does not imply that the login itself is invalid.
    await page.route(`${gateway}${app.privatePath}`, route => route.fulfill({ status: 403, json: { error: "Forbidden" } }));
    await page.reload();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expectNotice(page, app.name === "admin" ? "Cannot refresh" : "Could not refresh");
    expect(await savedToken(page, app)).toBe(token);
    await page.unroute(`${gateway}${app.privatePath}`);
    await page.route(`${gateway}${app.privatePath}`, route => route.fulfill({ status: 401, json: { error: "Expired" } }));
    await page.reload();
    await expectNotice(page, "Your session has expired");
    await expect.poll(() => savedToken(page, app)).toBeNull();
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: app.name === "admin" ? "Operations" : "Available rewards", exact: true })).toHaveCount(0);
  });

  test(`${app.name}: expiry and explicit logout synchronize across tabs`, async ({ page, context, request }) => {
    const credentials = app.name === "admin" ? adminCredentials : await player(request);
    await page.clock.install();
    await login(page, app, credentials);
    const other = await context.newPage();
    await other.goto(`${app.origin}${app.destination}`);
    await expect(other.getByRole("button", { name: "Log out" })).toBeVisible();
    await other.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
    expect(await savedToken(page, app)).toBeNull();

    await login(page, app, credentials);
    await other.goto(`${app.origin}${app.destination}`);
    await expect(other.getByRole("button", { name: "Log out" })).toBeVisible();
    const token = (await savedToken(page, app))!;
    const expires = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp * 1000;
    await page.clock.fastForward(expires - Date.now() + 1000);
    await expectNotice(page, "Your session has expired");
    await expect(other.getByRole("button", { name: "Log out" })).toHaveCount(0);
    expect(await savedToken(page, app)).toBeNull();
    await other.close();
  });
}

test("admin: restored identity must still have the Admin role", async ({ page }) => {
  const app = apps[1];
  await login(page, app, adminCredentials);
  await page.route(`${gateway}/me`, async route => {
    const user = await (await route.fetch()).json();
    await route.fulfill({ json: { ...user, role: "Player" } });
  });
  await page.goto(`${app.origin}${app.destination}`);
  await expectNotice(page, "no longer has admin access");
  await expect(page).toHaveURL(`${app.origin}/login`);
  expect(await savedToken(page, app)).toBeNull();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Operations", exact: true })).toHaveCount(0);
});

test("account changes clear private data and late 401 cannot erase an identical reissued token", async ({ page, context, request }) => {
  const app = apps[0];
  const first = await player(request);
  const second = await player(request);
  await login(page, app, first);
  const token = (await savedToken(page, app))!;
  expect((await request.post(`${gateway}/wallet/me/earn`, { headers: { Authorization: `Bearer ${token}` }, data: { reason: "daily_login" } })).ok()).toBeTruthy();
  await page.goto(`${app.origin}/wallet`);
  await expect(page.getByRole("cell", { name: "daily_login", exact: true })).toBeVisible();
  let delayed: Route | undefined;
  await page.route(`${gateway}/wallet/me/balance`, async route => {
    if (!delayed) { delayed = route; return; }
    await route.continue();
  });
  // The balance poll starts under the old local session generation.
  await expect.poll(() => Boolean(delayed)).toBeTruthy();
  const other = await context.newPage();
  await other.goto(`${app.origin}/wallet`);
  await expect(other.getByRole("button", { name: "Log out" })).toBeVisible();
  await other.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "daily_login", exact: true })).toHaveCount(0);
  const me = await request.get(`${gateway}/me`, { headers: { Authorization: `Bearer ${token}` } });
  const user = await me.json();
  await other.route(`${gateway}/auth/login`, route => route.fulfill({ json: { accessToken: token, user } }));
  await login(other, app, first);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await delayed!.fulfill({ status: 401, json: { error: "Old request" } });
  // Wait for the response handler, then check both browser state and persisted identity.
  await expect(page.getByRole("cell", { name: "daily_login", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "My predictions", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  expect(await savedToken(page, app)).toBe(token);
  await other.unroute(`${gateway}/auth/login`);
  await login(other, app, second);
  await expect.poll(() => savedToken(page, app)).not.toBe(token);
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  await expect(page.getByText("No activity yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "daily_login", exact: true })).toHaveCount(0);
  await other.close();
});

test("a prediction interrupted by session loss is checked with its original key after login", async ({ page, request }) => {
  const app = apps[0];
  const credentials = await player(request);
  const adminLogin = await request.post(`${gateway}/auth/login`, { data: adminCredentials });
  const headers = { Authorization: `Bearer ${(await adminLogin.json()).accessToken}` };
  const created = await request.post(`${gateway}/markets`, { headers, data: {
    title: `Session recovery ${randomUUID()}`, eventStartAt: new Date(Date.now() + 3_600_000).toISOString(), outcomes: ["Home", "Away"],
  } });
  expect(created.ok()).toBeTruthy();
  const market = await created.json();
  await login(page, app, credentials);
  const token = (await savedToken(page, app))!;
  const playerHeaders = { Authorization: `Bearer ${token}` };
  expect((await request.post(`${gateway}/wallet/me/earn`, { headers: playerHeaders, data: { reason: "daily_login" } })).ok()).toBeTruthy();
  await page.goto(`${app.origin}/markets/${market.id}`);
  let attemptKey: string | undefined;
  let submissions = 0;
  page.on("request", req => { if (req.method() === "POST" && req.url().endsWith(`/pools/${market.id}/stakes`)) submissions++; });
  await page.route(`**/pools/${market.id}/stakes`, async route => {
    attemptKey = route.request().headers()["idempotency-key"];
    expect((await route.fetch()).ok()).toBeTruthy();
    await route.fulfill({ status: 401, json: { error: "Session lost after admission" } });
  });
  await page.getByRole("combobox", { name: "Outcome", exact: true }).selectOption(market.outcomes[0].id);
  await page.getByLabel("Amount", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Stake", exact: true }).click();
  await expectNotice(page, "Your session has expired");
  expect(attemptKey).toBeTruthy();
  await page.unroute(`**/pools/${market.id}/stakes`);
  await login(page, app, credentials);
  await page.goto(`${app.origin}/markets/${market.id}`);
  await expect(page.getByRole("button", { name: "Check prediction", exact: true })).toBeEnabled();
  expect(submissions).toBe(1);
  const retry = page.waitForRequest(req => req.method() === "POST" && req.url().endsWith(`/pools/${market.id}/stakes`));
  await page.getByRole("button", { name: "Check prediction", exact: true }).click();
  expect((await retry).headers()["idempotency-key"]).toBe(attemptKey);
  await expect(page.getByRole("status")).toContainText("Staked 10 coins");
  const balance = await request.get(`${gateway}/wallet/me/balance`, { headers: playerHeaders });
  expect((await balance.json()).balance).toBe(40);
  const predictions = await request.get(`${gateway}/predictions/me`, { headers: playerHeaders });
  expect((await predictions.json()).items.filter((item: { marketId: string }) => item.marketId === market.id)).toHaveLength(1);
});

test("blocked browser storage permits a tab-only session", async ({ page, request }) => {
  const app = apps[0];
  const credentials = await player(request);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key === "ravex.platform.token") throw new DOMException("Blocked", "SecurityError");
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key === "ravex.platform.token") throw new DOMException("Blocked", "SecurityError");
      return originalSet.call(this, key, value);
    };
  });
  await login(page, app, credentials);
  await expectNotice(page, "signed in for this tab only");
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  await expect(page.getByRole("button", { name: "Daily login bonus +50", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("logout wins over in-flight session restoration", async ({ page, context, request }) => {
  const app = apps[0];
  await login(page, app, await player(request));
  await page.goto(`${app.origin}/wallet`);
  const other = await context.newPage();
  await other.goto(`${app.origin}/wallet`);
  await expect(other.getByRole("button", { name: "Log out" })).toBeVisible();
  let delayed: Route | undefined;
  let verifiedUser: unknown;
  await page.route(`${gateway}/me`, async route => {
    verifiedUser = await (await route.fetch()).json();
    delayed = route;
  });
  await page.reload();
  await expect.poll(() => Boolean(delayed)).toBeTruthy();
  await other.getByRole("button", { name: "Log out" }).click();
  await expect.poll(() => savedToken(page, app)).toBeNull();
  await delayed!.fulfill({ json: verifiedUser });
  await expect(page.getByText("to view your wallet and claim rewards.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  await other.close();
});

test("failed storage removal cannot undo local logout on focus", async ({ page, request }) => {
  const app = apps[0];
  await login(page, app, await player(request));
  const token = await savedToken(page, app);
  await page.evaluate(() => {
    const originalRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      if (key === "ravex.platform.token") throw new DOMException("Blocked", "SecurityError");
      return originalRemove.call(this, key);
    };
  });
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  expect(await savedToken(page, app)).toBe(token);
  let verifications = 0;
  page.on("request", req => { if (req.url() === `${gateway}/me`) verifications++; });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("link", { name: "Markets", exact: true }).click();
  await expect(page).toHaveURL(`${app.origin}/`);
  expect(verifications).toBe(0);
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
});
