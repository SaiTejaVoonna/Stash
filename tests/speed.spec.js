// Long lists draw a page at a time and more as you scroll.
const { test, expect, openApp } = require("./fixtures");

test.beforeEach(async ({ page }) => { await openApp(page); });

async function load(page, data) {
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="data"]');
  await page.setInputFiles("#import-file", { name: "big.cps", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ cpsVersion: 2, tags: [], folders: [], ...data })) });
  await expect(page.locator(".toast-item").last()).toContainText("Imported", { timeout: 30000 });
  await page.click("#settings-close-btn");
}

test("400 notes: the first page is drawn, more as you scroll; search still finds the last one", async ({ page }) => {
  const t0 = 1700000000000;
  await load(page, { items: Array.from({ length: 400 }, (_, i) => ({ id: "p" + i, type: "note", title: "Note " + i, content: "text " + i, createdAt: t0 + i * 60000, updatedAt: t0 + i * 60000 })) });
  await expect(page.locator(".item-row")).toHaveCount(150);
  await expect(page.locator("#list-more")).toContainText("250 left");
  // Scrolling to the end keeps drawing more until everything is there.
  await expect.poll(async () => {
    await page.evaluate(() => { const m = document.getElementById("list-more"); if (m) m.scrollIntoView(); });
    return page.locator(".item-row").count();
  }, { timeout: 15000 }).toBe(400);
  await expect(page.locator("#list-more")).toHaveCount(0);
  await page.fill("#search-input", "text 0");
  await expect(page.getByText("text 0", { exact: true })).toBeVisible();
});

test("a long Inbox shows the latest messages and loads earlier ones on request", async ({ page }) => {
  const t0 = 1700000000000;
  await load(page, { items: Array.from({ length: 200 }, (_, i) => ({ id: "c" + i, type: "note", chat: true, title: "", content: "message " + i, createdAt: t0 + i * 60000, updatedAt: t0 + i * 60000 })) });
  await page.locator('#main-nav [data-nav="chat"]').click();
  await expect(page.locator("#cx-earlier")).toContainText("(80)");
  await expect(page.getByText("message 199", { exact: true })).toBeVisible();
  await expect(page.getByText("message 0", { exact: true })).toHaveCount(0);
  // Tapping it (or scrolling up, which loads it by itself) brings the rest.
  await expect.poll(async () => {
    await page.evaluate(() => { const b = document.getElementById("cx-earlier"); if (b) b.click(); });
    return page.getByText("message 0", { exact: true }).count();
  }).toBe(1);
  await expect(page.locator("#cx-earlier")).toHaveCount(0);
});

test("a Word file in the Inbox says Word document, not its long technical type", async ({ page }) => {
  await page.locator('#main-nav [data-nav="chat"]').click();
  await page.click("#cx-plus");
  const ch = page.waitForEvent("filechooser");
  await page.click("#cx-files");
  await (await ch).setFiles([{ name: "My_CV.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.alloc(18000, 120) }]);
  await expect(page.locator(".cx-pv-filebig small")).toContainText("Word document");
  await page.click("#cx-preview-send");
  await expect(page.locator(".cx-file small").last()).toHaveText(/^Word document · 1[78](\.\d)? KB$/);
});

test("Not this: a suggestion can be turned down, and isn't offered again for that message", async ({ page }) => {
  await page.click("#groups-add-btn");
  await page.locator(".gp-tpl", { hasText: "Food" }).first().click();
  await page.click(".gp-sheet button:has-text('Create collection')");
  await page.click("#gp-text");
  await page.click("#gp-c-page");
  await page.locator(".gp-extras .gp-mini:has-text('New')").click();
  await page.fill("#gp-page-name", "Nimrah Cafe");
  await page.click("#gp-page-create");
  await expect(page.locator("#gp-c-page")).toContainText("Nimrah Cafe");
  await page.locator('#main-nav [data-nav="chat"]').click();
  await page.fill("#cx-input", "Irani chai at Nimrah Cafe");
  await page.click("#cx-send");
  const msg = page.locator("#chat-pane .cx-msg").last();
  await expect(msg.locator(".cx-why")).toContainText("Because it mentions Nimrah Cafe");
  await msg.locator(".cx-not").click();
  await expect(page.locator(".toast-item").last()).toContainText("won't suggest");
  await expect(msg.locator(".cx-guess")).toHaveCount(0);
  await page.reload();
  await page.locator('#main-nav [data-nav="chat"]').click();
  await expect(page.locator("#chat-pane .cx-msg").last()).toContainText("Irani chai");
  await expect(page.locator("#chat-pane .cx-msg").last().locator(".cx-guess")).toHaveCount(0);
});

test("your words: PUC finds pollution certificate; Stash's learning can be seen and forgotten", async ({ page }) => {
  const { newNote } = require("./fixtures");
  await newNote(page, "Renewed at the petrol pump, valid 6 months", { title: "Pollution certificate" });
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="learning"]');
  await page.fill("#learn-word", "PUC");
  await page.fill("#learn-means", "pollution certificate");
  await page.click("#learn-add");
  await expect(page.locator("#learn-list")).toContainText("PUC means pollution certificate");
  await page.click("#settings-close-btn");
  await page.fill("#search-input", "puc");
  await expect(page.locator(".item-row", { hasText: "Pollution certificate" })).toHaveCount(1);
  // Learned: file a message, then see it and forget it.
  await page.evaluate(() => window.CPBrain.learn("bike puncture repair", { g: "nope", s: null, tag: null }));
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="learning"]');
  await expect(page.locator("#learned-list")).toContainText("Nothing yet");
});

test("find by memory: 'hospital bill this week' understands the time; words inside a note say why they matched", async ({ page }) => {
  const { newNote } = require("./fixtures");
  await newNote(page, "City Clinic, paid in cash\nReceipt kept from the pharmacy counter", { title: "Hospital bill" });
  await page.locator('#main-nav [data-nav="timeline"]').click();
  await page.fill("#tl-search", "hospital bill this week");
  await expect(page.locator(".tl-active")).toContainText("This week");
  await expect(page.locator(".tl-row", { hasText: "Hospital bill" })).toHaveCount(1);
  // The time chip comes off as one piece.
  await page.locator(".tl-active .gp-filtered", { hasText: "This week" }).getByRole("button").click();
  await expect(page.locator("#tl-search")).toHaveValue("hospital bill");
  // Last week: nothing.
  await page.locator(".tl-when-chip", { hasText: "Last week" }).click();
  await expect(page.locator(".tl-row")).toHaveCount(0);
  // A word only inside the note: it says why it matched.
  await page.fill("#tl-search", "pharmacy");
  await expect(page.locator(".tl-row", { hasText: "Hospital bill" }).locator(".tl-why")).toContainText("Matched words inside it");
});

test("templates grow when needed: a discharge summary suggests Health's ready section; Edit shows the rest", async ({ page }) => {
  await page.click("#groups-add-btn");
  await page.locator(".gp-tpl", { hasText: "Health" }).first().click();
  await expect(page.locator(".gp-tpl.active")).toContainText("more when needed");
  await page.click(".gp-sheet button:has-text('Create collection')");
  await expect(page.locator(".gp-id h1")).toHaveText("Health");
  await page.locator('#main-nav [data-nav="chat"]').click();
  await page.fill("#cx-input", "Discharge summary from City Clinic");
  await page.click("#cx-send");
  const msg = page.locator("#chat-pane .cx-msg").last();
  await expect(msg.locator(".cx-guess")).toContainText("Health › Discharge summaries (new section)");
  await expect(msg.locator(".cx-why")).toContainText("it mentions discharge");
  await msg.locator(".cx-guess").click();
  await expect(page.locator(".toast-item").last()).toContainText("Health");
  // The section now exists; Edit collection offers the other ready ones.
  await page.locator(".gp-nav-group", { hasText: "Health" }).click();
  await page.getByRole("button", { name: "Edit collection" }).click();
  await expect(page.locator("#gp-ready")).toContainText("Surgeries & procedures");
  await expect(page.locator("#gp-ready")).not.toContainText("Discharge summaries");
  await page.locator('#gp-ready [data-ready="Vaccinations"]').click();
  await expect(page.locator("#gp-ready")).not.toContainText("Vaccinations");
});
