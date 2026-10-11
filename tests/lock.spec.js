// App lock (PIN before Stash opens) and text size.
const { test, expect, openApp, newNote } = require("./fixtures");

test.beforeEach(async ({ page }) => { await openApp(page); });

async function openLockSettings(page) {
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="lock"]');
}

test("a PIN locks Stash when it opens; a wrong PIN is refused; turning it off needs the PIN", async ({ page }) => {
  await newNote(page, "Gate code 4521", { title: "Flat" });
  await openLockSettings(page);
  await page.click("#lock-set-pin");
  await page.fill("#dialog-pin", "2468");
  await page.fill("#dialog-again", "2469");
  await page.keyboard.press("Enter");
  await expect(page.locator("#dialog .dialog-error")).toHaveText("The two PINs don't match.");
  await page.fill("#dialog-again", "2468");
  await page.keyboard.press("Enter");
  await expect(page.locator("#lock-after")).toBeVisible();
  // The PIN isn't stored, only a salted hash.
  const stored = await page.evaluate(() => localStorage.getItem("copypaster-applock"));
  expect(stored).not.toContain("2468");

  await page.reload();
  await expect(page.locator("#lock-screen")).toBeVisible();
  expect(await page.evaluate(() => document.getElementById("app").inert)).toBe(true);
  // Shortcuts don't reach the app behind the lock.
  await page.locator("#lock-screen").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
  await expect(page.locator("#palette-overlay")).toHaveCount(0);
  await page.fill("#lock-pin", "1111");
  await page.click("#lock-go");
  await expect(page.locator("#lock-msg")).toHaveText("Wrong PIN. Try again.");
  await page.fill("#lock-pin", "2468");
  await page.press("#lock-pin", "Enter");
  await expect(page.locator("#lock-screen")).toHaveCount(0);
  await expect(page.locator(".item-row", { hasText: "Flat" })).toBeVisible();

  // Lock now, then turn it off (asks for the PIN).
  await openLockSettings(page);
  await page.click("#lock-now");
  await expect(page.locator("#lock-screen")).toBeVisible();
  await page.fill("#lock-pin", "2468");
  await page.click("#lock-go");
  await openLockSettings(page);
  await page.click("#lock-off");
  await page.fill("#dialog-pin", "0000");
  await page.keyboard.press("Enter");
  await expect(page.locator("#dialog .dialog-error")).toHaveText("Wrong PIN.");
  await page.fill("#dialog-pin", "2468");
  await page.keyboard.press("Enter");
  await expect(page.locator("#lock-set-pin")).toBeVisible();
  await page.reload();
  await expect(page.locator("#lock-screen")).toHaveCount(0);
});

test("text size: Large makes text bigger and is remembered", async ({ page }) => {
  const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fs-md")));
  expect(await size()).toBe(13.5);
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="appearance"]');
  await page.click('[data-text-pick="large"]');
  expect(await size()).toBe(16);
  await page.reload();
  expect(await size()).toBe(16);
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="appearance"]');
  await expect(page.locator('[data-text-pick="large"]')).toHaveAttribute("aria-checked", "true");
});
