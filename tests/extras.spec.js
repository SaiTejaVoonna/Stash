// Small extras: QR codes (Wi-Fi, links), contact cards, location pins, link
// cards, add to calendar.
const { test, expect, openApp, nav, newNote } = require("./fixtures");

test.beforeEach(async ({ page }) => { await openApp(page); });

test("reading codes and calendar events", async ({ page }) => {
  const r = await page.evaluate(() => {
    const X = window.CPExtras;
    return { wifi: X.parseCode("WIFI:S:Home Net;T:WPA;P:pa\\;55;;"), link: X.parseCode("https://example.com/a").kind, phone: X.parseCode("+91 98480 22338").kind,
      card: X.parseCode("BEGIN:VCARD\nFN:Asha Verma\nTEL;TYPE=CELL:+911234567890\nEND:VCARD"), wa: X.waUrl("98480 22338"),
      ics: X.ics({ title: "Dentist, 5pm", start: Date.UTC(2026, 9, 20, 11, 30), minutes: 30 }) };
  });
  expect(r.wifi).toMatchObject({ kind: "wifi", ssid: "Home Net", password: "pa;55", security: "WPA" });
  expect(r.link).toBe("link");
  expect(r.phone).toBe("phone");
  expect(r.card).toMatchObject({ kind: "contact", name: "Asha Verma", phone: "+911234567890" });
  expect(r.wa).toBe("https://wa.me/919848022338");
  expect(r.ics).toContain("DTSTART:20261020T113000Z");
  expect(r.ics).toContain("SUMMARY:Dentist\\, 5pm");
});

test("Inbox + menu: scan a Wi-Fi QR from a photo, send a contact and a location pin; links show as cards", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 17.385, longitude: 78.4867 });
  await page.evaluate(() => { window.BarcodeDetector = class { async detect() { return [{ rawValue: "WIFI:S:Home;T:WPA;P:secret123;;" }]; } }; });
  await nav(page, "Inbox").click();
  // QR → from a photo.
  await page.click("#cx-plus");
  await page.click("#cx-qr");
  const ch = page.waitForEvent("filechooser");
  await page.click("#qr-photo");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await (await ch).setFiles({ name: "qr.png", mimeType: "image/png", buffer: png });
  await expect(page.locator("#qr-result")).toContainText("Wi-Fi: Home");
  await expect(page.locator("#qr-result")).toContainText("secret123");
  await page.click("#qr-save");
  const msgs = page.locator("#chat-pane .cx-msg");
  await expect(msgs.last()).toContainText("Password: secret123");
  // Contact card.
  await page.click("#cx-plus");
  await page.click("#cx-contact");
  await page.fill("#dialog-name", "Ravi Mechanic");
  await page.fill("#dialog-phone", "9848022338");
  await page.click("#dialog button[type=submit]");
  const card = page.locator(".cx-contact").last();
  await expect(card).toContainText("Ravi Mechanic");
  await expect(card.locator("a", { hasText: "Call" })).toHaveAttribute("href", "tel:9848022338");
  await expect(card.locator("a", { hasText: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/919848022338");
  // Location pin.
  await page.click("#cx-plus");
  await page.click("#cx-location");
  await expect(page.locator(".cx-pin").last()).toContainText("17.38500, 78.48670");
  await expect(page.locator(".cx-pin a")).toHaveAttribute("href", /query=17\.385,78\.4867/);
  // A link becomes a card.
  await page.fill("#cx-input", "recipe https://www.example.com/boba-tea");
  await page.click("#cx-send");
  await expect(page.locator(".cx-link").last()).toContainText("example.com");
});
