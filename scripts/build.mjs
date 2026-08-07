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
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

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

const shows = JSON.parse(readFileSync("data/shows.json", "utf8")).shows || [];
const releases = JSON.parse(readFileSync("data/music.json", "utf8")).releases || [];

const now = new Date();
const visibleShows = shows
  .filter((s) => isShowVisible(s.date, now))
  .sort((a, b) => (a.date < b.date ? -1 : 1));
const sortedReleases = releases.slice().sort((a, b) => (a.released > b.released ? -1 : 1));
const featured = releases.find((r) => r.featured) || sortedReleases[0];

const dateModifiedISO = lastModifiedISO(["data/shows.json", "data/music.json"]);
const dateModified = dateModifiedISO.slice(0, 10);

let html = readFileSync("index.html", "utf8");

/* Social profiles read from the footer so there is one source of truth —
 * same principle main.js used at runtime, now applied at build time. */
const footerMatch = html.match(/class="footer__social"[\s\S]*?<\/nav>/);
const socialLinks = footerMatch
  ? [...footerMatch[0].matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
  : [];

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
const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);

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

if (featured) {
  const artUrl = abs(featured.artwork);
  const altText = `${featured.title} artwork`;
  html = replaceMetaContent(html, "og:image", "property", artUrl);
  html = replaceMetaContent(html, "og:image:alt", "property", altText);
  html = replaceMetaContent(html, "twitter:image", "name", artUrl);
}

writeFileSync("index.html", html);

console.log(
  `build: og:image -> ${featured ? abs(featured.artwork) : "(no releases)"}, ` +
    `dateModified -> ${dateModified}, ${visibleShows.length} visible show(s), ` +
    `${sortedReleases.length} release(s) in JSON-LD`
);
