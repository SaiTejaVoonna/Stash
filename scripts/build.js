// Builds the published copy of Stash into dist/: the same files, with the
// JavaScript and CSS squashed (minified) so it loads faster and is harder to
// read and reuse. The readable source stays in the repo.
//   npm run build   → dist/   (Cloudflare Pages: build "npm ci && npm run build", output "dist")
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");
const CleanCSS = require("clean-css");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist");
const SKIP = new Set(["node_modules", "dist", "tests", "test-results", "playwright-report", "scripts", "docs", ".git", ".github", "package.json", "package-lock.json", "playwright.config.js", "wrangler.jsonc", ".claude", ".agents", "CLAUDE.md", "AGENTS.md", "LICENSE"]);

const css = new CleanCSS({ level: 1 });
const jsOptions = { compress: { passes: 2 }, mangle: true, format: { comments: false } };

async function squashJs(code, name) {
  const r = await minify(code, jsOptions);
  if (!r.code) throw new Error("Couldn't minify " + name);
  return r.code;
}
function squashCss(code, name) {
  const r = css.minify(code);
  if (r.errors.length) throw new Error("CSS in " + name + ": " + r.errors.join("; "));
  return r.styles;
}
// index.html: its <style> and inline <script> blocks squashed too.
async function squashHtml(html, name) {
  const parts = [];
  let last = 0;
  const re = /(<style[^>]*>)([\s\S]*?)(<\/style>)|(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g;
  let m;
  while ((m = re.exec(html))) {
    parts.push(html.slice(last, m.index));
    if (m[1]) parts.push(m[1] + squashCss(m[2], name) + m[3]);
    else parts.push(m[4] + (m[5].trim() ? await squashJs(m[5], name) : m[5]) + m[6]);
    last = re.lastIndex;
  }
  parts.push(html.slice(last));
  // Comments and blank lines between tags.
  return parts.join("").replace(/<!--(?!\s*\[)[\s\S]*?-->/g, "").replace(/\n\s*\n+/g, "\n");
}

async function walk(dir, rel = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || (!rel && SKIP.has(entry.name))) continue;
    const src = path.join(dir, entry.name), r = path.join(rel, entry.name), dst = path.join(OUT, r);
    if (entry.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); await walk(src, r); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (ext === ".js") fs.writeFileSync(dst, await squashJs(fs.readFileSync(src, "utf8"), r));
    else if (ext === ".css") fs.writeFileSync(dst, squashCss(fs.readFileSync(src, "utf8"), r));
    else if (ext === ".html") fs.writeFileSync(dst, await squashHtml(fs.readFileSync(src, "utf8"), r));
    else fs.copyFileSync(src, dst);
  }
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  await walk(ROOT);
  let before = 0, after = 0;
  const size = (d, base) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) size(p, base); else if (/\.(js|css|html)$/.test(e.name)) { after += fs.statSync(p).size; const s = path.join(ROOT, path.relative(OUT, p)); if (fs.existsSync(s)) before += fs.statSync(s).size; } } };
  size(OUT);
  console.log("Built dist/: code " + Math.round(before / 1024) + " KB → " + Math.round(after / 1024) + " KB");
})().catch((err) => { console.error(err.message || err); process.exit(1); });
