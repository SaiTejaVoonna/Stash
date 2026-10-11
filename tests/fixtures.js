// Shared helpers. Every test gets a fresh browser profile (empty IndexedDB),
// opens the app, and fails if the page throws an uncaught error.
const base = require("@playwright/test");
const { expect } = base;

const path = require("path");
// Libraries the app loads from a CDN the first time they're needed, served from
// node_modules instead (tests run offline).
const CDN = [
  [/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/(pdf(?:\.worker)?\.min\.js)$/, (m) => path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", m[1])],
  [/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip\/3\.10\.1\/jszip\.min\.js$/, () => path.join(__dirname, "..", "node_modules", "jszip", "dist", "jszip.min.js")]
];
async function routeCdn(page) {
  await page.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//, (route) => {
    const url = route.request().url();
    for (const [re, file] of CDN) { const m = url.match(re); if (m) return route.fulfill({ path: file(m), contentType: "application/javascript" }); }
    // The text reader: a stand-in that "reads" whatever the test sets in window.__ocrText.
    if (/tesseract\.js@/.test(url)) return route.fulfill({ contentType: "application/javascript",
      body: "window.Tesseract={createWorker:async function(){return{recognize:async function(){return{data:{text:window.__ocrText||'TOTAL 450'}}}}}};" });
    return route.abort();
  });
}
// A one-page PDF that says "Hello Stash".
function samplePdf(text = "Hello Stash") {
  const stream = "BT /F1 18 Tf 20 100 Td (" + text + ") Tj ET";
  return Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
    "4 0 obj<</Length " + stream.length + ">>stream\n" + stream + "\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
}

const test = base.test.extend({
  page: async ({ page }, use) => {
    await routeCdn(page);
    // Tests start as if "What's new" was already seen; one test checks it on its own.
    await page.addInitScript(() => { try { if (!sessionStorage.getItem("cp-test-whatsnew")) localStorage.setItem("copypaster-seen-version", "99"); } catch {} });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.stack || e.message));
    page.on("dialog", (d) => d.accept()); // confirm() prompts: say OK
    await use(page);
    expect(errors, "uncaught page errors").toEqual([]);
  },
});

// The "+ New" button: in the list header on computers, the dock's middle
// button on phones.
const newBtn = (page) => page.locator("#new-btn:visible, #tab-bar .tab-btn[data-tab='new']:visible").first();
// The full menu: the ☰ button on tablets, "More" in the dock on phones.
const menuBtn = (page) => page.locator("#menu-btn:visible, #tab-bar .tab-btn[data-tab='more']:visible").first();

async function openApp(page) {
  await page.goto("./");
  await expect(newBtn(page)).toBeVisible();
  // Wait for the first render from IndexedDB.
  await page.waitForFunction(() => document.querySelector("#items") !== null);
  await page.waitForTimeout(150);
}

// Writes items straight into IndexedDB (as an older version would have),
// then reloads so the app picks them up.
async function seed(page, { items = [], folders = [], tags = [] }) {
  await page.evaluate(async ({ items, folders, tags }) => {
    const db = await new Promise((resolve) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => resolve(q.result); });
    const tx = db.transaction(["items", "folders", "tags"], "readwrite");
    items.forEach((i) => tx.objectStore("items").put(i));
    folders.forEach((f) => tx.objectStore("folders").put(f));
    tags.forEach((t) => tx.objectStore("tags").put(t));
    await new Promise((r) => { tx.oncomplete = r; });
    db.close();
  }, { items, folders, tags });
  await page.reload();
  await expect(newBtn(page)).toBeVisible();
  await page.waitForTimeout(200);
}

async function storedItems(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => resolve(q.result); });
    const all = await new Promise((resolve) => { const q = db.transaction("items").objectStore("items").getAll(); q.onsuccess = () => resolve(q.result); });
    db.close();
    return all;
  });
}

// Creates a note by typing, and waits for autosave (700 ms debounce).
async function newNote(page, text, { title } = {}) {
  await newBtn(page).click();
  await page.click('#new-menu [data-new="note"]');
  await expect(page.locator("#content-input")).toBeFocused();
  if (title) await page.fill("#title-input", title);
  await page.fill("#content-input", text);
  await page.dispatchEvent("#content-input", "input");
  await expect(page.locator(".item-row", { hasText: title || text })).toHaveCount(1, { timeout: 3000 });
}

async function paste(page, text) {
  await page.evaluate((t) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  }, text);
}

const rowTexts = async (page) => page.locator(".item-row .item-text").allInnerTexts();
const lastToast = (page) => page.locator(".toast-item").last();
const nav = (page, name) => page.locator("#sidebar .nav-item", { hasText: name });

module.exports = { routeCdn, samplePdf, test, expect, openApp, seed, storedItems, newNote, paste, rowTexts, lastToast, nav, newBtn, menuBtn };
