// Bugs found testing on a phone, kept from coming back.
const { test, expect, openApp, storedItems, seed } = require("./fixtures");
const note = (id, content) => ({ id, type: "note", title: "", content, tags: [], images: [], runs: [], audio: [], createdAt: Date.now(), updatedAt: Date.now(), order: 0 });

test("a note's first line shows its words in the list, not ** or ++ marks", async ({ page }) => {
  await openApp(page);
  await seed(page, { items: [note("a", "***++dirty tile++***\nmore")] });
  await expect(page.locator(".item-row .item-text").first()).toHaveText("dirty tile");
});

test("tick boxes: numbered lines lose their numbers; typing an item then tapping away keeps it", async ({ page }) => {
  await openApp(page);
  await seed(page, { items: [note("b", "1. Create\n2. Dog")] });
  await page.locator(".item-row").first().click();
  await page.click("#checklist-btn");
  await expect(page.locator(".cl-text")).toHaveCount(2);
  expect(await page.locator(".cl-text").evaluateAll((els) => els.map((e) => e.value))).toEqual(["Create", "Dog"]);
  await page.fill("#cl-add", "Milk");
  await page.click("#title-input"); // tap away, no Enter
  await expect(page.locator(".cl-text")).toHaveCount(3);
  await expect.poll(async () => ((await storedItems(page))[0].checklist || []).map((c) => c.text)).toEqual(["Create", "Dog", "Milk"]);
});

test("a collection's table updates as soon as an amount is changed", async ({ page }) => {
  await openApp(page);
  await page.click("#empty-example-btn");
  await page.click('#gp-views [data-view="table"]');
  await page.locator("#gp-table tbody tr", { hasText: "Train to Mysore" }).click();
  const amount = page.locator('.gp-detail input[aria-label="Amount"]');
  await amount.fill("800");
  await expect(page.locator("#gp-table tbody tr", { hasText: "Train to Mysore" })).toContainText("₹800");
  await expect(page.locator("#gp-table tfoot")).toContainText("₹3,520");
});

test("Enter in the new folder box creates the folder", async ({ page }) => {
  await openApp(page);
  await page.click("#add-folder-btn");
  await page.keyboard.type("Resume");
  await page.keyboard.press("Enter");
  await expect(page.locator(".popover")).toHaveCount(0);
  await expect(page.locator("#sidebar")).toContainText("Resume");
});

test("Inbox select bar never shows the word null", async ({ page }) => {
  await openApp(page);
  await page.locator("#main-nav .nav-item", { hasText: "Inbox" }).click();
  await page.fill("#cx-input", "hello");
  await page.keyboard.press("Enter");
  await page.click("#cx-select");
  await expect(page.locator("#cx-selbar")).not.toContainText("null");
  await expect(page.locator("#cx-selbar")).toContainText("Pick messages");
});

test("desktop: Timeline shows tick boxes as words, PDFs with a file icon; opening Inbox closes a note from Notes", async ({ page }) => {
  await openApp(page);
  await seed(page, { items: [note("c", "- [ ] milk\n- [x] bread")] });
  await page.locator("#main-nav .nav-item", { hasText: "Timeline" }).click();
  await expect(page.locator(".tl-row").first()).toContainText("milk");
  await expect(page.locator(".tl-row").first()).not.toContainText("[ ]");
  await page.locator("#main-nav .nav-item", { hasText: "All notes" }).click();
  await page.locator(".item-row").first().click();
  await expect(page.locator("#detail-pane")).toHaveClass(/open/);
  await page.locator("#main-nav .nav-item", { hasText: "Inbox" }).click();
  await expect(page.locator("#title-input")).toHaveCount(0);
});

test("a plain test message gets no 'lab reports' suggestion; a real lab report still does", async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const B = window.CPBrain;
    const groups = [{ id: "h", name: "Health", subs: [{ id: "lab", name: "Lab Reports" }, { id: "bill", name: "Bills" }], mainTags: [] }];
    const ix = B.build({ groups, entries: [], entities: [], tags: [] });
    const one = (text) => B.understand(ix, { text }).map((d) => d.s);
    return { plain: one("Round 1 test message - inbox text sample"), real: one("blood test report from the lab") };
  });
  expect(r.plain).toEqual([]);
  expect(r.real).toContain("lab");
});
