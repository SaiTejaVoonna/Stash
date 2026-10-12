// Stash brain: works out where a message belongs and what's in it, from your
// own words: your collections, sections, people, places and tags, and what you
// did before. No AI, no internet; it only suggests (or files when you've said
// so and it's sure). window.CPBrain
//
//   @  where it goes   (a collection, a section, a person or place)
//   #  what it's about (a tag)
//   and on its own: dates, amounts, km, litres and phone numbers.
(function () {
  "use strict";

  const fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}₹]+/gu, " ").trim();
  const words = (s) => fold(s).split(" ").filter(Boolean);
  const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with", "my", "is", "it", "this", "that", "dr", "doctor", "mr", "mrs", "ms", "sir", "from", "by", "me", "i", "we", "our", "today", "yesterday", "tomorrow", "new", "old", "got", "had", "did", "was", "visit"]);
  const stem = (w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");

  // Words that hint at a kind of section (matched against your section names).
  const SECTION_HINTS = [
    [/\b(bill|bills|invoice|receipt|paid|payment|gst)\b/, /bill|receipt|invoice|expense|payment/i],
    [/\b(prescription|prescriptions|rx|prescribed)\b/, /prescription/i],
    [/\b(tablet|tablets|syrup|capsule|ointment|cream|medicine|medicines|dose|pharmacy)\b/, /medicine|pharmacy|prescription/i],
    [/\b(report|reports|test|tests|lab|blood|scan|xray|x ray|mri|ct|ultrasound|cbc)\b/, /lab|report|test|scan/i],
    [/\b(petrol|diesel|fuel|cng|filled|fill up|fillup|litre|litres|liter|ltr)\b/, /fuel|petrol|diesel|charg|cng/i],
    [/\b(service|servicing|repair|mechanic|oil change|puncture)\b/, /service|repair/i],
    [/\b(spare|part|parts|tyre|tire|battery|chain)\b/, /spare|part/i],
    [/\b(insurance|rc|puc|licence|license|policy)\b/, /insurance|paper|document/i],
    [/\b(toll|parking)\b/, /toll|parking/i],
    [/\b(ticket|tickets|boarding|pnr|flight|train|bus)\b/, /ticket|booking|travel/i],
    [/\b(recipe|recipes|cook|cooking|ingredients)\b/, /recipe/i],
    [/\b(ate|eat|dish|dishes|tasted|tasty|boba|tea|coffee|biryani|pizza|burger|dessert|tiramisu|cake)\b/, /dish|food|meal|eat/i],
    [/\b(wishlist|want to try|to try|must try)\b/, /wish|try/i],
    [/\b(watch|watched|watching|episode|season|movie|anime|series)\b/, /watch/i],
    [/\b(warranty|guarantee)\b/, /warranty/i],
    [/\b(photo|photos|pic|pics)\b/, /photo/i]
  ];

  // ---------- Learning: what you filed where ----------
  let storeKey = "copypaster-brain";
  let mem = null;
  function memory() {
    if (!mem) { try { mem = JSON.parse(localStorage.getItem(storeKey) || "{}") || {}; } catch { mem = {}; } mem.words = mem.words || {}; mem.tags = mem.tags || {}; }
    return mem;
  }
  function setStore(key) { storeKey = key; mem = null; }
  const destKey = (d) => d.g + "|" + (d.s || "") + "|" + (d.tag || "");
  // Remembers the words of something you filed, and where it went.
  function learn(text, dest, tags = []) {
    const m = memory();
    const k = destKey(dest);
    for (const w of new Set(words(text).filter((x) => x.length > 2 && !STOP.has(x) && !/^\d+$/.test(x)).slice(0, 40))) {
      const row = (m.words[w] = m.words[w] || {});
      row[k] = Math.min(50, (row[k] || 0) + 1);
    }
    for (const t of tags) { const row = (m.tags[t] = m.tags[t] || {}); row[dest.g] = Math.min(50, (row[dest.g] || 0) + 1); }
    // Keep it small: forget the rarest words past 3000.
    const ws = Object.keys(m.words);
    if (ws.length > 3000) ws.sort((a, b) => sum(m.words[a]) - sum(m.words[b])).slice(0, ws.length - 3000).forEach((w) => delete m.words[w]);
    try { localStorage.setItem(storeKey, JSON.stringify(m)); } catch {}
  }
  const sum = (o) => Object.values(o).reduce((t, v) => t + v, 0);
  // "Not this": these words count less for that place, and this message
  // won't be suggested there again.
  function forget(text, dest, id) {
    const m = memory();
    const k = destKey(dest);
    for (const w of new Set(words(text))) {
      const row = m.words[w];
      if (!row || !row[k]) continue;
      row[k] -= 2;
      if (row[k] <= 0) delete row[k];
      if (!Object.keys(row).length) delete m.words[w];
    }
    if (id) {
      m.skip = m.skip || {};
      (m.skip[id] = m.skip[id] || []).push(k);
      const ids = Object.keys(m.skip);
      if (ids.length > 500) ids.slice(0, ids.length - 500).forEach((x) => delete m.skip[x]);
    }
    try { localStorage.setItem(storeKey, JSON.stringify(m)); } catch {}
  }
  const skipped = (id, dest) => { const m = memory(); return !!(m.skip && m.skip[id] && m.skip[id].includes(destKey(dest))); };
  // Everything learned, for the "What Stash has learned" page, and wiping it.
  function learned() { const m = memory(); return { words: m.words, tags: m.tags, skips: Object.keys(m.skip || {}).length }; }
  function wipe() { mem = { words: {}, tags: {} }; try { localStorage.removeItem(storeKey); } catch {} }

  // ---------- What you have: collections, sections, people, places, tags ----------
  // data: { groups, entries, entities, tags: [names] }
  function build(data) {
    const pages = [];
    for (const g of data.groups) {
      for (const t of g.mainTags) {
        const ent = t.entity ? data.entities.find((x) => x.id === t.entity) : null;
        const names = [t.name, ...(ent ? [ent.name, ...(ent.aka || [])] : [])];
        // Where it's been: the average spot of entries on this page with a location.
        const locs = data.entries.filter((e) => !e.deletedAt && e.capture && e.capture.location && e.refs.some((r) => r.g === g.id && r.tag === t.id)).map((e) => e.capture.location);
        const at = locs.length ? { lat: locs.reduce((s, l) => s + l.lat, 0) / locs.length, lng: locs.reduce((s, l) => s + l.lng, 0) / locs.length } : null;
        pages.push({ g, t, ent, names, words: [...new Set(names.flatMap(words).filter((w) => w.length > 2 && !STOP.has(w)))], at });
      }
    }
    return { groups: data.groups, pages, tags: [...new Set(data.tags || [])] };
  }

  // ---------- @ and # while typing ----------
  // kind "@": collections, sections ("Prescriptions · in Health"), people and places.
  // kind "#": your tags. Returns [{ kind, label, sub, insert, ref|tag }]
  function complete(ix, kind, prefix, limit = 8) {
    const q = fold(prefix).replace(/\s+/g, "");
    const starts = (name) => { const f = fold(name); return !q || f.replace(/\s+/g, "").startsWith(q) || f.split(" ").some((w) => w.startsWith(q)); };
    const out = [];
    if (kind === "#") {
      for (const t of ix.tags) if (starts(t)) out.push({ kind: "tag", label: "#" + t, insert: "#" + t, tag: t });
      const clean = String(prefix || "").trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, "");
      if (clean && !ix.tags.includes(clean)) out.push({ kind: "tag", label: "#" + clean, sub: "New tag", insert: "#" + clean, tag: clean, create: true });
      return out.slice(0, limit);
    }
    for (const p of ix.pages) if (p.names.some(starts)) out.push({ kind: "page", label: p.t.name, sub: p.g.name, insert: "@" + p.t.name.replace(/\s+/g, ""), ref: { g: p.g.id, s: null, tag: p.t.id } });
    for (const g of ix.groups) {
      if (starts(g.name)) out.push({ kind: "group", label: g.name, sub: "Collection", insert: "@" + g.name.replace(/\s+/g, ""), ref: { g: g.id, s: null, tag: null } });
      for (const s of g.subs) if (starts(s.name)) out.push({ kind: "section", label: s.name, sub: "in " + g.name, insert: "@" + g.name.replace(/\s+/g, "") + "/" + s.name.replace(/\s+/g, ""), ref: { g: g.id, s: s.id, tag: null } });
    }
    // Exact name matches first, then pages, sections, collections.
    const rank = { page: 0, section: 1, group: 2 };
    out.sort((a, b) => (fold(b.label) === q) - (fold(a.label) === q) || rank[a.kind] - rank[b.kind]);
    return out.slice(0, limit);
  }

  // ---------- Spotting dates, amounts and numbers ----------
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const startOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function spot(text, now = Date.now()) {
    const s = String(text || "");
    const low = s.toLowerCase();
    const out = [];
    // Money: ₹250, Rs. 1,200, 450 rupees, 300/-
    const money = low.match(/(?:₹|\brs\.?\s*|\binr\s*)\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees|rs\b|\/-|₹)/);
    if (money) { const v = Number((money[1] || money[2]).replace(/,/g, "")); if (v > 0) out.push({ kind: "amount", value: Math.round(v * 100), label: "₹" + v.toLocaleString("en-IN") }); }
    // Odometer and litres.
    const km = low.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:km|kms|kilometers|kilometres)\b/);
    if (km) out.push({ kind: "km", value: Number(km[1].replace(/,/g, "")), label: km[1] + " km" });
    const lit = low.match(/(\d+(?:\.\d+)?)\s*(?:l|ltr|litre|litres|liter|liters)\b/);
    if (lit) out.push({ kind: "litres", value: Number(lit[1]), label: lit[1] + " L" });
    // Phone numbers (10+ digits).
    const ph = s.match(/(?:\+?\d[\d\s-]{8,}\d)/);
    if (ph && ph[0].replace(/\D/g, "").length >= 10 && !(money && ph[0].includes((money[1] || money[2] || "").replace(/,/g, "")))) out.push({ kind: "phone", value: ph[0].trim(), label: ph[0].trim() });
    // When.
    let day = null;
    const DAY = 864e5;
    if (/\bday before yesterday\b/.test(low)) day = startOf(now) - 2 * DAY;
    else if (/\byesterday\b/.test(low)) day = startOf(now) - DAY;
    else if (/\btomorrow\b/.test(low)) day = startOf(now) + DAY;
    else if (/\btoday\b|\btonight\b/.test(low)) day = startOf(now);
    let m;
    if (day == null && (m = low.match(/\bin (\d+|a|one|two|three) (day|days|week|weeks|month|months)\b/))) {
      const n = { a: 1, one: 1, two: 2, three: 3 }[m[1]] || Number(m[1]);
      const unit = m[2].startsWith("day") ? DAY : m[2].startsWith("week") ? 7 * DAY : 30 * DAY;
      day = startOf(now) + n * unit;
    }
    if (day == null && /\bnext week\b/.test(low)) day = startOf(now) + 7 * DAY;
    if (day == null && (m = low.match(/\b(last|next|this|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
      const want = DAYS.indexOf(m[2]), today = new Date(now).getDay();
      let diff = want - today;
      if (m[1] === "last") { if (diff >= 0) diff -= 7; }
      else if (m[1] === "next") { if (diff <= 0) diff += 7; }
      else if (diff < 0) diff += 7;
      day = startOf(now) + diff * DAY;
    }
    if (day == null && (m = low.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?\b/) || low.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/))) {
      const [d, mo] = /^\d/.test(m[1]) ? [Number(m[1]), MONTHS.indexOf(m[2])] : [Number(m[2]), MONTHS.indexOf(m[1])];
      const y = m[3] ? Number(m[3]) : new Date(now).getFullYear();
      if (d >= 1 && d <= 31) day = new Date(y, mo, d).getTime();
    }
    // 12/10, 12-10-2026 or 12.10.2026 (dots only with a year, so 3.2 L isn't a date).
    if (day == null && (m = low.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/) || low.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/)) && !/\d[/.-]\d+[/.-]\d+[/.-]/.test(low)) {
      const d = Number(m[1]), mo = Number(m[2]) - 1; // day/month, as written in India
      let y = m[3] ? Number(m[3]) : new Date(now).getFullYear(); if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 0 && mo < 12) day = new Date(y, mo, d).getTime();
    }
    // A time: 5pm, 5:30 pm, 17:30.
    let mins = null;
    if ((m = low.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/))) { let hh = Number(m[1]) % 12; if (m[3] === "pm") hh += 12; mins = hh * 60 + Number(m[2] || 0); }
    else if ((m = low.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/))) mins = Number(m[1]) * 60 + Number(m[2]);
    if (day != null || mins != null) {
      const base = day != null ? day : startOf(now);
      const at = base + (mins != null ? mins * 60000 : day === startOf(now) ? now - startOf(now) : 12 * 3600000);
      const label = new Date(at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", ...(mins != null ? { hour: "numeric", minute: "2-digit" } : {}) });
      out.push({ kind: at > now + 60000 ? "when-future" : "when", value: at, label });
    }
    return out;
  }

  // ---------- Where it belongs ----------
  const near = (a, b) => { const R = 6371000, toR = Math.PI / 180; const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  // msg: { text, picks: [{ g, s, tag }], tags: [names], files: [{type,name}], guess: { kind }, location: {lat,lng} }
  // snapMatch: kind → { space: RegExp, sub: [RegExp] } (from groups.js)
  // Returns up to 2 { g, s, tag, score, why: [..], sure } best first.
  function understand(ix, msg, snapMatch = {}) {
    const text = String(msg.text || "");
    const low = " " + fold(text) + " ";
    const ws = words(text);
    const scores = new Map(); // group id → { score, why, s: Map, tag: Map }
    const at = (gid) => { if (!scores.has(gid)) scores.set(gid, { score: 0, why: [], s: new Map(), tag: new Map() }); return scores.get(gid); };
    const add = (gid, n, why, s, tag) => {
      const r = at(gid);
      r.score += n; if (why && !r.why.includes(why)) r.why.push(why);
      if (s) r.s.set(s, (r.s.get(s) || 0) + n);
      if (tag) r.tag.set(tag, (r.tag.get(tag) || 0) + n);
    };
    // 1. What you picked with @.
    for (const p of msg.picks || []) add(p.g, 100, "you picked it", p.s, p.tag);
    // 2. Names you've saved: people, places, sections, collections.
    for (const p of ix.pages) {
      const hit = p.words.filter((w) => w.length >= 4 && low.includes(" " + w + " ")).length;
      if (hit) add(p.g.id, 25 + 10 * (hit - 1), "it mentions " + p.t.name, null, p.t.id);
    }
    for (const g of ix.groups) {
      for (const w of words(g.name)) if (w.length >= 3 && !STOP.has(w) && ws.some((x) => stem(x) === stem(w))) add(g.id, 15, "it mentions " + g.name);
      for (const s of g.subs) for (const w of words(s.name)) if (w.length >= 3 && ws.some((x) => stem(x) === stem(w))) add(g.id, 18, "it mentions " + s.name, s.id);
    }
    // 3. Hint words → a section with a matching name.
    for (const [re, sub] of SECTION_HINTS) {
      if (!re.test(low)) continue;
      for (const g of ix.groups) for (const s of g.subs) if (sub.test(s.name)) add(g.id, 10, "it sounds like " + s.name.toLowerCase(), s.id);
    }
    // 4. Files and photos.
    if ((msg.files || []).some((f) => /pdf/i.test(f.type || "") || /\.pdf$/i.test(f.name || ""))) for (const g of ix.groups) for (const s of g.subs) if (/report|document|bill|prescription|paper/i.test(s.name)) add(g.id, 4, null, s.id);
    if (msg.guess && snapMatch[msg.guess.kind]) {
      const m = snapMatch[msg.guess.kind];
      for (const g of ix.groups) if (m.space.test(g.name) || (m.icons || []).includes(g.icon)) {
        add(g.id, 12, "looks like " + (msg.guess.label || msg.guess.kind).toLowerCase());
        for (const re of m.sub || []) { const s = g.subs.find((x) => re.test(x.name)); if (s) { add(g.id, 5, null, s.id); break; } }
      }
    }
    // 5. What you did before: these words, these tags.
    const m = memory();
    for (const w of new Set(ws)) {
      const row = m.words[w];
      if (!row) continue;
      for (const [k, n] of Object.entries(row)) { const [g, s, tag] = k.split("|"); if (ix.groups.some((x) => x.id === g)) add(g, Math.min(9, 3 * n), "you filed things like it there before", s || null, tag || null); }
    }
    for (const t of msg.tags || []) {
      const row = m.tags[t];
      if (row) for (const [g, n] of Object.entries(row)) if (ix.groups.some((x) => x.id === g)) add(g, Math.min(16, 8 * n), "#" + t + " went here before");
    }
    // 6. Where you are: near a place you've filed things at before.
    if (msg.location) for (const p of ix.pages) if (p.at && near(p.at, msg.location) < 200) add(p.g.id, 25, "you were here before: " + p.t.name, null, p.t.id);
    // Best collections, each with its best section and page.
    const best = (mp) => { let k = null, v = 0; for (const [a, b] of mp) if (b > v) { k = a; v = b; } return k; };
    return [...scores.entries()].filter(([, r]) => r.score >= 10).sort((a, b) => b[1].score - a[1].score).slice(0, 2).map(([gid, r]) => {
      const g = ix.groups.find((x) => x.id === gid);
      const s = best(r.s), tag = best(r.tag);
      return { g: gid, s: s && g.subs.some((x) => x.id === s) ? s : null, tag: tag && g.mainTags.some((x) => x.id === tag) ? tag : null, score: r.score, why: r.why.filter(Boolean).slice(0, 3), sure: r.score >= 45 };
    });
  }
  // "Health › Prescriptions · Dr X"
  function label(ix, d) {
    const g = ix.groups.find((x) => x.id === d.g);
    if (!g) return "";
    const s = d.s ? g.subs.find((x) => x.id === d.s) : null;
    const t = d.tag ? g.mainTags.find((x) => x.id === d.tag) : null;
    return g.name + (s ? " › " + s.name : "") + (t ? " · " + t.name : "");
  }

  window.CPBrain = { build, complete, spot, understand, label, learn, setStore, fold, forget, skipped, learned, wipe };
})();
