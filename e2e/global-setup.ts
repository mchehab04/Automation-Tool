import { chromium, type FullConfig } from "@playwright/test";

// React Server Actions (the login form uses useActionState) don't submit as
// plain form-urlencoded POSTs — a raw HTTP client can't replicate the
// protocol — so logging in has to go through a real browser. Runs once
// before the whole suite; the saved storageState is reused by every spec
// via playwright.config.ts's `use.storageState`, so specs don't each pay
// for their own login.
const SEED_EMAIL = "owner@demobusiness.test";
const SEED_PASSWORD = "changeme123";
const STORAGE_STATE_PATH = "e2e/.auth/session.json";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  // getByLabel("Password") would also match the show/hide toggle button
  // (aria-label="Show password") since it matches as a substring — target
  // the textbox role specifically instead.
  await page.getByLabel("Email").fill(SEED_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(`${baseURL}/dashboard`);

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
