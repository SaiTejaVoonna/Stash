// Stash app lock: a PIN (and Face ID / fingerprint where the browser allows)
// before Stash opens on this device. window.CPLock
//
// It's a screen in front of the app, not encryption: anyone who can open the
// browser's own storage could still read it. The Vault is what encrypts.
// The PIN itself is never stored, only a slow salted hash of it.
(function () {
  "use strict";

  const KEY = "copypaster-applock";
  const ROUNDS = 150000;
  const enc = new TextEncoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

  function load() {
    try { const c = JSON.parse(localStorage.getItem(KEY) || "null"); return c && c.hash ? c : null; } catch { return null; }
  }
  function save(c) { try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch {} }

  async function hashPin(pin, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
    return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ROUNDS }, base, 256));
  }
  async function check(pin) {
    const c = load();
    if (!c) return true;
    return (await hashPin(pin, unb64(c.salt))) === c.hash;
  }
  async function setPin(pin, after) {
    const salt = rand(16);
    const old = load() || {};
    save({ salt: b64(salt), hash: await hashPin(pin, salt), after: after == null ? (old.after ?? 0) : after, passkey: old.passkey || null, at: Date.now() });
  }
  function setAfter(min) { const c = load(); if (c) { c.after = min; save(c); } }
  function turnOff() { save(null); }

  // ---------- Face ID / fingerprint ----------
  // A passkey made only for this: Stash asks the device to check it's you.
  const passkeysOK = () => !!(window.PublicKeyCredential && window.isSecureContext && navigator.credentials);
  async function addPasskey() {
    const cred = await navigator.credentials.create({ publicKey: {
      rp: { name: "Stash" },
      user: { id: rand(16), name: "Stash app lock", displayName: "Stash app lock" },
      challenge: rand(32),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000
    } });
    const c = load(); if (!c) return;
    c.passkey = b64(cred.rawId); save(c);
  }
  function removePasskey() { const c = load(); if (c) { c.passkey = null; save(c); } }
  async function usePasskey() {
    const c = load();
    if (!c || !c.passkey) return false;
    const got = await navigator.credentials.get({ publicKey: {
      challenge: rand(32), allowCredentials: [{ type: "public-key", id: unb64(c.passkey) }], userVerification: "required", timeout: 60000 } });
    return !!got;
  }

  // ---------- The lock screen ----------
  let screen = null, wrong = 0, waitUntil = 0, hiddenAt = 0;
  const app = () => document.getElementById("app");
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v);
    }
    n.append(...kids.filter((x) => x != null));
    return n;
  }

  function lock() {
    const c = load();
    if (!c || screen) return;
    const input = el("input", { id: "lock-pin", type: "password", inputmode: "numeric", autocomplete: "off", maxlength: "12", "aria-label": "PIN", placeholder: "PIN", enterkeyhint: "go" });
    const msg = el("p", { id: "lock-msg", class: "lock-msg", role: "alert" });
    const go = async () => {
      if (Date.now() < waitUntil) { msg.textContent = "Wait " + Math.ceil((waitUntil - Date.now()) / 1000) + " seconds, then try again."; return; }
      const pin = input.value.trim();
      if (!pin) { input.focus(); return; }
      if (await check(pin)) { wrong = 0; unlock(); return; }
      wrong++;
      input.value = "";
      if (wrong >= 5) { waitUntil = Date.now() + Math.min(300, 30 * (wrong - 4)) * 1000; msg.textContent = "Wrong PIN. Wait " + Math.round((waitUntil - Date.now()) / 1000) + " seconds."; }
      else msg.textContent = "Wrong PIN. Try again.";
      box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
      input.focus();
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    const bio = c.passkey && passkeysOK() ? el("button", { type: "button", class: "lock-bio", id: "lock-bio", onclick: async () => {
      try { if (await usePasskey()) unlock(); } catch (err) { msg.textContent = err && err.name === "NotAllowedError" ? "Cancelled. Use your PIN." : "Couldn't check. Use your PIN."; }
    } }, "Use Face ID / fingerprint") : null;
    const forgot = el("details", { class: "lock-forgot" }, el("summary", null, "Forgot your PIN?"),
      el("p", null, "The PIN can't be recovered. To start again, clear this site's data in your browser's settings: that removes the PIN and everything Stash keeps on this device. Things you synced to your own Google Drive can be brought back after."));
    const box = el("div", { class: "lock-box" },
      el("img", { src: "icons/icon-192.png", alt: "", class: "lock-logo" }),
      el("h1", null, "Stash is locked"),
      el("div", { class: "lock-row" }, input, el("button", { type: "button", class: "lock-go", id: "lock-go", onclick: go }, "Unlock")),
      msg, bio, forgot);
    screen = el("div", { id: "lock-screen", role: "dialog", "aria-modal": "true", "aria-label": "Stash is locked" }, box);
    document.body.append(screen);
    const a = app(); if (a) a.inert = true;
    document.documentElement.classList.add("app-locked");
    setTimeout(() => { if (!bio || !matchMedia("(pointer: coarse)").matches) input.focus(); }, 30);
  }
  function unlock() {
    if (!screen) return;
    screen.remove(); screen = null;
    const a = app(); if (a) a.inert = false;
    document.documentElement.classList.remove("app-locked");
  }
  const isLocked = () => !!screen;

  // While locked, nothing reaches the app: no shortcuts, paste-anywhere or drops.
  for (const ev of ["keydown", "keyup", "paste", "drop", "dragover", "copy", "cut"]) {
    window.addEventListener(ev, (e) => {
      if (!screen || screen.contains(e.target)) return;
      e.stopImmediatePropagation();
      if (ev !== "keyup") e.preventDefault();
    }, true);
  }

  // Locks when Stash opens, and when you come back after the chosen time away.
  if (load()) lock();
  document.addEventListener("visibilitychange", () => {
    const c = load();
    if (!c) return;
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      // "Right away": lock now, so the app switcher shows the lock screen.
      if (!c.after) lock();
    } else if (hiddenAt && Date.now() - hiddenAt >= (c.after || 0) * 60000) lock();
  });

  window.CPLock = { on: () => !!load(), settings: load, check, setPin, setAfter, turnOff, addPasskey, removePasskey, passkeysOK, lock, unlock, isLocked };
})();
