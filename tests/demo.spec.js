// Demo data: made-up notes, Inbox and collections, added and removed in one tap.
const { test, expect, openApp, storedItems, newNote } = require("./fixtures");

test("demo data loads (notes, Inbox, four collections with photos and a PDF) and removes cleanly, keeping your own things", async ({ page }) => {
  await openApp(page);
  await newNote(page, "my own note");
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="data"]');
  await page.click("#demo-load");
  await expect(page.locator(".toast-item").last()).toContainText("Demo data added", { timeout: 15000 });
  await expect(page.locator("#demo-remove")).toBeVisible();
  const items = await storedItems(page);
  expect(items.filter((i) => !i.chat && i.title === "Groceries").length).toBe(1);
  const pdfs = items.filter((i) => (i.files || []).some((f) => f.type === "application/pdf"));
  expect(pdfs.length).toBe(2);
  expect(pdfs[0].files[0].data.startsWith("data:application/pdf;base64,")).toBe(true);
  // The PDF is a real one.
  expect(Buffer.from(pdfs[0].files[0].data.split(",")[1], "base64").toString("latin1")).toMatch(/^%PDF-1\.4[\s\S]*xref[\s\S]*%%EOF\s*$/);
  const groups = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => r(q.result); });
    const all = (s) => new Promise((r) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
    const out = { groups: (await all("groups")).map((g) => g.name), entries: (await all("entries")).length, photos: (await all("entries")).filter((e) => e.photos.length).length };
    db.close();
    return out;
  });
  expect(groups.groups.sort()).toEqual(["Food", "Health", "Trips", "Vehicles"]);
  expect(groups.entries).toBe(18);
  expect(groups.photos).toBeGreaterThanOrEqual(8);
  // Nothing real: only the made-up names.
  const text = JSON.stringify(items.map((i) => [i.title, i.content]));
  expect(text).toContain("Dr Asha Verma");
  await page.click("#demo-remove");
  await expect(page.locator(".toast-item").last()).toContainText("Demo data removed");
  const left = (await storedItems(page)).filter((i) => !i.deletedAt);
  expect(left.map((i) => i.content)).toEqual(["my own note"]);
  const after = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => r(q.result); });
    const n = (s) => new Promise((r) => { const q = db.transaction(s).objectStore(s).count(); q.onsuccess = () => r(q.result); });
    const out = [await n("groups"), await n("entries"), await n("entities")];
    db.close();
    return out;
  });
  expect(after).toEqual([0, 0, 0]);
  await expect(page.locator("#demo-load")).toBeVisible();
});
