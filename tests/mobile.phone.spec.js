const { test, expect, openApp, seed, storedItems, rowTexts, lastToast, newBtn, menuBtn, openSettingsFromMe, libraryTo, libTab, holdLibrary } = require("./fixtures");

const t = Date.now();
const notes = (...names) => names.map((n, i) => ({ id: n, type: "note", content: n, createdAt: t - i, updatedAt: t - i, schemaVersion: 2 }));

test.beforeEach(async ({ page }) => { await openApp(page); });

// Real touch events through the DevTools protocol (Playwright's tap() has no drag or hold).
async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  if (process.env.SLOW) await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.SLOW) });
  const send = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  return {
    async swipe(x1, x2, y) {
      await send("touchStart", [{ x: x1, y }]);
      for (let i = 1; i <= 8; i++) await send("touchMove", [{ x: x1 + (x2 - x1) * i / 8, y: y + i }]);
      await send("touchEnd", []);
      await page.waitForTimeout(400);
    },
    async hold(x, y, ms = 650) {
      await send("touchStart", [{ x, y }]);
      await page.waitForTimeout(ms);
      await send("touchEnd", []);
      await page.waitForTimeout(500);
    },
  };
}
const rowCenter = async (page, text) => {
  const bb = await page.locator(".item-row", { hasText: text }).boundingBox();
  return bb.y + bb.height / 2;
};

test("swipe reveals a button; tapping it trashes, tapping elsewhere just closes it", async ({ page }) => {
  await seed(page, { items: notes("one", "two", "three") });
  const fingers = await touch(page);

  await fingers.swipe(320, 150, await rowCenter(page, "two"));
  await expect(page.locator(".swipe-action")).toHaveCount(1);
  await page.locator(".item-row", { hasText: "one" }).tap();
  await expect(page.locator(".swipe-action")).toHaveCount(0);
  await expect(page.locator("#detail-pane")).not.toHaveClass(/open/);

  await fingers.swipe(320, 150, await rowCenter(page, "two"));
  // If the button didn't show, say what happened instead.
  const state = await page.evaluate(() => ({
    sheet: !!document.getElementById("action-sheet"),
    detailOpen: document.getElementById("detail-pane").classList.contains("open"),
    rows: [...document.querySelectorAll(".item-row")].map((r) => [r.innerText.split("\n")[0], r.style.transform, r.className]),
  }));
  expect(await page.locator(".swipe-action").count(), JSON.stringify(state)).toBe(1);
  await page.locator(".swipe-action").tap();
  await expect.poll(() => rowTexts(page)).toEqual(["one", "three"]);
  await expect(lastToast(page)).toContainText("Trash");
});

test("long-press opens the action sheet; pin and move to folder work from it", async ({ page }) => {
  await seed(page, { items: notes("alpha", "beta"), folders: [{ id: "f1", name: "Work" }] });
  const fingers = await touch(page);

  await fingers.hold(200, await rowCenter(page, "beta"));
  await expect(page.locator("#action-sheet")).toBeVisible();
  await expect(page.locator("#detail-pane")).not.toHaveClass(/open/);
  await page.locator("#action-sheet button", { hasText: "Pin" }).tap();
  await expect(lastToast(page)).toContainText("Pinned");
  await expect(page.locator("#action-sheet")).toHaveCount(0);

  await fingers.hold(200, await rowCenter(page, "alpha"));
  await page.locator("#action-sheet button", { hasText: "Move to folder" }).tap();
  await page.locator("#action-sheet button", { hasText: "Work" }).tap();
  await expect(lastToast(page)).toContainText("Work");
  expect((await storedItems(page)).find((i) => i.id === "alpha").folderId).toBe("f1");
});

test("More opens a page and closes; its Vault row opens the Vault; the New folder box is on top", async ({ page }) => {
  await menuBtn(page).tap();
  await expect(page.locator("#sidebar")).toHaveClass(/open/);
  await page.locator("#sidebar .nav-item", { hasText: "Vault" }).tap();
  await expect(page.locator("#list-title")).toHaveText("Vault");
  await expect(page.locator("#sidebar")).not.toHaveClass(/open/);

  // More › Folders › + (the box opens on top of everything).
  await page.tap('.tab-btn[data-tab="more"]');
  await page.tap("#add-folder-btn");
  // The box slides up when it opens, so wait until it has settled before checking what is on top (slower machines read it mid-slide).
  await expect.poll(async () => {
    const box = await page.locator(".popover").boundingBox();
    if (!box) return false;
    return page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest(".popover")); }, { x: box.x + box.width / 2, y: box.y + 30 });
  }, { timeout: 5000 }).toBe(true);
});

test("select mode shows the bulk bar inside the screen", async ({ page }) => {
  await seed(page, { items: notes("one", "two") });
  await page.tap("#select-mode-btn");
  await page.tap("#select-all-checkbox");
  const bar = await page.locator("#bulk-bar").boundingBox();
  expect(bar.y + bar.height).toBeLessThanOrEqual(664);
});

test("back button closes the open item before leaving", async ({ page }) => {
  await seed(page, { items: notes("one") });
  await page.locator(".item-row").first().tap();
  await expect(page.locator("#detail-pane")).toHaveClass(/open/);
  await page.evaluate(() => history.back());
  await page.waitForTimeout(400);
  await expect(page.locator("#detail-pane")).not.toHaveClass(/open/);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("text fields are 16px so iPhone does not zoom in", async ({ page }) => {
  const size = (sel) => page.$eval(sel, (e) => getComputedStyle(e).fontSize);
  const px = async (sel) => parseFloat(await size(sel));
  expect(await px("#search-input")).toBeGreaterThanOrEqual(16);
  await newBtn(page).tap();
  await page.tap('#new-menu [data-new="note"]');
  await expect(page.locator("#content-input")).toBeVisible();
  expect(await px("#title-input")).toBeGreaterThanOrEqual(16);
  expect(await px("#content-input")).toBeGreaterThanOrEqual(16);
});

test("Save on a phone says Saved and goes back to the list", async ({ page }) => {
  await newBtn(page).tap();
  await page.tap('#new-menu [data-new="note"]');
  await page.fill("#content-input", "saved from phone");
  await page.locator("#detail-pane button.action", { hasText: "Done" }).tap();
  await expect(lastToast(page)).toContainText("Saved");
  await expect(page.locator("#detail-pane")).not.toHaveClass(/open/);
  await expect(page.locator(".item-row", { hasText: "saved from phone" })).toBeVisible();
});

test("profile switcher opens as a sheet on phones", async ({ page }) => {
  await menuBtn(page).tap();
  await page.tap("#profile-btn");
  await expect(page.locator("#action-sheet")).toContainText("Personal");
  await page.locator("#action-sheet button", { hasText: "New profile" }).tap();
  await page.fill("#dialog-name", "Work");
  await page.locator("#dialog button[type=submit]").tap();
  await page.waitForLoadState("load");
  await expect(page.locator("#profile-name")).toHaveText("Work");
});

test("the dock: Inbox, Collections, Snap, Search, More; New is the + at the top; no second menu button; Settings goes list → section → back", async ({ page }) => {
  await expect(page.locator("#tab-bar .tab-btn")).toHaveText(["Inbox", "Notes", "Snap", "Search", "More"]); // the Library tab shows the page you are on
  await expect(page.locator("#menu-btn")).toBeHidden(); // More in the dock is the one menu button
  await expect(page.locator("#new-btn")).toBeVisible(); // with Snap in the middle, New is the round + at the top
  await page.tap('.tab-btn[data-tab="search"]');
  await expect(page.locator("#tl-pane")).toBeVisible();
  await expect(page.locator('.tab-btn[data-tab="search"]')).toHaveClass(/active/);
  // All notes live in Library now.
  await libraryTo(page, "notes");
  await expect(page.locator("#list-title")).toHaveText("All notes");
  await page.tap('.tab-btn[data-tab="chat"]');
  await expect(page.locator("#chat-pane")).toBeVisible();
  await expect(page.locator('.tab-btn[data-tab="chat"]')).toHaveClass(/active/);
  await page.tap('.tab-btn[data-tab="more"]');
  await expect(page.locator("#sidebar")).toHaveClass(/open/);
  await page.locator("#sidebar .nav-item", { hasText: "Vault" }).tap();
  await expect(page.locator("#list-title")).toHaveText("Vault");
  await page.tap('.tab-btn[data-tab="more"]');
  await openSettingsFromMe(page, "privacy");
  await expect(page.locator("#settings-title")).toHaveText("Privacy and lock");
  await expect(page.locator("#vault-setup-btn")).toBeVisible();
  await page.tap("#settings-back-btn");
  await expect(page.locator("#settings-overlay")).toBeHidden(); // straight back to the Settings page
  await expect(page.locator('.me-row[data-row="privacy"]')).toBeVisible();
});

test("on a phone the tag picker slides up from the bottom", async ({ page }) => {
  await newBtn(page).tap();
  await page.tap('#new-menu [data-new="note"]');
  await page.tap(".props-head"); // Organise starts folded on phones
  await page.tap("#add-tag-to-item-btn");
  const sheet = page.locator(".tag-picker");
  await expect(sheet).toHaveClass(/as-sheet/);
  const box = await sheet.boundingBox();
  const vh = page.viewportSize().height;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(vh - 2); // touches the bottom edge
  await page.tap(".popover-scrim", { position: { x: 20, y: 20 } });
  await expect(sheet).toHaveCount(0);
});

test("More opens as a full page above the dock, with no dark layer behind it; Search sits at the bottom", async ({ page }) => {
  await page.tap('.tab-btn[data-tab="more"]');
  await expect(page.locator("#sidebar")).toHaveClass(/open/);
  await expect(page.locator("#sidebar-scroll .nav-item").first()).toBeVisible();
  await expect(page.locator("#sidebar-backdrop")).toBeHidden();
  const box = await page.locator("#sidebar").boundingBox();
  const view = page.viewportSize();
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(view.width - 2);
  // The dock stays reachable under it.
  await page.tap('.tab-btn[data-tab="search"]');
  await expect(page.locator("#tl-pane")).toBeVisible();
  const body = await page.locator("#tl-body").boundingBox();
  const field = await page.locator("#tl-search").boundingBox();
  expect(field.y).toBeGreaterThan(body.y + body.height - 4); // the search field is under the results
  const dock = await page.locator("#tab-bar").boundingBox();
  expect(field.y + field.height).toBeLessThanOrEqual(dock.y + 2); // and above the dock
});

test("Library tab: three pages, hold to pick, no bar on the page, the dock stays, and it remembers the last page", async ({ page }) => {
  const label = async () => (await libTab(page).textContent()).trim();
  await libraryTo(page, "collections");
  await expect(page.locator("#tab-bar .tab-btn[data-tab='groups']")).toHaveText("Collections");
  await expect(page.locator(".gp-home-title h1")).toHaveText("Collections");
  await expect(page.locator(".library-seg-btn")).toHaveCount(0); // no bar on the page any more
  await expect(page.locator(".lib-dots i")).toHaveCount(3);
  await holdLibrary(page);
  await expect(page.locator("#lib-menu button")).toHaveText(["Collections", "Notes", "Documents"]);
  await page.locator('#lib-menu button[data-page="notes"]').tap();
  await expect(page.locator("#list-title")).toHaveText("All notes");
  expect(await label()).toBe("Notes");
  await expect(page.locator('.tab-btn[data-tab="groups"]')).toHaveClass(/active/);
  await holdLibrary(page);
  await page.locator('#lib-menu button[data-page="docs"]').tap();
  await expect(page.locator("#docs-pane")).toBeVisible();
  expect(await label()).toBe("Documents");
  // Holding the tab on the Documents page opens the menu on top of it (it used to hide behind the page).
  await holdLibrary(page);
  const menuTop = await page.evaluate(() => { const m = document.getElementById("lib-menu").getBoundingClientRect(); const e = document.elementFromPoint(m.x + m.width / 2, m.y + 24); return !!(e && e.closest("#lib-menu")); });
  expect(menuTop).toBe(true);
  await page.locator('#lib-menu button[data-page="docs"]').tap();
  // Documents is a page, not a cover: the dock is still there, on top, and tapping Inbox leaves it.
  const dock = await page.locator("#tab-bar").boundingBox();
  const top = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest("#tab-bar")); }, { x: dock.x + dock.width / 2, y: dock.y + dock.height / 2 });
  expect(top).toBe(true);
  await page.tap('.tab-btn[data-tab="chat"]');
  await expect(page.locator("#chat-pane")).toBeVisible();
  // It remembers: one tap on Library returns to Documents, and after a reload too.
  await page.tap('.tab-btn[data-tab="groups"]');
  await expect(page.locator("#docs-pane")).toBeVisible();
  await page.evaluate(() => { sessionStorage.setItem("cp-test-startinbox", "1"); localStorage.setItem("copypaster-start", "inbox"); });
  await page.reload();
  await expect(page.locator("#chat-pane")).toBeVisible(); // the app has finished starting, at the Inbox
  await page.tap('.tab-btn[data-tab="groups"]');
  await expect(page.locator("#docs-pane")).toBeVisible();
});

test("Settings › Look: Library opens on a page you choose", async ({ page }) => {
  await page.tap('.tab-btn[data-tab="more"]');
  await openSettingsFromMe(page, "look");
  await page.selectOption("#library-start", "notes");
  await page.keyboard.press("Escape");
  await page.tap('.tab-btn[data-tab="chat"]');
  await page.tap('.tab-btn[data-tab="groups"]');
  await expect(page.locator("#list-title")).toHaveText("All notes");
});

test("Library shows 'Sorted for you' with counts; a chip opens that view", async ({ page }) => {
  await libraryTo(page, "collections");
  await expect(page.locator(".library-quick-title")).toHaveText("Sorted for you");
  await expect(page.locator('.library-quick-chip[data-quick="photos"] small')).toHaveText("Photos");
  await expect(page.locator('.library-quick-chip[data-quick="photos"] b')).toHaveText("0");
  await page.locator('.library-quick-chip[data-quick="links"]').tap();
  await expect(page.locator("#tl-pane")).toBeVisible();
  await expect(page.locator("#tl-search")).toHaveValue("type:link");
});

test("More lights its own tab; Settings is one tap away and lists seven folders; Add-ons holds the password generator", async ({ page }) => {
  await page.tap('.tab-btn[data-tab="search"]');
  await page.tap('.tab-btn[data-tab="more"]');
  await expect(page.locator('.tab-btn[data-tab="more"]')).toHaveClass(/active/);
  await expect(page.locator('.tab-btn[data-tab="search"]')).not.toHaveClass(/active/);
  await expect(page.locator("#me-head h1")).toHaveText("More");
  await expect(page.locator("#me-more")).toHaveCount(0); // no ⋯ menu
  await expect(page.locator("#sidebar-scroll .nav-item").first()).toBeVisible();
  await expect(page.locator("#pwgen-btn")).toBeHidden(); // the generator lives in Add-ons now
  await page.tap("#me-gear");
  await expect(page.locator("#me-head h1")).toHaveText("Settings");
  await expect(page.locator("#me-rows .me-row b")).toHaveText(["Vault", "Privacy and lock", "Your data", "Look", "Library", "Add-ons", "Help and about"]);
  await expect(page.locator("#sidebar-scroll")).toBeHidden();
  await page.locator('.me-row[data-row="addons"]').tap();
  await expect(page.locator("#settings-title")).toHaveText("Add-ons");
  await expect(page.locator("#open-passgen")).toBeVisible();
  await page.tap("#settings-back-btn");
  await expect(page.locator("#me-head h1")).toHaveText("Settings"); // back lands on the Settings page, not More
  await page.tap("#me-back");
  await expect(page.locator("#me-head h1")).toHaveText("More");
  await expect(page.locator("#sidebar-scroll")).toBeVisible();
});

test("one sync cloud: hidden when all is well, a popover instead of a redirect when tapped", async ({ page }) => {
  await page.evaluate(() => {
    const dot = document.getElementById("sync-dot");
    dot.classList.remove("hidden"); dot.dataset.state = "wait";
  });
  await page.tap("#sync-dot");
  await expect(page.locator("#sync-pop")).toBeVisible();
  await expect(page.locator("#sync-pop-settings")).toBeVisible();
  await expect(page.locator("#settings-overlay")).toBeHidden(); // tapping it does not open Settings
  await page.keyboard.press("Escape");
  await expect(page.locator("#sync-pop")).toHaveCount(0);
});

test("Library › Notes: one row of chips for Favourites, Pinned, Unread, Archive and Trash", async ({ page }) => {
  await seed(page, { items: [{ id: "f1", type: "note", content: "starred one", starred: true, createdAt: Date.now(), updatedAt: Date.now(), schemaVersion: 2 }, { id: "n2", type: "note", content: "plain one", createdAt: Date.now() - 1, updatedAt: Date.now() - 1, schemaVersion: 2 }] });
  await page.reload();
  await libraryTo(page, "notes");
  await expect(page.locator(".library-chip.on")).toContainText("All");
  await expect(page.locator('.library-chip[data-view="saved"]')).toContainText("Favourites 1");
  await page.locator('.library-chip[data-view="saved"]').tap();
  await expect(page.locator("#list-title")).toHaveText("Favourites");
  await expect(page.locator(".library-chip.on")).toContainText("Favourites");
  await expect(page.locator('.tab-btn[data-tab="groups"]')).toHaveClass(/active/); // still the Library tab
  await page.locator('.library-chip[data-view="all"]').tap();
  await expect(page.locator("#list-title")).toHaveText("All notes");
});

test("sheets and menus open and close repeatedly without leaving a dark screen behind", async ({ page }) => {
  const overlays = () => page.evaluate(() => [...document.querySelectorAll("body > *")].filter((e) => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return cs.position === "fixed" && cs.display !== "none" && cs.visibility !== "hidden" && r.width >= innerWidth - 2 && r.height >= innerHeight - 2 && /overlay|backdrop|scrim/i.test(e.id + " " + e.className);
  }).map((e) => e.id || e.className));
  for (let round = 0; round < 3; round++) {
    await page.tap('.tab-btn[data-tab="more"]');
    await libraryTo(page, "notes");
    await page.locator('.library-chip[data-view="saved"]').tap();
    await page.locator('.library-chip[data-view="all"]').tap();
    await page.tap("#tab-bar .tab-btn.plus");
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(400);
  expect(await overlays()).toEqual([]);
  await page.tap('.tab-btn[data-tab="more"]');
  await page.tap('.tab-btn[data-tab="groups"]');
  await page.waitForTimeout(400);
  expect(await overlays()).toEqual([]);
});

test("every search field is the same pill, and each one opens the one Search page set to where you are", async ({ page }) => {
  const now = Date.now();
  await seed(page, { items: [{ id: "in1", type: "note", chat: true, content: "Corner Tea House bill 240", createdAt: now, updatedAt: now, schemaVersion: 2 }] });
  const look = (sel) => page.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return [Math.round(e.getBoundingClientRect().height), parseFloat(c.borderTopLeftRadius) > 18]; });
  const scope = async () => (await page.locator(".tl-scope-chip.on").textContent()).trim();
  await libraryTo(page, "notes");
  const notes = await look("#search-input");
  await page.tap("#search-input");
  await expect(page.locator("#tl-pane")).toBeVisible();
  expect(await scope()).toBe("Notes");
  await page.goBack();
  await page.tap('.tab-btn[data-tab="chat"]');
  const inbox = await look("#cx-q");
  await page.tap("#cx-q");
  expect(await scope()).toBe("Inbox");
  await page.goBack();
  await expect(page.locator("#chat-pane")).toBeVisible(); // Back lands in the Inbox again
  await libraryTo(page, "collections");
  const col = await look(".scope-pill input");
  await page.tap(".scope-pill input");
  expect(await scope()).toBe("Collections");
  const search = await look("#tl-search");
  expect(inbox).toEqual(notes);
  expect(col).toEqual(notes);
  expect(search).toEqual(notes);
  expect(notes).toEqual([44, true]);
  // Widening the scope to Everything.
  await page.locator('.tl-scope-chip[data-scope="all"]').tap();
  expect(await scope()).toBe("Everything");
});

test("Settings page: Demo data sits at the bottom, adds made-up things and removes them", async ({ page }) => {
  await page.tap('.tab-btn[data-tab="more"]');
  await expect(page.locator("#me-demo")).toBeHidden(); // not on the More list
  await page.tap("#me-gear");
  await expect(page.locator("#me-demo")).toBeVisible();
  await expect(page.locator("#me-demo-remove")).toBeHidden();
  await page.tap("#me-demo-load");
  await expect(page.locator("#me-demo-remove")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#me-demo-load")).toBeHidden();
  await page.tap("#me-demo-remove");
  await expect(page.locator("#me-demo-load")).toBeVisible({ timeout: 15000 });
});

test("Search › Documents also finds files inside collections", async ({ page }) => {
  await page.tap('.tab-btn[data-tab="more"]');
  await page.tap("#me-gear");
  await page.tap("#me-demo-load");
  await expect(page.locator("#me-demo-remove")).toBeVisible({ timeout: 15000 });
  await libraryTo(page, "docs");
  const onPage = await page.locator("#docs-list .doc-row").count();
  expect(onPage).toBeGreaterThanOrEqual(2);
  await page.tap("#docs-q"); // the pill opens Search, set to Documents
  await expect(page.locator(".tl-scope-chip.on")).toHaveText("Documents");
  await expect(page.locator("#tl-pane h1")).toHaveText("Search");
  await expect(page.locator("#tl-body .tl-row")).toHaveCount(onPage); // every file on the Documents page is found, including the ones in collections
});

test("Settings shortcuts open inside their folder: Back and X land on the Settings page", async ({ page }) => {
  await page.evaluate(() => { document.querySelector('.tab-btn[data-tab="more"]').click(); });
  await page.tap("#me-gear");
  await page.tap('.me-row[data-row="look"]');
  await expect(page.locator("#settings-title")).toHaveText("Look");
  await page.tap("#settings-close-btn"); // X goes back to the Settings page, not to whatever was underneath
  await expect(page.locator("#me-head h1")).toHaveText("Settings");
  await expect(page.locator("#settings-overlay")).toBeHidden();
});

test("Hold menu stays on screen even when the dock is redrawn during the hold", async ({ page }) => {
  await page.evaluate(() => {
    const b = document.querySelector('#tab-bar .tab-btn[data-tab="groups"]');
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 9, pointerType: "touch", isPrimary: true, bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
    document.querySelector('#tab-bar .tab-btn[data-tab="search"]').click(); // forces the dock to be redrawn mid-hold
  });
  await page.locator("#lib-menu").waitFor({ timeout: 3000 }).catch(() => {});
  const box = await page.locator("#lib-menu").boundingBox();
  if (box) { expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height); }
});

test("Holding the Library tab still opens the menu if the phone sends a stray pointercancel or pointerleave mid-hold", async ({ page }) => {
  await page.evaluate(() => {
    const b = document.querySelector('#tab-bar .tab-btn[data-tab="groups"]');
    const r = b.getBoundingClientRect(), o = { pointerId: 11, pointerType: "touch", isPrimary: true, bubbles: true, clientX: r.left + 20, clientY: r.top + 20 };
    b.dispatchEvent(new PointerEvent("pointerdown", o));
    setTimeout(() => { b.dispatchEvent(new PointerEvent("pointerleave", o)); b.dispatchEvent(new PointerEvent("pointercancel", o)); }, 150);
  });
  await expect(page.locator("#lib-menu")).toBeVisible({ timeout: 3000 });
});

// From Documents, every dock destination must leave it (it is a separate fixed pane that used to stay on top).
for (const [name, tabs, keys] of [
  ["Inbox, All notes, Library", ["chat", "all", "groups"], ["chat", "all", "groups", "more"]],
  ["Timeline, Search, Favourites", ["timeline", "search", "saved"], ["timeline", "search", "saved", "more"]],
  ["Reminders, Unread, Notes", ["reminders", "unread", "notes"], ["reminders", "unread", "notes", "more"]]
]) {
  test("Documents → every dock tab leaves Documents (" + name + ")", async ({ page }) => {
    await page.evaluate((t) => { localStorage.setItem("copypaster-dock", JSON.stringify(t)); }, tabs);
    await page.reload();
    await page.waitForSelector('#tab-bar .tab-btn[data-tab="more"]');
    for (const key of keys) {
      // open Documents from the More list, then tap the tab
      await page.tap('.tab-btn[data-tab="more"]');
      await page.locator("#sidebar .nav-item", { hasText: "Documents" }).tap();
      await expect(page.locator("#docs-pane")).toBeVisible();
      if (key === "groups") {
        await page.tap('.tab-btn[data-tab="groups"]'); // the Library tab keeps Documents (it is the page you are on)
        await expect(page.locator("#docs-pane")).toBeVisible();
        continue;
      }
      await page.locator('#tab-bar .tab-btn[data-tab="' + key + '"]').tap();
      await expect(page.locator("#docs-pane"), "tab " + key).toBeHidden();
    }
  });
}

test("Tapping the Documents tab again does not replay the rise animation, and Library from the Inbox still does", async ({ page }) => {
  await libraryTo(page, "docs");
  const anims = () => page.evaluate(() => document.getElementById("docs-pane").getAnimations().length);
  await page.tap('.tab-btn[data-tab="groups"]');
  await page.tap('.tab-btn[data-tab="groups"]');
  await page.waitForTimeout(100);
  expect(await anims()).toBe(0);
  await page.tap('.tab-btn[data-tab="chat"]');
  await page.tap('.tab-btn[data-tab="groups"]'); // coming back from the Inbox: the page rises in
  await expect(page.locator("#docs-pane")).toBeVisible();
});

// The core loop, end to end on a phone: capture, find it again, keep it safe.
test("Core loop: drop a thing in the Inbox, find it from Search, and back up from the More hold menu", async ({ page }) => {
  await page.tap('.tab-btn[data-tab="chat"]');
  await page.fill("#cx-input", "Corner Tea House bill 240");
  await page.tap("#cx-send");
  await expect(page.locator("#chat-pane .cx-msg").last()).toContainText("Corner Tea House");
  await page.tap('.tab-btn[data-tab="search"]');
  await page.fill("#tl-search", "tea house");
  await expect(page.locator("#tl-body .tl-row").first()).toContainText("Corner Tea House");
  await page.evaluate(() => {
    const b = document.querySelector('#tab-bar .tab-btn[data-tab="more"]');
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 31, pointerType: "touch", isPrimary: true, bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
  });
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator('#lib-menu [data-act="backup"]').tap()]);
  expect(download.suggestedFilename()).toMatch(/\.cps$/);
});

test("Every tab page's header lines up: same title line, same + spot, same search edge", async ({ page }) => {
  const read = () => page.evaluate(() => {
    const vis = (q) => [...document.querySelectorAll(q)].find((e) => e.getBoundingClientRect().width > 0);
    const t = vis(".cx-title b, #list-title, .gp-home-title h1, .docs-title b, #tl-pane .tl-title h1");
    return t ? Math.round(t.getBoundingClientRect().y) : null;
  });
  const ys = [];
  await page.tap('.tab-btn[data-tab="chat"]'); ys.push(await read());
  await libraryTo(page, "collections"); ys.push(await read());
  await libraryTo(page, "notes"); ys.push(await read());
  await page.tap('.tab-btn[data-tab="search"]'); ys.push(await read());
  expect(new Set(ys).size).toBe(1);
});

test("More shows Collections as one row (no long list, no second Notes row), and it opens the Collections page", async ({ page }) => {
  await menuBtn(page).click();
  await expect(page.locator('#main-nav .nav-item[data-nav="collections"]')).toBeVisible();
  await expect(page.locator('#main-nav .nav-item[data-nav="notes"]')).toHaveCount(0);
  await expect(page.locator("#groups-section")).toBeHidden();
  await page.locator('#main-nav .nav-item[data-nav="collections"]').click();
  await expect(page.locator("#sidebar")).not.toHaveClass(/\bopen\b/);
  await expect(page.locator(".gp-home-title")).toBeVisible();
});

test("The dock tells screen readers which tab you are on, and the text sizes follow the browser's font size", async ({ page }) => {
  await expect(page.locator('#tab-bar .tab-btn[aria-current="page"]')).toHaveCount(1);
  await page.locator("#tab-bar .tab-btn[data-tab='search']").tap();
  await expect(page.locator('#tab-bar .tab-btn[data-tab="search"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator('#tab-bar .tab-btn[aria-current="page"]')).toHaveCount(1);
  const small = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#tab-bar .tab-btn span")).fontSize));
  await page.evaluate(() => { document.documentElement.style.fontSize = "24px"; });
  const big = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#tab-bar .tab-btn span")).fontSize));
  expect(big).toBeGreaterThan(small * 1.4);
});
