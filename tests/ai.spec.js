// Copy for AI: selected things as labelled text for any AI chat; never the Vault.
const { test, expect, openApp, newNote } = require("./fixtures");

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.beforeEach(async ({ page }) => { await openApp(page); });
const clip = (page) => page.evaluate(() => navigator.clipboard.readText());

test("selected notes copy as labelled text for AI", async ({ page }) => {
  await newNote(page, "Paid at City Clinic\nFollow-up in 6 weeks", { title: "Consultation" });
  await newNote(page, "milk, eggs, bread", { title: "Groceries" });
  await page.click("#select-mode-btn");
  await page.locator(".item-row", { hasText: "Consultation" }).click();
  await page.locator(".item-row", { hasText: "Groceries" }).click();
  await page.click("#bulk-ai-btn");
  await expect(page.locator(".toast-item").last()).toContainText("Copied 2 items for AI");
  const text = await clip(page);
  expect(text).toContain("# From my Stash");
  expect(text).toContain("## Consultation");
  expect(text).toContain("Follow-up in 6 weeks");
  expect(text).toContain("## Groceries");
  expect(text).toMatch(/- Date: \d{1,2} \w{3} \d{4}/);
});

test("a collection copies what's shown, with where it's filed and the amount", async ({ page }) => {
  await page.click("#empty-example-btn");
  await expect(page.locator(".gp-entry")).toHaveCount(4);
  await page.click("#gp-ai");
  await expect(page.locator(".toast-item").last()).toContainText("Copied 4 entries for AI");
  const text = await clip(page);
  expect(text).toContain("# From my Stash: Example trip");
  expect(text).toContain("## Train to Mysore");
  expect(text).toContain("Amount: ₹750");
  expect(text).toContain("Filed in: Example trip › Tickets");
});

test("the format never includes Vault items", async ({ page }) => {
  const text = await page.evaluate(() => window.CPAI.format([{ title: "Bank PIN", text: "1234", vaulted: true }, { title: "Recipe", text: "dal" }]));
  expect(text).not.toContain("Bank PIN");
  expect(text).not.toContain("1234");
  expect(text).toContain("## Recipe");
});
