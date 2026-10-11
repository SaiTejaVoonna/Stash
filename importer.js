// Stash import from other apps: Google Keep (Takeout), a WhatsApp chat
// export (like your "Message yourself" chat), text or Markdown files (Apple
// Notes exports and the like), and plain photos and PDFs. window.CPImport
//
// Everything is read on this device. Zip files are opened with JSZip, loaded
// the first time one is picked.
(function () {
  "use strict";

  const JSZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  const KEEP_COLORS = { RED: "#ff453a", ORANGE: "#ff9f0a", YELLOW: "#ffd60a", GREEN: "#30d158", TEAL: "#64d2ff", BLUE: "#0a84ff", CERULEAN: "#0a84ff", PURPLE: "#bf5af2", PINK: "#bf5af2", BROWN: "#8e8e93", GRAY: "#8e8e93" };

  let zipLib = null;
  function jszip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!zipLib) zipLib = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = JSZIP;
      s.onload = () => ok(window.JSZip);
      s.onerror = () => { zipLib = null; fail(new Error("Couldn't load the zip reader. Check your connection.")); };
      document.head.append(s);
    });
    return zipLib;
  }

  // A uniform list of files: { name, path, type, text(), dataUrl() }
  const typeOf = (name) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
      json: "application/json", html: "text/html", htm: "text/html", mp3: "audio/mpeg", m4a: "audio/mp4", opus: "audio/ogg", ogg: "audio/ogg", mp4: "video/mp4", mov: "video/quicktime",
      doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", vcf: "text/vcard" }[ext] || "application/octet-stream";
  };
  const readAs = (file, how) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r[how](file); });
  async function expand(fileList) {
    const out = [];
    for (const f of fileList) {
      if (/\.zip$/i.test(f.name) || f.type === "application/zip") {
        const Z = await jszip();
        const zip = await Z.loadAsync(f);
        for (const entry of Object.values(zip.files)) {
          if (entry.dir || /(^|\/)(__MACOSX|\.DS_Store)/.test(entry.name)) continue;
          const name = entry.name.split("/").pop();
          const type = typeOf(name);
          out.push({ name, path: entry.name, type, size: entry._data && entry._data.uncompressedSize || 0,
            text: () => entry.async("string"), dataUrl: async () => "data:" + type + ";base64," + (await entry.async("base64")) });
        }
      } else {
        out.push({ name: f.name, path: f.webkitRelativePath || f.name, type: f.type || typeOf(f.name), size: f.size, text: () => readAs(f, "readAsText"), dataUrl: () => readAs(f, "readAsDataURL") });
      }
    }
    return out;
  }

  // ---------- Google Keep ----------
  const isKeep = (j) => j && typeof j === "object" && ("textContent" in j || "listContent" in j) && ("userEditedTimestampUsec" in j || "createdTimestampUsec" in j);
  function fromKeep(j) {
    const at = (us) => (Number(us) ? Math.round(Number(us) / 1000) : Date.now());
    return {
      title: String(j.title || "").trim(), content: String(j.textContent || "").trim(),
      checklist: Array.isArray(j.listContent) && j.listContent.length ? j.listContent.map((x) => ({ text: String(x.text || ""), done: !!x.isChecked })) : null,
      tags: (j.labels || []).map((l) => String(l.name || "").trim()).filter(Boolean),
      pinned: !!j.isPinned, archived: !!j.isArchived, trashed: !!j.isTrashed,
      color: KEEP_COLORS[j.color] || null,
      createdAt: at(j.createdTimestampUsec || j.userEditedTimestampUsec), updatedAt: at(j.userEditedTimestampUsec || j.createdTimestampUsec),
      attachments: (j.attachments || []).map((a) => String(a.filePath || "").split("/").pop()).filter(Boolean)
    };
  }

  // ---------- WhatsApp chat export ----------
  // Android: "10/10/26, 5:08 pm - Name: text"   iPhone: "[10/10/26, 5:08:12 PM] Name: text"
  const WA_LINE = /^‎?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}):\s?([\s\S]*)$/i;
  function parseWhatsApp(text, { dayFirst = true } = {}) {
    const msgs = [];
    for (const raw of String(text || "").replace(/\r/g, "").split("\n")) {
      const m = raw.match(WA_LINE);
      if (!m) { if (msgs.length && raw.trim()) msgs[msgs.length - 1].text += "\n" + raw; continue; }
      let [, a, b, y, hh, mm, ss, ap, who, body] = m;
      let d = Number(dayFirst ? a : b), mo = Number(dayFirst ? b : a) - 1;
      if (mo > 11) { [d, mo] = [mo + 1, d - 1]; } // month/day the other way round
      let year = Number(y); if (year < 100) year += 2000;
      let hour = Number(hh) % (ap ? 12 : 24); if (ap && /p/i.test(ap)) hour += 12;
      const at = new Date(year, mo, d, hour, Number(mm), Number(ss || 0)).getTime();
      body = body.replace(/^‎/, "");
      // Attachments: "<attached: 00000012-PHOTO-2026-10-10.jpg>" or "IMG-20261010-WA0001.jpg (file attached)"
      const att = body.match(/<attached:\s*([^>]+)>/i) || body.match(/^\s*([\w.-]+\.\w{2,5})\s+\(file attached\)/i);
      msgs.push({ at, who: who.trim(), text: att ? body.replace(att[0], "").trim() : body, attachment: att ? att[1].trim() : null });
    }
    msgs.forEach((x) => { x.text = x.text.trim(); });
    return msgs.filter((x) => !/^(messages and calls are end-to-end encrypted|<media omitted>|this message was deleted|you deleted this message)/i.test(x.text) || x.attachment);
  }

  // ---------- Reading what was picked ----------
  // Returns { notes: [...], messages: [...], files: [...] } ready for the app to save.
  async function scan(fileList, onProgress) {
    const files = await expand(fileList);
    const byName = new Map(files.map((f) => [f.name, f]));
    const out = { notes: [], messages: [], files: [], sources: { keep: 0, whatsapp: 0, text: 0, files: 0 } };
    const used = new Set();
    let i = 0;
    for (const f of files) {
      if (onProgress && ++i % 20 === 0) onProgress(i, files.length);
      if (f.type === "application/json") {
        let j = null;
        try { j = JSON.parse(await f.text()); } catch {}
        if (isKeep(j)) {
          const n = fromKeep(j);
          if (n.trashed) continue;
          n.images = [];
          for (const a of n.attachments) { const af = byName.get(a); if (af && /^image\//.test(af.type)) { n.images.push(await af.dataUrl()); used.add(af); } }
          out.notes.push(n); out.sources.keep++;
        }
        used.add(f);
      } else if (/^text\/plain$/.test(f.type) && /chat|whatsapp/i.test(f.name)) {
        const msgs = parseWhatsApp(await f.text());
        for (const m of msgs) {
          const msg = { at: m.at, text: m.text, images: [], files: [] };
          if (m.attachment) {
            const af = byName.get(m.attachment);
            if (af) { used.add(af); if (/^image\//.test(af.type)) msg.images.push(await af.dataUrl()); else msg.files.push({ name: af.name, type: af.type, size: af.size, data: await af.dataUrl() }); }
          }
          if (msg.text || msg.images.length || msg.files.length) out.messages.push(msg);
        }
        out.sources.whatsapp += msgs.length;
        used.add(f);
      }
    }
    for (const f of files) {
      if (used.has(f)) continue;
      if (/^text\/(plain|markdown)$/.test(f.type) || /\.(txt|md)$/i.test(f.name)) {
        const text = (await f.text() || "").trim();
        if (text) { out.notes.push({ title: f.name.replace(/\.(txt|md)$/i, ""), content: text, tags: [], createdAt: Date.now(), updatedAt: Date.now() }); out.sources.text++; }
      } else if (/^text\/html$/.test(f.type)) {
        const div = document.createElement("div");
        div.innerHTML = (await f.text() || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
        const text = (div.innerText || div.textContent || "").trim();
        if (text) { out.notes.push({ title: (div.querySelector("title,h1") || {}).textContent || f.name.replace(/\.html?$/i, ""), content: text, tags: [], createdAt: Date.now(), updatedAt: Date.now() }); out.sources.text++; }
      } else if (/^(image|application\/pdf|audio|video)/.test(f.type) || /\.(docx?|xlsx?|pptx?)$/i.test(f.name)) {
        out.files.push(f); out.sources.files++;
      }
    }
    return out;
  }

  window.CPImport = { scan, parseWhatsApp, fromKeep, isKeep, expand };
})();
