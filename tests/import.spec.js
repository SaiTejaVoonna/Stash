// Bringing things in from other apps: Google Keep, a WhatsApp chat export
// (also inside a zip with its photos), and text files.
const { test, expect, openApp, nav } = require("./fixtures");
const JSZip = require("jszip");

test.beforeEach(async ({ page }) => { await openApp(page); });

const KEEP = (title, extra = {}) => Buffer.from(JSON.stringify({ title, textContent: "Milk, eggs", isPinned: false, isArchived: false, isTrashed: false, color: "YELLOW",
  labels: [{ name: "Shopping" }], userEditedTimestampUsec: 1760000000000000, createdTimestampUsec: 1759000000000000, ...extra }));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function bringIn(page, files) {
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="data"]');
  const ch = page.waitForEvent("filechooser");
  await page.click("#import-apps-btn");
  await (await ch).setFiles(files);
}

test("reads WhatsApp exports from Android and iPhone, with attachments", async ({ page }) => {
  const r = await page.evaluate(() => window.CPImport.parseWhatsApp(
    "10/10/26, 5:08 pm - Sai: Tiramisu\n10/10/26, 5:10 pm - Sai: IMG-20261010-WA0001.jpg (file attached)\nMatcha boba\n" +
    "[11/10/26, 9:15:02 AM] Sai: ‎<attached: 00000012-PHOTO-2026-10-11.jpg>\n[11/10/26, 9:16:00 PM] Sai: Messages and calls are end-to-end encrypted.\n[11/10/26, 9:17:00 PM] Sai: bike service\nsecond line"));
  expect(r.map((m) => [m.text, m.attachment])).toEqual([["Tiramisu", null], ["Matcha boba", "IMG-20261010-WA0001.jpg"], ["", "00000012-PHOTO-2026-10-11.jpg"], ["bike service\nsecond line", null]]);
  const d = new Date(r[0].at);
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 10, 17, 8]);
});

test("Google Keep notes and a text file come in as notes; a WhatsApp zip with a photo comes into the Inbox", async ({ page }) => {
  const zip = new JSZip();
  zip.file("WhatsApp Chat with Me/_chat.txt", "[10/10/26, 5:08:12 PM] Sai: Tiramisu at the cafe\n[10/10/26, 5:10:00 PM] Sai: <attached: 00000012-PHOTO-2026-10-10.jpg>\n");
  zip.file("WhatsApp Chat with Me/00000012-PHOTO-2026-10-10.jpg", PNG);
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  await bringIn(page, [
    { name: "Groceries.json", mimeType: "application/json", buffer: KEEP("Groceries") },
    { name: "Old trash.json", mimeType: "application/json", buffer: KEEP("Gone", { isTrashed: true }) },
    { name: "Ideas.md", mimeType: "text/markdown", buffer: Buffer.from("# Ideas\n- a\n- b") },
    { name: "WhatsApp Chat with Me.zip", mimeType: "application/zip", buffer: zipBuf }
  ]);
  const found = page.locator("#import-found");
  await expect(found).toContainText("1 notes from Google Keep");
  await expect(found).toContainText("2 WhatsApp messages");
  await expect(found).toContainText("1 text notes");
  await page.click("#import-apps-go");
  await expect(page.locator(".toast-item").last()).toContainText("Brought in 2 notes, 2 messages");
  await page.click("#settings-close-btn");
  await nav(page, "All notes").click();
  await expect(page.locator(".item-row", { hasText: "Groceries" })).toHaveCount(1);
  await expect(page.locator(".item-row", { hasText: "Ideas" })).toHaveCount(1);
  await expect(page.locator(".item-row", { hasText: "Gone" })).toHaveCount(0);
  await nav(page, "Inbox").click();
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(2);
  await expect(page.locator("#chat-pane .cx-msg img")).toHaveCount(1);
  // The Keep label became a tag.
  expect(await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => r(q.result); });
    const tags = await new Promise((r) => { const q = db.transaction("tags").objectStore("tags").getAll(); q.onsuccess = () => r(q.result); });
    db.close(); return tags.map((t) => t.name);
  })).toContain("Shopping");
});
