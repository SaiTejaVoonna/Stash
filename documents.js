// Stash Documents: every PDF and file in one list (Inbox, notes and
// collections), page thumbnails, and a PDF viewer inside the app.
// window.CPDocs
//
// Files stay where they are (a prescription stays in Health › Prescriptions);
// this is only a view of all of them. PDFs are drawn with pdf.js, loaded the
// first time one is opened and kept for offline use after that.
(function () {
  "use strict";

  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/";
  // The exact file, checked by the browser before it runs (Subresource Integrity).
  const PDFJS_SRI = "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e";
  let api = null, pane = null, listEl = null, searchEl = null, viewer = null;
  const ui = { open: false, q: "", sort: "new", where: "all" };
  const thumbs = new Map(); // file key → data URL of page 1

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const ic = (name, cls) => { const s = document.createElement("span"); s.innerHTML = api.icon(name, cls); return s.firstChild; };
  const sizeOf = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const isPdf = (f) => /pdf$/i.test(f.type || "") || /\.pdf$/i.test(f.name || "");
  const keyOf = (f) => f.name + ":" + f.size + ":" + (f.data ? f.data.length : 0);

  // ---------- pdf.js, loaded once ----------
  let libPromise = null;
  function lib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!libPromise) {
      libPromise = new Promise((ok, fail) => {
        const s = document.createElement("script");
        s.src = PDFJS + "pdf.min.js";
        s.integrity = PDFJS_SRI; s.crossOrigin = "anonymous";
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
        s.onerror = () => { libPromise = null; fail(new Error("Couldn't load the PDF reader. Check your connection.")); };
        document.head.append(s);
      });
    }
    return libPromise;
  }
  function bytes(dataUrl) {
    const bin = atob(String(dataUrl).split(",")[1] || "");
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function loadPdf(f) { return (await lib()).getDocument({ data: bytes(f.data) }).promise; }
  // The words in a PDF (when it has real text, not just a picture of it).
  async function textOf(f) {
    try {
      const doc = await loadPdf(f);
      const parts = [];
      for (let i = 1; i <= Math.min(doc.numPages, 30); i++) parts.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(" "));
      return parts.join("\n").replace(/\s+\n/g, "\n").trim();
    } catch { return ""; }
  }

  // ---------- Thumbnails ----------
  // An <img> that fills in with page 1 once it's drawn (PDFs), or a file icon.
  function thumb(f) {
    const img = h("img", { class: "cx-thumb", alt: "" });
    if (!isPdf(f)) return ic("file");
    const k = keyOf(f);
    if (thumbs.has(k)) { img.src = thumbs.get(k); return img; }
    (async () => {
      try {
        const doc = await loadPdf(f);
        const page = await doc.getPage(1);
        const v = page.getViewport({ scale: 1 });
        const scale = 160 / v.width;
        const vp = page.getViewport({ scale });
        const c = document.createElement("canvas");
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        const url = c.toDataURL("image/jpeg", 0.7);
        thumbs.set(k, url);
        img.src = url;
      } catch { img.replaceWith(ic("file")); }
    })();
    return img;
  }

  // ---------- Viewer ----------
  async function view(f) {
    if (!isPdf(f)) { api.openFile(f); return; }
    closeViewer();
    const pages = h("div", { class: "dv-pages", id: "dv-pages" }, h("div", { class: "dv-loading" }, "Opening…"));
    let zoom = 1;
    const zoomLabel = h("span", { class: "dv-zoom" }, "100%");
    const draw = async (doc) => {
      pages.replaceChildren();
      const width = Math.min(900, pages.clientWidth - 24 || 360) * zoom;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const v = page.getViewport({ scale: 1 });
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale: (width / v.width) * dpr });
        const c = h("canvas", { class: "dv-page", "data-page": i });
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        c.style.width = width + "px";
        pages.append(c);
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        if (!viewer) return;
      }
    };
    viewer = h("div", { class: "dv", id: "doc-viewer", role: "dialog", "aria-label": f.name },
      h("div", { class: "dv-head" },
        h("button", { class: "btn icon ghost", id: "dv-close", "aria-label": "Close", onclick: closeViewer }, ic("chevron-left", "icon-lg")),
        h("b", { class: "dv-title" }, f.name),
        h("button", { class: "btn icon ghost", "aria-label": "Zoom out", onclick: () => { zoom = Math.max(0.6, zoom - 0.25); zoomLabel.textContent = Math.round(zoom * 100) + "%"; if (doc) draw(doc); } }, ic("zoom-out")),
        zoomLabel,
        h("button", { class: "btn icon ghost", "aria-label": "Zoom in", onclick: () => { zoom = Math.min(3, zoom + 0.25); zoomLabel.textContent = Math.round(zoom * 100) + "%"; if (doc) draw(doc); } }, ic("zoom-in")),
        api.sign ? h("button", { class: "btn gp-small", id: "dv-sign", onclick: () => api.sign(f) }, ic("pen"), "Sign") : null,
        h("button", { class: "btn gp-small", id: "dv-share", onclick: () => api.openFile(f) }, ic("download"), "Save / share")),
      pages);
    document.body.append(viewer);
    let doc = null;
    try { doc = await loadPdf(f); await draw(doc); }
    catch (err) { pages.replaceChildren(h("div", { class: "dv-loading" }, err.message || "Couldn't open this PDF."), h("button", { class: "btn", onclick: () => api.openFile(f) }, "Open with your phone instead")); }
  }
  function closeViewer() { if (viewer) { viewer.remove(); viewer = null; } }

  // ---------- The Documents list ----------
  function build() {
    searchEl = h("input", { class: "input", id: "docs-q", type: "search", "data-search-scope": "docs", placeholder: "Search documents", "aria-label": "Search documents", oninput: (e) => { ui.q = e.target.value; render(); } });
    const sort = h("select", { class: "input gp-select", id: "docs-sort", "aria-label": "Sort", onchange: (e) => { ui.sort = e.target.value; render(); } },
      h("option", { value: "new" }, "Newest first"), h("option", { value: "old" }, "Oldest first"), h("option", { value: "name" }, "Name"), h("option", { value: "size" }, "Biggest"));
    listEl = h("div", { class: "docs-list", id: "docs-list" });
    pane = h("div", { class: "docs-pane", id: "docs-pane", hidden: true, role: "dialog", "aria-label": "Documents" },
      h("div", { class: "docs-head" },
        h("button", { class: "btn icon ghost", id: "docs-close", "aria-label": "Back", onclick: close }, ic("chevron-left", "icon-lg")),
        h("div", { class: "docs-title" }, h("b", null, "Documents"), h("small", null, "Every PDF and file, wherever it lives.")),
        api.scan ? h("button", { class: "btn primary gp-small page-plus", id: "docs-scan", "aria-label": "Scan", onclick: () => api.scan() }, ic("camera"), h("span", null, "Scan")) : null),
      api.libraryBar ? api.libraryBar("docs") : null,
      h("div", { class: "docs-tools" }, h("label", { class: "search-wrap" }, ic("search"), searchEl), sort),
      h("div", { class: "docs-where", id: "docs-where" }),
      listEl);
    document.body.append(pane);
  }
  function render() {
    if (!pane || pane.hidden) return;
    const all = api.documents();
    const wheres = [...new Set(all.map((d) => d.area))];
    const whereEl = document.getElementById("docs-where");
    whereEl.replaceChildren(...(wheres.length > 1 ? ["all", ...wheres] : []).map((w) => h("button", { class: "cx-filter" + (ui.where === w ? " on" : ""), "data-where": w, onclick: () => { ui.where = w; render(); } }, w === "all" ? "All" : w)));
    const q = ui.q.toLowerCase().trim();
    let list = all.filter((d) => (ui.where === "all" || d.area === ui.where) && (!q || (d.file.name + " " + d.where + " " + (d.file.text || "")).toLowerCase().includes(q)));
    const by = { new: (a, b) => b.at - a.at, old: (a, b) => a.at - b.at, name: (a, b) => a.file.name.localeCompare(b.file.name), size: (a, b) => b.file.size - a.file.size }[ui.sort];
    list = list.sort(by);
    listEl.replaceChildren();
    if (!list.length) {
      listEl.append(h("div", { class: "cx-empty" }, ic("file"), h("b", null, all.length ? "Nothing matches" : "No documents yet"),
        h("p", null, all.length ? "Try another word." : "PDFs and files you add to the Inbox, notes or collections show up here." + (api.scan ? " Or scan a paper." : ""))));
      return;
    }
    for (const d of list) {
      const inText = q && d.file.text && d.file.text.toLowerCase().includes(q) && !(d.file.name + " " + d.where).toLowerCase().includes(q);
      listEl.append(h("div", { class: "doc-row", "data-doc": d.file.name, role: "button", tabindex: "0", onclick: () => view(d.file), onkeydown: (e) => { if (e.key === "Enter") view(d.file); } },
        h("div", { class: "doc-thumb" }, thumb(d.file)),
        h("div", { class: "doc-main" }, h("b", null, d.file.name),
          h("small", null, [new Date(d.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), d.where, sizeOf(d.file.size)].join(" · ")),
          inText ? h("small", { class: "doc-hit" }, "Found in its text") : null),
        d.goTo ? h("button", { class: "btn icon ghost doc-where-btn", "aria-label": "Show where it is", title: "Show where it is", onclick: (e) => { e.stopPropagation(); close(); d.goTo(); } }, ic("library")) : null));
    }
  }
  function open() {
    if (!pane) build();
    pane.hidden = false;
    ui.open = true;
    document.body.classList.add("docs-open");
    render();
  }
  function close() {
    closeViewer();
    if (!pane) return;
    pane.hidden = true;
    ui.open = false;
    document.body.classList.remove("docs-open");
    if (api.onClose) api.onClose();
  }
  // Back: the viewer, then the list.
  function stepBack() {
    if (viewer) { closeViewer(); return true; }
    if (ui.open) { close(); return true; }
    return false;
  }

  function init(appApi) {
    api = appApi;
    return { open, close, stepBack, render, view, thumb, textOf, loadPdf, isOpen: () => ui.open || !!viewer, isPdf };
  }
  window.CPDocs = { init };
})();
