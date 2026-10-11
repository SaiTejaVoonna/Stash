// Phones: press and hold an icon button to see its name (it isn't pressed).
const { test, expect, openApp } = require("./fixtures");

test.beforeEach(async ({ page }) => { await openApp(page); });

test("holding an icon button shows its name instead of pressing it", async ({ page }) => {
  // The first icon-only button on screen, and a counter of its presses.
  const id = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.offsetParent && !x.innerText.trim() && (x.getAttribute("aria-label") || x.title) && x.getBoundingClientRect().width > 0);
    if (!b.id) b.id = "hold-test-btn";
    window.__presses = 0;
    b.addEventListener("click", () => { window.__presses++; });
    return b.id;
  });
  const btn = page.locator("#" + id);
  const name = await btn.evaluate((b) => b.title || b.getAttribute("aria-label"));
  const box = await btn.boundingBox();
  const at = { pointerType: "touch", isPrimary: true, bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  await btn.dispatchEvent("pointerdown", at);
  await page.waitForTimeout(650);
  await expect(page.locator("#cp-tip")).toHaveText(name);
  await btn.dispatchEvent("pointerup", at);
  await btn.dispatchEvent("click");
  expect(await page.evaluate(() => window.__presses)).toBe(0);
  await expect(page.locator("#cp-tip")).toHaveCount(0, { timeout: 3000 });
});
