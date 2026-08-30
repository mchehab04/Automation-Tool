import { test, expect } from "@playwright/test";
import { deleteLeadsByEmail, getLeadByEmail } from "./db-helper";

// Golden path: create a lead manually, move it through every pipeline stage
// (including the two gated dialogs — vehicle details at Qualified, scheduling
// at Scheduled, reason code at Won), generate a quote, and confirm the PDF
// route actually returns a PDF. Runs against the real dev DB — the lead is
// created and torn down within this test, not seed data.

const TEST_EMAIL = "e2e-pipeline-test@example.com";

// Not closing the db-helper pool here — it's a module-level singleton shared
// by every spec file in this worker process (see playwright.config.ts's
// globalTeardown, which closes it exactly once after the whole run).
test.afterAll(async () => {
  await deleteLeadsByEmail(TEST_EMAIL);
});

test("full pipeline: new lead through every stage to Won, with a quote", async ({ page }) => {
  await test.step("create a lead with a note (exercises AI quote suggestions too)", async () => {
    await page.goto("/leads/new");
    await page.locator("#name").fill("E2E Pipeline Test");
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#phone").fill("5559990000");
    await page.locator("#company").fill("E2E Test Co.");
    await page.locator("#note").fill("Customer needs an oil change and a tire rotation.");
    await page.getByRole("button", { name: "Add lead" }).click();
    // A note triggers a real (non-mocked) AI call inside the server action
    // before it redirects, so this can take a few seconds — also, "/leads/new"
    // itself would satisfy a looser `[a-z0-9]+$` pattern, so exclude it
    // explicitly rather than just checking the URL shape.
    await expect(page).toHaveURL(/\/leads\/(?!new$)[a-z0-9]{10,}$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "E2E Pipeline Test" })).toBeVisible();
  });

  await test.step("New -> Qualified requires vehicle details", async () => {
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Move to Qualified" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator("#vehicleMake").fill("Toyota");
    await page.locator("#vehicleModel").fill("Corolla");
    await page.locator("#vehicleYear").fill("2021");
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // Exact match — a substring match would also hit the activity feed's
    // "Vehicle: 2021 Toyota Corolla" note, which is a separate element.
    await expect(page.getByText("2021 Toyota Corolla", { exact: true })).toBeVisible();
  });

  await test.step("Qualified -> Quote Sent is instant, then generate a quote", async () => {
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Move to Quote Sent" }).click();
    // No dialog for this transition.
    await expect(page.getByRole("dialog")).toBeHidden();

    // The note may or may not have produced AI suggestions (real, non-mocked
    // AI call) — don't depend on that for correctness. Explicitly overwrite
    // row 0 with known-good values regardless of what's already there, so
    // this step is deterministic either way.
    await page.locator('input[name="description"]').first().fill("Oil change");
    await page.locator('input[name="quantity"]').first().fill("1");
    await page.locator('input[name="unitPrice"]').first().fill("65");
    await page.locator("#notes").fill("E2E test quote — includes a follow-up inspection.");
    await page.getByRole("button", { name: "Generate quote" }).click();
    await expect(page).toHaveURL(/\?quote=/);
  });

  await test.step("quote PDF route returns a real PDF", async () => {
    // Also forced to role="button" by Base UI despite rendering as an <a>
    // (same as the "View" link in email-intake.spec.ts).
    const pdfLink = page.getByRole("button", { name: /PDF/ });
    const href = await pdfLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/quotes\/.+\/pdf$/);
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(1000);
  });

  await test.step("Quote Sent -> Scheduled requires an appointment slot", async () => {
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Move to Scheduled" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Wait for real slot availability to load, then pick the first date/time.
    await expect(page.getByText("Checking availability…")).toBeHidden({ timeout: 15_000 });
    await page.locator("#scheduleDate").click();
    await page.getByRole("option").first().click();
    await page.locator("#scheduleTime").click();
    await page.getByRole("option").first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(/^Appointment:/)).toBeVisible();
  });

  await test.step("Scheduled -> In Progress is instant (direct Scheduled -> Won is not allowed)", async () => {
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Move to In Progress" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // "In Progress" legitimately appears in multiple places once this stage
    // is current (the header badge, the stage-select placeholder, the
    // activity note) — .first() rather than requiring a unique match.
    await expect(page.getByText("In Progress").first()).toBeVisible();
  });

  await test.step("In Progress -> Won requires a reason code", async () => {
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Move to Won" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Price was right" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // Moving to Won/Lost also triggers a real, synchronous AI call inside
    // the same server action (generateClosingReport, report 21) before it
    // resolves — real latency on top of the stage change itself.
    await expect(page.getByText("Won (final)")).toBeVisible({ timeout: 20_000 });
  });

  await test.step("lead is actually Won in the database", async () => {
    const lead = await getLeadByEmail(TEST_EMAIL);
    expect(lead).not.toBeNull();
    expect(lead.stage).toBe("WON");
    expect(lead.vehicleMake).toBe("Toyota");
    expect(lead.scheduledAt).not.toBeNull();
  });
});
