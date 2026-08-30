import { test, expect } from "@playwright/test";
import {
  getBusinessAddress,
  deleteCatalogItemsByDescriptionPrefix,
  getCatalogItemByDescription,
} from "./db-helper";

const DEMO_BUSINESS_ID = "demo-business";
const TEST_ITEM_DESCRIPTION = "E2E Test Catalog Item";

// See pipeline.spec.ts for why closeDbPool() isn't called here.
test.afterAll(async () => {
  await deleteCatalogItemsByDescriptionPrefix(TEST_ITEM_DESCRIPTION);
});

test("business details form saves and restores", async ({ page }) => {
  const originalAddress = await getBusinessAddress(DEMO_BUSINESS_ID);

  await page.goto("/settings");
  await page.locator("#business-address").fill("999 Playwright Test Lane, Dubai, UAE");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Business details saved.")).toBeVisible();

  const updatedAddress = await getBusinessAddress(DEMO_BUSINESS_ID);
  expect(updatedAddress).toBe("999 Playwright Test Lane, Dubai, UAE");

  // Restore, since this business's real address is meant to be a stable,
  // known value (the placeholder from report 25 until a real one is set).
  await page.reload();
  await page.locator("#business-address").fill(originalAddress ?? "");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Business details saved.")).toBeVisible();
});

test("catalogue item add, edit, delete round-trip", async ({ page }) => {
  await page.goto("/settings");

  // Both the always-visible Business Details "Save" button and this dialog's
  // buttons can be on screen at once — every dialog interaction below is
  // scoped to the dialog container to avoid ambiguous matches.
  await page.getByRole("button", { name: "Add item" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.locator("#item-description").fill(TEST_ITEM_DESCRIPTION);
  await page.locator("#item-price").fill("42");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("cell", { name: TEST_ITEM_DESCRIPTION })).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: TEST_ITEM_DESCRIPTION });
  await row.getByRole("button", { name: "Edit item" }).click();
  await expect(dialog).toBeVisible();
  await page.locator("#item-price").fill("55");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByText("$55.00")).toBeVisible();

  const itemInDb = await getCatalogItemByDescription(TEST_ITEM_DESCRIPTION);
  expect(itemInDb).not.toBeNull();
  expect(itemInDb.unitPrice).toBe(5500);

  await row.getByRole("button", { name: "Remove item" }).click();
  await expect(page.getByRole("cell", { name: TEST_ITEM_DESCRIPTION })).toBeHidden();

  const afterDelete = await getCatalogItemByDescription(TEST_ITEM_DESCRIPTION);
  expect(afterDelete).toBeNull();
});
