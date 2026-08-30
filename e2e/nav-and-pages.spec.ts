import { test, expect } from "@playwright/test";

// Every top-level page loads without error — the cheap regression net for
// "did I break a whole page."
const PAGES = ["/dashboard", "/leads", "/calendar", "/analytics", "/settings"];

for (const path of PAGES) {
  test(`${path} loads without an error page`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(page.getByText("500")).toHaveCount(0);
  });
}

test("sidebar nav links all resolve to their pages", async ({ page }) => {
  await page.goto("/dashboard");
  // The current page's breadcrumb also renders a same-named link (e.g.
  // "Dashboard"), so scope to the sidebar menu specifically to avoid an
  // ambiguous match between the two.
  const sidebarMenu = page.locator('[data-slot="sidebar-menu"]');
  for (const [label, path] of [
    ["Dashboard", "/dashboard"],
    ["Leads", "/leads"],
    ["Calendar", "/calendar"],
    ["Analytics", "/analytics"],
    ["Settings", "/settings"],
  ] as const) {
    await sidebarMenu.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});
