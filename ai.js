// Stash "Copy for AI": your selected things as clean, labelled text to paste
// into any AI chat (Claude, ChatGPT, Gemini, a local model). window.CPAI
//
// Nothing is sent anywhere by Stash; you choose what to copy and where to
// paste it. The Vault is never included (callers leave it out, and this file
// refuses anything marked vaulted). Photos and files are mentioned, not copied.
(function () {
  "use strict";

  const day = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const oneLine = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

  // things: [{ title, at, where, amount, tags: [], text, extra: [], photos: n, files: [names], ocr, vaulted }]
  // opts: { source: "Notes" | "Inbox" | "Bike", now }
  function format(things, opts = {}) {
    const list = (things || []).filter((x) => x && !x.vaulted);
    const out = [];
    const now = opts.now || Date.now();
    out.push("# From my Stash" + (opts.source ? ": " + oneLine(opts.source) : ""));
    out.push("");
    out.push(list.length + (list.length === 1 ? " item" : " items") + ", copied " + day(now) + ". These are my own notes and records. Use them to answer my question; say so if something isn't in them.");
    for (const x of list) {
      out.push("");
      out.push("## " + (oneLine(x.title) || "Untitled"));
      const facts = [];
      if (x.at) facts.push("Date: " + day(x.at));
      if (x.where) facts.push("Filed in: " + oneLine(x.where));
      if (x.amount) facts.push("Amount: " + oneLine(x.amount));
      if (x.tags && x.tags.length) facts.push("Tags: " + x.tags.map((t) => "#" + oneLine(t)).join(" "));
      for (const e of x.extra || []) if (e) facts.push(oneLine(e));
      const att = [];
      if (x.photos) att.push(x.photos + (x.photos === 1 ? " photo" : " photos"));
      if (x.files && x.files.length) att.push(x.files.map(oneLine).join(", "));
      if (att.length) facts.push("Attached (not included): " + att.join("; "));
      facts.forEach((f) => out.push("- " + f));
      const text = String(x.text || "").trim();
      if (text) { out.push(""); out.push(text); }
      const ocr = String(x.ocr || "").trim();
      if (ocr && !text.includes(ocr.slice(0, 40))) { out.push(""); out.push("Text read from the photo or file:"); out.push(ocr.slice(0, 4000)); }
    }
    return out.join("\n").trim() + "\n";
  }

  window.CPAI = { format };
})();
