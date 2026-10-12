// A brand-new person on a phone starts in the Inbox, with one thing to do.
const { test, expect } = require("./fixtures");

test("first run on a phone: the Inbox, calm, with Take a photo and See an example", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("cp-test-firstrun", "1"); localStorage.removeItem("copypaster-started"); } catch {} });
  await page.goto("./");
  await expect(page.locator("#chat-pane")).toBeVisible();
  await expect(page.locator(".cx-start")).toContainText("Drop anything here");
  await expect(page.locator("#cx-start-snap")).toBeVisible();
  // No tools for an empty Inbox.
  await expect(page.locator("#cx-filters")).toBeHidden();
  await expect(page.locator("#cx-select")).toBeHidden();
  await page.tap("#cx-start-example");
  await expect(page.locator(".gp-id h1")).toHaveText("Example trip");
});
