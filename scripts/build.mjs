#!/usr/bin/env node
/* Tier-1 build step (SOP-AGENTIC-SEO-WEBSITES.md §4 + §3.1): this site has
 * exactly one indexable page — index.html — but its shows/music content
 * lives in data/*.json and used to reach the page only via client-side JS
 * (main.js fetch + DOM injection). §3.1 is explicit that AI crawlers don't
 * run a JS engine the way Googlebot does, so anything injected at runtime
 * is invisible to them. This script reads the same data files the page
 * renders from and bakes JSON-LD, freshness dates, and og:image straight
 * into the raw HTML response, between marker comments, so a plain `curl`
 * sees exactly what a browser sees. Netlify runs this on every deploy
 * (netlify.toml [build] command) — including every Decap CMS save, since
 * a save is a commit and a commit triggers a redeploy.
 *
 * It also bakes two CMS-editable blocks of page content for the same reason:
 *   - the About section (data/about.json)  → BUILD:ABOUT markers
 *   - the two home-page YouTube videos (data/videos.json) → BUILD:VIDEOS markers
 * Both used to be (or would otherwise be) static HTML / client-rendered; baking
 * them keeps Conor's edits in the raw response and out of hand-edited HTML.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const SITE = "https://conorpedersonmusic.com";
const ARTIST = "Conor Pederson";
// Site LIVE date per bytomorrow-bos tenant register (doctrine/CLAUDE.md §6),
// not the first commit — the repo had setup commits before actual go-live.
const DATE_PUBLISHED = "2026-07-31";

function abs(path) {
  if (!path) return "";
  return /^https?:\/\//.test(path) ? path : SITE + (path.startsWith("/") ? "" : "/") + path;
}

/* Same visibility rule as main.js's isShowVisible — kept in sync by hand
 * since this is a plain script with no shared module bundling. A show
 * stays listed through the end of the month it happens in. */
function isShowVisible(dateStr, now) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return false;
  const showYm = m[1] * 12 + (+m[2] - 1);
  const nowYm = now.getFullYear() * 12 + now.getMonth();
  return showYm >= nowYm;
}

function isoStart(dateStr, timeStr) {
  const t = /^\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]/.exec(timeStr || "");
  if (!t) return dateStr;
  let h = (+t[1]) % 12;
  if (t[3].toLowerCase() === "p") h += 12;
  return dateStr + "T" + (h < 10 ? "0" + h : h) + ":" + (t[2] || "00");
}

function lastModifiedISO(paths) {
  let latest = null;
  for (const p of paths) {
    let iso = "";
    try {
      iso = execSync(`git log -1 --format=%cI -- ${p}`, { encoding: "utf8" }).trim();
    } catch {
      // no git history available (e.g. shallow checkout) — fall through
    }
    if (iso && (!latest || iso > latest)) latest = iso;
  }
  return latest || new Date().toISOString();
}

function replaceBetweenMarkers(html, marker, content) {
  const re = new RegExp(
    `(<!-- BUILD:${marker}:START -->)[\\s\\S]*?(<!-- BUILD:${marker}:END -->)`
  );
  if (!re.test(html)) {
    throw new Error(`Missing BUILD:${marker} markers in index.html`);
  }
  return html.replace(re, `$1\n${content}\n$2`);
}

function replaceMetaContent(html, propertyOrName, attr, value) {
  const re = new RegExp(
    `(<meta ${attr}="${propertyOrName}" content=")[^"]*(")`
  );
  if (!re.test(html)) {
    throw new Error(`Missing <meta ${attr}="${propertyOrName}"> in index.html`);
  }
  return html.replace(re, `$1${value}$2`);
}

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    // A missing/invalid optional data file must not take the whole deploy down,
    // but it must be visible in the build log (house rule: failures are recorded).
    console.warn(`build: WARNING could not read ${path}: ${err.message}. Using fallback.`);
    return fallback;
  }
}

/* Accepts every link shape Conor is likely to paste from YouTube:
 *   https://youtu.be/ID?si=...      https://www.youtube.com/watch?v=ID
 *   https://youtube.com/shorts/ID   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/live/ID  or just the bare 11-char ID.
 * Returns "" when nothing usable is found. */
function youtubeId(input) {
  const str = String(input || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(str)) return str;
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/.exec(str);
  return m ? m[1] : "";
}

/* Title fallback + best available thumbnail, via YouTube's public oEmbed.
 * Network is best-effort: any failure falls back to what's in the JSON and
 * the always-present hqdefault thumbnail, and the build still succeeds. */
async function youtubeMeta(id) {
  const out = { title: "", thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  if (!id || typeof fetch !== "function") return out;
  const withTimeout = (ms) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return { signal: c.signal, done: () => clearTimeout(t) };
  };
  try {
    const t = withTimeout(5000);
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}&format=json`,
      { signal: t.signal }
    );
    t.done();
    if (r.ok) {
      const j = await r.json();
      if (j && j.title) out.title = String(j.title);
    }
  } catch (err) {
    console.warn(`build: WARNING oEmbed lookup failed for ${id}: ${err.message}`);
  }
  try {
    const t = withTimeout(5000);
    const maxres = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    const r = await fetch(maxres, { method: "HEAD", signal: t.signal });
    t.done();
    if (r.ok) out.thumb = maxres;
  } catch {
    // keep hqdefault
  }
  return out;
}

const shows = JSON.parse(readFileSync("data/shows.json", "utf8")).shows || [];
const releases = JSON.parse(readFileSync("data/music.json", "utf8")).releases || [];

const now = new Date();
const visibleShows = shows
  .filter((s) => isShowVisible(s.date, now))
  .sort((a, b) => (a.date < b.date ? -1 : 1));
const sortedReleases = releases.slice().sort((a, b) => (a.released > b.released ? -1 : 1));
const featured = releases.find((r) => r.featured) || sortedReleases[0];

const about = readJson("data/about.json", null);
const videosData = readJson("data/videos.json", null);

const dateModifiedISO = lastModifiedISO([
  "data/shows.json",
  "data/music.json",
  "data/about.json",
  "data/videos.json",
]);
const dateModified = dateModifiedISO.slice(0, 10);

let html = readFileSync("index.html", "utf8");

/* Social profiles read from the footer so there is one source of truth —
 * same principle main.js used at runtime, now applied at build time. */
const footerMatch = html.match(/class="footer__social"[\s\S]*?<\/nav>/);
const socialLinks = footerMatch
  ? [...footerMatch[0].matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
  : [];

/* ---- videos: resolve IDs + metadata (top-level await; this is an ES module) ---- */
const videoSlots = [];
if (videosData) {
  for (const key of ["left", "right"]) {
    const slot = videosData[key] || {};
    const id = youtubeId(slot.url);
    if (!id) {
      if (slot.url) console.warn(`build: WARNING ${key} video link not recognised as YouTube: ${slot.url}`);
      continue;
    }
    const meta = await youtubeMeta(id);
    videoSlots.push({
      key,
      id,
      label: String(slot.label || "").trim(),
      title: String(slot.title || "").trim() || meta.title || "Watch on YouTube",
      thumb: meta.thumb,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      date: String(slot.date || "").trim(),
    });
  }
}

function artistRef() {
  return { "@type": "MusicGroup", "@id": SITE + "#artist", name: ARTIST, url: SITE };
}

const graph = [
  { "@type": "WebSite", "@id": SITE + "#website", name: "Conor Pederson", url: SITE },
  {
    "@type": "WebPage",
    "@id": SITE + "#webpage",
    url: SITE,
    name: "Conor Pederson — Official Site",
    isPartOf: { "@id": SITE + "#website" },
    about: { "@id": SITE + "#artist" },
    datePublished: DATE_PUBLISHED,
    dateModified,
    ...(featured
      ? { primaryImageOfPage: { "@type": "ImageObject", url: abs(featured.artwork) } }
      : {}),
  },
  {
    "@type": "MusicGroup",
    "@id": SITE + "#artist",
    name: ARTIST,
    url: SITE,
    ...(featured ? { image: abs(featured.artwork) } : {}),
    genre: ["R&B", "Pop", "Hip-Hop"],
    sameAs: socialLinks,
  },
  ...visibleShows.map((s) => {
    const cityParts = String(s.city || "").split(",");
    const offers = {
      "@type": "Offer",
      url: s.ticket_url || SITE + "#shows",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    };
    if (!s.ticket_url) offers.price = "0";
    return {
      "@type": "MusicEvent",
      name: ARTIST + " at " + s.venue,
      startDate: isoStart(s.date, s.time),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      performer: artistRef(),
      url: SITE + "#shows",
      location: {
        "@type": "Place",
        name: s.venue,
        address: {
          "@type": "PostalAddress",
          addressLocality: (cityParts[0] || "").trim(),
          addressRegion: (cityParts[1] || "").trim(),
          addressCountry: "US",
        },
      },
      offers,
    };
  }),
  ...videoSlots.map((v) => ({
    "@type": "VideoObject",
    name: v.title,
    description: (v.label ? v.label + ": " : "") + ARTIST + ", live acoustic performance.",
    thumbnailUrl: [v.thumb],
    contentUrl: v.watchUrl,
    embedUrl: v.embedUrl,
    ...(v.date ? { uploadDate: v.date } : {}),
    creator: artistRef(),
  })),
  ...sortedReleases.map((r) => ({
    "@type": /album|ep/i.test(r.type || "") ? "MusicAlbum" : "MusicRecording",
    name: r.title,
    byArtist: artistRef(),
    datePublished: r.released,
    image: abs(r.artwork),
    url: r.link || SITE + "#music",
  })),
];

// No BreadcrumbList: this site has one indexable page (sitemap.xml), so
// there is no crumb trail to show. No FAQPage: no FAQ content exists on
// the page. Both are genuinely N/A here, not silently skipped.
// JSON.stringify does not escape "<", and the HTML parser ends a <script>
// element on a literal "</script" even inside a JSON string. Every CMS text
// field (venue, title, label, oEmbed title) flows into this block, so escape
// "<" as \u003c: still valid JSON, can never terminate the script element.
const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2)
  .replace(/</g, "\\u003c");

html = replaceBetweenMarkers(
  html,
  "JSONLD",
  `<script type="application/ld+json">\n${jsonLd}\n</script>`
);

html = replaceBetweenMarkers(
  html,
  "DATES",
  `<meta property="article:published_time" content="${DATE_PUBLISHED}">\n` +
    `<meta property="article:modified_time" content="${dateModified}">`
);

/* ---- About section ---- */
if (about) {
  const paragraphs = Array.isArray(about.paragraphs) ? about.paragraphs : [];
  const tall = about.photo_tall || {};
  const wide = about.photo_wide || {};
  const aboutHtml =
    `  <div class="about__grid">\n` +
    (tall.image
      ? `    <figure class="about__photo about__photo--tall reveal">\n` +
        `      <img src="${esc(tall.image)}" alt="${esc(tall.alt)}" loading="lazy">\n` +
        `    </figure>\n`
      : "") +
    `    <div class="about__copy">\n` +
    (about.lede ? `      <p class="about__lede reveal">${esc(about.lede)}</p>\n` : "") +
    paragraphs
      .filter((t) => String(t || "").trim())
      .map((t) => `      <p class="reveal">${esc(t)}</p>\n`)
      .join("") +
    (about.tag ? `      <p class="about__tag reveal"><span class="mono">${esc(about.tag)}</span></p>\n` : "") +
    `    </div>\n` +
    (wide.image
      ? `    <figure class="about__photo about__photo--wide reveal">\n` +
        `      <img src="${esc(wide.image)}" alt="${esc(wide.alt)}" loading="lazy">\n` +
        `    </figure>\n`
      : "") +
    `  </div>`;
  html = replaceBetweenMarkers(html, "ABOUT", aboutHtml);
} else {
  console.warn("build: WARNING data/about.json unavailable. About block left as-is.");
}

/* ---- Watch section (two click-to-play YouTube posters) ---- */
{
  const heading = (videosData && videosData.heading) || "Watch";
  const intro = (videosData && videosData.intro) || "";
  const cards = videoSlots
    .map(
      (v) =>
        `    <article class="video reveal">\n` +
        `      <div class="video__frame" data-video-id="${esc(v.id)}" data-video-title="${esc(v.title)}">\n` +
        `        <button class="video__poster" type="button" aria-label="Play: ${esc(v.title)}">\n` +
        `          <img src="${esc(v.thumb)}" alt="" loading="lazy" width="1280" height="720">\n` +
        `          <span class="video__play" aria-hidden="true"></span>\n` +
        `        </button>\n` +
        `      </div>\n` +
        `      <div class="video__body">\n` +
        (v.label ? `        <p class="video__kicker">${esc(v.label)}</p>\n` : "") +
        `        <h3 class="video__title">${esc(v.title)}</h3>\n` +
        `        <a class="video__link mono" href="${esc(v.watchUrl)}" target="_blank" rel="noopener">Watch on YouTube</a>\n` +
        `      </div>\n` +
        `    </article>`
    )
    .join("\n");
  const watchHtml =
    `  <div class="section__head reveal">\n` +
    `    <span class="section__num">02</span>\n` +
    `    <h2 class="section__title">${esc(heading)}</h2>\n` +
    `  </div>\n` +
    (intro ? `  <p class="watch__intro reveal">${esc(intro)}</p>\n` : "") +
    `  <div class="watch__grid">\n${cards}\n  </div>`;
  html = replaceBetweenMarkers(html, "VIDEOS", watchHtml);
}

if (featured) {
  const artUrl = abs(featured.artwork);
  const altText = `${featured.title} artwork`;
  html = replaceMetaContent(html, "og:image", "property", artUrl);
  html = replaceMetaContent(html, "og:image:alt", "property", altText);
  html = replaceMetaContent(html, "twitter:image", "name", artUrl);
}

/* ---- Cache-busting for CSS/JS ----
 * Cloudflare fronts this site and hands browsers `max-age=14400` on static
 * assets, while the HTML itself is never cached. Without this, every deploy
 * that changes style.css or main.js ships new HTML against a stylesheet the
 * visitor's browser cached up to four hours earlier (2026-09-16: the hero
 * social icons rendered at full width because the new .hero__social rules
 * had not reached the browser yet). A content-hash query string gives each
 * version its own URL, so new HTML always pulls matching assets. */
const BUSTED_ASSETS = ["/assets/css/fonts.css", "/assets/css/style.css", "/assets/js/main.js"];
function bustAssets(source) {
  let out = source;
  for (const asset of BUSTED_ASSETS) {
    const file = asset.slice(1);
    if (!existsSync(file)) continue;
    const hash = createHash("md5").update(readFileSync(file)).digest("hex").slice(0, 10);
    const re = new RegExp(`((?:href|src)=")${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?v=[^"]*)?(")`, "g");
    out = out.replace(re, `$1${asset}?v=${hash}$2`);
  }
  return out;
}
html = bustAssets(html);
writeFileSync("index.html", html);
for (const page of ["thanks.html", "404.html"]) {
  if (!existsSync(page)) continue;
  const src = readFileSync(page, "utf8");
  const busted = bustAssets(src);
  if (busted !== src) writeFileSync(page, busted);
}

console.log(
  `build: og:image -> ${featured ? abs(featured.artwork) : "(no releases)"}, ` +
    `dateModified -> ${dateModified}, ${visibleShows.length} visible show(s), ` +
    `${sortedReleases.length} release(s), ${videoSlots.length} video(s) in JSON-LD, ` +
    `about: ${about ? "baked" : "SKIPPED"}`
);
