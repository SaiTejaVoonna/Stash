// "/" commands (off by default) and a couple of surprises.
const { test, expect, openApp, newNote, storedItems } = require("./fixtures");

test("\"/\" commands are off by default; on, they insert today's date and make a tick box", async ({ page }) => {
  await openApp(page);
  await newNote(page, "plan");
  const ta = page.locator("#content-input");
  await ta.press("End");
  await ta.type(" /da");
  await expect(page.locator("#slash-menu")).toHaveCount(0); // off: nothing happens
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="shortcuts"]');
  await page.check("#slash-on");
  await page.keyboard.press("Escape");
  await page.locator(".item-row").first().click();
  await ta.press("End");
  await ta.press("Enter");
  await ta.type("/da");
  await expect(page.locator("#slash-menu .slash-item").first()).toContainText("/date");
  await ta.press("Enter");
  const today = await page.evaluate(() => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
  await expect(ta).toHaveValue(new RegExp("\\n" + today + "$"));
  await ta.press("Enter");
  await ta.type("/todo");
  await ta.press("Enter");
  await ta.type("milk");
  await expect(ta).toHaveValue(new RegExp("\\n- \\[ \\] milk$"));
  await expect(page.locator("#slash-menu")).toHaveCount(0);
});

test("seven taps on the logo find Aurora, and it stays in Looks", async ({ page }) => {
  await openApp(page);
  for (let i = 0; i < 7; i++) await page.click("#brand-dot");
  await expect(page.locator(".toast-item").last()).toContainText("You found Aurora");
  await expect(page.locator("html")).toHaveAttribute("data-surface", "aurora");
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="appearance"]');
  await expect(page.locator('#look-picker [data-look="aurora"]')).toHaveClass(/active/);
});
