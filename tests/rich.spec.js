// The rich note editor: formatting shown as you write, kept as plain text.
const { test, expect, openApp, storedItems, newBtn } = require("./fixtures");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("cp-test-rich", "1"); localStorage.removeItem("copypaster-editor"); localStorage.removeItem("copypaster-details-open"); } catch {} });
  await openApp(page);
});

async function newRichNote(page) {
  await newBtn(page).click();
  await page.click('#new-menu [data-new="note"]');
  const rich = page.locator("#rich-input");
  await expect(rich).toBeFocused();
  return rich;
}
const saved = async (page) => (await storedItems(page)).find((i) => i.type === "note" && !i.deletedAt);

test("rich editor: bold, underline, highlight and lists show formatted and are kept as plain text", async ({ page }) => {
  const rich = await newRichNote(page);
  await expect(page.locator("#content-input")).toBeHidden();
  await expect(page.locator("#detail-properties")).toHaveClass(/collapsed/); // opens calm
  await rich.type("Trip plan");
  await page.keyboard.press("Shift+Home");
  await page.click("#fmt-heading");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await rich.type("- pack socks");
  await page.keyboard.press("Enter");
  await rich.type("tickets");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // an empty item ends the list
  await rich.type("very ");
  await page.keyboard.press("Control+b");
  await rich.type("important");
  await page.keyboard.press("Control+b");
  await rich.type(" and ");
  await page.click("#fmt-underline");
  await rich.type("this");
  await expect(rich.locator("h2")).toHaveText("Trip plan");
  await expect(rich.locator("li")).toHaveText(["pack socks", "tickets"]);
  await expect(rich.locator("b, strong")).toHaveText("important");
  await expect.poll(async () => (await saved(page) || {}).content, { timeout: 4000 })
    .toBe("# Trip plan\n- pack socks\n- tickets\nvery **important** and ++this++");
  // The list row shows words, not marks.
  await expect(page.locator(".item-row").first()).not.toContainText("**");
});

test("rich editor: an old plain-text note opens formatted; highlight and tick boxes round-trip", async ({ page }) => {
  const rich = await newRichNote(page);
  await rich.type("[] milk");
  await expect(rich.locator("ul.fm-tasks li")).toHaveText(["milk"]);
  await page.keyboard.press("Enter");
  await rich.type("bread");
  // Tap the first box to tick it.
  const box = await rich.locator("ul.fm-tasks li").first().boundingBox();
  await page.mouse.click(box.x + 8, box.y + box.height / 2);
  await expect(rich.locator("ul.fm-tasks li").first()).toHaveClass(/done/);
  await rich.locator("ul.fm-tasks li").nth(1).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await rich.type("remember");
  await page.keyboard.press("Shift+Home");
  await page.click("#fmt-mark");
  await expect(rich.locator("mark")).toHaveText("remember");
  await expect.poll(async () => (await saved(page) || {}).content, { timeout: 4000 }).toBe("- [x] milk\n- [ ] bread\n==remember==");
  // Switch to plain text and back: same words.
  await page.click("#detail-pane .icon-toggle.more");
  await page.locator(".context-menu .popover-list-item", { hasText: "Write in plain text" }).click();
  await expect(page.locator("#content-input")).toHaveValue("- [x] milk\n- [ ] bread\n==remember==");
  await page.click("#fmt-mode");
  await expect(page.locator("#rich-input mark")).toHaveText("remember");
});

test("rich editor: pasting from a web page keeps bold and lists, drops the rest", async ({ page }) => {
  const rich = await newRichNote(page);
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/html", '<div style="color:red"><h1>Recipe</h1><p>Use <b>fresh</b> <span style="font-style:italic">basil</span><img src="x" onerror="window.__bad=1"></p><ul><li>one</li><li>two</li></ul><script>window.__bad=2</script></div>');
    dt.setData("text/plain", "Recipe\nUse fresh basil\none\ntwo");
    document.getElementById("rich-input").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(rich.locator("h2")).toHaveText("Recipe");
  await expect(rich.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__bad)).toBeUndefined();
  await expect.poll(async () => (await saved(page) || {}).content, { timeout: 4000 }).toBe("# Recipe\nUse **fresh** *basil*\n- one\n- two");
  // Only one note: the app-wide paste didn't also make a new one.
  expect((await storedItems(page)).filter((i) => !i.deletedAt).length).toBe(1);
});

test("rich editor: one + menu, and Undo / Redo in the top bar", async ({ page }) => {
  const rich = await newRichNote(page);
  await rich.type("hello");
  await page.click("#note-add-btn");
  for (const label of ["Photo", "Take a photo", "Drawing", "Recording", "Make the whole note a checklist"]) await expect(page.locator(".context-menu").getByText(label, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.click("#undo-btn");
  await expect(rich).not.toContainText("hello");
  await page.click("#redo-btn");
  await expect(rich).toContainText("hello");
});

test("notes as cards, and a note's background colour tints its page and its card", async ({ page }) => {
  const rich = await newRichNote(page);
  await rich.type("Shopping\nmilk\nbread");
  await page.click("#fmt-color");
  await page.click('.note-bg-pop [aria-label="Yellow"]');
  await expect(page.locator("#detail-pane")).toHaveClass(/tinted/);
  await expect.poll(async () => (await saved(page) || {}).color).toBe("#ffd60a");
  await page.click("#view-mode-btn");
  await expect(page.locator("#items")).toHaveClass(/as-cards/);
  await expect(page.locator("#items .item-row[data-color]")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#items")).toHaveClass(/as-cards/); // remembered
  await page.click("#view-mode-btn");
  await expect(page.locator("#items")).not.toHaveClass(/as-cards/);
});

test("Looks: one tap sets the icon, theme, colour and background; true black and warm paper", async ({ page }) => {
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="appearance"]');
  await expect(page.locator('#look-picker [data-look="stash"]')).toHaveClass(/active/);
  await page.click('#look-picker [data-look="midnight"]');
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-surface", "black");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(0, 0, 0)");
  await expect(page.locator("#brand-dot img")).toHaveAttribute("src", /style-dark/);
  await expect(page.locator('#look-picker [data-look="midnight"]')).toHaveClass(/active/);
  await page.click('[data-surface-pick="paper"]'); // switches to light so it shows
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(251, 247, 239)");
  await expect(page.locator("#look-picker .look-opt.active")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-surface", "paper");
});

test("rich editor: \"/\" commands make a tick box and a heading", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("copypaster-slash", "1"));
  const rich = await newRichNote(page);
  await rich.type("/todo");
  await expect(page.locator("#slash-menu .slash-item.active")).toContainText("/todo");
  await page.keyboard.press("Enter");
  await rich.type("milk");
  await expect(rich.locator("ul.fm-tasks li")).toHaveText(["milk"]);
  await expect.poll(async () => (await saved(page) || {}).content, { timeout: 4000 }).toBe("- [ ] milk");
});

test("rich editor: a heading or a list changes only the line it's on (also after Shift+Enter)", async ({ page }) => {
  const rich = await newRichNote(page);
  await rich.type("one");
  await page.keyboard.press("Shift+Enter");
  await rich.type("two");
  await page.keyboard.press("Shift+Enter");
  await rich.type("three");
  await page.keyboard.press("ArrowUp");
  await page.click("#fmt-heading");
  await expect(rich.locator("h2")).toHaveText("two");
  await page.click("#fmt-bullets"); // a heading turned into a list item
  await expect(rich.locator("h2")).toHaveCount(0);
  await expect(rich.locator("li")).toHaveText(["two"]);
  await expect.poll(async () => (await saved(page) || {}).content, { timeout: 4000 }).toBe("one\n- two\nthree");
});

test("rich editor: the tick-box button changes only the line you're on, and again turns it back", async ({ page }) => {
  const rich = await newRichNote(page);
  await rich.type("Shopping for the week");
  await page.keyboard.press("Enter");
  await rich.type("Task one");
  await page.keyboard.press("Enter");
  await rich.type("Task two");
  await page.keyboard.press("ArrowUp");
  await page.click("#checklist-btn");
  await expect(rich.locator("ul.fm-tasks li")).toHaveText(["Task one"]);
  await expect(page.locator(".cl-row")).toHaveCount(0); // not the whole note
  await expect.poll(async () => (await saved(page) || {}).content, { timeout: 4000 }).toBe("Shopping for the week\n- [ ] Task one\nTask two");
  await page.click("#checklist-btn");
  await expect(rich.locator("ul.fm-tasks li")).toHaveCount(0);
});
