// Stash sketch pad: pens, a highlighter, shapes that snap neat, lasso, text,
// zoom, paper styles, stylus pressure. window.CPSketch
//
// Everything drawn is kept as strokes (points from 0 to 1 across the page), so
// undo, moving a selection, zoom and the eraser just redraw them. Done turns
// the page into one image. Nothing here leaves the device.
(function () {
  "use strict";

  const INKS = ["#17181c", "#e5352b", "#0a6cff", "#12a150", "#f59e0b", "#8b5cf6", "#ec4899", "#ffffff"];
  const PENS = [
    { key: "pen", label: "Pen", icon: "pen" },
    { key: "pencil", label: "Pencil", icon: "pencil" },
    { key: "marker", label: "Marker", icon: "marker" },
    { key: "highlighter", label: "Highlighter", icon: "highlighter" },
    { key: "calligraphy", label: "Calligraphy", icon: "nib" }
  ];
  const PAPERS = [["plain", "Plain"], ["lined", "Lined"], ["grid", "Grid"], ["dots", "Dots"]];
  const HOLD_MS = 550; // hold still at the end of a stroke to snap it into a shape

  // ---------- Shapes: a rough stroke → a neat line, circle or box ----------
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function recognise(pts, aspect) {
    if (pts.length < 6) return null;
    const P = pts.map(([x, y]) => [x * aspect, y]); // compare in real proportions
    let len = 0;
    for (let i = 1; i < P.length; i++) len += dist(P[i - 1], P[i]);
    const first = P[0], last = P[P.length - 1];
    if (len < 0.03) return null;
    // A line: the ends are almost as far apart as the whole path is long.
    if (dist(first, last) / len > 0.9) return { kind: "line", a: pts[0], b: pts[pts.length - 1] };
    // Closed shapes: the end comes back near the start.
    if (dist(first, last) / len > 0.2) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    if (rx < 0.01 || ry < 0.01) return null;
    // How far each point is from an ellipse in that box: small → a circle.
    let err = 0;
    for (const [x, y] of P) err += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1);
    err /= P.length;
    const box = [x0 / aspect, y0, x1 / aspect, y1];
    return err < 0.12 ? { kind: "ellipse", box } : { kind: "rect", box };
  }
  // A shape as points, so it draws, erases and moves like any stroke.
  function shapePoints(sh) {
    if (sh.kind === "line") return [sh.a, sh.b];
    const [x0, y0, x1, y1] = sh.box;
    if (sh.kind === "rect") return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    const out = [], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    for (let i = 0; i <= 64; i++) { const t = (i / 64) * Math.PI * 2; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
    return out;
  }
  function arrowPoints(a, b, aspect) {
    const ang = Math.atan2(b[1] - a[1], (b[0] - a[0]) * aspect), L = 0.03;
    const p = (da) => [b[0] - (L * Math.cos(ang + da)) / aspect, b[1] - L * Math.sin(ang + da)];
    return [a, b, p(0.5), b, p(-0.5)];
  }

  // ---------- Drawing one stroke ----------
  function drawStroke(c, st, w, hgt) {
    const pts = st.pts;
    if (!pts.length) return;
    c.save();
    if (st.erase) { c.globalCompositeOperation = "destination-out"; c.strokeStyle = "#000"; }
    else c.strokeStyle = st.ink;
    c.lineCap = st.pen === "highlighter" ? "butt" : "round";
    c.lineJoin = "round";
    const base = st.size * (st.erase ? 3 : st.pen === "highlighter" ? 3.2 : st.pen === "marker" ? 1.8 : 1);
    if (st.pen === "highlighter") { c.globalAlpha = 0.32; c.globalCompositeOperation = st.erase ? "destination-out" : "multiply"; }
    if (st.pen === "pencil") c.globalAlpha = 0.72;
    const X = (p) => p[0] * w, Y = (p) => p[1] * hgt;
    // Pressure or calligraphy change the width along the stroke: draw in pieces.
    const varies = st.pen === "calligraphy" || pts.some((p) => p[2] != null && p[2] !== 0.5);
    if (!varies || st.erase || st.pen === "highlighter") {
      c.lineWidth = base;
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(X(p), Y(p)) : c.moveTo(X(p), Y(p))));
      if (pts.length === 1) c.lineTo(X(pts[0]) + 0.01, Y(pts[0]));
      c.stroke();
    } else {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        let k = 1;
        if (b[2] != null) k = 0.35 + b[2] * 1.3;
        if (st.pen === "calligraphy") { const ang = Math.atan2(Y(b) - Y(a), X(b) - X(a)); k *= 0.35 + 1.4 * Math.abs(Math.sin(ang - Math.PI / 4)); }
        c.lineWidth = Math.max(0.6, base * k);
        c.beginPath(); c.moveTo(X(a), Y(a)); c.lineTo(X(b), Y(b)); c.stroke();
      }
    }
    // Pencil: a little grain along the line.
    if (st.pen === "pencil" && !st.erase) {
      c.globalAlpha = 0.25; c.fillStyle = st.ink;
      for (let i = 0; i < pts.length; i += 2) {
        const seed = (i * 9301 + 49297) % 233280 / 233280;
        c.fillRect(X(pts[i]) + (seed - 0.5) * base * 1.6, Y(pts[i]) + (((seed * 7) % 1) - 0.5) * base * 1.6, 1, 1);
      }
    }
    c.restore();
  }
  function drawText(c, t, w, hgt) {
    c.save();
    c.fillStyle = t.ink;
    c.font = "600 " + t.size * hgt + "px -apple-system, system-ui, sans-serif";
    c.textBaseline = "top";
    String(t.text).split("\n").forEach((line, i) => c.fillText(line, t.x * w, t.y * hgt + i * t.size * hgt * 1.25));
    c.restore();
  }
  function textBox(c, t, w, hgt) {
    c.font = "600 " + t.size * hgt + "px -apple-system, system-ui, sans-serif";
    const lines = String(t.text).split("\n");
    const width = Math.max(...lines.map((l) => c.measureText(l).width)) / w;
    return [t.x, t.y, t.x + width, t.y + lines.length * t.size * 1.25];
  }
  function drawPaper(c, paper, w, hgt) {
    if (paper === "plain") return;
    c.save();
    c.strokeStyle = "rgba(60,90,160,.18)"; c.fillStyle = "rgba(60,90,160,.28)"; c.lineWidth = 1;
    const step = Math.max(18, Math.round(Math.min(w, hgt) / 22));
    if (paper === "lined") for (let y = step * 2; y < hgt; y += step) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    if (paper === "grid") {
      for (let y = step; y < hgt; y += step) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      for (let x = step; x < w; x += step) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, hgt); c.stroke(); }
    }
    if (paper === "dots") for (let y = step; y < hgt; y += step) for (let x = step; x < w; x += step) { c.beginPath(); c.arc(x, y, 1.3, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  // Is a point inside a lasso (a polygon of points)?
  function inside(p, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  // ---------- The pad ----------
  // tools: { sheet, h, ic, toast }. opts.background: a photo to draw on.
  // Resolves with an image (data URL), or null.
  function open(tools, opts = {}) {
    const { sheet, h, ic, toast } = tools;
    return new Promise((resolve) => {
      let result = null, cleanup = null;
      sheet(opts.background ? "Draw on photo" : "Sketch", (body, finish) => {
        const items = []; // strokes and text, in order
        const redoStack = [];
        let tool = "pen", pen = "pen", ink = INKS[0], size = 4, paper = opts.background ? "plain" : (localStorage.getItem("copypaster-paper") || "plain");
        let penOnly = false, eraseWhole = false, autoPen = false;
        let view = { s: 1, x: 0, y: 0 }; // zoom and pan
        let bg = null, W = 0, H = 0, dpr = 1;
        let drawing = null, lasso = null, selection = null, dragFrom = null, holdTimer = null, shapeStart = null;
        const pointers = new Map();
        let pinch = null;

        const canvas = h("canvas", { class: "sk-canvas", id: "sk-canvas", "aria-label": "Drawing area" });
        const wrap = h("div", { class: "sk-wrap" }, canvas);
        const textInput = h("textarea", { class: "sk-textbox", id: "sk-text", rows: "1", placeholder: "Type…", hidden: true });
        wrap.append(textInput);

        function render(target, w, hgt, k, withView) {
          const c = target.getContext("2d");
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.fillStyle = "#ffffff"; c.fillRect(0, 0, target.width, target.height);
          const t = withView ? view : { s: 1, x: 0, y: 0 };
          c.setTransform(k * t.s, 0, 0, k * t.s, k * t.x, k * t.y);
          if (bg) c.drawImage(bg, 0, 0, w, hgt);
          drawPaper(c, paper, w, hgt);
          // Ink on its own layer, so the eraser uncovers the photo and paper.
          const layer = document.createElement("canvas");
          layer.width = target.width; layer.height = target.height;
          const lc = layer.getContext("2d");
          lc.setTransform(k * t.s, 0, 0, k * t.s, k * t.x, k * t.y);
          for (const it of items) (it.text != null ? drawText : drawStroke)(lc, it, w, hgt);
          if (withView && lasso) {
            lc.save(); lc.setLineDash([6 / t.s, 5 / t.s]); lc.strokeStyle = "#7B61FF"; lc.lineWidth = 1.5 / t.s;
            lc.beginPath(); lasso.forEach((p, i) => (i ? lc.lineTo(p[0] * w, p[1] * hgt) : lc.moveTo(p[0] * w, p[1] * hgt))); lc.stroke(); lc.restore();
          }
          if (withView && selection && selection.size) {
            const b = selBox();
            lc.save(); lc.setLineDash([6 / t.s, 5 / t.s]); lc.strokeStyle = "#7B61FF"; lc.lineWidth = 1.5 / t.s;
            lc.strokeRect(b[0] * w - 6, b[1] * hgt - 6, (b[2] - b[0]) * w + 12, (b[3] - b[1]) * hgt + 12); lc.restore();
          }
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.drawImage(layer, 0, 0);
        }
        const redraw = () => render(canvas, W, H, dpr, true);
        const fit = () => {
          const r = wrap.getBoundingClientRect();
          dpr = Math.min(3, window.devicePixelRatio || 1);
          W = Math.max(200, Math.floor(r.width));
          H = Math.max(200, Math.floor(r.height));
          if (bg) { const k = Math.min(W / bg.width, H / bg.height); W = Math.round(bg.width * k); H = Math.round(bg.height * k); }
          canvas.style.width = W + "px"; canvas.style.height = H + "px";
          canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
          redraw();
        };
        // Screen → page (0..1), through zoom and pan.
        const point = (e) => {
          const r = canvas.getBoundingClientRect();
          const sx = e.clientX - r.left, sy = e.clientY - r.top;
          const pr = e.pointerType === "pen" && e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : null;
          const p = [(sx - view.x) / view.s / W, (sy - view.y) / view.s / H];
          if (pr != null) p.push(pr);
          return p;
        };
        function bbox(it) {
          if (it.text != null) return textBox(canvas.getContext("2d"), it, W, H);
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const [x, y] of it.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
          return [x0, y0, x1, y1];
        }
        function selBox() {
          let b = [Infinity, Infinity, -Infinity, -Infinity];
          for (const it of selection) { const x = bbox(it); b = [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])]; }
          return b;
        }
        const pushItem = (it) => { items.push(it); redoStack.length = 0; };
        const hitStroke = (p) => {
          const tol = 0.02;
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.erase) continue;
            if (it.text != null) { const b = bbox(it); if (p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]) return i; continue; }
            if (it.pts.some((q) => Math.hypot((q[0] - p[0]) * (W / H), q[1] - p[1]) < tol + it.size / H)) return i;
          }
          return -1;
        };

        // Fingers vs pen: in pen-only mode, a finger pans; two fingers always zoom.
        canvas.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          try { canvas.setPointerCapture(e.pointerId); } catch {}
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.size === 2) {
            // Second finger: stop drawing, start pinching.
            if (drawing) { items.splice(items.indexOf(drawing), 1); drawing = null; }
            const [a, b] = [...pointers.values()];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, view: { ...view } };
            return;
          }
          if (e.pointerType === "pen" && !penOnly && !autoPen) { autoPen = true; setPenOnly(true, true); toast("Stylus found: it draws, fingers move the page. Pen only is at the top."); }
          if (penOnly && e.pointerType === "touch") { dragFrom = { pan: true, x: e.clientX, y: e.clientY, view: { ...view } }; return; }
          const p = point(e);
          if (tool === "text") { startText(p); return; }
          if (tool === "lasso") {
            if (selection && selection.size) {
              const b = selBox();
              if (p[0] >= b[0] - 0.02 && p[0] <= b[2] + 0.02 && p[1] >= b[1] - 0.02 && p[1] <= b[3] + 0.02) { dragFrom = { sel: true, p }; return; }
            }
            selection = null; lasso = [p]; redraw(); sync(); return;
          }
          if (tool === "eraser" && eraseWhole) { const i = hitStroke(p); if (i >= 0) { redoStack.length = 0; items.splice(i, 1); redraw(); sync(); } dragFrom = { erasing: true }; return; }
          if (tool === "shape") { shapeStart = p; drawing = { pen: "pen", ink, size, pts: [p, p] }; pushItem(drawing); redraw(); return; }
          drawing = { pen, ink, size, erase: tool === "eraser", pts: [p] };
          pushItem(drawing);
          redraw(); sync();
        });
        canvas.addEventListener("pointermove", (e) => {
          if (!pointers.has(e.pointerId)) return;
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch && pointers.size >= 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const r = canvas.getBoundingClientRect();
            const s = Math.max(1, Math.min(6, pinch.view.s * d / pinch.d));
            const ox = pinch.mx - r.left, oy = pinch.my - r.top;
            view = { s, x: ox - (ox - pinch.view.x) * (s / pinch.view.s) + (mx - pinch.mx), y: oy - (oy - pinch.view.y) * (s / pinch.view.s) + (my - pinch.my) };
            clampView(); redraw(); return;
          }
          if (dragFrom && dragFrom.pan) { view = { ...dragFrom.view, x: dragFrom.view.x + e.clientX - dragFrom.x, y: dragFrom.view.y + e.clientY - dragFrom.y }; clampView(); redraw(); return; }
          const p = point(e);
          if (dragFrom && dragFrom.erasing) { const i = hitStroke(p); if (i >= 0) { items.splice(i, 1); redraw(); sync(); } return; }
          if (dragFrom && dragFrom.sel) {
            const dx = p[0] - dragFrom.p[0], dy = p[1] - dragFrom.p[1];
            for (const it of selection) { if (it.text != null) { it.x += dx; it.y += dy; } else it.pts = it.pts.map((q) => [q[0] + dx, q[1] + dy, ...q.slice(2)]); }
            dragFrom.p = p; redraw(); return;
          }
          if (lasso) { lasso.push(p); redraw(); return; }
          if (!drawing) return;
          if (tool === "shape") {
            const a = shapeStart;
            drawing.pts = shapeKind === "line" ? [a, p] : shapeKind === "arrow" ? arrowPoints(a, p, W / H)
              : shapePoints({ kind: shapeKind, box: [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[0], p[0]), Math.max(a[1], p[1])] });
            redraw(); return;
          }
          const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
          (evs.length ? evs : [e]).forEach((ev) => drawing.pts.push(point(ev)));
          redraw();
          // Hold still at the end: the stroke snaps into a neat line, circle or box.
          clearTimeout(holdTimer);
          if (!drawing.erase && tool === "pen") {
            const st = drawing;
            holdTimer = setTimeout(() => {
              const sh = recognise(st.pts, W / H);
              if (sh && items.includes(st)) { st.pts = shapePoints(sh); st.snapped = sh.kind; redraw(); if (navigator.vibrate) navigator.vibrate(10); }
            }, HOLD_MS);
          }
        });
        const end = (e) => {
          pointers.delete(e.pointerId);
          if (pointers.size < 2) pinch = null;
          clearTimeout(holdTimer);
          if (lasso) {
            const poly = lasso;
            lasso = null;
            if (poly.length > 4) {
              selection = new Set(items.filter((it) => !it.erase && (it.text != null ? inside([it.x, it.y], poly) : it.pts.filter((q) => inside(q, poly)).length > it.pts.length / 2)));
              if (!selection.size) selection = null;
            }
            redraw(); sync();
          }
          drawing = null; dragFrom = null;
        };
        canvas.addEventListener("pointerup", end);
        canvas.addEventListener("pointercancel", end);
        // Zoom with the wheel / trackpad pinch on computers.
        canvas.addEventListener("wheel", (e) => {
          e.preventDefault();
          const r = canvas.getBoundingClientRect();
          if (e.ctrlKey || e.metaKey) {
            const s = Math.max(1, Math.min(6, view.s * Math.exp(-e.deltaY / 200)));
            const ox = e.clientX - r.left, oy = e.clientY - r.top;
            view = { s, x: ox - (ox - view.x) * (s / view.s), y: oy - (oy - view.y) * (s / view.s) };
          } else view = { ...view, x: view.x - e.deltaX, y: view.y - e.deltaY };
          clampView(); redraw();
        }, { passive: false });
        function clampView() {
          if (view.s <= 1) { view = { s: 1, x: 0, y: 0 }; return; }
          view.x = Math.min(0, Math.max(W - W * view.s, view.x));
          view.y = Math.min(0, Math.max(H - H * view.s, view.y));
        }

        // Text: tap where it goes, type, tap elsewhere (or Done) to place it.
        let editingText = null;
        function startText(p) {
          commitText();
          editingText = { p };
          textInput.hidden = false;
          textInput.value = "";
          textInput.style.left = (p[0] * W * view.s + view.x) + "px";
          textInput.style.top = (p[1] * H * view.s + view.y) + "px";
          textInput.style.color = ink === "#ffffff" ? "#000" : ink;
          textInput.style.fontSize = Math.max(12, size * 4 * view.s) + "px";
          setTimeout(() => textInput.focus(), 20);
        }
        function commitText() {
          if (!editingText) return;
          const text = textInput.value.trim();
          if (text) pushItem({ text, x: editingText.p[0], y: editingText.p[1], ink, size: Math.max(12, size * 4) / H });
          editingText = null;
          textInput.hidden = true;
          redraw(); sync();
        }
        textInput.addEventListener("blur", commitText);
        textInput.addEventListener("keydown", (e) => { if (e.key === "Escape") { textInput.value = ""; commitText(); } });

        // ---------- Toolbar ----------
        let shapeKind = "rect";
        const bar = h("div", { class: "sk-tools", id: "sk-tools" });
        const sub = h("div", { class: "sk-sub", id: "sk-sub" });
        // Pen only (like Apple Notes): the stylus draws, fingers move the page.
        // Turns on by itself the first time a stylus touches the page.
        const penOnlyBtn = h("button", { class: "btn ghost sk-penonly", id: "sk-penonly", "aria-pressed": "false", title: "Pen only: your stylus draws, fingers move the page", onclick: () => setPenOnly(!penOnly) }, ic("pen"), h("span", null, "Pen only"));
        function setPenOnly(v, quiet) {
          penOnly = v;
          penOnlyBtn.classList.toggle("on", v);
          penOnlyBtn.setAttribute("aria-pressed", String(v));
          if (!quiet) toast(v ? "Pen only: fingers move the page" : "Fingers draw again");
        }
        const btn = (key, label, icon, onclick, extra = {}) => h("button", { class: "btn icon ghost sk-tool", "data-tool": key, "aria-label": label, title: label, onclick, ...extra }, ic(icon));
        const undoBtn = btn("undo", "Undo", "undo", () => { if (selection) selection = null; const it = items.pop(); if (it) redoStack.push(it); redraw(); sync(); }, { id: "sk-undo" });
        const redoBtn = btn("redo", "Redo", "redo", () => { const it = redoStack.pop(); if (it) items.push(it); redraw(); sync(); }, { id: "sk-redo" });
        const clearBtn = btn("clear", "Clear all", "trash", () => { if (!items.length || !confirm("Clear the whole drawing?")) return; items.length = 0; redoStack.length = 0; selection = null; redraw(); sync(); });
        function setTool(t) { commitText(); tool = t; if (t !== "lasso") selection = null; redraw(); sync(); }
        function sync() {
          bar.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === (tool === "pen" ? "pen-" + pen : tool)));
          undoBtn.disabled = !items.length;
          redoBtn.disabled = !redoStack.length;
          clearBtn.disabled = !items.length;
          // The second row: what this tool can do.
          const parts = [];
          if (tool === "pen" || tool === "shape" || tool === "text") {
            INKS.forEach((c) => parts.push(h("button", { class: "sk-ink" + (c === ink ? " on" : ""), "data-ink": c, style: "--c:" + c, "aria-label": "Colour " + c, onclick: () => { ink = c; sync(); } })));
            const custom = h("input", { type: "color", class: "sk-custom", id: "sk-custom", "aria-label": "Your own colour", value: INKS.includes(ink) ? "#ff8800" : ink, oninput: (e) => { ink = e.target.value; } , onchange: () => sync() });
            parts.push(h("label", { class: "sk-ink sk-ink-custom" + (!INKS.includes(ink) ? " on" : ""), title: "Your own colour" }, custom));
            parts.push(h("input", { type: "range", class: "sk-range", id: "sk-size", min: "1", max: "30", value: String(size), "aria-label": "Size", oninput: (e) => { size = +e.target.value; } }));
          }
          if (tool === "shape") [["line", "Line"], ["arrow", "Arrow"], ["rect", "Box"], ["ellipse", "Circle"]].forEach(([k, l]) => parts.push(h("button", { class: "gp-mini" + (shapeKind === k ? " active" : ""), "data-shape": k, onclick: () => { shapeKind = k; sync(); } }, l)));
          if (tool === "eraser") [[false, "Rub out"], [true, "Whole stroke"]].forEach(([v, l]) => parts.push(h("button", { class: "gp-mini" + (eraseWhole === v ? " active" : ""), "data-erase": v ? "whole" : "part", onclick: () => { eraseWhole = v; sync(); } }, l)));
          if (tool === "lasso") {
            parts.push(h("span", { class: "sk-hint" }, selection ? selection.size + " selected · drag to move" : "Draw around what to select"));
            if (selection) {
              const scale = (k) => { const b = selBox(), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; for (const it of selection) { if (it.text != null) { it.x = cx + (it.x - cx) * k; it.y = cy + (it.y - cy) * k; it.size *= k; } else { it.pts = it.pts.map((q) => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k, ...q.slice(2)]); it.size *= k; } } redraw(); };
              parts.push(h("button", { class: "gp-mini", id: "sk-bigger", onclick: () => scale(1.15) }, "Bigger"), h("button", { class: "gp-mini", id: "sk-smaller", onclick: () => scale(1 / 1.15) }, "Smaller"),
                h("button", { class: "gp-mini", id: "sk-sel-delete", onclick: () => { for (const it of selection) items.splice(items.indexOf(it), 1); selection = null; redraw(); sync(); } }, "Delete"));
            }
          }
          sub.replaceChildren(...parts);
        }
        PENS.forEach((p) => bar.append(btn("pen-" + p.key, p.label, p.icon, () => { pen = p.key; setTool("pen"); })));
        bar.append(h("span", { class: "sk-sep" }),
          btn("shape", "Shapes", "shapes", () => setTool("shape")),
          btn("text", "Text", "type", () => setTool("text")),
          btn("lasso", "Select", "lasso", () => setTool("lasso")),
          btn("eraser", "Eraser", "eraser", () => setTool("eraser")),
          h("span", { class: "sk-sep" }), penOnlyBtn);
        // Paper and pen-only, tucked in a small menu.
        const more = h("select", { class: "sk-more", id: "sk-paper", "aria-label": "Paper", onchange: (e) => {
          const v = e.target.value;
          if (v === "pen-only") setPenOnly(!penOnly);
          else if (v === "fit") { view = { s: 1, x: 0, y: 0 }; }
          else { paper = v; try { localStorage.setItem("copypaster-paper", v); } catch {} }
          e.target.value = ""; redraw();
        } }, h("option", { value: "" }, "Page…"), ...PAPERS.map(([k, l]) => h("option", { value: k }, "Paper: " + l)), h("option", { value: "fit" }, "Fit to screen"));
        body.append(bar, sub, wrap, h("div", { class: "gp-sheet-actions sk-actions" },
          h("div", { class: "sk-left" }, undoBtn, redoBtn, clearBtn, opts.background ? null : more),
          h("button", { class: "btn", onclick: finish }, "Cancel"),
          h("button", { class: "btn primary", id: "sk-done", onclick: () => {
            commitText();
            if (!items.some((it) => !it.erase)) { toast("Draw something first"); return; }
            selection = null;
            const k = Math.max(1, Math.min(2, 1600 / Math.max(W, H)));
            const out = document.createElement("canvas");
            out.width = Math.round(W * k); out.height = Math.round(H * k);
            render(out, W, H, k, false);
            result = bg ? out.toDataURL("image/jpeg", 0.88) : out.toDataURL("image/png");
            finish();
          } }, "Done")));
        sync();
        const start = () => requestAnimationFrame(fit);
        if (opts.background) { const img = new Image(); img.onload = () => { bg = img; start(); }; img.onerror = start; img.src = opts.background; }
        else start();
        const onResize = () => fit();
        const onKey = (e) => {
          if (e.target === textInput) return;
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? redoBtn : undoBtn).click(); }
        };
        window.addEventListener("resize", onResize);
        document.addEventListener("keydown", onKey);
        cleanup = () => { window.removeEventListener("resize", onResize); document.removeEventListener("keydown", onKey); };
      }, { full: true, sticky: true, cls: "sk-sheet", onClose: () => { if (cleanup) cleanup(); resolve(result); } });
    });
  }

  window.CPSketch = { open, recognise, shapePoints, PENS };
})();
