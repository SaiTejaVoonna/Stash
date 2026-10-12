// Security regressions: things from outside (backups, imported files, synced
// records) are shown as text, never run as code.
const { test, expect, openApp } = require("./fixtures");

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.__pwned = 0; });
});
const pwned = (page) => page.evaluate(() => window.__pwned);

test("a backup with markup in a tag's emoji or colour can't run code", async ({ page }) => {
  const evil = {
    cpsVersion: 2, folders: [],
    tags: [
      { id: "t1", name: "Trip", emoji: '<img src=x onerror="window.__pwned=1">', color: "#ff0000" },
      { id: "t2", name: "Bills", emoji: "", color: 'red" onmouseover="window.__pwned=2' }
    ],
    items: [{ id: "i1", type: "note", title: "Tagged", content: "hello", tags: ["t1", "t2"], createdAt: 1, updatedAt: 1 }]
  };
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="data"]');
  await page.setInputFiles("#import-file", { name: "evil.cps", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(evil)) });
  await expect(page.locator(".toast-item").last()).toContainText("Imported");
  await page.click("#settings-close-btn");
  await expect(page.locator("#tags-list")).toContainText("Trip");
  await page.locator(".item-row", { hasText: "Tagged" }).hover();
  await page.locator("#tags-list .nav-item", { hasText: "Bills" }).hover();
  await page.waitForTimeout(300);
  expect(await pwned(page)).toBe(0);
  // Nothing from the backup became an element or an attribute.
  expect(await page.locator("#tags-list img, .item-row img[src='x']").count()).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll("[onmouseover],[onerror]")].length)).toBe(0);
});

test("an imported HTML file is read as text; its scripts and handlers never run", async ({ page }) => {
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="data"]');
  const ch = page.waitForEvent("filechooser");
  await page.click("#import-apps-btn");
  await (await ch).setFiles([{ name: "note.html", mimeType: "text/html",
    buffer: Buffer.from('<html><head><title>Shopping</title></head><body><p>Milk and eggs</p><img src="x" onerror="window.__pwned=3"><script>window.__pwned=4</script><svg onload="window.__pwned=5"></svg></body></html>') }]);
  await page.waitForTimeout(800);
  expect(await pwned(page)).toBe(0);
  const notes = await page.evaluate((html) => window.CPImport.scan([new File([html], "n.html", { type: "text/html" })]),
    '<p>Hi</p><img src=x onerror="window.__pwned=6">');
  expect(notes.notes[0].content).toBe("Hi");
  await page.waitForTimeout(300);
  expect(await pwned(page)).toBe(0);
});

test("print only embeds real pictures, escaped", async ({ page }) => {
  const html = await page.evaluate(() => {
    let written = "";
    window.open = () => ({ document: { open() {}, write(h) { written += h; }, close() {} } });
    window.CPFormat.print({ title: "T", content: "x", images: ['x" onerror="window.__pwned=7', "javascript:alert(1)", "data:image/png;base64,iVBORw0KGgo="] });
    return written;
  });
  expect(html).not.toContain("onerror");
  expect(html).not.toContain("javascript:");
  expect((html.match(/<img /g) || []).length).toBe(1);
});
