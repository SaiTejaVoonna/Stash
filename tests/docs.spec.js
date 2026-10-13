// Documents (every file in one list), the PDF viewer, audio and video
// players, and switching add-ons off.
const { test, expect, openApp, nav, samplePdf } = require("./fixtures");

// A short silent WAV.
function wav() {
  const n = 800, b = Buffer.alloc(44 + n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
}
async function sendFiles(page, files) {
  await nav(page, "Inbox").click();
  await page.click("#cx-plus");
  const ch = page.waitForEvent("filechooser");
  await page.click("#cx-files");
  await (await ch).setFiles(files);
  await page.click("#cx-preview-send");
}

test.beforeEach(async ({ page }) => { await openApp(page); });

test("a PDF gets a page thumbnail, shows in Documents, opens in the viewer; search and Show", async ({ page }) => {
  await sendFiles(page, [{ name: "report.pdf", mimeType: "application/pdf", buffer: samplePdf() }]);
  const thumb = page.locator("#chat-pane .cx-file.pdf img.cx-thumb");
  await expect(thumb).toHaveAttribute("src", /^data:image\/jpeg/, { timeout: 15000 });
  await nav(page, "Documents").click();
  await expect(page.locator("#docs-pane")).toBeVisible();
  const row = page.locator(".doc-row", { hasText: "report.pdf" });
  await expect(row).toContainText("Inbox");
  await page.fill("#docs-q", "nothing-like-this");
  await expect(row).toHaveCount(0);
  await page.fill("#docs-q", "report");
  await row.click();
  await expect(page.locator("#doc-viewer .dv-page")).toHaveCount(1, { timeout: 15000 });
  await page.click("#dv-close");
  await expect(page.locator("#doc-viewer")).toHaveCount(0);
  await row.getByRole("button", { name: "Show where it is" }).click();
  await expect(page.locator("#docs-pane")).toBeHidden();
  await expect(page.locator("#chat-pane")).toBeVisible();
});

test("audio plays in the message with a speed button; add-ons switched off hide Documents and players", async ({ page }) => {
  await sendFiles(page, [{ name: "memo.wav", mimeType: "audio/wav", buffer: wav() }]);
  const media = page.locator("#chat-pane .cx-media");
  await expect(media.locator("audio")).toHaveCount(1);
  const speed = media.locator(".cx-speed");
  await speed.click(); await expect(speed).toHaveText("1.5×");
  await speed.click(); await expect(speed).toHaveText("2×");
  await speed.click(); await expect(speed).toHaveText("1×");
  // Settings → Add-ons: turn off Audio and video and Documents.
  await page.click("#settings-btn");
  await page.click('.settings-nav-item[data-page="addons"]');
  await page.locator('[data-addon="media"]').uncheck();
  await page.locator('[data-addon="documents"]').uncheck();
  await page.locator('[data-addon="sketch"]').uncheck();
  await page.click("#settings-close-btn");
  await expect(page.locator("#chat-pane .cx-media")).toHaveCount(0);
  await expect(page.locator("#chat-pane .cx-file")).toContainText("memo.wav");
  await expect(nav(page, "Documents")).toHaveCount(0);
  await nav(page, "All notes").click();
  await page.click("#new-btn");
  await expect(page.locator('#new-menu [data-new="note"]')).toBeVisible();
  await expect(page.locator('#new-menu [data-new="sketch"]')).toHaveCount(0);
});
