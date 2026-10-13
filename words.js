// Stash personal dictionary: your own words and what they mean.
// window.CPWords
//
// "PUC" means "pollution certificate", "Amma" means "Mother", "Nimrah" means
// "Nimrah Cafe". Search finds either one, and suggestions understand both.
// Kept on this device, per profile.
(function () {
  "use strict";

  let storeKey = "copypaster-words";
  let cache = null;
  const fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const clean = (s) => String(s || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);

  function list() {
    if (!cache) {
      try { cache = JSON.parse(localStorage.getItem(storeKey) || "[]"); } catch { cache = []; }
      if (!Array.isArray(cache)) cache = [];
      cache = cache.filter((x) => x && typeof x.word === "string" && typeof x.means === "string");
    }
    return cache.slice();
  }
  function save(next) { cache = next; try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch {} }
  function setStore(key) { storeKey = key; cache = null; }

  // Adds or replaces one word. Returns the entry, or null when it isn't usable.
  function add(word, means) {
    const w = clean(word), m = clean(means);
    if (!w || !m || fold(w) === fold(m)) return null;
    const rest = list().filter((x) => fold(x.word) !== fold(w));
    const entry = { word: w, means: m, at: Date.now() };
    save([...rest, entry].slice(-300));
    return entry;
  }
  function remove(word) { save(list().filter((x) => fold(x.word) !== fold(word))); }

  // Whole-word match inside folded text.
  const has = (text, w) => (" " + text + " ").includes(" " + w + " ");

  // The query as typed, plus the same query with your words swapped both ways:
  // "puc renewal" → ["puc renewal", "pollution certificate renewal"].
  function alternatives(q) {
    const f = fold(q);
    if (!f) return [];
    const out = [f];
    for (const x of list()) {
      const a = fold(x.word), b = fold(x.means);
      if (has(f, a)) out.push((" " + f + " ").replace(" " + a + " ", " " + b + " ").trim());
      if (has(f, b)) out.push((" " + f + " ").replace(" " + b + " ", " " + a + " ").trim());
      if (out.length >= 6) break;
    }
    return [...new Set(out)];
  }
  // Text with the meanings of any of your words added, so suggestions
  // understand "Amma's BP tablets" as being about Mother.
  function expand(text) {
    const f = fold(text);
    const extra = list().filter((x) => has(f, fold(x.word))).map((x) => x.means);
    return extra.length ? text + " " + extra.join(" ") : text;
  }

  window.CPWords = { list, add, remove, alternatives, expand, setStore };
})();
