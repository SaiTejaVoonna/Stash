// Stash OCR: reads printed text in photos and scans on this device, so
// search finds a bill by what's written on it. window.CPOcr
//
// Uses Tesseract.js. The first time, the browser downloads the reader and the
// English language data (about 10 MB) and keeps them; after that it works
// offline. Photos never leave the device. Handwriting is read poorly.
(function () {
  "use strict";

  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  // The exact file, checked by the browser before it runs (Subresource Integrity).
  const TESS_SRI = "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F";
  let workerPromise = null;

  function loadScript(src) {
    return new Promise((ok, fail) => {
      if (window.Tesseract) return ok();
      const s = document.createElement("script");
      s.src = src;
      s.integrity = TESS_SRI; s.crossOrigin = "anonymous";
      s.onload = () => ok();
      s.onerror = () => fail(new Error("Couldn't download the text reader. Check your connection and try again."));
      document.head.append(s);
    });
  }
  // One reader, made once and reused.
  function worker() {
    if (!workerPromise) {
      workerPromise = (async () => {
        await loadScript(TESS);
        return window.Tesseract.createWorker("eng");
      })();
      workerPromise.catch(() => { workerPromise = null; });
    }
    return workerPromise;
  }
  // A smaller, grey copy reads faster and often better.
  function prepare(src) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const x = c.getContext("2d");
        x.filter = "grayscale(1) contrast(1.25)";
        x.drawImage(img, 0, 0, c.width, c.height);
        ok(c);
      };
      img.onerror = () => ok(src);
      img.src = src;
    });
  }
  // The text in one image (a data URL), or "" when there's none. Throws only
  // when the reader can't be downloaded.
  async function read(src) {
    const w = await worker();
    const r = await w.recognize(await prepare(src));
    const text = (r && r.data && r.data.text) || "";
    return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  async function readAll(list, onProgress) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      if (onProgress) onProgress(i, list.length);
      out.push(await read(list[i]));
    }
    return out.filter(Boolean).join("\n\n");
  }

  window.CPOcr = { read, readAll };
})();
