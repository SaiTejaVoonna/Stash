// Stash scanner: photograph paper, find its edges, straighten it, clean it
// up, and save the pages as one PDF. Signature: draw once, place it on a
// page. window.CPScan
//
// All on this device, no downloads: the edges are found by looking for the
// big light shape (paper on a darker surface), and you can drag the corners.
(function () {
  "use strict";

  const QUALITY = { small: [1200, 0.72], medium: [1700, 0.8], high: [2400, 0.88] };
  const FILTERS = [["original", "Original"], ["color", "Colour boost"], ["grey", "Grey"], ["bw", "B&W"]];
  const PREFS_KEY = "copypaster-scan";
  const SIG_KEY = "copypaster-signature";
  const prefs = () => { try { return { quality: "medium", filter: "color", ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { quality: "medium", filter: "color" }; } };
  const savePrefs = (p) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {} };

  // ---------- Finding the page ----------
  // Corners [tl, tr, br, bl] as 0..1 of the image, or the whole image when unsure.
  function detect(img) {
    const S = 260;
    const k = S / Math.max(img.width, img.height);
    const w = Math.max(8, Math.round(img.width * k)), hgt = Math.max(8, Math.round(img.height * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = hgt;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, hgt);
    const d = x.getImageData(0, 0, w, hgt).data;
    const lum = new Float32Array(w * hgt);
    for (let i = 0; i < w * hgt; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    // Otsu: the brightness that best splits paper from background.
    const hist = new Array(256).fill(0);
    for (const v of lum) hist[v | 0]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = lum.length - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t; }
    }
    // The biggest light area that doesn't fill the whole frame.
    const seen = new Uint8Array(w * hgt);
    let bestPix = null;
    for (let i = 0; i < w * hgt; i++) {
      if (seen[i] || lum[i] <= thr) continue;
      const stack = [i], pix = [];
      seen[i] = 1;
      while (stack.length) {
        const p = stack.pop();
        pix.push(p);
        const px = p % w, py = (p / w) | 0;
        for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < hgt - 1 ? p + w : -1]) {
          if (q >= 0 && !seen[q] && lum[q] > thr) { seen[q] = 1; stack.push(q); }
        }
      }
      if (!bestPix || pix.length > bestPix.length) bestPix = pix;
    }
    const whole = [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (!bestPix || bestPix.length < w * hgt * 0.12 || bestPix.length > w * hgt * 0.97) return whole;
    // Corners: the points furthest towards each corner.
    let tl = null, tr = null, br = null, bl = null;
    for (const p of bestPix) {
      const px = p % w, py = (p / w) | 0;
      if (!tl || px + py < tl[0] + tl[1]) tl = [px, py];
      if (!br || px + py > br[0] + br[1]) br = [px, py];
      if (!tr || px - py > tr[0] - tr[1]) tr = [px, py];
      if (!bl || py - px > bl[1] - bl[0]) bl = [px, py];
    }
    return [tl, tr, br, bl].map(([px, py]) => [px / (w - 1), py / (hgt - 1)]);
  }

  // ---------- Straightening ----------
  // Maps the output rectangle onto the four corners (a homography).
  function homography(src, dst) {
    // Solve for H with dst → src: 8 equations, Gaussian elimination.
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = dst[i], [u, v] = src[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {
      let piv = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    return b.map((v, i) => v / A[i][i]).concat(1);
  }
  // A straight, flat page from a photo and its corners (0..1). maxSide: output size.
  function warp(img, corners, maxSide) {
    const W0 = img.width, H0 = img.height;
    const P = corners.map(([x, y]) => [x * W0, y * H0]);
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let ow = Math.max(d(P[0], P[1]), d(P[3], P[2])), oh = Math.max(d(P[0], P[3]), d(P[1], P[2]));
    const k = Math.min(1, maxSide / Math.max(ow, oh));
    ow = Math.max(2, Math.round(ow * k)); oh = Math.max(2, Math.round(oh * k));
    const H = homography(P, [[0, 0], [ow, 0], [ow, oh], [0, oh]]);
    const sc = document.createElement("canvas");
    sc.width = W0; sc.height = H0;
    const sx = sc.getContext("2d", { willReadFrequently: true });
    sx.drawImage(img, 0, 0);
    const sd = sx.getImageData(0, 0, W0, H0).data;
    const out = document.createElement("canvas");
    out.width = ow; out.height = oh;
    const ox = out.getContext("2d");
    const od = ox.createImageData(ow, oh);
    const o = od.data;
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const z = H[6] * x + H[7] * y + 1;
        const u = (H[0] * x + H[1] * y + H[2]) / z, v = (H[3] * x + H[4] * y + H[5]) / z;
        const xi = Math.min(W0 - 2, Math.max(0, u | 0)), yi = Math.min(H0 - 2, Math.max(0, v | 0));
        const fx = Math.min(1, Math.max(0, u - xi)), fy = Math.min(1, Math.max(0, v - yi));
        const i00 = (yi * W0 + xi) * 4, i10 = i00 + 4, i01 = i00 + W0 * 4, i11 = i01 + 4;
        const t = (y * ow + x) * 4;
        for (let c = 0; c < 3; c++) {
          o[t + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
        }
        o[t + 3] = 255;
      }
    }
    ox.putImageData(od, 0, 0);
    return out;
  }

  // ---------- Clean-up filters ----------
  function filter(canvas, kind) {
    if (kind === "original") return canvas;
    const w = canvas.width, hgt = canvas.height;
    const x = canvas.getContext("2d", { willReadFrequently: true });
    const id = x.getImageData(0, 0, w, hgt), d = id.data;
    const lum = new Float32Array(w * hgt);
    for (let i = 0; i < w * hgt; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    if (kind === "bw") {
      // Adaptive threshold: each pixel against the average around it (crisp text, even with shadows).
      const S = new Float64Array((w + 1) * (hgt + 1));
      for (let y = 0; y < hgt; y++) { let row = 0; for (let xx = 0; xx < w; xx++) { row += lum[y * w + xx]; S[(y + 1) * (w + 1) + xx + 1] = S[y * (w + 1) + xx + 1] + row; } }
      const r = Math.max(8, Math.round(Math.max(w, hgt) / 40));
      for (let y = 0; y < hgt; y++) for (let xx = 0; xx < w; xx++) {
        const x0 = Math.max(0, xx - r), x1 = Math.min(w, xx + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(hgt, y + r + 1);
        const mean = (S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        const v = lum[y * w + xx] < mean - 12 ? 0 : 255;
        const t = (y * w + xx) * 4; d[t] = d[t + 1] = d[t + 2] = v;
      }
    } else {
      // Stretch so the paper is white and the ink is dark.
      const sorted = Float32Array.from(lum).sort();
      const lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.floor(sorted.length * 0.9)];
      const span = Math.max(30, hi - lo);
      for (let i = 0; i < w * hgt; i++) {
        const t = i * 4;
        if (kind === "grey") { const v = Math.max(0, Math.min(255, ((lum[i] - lo) / span) * 255)); d[t] = d[t + 1] = d[t + 2] = v; }
        else for (let c = 0; c < 3; c++) d[t + c] = Math.max(0, Math.min(255, ((d[t + c] - lo) / span) * 255 * 1.02));
      }
    }
    x.putImageData(id, 0, 0);
    return canvas;
  }

  // ---------- PDF ----------
  // JPEG pages → one PDF (a data URL). pages: [{ jpeg: dataURL, w, h }]
  function pdf(pages) {
    const enc = new TextEncoder();
    const chunks = [], offsets = [];
    let len = 0;
    const add = (part) => { const u = typeof part === "string" ? enc.encode(part) : part; chunks.push(u); len += u.length; };
    const obj = (n, body) => { offsets[n] = len; add(n + " 0 obj\n"); body(); add("\nendobj\n"); };
    add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const n = pages.length;
    const pageIds = pages.map((_, i) => 3 + i * 3);
    obj(1, () => add("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => add("<< /Type /Pages /Kids [" + pageIds.map((id) => id + " 0 R").join(" ") + "] /Count " + n + " >>"));
    pages.forEach((p, i) => {
      const id = pageIds[i];
      const W = 595, H = Math.round((595 * p.h) / p.w);
      const bin = atob(p.jpeg.split(",")[1]);
      const jpg = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) jpg[j] = bin.charCodeAt(j);
      const draw = "q " + W + " 0 0 " + H + " 0 0 cm /Im0 Do Q";
      obj(id, () => add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /XObject << /Im0 " + (id + 1) + " 0 R >> >> /Contents " + (id + 2) + " 0 R >>"));
      obj(id + 1, () => { add("<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n"); add(jpg); add("\nendstream"); });
      obj(id + 2, () => add("<< /Length " + draw.length + " >>\nstream\n" + draw + "\nendstream"));
    });
    const total = 3 + n * 3;
    const xref = len;
    let x = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    add(x + "trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    const all = new Uint8Array(len);
    let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.length; }
    let s = "";
    for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
    return { dataUrl: "data:application/pdf;base64," + btoa(s), size: all.length };
  }

  const loadImg = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error("Couldn't read that photo")); i.src = src; });
  const readFile = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(f); });
  // Photo → upright image (iPhone photos load already rotated).
  async function imageFrom(file) { const url = await readFile(file); if (!url) throw new Error("Couldn't read that photo"); return loadImg(url); }

  // ---------- Signature ----------
  const savedSignature = () => { try { return localStorage.getItem(SIG_KEY); } catch { return null; } };
  // Draw a signature once (kept on this device). Resolves with a PNG (transparent), or null.
  function drawSignature(tools) {
    const { sheet, h } = tools;
    return new Promise((resolve) => {
      let out = null;
      sheet("Your signature", (body, finish) => {
        const c = h("canvas", { class: "sig-pad", id: "sig-pad", width: "800", height: "300", "aria-label": "Sign here" });
        const x = c.getContext("2d");
        x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#11131a"; x.lineWidth = 5;
        let down = false, any = false;
        const pt = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)]; };
        c.addEventListener("pointerdown", (e) => { e.preventDefault(); down = true; any = true; try { c.setPointerCapture(e.pointerId); } catch {} const [a, b] = pt(e); x.beginPath(); x.moveTo(a, b); });
        c.addEventListener("pointermove", (e) => { if (!down) return; const [a, b] = pt(e); x.lineTo(a, b); x.stroke(); });
        ["pointerup", "pointercancel"].forEach((ev) => c.addEventListener(ev, () => { down = false; }));
        body.append(h("p", { class: "gp-hint" }, "Sign with your finger or a pen. It's kept only on this device, for placing on scans."), c,
          h("div", { class: "gp-sheet-actions" },
            h("button", { class: "btn", onclick: () => { x.clearRect(0, 0, c.width, c.height); any = false; } }, "Clear"),
            h("button", { class: "btn primary", id: "sig-save", onclick: () => {
              if (!any) return;
              // Trim to the ink.
              const d = x.getImageData(0, 0, c.width, c.height).data;
              let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
              for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (d[(yy * c.width + xx) * 4 + 3] > 10) { x0 = Math.min(x0, xx); y0 = Math.min(y0, yy); x1 = Math.max(x1, xx); y1 = Math.max(y1, yy); }
              const t = document.createElement("canvas");
              t.width = Math.max(1, x1 - x0 + 12); t.height = Math.max(1, y1 - y0 + 12);
              t.getContext("2d").drawImage(c, x0 - 6, y0 - 6, t.width, t.height, 0, 0, t.width, t.height);
              out = t.toDataURL("image/png");
              try { localStorage.setItem(SIG_KEY, out); } catch {}
              finish();
            } }, "Save signature")));
      }, { stack: true, onClose: () => resolve(out) });
    });
  }
  // Place the signature on a page image: drag it, size it. Resolves with the new image (data URL) or null.
  function placeSignature(tools, pageUrl) {
    const { sheet, h } = tools;
    return new Promise(async (resolve) => {
      let sig = savedSignature();
      if (!sig) sig = await drawSignature(tools);
      if (!sig) { resolve(null); return; }
      const page = await loadImg(pageUrl), sImg = await loadImg(sig);
      let out = null;
      sheet("Place your signature", (body, finish) => {
        const stage = h("div", { class: "sig-stage" });
        const pageEl = h("img", { class: "sig-page", src: pageUrl, alt: "" });
        const sigEl = h("img", { class: "sig-mark", id: "sig-mark", src: sig, alt: "Signature" });
        stage.append(pageEl, sigEl);
        let pos = { x: 0.55, y: 0.8, w: 0.32 };
        const place = () => { sigEl.style.left = pos.x * 100 + "%"; sigEl.style.top = pos.y * 100 + "%"; sigEl.style.width = pos.w * 100 + "%"; };
        let drag = null;
        sigEl.addEventListener("pointerdown", (e) => { e.preventDefault(); try { sigEl.setPointerCapture(e.pointerId); } catch {} drag = { x: e.clientX, y: e.clientY, p: { ...pos } }; });
        sigEl.addEventListener("pointermove", (e) => {
          if (!drag) return;
          const r = stage.getBoundingClientRect();
          pos.x = Math.min(0.98, Math.max(0, drag.p.x + (e.clientX - drag.x) / r.width));
          pos.y = Math.min(0.98, Math.max(0, drag.p.y + (e.clientY - drag.y) / r.height));
          place();
        });
        sigEl.addEventListener("pointerup", () => { drag = null; });
        const size = h("input", { type: "range", class: "sk-range", id: "sig-size", min: "10", max: "70", value: "32", "aria-label": "Signature size", oninput: (e) => { pos.w = e.target.value / 100; place(); } });
        place();
        body.append(h("p", { class: "gp-hint" }, "Drag it into place."), stage, h("label", { class: "sig-size" }, "Size", size),
          h("div", { class: "gp-sheet-actions" },
            h("button", { class: "btn ghost", onclick: async () => { const s2 = await drawSignature(tools); if (s2) { sig = s2; sigEl.src = s2; } } }, "Sign again"),
            h("button", { class: "btn primary", id: "sig-place", onclick: () => {
              const c = document.createElement("canvas");
              c.width = page.naturalWidth; c.height = page.naturalHeight;
              const x = c.getContext("2d");
              x.drawImage(page, 0, 0);
              const sw = pos.w * c.width, sh = sw * (sImg.naturalHeight / sImg.naturalWidth);
              x.globalCompositeOperation = "multiply";
              x.drawImage(sImg, pos.x * c.width, pos.y * c.height, sw, sh);
              out = c.toDataURL("image/jpeg", 0.9);
              finish();
            } }, "Place")));
      }, { stack: true, onClose: () => resolve(out) });
    });
  }

  // ---------- The scanner screen ----------
  // tools: { sheet, h, ic, toast, save({ name, pdf, pages }) }. Resolves when closed.
  function open(tools, opts = {}) {
    const { sheet, h, ic, toast } = tools;
    return new Promise((resolve) => {
      const p = prefs();
      const pages = []; // { jpeg, w, h }
      sheet("Scan document", (body, finish) => {
        const name = h("input", { class: "input", id: "scan-name", value: "Scan " + new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), "aria-label": "Name" });
        const quality = h("select", { class: "input gp-select", id: "scan-quality", "aria-label": "Quality", onchange: (e) => { p.quality = e.target.value; savePrefs(p); } },
          h("option", { value: "small" }, "Small file"), h("option", { value: "medium" }, "Medium"), h("option", { value: "high" }, "High quality"));
        quality.value = p.quality;
        const strip = h("div", { class: "scan-pages", id: "scan-pages" });
        const editor = h("div", { class: "scan-edit", id: "scan-edit", hidden: true });
        const saveBtn = h("button", { class: "btn primary", id: "scan-save", disabled: true, onclick: async () => {
          if (!pages.length) return;
          saveBtn.disabled = true;
          const file = pdf(pages);
          const nm = (name.value.trim() || "Scan").replace(/\.pdf$/i, "") + ".pdf";
          await tools.save({ name: nm, pdf: file.dataUrl, size: file.size, pages: pages.map((x) => x.jpeg) });
          finish();
        } }, "Save PDF");
        const drawStrip = () => {
          strip.replaceChildren(...pages.map((pg, i) => h("div", { class: "scan-page", "data-page": i },
            h("img", { src: pg.jpeg, alt: "Page " + (i + 1) }), h("small", null, String(i + 1)),
            h("div", { class: "scan-page-acts" },
              i > 0 ? h("button", { class: "btn icon ghost", "aria-label": "Move left", onclick: () => { [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; drawStrip(); } }, ic("chevron-left")) : null,
              h("button", { class: "btn icon ghost", "aria-label": "Sign this page", title: "Sign", onclick: async () => { const signed = await placeSignature(tools, pg.jpeg); if (signed) { pg.jpeg = signed; drawStrip(); } } }, ic("pen")),
              h("button", { class: "btn icon ghost", "aria-label": "Delete page", onclick: () => { pages.splice(i, 1); drawStrip(); } }, ic("trash")),
              i < pages.length - 1 ? h("button", { class: "btn icon ghost", "aria-label": "Move right", onclick: () => { [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; drawStrip(); } }, ic("chevron-right")) : null))),
            h("div", { class: "scan-add" },
              h("button", { class: "btn", id: "scan-camera", onclick: () => pick(true) }, ic("camera"), "Take photo"),
              h("button", { class: "btn ghost", id: "scan-library", onclick: () => pick(false) }, ic("image"), "From photos")));
          saveBtn.disabled = !pages.length;
          saveBtn.textContent = pages.length > 1 ? "Save PDF (" + pages.length + " pages)" : "Save PDF";
        };
        const pick = (camera) => {
          const el = h("input", { type: "file", accept: "image/*", hidden: true, multiple: !camera });
          if (camera) el.setAttribute("capture", "environment");
          el.addEventListener("change", async () => {
            const files = Array.from(el.files || []); el.remove();
            for (const f of files) { try { await edit(await imageFrom(f)); } catch (err) { toast(err.message); } }
          });
          document.body.append(el); el.click();
        };
        // One page: drag the corners, pick a look, Use.
        const edit = (img) => new Promise((done) => {
          let corners = detect(img), look = p.filter, turn = 0;
          const stage = h("div", { class: "scan-stage" });
          const photo = h("img", { class: "scan-photo", src: img.src, alt: "" });
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("class", "scan-quad"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
          const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
          svg.append(poly);
          const handles = corners.map((_, i) => h("span", { class: "scan-handle", "data-corner": i }));
          stage.append(photo, svg, ...handles);
          const drawQuad = () => {
            poly.setAttribute("points", corners.map(([x, y]) => x * 100 + "," + y * 100).join(" "));
            handles.forEach((el, i) => { el.style.left = corners[i][0] * 100 + "%"; el.style.top = corners[i][1] * 100 + "%"; });
          };
          handles.forEach((el, i) => {
            el.addEventListener("pointerdown", (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch {} el.dataset.drag = "1"; });
            el.addEventListener("pointermove", (e) => {
              if (!el.dataset.drag) return;
              const r = stage.getBoundingClientRect();
              corners[i] = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
              drawQuad();
            });
            el.addEventListener("pointerup", () => { delete el.dataset.drag; });
          });
          drawQuad();
          const looks = h("div", { class: "gp-sort-row", id: "scan-looks" });
          const drawLooks = () => looks.replaceChildren(...FILTERS.map(([k, l]) => h("button", { class: "gp-mini" + (look === k ? " active" : ""), "data-look": k, onclick: () => { look = k; p.filter = k; savePrefs(p); drawLooks(); } }, l)));
          drawLooks();
          editor.hidden = false;
          strip.hidden = true;
          foot.hidden = true;
          editor.replaceChildren(h("p", { class: "gp-hint" }, "Drag the corners onto the page's corners."), stage, looks,
            h("div", { class: "gp-sheet-actions" },
              h("button", { class: "btn ghost", onclick: () => { corners = [[0, 0], [1, 0], [1, 1], [0, 1]]; drawQuad(); } }, "Whole photo"),
              h("button", { class: "btn ghost", id: "scan-rotate", title: "Turns the finished page", onclick: (e) => { turn = (turn + 1) % 4; e.currentTarget.textContent = turn ? "Turn " + turn * 90 + "°" : "Rotate"; } }, "Rotate"),
              h("button", { class: "btn", onclick: () => { editor.hidden = true; strip.hidden = false; foot.hidden = false; done(); } }, "Cancel"),
              h("button", { class: "btn primary", id: "scan-use", onclick: () => {
                const [max, q] = QUALITY[p.quality] || QUALITY.medium;
                let flat = filter(warp(img, corners, max), look);
                if (turn) {
                  const r = document.createElement("canvas");
                  const side = turn % 2 === 1;
                  r.width = side ? flat.height : flat.width; r.height = side ? flat.width : flat.height;
                  const x = r.getContext("2d");
                  x.translate(r.width / 2, r.height / 2); x.rotate((turn * Math.PI) / 2); x.drawImage(flat, -flat.width / 2, -flat.height / 2);
                  flat = r;
                }
                pages.push({ jpeg: flat.toDataURL("image/jpeg", q), w: flat.width, h: flat.height });
                editor.hidden = true; strip.hidden = false; foot.hidden = false;
                drawStrip();
                done();
              } }, "Use page")));
        });
        const foot = h("div", { class: "gp-sheet-actions", id: "scan-foot" }, h("button", { class: "btn", onclick: finish }, "Cancel"), saveBtn);
        body.append(h("div", { class: "scan-top" }, name, quality), strip, editor, foot);
        drawStrip();
        if (opts.camera) setTimeout(() => pick(true), 50);
      }, { full: true, sticky: true, cls: "scan-sheet", onClose: () => resolve() });
    });
  }

  window.CPScan = { open, detect, warp, filter, pdf, placeSignature, drawSignature };
})();
