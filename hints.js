// Stash hints: a label for every icon button and a peek at notes.
// window.CPHints
//
// Computers: resting the mouse on an icon-only button shows its name
// (also when it gets keyboard focus). Phones: pressing and holding one shows
// its name instead of pressing it. Resting on a note or entry shows a small
// preview card; apps register what to show with CPHints.preview(selector, fn).
(function () {
  "use strict";

  const TIP_DELAY = 450, PEEK_DELAY = 650, HOLD = 450;
  const BUTTONS = "button, [role='button'], a.btn, .icon-btn";
  let tip = null, peek = null, tipTimer = 0, peekTimer = 0, tipFor = null, peekFor = null;
  const peekers = []; // { selector, build(el) → { title, text, img } | null }

  // The words for a button: data-tip, aria-label or title. Buttons whose own
  // text already says it don't need one. On mouse hover, a button with a
  // title gets the browser's own tooltip instead (so it never shows twice).
  function labelOf(el, { hover = false } = {}) {
    if (!el || el.disabled) return "";
    if (hover && el.title) return "";
    const label = el.dataset.tip || el.title || el.getAttribute("aria-label") || "";
    if (!label) return "";
    // Visible words only: in the icon-only sidebar the hidden labels don't count.
    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (text && !el.dataset.tip) return "";
    return label;
  }

  function place(box, target, gap = 8) {
    const r = target.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = r.bottom + gap;
    if (top + b.height > vh - 6) top = r.top - b.height - gap;
    let left = r.left + r.width / 2 - b.width / 2;
    left = Math.max(6, Math.min(vw - b.width - 6, left));
    box.style.top = Math.max(6, top) + "px";
    box.style.left = left + "px";
  }

  function showTip(el, label) {
    hideTip();
    tip = document.createElement("div");
    tip.className = "cp-tip";
    tip.id = "cp-tip";
    tip.setAttribute("role", "tooltip");
    tip.textContent = label;
    document.body.append(tip);
    place(tip, el, 6);
    tipFor = el;
  }
  function hideTip() { clearTimeout(tipTimer); if (tip) tip.remove(); tip = null; tipFor = null; }

  function showPeek(el, data) {
    hidePeek();
    peek = document.createElement("div");
    peek.className = "cp-peek";
    peek.id = "cp-peek";
    peek.setAttribute("aria-hidden", "true");
    if (data.img) { const i = document.createElement("img"); i.src = data.img; i.alt = ""; peek.append(i); }
    if (data.title) { const b = document.createElement("b"); b.textContent = data.title; peek.append(b); }
    if (data.text) { const p = document.createElement("p"); p.textContent = data.text.length > 420 ? data.text.slice(0, 420) + "…" : data.text; peek.append(p); }
    if (data.meta) { const s = document.createElement("small"); s.textContent = data.meta; peek.append(s); }
    document.body.append(peek);
    // Beside the row when there's room, otherwise below it.
    const r = el.getBoundingClientRect(), b = peek.getBoundingClientRect();
    if (r.right + b.width + 12 < window.innerWidth) {
      peek.style.left = r.right + 10 + "px";
      peek.style.top = Math.max(6, Math.min(window.innerHeight - b.height - 6, r.top)) + "px";
    } else place(peek, el);
    peekFor = el;
  }
  function hidePeek() { clearTimeout(peekTimer); if (peek) peek.remove(); peek = null; peekFor = null; }
  const hideAll = () => { hideTip(); hidePeek(); };

  const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // ---------- Mouse ----------
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !finePointer()) return;
    const btn = e.target.closest && e.target.closest(BUTTONS);
    if (btn && btn !== tipFor) {
      const label = labelOf(btn, { hover: true });
      clearTimeout(tipTimer);
      if (label) tipTimer = setTimeout(() => { if (btn.isConnected && btn.matches(":hover")) showTip(btn, label); }, tip ? 60 : TIP_DELAY);
      else hideTip();
    }
    for (const p of peekers) {
      const row = e.target.closest && e.target.closest(p.selector);
      if (!row || row === peekFor) continue;
      if (btn && row.contains(btn) && btn !== row) break; // a button inside the row: its tip, not the peek
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => {
        if (!row.isConnected || !row.matches(":hover") || document.querySelector(".context-menu, .popover")) return;
        let data = null;
        try { data = p.build(row); } catch {}
        if (data && (data.text || data.img)) showPeek(row, data);
      }, PEEK_DELAY);
      break;
    }
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const to = e.relatedTarget;
    if (tipFor && (!to || !tipFor.contains(to))) hideTip();
    if (peekFor && (!to || !peekFor.contains(to))) hidePeek();
    if (!to) clearTimeout(peekTimer);
  });
  // Keyboard focus shows the name too.
  document.addEventListener("focusin", (e) => {
    const btn = e.target.closest && e.target.closest(BUTTONS);
    if (!btn || !finePointer()) return;
    let visible = false;
    try { visible = btn.matches(":focus-visible"); } catch {}
    if (!visible) return;
    const label = labelOf(btn);
    if (label) showTip(btn, label);
  });
  document.addEventListener("focusout", () => { if (tipFor && !tipFor.matches(":hover")) hideTip(); });
  for (const ev of ["pointerdown", "keydown", "wheel"]) document.addEventListener(ev, (e) => { if (ev === "keydown" && e.key === "Tab") { hidePeek(); return; } hideAll(); }, true);
  window.addEventListener("scroll", hideAll, true);
  window.addEventListener("blur", hideAll);

  // ---------- Touch: press and hold an icon button for its name ----------
  let hold = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const btn = e.target.closest && e.target.closest(BUTTONS);
    if (!btn) return;
    const label = labelOf(btn);
    if (!label) return;
    const x = e.clientX, y = e.clientY;
    hold = { btn, x, y, shown: false, timer: setTimeout(() => {
      if (!hold || hold.btn !== btn) return;
      hold.shown = true;
      showTip(btn, label);
      if (navigator.vibrate) try { navigator.vibrate(8); } catch {}
    }, HOLD) };
  }, true);
  const endHold = (e) => {
    if (!hold) return;
    clearTimeout(hold.timer);
    if (e && e.type === "pointermove" && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) < 10) return;
    if (hold.shown) {
      const btn = hold.btn;
      setTimeout(() => { if (tipFor === btn) hideTip(); }, 1400);
      // Holding only shows the name; it doesn't press the button.
      const stop = (ev) => { if (ev.target.closest && ev.target.closest(BUTTONS) === btn) { ev.preventDefault(); ev.stopPropagation(); } };
      document.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", stop, true), 600);
    }
    hold = null;
  };
  document.addEventListener("pointerup", endHold, true);
  document.addEventListener("pointercancel", endHold, true);
  document.addEventListener("pointermove", (e) => { if (hold && e.pointerType === "touch") endHold(e); }, true);
  document.addEventListener("contextmenu", (e) => { if (hold && hold.btn.contains(e.target)) e.preventDefault(); }, true);

  window.CPHints = {
    preview(selector, build) { peekers.push({ selector, build }); },
    hide: hideAll,
    labelOf
  };
})();
