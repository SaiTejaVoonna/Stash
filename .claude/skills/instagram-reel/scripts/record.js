// TEMPLATE (from the Stash Reel): change the URL, the demo-data step and the recorded actions for the new product.
// Records the real Stash app (demo data only) as high-resolution frame sequences using CDP screencast.
const { chromium } = require("/home/user/copypaster/node_modules/playwright");
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const OUT = path.join(__dirname, "cap");
const W = 390, H = 844, DPR = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MARKS = {}; let cur = null; const mark = (k) => { MARKS[cur][k] = Date.now() / 1000; };

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: true, isMobile: true, colorScheme: "dark" });
  await c.addInitScript(() => {
    window.__ripple = (x, y) => {
      const d = document.createElement("div");
      d.style.cssText = `position:fixed;left:${x - 26}px;top:${y - 26}px;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.7);pointer-events:none;z-index:2147483647;transform:scale(.4);opacity:1;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s ease-out`;
      document.body.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = "scale(1.15)"; d.style.opacity = "0"; }));
      setTimeout(() => d.remove(), 600);
    };
  });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await p.goto("http://localhost:8810/index.html"); await sleep(1200);
  await p.evaluate(() => document.getElementById("me-demo-load").click()); await sleep(1800);
  await p.evaluate(() => { const t = document.getElementById("toast-host") || document.querySelector(".toast-item"); });
  await sleep(3500); // let the demo toast go away

  async function tap(target, opts = {}) {
    const loc = typeof target === "string" ? p.locator(target).first() : target.first();
    const box = await loc.boundingBox();
    await p.evaluate(([x, y]) => window.__ripple(x, y), [box.x + box.width / 2, box.y + box.height / 2]);
    await sleep(opts.lead ?? 140);
    await loc.tap();
  }
  async function record(name, fn) {
    const dir = path.join(OUT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const frames = []; let n = 0; cur = name; MARKS[name] = {};
    cdp.on("Page.screencastFrame", async (f) => {
      const file = path.join(dir, String(n).padStart(5, "0") + ".jpg"); fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      frames.push({ file, t: f.metadata.timestamp }); n++;
      cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 94, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });
    await sleep(500);
    await fn();
    await sleep(600);
    await cdp.send("Page.stopScreencast"); cdp.removeAllListeners("Page.screencastFrame");
    // concat list with real durations -> 30fps constant-frame-rate mp4
    const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (i < frames.length - 1 ? frames[i + 1].t - f.t : 0.5)).toFixed(4)}`).join("\n") + `\nfile '${frames[frames.length - 1].file}'\n`;
    fs.writeFileSync(path.join(dir, "list.txt"), list);
    execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${path.join(dir, "list.txt")} -vf "fps=30,scale=1170:2532:flags=lanczos,format=yuv420p" -c:v libx264 -crf 14 -preset medium ${path.join(OUT, name + ".mp4")}`);
    const dur = frames[frames.length - 1].t - frames[0].t + 0.5;
    for (const k of Object.keys(MARKS[name])) MARKS[name][k] = +(MARKS[name][k] - frames[0].t).toFixed(2);
    console.log(name, JSON.stringify(MARKS[name]), frames.length, "frames", dur.toFixed(2), "s");
  }
  const scrollChat = (to, ms) => p.evaluate(([to, ms]) => new Promise((res) => { const e = document.getElementById("cx-body"); const from = e.scrollTop, t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / ms), ease = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; e.scrollTop = from + (to - from) * ease; k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); }), [to, ms]);

  // First visit to Collections shows a one-time hint: get it out of the way before recording.
  await p.tap("#tab-bar .tab-btn[data-tab='groups']"); await sleep(5500);
  await p.tap("#tab-bar .tab-btn[data-tab='chat']"); await sleep(1500);
  // R1: the Inbox, scrolled back through photo, file and link
  await record("r1_inbox", async () => {
    await sleep(500);
    await scrollChat(-700, 2600);
    await sleep(500);
    await scrollChat(9999, 1800);
  });
  // R2: the + menu in the Inbox
  await record("r2_plus", async () => {
    await sleep(400);
    mark("tap_plus"); await tap("#cx-plus");
    await sleep(1700);
    mark("close_menu"); await tap("#cx-input", { lead: 100 }); // closes the menu, focuses the box
    await sleep(500);
  });
  // R3: type, spotted details, send, suggestion, one tap to file
  await record("r3_suggest", async () => {
    await sleep(300);
    await tap("#cx-input", { lead: 100 });
    mark("type_start"); await p.keyboard.type("Fuel 5.2 L 551 rupees at 12,180 km", { delay: 38 }); mark("type_end");
    await sleep(1100);
    mark("tap_send"); await tap("#cx-send");
    await sleep(1500);
    mark("tap_chip"); await tap(p.locator(".cx-pending, .cx-chip, button").filter({ hasText: "Vehicles" }));
    await sleep(1800);
  });
  // R4: search
  await record("r4_search", async () => {
    await sleep(300);
    mark("tap_search"); await tap("#tab-bar .tab-btn[data-tab='search']");
    await sleep(900);
    mark("type_start"); await p.keyboard.type("tea house", { delay: 70 }); mark("type_end");
    await sleep(2200);
  });
  // R5: vault
  await record("r5_vault", async () => {
    await sleep(300);
    mark("tap_more"); await tap("#tab-bar .tab-btn[data-tab='more']");
    await sleep(900);
    mark("tap_vault"); await tap('#main-nav .nav-item[data-nav="vault"]');
    await sleep(2400);
  });
  // R6: collections
  await record("r6_collections", async () => {
    await sleep(300);
    await tap("#tab-bar .tab-btn[data-tab='groups']");
    await sleep(2800);
  });
  fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(MARKS, null, 1));
  await b.close();
})();
