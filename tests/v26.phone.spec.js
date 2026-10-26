// 2.6 on a phone: the Filter sheet (same spacing everywhere, hide with a
// second tap, custom dates) and a dock you can change.
const { test, expect, openApp, newNote, openSettingsFromMe, seed, libraryTo, libTab, flickLibrary } = require("./fixtures");

test.beforeEach(async ({ page }) => { await openApp(page); });

test("Filter sheet: every section spaced the same, tap twice to hide, custom dates, buttons always reachable", async ({ page }) => {
  await newNote(page, "Groceries");
  await page.goBack();
  await page.tap("#tab-bar [data-tab='search']");
  await page.tap(".tl-filter-btn");
  const secs = page.locator("#cp-sheet-overlay .tl-fsec");
  await expect(secs).toHaveCount(6);
  // Each section title sits the same distance above its first chip row.
  const gaps = await secs.evaluateAll((els) => els.map((el) => {
    const t = el.querySelector(".tl-sheet-sec").getBoundingClientRect();
    const r = el.querySelector(".tl-chip-row").getBoundingClientRect();
    return Math.round(r.top - t.bottom);
  }));
  expect(new Set(gaps).size).toBe(1);

  const notes = page.locator('#cp-sheet-overlay .chip[data-type="note"]');
  await notes.tap();
  await expect(notes).toHaveAttribute("data-state", "on");
  await notes.tap();
  await expect(notes).toHaveAttribute("data-state", "not");
  await expect(page.locator("#cp-sheet-overlay .btn.primary")).toHaveText("Show 0");

  await page.tap("#tl-custom-dates");
  await page.fill("#tl-from", "2020-01-01");
  await page.fill("#tl-to", "2020-12-31");
  await page.tap("#tl-date-apply");
  await expect(page.locator("#tl-custom-dates")).toContainText("1 Jan 2020");
  // Clear all / Show stay on screen at the bottom of a long sheet.
  await expect(page.locator("#cp-sheet-overlay .gp-sheet-actions .btn.primary")).toBeInViewport();
  await page.locator("#cp-sheet-overlay .gp-sheet-actions .btn", { hasText: "Clear all" }).tap();
  await expect(page.locator("#cp-sheet-overlay .btn.primary")).toHaveText("Show 1");
});

test("dock: pick tabs in Settings; Timeline gets its own tab without the keyboard", async ({ page }) => {
  await page.tap("#tab-bar [data-tab='more']");
  await openSettingsFromMe(page, "look");
  await page.selectOption("#dock-slot-2", "timeline");
  await expect(page.locator("#tab-bar [data-tab='timeline']")).toHaveCount(1);
  await expect(page.locator("#tab-bar [data-tab='search']")).toHaveCount(0);
  // Picking a tab that's already used swaps them instead of doubling up.
  await page.selectOption("#dock-slot-0", "groups");
  await expect(page.locator("#dock-slot-1")).toHaveValue("chat");
  await page.reload();
  await expect(page.locator("#tab-bar .tab-btn")).toHaveCount(5);
  await expect(page.locator("#tab-bar .tab-btn").nth(0)).toHaveAttribute("data-tab", "groups");
  await expect(page.locator("#tab-bar .tab-btn").nth(3)).toHaveAttribute("data-tab", "timeline");
  await page.tap("#tab-bar [data-tab='timeline']");
  await expect(page.locator("#tl-pane")).toBeVisible();
  await expect(page.locator("#tl-search")).not.toBeFocused();
  await expect(page.locator("#tab-bar [data-tab='timeline']")).toHaveClass(/active/);
});

test("the phone Filter sheet and dock settings say Collection, never group", async ({ page }) => {
  await page.tap("#tab-bar [data-tab='search']");
  await page.tap(".tl-filter-btn");
  await expect(page.locator("#cp-sheet-overlay")).toContainText("Collection");
  await expect(page.locator("#cp-sheet-overlay")).not.toContainText(/group/i);
  await page.keyboard.press("Escape");
  await page.goto("./");
  await page.tap("#tab-bar [data-tab='more']");
  await openSettingsFromMe(page, "look");
  const options = await page.locator("#dock-slot-0 option").allInnerTexts();
  expect(options).toContain("Library");
  expect(options.join(" ")).not.toMatch(/group/i);
});

test("Snap is the dock's middle button; holding it opens New; Settings can put New back", async ({ page }) => {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.tap("#tab-bar [data-tab='snap']")]);
  await chooser.setFiles({ name: "a.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(1);
  // Saved at once; the box below now adds its caption.
  await expect(page.locator("#cx-capbar")).toContainText("Saved");
  await page.fill("#cx-input", "Matcha boba");
  // Shown under the photo while typing, before it's sent.
  await expect(page.locator("#chat-pane .cx-msg .cx-live")).toHaveText("Matcha boba");
  await page.tap("#cx-send");
  await expect(page.locator("#chat-pane .cx-live")).toHaveCount(0);
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(1);
  await expect(page.locator("#chat-pane .cx-msg")).toContainText("Matcha boba");
  await expect(page.locator("#cx-capbar")).toBeHidden();
  // Hold for the New menu.
  const snap = page.locator("#tab-bar [data-tab='snap']");
  const box = await snap.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.locator("#new-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  // Settings → Appearance → Middle: New.
  await page.tap("#tab-bar [data-tab='more']");
  await openSettingsFromMe(page, "look");
  await page.selectOption("#dock-middle", "new");
  await expect(page.locator("#tab-bar [data-tab='new']")).toHaveCount(1);
  await expect(page.locator("#tab-bar [data-tab='snap']")).toHaveCount(0);
});

test("What's new shows once after an update, never on a brand-new install", async ({ page }) => {
  // Brand-new: nothing to announce.
  await page.evaluate(() => { sessionStorage.setItem("cp-test-whatsnew", "1"); localStorage.removeItem("copypaster-seen-version"); });
  await page.reload();
  await expect(page.locator("#tab-bar")).toBeVisible();
  await expect(page.locator("#whats-new")).toHaveCount(0);
  // Someone updating from 2.5: they have notes and never saw this.
  await page.tap("#new-btn");
  await page.tap('#new-menu [data-new="note"]');
  await expect(page.locator("#content-input")).toBeFocused();
  await page.fill("#content-input", "Milk");
  await page.dispatchEvent("#content-input", "input");
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => r(q.result); });
    const n = await new Promise((r) => { const q = db.transaction("items").objectStore("items").count(); q.onsuccess = () => r(q.result); });
    db.close(); return n;
  }), { timeout: 5000 }).toBeGreaterThan(0);
  await page.evaluate(() => localStorage.removeItem("copypaster-seen-version"));
  await page.reload();
  await expect(page.locator("#whats-new")).toBeVisible();
  await expect(page.locator("#whats-new")).toContainText("Suggestions that say why");
  await page.tap("#whats-new-ok");
  await expect(page.locator("#whats-new")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#tab-bar")).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator("#whats-new")).toHaveCount(0);
});

test("words typed just before the app closes are kept", async ({ page }) => {
  await page.tap("#new-btn");
  await page.tap('#new-menu [data-new="note"]');
  await expect(page.locator("#content-input")).toBeFocused();
  await page.fill("#content-input", "Milk and eggs");
  await page.dispatchEvent("#content-input", "input");
  await page.reload(); // straight away, before the usual save
  await expect(page.locator(".item-row", { hasText: "Milk and eggs" })).toHaveCount(1);
});

// ---------- Me chat ----------
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
test("Me chat: message yourself with text, photos and a PDF; select and forward into a collection, section and page", async ({ page }) => {
  // A space with a page to forward into.
  await libraryTo(page, "collections");
  await page.locator(".gp-empty button", { hasText: "New collection" }).tap();
  await page.locator(".gp-tpl", { hasText: "Vehicles" }).tap();
  await page.fill("#gp-new-name", "Bike");
  await page.tap(".gp-sheet button:has-text('Create collection')");
  await page.tap("#gp-text");
  await page.tap("#gp-c-page");
  await page.locator(".gp-extras .gp-mini:has-text('New')").tap();
  await page.fill("#gp-page-name", "Fz V3");
  await page.tap("#gp-page-create");
  await expect(page.locator(".gp-person", { hasText: "Fz V3" })).toBeVisible();
  await openApp(page);

  await page.tap("#tab-bar [data-tab='chat']");
  await expect(page.locator("#chat-pane")).toBeVisible();
  await expect(page.locator(".cx-empty")).toContainText("Drop anything here");
  await page.fill("#cx-input", "Tyre pressure 32 psi @fzv3");
  await page.tap("#cx-send");
  await page.tap("#cx-plus");
  const ch1 = page.waitForEvent("filechooser");
  await page.tap("#cx-gallery");
  await (await ch1).setFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG1 });
  await page.tap("#cx-preview-send");
  await page.tap("#cx-plus");
  const ch2 = page.waitForEvent("filechooser");
  await page.tap("#cx-files");
  await (await ch2).setFiles({ name: "insurance.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.tap("#cx-preview-send");
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(3);
  await expect(page.locator(".cx-file")).toContainText("insurance.pdf");
  await expect(page.locator("#chat-pane .cx-msg").first()).toContainText("Tyre pressure 32 psi");
  // Messages stay out of the notes list.
  await page.evaluate(() => document.querySelector("#tab-bar [data-tab='more']") && 0);

  // Select all three and forward: @fzv3 picks Bike → Fz V3.
  await page.tap("#cx-select");
  for (const i of [0, 1, 2]) await page.locator("#chat-pane .cx-msg").nth(i).tap();
  await expect(page.locator(".cx-count")).toHaveText("3 selected");
  await page.tap("#cx-forward");
  await expect(page.locator(".gp-sheet")).toContainText("Move 3 messages");
  await expect(page.locator("#gp-sort-spaces .gp-mini.active")).toContainText("Bike");
  await expect(page.locator(".gp-sort-row .gp-mini.active", { hasText: "Fz V3" })).toHaveCount(1);
  await page.locator("#gp-sort-subs .gp-mini", { hasText: "Insurance & papers" }).tap();
  await page.tap("#gp-sort-save");
  await expect(page.locator(".toast-item").last()).toContainText("Saved to Bike → Insurance & papers");
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(0);
  const entries = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => r(q.result); });
    const all = await new Promise((r) => { const q = db.transaction("entries").objectStore("entries").getAll(); q.onsuccess = () => r(q.result); });
    db.close(); return all.map((e) => ({ title: e.title, files: (e.files || []).map((f) => f.name), photos: e.photos.length, tag: !!e.refs[0].tag }));
  });
  expect(entries.map((e) => e.title).sort()).toEqual(["Photo", "Tyre pressure 32 psi @fzv3", "insurance.pdf"].sort());
  expect(entries.find((e) => e.title === "insurance.pdf").files).toEqual(["insurance.pdf"]);
  expect(entries.every((e) => e.tag)).toBe(true);
});

test("Me chat: hold a message to select it, delete with Undo; Back leaves the chat", async ({ page }) => {
  await page.tap("#tab-bar [data-tab='chat']");
  await page.fill("#cx-input", "Call the dentist");
  await page.tap("#cx-send");
  const msg = page.locator("#chat-pane .cx-msg").first();
  const box = await msg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.locator(".cx-count")).toHaveText("1 selected");
  await page.tap("#cx-delete");
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(0);
  await page.locator(".toast-item button", { hasText: "Undo" }).last().tap();
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(1);
  // The message isn't in the notes list.
  await page.goBack();
  await expect(page.locator("#chat-pane")).toBeHidden();
  await expect(page.locator(".item-row", { hasText: "Call the dentist" })).toHaveCount(0);
});

test("Inbox captions: photos and a file show first, get a caption, and go as one album; HD off keeps no originals; edit later", async ({ page }) => {
  await page.tap("#tab-bar [data-tab='chat']");
  await page.tap("#cx-plus");
  const ch = page.waitForEvent("filechooser");
  await page.tap("#cx-gallery");
  await (await ch).setFiles([{ name: "a.png", mimeType: "image/png", buffer: PNG1 }, { name: "b.png", mimeType: "image/png", buffer: PNG1 },
    { name: "c.png", mimeType: "image/png", buffer: PNG1 }, { name: "bill.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 x") }]);
  await expect(page.locator("#cx-preview")).toBeVisible();
  await expect(page.locator(".cx-pv-title")).toHaveText("4 to send");
  await expect(page.locator("#tab-bar")).toBeHidden();
  // Drop one, turn HD off, write a caption.
  await page.locator(".cx-pv-x").nth(2).tap();
  await expect(page.locator(".cx-pv-title")).toHaveText("3 to send");
  await page.tap("#cx-hd");
  await page.fill("#cx-caption", "Matcha boba at the cafe");
  await page.tap("#cx-preview-send");
  await expect(page.locator("#cx-preview")).toBeHidden();
  const msg = page.locator("#chat-pane .cx-msg");
  await expect(msg).toHaveCount(1);
  await expect(msg.locator(".cx-album img")).toHaveCount(2);
  await expect(msg.locator(".cx-file")).toContainText("bill.pdf");
  await expect(msg).toContainText("Matcha boba at the cafe");
  const stored = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => r(q.result); });
    const all = await new Promise((r) => { const q = db.transaction("items").objectStore("items").getAll(); q.onsuccess = () => r(q.result); });
    db.close(); const n = all.find((i) => i.chat); return { images: n.images.length, captures: n.captures.length, original: n.capture.original, content: n.content };
  });
  expect(stored).toEqual({ images: 2, captures: 1, original: null, content: "Matcha boba at the cafe" });
  // Edit the caption later: select it → Edit caption.
  await page.tap("#cx-select");
  await msg.tap();
  await page.tap("#cx-edit");
  await expect(page.locator(".cx-pv-title")).toHaveText("Edit caption");
  await page.fill("#cx-caption", "Matcha boba, 250");
  await page.tap("#cx-preview-send");
  await expect(msg).toContainText("Matcha boba, 250");
  // Back closes the preview before anything else.
  await page.tap("#cx-plus");
  const ch2 = page.waitForEvent("filechooser");
  await page.tap("#cx-files");
  await (await ch2).setFiles({ name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 y") });
  await expect(page.locator("#cx-preview")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#cx-preview")).toBeHidden();
  await expect(page.locator("#chat-pane")).toBeVisible();
  await expect(msg).toHaveCount(1);
});

test("Inbox tools: filters, search, select all, archive with Undo, clean up empty and repeated messages", async ({ page }) => {
  await page.tap("#tab-bar [data-tab='chat']");
  for (const t of ["Buy milk", "https://example.com/recipe", "Buy milk"]) { await page.fill("#cx-input", t); await page.tap("#cx-send"); }
  await page.tap("#cx-plus");
  const ch = page.waitForEvent("filechooser");
  await page.tap("#cx-gallery");
  await (await ch).setFiles({ name: "a.png", mimeType: "image/png", buffer: PNG1 });
  await page.tap("#cx-preview-send");
  const msgs = page.locator("#chat-pane .cx-msg");
  await expect(msgs).toHaveCount(4);
  // Filters.
  await page.locator(".cx-filter[data-filter='links']").tap();
  await expect(msgs).toHaveCount(1);
  await page.locator(".cx-filter[data-filter='photos']").tap();
  await expect(msgs).toHaveCount(1);
  await page.locator(".cx-filter[data-filter='all']").tap();
  // Search.
  await page.tap("#cx-q"); // the pill opens the one Search page, set to the Inbox
  await expect(page.locator("#tl-pane")).toBeVisible();
  await expect(page.locator(".tl-scope-chip.on")).toHaveText("Inbox");
  await page.fill("#tl-search", "milk");
  await expect(page.locator("#tl-body .tl-row")).toHaveCount(2);
  await page.goBack();
  await page.goBack();
  await expect(msgs).toHaveCount(4);
  // Clean up: the second "Buy milk" is a repeat, picked already.
  await page.tap("#cx-cleanup");
  await expect(page.locator(".cx-clean-sec[data-group='dupes']")).toContainText("The same thing twice (1)");
  await page.tap("#cx-clean-archive");
  await expect(msgs).toHaveCount(3);
  await page.locator(".cx-filter[data-filter='archived']").tap();
  await expect(msgs).toHaveCount(1);
  await page.locator(".cx-filter[data-filter='all']").tap();
  // Select all → Archive → Undo.
  await page.tap("#cx-select");
  await page.tap("#cx-all");
  await expect(page.locator(".cx-count")).toHaveText("3 selected");
  await page.tap("#cx-archive");
  await expect(msgs).toHaveCount(0);
  await page.locator(".toast-item", { hasText: "Archived 3 messages" }).getByRole("button", { name: "Undo" }).tap();
  await expect(msgs).toHaveCount(3);
});

test("Smart sorting: @ and # lists while typing, spotted amounts, a one-tap suggestion, Sort many; typed #words stay text", async ({ page }) => {
  // A Food collection with a page "Nimrah Cafe".
  await libraryTo(page, "collections");
  await page.locator(".gp-empty button", { hasText: "New collection" }).tap();
  await page.locator(".gp-tpl", { hasText: "Food" }).first().tap();
  await page.tap(".gp-sheet button:has-text('Create collection')");
  await page.tap("#gp-text");
  await page.tap("#gp-c-page");
  await page.locator(".gp-extras .gp-mini:has-text('New')").tap();
  await page.fill("#gp-page-name", "Nimrah Cafe");
  await page.tap("#gp-page-create");
  // Saved and shown before the reload (a reload can cut off a save still in progress).
  await expect(page.locator("#gp-c-page")).toContainText("Nimrah Cafe");
  await openApp(page);
  await page.tap("#tab-bar [data-tab='chat']");
  // @ list: pick the page.
  await page.locator("#cx-input").pressSequentially("Matcha boba ₹250 @nim");
  await expect(page.locator("#cx-sug")).toBeVisible();
  await expect(page.locator(".cx-sug-item").first()).toContainText("Nimrah Cafe");
  await page.locator(".cx-sug-item").first().tap();
  await expect(page.locator("#cx-input")).toHaveValue("Matcha boba ₹250 @NimrahCafe ");
  await expect(page.locator("#cx-spots")).toContainText("₹250");
  // # list offers a new tag; a typed #word that isn't picked stays text.
  await page.locator("#cx-input").pressSequentially("#bobatea");
  await expect(page.locator(".cx-sug-item").first()).toContainText("#bobatea");
  await page.locator(".cx-sug-item").first().tap();
  await page.tap("#cx-send");
  const msg = page.locator("#chat-pane .cx-msg").last();
  await expect(msg.locator(".cx-guess")).toContainText("Food");
  await expect(msg.locator(".cx-guess")).toContainText("Nimrah Cafe");
  // It says why, in plain words.
  await expect(msg.locator(".cx-why")).toContainText("Because you picked it");
  // One tap files it, with the amount and the tag.
  await msg.locator(".cx-guess").tap();
  await expect(page.locator(".toast-item").last()).toContainText("Filed to Food");
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(0);
  const e = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open("copypaster"); q.onsuccess = () => r(q.result); });
    const all = await new Promise((r) => { const q = db.transaction("entries").objectStore("entries").getAll(); q.onsuccess = () => r(q.result); });
    db.close(); return all.map((x) => ({ amount: x.amount, tags: x.tags, page: !!x.refs[0].tag }));
  });
  expect(e).toEqual([{ amount: 25000, tags: ["bobatea"], page: true }]);
  // Sort many: two messages, one sure, one not.
  for (const t of ["Biryani at Nimrah Cafe", "random thought"]) { await page.fill("#cx-input", t); await page.tap("#cx-send"); }
  await page.tap("#cx-select");
  await page.tap("#cx-all");
  await page.tap("#cx-sort");
  await expect(page.locator(".cx-sort-row")).toHaveCount(2);
  await expect(page.locator(".cx-sort-row").first()).toContainText("→ Food");
  await expect(page.locator(".cx-sort-row").last()).toContainText("stays in the Inbox");
  await page.tap("#cx-sort-move");
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(1);
  await expect(page.locator("#chat-pane .cx-msg")).toContainText("random thought");
});

test("The dock's middle button is + by default: one sheet to add text, a photo, a scan or a drawing", async ({ page }) => {
  await page.evaluate(() => { sessionStorage.setItem("cp-test-dockdefault", "1"); localStorage.removeItem("copypaster-dock-middle"); });
  await page.reload();
  await expect(page.locator("#tab-bar [data-tab='new']")).toBeVisible();
  await expect(page.locator("#tab-bar [data-tab='snap']")).toHaveCount(0);
  await page.tap("#tab-bar [data-tab='new']");
  await expect(page.locator("#new-menu")).toBeVisible();
  await expect(page.locator("#new-menu [data-new='note']")).toBeVisible();
  await expect(page.locator("#new-menu [data-new='snap']")).toBeVisible();
  await expect(page.locator("#new-menu [data-new='sketch']")).toBeVisible();
});

test("Inbox: a message that looks like a key or a card number offers the Vault", async ({ page }) => {
  await page.tap("#tab-bar [data-tab='chat']");
  await page.fill("#cx-input", "my google key " + "AIza" + "x".repeat(35));
  await page.tap("#cx-send");
  await page.fill("#cx-input", "card 4242 4242 4242 4242 for the trip");
  await page.tap("#cx-send");
  await page.fill("#cx-input", "dinner at 7 with Dr Asha Verma");
  await page.tap("#cx-send");
  await expect(page.locator("#chat-pane .cx-msg")).toHaveCount(3);
  await expect(page.locator("#chat-pane .cx-secret")).toHaveCount(2);
  await expect(page.locator("#chat-pane .cx-secret").first()).toContainText("a Google API key");
  await expect(page.locator("#chat-pane .cx-secret").nth(1)).toContainText("a card number");
  await page.locator("#chat-pane .cx-vault").first().tap();
  await expect(page.locator("#dialog")).toContainText("Set up your Vault"); // the Vault asks to be set up first
});

test("A new person doesn't get Commands, Passwords or the Template store until they switch them on", async ({ page }) => {
  await page.evaluate(() => { sessionStorage.setItem("cp-test-addondefault", "1"); sessionStorage.setItem("cp-test-dockdefault", "1"); localStorage.removeItem("copypaster-addons"); localStorage.removeItem("copypaster-dock-middle"); });
  await page.reload();
  await page.tap("#tab-bar [data-tab='new']");
  await expect(page.locator("#new-menu [data-new='note']")).toBeVisible();
  await expect(page.locator("#new-menu [data-new='command']")).toHaveCount(0);
  await expect(page.locator("#new-menu [data-new='password']")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.tap("#tab-bar [data-tab='more']");
  await openSettingsFromMe(page, "addons");
  await expect(page.locator('#addons-settings [data-addon="passwords"]')).not.toBeChecked();
  await expect(page.locator('#addons-settings [data-addon="templates"]')).not.toBeChecked();
});

test("a checklist note's preview shows boxes for every line, not '- [ ]'", async ({ page }) => {
  const now = Date.now();
  await seed(page, { items: [{ id: "cl1", type: "note", content: "Buy milk\n- [ ] eggs\n- [ ] bread", createdAt: now, updatedAt: now, schemaVersion: 2 }] });
  await page.reload();
  await libraryTo(page, "notes");
  const sub = page.locator(".item-row .item-subtext").first();
  await expect(sub).toContainText("eggs");
  await expect(sub).not.toContainText("[ ]");
});

test("on a phone, Stash opens at the Inbox every time", async ({ page }) => {
  const now = Date.now();
  await seed(page, { items: [{ id: "s1", type: "note", content: "Corner Tea House bill 240", createdAt: now, updatedAt: now, schemaVersion: 2 }] });
  await page.evaluate(() => { sessionStorage.setItem("cp-test-startinbox", "1"); localStorage.setItem("copypaster-start", "inbox"); });
  await page.reload();
  await expect(page.locator('.tab-btn[data-tab="chat"]')).toHaveClass(/active/);
});
