// The scanner: finding the page, straightening, filters, PDF, signature, and
// text read from scans and photos (with a stand-in text reader).
const { test, expect, openApp, nav } = require("./fixtures");

test.beforeEach(async ({ page }) => { await openApp(page); });

// A dark desk with a white, tilted sheet of paper on it (as a PNG data URL).
const PAPER = () => {
  const c = document.createElement("canvas"); c.width = 800; c.height = 600;
  const x = c.getContext("2d");
  x.fillStyle = "#3a3026"; x.fillRect(0, 0, 800, 600);
  x.fillStyle = "#f4f4f0"; x.beginPath(); x.moveTo(180, 90); x.lineTo(640, 130); x.lineTo(600, 520); x.lineTo(140, 480); x.closePath(); x.fill();
  x.fillStyle = "#222"; x.font = "28px sans-serif"; x.fillText("TOTAL 450", 300, 300);
  return c.toDataURL("image/png");
};

test("finds the paper's corners, straightens it, cleans it up and writes a PDF that opens", async ({ page }) => {
  const r = await page.evaluate(async (src) => {
    const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const S = window.CPScan;
    const corners = S.detect(img);
    const flat = S.warp(img, corners, 1000);
    const bw = S.filter(flat, "bw");
    const jpeg = bw.toDataURL("image/jpeg", 0.8);
    const out = S.pdf([{ jpeg, w: bw.width, h: bw.height }, { jpeg, w: bw.width, h: bw.height }]);
    return { corners: corners.map((p) => p.map((v) => Math.round(v * 100) / 100)), w: flat.width, h: flat.height, pdf: out.dataUrl, size: out.size };
  }, await page.evaluate(PAPER));
  // tl, tr, br, bl near where the paper was drawn.
  const want = [[180, 90], [640, 130], [600, 520], [140, 480]].map(([x, y]) => [x / 800, y / 600]);
  r.corners.forEach((p, i) => { expect(Math.abs(p[0] - want[i][0])).toBeLessThan(0.04); expect(Math.abs(p[1] - want[i][1])).toBeLessThan(0.04); });
  expect(r.w).toBeGreaterThan(r.h * 1.05);
  // The PDF is real: pdf.js opens it and finds both pages.
  const pages = await page.evaluate(async (dataUrl) => {
    await new Promise((ok) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"; s.onload = ok; document.head.append(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const bin = atob(dataUrl.split(",")[1]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return (await window.pdfjsLib.getDocument({ data: u }).promise).numPages;
  }, r.pdf);
  expect(pages).toBe(2);
});

test("scan from photos → Use page → Save PDF lands in the Inbox; its text is read so search finds it", async ({ page }) => {
  const src = await page.evaluate(PAPER);
  const png = Buffer.from(src.split(",")[1], "base64");
  await page.click("#new-btn");
  await page.click('#new-menu [data-new="scan"]');
  // The camera opens first; cancel it and pick from photos instead.
  await expect(page.locator("#scan-library")).toBeVisible();
  const ch = page.waitForEvent("filechooser");
  await page.click("#scan-library");
  await (await ch).setFiles({ name: "bill.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".scan-handle")).toHaveCount(4);
  await page.locator('[data-look="grey"]').click();
  await page.click("#scan-use");
  await expect(page.locator(".scan-page")).toHaveCount(1);
  await page.fill("#scan-name", "Electricity bill");
  await page.click("#scan-save");
  await expect(page.locator("#chat-pane .cx-file")).toContainText("Electricity bill.pdf");
  await expect(page.locator(".toast-item", { hasText: "Text read from the scan" })).toBeVisible();
  // Documents search finds it by the words on the paper.
  await nav(page, "Documents").click();
  await page.fill("#docs-q", "total 450");
  await expect(page.locator(".doc-row", { hasText: "Electricity bill.pdf" })).toContainText("Found in its text");
});

test("signature: draw once, place it on a scanned page", async ({ page }) => {
  const src = await page.evaluate(PAPER);
  const png = Buffer.from(src.split(",")[1], "base64");
  await page.click("#new-btn");
  await page.click('#new-menu [data-new="scan"]');
  const ch = page.waitForEvent("filechooser");
  await page.click("#scan-library");
  await (await ch).setFiles({ name: "form.png", mimeType: "image/png", buffer: png });
  await page.click("#scan-use");
  const before = await page.locator(".scan-page img").getAttribute("src");
  await page.locator(".scan-page").getByRole("button", { name: "Sign this page" }).click();
  const pad = page.locator("#sig-pad");
  const b = await pad.boundingBox();
  await page.mouse.move(b.x + 20, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + 20, { steps: 6 }); await page.mouse.move(b.x + b.width - 20, b.y + b.height - 20, { steps: 6 }); await page.mouse.up();
  await page.click("#sig-save");
  await expect(page.locator("#sig-mark")).toBeVisible();
  await page.click("#sig-place");
  await expect.poll(() => page.locator(".scan-page img").getAttribute("src")).not.toBe(before);
  // The signature is remembered for next time.
  expect(await page.evaluate(() => !!localStorage.getItem("copypaster-signature"))).toBe(true);
});

test("Copy text from a photo: read on this device, shown, and kept so search finds the note", async ({ page }) => {
  await page.evaluate(() => { window.__ocrText = "Invoice 2026 from Asha Stores"; });
  const src = await page.evaluate(PAPER);
  const png = Buffer.from(src.split(",")[1], "base64");
  await page.click("#new-btn");
  await page.click('#new-menu [data-new="note"]');
  await page.fill("#content-input", "Shop bill");
  await page.dispatchEvent("#content-input", "input");
  await page.setInputFiles("#attach-image-file", { name: "bill.png", mimeType: "image/png", buffer: png });
  await expect(page.locator("img.attached-image")).toHaveCount(1);
  await page.locator("img.attached-image").click();
  await page.click(".lb-ocr");
  await expect(page.locator("#ocr-text")).toHaveValue("Invoice 2026 from Asha Stores");
  await page.click("#ocr-copy");
  await page.keyboard.press("Escape");
  await page.fill("#search-input", "asha stores");
  await expect(page.locator(".item-row", { hasText: "Shop bill" })).toHaveCount(1);
});
