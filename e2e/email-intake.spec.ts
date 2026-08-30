import { test, expect } from "@playwright/test";
import { deleteLeadsByPhone } from "./db-helper";

// Real AI call (Claude Sonnet 5, via processSimulatedEmail) — no mocking, same
// live-verification approach used throughout this project's manual testing.
// A generous timeout accounts for real API latency.
//
// Deliberately NOT using the simulator's built-in "complete info example"
// badge — that's the same "Sarah Kim / 555-201-4488" persona used throughout
// this project's manual testing, so a lead under that name/phone may already
// exist in the dev DB. Using a unique synthetic identity instead means
// cleanup can safely target exactly what this test created, nothing else.
const TEST_PHONE = "5557778899";

// See pipeline.spec.ts for why closeDbPool() isn't called here.
test.afterAll(async () => {
  await deleteLeadsByPhone(TEST_PHONE);
});

test("simulate email intake creates a lead with AI-extracted vehicle + suggestions", async ({ page }) => {
  await page.goto("/leads/simulate");

  await page
    .getByPlaceholder("Paste or write the customer's message…")
    .fill(
      `Hi, this is E2E Intake Test (${TEST_PHONE}). My 2018 Ford F-150's brakes are ` +
        "squeaking and it's due for an oil change. Could someone take a look this week?",
    );
  await page.getByRole("button", { name: "Send message" }).click();

  // Real AI call — allow real latency.
  await expect(page.getByText(/Lead created from simulated email intake|Added to an existing lead/)).toBeVisible({
    timeout: 30_000,
  });

  // Renders as an <a> via Base UI's render prop, but Base UI forces
  // role="button" on it regardless of the underlying element (report 02).
  const viewButton = page.getByRole("button", { name: /^View / });
  await expect(viewButton).toBeVisible();
  await viewButton.click();

  await expect(page).toHaveURL(/\/leads\/(?!new$|simulate$)[a-z0-9]{10,}$/);
  // "Ford F-150" legitimately appears in multiple places (vehicle card,
  // conversation transcript, activity note) — any one of them confirms
  // extraction worked, so .first() rather than requiring a unique match.
  await expect(page.getByText(/Ford F-150/).first()).toBeVisible();
});
