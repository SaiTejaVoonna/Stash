// Stash small extras: QR / barcode scanner, location pins, contact cards,
// add to calendar, link cards. window.CPExtras
//
// The QR scanner uses the browser's own barcode reader where there is one,
// otherwise jsQR (loaded on first use). The camera picture stays on this
// device. Nothing here contacts any server.
(function () {
  "use strict";

  const JSQR = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";

  // ---------- What a scanned code means ----------
  // "WIFI:S:Home;T:WPA;P:secret;;" → { kind: "wifi", ssid, password, security }
  function parseCode(text) {
    const t = String(text || "").trim();
    if (/^WIFI:/i.test(t)) {
      const get = (k) => { const m = t.match(new RegExp("[:;]" + k + ":((?:\\\\.|[^;])*)", "i")); return m ? m[1].replace(/\\(.)/g, "$1") : ""; };
      return { kind: "wifi", ssid: get("S"), password: get("P"), security: get("T") || "nopass", text: t };
    }
    if (/^https?:\/\/\S+$/i.test(t)) return { kind: "link", url: t, text: t };
    if (/^(tel:)?\+?[\d\s-]{7,}$/.test(t)) return { kind: "phone", phone: t.replace(/^tel:/i, ""), text: t };
    if (/^mailto:/i.test(t)) return { kind: "email", email: t.slice(7), text: t };
    if (/^BEGIN:VCARD/i.test(t)) {
      const name = (t.match(/\nFN:(.*)/i) || [])[1] || "";
      const phone = (t.match(/\nTEL[^:]*:(.*)/i) || [])[1] || "";
      return { kind: "contact", name: name.trim(), phone: phone.trim(), text: t };
    }
    return { kind: "text", text: t };
  }

  // ---------- Reading codes ----------
  let jsqr = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!jsqr) jsqr = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = JSQR;
      s.onload = () => ok(window.jsQR);
      s.onerror = () => { jsqr = null; fail(new Error("Couldn't load the QR reader. Check your connection.")); };
      document.head.append(s);
    });
    return jsqr;
  }
  async function detector() {
    if ("BarcodeDetector" in window) {
      try { return new window.BarcodeDetector(); } catch {}
    }
    return null;
  }
  // The code in an image / video frame (a canvas-drawable source), or null.
  async function readFrom(source, w, hgt) {
    const det = await detector();
    if (det) {
      try { const r = await det.detect(source); if (r && r.length) return r[0].rawValue; } catch {}
    }
    const q = await loadJsQR();
    const c = document.createElement("canvas");
    const k = Math.min(1, 900 / Math.max(w, hgt));
    c.width = Math.round(w * k); c.height = Math.round(hgt * k);
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(source, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height);
    const r = q(d.data, c.width, c.height);
    return r ? r.data : null;
  }

  // ---------- Calendar ----------
  // One event as an .ics file (opens in the phone's calendar).
  function ics({ title, start, minutes = 30, notes = "" }) {
    const f = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const esc = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stash//EN", "BEGIN:VEVENT",
      "UID:" + Date.now() + "-" + Math.random().toString(36).slice(2) + "@stash", "DTSTAMP:" + f(Date.now()),
      "DTSTART:" + f(start), "DTEND:" + f(start + minutes * 60000), "SUMMARY:" + esc(title), notes ? "DESCRIPTION:" + esc(notes) : null,
      "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:" + esc(title), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
  }
  function downloadIcs(event) {
    const blob = new Blob([ics(event)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (String(event.title || "event").replace(/[^\w\- ]+/g, "").trim() || "event") + ".ics";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // ---------- Links, phones, maps ----------
  const mapsUrl = (lat, lng) => "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng;
  const telUrl = (p) => "tel:" + String(p).replace(/[^\d+]/g, "");
  const waUrl = (p) => { let d = String(p).replace(/\D/g, ""); if (d.length === 10) d = "91" + d; return "https://wa.me/" + d; };
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const firstLink = (text) => { const m = String(text || "").match(/https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/); return m ? m[0] : null; };

  // ---------- QR scanner screen ----------
  // tools: { sheet, h, ic, toast, save(text, parsed) }
  function openQr(tools) {
    const { sheet, h, ic, toast } = tools;
    let stream = null, timer = null, done = false;
    const stop = () => { done = true; clearTimeout(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    sheet("Scan a QR code", (body, finish) => {
      const video = h("video", { class: "qr-video", id: "qr-video", playsinline: true, muted: true, autoplay: true });
      const result = h("div", { class: "qr-result", id: "qr-result", hidden: true });
      const status = h("p", { class: "gp-hint", id: "qr-status" }, "Point the camera at a QR code.");
      const show = (raw) => {
        stop();
        const p = parseCode(raw);
        video.hidden = true;
        status.hidden = true;
        const rows = [];
        if (p.kind === "wifi") rows.push(h("b", null, "Wi-Fi: " + (p.ssid || "network")), p.password ? h("div", { class: "qr-pass" }, h("code", null, p.password)) : h("small", null, "No password"));
        else if (p.kind === "link") rows.push(h("b", null, hostOf(p.url)), h("small", { class: "qr-raw" }, p.url));
        else if (p.kind === "contact") rows.push(h("b", null, p.name || "Contact"), h("small", null, p.phone));
        else rows.push(h("div", { class: "qr-raw" }, p.text));
        result.hidden = false;
        result.replaceChildren(h("div", { class: "qr-what" }, ...rows), h("div", { class: "gp-sheet-actions" },
          p.kind === "wifi" && p.password ? h("button", { class: "btn", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(p.password); toast("Wi-Fi password copied"); } }, "Copy password") : null,
          p.kind === "link" ? h("a", { class: "btn", href: p.url, target: "_blank", rel: "noopener noreferrer" }, "Open") : null,
          p.kind === "phone" || (p.kind === "contact" && p.phone) ? h("a", { class: "btn", href: telUrl(p.phone) }, "Call") : null,
          h("button", { class: "btn primary", id: "qr-save", onclick: async () => { await tools.save(raw, p); finish(); } }, "Save to Inbox")));
      };
      const fromPhoto = h("button", { class: "btn ghost", id: "qr-photo", onclick: () => {
        const el = h("input", { type: "file", accept: "image/*", hidden: true });
        el.addEventListener("change", async () => {
          const f = el.files && el.files[0]; el.remove();
          if (!f) return;
          const url = URL.createObjectURL(f);
          const img = new Image();
          img.onload = async () => {
            try { const raw = await readFrom(img, img.naturalWidth, img.naturalHeight); if (raw) show(raw); else toast("No QR code found in that photo"); }
            catch (err) { toast(err.message); }
            URL.revokeObjectURL(url);
          };
          img.src = url;
        });
        document.body.append(el); el.click();
      } }, ic("image"), "From a photo");
      body.append(video, status, result, h("div", { class: "gp-sheet-actions" }, fromPhoto));
      // Live camera, checked a few times a second.
      (async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { video.hidden = true; status.textContent = "This browser can't use the camera here. Try From a photo."; return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (done) { stop(); return; }
          video.srcObject = stream;
          await video.play().catch(() => {});
          const tick = async () => {
            if (done) return;
            if (video.videoWidth) {
              try { const raw = await readFrom(video, video.videoWidth, video.videoHeight); if (raw) { show(raw); return; } }
              catch (err) { status.textContent = err.message; }
            }
            timer = setTimeout(tick, 350);
          };
          tick();
        } catch { video.hidden = true; status.textContent = "Camera not allowed. Allow it in your phone's settings, or use From a photo."; }
      })();
    }, { onClose: stop });
  }

  window.CPExtras = { parseCode, readFrom, ics, downloadIcs, mapsUrl, telUrl, waUrl, hostOf, firstLink, openQr };
})();
