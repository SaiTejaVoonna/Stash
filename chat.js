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
  let pane, bodyEl, barEl, selBar, input, plusMenu, previewEl, capBar;
  const ui = { open: false, selecting: false, picked: new Set(), menu: false, preview: null, captionFor: null };

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
    pane = h("section", { id: "chat-pane", hidden: true, "aria-label": "Me" });
    const head = h("div", { class: "cx-head" },
      h("button", { class: "btn icon ghost cx-menu", "aria-label": "Menu", onclick: () => api.openSidebarDrawer() }, ic("menu", "icon-lg")),
      h("div", { class: "cx-title" }, h("b", null, "Me"), h("small", null, "Drop anything. Sort it later.")),
      h("button", { class: "btn gp-small cx-select", id: "cx-select", onclick: () => setSelecting(!ui.selecting) }, "Select"));
    bodyEl = h("div", { class: "cx-body", id: "cx-body" });
    selBar = h("div", { class: "cx-selbar", id: "cx-selbar", hidden: true });
    plusMenu = h("div", { class: "cx-plus-menu", id: "cx-plus-menu", hidden: true, role: "menu" },
      h("button", { role: "menuitem", id: "cx-camera", onclick: () => { toggleMenu(false); api.camera(); } }, ic("camera"), h("span", null, "Camera", h("small", null, "Take a photo now"))),
      h("button", { role: "menuitem", id: "cx-gallery", onclick: () => { toggleMenu(false); pick("image/*", "library"); } }, ic("image"), h("span", null, "Gallery", h("small", null, "Photos you already have"))),
      h("button", { role: "menuitem", id: "cx-files", onclick: () => { toggleMenu(false); pick("", "file"); } }, ic("file"), h("span", null, "Files", h("small", null, "PDFs, documents, anything up to 10 MB"))));
    input = h("textarea", { id: "cx-input", rows: "1", placeholder: "Message yourself…", "aria-label": "Message",
      oninput: () => grow(),
      onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); sendText(); } } });
    barEl = h("div", { class: "cx-bar" },
      h("button", { class: "gp-round plus", id: "cx-plus", "aria-label": "Add photo or file", onclick: () => toggleMenu(!ui.menu) }, ic("plus")),
      h("div", { class: "cx-box" }, input,
        h("button", { class: "gp-round", id: "cx-snap", "aria-label": "Camera", title: "Camera", onclick: () => api.camera() }, ic("camera"))),
      h("button", { class: "gp-round send", id: "cx-send", "aria-label": "Send", onclick: sendText }, ic("send")));
    previewEl = h("div", { class: "cx-preview", id: "cx-preview", hidden: true, role: "dialog", "aria-label": "Add a caption" });
    capBar = h("div", { class: "cx-capbar", id: "cx-capbar", hidden: true });
    pane.append(head, bodyEl, plusMenu, selBar, capBar, barEl, previewEl);
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
  function toggleMenu(on) { ui.menu = on; plusMenu.hidden = !on; document.getElementById("cx-plus").classList.toggle("on", on); }
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
    await api.addText(text);
    render();
    input.focus();
  }

  // ---------- Caption: look before you send, like WhatsApp ----------
  // New photos and files: shown first, with a caption box. Send saves them as one
  // message (several photos become an album). A snap is saved the moment it's
  // taken; this then only adds its caption.
  const HD_KEY = "copypaster-hd";
  const hdOn = () => { try { return localStorage.getItem(HD_KEY) !== "0"; } catch { return true; } };
  const isPhoto = (f) => /^image\//.test(f.type) && f.type !== "image/svg+xml";
  function openPreview(files, origin) {
    if (!files.length) return;
    toggleMenu(false);
    ui.preview = { mode: "new", files: files.slice(0, 10), origin, at: 0, caption: "", urls: new Map() };
    document.body.classList.add("cx-previewing");
    if (files.length > 10) api.toast("Up to 10 at a time; the first 10 are here");
    renderPreview(true);
  }
  // After a snap: the box below becomes its caption (a small bar shows which photo).
  function captionMode(id) {
    ui.captionFor = id;
    const n = id && api.items().find((x) => x.id === id);
    capBar.hidden = !n;
    input.placeholder = n ? "Add a caption to this photo…" : "Message yourself…";
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
      : h("div", { class: "cx-pv-filebig" }, ic("file"), h("b", null, cur.name), h("small", null, ((cur.type.split("/")[1] || "file").toUpperCase()) + (cur.size ? " · " + sizeOf(cur.size) : "")));
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

  // ---------- Messages ----------
  function bubble(n) {
    const picked = ui.picked.has(n.id);
    const b = h("div", { class: "cx-msg" + (picked ? " picked" : ""), "data-id": n.id, role: "button", tabindex: "0" });
    const photos = n.images || [];
    if (photos.length === 1) b.append(h("img", { class: "cx-photo", src: photos[0], alt: "", loading: "lazy" }));
    else if (photos.length > 1) {
      // An album: up to four in a grid, "+3" on the last when there are more.
      b.append(h("div", { class: "cx-album" + (photos.length === 2 ? " two" : photos.length === 3 ? " three" : "") }, photos.slice(0, 4).map((p, i) => h("div", { class: "cx-album-cell" },
        h("img", { src: p, alt: "", loading: "lazy" }), i === 3 && photos.length > 4 ? h("span", { class: "cx-album-more" }, "+" + (photos.length - 4)) : null))));
    }
    for (const f of n.files || []) b.append(h("div", { class: "cx-file" }, ic("file"), h("span", null, h("b", null, f.name), h("small", null, (f.type.split("/")[1] || "file").toUpperCase() + " · " + sizeOf(f.size))),
      h("button", { class: "btn gp-small", "aria-label": "Open " + f.name, onclick: (e) => { e.stopPropagation(); api.openFile(f); } }, "Open")));
    // A file's name is its title; don't say it twice.
    const text = [n.title, n.content].filter((x) => x && x.trim() && !(n.files || []).some((f) => f.name === x.trim())).join("\n");
    if (text) b.append(h("div", { class: "cx-text" }, text));
    const meta = [];
    if (n.suggest) meta.push(api.describeGuess(n.suggest));
    if (n.capture && n.capture.location) meta.push("\u{1F4CD} " + n.capture.location.lat.toFixed(3) + ", " + n.capture.location.lng.toFixed(3));
    meta.push(timeOf((n.capture && n.capture.at) || n.createdAt));
    b.append(h("div", { class: "cx-meta" }, meta.join(" · ")));
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
    return b;
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
      n === 1 ? h("button", { class: "btn ghost gp-small", id: "cx-edit", onclick: () => { const id = [...ui.picked][0]; setSelecting(false); openCaption(id); } }, "Edit caption") : null,
      h("button", { class: "btn danger ghost gp-small", id: "cx-delete", disabled: !n, onclick: async () => { await api.remove(list()); setSelecting(false); } }, ic("trash"), "Delete"),
      h("button", { class: "btn primary", id: "cx-forward", disabled: !n, onclick: () => api.forward(list(), () => setSelecting(false)) }, ic("forward"), "Forward"));
  }
  function render() {
    if (!pane) return;
    renderSelBar();
    const items = api.items();
    for (const id of [...ui.picked]) if (!items.some((x) => x.id === id)) ui.picked.delete(id);
    const atBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 80;
    bodyEl.replaceChildren();
    if (!items.length) {
      bodyEl.append(h("div", { class: "cx-empty" }, ic("chat"), h("b", null, "Your own chat"),
        h("p", null, "Drop a thought, a photo, a bill or a PDF here, like messaging yourself. It's saved at once with when and where. Later, select messages and Forward them into a space."),
        h("p", { class: "cx-tip" }, "Tip: write @name (like @fzv3) and Forward picks that page for you.")));
      return;
    }
    let lastDay = "";
    for (const n of items) {
      const day = dayLabel(n.createdAt);
      if (day !== lastDay) { bodyEl.append(h("div", { class: "cx-day" }, h("span", null, day))); lastDay = day; }
      bodyEl.append(bubble(n));
    }
    if (atBottom || !render.done) { bodyEl.scrollTop = bodyEl.scrollHeight; render.done = true; }
  }

  // ---------- Open / close ----------
  async function open() {
    if (!ui.open) await api.onEnter();
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
