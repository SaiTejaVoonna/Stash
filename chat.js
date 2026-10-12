// Stash Me: a chat with yourself. Drop text, photos and files the way
// you'd message yourself on WhatsApp; each message is saved at once, with when
// (and, for photos, where) it was taken. Later, select messages and forward
// them into a space, sub-chat and page. window.CPChat
//
// Messages are notes marked `chat`, so search, backup and the Vault rules all
// apply to them. They stay out of the notes list until they're forwarded.
(function () {
  "use strict";

  let api = null;
  let pane, bodyEl, barEl, selBar, input, plusMenu, previewEl, capBar, filterEl, searchEl, sheetEl, sugEl, spotsEl;
  const ui = { open: false, selecting: false, picked: new Set(), menu: false, preview: null, captionFor: null, filter: "all", q: "", searching: false, picks: [], sug: null };

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
  const ic = (name, cls) => {
    const span = document.createElement("span");
    span.className = "cx-ic";
    span.innerHTML = api.icon(name, cls);
    return span.firstChild;
  };
  const dayLabel = (t) => {
    const d = new Date(t), today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  };
  const timeOf = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sizeOf = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

  function build() {
    pane = h("section", { id: "chat-pane", hidden: true, "aria-label": "Inbox" });
    const head = h("div", { class: "cx-head" },
      h("button", { class: "btn icon ghost cx-menu", "aria-label": "Menu", onclick: () => api.openSidebarDrawer() }, ic("menu", "icon-lg")),
      h("div", { class: "cx-title" }, h("b", null, "Inbox"), h("small", null, "Drop anything. Sort it later.")),
      h("button", { class: "btn icon ghost", id: "cx-search-btn", "aria-label": "Search the Inbox", title: "Search", onclick: () => toggleSearch(!ui.searching) }, ic("search")),
      h("button", { class: "btn icon ghost", id: "cx-cleanup", "aria-label": "Clean up", title: "Clean up", onclick: () => openCleanup() }, ic("sparkle")),
      h("button", { class: "btn gp-small cx-select", id: "cx-select", onclick: () => setSelecting(!ui.selecting) }, "Select"));
    searchEl = h("div", { class: "cx-searchbar", hidden: true },
      h("input", { id: "cx-q", type: "search", placeholder: "Search the Inbox", "aria-label": "Search the Inbox", oninput: (e) => { ui.q = e.target.value; render(); } }));
    filterEl = h("div", { class: "cx-filters", id: "cx-filters", role: "tablist" });
    sheetEl = h("div", { class: "cx-sheet-wrap", id: "cx-sheet", hidden: true });
    bodyEl = h("div", { class: "cx-body", id: "cx-body" });
    selBar = h("div", { class: "cx-selbar", id: "cx-selbar", hidden: true });
    plusMenu = h("div", { class: "cx-plus-menu", id: "cx-plus-menu", hidden: true, role: "menu" },
      h("button", { role: "menuitem", id: "cx-camera", onclick: () => { toggleMenu(false); api.camera(); } }, ic("camera"), h("span", null, "Camera", h("small", null, "Take a photo now"))),
      h("button", { role: "menuitem", id: "cx-gallery", onclick: () => { toggleMenu(false); pick("image/*", "library"); } }, ic("image"), h("span", null, "Gallery", h("small", null, "Photos you already have"))),
      h("button", { role: "menuitem", id: "cx-files", onclick: () => { toggleMenu(false); pick("", "file"); } }, ic("file"), h("span", null, "Files", h("small", null, "PDFs, audio, video, anything up to 50 MB"))),
      h("button", { role: "menuitem", id: "cx-scan", onclick: () => { toggleMenu(false); api.scan(); } }, ic("clipboard"), h("span", null, "Scan document", h("small", null, "Paper to a clean PDF"))),
      h("button", { role: "menuitem", id: "cx-location", "data-extra": "1", onclick: () => { toggleMenu(false); api.location(); } }, ic("map-pin"), h("span", null, "Location", h("small", null, "Where you are now, as a pin"))),
      h("button", { role: "menuitem", id: "cx-contact", "data-extra": "1", onclick: () => { toggleMenu(false); api.contact(); } }, ic("user"), h("span", null, "Contact", h("small", null, "A name and number, call in one tap"))),
      h("button", { role: "menuitem", id: "cx-qr", "data-extra": "1", onclick: () => { toggleMenu(false); api.qr(); } }, ic("grid"), h("span", null, "Scan QR code", h("small", null, "Links, Wi-Fi passwords, anything"))));
    input = h("textarea", { id: "cx-input", rows: "1", placeholder: "Add to Inbox…", "aria-label": "Message",
      oninput: () => { grow(); suggest(); spots(); liveCaption(); },
      onclick: () => suggest(),
      onkeydown: (e) => {
        // The @ / # list: arrows move, Enter or Tab picks.
        if (ui.sug && ui.sug.items.length) {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ui.sug.at = (ui.sug.at + (e.key === "ArrowDown" ? 1 : -1) + ui.sug.items.length) % ui.sug.items.length; drawSug(); return; }
          if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickSug(ui.sug.items[ui.sug.at]); return; }
          if (e.key === "Escape") { e.preventDefault(); closeSug(); return; }
        }
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); sendText(); }
      } });
    sugEl = h("div", { class: "cx-sug", id: "cx-sug", hidden: true, role: "listbox" });
    spotsEl = h("div", { class: "cx-spots", id: "cx-spots", hidden: true });
    barEl = h("div", { class: "cx-bar" },
      h("button", { class: "gp-round plus", id: "cx-plus", "aria-label": "Add photo or file", onclick: () => toggleMenu(!ui.menu) }, ic("plus")),
      h("div", { class: "cx-box" }, input,
        h("button", { class: "gp-round", id: "cx-snap", "aria-label": "Camera", title: "Camera", onclick: () => api.camera() }, ic("camera"))),
      h("button", { class: "gp-round send", id: "cx-send", "aria-label": "Send", onclick: sendText }, ic("send")));
    previewEl = h("div", { class: "cx-preview", id: "cx-preview", hidden: true, role: "dialog", "aria-label": "Add a caption" });
    capBar = h("div", { class: "cx-capbar", id: "cx-capbar", hidden: true });
    pane.append(head, searchEl, filterEl, bodyEl, plusMenu, sugEl, selBar, capBar, spotsEl, barEl, previewEl, sheetEl);
    document.getElementById("list-pane").after(pane);
    // Drop files anywhere on the chat (computers).
    pane.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
    pane.addEventListener("drop", (e) => {
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      if (!files.length) return;
      e.preventDefault();
      openPreview(files, "file");
    });
    input.addEventListener("paste", (e) => {
      const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
      if (!files.length) return;
      e.preventDefault();
      openPreview(files, "file");
    });
    document.addEventListener("pointerdown", (e) => {
      if (ui.menu && !e.target.closest("#cx-plus-menu, #cx-plus")) toggleMenu(false);
    }, true);
  }
  function grow() { input.style.height = "auto"; input.style.height = Math.min(140, input.scrollHeight) + "px"; }
  function toggleMenu(on) {
    const scan = document.getElementById("cx-scan");
    if (scan) scan.hidden = !(api.addon && api.addon("scanner") && window.CPScan);
    plusMenu.querySelectorAll("[data-extra]").forEach((b) => { b.hidden = !(api.addon && api.addon("extras") && window.CPExtras); });
    ui.menu = on; plusMenu.hidden = !on; document.getElementById("cx-plus").classList.toggle("on", on); }
  function pick(accept, origin) {
    const el = h("input", { type: "file", multiple: true, hidden: true });
    if (accept) el.accept = accept;
    el.addEventListener("change", async () => {
      const files = Array.from(el.files || []);
      el.remove();
      if (files.length) openPreview(files, origin);
    });
    document.body.append(el);
    el.click();
  }
  async function sendText() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    grow();
    // Right after a snap, what you type is its caption.
    if (ui.captionFor) { const id = ui.captionFor; captionMode(null); await api.setCaption(id, text); render(); input.focus(); return; }
    // What you picked from the @ / # list and kept in the text.
    const kept = ui.picks.filter((p) => text.includes(p.insert));
    const pick = { dest: kept.filter((p) => p.ref).map((p) => p.ref), tags: kept.filter((p) => p.tag).map((p) => p.tag) };
    ui.picks = [];
    closeSug(); spots();
    await api.addText(text, pick);
    render();
    input.focus();
  }

  // ---------- @ and # while typing (brain.js) ----------
  // Shown only once you type @ or #. A typed #word stays plain text until you
  // pick it from the list; picked ones are kept with the message.
  function tokenAtCaret() {
    const v = input.value, pos = input.selectionStart;
    const m = v.slice(0, pos).match(/(^|\s)([@#])([^\s@#]{0,40})$/);
    return m ? { kind: m[2], prefix: m[3], start: pos - m[3].length - 1, end: pos } : null;
  }
  function suggest() {
    const tk = api.complete ? tokenAtCaret() : null;
    if (!tk) { closeSug(); return; }
    const items = api.complete(tk.kind, tk.prefix);
    if (!items.length) { closeSug(); return; }
    ui.sug = { tk, items, at: 0 };
    drawSug();
  }
  function drawSug() {
    sugEl.hidden = false;
    sugEl.replaceChildren(...ui.sug.items.map((it, i) => h("button", { class: "cx-sug-item" + (i === ui.sug.at ? " on" : ""), role: "option", type: "button", "data-insert": it.insert,
      onpointerdown: (e) => e.preventDefault(), onclick: () => pickSug(it) },
      ic(it.kind === "tag" ? "hash" : it.kind === "page" ? "user" : it.kind === "section" ? "chevron-right" : "layers"),
      h("span", null, h("b", null, it.label), it.sub ? h("small", null, it.sub) : null))));
  }
  function closeSug() { ui.sug = null; if (sugEl) { sugEl.hidden = true; sugEl.replaceChildren(); } }
  function pickSug(it) {
    const tk = ui.sug && ui.sug.tk;
    if (!tk) return;
    const v = input.value;
    const ins = it.insert + " ";
    input.value = v.slice(0, tk.start) + ins + v.slice(tk.end);
    const at = tk.start + ins.length;
    input.setSelectionRange(at, at);
    ui.picks.push(it);
    closeSug();
    grow(); spots();
    input.focus();
  }
  // Dates, amounts and numbers it spotted, shown as small chips while typing.
  let spotTimer = null;
  function spots() {
    clearTimeout(spotTimer);
    spotTimer = setTimeout(() => {
      const list = api.spot && input.value.trim() ? api.spot(input.value) : [];
      spotsEl.hidden = !list.length;
      const icon = { amount: "₹", km: "🛣", litres: "⛽", phone: "📞", when: "📅", "when-future": "⏰" };
      spotsEl.replaceChildren(...list.map((x) => h("span", { class: "cx-spot", "data-spot": x.kind }, (icon[x.kind] && x.kind !== "amount" ? icon[x.kind] + " " : "") + x.label)));
    }, 120);
  }

  // ---------- Sort many at once ----------
  function openSort(list) {
    const rows = list.map((n) => ({ n, u: api.understand(n), on: true }));
    rows.forEach((r) => { r.d = r.u.dests[0] || null; r.on = !!r.d; });
    const draw = () => {
      const n = rows.filter((r) => r.on && r.d).length;
      sheetEl.replaceChildren(h("div", { class: "cx-sheet", role: "dialog", "aria-label": "Sort" },
        h("div", { class: "cx-sheet-head" }, h("b", null, "Sort " + (list.length === 1 ? "1 message" : list.length + " messages")), h("button", { class: "btn icon ghost", "aria-label": "Close", onclick: closeSheet }, ic("close"))),
        h("div", { class: "cx-sheet-body" }, h("p", { class: "cx-clean-none sort-hint" }, "Where each one goes, worked out from your own collections and what you did before. Untick any, or change it."),
          rows.map((r, i) => h("div", { class: "cx-sort-row", "data-row": i },
            h("input", { type: "checkbox", checked: r.on && !!r.d, disabled: !r.d, "aria-label": "Move this one", onchange: (e) => { r.on = e.target.checked; draw(); } }),
            (r.n.images || [])[0] ? h("img", { src: r.n.images[0], alt: "" }) : h("span", { class: "cx-clean-ic" }, ic((r.n.files || []).length ? "file" : "note")),
            h("span", { class: "cx-sort-main" }, h("span", { class: "cx-clean-text" }, (r.n.content || r.n.title || (r.n.files || []).map((f) => f.name).join(", ") || "Photo").slice(0, 80)),
              r.d ? h("small", { class: "cx-sort-dest" }, "→ " + r.d.label + (r.d.why.length ? " · " + r.d.why[0] : "")) : h("small", { class: "cx-sort-none" }, "Not sure: stays in the Inbox"),
              r.u.dests[1] ? h("button", { class: "gp-mini cx-sort-alt", onclick: () => { [r.u.dests[0], r.u.dests[1]] = [r.u.dests[1], r.u.dests[0]]; r.d = r.u.dests[0]; r.on = true; draw(); } }, "or " + r.u.dests[1].label) : null),
            h("button", { class: "btn ghost gp-small", onclick: () => { closeSheet(); api.forward([r.n], () => render()); } }, "Change")))),
        h("div", { class: "cx-sheet-foot" },
          h("button", { class: "btn primary", id: "cx-sort-move", disabled: !n, onclick: async () => {
            const go = rows.filter((r) => r.on && r.d);
            closeSheet(); setSelecting(false);
            await api.fileInto(go.map((r) => r.n), go.map((r) => r.d));
          } }, n ? "Move " + n : "Move"))));
    };
    sheetEl.hidden = false;
    document.body.classList.add("cx-previewing");
    draw();
  }

  // ---------- Caption: look before you send, like WhatsApp ----------
  // New photos and files: shown first, with a caption box. Send saves them as one
  // message (several photos become an album). A snap is saved the moment it's
  // taken; this then only adds its caption.
  const HD_KEY = "copypaster-hd";
  const hdOn = () => { try { return localStorage.getItem(HD_KEY) !== "0"; } catch { return true; } };
  const isPhoto = (f) => /^image\//.test(f.type) && f.type !== "image/svg+xml";
  // "Word document", not "VND.OPENXMLFORMATS-OFFICEDOCUMENT...".
  function kindName(f) {
    const t = String(f.type || "").toLowerCase(), ext = (String(f.name || "").match(/\.([a-z0-9]{1,5})$/i) || [])[1] || "";
    const e = ext.toLowerCase();
    if (/pdf/.test(t) || e === "pdf") return "PDF";
    if (/wordprocessing|msword/.test(t) || /^docx?$/.test(e)) return "Word document";
    if (/spreadsheet|ms-excel/.test(t) || /^(xlsx?|csv)$/.test(e)) return e === "csv" ? "CSV sheet" : "Excel sheet";
    if (/presentation|powerpoint/.test(t) || /^pptx?$/.test(e)) return "PowerPoint";
    if (/zip|compressed/.test(t) || /^(zip|rar|7z)$/.test(e)) return "Zip file";
    if (/^audio\//.test(t)) return "Audio";
    if (/^video\//.test(t)) return "Video";
    if (/^image\//.test(t)) return "Image";
    if (/^text\//.test(t) || /^(txt|md)$/.test(e)) return "Text";
    return e ? e.toUpperCase() + " file" : "File";
  }
  function openPreview(files, origin) {
    if (!files.length) return;
    toggleMenu(false);
    ui.preview = { mode: "new", files: files.slice(0, 10), origin, at: 0, caption: "", urls: new Map() };
    document.body.classList.add("cx-previewing");
    if (files.length > 10) api.toast("Up to 10 at a time; the first 10 are here");
    renderPreview(true);
  }
  // After a snap: the box below becomes its caption (a small bar shows which photo).
  // While you type a caption, it shows under the photo as it will look (like WhatsApp).
  function liveCaption() {
    document.querySelectorAll(".cx-live").forEach((x) => { if (!ui.captionFor || !x.closest('[data-id="' + ui.captionFor + '"]')) x.remove(); });
    if (!ui.captionFor) return;
    const msg = bodyEl.querySelector('.cx-msg[data-id="' + CSS.escape(ui.captionFor) + '"]');
    if (!msg) return;
    const text = input.value.trim();
    let live = msg.querySelector(".cx-live");
    if (!text) { if (live) live.remove(); return; }
    if (!live) {
      live = h("div", { class: "cx-text cx-live", "aria-hidden": "true" });
      const meta = msg.querySelector(".cx-meta");
      msg.insertBefore(live, meta || null);
      const atBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 120;
      if (atBottom) requestAnimationFrame(() => { bodyEl.scrollTop = bodyEl.scrollHeight; });
    }
    live.textContent = text;
  }
  function captionMode(id) {
    ui.captionFor = id;
    liveCaption();
    const n = id && api.items().find((x) => x.id === id);
    capBar.hidden = !n;
    input.placeholder = n ? "Add a caption to this photo…" : "Add to Inbox…";
    if (!n) { capBar.replaceChildren(); return; }
    capBar.replaceChildren(
      n.images && n.images[0] ? h("img", { src: n.images[0], alt: "" }) : ic("camera"),
      h("span", null, h("b", null, "Saved"), h("small", null, "Type a caption, or carry on")),
      h("button", { class: "btn icon ghost", id: "cx-capbar-close", "aria-label": "No caption", onclick: () => captionMode(null) }, ic("close")));
    if (!window.matchMedia("(pointer: coarse)").matches) input.focus();
  }
  // Adds or changes the caption of a message that's already saved.
  function openCaption(id, { fresh = false } = {}) {
    if (fresh) { captionMode(id); return; }
    const n = api.items().find((x) => x.id === id);
    if (!n) return;
    toggleMenu(false);
    ui.preview = { mode: "edit", id, fresh, photos: n.images || [], files: n.files || [], at: 0, caption: (n.content || "").trim() || "" };
    document.body.classList.add("cx-previewing");
    renderPreview(true);
  }
  function closePreview() {
    if (!ui.preview) return;
    if (ui.preview.urls) for (const u of ui.preview.urls.values()) URL.revokeObjectURL(u);
    ui.preview = null;
    document.body.classList.remove("cx-previewing");
    previewEl.hidden = true;
    previewEl.replaceChildren();
  }
  const urlOf = (f) => {
    const m = ui.preview.urls;
    if (!m.has(f)) m.set(f, URL.createObjectURL(f));
    return m.get(f);
  };
  function renderPreview(focus) {
    const pv = ui.preview;
    if (!pv) return;
    previewEl.hidden = false;
    // What's being sent: photos (as images) and files (as cards).
    const list = pv.mode === "new"
      ? pv.files.map((f) => (isPhoto(f) ? { photo: urlOf(f), name: f.name, file: f } : { name: f.name || "file", size: f.size, type: f.type || "", file: f }))
      : [...pv.photos.map((p) => ({ photo: p })), ...pv.files.map((f) => ({ name: f.name, size: f.size, type: f.type }))];
    pv.at = Math.min(pv.at, Math.max(0, list.length - 1));
    const cur = list[pv.at];
    const big = !cur ? h("div", { class: "cx-pv-empty" }, "Nothing left to send")
      : cur.photo ? h("img", { class: "cx-pv-big", src: cur.photo, alt: "" })
      : h("div", { class: "cx-pv-filebig" }, ic("file"), h("b", null, cur.name), h("small", null, kindName(cur) + (cur.size ? " · " + sizeOf(cur.size) : "")));
    const strip = h("div", { class: "cx-pv-strip" }, list.map((x, i) => h("div", { class: "cx-pv-thumb" + (i === pv.at ? " on" : "") },
      h("button", { class: "cx-pv-pick", "aria-label": "Show " + (x.name || "photo " + (i + 1)), onclick: () => { pv.at = i; renderPreview(); } },
        x.photo ? h("img", { src: x.photo, alt: "" }) : ic("file")),
      pv.mode === "new" ? h("button", { class: "cx-pv-x", "aria-label": "Remove " + (x.name || "this"), onclick: () => {
        const f = pv.files[i];
        if (pv.urls.has(f)) { URL.revokeObjectURL(pv.urls.get(f)); pv.urls.delete(f); }
        pv.files.splice(i, 1);
        if (!pv.files.length) { closePreview(); return; }
        renderPreview();
      } }, ic("close")) : null)),
      pv.mode === "new" && pv.files.length < 10 ? h("button", { class: "cx-pv-more", "aria-label": "Add more", onclick: () => {
        const el = h("input", { type: "file", multiple: true, hidden: true });
        el.addEventListener("change", () => { const more = Array.from(el.files || []); el.remove(); pv.files.push(...more.slice(0, 10 - pv.files.length)); renderPreview(); });
        document.body.append(el); el.click();
      } }, ic("plus")) : null);
    const cap = h("textarea", { id: "cx-caption", rows: "1", placeholder: "Add a caption…", "aria-label": "Caption", value: pv.caption,
      oninput: (e) => { pv.caption = e.target.value; e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; },
      onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(); } } });
    const hasPhoto = pv.mode === "new" && pv.files.some(isPhoto);
    const hd = hasPhoto ? h("button", { class: "cx-pv-hd" + (hdOn() ? " on" : ""), id: "cx-hd", type: "button", "aria-pressed": hdOn() ? "true" : "false",
      title: "HD keeps the original photo too (bigger). Off keeps a smaller copy only.",
      onclick: () => { try { localStorage.setItem(HD_KEY, hdOn() ? "0" : "1"); } catch {} renderPreview(); } }, "HD") : null;
    const send = async () => {
      const text = pv.caption.trim();
      if (pv.mode === "new") {
        const files = pv.files.slice(), origin = pv.origin;
        closePreview();
        await api.addFiles(files, origin, { caption: text, hd: hdOn() });
      } else {
        const id = pv.id;
        closePreview();
        await api.setCaption(id, text);
      }
      render();
    };
    previewEl.replaceChildren(
      h("div", { class: "cx-pv-head" },
        h("button", { class: "btn icon ghost", id: "cx-preview-close", "aria-label": pv.mode === "new" ? "Cancel" : "Close", onclick: closePreview }, ic("close", "icon-lg")),
        h("span", { class: "cx-pv-title" }, pv.mode === "new" ? (list.length === 1 ? "1 to send" : list.length + " to send") : pv.fresh ? "Saved · add a caption?" : "Edit caption"),
        hd),
      h("div", { class: "cx-pv-stage" }, big),
      list.length > 1 || pv.mode === "new" ? strip : null,
      h("div", { class: "cx-pv-bar" }, h("div", { class: "cx-box" }, cap),
        h("button", { class: "gp-round send", id: "cx-preview-send", "aria-label": pv.mode === "new" ? "Send" : "Save caption", disabled: pv.mode === "new" && !pv.files.length, onclick: send },
          ic(pv.mode === "new" ? "send" : "check"))));
    if (focus && !window.matchMedia("(pointer: coarse)").matches) setTimeout(() => cap.focus(), 30);
  }

  // ---------- Finding things: filters and search ----------
  const FILTERS = [["all", "All"], ["photos", "Photos"], ["files", "Files"], ["links", "Links"], ["text", "Text"], ["week", "This week"], ["archived", "Archived"]];
  const LINK_RE = /https?:\/\/\S+/i;
  const textOf = (n) => [n.title, n.content, ...(n.files || []).map((f) => f.name), n.suggest ? n.suggest.label : ""].filter(Boolean).join(" ").toLowerCase();
  function passes(n) {
    const f = ui.filter;
    if (f === "archived" ? !n.archivedAt : n.archivedAt) return false;
    if (f === "photos" && !(n.images || []).length) return false;
    if (f === "files" && !(n.files || []).length) return false;
    if (f === "links" && !LINK_RE.test((n.content || "") + " " + (n.title || ""))) return false;
    if (f === "text" && ((n.images || []).length || (n.files || []).length)) return false;
    if (f === "week" && Date.now() - n.createdAt > 7 * 864e5) return false;
    if (ui.q.trim()) {
      // Your own words count too ("PUC" also finds "pollution certificate").
      const alts = window.CPWords ? window.CPWords.alternatives(ui.q) : [ui.q.toLowerCase().trim()];
      if (!alts.some((q) => q.split(/\s+/).every((w) => textOf(n).includes(w)))) return false;
    }
    return true;
  }
  function renderFilters() {
    const all = api.items();
    // Nothing yet: no tools to look at either.
    const empty = !all.length;
    filterEl.hidden = empty;
    ["cx-search-btn", "cx-cleanup", "cx-select"].forEach((id) => { const b = document.getElementById(id); if (b) b.hidden = empty && !(id === "cx-select" && ui.selecting); });
    const count = (k) => { const keep = ui.filter; ui.filter = k; const q = ui.q; ui.q = ""; const n = all.filter(passes).length; ui.filter = keep; ui.q = q; return n; };
    filterEl.replaceChildren(...FILTERS.filter(([k]) => k === "all" || k === ui.filter || count(k)).map(([k, label]) =>
      h("button", { class: "cx-filter" + (ui.filter === k ? " on" : ""), role: "tab", "data-filter": k, "aria-selected": ui.filter === k ? "true" : "false",
        onclick: () => { ui.filter = k; ui.picked.clear(); render(); bodyEl.scrollTop = bodyEl.scrollHeight; } }, label)));
  }
  function toggleSearch(on) {
    ui.searching = on;
    searchEl.hidden = !on;
    if (on) setTimeout(() => searchEl.querySelector("input").focus(), 30);
    else { ui.q = ""; searchEl.querySelector("input").value = ""; render(); }
  }

  // ---------- Clean up ----------
  // Finds clutter (empty messages, the same thing twice, old ones, the biggest
  // files) and lets you tick what to archive or delete. Nothing is gone for good:
  // Archive keeps it, Delete goes to Trash for 30 days, and both can be undone.
  const AUTO_KEY = "copypaster-inbox-autoarchive";
  const autoDays = () => { try { return Number(localStorage.getItem(AUTO_KEY)) || 0; } catch { return 0; } };
  const bytesOf = (n) => Math.round(([...(n.images || []), ...(n.files || []).map((f) => f.data), n.capture && n.capture.original, ...(n.captures || []).map((c) => c && c.original)]
    .filter(Boolean).reduce((t, x) => t + x.length, 0)) * 0.75);
  function fingerprint(n) {
    const parts = [(n.content || "").trim(), (n.title || "").trim(), ...(n.images || []), ...(n.files || []).map((f) => f.name + ":" + f.size)];
    let h1 = 0;
    for (const p of parts) for (let i = 0; i < p.length; i += Math.max(1, Math.floor(p.length / 4000))) h1 = (h1 * 31 + p.charCodeAt(i)) | 0;
    return h1 + ":" + parts.join("").length;
  }
  function clutter() {
    const live = api.items().filter((n) => !n.archivedAt);
    const empty = live.filter((n) => !(n.content || "").trim() && !(n.title || "").trim() && !(n.images || []).length && !(n.files || []).length && !(n.audio || []).length);
    const seen = new Map(), dupes = [];
    for (const n of live.slice().sort((a, b) => a.createdAt - b.createdAt)) {
      if (empty.includes(n)) continue;
      const k = fingerprint(n);
      if (seen.has(k)) dupes.push(n); else seen.set(k, n);
    }
    const old = live.filter((n) => Date.now() - n.createdAt > 30 * 864e5 && !empty.includes(n) && !dupes.includes(n));
    const big = live.map((n) => [n, bytesOf(n)]).filter(([, b]) => b > 1024 * 1024).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n]) => n);
    return { empty, dupes, old, big };
  }
  function openCleanup() {
    toggleMenu(false);
    const c = clutter();
    const picked = new Set([...c.empty, ...c.dupes].map((n) => n.id));
    const draw = () => {
      const groupBox = (key, title, hint, list, by) => {
        if (!list.length) return null;
        const allOn = list.every((n) => picked.has(n.id));
        return h("div", { class: "cx-clean-sec", "data-group": key },
          h("label", { class: "cx-clean-head" }, h("input", { type: "checkbox", checked: allOn, onchange: (e) => { list.forEach((n) => (e.target.checked ? picked.add(n.id) : picked.delete(n.id))); draw(); } }),
            h("span", null, h("b", null, title + " (" + list.length + ")"), h("small", null, hint))),
          h("div", { class: "cx-clean-list" }, list.slice(0, 30).map((n) => h("label", { class: "cx-clean-item" },
            h("input", { type: "checkbox", checked: picked.has(n.id), onchange: (e) => { if (e.target.checked) picked.add(n.id); else picked.delete(n.id); draw(); } }),
            (n.images || [])[0] ? h("img", { src: n.images[0], alt: "" }) : h("span", { class: "cx-clean-ic" }, ic((n.files || []).length ? "file" : "note")),
            h("span", { class: "cx-clean-text" }, ((n.content || n.title || (n.files || []).map((f) => f.name).join(", ") || ((n.images || []).length ? "Photo" : "Empty message")).trim()).slice(0, 80)),
            h("small", null, by ? by(n) : dayLabel(n.createdAt))))));
      };
      const n = picked.size;
      const sel = () => api.items().filter((x) => picked.has(x.id));
      const auto = h("select", { id: "cx-auto", class: "settings-inline-select", onchange: (e) => { try { localStorage.setItem(AUTO_KEY, e.target.value); } catch {} } },
        [["0", "Never"], ["30", "After 30 days"], ["90", "After 90 days"]].map(([v, l]) => h("option", { value: v }, l)));
      auto.value = String(autoDays());
      const secs = [groupBox("empty", "Empty messages", "Nothing in them.", c.empty), groupBox("dupes", "The same thing twice", "Later copies; the first one stays.", c.dupes),
        groupBox("old", "Older than 30 days", "Still in the Inbox after a month.", c.old), groupBox("big", "Biggest", "Photos and files taking the most space.", c.big, (x) => sizeOf(bytesOf(x)))].filter(Boolean);
      sheetEl.replaceChildren(h("div", { class: "cx-sheet", role: "dialog", "aria-label": "Clean up the Inbox" },
        h("div", { class: "cx-sheet-head" }, h("b", null, "Clean up the Inbox"), h("button", { class: "btn icon ghost", id: "cx-clean-close", "aria-label": "Close", onclick: closeSheet }, ic("close"))),
        h("div", { class: "cx-sheet-body" },
          secs.length ? secs : h("p", { class: "cx-clean-none" }, "Nothing to clean up. Nice and tidy."),
          h("label", { class: "cx-clean-auto" }, h("span", null, h("b", null, "Archive old messages automatically"), h("small", null, "Archived messages leave the Inbox but stay searchable under Archived.")), auto)),
        h("div", { class: "cx-sheet-foot" },
          h("button", { class: "btn", id: "cx-clean-archive", disabled: !n, onclick: async () => { const l = sel(); closeSheet(); await api.archive(l, true); render(); } }, ic("archive"), n ? "Archive " + n : "Archive"),
          h("button", { class: "btn danger", id: "cx-clean-delete", disabled: !n, onclick: async () => { const l = sel(); closeSheet(); await api.remove(l); render(); } }, ic("trash"), n ? "Delete " + n : "Delete"))));
    };
    sheetEl.hidden = false;
    document.body.classList.add("cx-previewing");
    draw();
  }
  function closeSheet() { sheetEl.hidden = true; sheetEl.replaceChildren(); if (!ui.preview) document.body.classList.remove("cx-previewing"); }
  // Messages older than the chosen days move to Archived (with Undo).
  async function autoArchive() {
    const days = autoDays();
    if (!days) return;
    const old = api.items().filter((n) => !n.archivedAt && Date.now() - n.createdAt > days * 864e5);
    if (old.length) await api.archive(old, true, { auto: true });
  }

  // ---------- Messages ----------
  function bubble(n) {
    const picked = ui.picked.has(n.id);
    // Only messages that just arrived slide in; redraws stay still.
    const fresh = render.done && !seen.has(n.id);
    seen.add(n.id);
    const b = h("div", { class: "cx-msg" + (picked ? " picked" : "") + (fresh ? " cx-in" : ""), "data-id": n.id, role: "button", tabindex: "0" });
    const photos = n.images || [];
    if (photos.length === 1) b.append(h("img", { class: "cx-photo", src: photos[0], alt: "", loading: "lazy" }));
    else if (photos.length > 1) {
      // An album: up to four in a grid, "+3" on the last when there are more.
      b.append(h("div", { class: "cx-album" + (photos.length === 2 ? " two" : photos.length === 3 ? " three" : "") }, photos.slice(0, 4).map((p, i) => h("div", { class: "cx-album-cell" },
        h("img", { src: p, alt: "", loading: "lazy" }), i === 3 && photos.length > 4 ? h("span", { class: "cx-album-more" }, "+" + (photos.length - 4)) : null))));
    }
    for (const f of n.files || []) {
      const media = api.addon("media") && /^(audio|video)\//.test(f.type) ? player(f) : null;
      if (media) { b.append(media); continue; }
      const isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
      b.append(h("div", { class: "cx-file" + (isPdf ? " pdf" : ""), "data-file": f.name }, isPdf && api.pdfThumb ? api.pdfThumb(f) : ic("file"),
        h("span", null, h("b", null, f.name), h("small", null, kindName(f) + (f.size ? " · " + sizeOf(f.size) : ""))),
        h("button", { class: "btn gp-small", "aria-label": "Open " + f.name, onclick: (e) => { e.stopPropagation(); api.openFile(f); } }, "Open")));
    }
    const X = window.CPExtras;
    if (X && n.contact) b.append(h("div", { class: "cx-card cx-contact" }, ic("user"), h("span", null, h("b", null, n.contact.name || "Contact"), h("small", null, n.contact.phone || "")),
      n.contact.phone ? h("a", { class: "btn gp-small", href: X.telUrl(n.contact.phone), onclick: (e) => e.stopPropagation() }, "Call") : null,
      n.contact.phone ? h("a", { class: "btn gp-small", href: X.waUrl(n.contact.phone), target: "_blank", rel: "noopener noreferrer", onclick: (e) => e.stopPropagation() }, "WhatsApp") : null));
    if (X && n.pin && n.capture && n.capture.location) b.append(h("div", { class: "cx-card cx-pin" }, ic("map-pin"), h("span", null, h("b", null, "Location"), h("small", null, n.capture.location.lat.toFixed(5) + ", " + n.capture.location.lng.toFixed(5))),
      h("a", { class: "btn gp-small", href: X.mapsUrl(n.capture.location.lat, n.capture.location.lng), target: "_blank", rel: "noopener noreferrer", onclick: (e) => e.stopPropagation() }, "Open in Maps")));
    const link = X ? X.firstLink([n.title, n.content].join(" ")) : null;
    // A file's name is its title; don't say it twice.
    const text = [n.title, n.content].filter((x) => x && x.trim() && !(n.files || []).some((f) => f.name === x.trim())).join("\n");
    if (text && !n.contact) b.append(h("div", { class: "cx-text" }, text));
    if (link) b.append(h("a", { class: "cx-card cx-link", href: link, target: "_blank", rel: "noopener noreferrer", onclick: (e) => e.stopPropagation() }, ic("link"), h("span", null, h("b", null, X.hostOf(link)), h("small", null, link))));
    const meta = [];
    // The photo guess helps only until you've written what it is.
    if (n.suggest && (n.suggest.confirmed || !(n.title || n.content || "").trim())) meta.push(api.describeGuess(n.suggest));
    if (n.capture && n.capture.location && !n.pin) meta.push("\u{1F4CD} " + n.capture.location.lat.toFixed(3) + ", " + n.capture.location.lng.toFixed(3));
    meta.push(timeOf((n.capture && n.capture.at) || n.createdAt));
    b.append(h("div", { class: "cx-meta" }, meta.join(" · ")));
    // Where it probably goes: one tap files it (Smart sorting: Suggest).
    if (!ui.selecting && !n.archivedAt && api.understand && api.smart && api.smart() !== "off") {
      const d = guessFor(n);
      // The suggestion says why, in plain words; "Not this" teaches Stash.
      if (d) b.append(h("div", { class: "cx-sugg" },
        h("button", { class: "cx-guess", "data-guess": d.label, "aria-label": "File in " + d.label, onclick: (e) => { e.stopPropagation(); api.fileInto([n], [d]); } }, ic("layers"), "→ " + d.label),
        h("small", { class: "cx-why" }, whyText(d),
          h("button", { class: "cx-not", type: "button", onclick: (e) => { e.stopPropagation(); notThis(n, d); } }, "Not this"))));
    }
    if (ui.selecting) b.prepend(h("span", { class: "cx-check" + (picked ? " on" : "") }, picked ? ic("check") : null));
    // Tap: open it (or pick it while selecting). Hold: start selecting.
    let timer = null, held = false;
    b.addEventListener("pointerdown", () => { held = false; timer = setTimeout(() => { held = true; if (!ui.selecting) setSelecting(true); toggle(n.id); }, 450); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => clearTimeout(timer)));
    b.addEventListener("click", () => {
      if (held) { held = false; return; }
      if (ui.selecting) toggle(n.id);
      else api.open(n.id);
    });
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    // Swipe right to move it into a collection.
    let sx = null, sy = 0;
    b.addEventListener("touchstart", (e) => { if (ui.selecting) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    b.addEventListener("touchmove", (e) => {
      if (sx == null) return;
      const dx = e.touches[0].clientX - sx, dy = Math.abs(e.touches[0].clientY - sy);
      if (dy > 30) { sx = null; b.style.transform = ""; return; }
      if (dx > 0) { clearTimeout(timer); b.style.transform = "translateX(" + Math.min(dx, 90) + "px)"; b.classList.toggle("cx-swipe-ready", dx > 70); }
    }, { passive: true });
    b.addEventListener("touchend", (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx;
      sx = null; b.style.transform = ""; b.classList.remove("cx-swipe-ready");
      if (dx > 70) { held = true; api.forward([n], () => render()); }
    });
    return b;
  }
  // Audio and video play right in the message, with a speed button.
  function player(f) {
    const isVideo = /^video\//.test(f.type);
    const el = h(isVideo ? "video" : "audio", { class: isVideo ? "cx-video" : "cx-audio", controls: true, preload: "metadata", playsinline: true, src: f.data });
    const speeds = [1, 1.5, 2];
    const speed = h("button", { class: "cx-speed", type: "button", "aria-label": "Playback speed", onclick: (e) => {
      e.stopPropagation();
      const next = speeds[(speeds.indexOf(el.playbackRate) + 1) % speeds.length] || 1;
      el.playbackRate = next;
      speed.textContent = next + "×";
    } }, "1×");
    const wrap = h("div", { class: "cx-media", "data-file": f.name, onclick: (e) => e.stopPropagation() }, el,
      h("div", { class: "cx-media-row" }, h("small", null, f.name + " · " + sizeOf(f.size)), speed));
    ["pointerdown", "touchstart"].forEach((ev) => wrap.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
    return wrap;
  }
  const guessCache = new Map();
  function guessFor(n) {
    const k = n.id + ":" + n.updatedAt;
    if (!guessCache.has(k)) {
      const B = window.CPBrain;
      const d = api.understand(n).dests.find((x) => !(B && B.skipped && B.skipped(n.id, x)));
      guessCache.set(k, d && (d.score >= 25 || (n.pick && n.pick.dest.length)) ? d : null);
    }
    return guessCache.get(k);
  }
  // "Because it mentions Nimrah Cafe and you filed things like it there before."
  function whyText(d) {
    const w = (d.why || []).filter(Boolean).slice(0, 2);
    return w.length ? "Because " + w.join(" and ") + ". " : "";
  }
  function notThis(n, d) {
    const B = window.CPBrain;
    if (B && B.forget) B.forget([n.title, n.content].join(" "), d, n.id);
    guessCache.clear();
    render();
    api.toast("Got it. Stash won't suggest " + d.label + " for this.");
  }
  function toggle(id) {
    if (ui.picked.has(id)) ui.picked.delete(id); else ui.picked.add(id);
    render();
  }
  function setSelecting(on) {
    ui.selecting = on;
    if (!on) ui.picked.clear();
    document.getElementById("cx-select").textContent = on ? "Cancel" : "Select";
    render();
  }
  function renderSelBar() {
    selBar.hidden = !ui.selecting;
    barEl.hidden = ui.selecting;
    if (!ui.selecting) return;
    const n = ui.picked.size;
    const list = () => api.items().filter((x) => ui.picked.has(x.id));
    selBar.replaceChildren(
      h("span", { class: "cx-count" }, n ? n + " selected" : "Tap messages to pick them"),
      h("button", { class: "btn ghost gp-small", id: "cx-all", onclick: () => { const vis = api.items().filter(passes); if (vis.every((x) => ui.picked.has(x.id))) ui.picked.clear(); else vis.forEach((x) => ui.picked.add(x.id)); render(); } }, "All"),
      h("button", { class: "btn ghost gp-small", id: "cx-archive", disabled: !n, onclick: async () => { const l = list(); const on = ui.filter !== "archived"; await api.archive(l, on); setSelecting(false); } }, ic("archive"), ui.filter === "archived" ? "Unarchive" : "Archive"),
      n === 1 ? h("button", { class: "btn ghost gp-small", id: "cx-edit", onclick: () => { const id = [...ui.picked][0]; setSelecting(false); openCaption(id); } }, "Edit caption") : null,
      h("button", { class: "btn danger ghost gp-small", id: "cx-delete", disabled: !n, onclick: async () => { await api.remove(list()); setSelecting(false); } }, ic("trash"), "Delete"),
      api.understand ? h("button", { class: "btn gp-small", id: "cx-sort", disabled: !n, onclick: () => openSort(list()) }, ic("sparkle"), "Sort") : null,
      h("button", { class: "btn primary", id: "cx-forward", disabled: !n, onclick: () => api.forward(list(), () => setSelecting(false)) }, ic("forward"), "Move to…"));
  }
  function render() {
    if (!pane) return;
    renderSelBar();
    renderFilters();
    const all = api.items();
    const items = all.filter(passes);
    for (const id of [...ui.picked]) if (!items.some((x) => x.id === id)) ui.picked.delete(id);
    const atBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 80;
    bodyEl.replaceChildren();
    if (!items.length && (all.some((n) => !n.archivedAt) || ui.filter !== "all" || ui.q)) {
      bodyEl.append(h("div", { class: "cx-empty" }, ic("search"), h("b", null, ui.q ? "Nothing matches “" + ui.q + "”" : ui.filter === "archived" ? "Nothing archived" : "Nothing here"),
        h("p", null, ui.filter !== "all" ? "Try All." : "")));
      return;
    }
    if (!items.length) {
      // A first look: one thing to do, one to explore.
      bodyEl.append(h("div", { class: "cx-empty cx-start" }, ic("chat"), h("b", null, "Drop anything here"),
        h("p", null, "A bill, a photo, a thought, a PDF. It's saved at once, with when and where. Sort it later, or let Stash suggest where it goes."),
        h("div", { class: "cx-start-acts" },
          h("button", { class: "btn primary", id: "cx-start-snap", onclick: () => api.camera() }, ic("camera"), "Take a photo"),
          api.tryExample ? h("button", { class: "btn ghost", id: "cx-start-example", onclick: () => api.tryExample() }, ic("sparkle"), "See an example") : null)));
      return;
    }
    // Long chats draw the latest messages; earlier ones come in as you scroll up.
    const key = ui.filter + "\u0001" + (ui.q || "");
    if (key !== paging.key) paging = { key, shown: PAGE };
    const start = Math.max(0, items.length - paging.shown);
    if (start > 0) {
      const earlier = h("button", { class: "list-more cx-earlier", id: "cx-earlier", onclick: () => showEarlier() }, "Show earlier messages (" + start + ")");
      bodyEl.append(earlier);
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting) && earlier.isConnected && render.done) { io.disconnect(); showEarlier(); } }, { root: bodyEl, rootMargin: "300px" });
        setTimeout(() => { if (earlier.isConnected) io.observe(earlier); }, 400);
      }
    }
    let lastDay = "";
    for (const n of items.slice(start)) {
      const day = dayLabel(n.createdAt);
      if (day !== lastDay) { bodyEl.append(h("div", { class: "cx-day" }, h("span", null, day))); lastDay = day; }
      bodyEl.append(bubble(n));
    }
    if (atBottom || !render.done) { bodyEl.scrollTop = bodyEl.scrollHeight; render.done = true; }
  }

  const seen = new Set();
  const PAGE = 120;
  let paging = { key: null, shown: PAGE };
  // More history above, keeping what's on screen where it is.
  function showEarlier() {
    const fromBottom = bodyEl.scrollHeight - bodyEl.scrollTop;
    paging.shown += PAGE;
    render();
    bodyEl.scrollTop = bodyEl.scrollHeight - fromBottom;
  }

  // ---------- Open / close ----------
  async function open() {
    if (!ui.open) { await api.onEnter(); await autoArchive(); guessCache.clear(); }
    ui.open = true;
    pane.hidden = false;
    document.body.classList.add("chat-mode");
    render.done = false;
    render();
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }
  function close() {
    if (!ui.open) return;
    ui.open = false;
    pane.hidden = true;
    document.body.classList.remove("chat-mode");
    toggleMenu(false);
    closePreview();
    captionMode(null);
    if (ui.selecting) setSelecting(false);
    api.onExit();
  }
  // Back: the + menu, then selecting, then leave.
  function stepBack() {
    if (ui.preview) { closePreview(); return true; }
    if (!sheetEl.hidden) { closeSheet(); return true; }
    if (ui.searching) { toggleSearch(false); return true; }
    if (ui.sug) { closeSug(); return true; }
    if (ui.captionFor) { captionMode(null); return true; }
    if (ui.menu) { toggleMenu(false); return true; }
    if (ui.selecting) { setSelecting(false); return true; }
    if (!ui.open) return false;
    close();
    return true;
  }

  function init(appApi) {
    api = appApi;
    build();
    return { open, close, stepBack, render, isOpen: () => ui.open, focus: () => input && input.focus(), caption: openCaption, preview: openPreview };
  }
  window.CPChat = { init };
})();
