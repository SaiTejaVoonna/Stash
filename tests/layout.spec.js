// Phase 2 layout: sidebar full / icons / hidden, folded sections remembered.
const { test, expect, openApp } = require("./fixtures");

test.beforeEach(async ({ page }) => { await openApp(page); });

test("Ctrl+\\ steps the sidebar through full, icons and hidden, and it's remembered", async ({ page }) => {
  const sidebar = page.locator("#sidebar");
  await expect(sidebar).toBeVisible();
  await expect(sidebar).not.toHaveClass(/collapsed/);
  await page.locator("#items").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+Backslash");
  await expect(sidebar).toHaveClass(/collapsed/);
  await page.keyboard.press("Control+Backslash");
  await expect(sidebar).toBeHidden();
  // The menu button brings it back; reload keeps the last choice.
  await page.keyboard.press("Control+Backslash");
  await expect(sidebar).toBeVisible();
  await page.keyboard.press("Control+Backslash");
  await page.keyboard.press("Control+Backslash");
  await expect(sidebar).toBeHidden();
  await page.reload();
  await expect(page.locator("#sidebar")).toBeHidden();
  await page.click("#menu-btn");
  await expect(page.locator("#sidebar")).toBeVisible();
  await expect(page.locator("#sidebar")).not.toHaveClass(/collapsed/);
  await page.click("#sidebar-collapse-btn");
  await expect(page.locator("#sidebar")).toHaveClass(/collapsed/);
  await expect(page.locator("#sidebar-collapse-btn")).toHaveAttribute("aria-label", "Expand sidebar");
});

test("folded sidebar sections stay folded after a reload", async ({ page }) => {
  const tags = page.locator('.sidebar-section-header[data-section="tags"]');
  await tags.locator(".section-title-click").click();
  await expect(tags).toHaveClass(/collapsed/);
  await expect(tags.locator(".section-title-click")).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.locator('.sidebar-section-header[data-section="tags"]')).toHaveClass(/collapsed/);
  await expect(page.locator('.sidebar-section-header[data-section="folders"]')).not.toHaveClass(/collapsed/);
  await page.locator('.sidebar-section-header[data-section="tags"] .section-title-click').press("Enter");
  await expect(page.locator('.sidebar-section-header[data-section="tags"]')).not.toHaveClass(/collapsed/);
});
