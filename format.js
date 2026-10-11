// Stash note formatting: a little Markdown, typed or from buttons, shown
// formatted in Preview, and a note shared as an image or printed / saved as
// PDF. window.CPFormat
//
// Notes stay plain text (**bold**, *italic*, # heading, - list, 1. list), so
// they search, sync, copy and back up exactly as before.
(function () {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  // Markdown (the small part people use in notes) → safe HTML.
  function toHtml(md) {
    const out = [];
    let list = null; // "ul" | "ol"
    const close = () => { if (list) { out.push("</" + list + ">"); list = null; } };
    for (const raw of String(md || "").split("\n")) {
      const line = raw.replace(/\s+$/, "");
      let m;
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { close(); out.push("<h" + (m[1].length + 1) + ">" + inline(m[2]) + "</h" + (m[1].length + 1) + ">"); continue; }
      if ((m = line.match(/^\s*[-*•]\s+\[( |x)\]\s+(.*)$/i))) { if (list !== "ul") { close(); out.push('<ul class="fm-tasks">'); list = "ul"; } out.push('<li class="' + (m[1] === " " ? "" : "done") + '">' + inline(m[2]) + "</li>"); continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
      close();
      if ((m = line.match(/^>\s?(.*)$/))) { out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); continue; }
      if (/^(-{3,}|\*{3,})$/.test(line.trim())) { out.push("<hr>"); continue; }
      out.push(line.trim() ? "<p>" + inline(line) + "</p>" : '<p class="fm-gap"></p>');
    }
    close();
    return out.join("");
  }
  // Markdown marks taken out, for list previews and shared images.
  function plain(md) {
    return String(md || "").replace(/^#{1,3}\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1$2").replace(/~~(.+?)~~/g, "$1").replace(/`([^`]+)`/g, "$1");
  }

  // ---------- Editing helpers (on a <textarea>) ----------
  const fire = (ta) => ta.dispatchEvent(new Event("input", { bubbles: true }));
  // **bold** / *italic* around the selection (or the word at the cursor); again to remove.
  function wrap(ta, mark) {
    let a = ta.selectionStart, b = ta.selectionEnd;
    const v = ta.value;
    if (a === b) { while (a > 0 && /\S/.test(v[a - 1])) a--; while (b < v.length && /\S/.test(v[b])) b++; }
    const sel = v.slice(a, b), m = mark.length;
    let next, start, end;
    if (v.slice(a - m, a) === mark && v.slice(b, b + m) === mark) { next = v.slice(0, a - m) + sel + v.slice(b + m); start = a - m; end = b - m; }
    else if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= 2 * m) { next = v.slice(0, a) + sel.slice(m, -m) + v.slice(b); start = a; end = b - 2 * m; }
    else { next = v.slice(0, a) + mark + sel + mark + v.slice(b); start = a + m; end = b + m; }
    ta.value = next;
    ta.focus();
    ta.setSelectionRange(start, end);
    fire(ta);
  }
  // Each selected line: "# ", "- " or "1. " added (or taken off when all have it).
  function lines(ta, kind) {
    const v = ta.value;
    const a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    let b = v.indexOf("\n", ta.selectionEnd); if (b < 0) b = v.length;
    const ls = v.slice(a, b).split("\n");
    const re = { heading: /^#{1,3}\s+/, bullet: /^\s*[-*•]\s+/, number: /^\s*\d+[.)]\s+/ }[kind];
    const all = ls.every((l) => re.test(l) || !l.trim());
    const out = ls.map((l, i) => {
      const bare = l.replace(/^#{1,3}\s+/, "").replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[.)]\s+/, "");
      if (all) return l.replace(re, "");
      if (!l.trim() && ls.length > 1) return l;
      return (kind === "heading" ? "# " : kind === "bullet" ? "- " : i + 1 + ". ") + bare;
    }).join("\n");
    ta.value = v.slice(0, a) + out + v.slice(b);
    ta.focus();
    ta.setSelectionRange(a, a + out.length);
    fire(ta);
  }
  // Enter in a list continues it ("- " or "2. "); Enter on an empty item ends the list.
  function onKey(e) {
    const ta = e.target;
    if (e.key !== "Enter" || e.shiftKey || e.isComposing || ta.selectionStart !== ta.selectionEnd) return;
    const v = ta.value, pos = ta.selectionStart;
    const start = v.lastIndexOf("\n", pos - 1) + 1;
    const line = v.slice(start, pos);
    const m = line.match(/^(\s*)([-*•]\s+(?:\[[ x]\]\s+)?|(\d+)([.)])\s+)/i);
    if (!m) return;
    e.preventDefault();
    if (line.trim() === m[0].trim()) { ta.value = v.slice(0, start) + v.slice(pos); ta.setSelectionRange(start, start); fire(ta); return; }
    let next = m[2];
    if (m[3]) next = Number(m[3]) + 1 + m[4] + " ";
    else next = next.replace(/\[x\]/i, "[ ]");
    const ins = "\n" + m[1] + next;
    ta.value = v.slice(0, pos) + ins + v.slice(pos);
    ta.setSelectionRange(pos + ins.length, pos + ins.length);
    fire(ta);
  }

  // ---------- Sharing ----------
  const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  // A note drawn as a picture (title, text, first photo) → a PNG Blob.
  async function toImage(note) {
    const W = 1080, pad = 72;
    const c = document.createElement("canvas"), x = c.getContext("2d");
    const title = (note.title || "").trim();
    const body = plain(note.content || "").trim();
    const photo = note.images && note.images[0] ? await loadImg(note.images[0]) : null;
    const font = (w, s) => w + " " + s + "px -apple-system, system-ui, 'Segoe UI', sans-serif";
    const wrapText = (text, f, max) => {
      x.font = f;
      const out = [];
      for (const para of text.split("\n")) {
        let line = "";
        for (const word of para.split(/(\s+)/)) {
          if (x.measureText(line + word).width > max && line.trim()) { out.push(line.trimEnd()); line = word.trimStart(); }
          else line += word;
        }
        out.push(line);
      }
      return out;
    };
    const tLines = title ? wrapText(title, font(700, 56), W - pad * 2) : [];
    const bLines = body ? wrapText(body, font(400, 38), W - pad * 2).slice(0, 80) : [];
    const ph = photo ? Math.round((W - pad * 2) * Math.min(1.2, photo.height / photo.width)) : 0;
    c.width = W;
    c.height = Math.min(6000, pad * 2 + tLines.length * 70 + (title && body ? 24 : 0) + bLines.length * 54 + (photo ? ph + 40 : 0) + 60);
    x.fillStyle = note.color || "#ffffff";
    x.fillRect(0, 0, c.width, c.height);
    if (note.color) { x.fillStyle = "rgba(255,255,255,.86)"; x.fillRect(24, 24, c.width - 48, c.height - 48); }
    let y = pad;
    x.fillStyle = "#16171d"; x.textBaseline = "top";
    x.font = font(700, 56); tLines.forEach((l) => { x.fillText(l, pad, y); y += 70; });
    if (title && body) y += 24;
    x.font = font(400, 38); x.fillStyle = "#2b2d38"; bLines.forEach((l) => { x.fillText(l, pad, y); y += 54; });
    if (photo) { y += 20; x.drawImage(photo, pad, y, W - pad * 2, ph); y += ph + 20; }
    x.font = font(600, 26); x.fillStyle = "#8a8ea3"; x.fillText("Stash", pad, c.height - pad + 10);
    return new Promise((ok) => c.toBlob(ok, "image/png"));
  }
  // Opens the note formatted on a clean page and the print dialog (where
  // "Save as PDF" lives on phones and computers).
  function print(note) {
    const imgs = (note.images || []).map((src) => '<img src="' + src + '" alt="">').join("");
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(note.title || "Note") + '</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<style>body{font:16px/1.55 -apple-system,system-ui,'Segoe UI',sans-serif;color:#16171d;max-width:720px;margin:32px auto;padding:0 24px}h1{font-size:28px;margin:0 0 16px}" +
      "img{max-width:100%;border-radius:8px;margin:12px 0;display:block}blockquote{border-left:3px solid #ccc;margin:0;padding-left:12px;color:#555}code{background:#f2f2f5;padding:1px 4px;border-radius:4px}" +
      ".fm-gap{height:8px;margin:0}.fm-tasks{list-style:none;padding-left:4px}.fm-tasks li:before{content:'☐ '}.fm-tasks li.done:before{content:'☑ '}footer{color:#999;font-size:12px;margin-top:32px}</style></head><body>" +
      (note.title ? "<h1>" + esc(note.title) + "</h1>" : "") + toHtml(note.content || "") + imgs +
      "<footer>" + esc(new Date(note.updatedAt || Date.now()).toLocaleString()) + " · Stash</footer><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>";
    const w = window.open("", "_blank");
    if (!w) return false;
    w.document.open(); w.document.write(html); w.document.close();
    return true;
  }

  window.CPFormat = { toHtml, plain, wrap, lines, onKey, toImage, print };
})();
