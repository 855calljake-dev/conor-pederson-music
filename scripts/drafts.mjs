// The draft overlay, mirrored from ij-site scripts/drafts.mjs (Jake, 2026-10-08:
// "Draft overlay on a Cron site so we can test it"; brought to this repo with the
// /the-voice/ build).
//
// WHAT IT IS FOR. Any [[bracket]] on this site marks words that are Conor's to
// write, and nobody writes those for him. But Jake cannot judge a finished page
// while a paragraph of it is a bracket. So this script makes a THROWAWAY copy of
// the site with drafts dropped in, to look at and then delete.
//
// WHAT IT IS NOT. It is not a step towards publishing invented words under his
// name. Three things make that impossible rather than merely discouraged:
//   1. It never touches data/*.json or the committed pages. It rewrites a copy only.
//   2. It refuses outright when LAUNCH is set, so a drafted build can never be the
//      live site. (This repo has no LAUNCH flag today; the guard is kept so the
//      pattern stays identical across tenants and survives one being added.)
//   3. Every page it writes carries a ribbon, fixed on screen, saying the words
//      are drafts.
// Delete the output directory when you are done looking at it.
//
//   node scripts/build.mjs && node scripts/drafts.mjs   -> writes .drafts-preview/
//   node scripts/drafts.mjs --check                     -> reports coverage, writes nothing
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".drafts-preview");
const CHECK = process.argv.includes("--check");

if (process.env.LAUNCH === "1") {
  console.error("drafts: refusing to run on a LAUNCH build. Drafts are never the live site.");
  process.exit(1);
}

const { drafts } = JSON.parse(readFileSync(join(ROOT, "data/drafts.json"), "utf8"));
// Longest match first, so a specific entry beats a general one whatever order the file is in.
const rules = [...drafts].sort((a, b) => b.match.length - a.match.length);

const PAGES = ["index.html", "the-voice/index.html", "thanks.html", "404.html"];
const BRACKET = /\[\[[^\[\]]*\]\]/g;

const RIBBON = `<div style="position:fixed;inset:auto 0 0 0;z-index:9999;background:#5B2EBF;color:#F2F4F8;` +
  `font:600 13px/1.45 system-ui,sans-serif;letter-spacing:.02em;padding:.6rem 1rem;text-align:center;` +
  `box-shadow:0 -6px 18px rgba(0,0,0,.25)">PREVIEW. The words on this page are drafts written to show ` +
  `the shape of the finished page. They are not Conor&rsquo;s words, and this build can never go live.</div>`;

let filled = 0;
const left = [];

if (!CHECK) {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const entry of ["assets", "data", "favicon.ico", "robots.txt"]) {
    const from = join(ROOT, entry);
    if (existsSync(from)) cpSync(from, join(OUT, entry), { recursive: true });
  }
}

for (const page of PAGES) {
  const src = join(ROOT, page);
  if (!existsSync(src)) continue;
  let html = readFileSync(src, "utf8");

  html = html.replace(BRACKET, (whole) => {
    const inner = whole.slice(2, -2);
    const rule = rules.find((r) => inner.startsWith(r.match));
    if (!rule) { left.push(`${page}: ${inner.slice(0, 60)}`); return whole; }
    filled += 1;
    return rule.draft;
  });

  if (!CHECK) {
    html = html.replace("</body>", `${RIBBON}\n</body>`);
    const dest = join(OUT, page);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, html);
  }
}

console.log(`drafts: ${filled} bracket(s) filled across ${PAGES.length} page(s)`);
if (left.length) {
  console.log(`drafts: ${left.length} left with no draft, shown as brackets:`);
  for (const l of left) console.log(`  ${l}`);
} else {
  console.log("drafts: every bracket has a draft");
}
if (!CHECK) console.log(`drafts: wrote ${OUT} (throwaway, gitignored, never deployed to the real site)`);
