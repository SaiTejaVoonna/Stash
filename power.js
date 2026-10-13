// Stash power tools and small surprises. window.CPSlash, window.CPEggs
//
// "/" commands: off unless you turn them on (Settings → Shortcuts). Type "/" in
// a note (or the Inbox box) and a short menu offers tags, folders, tick boxes,
// today's date and more. Nothing changes for anyone who leaves it off.
//
// Eggs: a few quiet surprises for people who poke around. They never get in
// the way, never cost anything, and respect "reduce motion".
(function () {
  "use strict";

  // ---------- "/" commands ----------
  const KEY = "copypaster-slash";
  const on = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
  const set = (v) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {} };
  const fold = (s) => String(s || "").toLowerCase();

  let menu = null, state = null;
  function close() { if (menu) menu.remove(); menu = null; state = null; }

  // The "/word" just before the caret, if it starts a line or follows a space.
  function queryAt(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const pos = el.selectionStart;
      if (pos !== el.selectionEnd) return null;
      const before = el.value.slice(0, pos);
      const m = before.match(/(^|\s)\/([\w-]{0,20})$/);
      return m ? { q: m[2], start: pos - m[2].length - 1, end: pos } : null;
    }
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3 || !el.contains(node)) return null;
    const before = node.nodeValue.slice(0, sel.anchorOffset);
    const m = before.match(/(^|[\s ])\/([\w-]{0,20})$/);
    return m ? { q: m[2], node, start: sel.anchorOffset - m[2].length - 1, end: sel.anchorOffset } : null;
  }
  function caretRect(el, hit) {
    if (hit.node) { const r = document.createRange(); r.setStart(hit.node, hit.start); r.setEnd(hit.node, hit.end); const b = r.getBoundingClientRect(); if (b.width || b.height) return b; }
    const b = el.getBoundingClientRect();
    return { left: b.left + 12, bottom: Math.min(b.bottom, b.top + 40), top: b.top };
  }
  // Takes the "/word" out of the text before a command runs.
  function eat(el, hit) {
    if (hit.node) {
      const r = document.createRange();
      r.setStart(hit.node, hit.start); r.setEnd(hit.node, hit.end);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.execCommand("delete");
    } else {
      el.setSelectionRange(hit.start, hit.end);
      if (!document.execCommand("delete")) { el.setRangeText("", hit.start, hit.end, "end"); }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function draw(el, hit, cmds) {
    const list = cmds.filter((c) => !hit.q || fold(c.key).startsWith(fold(hit.q)) || fold(c.label).includes(fold(hit.q)) || (c.also || []).some((a) => a.startsWith(fold(hit.q))));
    if (!list.length) { close(); return; }
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "popover slash-menu";
      menu.id = "slash-menu";
      menu.setAttribute("role", "listbox");
      menu.addEventListener("mousedown", (e) => e.preventDefault());
      document.body.appendChild(menu);
    }
    state = { el, hit, list, i: Math.min(state && state.el === el ? state.i : 0, list.length - 1) };
    menu.replaceChildren();
    list.slice(0, 9).forEach((c, i) => {
      const b = document.createElement("div");
      b.className = "popover-list-item slash-item" + (i === state.i ? " active" : "");
      b.setAttribute("role", "option");
      b.dataset.cmd = c.key;
      const k = document.createElement("span"); k.className = "slash-key"; k.textContent = "/" + c.key;
      const l = document.createElement("span"); l.className = "slash-label"; l.textContent = c.label;
      b.append(k, l);
      b.addEventListener("click", () => pick(i));
      menu.appendChild(b);
    });
    const r = caretRect(el, hit);
    const h = Math.min(9, list.length) * 34 + 12;
    const below = r.bottom + 6 + h < innerHeight;
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - 250)) + "px";
    menu.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
  }
  function pick(i) {
    if (!state) return;
    const { el, hit, list } = state;
    const c = list[i];
    close();
    if (!c) return;
    eat(el, hit);
    try { c.run(el); } catch (err) { console.error("Slash command failed:", err); }
  }
  // el: a textarea, input or contenteditable. cmds(): [{ key, label, also: [], run(el) }]
  function attach(el, cmds) {
    if (!el || el._slash) return;
    el._slash = true;
    el.addEventListener("input", () => {
      if (!on()) return;
      const hit = queryAt(el);
      if (!hit) { if (state && state.el === el) close(); return; }
      draw(el, hit, cmds());
    });
    el.addEventListener("keydown", (e) => {
      if (!state || state.el !== el) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); state.i = (state.i + (e.key === "ArrowDown" ? 1 : -1) + Math.min(9, state.list.length)) % Math.min(9, state.list.length); draw(el, state.hit, cmds()); }
      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); pick(state.i); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }, true);
    el.addEventListener("blur", () => setTimeout(() => { if (state && state.el === el && document.activeElement !== el) close(); }, 150));
  }
  // Inserts text at the caret, through the browser's own editing (so Undo works).
  function insert(el, text) {
    el.focus();
    if (!document.execCommand("insertText", false, text) && el.setRangeText) { el.setRangeText(text, el.selectionStart, el.selectionEnd, "end"); el.dispatchEvent(new Event("input", { bubbles: true })); }
  }
  const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  window.CPSlash = { on, set, attach, close, insert, today, now };

  // ---------- Small surprises ----------
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A burst of little coloured pieces from a point (or the middle of the screen).
  function confetti(x = innerWidth / 2, y = innerHeight / 3) {
    if (reduced()) return;
    const colors = ["#27d5ff", "#7b61ff", "#ff5db8", "#ffb36b", "#30d158"];
    const box = document.createElement("div");
    box.className = "cp-confetti";
    box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("i");
      const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 160;
      p.style.cssText = "left:" + x + "px;top:" + y + "px;background:" + colors[i % colors.length] + ";--dx:" + Math.cos(a) * d + "px;--dy:" + (Math.sin(a) * d - 60) + "px;--r:" + Math.round(Math.random() * 720 - 360) + "deg;animation-delay:" + Math.random() * 80 + "ms";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1600);
  }
  // Calls found() after the classic ↑↑↓↓←→←→BA on a keyboard.
  function konami(found) {
    const seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let i = 0;
    window.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) { i = 0; return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      i = k === seq[i] ? i + 1 : k === seq[0] ? 1 : 0;
      if (i === seq.length) { i = 0; found(); }
    });
  }
  // Taps in quick succession on an element (the logo): n taps within ~2 s.
  function taps(el, n, found) {
    if (!el) return;
    let times = [];
    el.addEventListener("click", () => {
      const t = Date.now();
      times = times.filter((x) => t - x < 2200).concat(t);
      if (times.length >= n) { times = []; found(); }
    });
  }
  // A list doing one slow barrel roll.
  function roll(el) {
    if (!el || reduced()) return;
    el.classList.remove("cp-roll"); void el.offsetWidth; el.classList.add("cp-roll");
    setTimeout(() => el.classList.remove("cp-roll"), 1300);
  }

  window.CPEggs = { confetti, konami, taps, roll };
})();
