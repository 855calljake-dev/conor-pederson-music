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

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const SITE = "https://conorpedersonmusic.com";
const ARTIST = "Conor Pederson";
// Site LIVE date per bytomorrow-bos tenant register (doctrine/CLAUDE.md §6),
// not the first commit — the repo had setup commits before actual go-live.
const DATE_PUBLISHED = "2026-07-31";

// Pittsburgh, PA — home base for the confirmed ~100-mile service radius
// (SOP-AGENTIC-SEO-WEBSITES.md §1: "confirmed service area... never assumed
// or inferred from an address" — this center point and radius were
// confirmed directly, not guessed from the "Pittsburgh native" bio line).
const SERVICE_RADIUS_METERS = "160934"; // 100 miles
const SERVICE_GEO = { latitude: 40.4406, longitude: -79.9959 };

function abs(path) {
  if (!path) return "";
  return /^https?:\/\//.test(path) ? path : SITE + (path.startsWith("/") ? "" : "/") + path;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
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

/* Shared nav + footer, extracted from the one page that hand-authors them
 * (index.html) BEFORE any of the mutations below touch `html`, so every
 * generated sub-page below reuses the exact same markup — one place to
 * fix the logo, nav links, or footer, per SOP-AGENTIC-SEO-WEBSITES.md §4
 * ("header, nav, footer... live in exactly one place"). */
const NAV_HTML = (html.match(/<header class="nav"[\s\S]*?<\/header>/) || [""])[0];
const FOOTER_HTML = (html.match(/<footer class="footer">[\s\S]*?<\/footer>/) || [""])[0];

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

/* ---------------------------------------------------------------------
 * Sub-pages: content as data (SOP-AGENTIC-SEO-WEBSITES.md §4). Each file
 * in data/pages/*.json is one page; this shell renders all of them with
 * the SAME nav/footer captured above, so NAP and brand markup can't drift
 * between the homepage and these pages. First batch per §5's cadence:
 * a booking hub, two service/vertical pages (weddings, college events —
 * both evidence-gate-cleared per §2, not invented), and two educational
 * guides (zero experience-claim risk).
 * ------------------------------------------------------------------- */

const HEAD_ASSETS = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="/assets/css/style.css">`;

function renderCrumbs(breadcrumb) {
  const items = [{ name: "Home", path: "/" }, ...(breadcrumb || [])];
  const parts = items.map((it, i) => {
    if (i === items.length - 1) {
      return `<span aria-current="page">${esc(it.name)}</span>`;
    }
    return `<a href="${esc(it.path)}">${esc(it.name)}</a>`;
  });
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join('<span aria-hidden="true">/</span>')}</nav>`;
}

function renderFaqSection(faqs) {
  if (!faqs || !faqs.length) return "";
  return `<section class="faq section">
  <div class="section__head reveal">
    <h2 class="section__title" style="font-size: clamp(1.8rem, 4vw, 2.6rem);">Questions</h2>
  </div>
  ${faqs
    .map(
      (f) => `<div class="faq__item reveal">
    <p class="faq__q">${esc(f.q)}</p>
    <p class="faq__a">${esc(f.a)}</p>
  </div>`
    )
    .join("\n  ")}
</section>`;
}

function renderBookingCta(page) {
  const related = page.relatedPath
    ? `<p class="reveal" style="margin-bottom:1.6rem;"><a class="btn btn--ghost" href="${esc(page.relatedPath)}">${esc(page.relatedLabel || "Book Conor")} →</a></p>`
    : "";
  return `<section class="booking section" id="booking">
  <div class="section__head reveal">
    <span class="section__num">→</span>
    <h2 class="section__title">Book Conor</h2>
  </div>
  ${related}
  <div class="booking__grid">
    <div class="booking__blurb reveal">
      <p>Send the details and you'll hear back soon — direct, no marketplace fee.</p>
      <p class="mono booking__email"><a href="mailto:conorpedersonmusic@gmail.com">conorpedersonmusic@gmail.com</a></p>
    </div>
    <form class="form reveal" name="booking" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thanks.html">
      <input type="hidden" name="form-name" value="booking">
      <p class="hidden-field"><label>Don't fill this out: <input name="bot-field"></label></p>
      <div class="form__row">
        <label class="form__field"><span>Name</span>
          <input type="text" name="name" required autocomplete="name">
        </label>
        <label class="form__field"><span>Email</span>
          <input type="email" name="email" required autocomplete="email">
        </label>
      </div>
      <div class="form__row">
        <label class="form__field"><span>Phone</span>
          <input type="tel" name="phone" autocomplete="tel">
        </label>
        <label class="form__field"><span>Event date</span>
          <input type="date" name="event_date">
        </label>
      </div>
      <div class="form__row">
        <label class="form__field"><span>Event location / venue</span>
          <input type="text" name="event_location">
        </label>
        <label class="form__field"><span>Type of event</span>
          <input type="text" name="event_type" placeholder="Wedding, college event, private party…">
        </label>
      </div>
      <label class="form__field"><span>Message</span>
        <textarea name="message" rows="5" placeholder="Tell Conor about the event…"></textarea>
      </label>
      <button class="btn btn--primary form__submit" type="submit">Send Booking Request</button>
    </form>
  </div>
</section>`;
}

function renderHubGrid(links) {
  if (!links || !links.length) return "";
  return `<div class="hub__grid">
  ${links
    .map(
      (l) => `<a class="hub__card reveal" href="${esc(l.path)}">
    <h3>${esc(l.title)}</h3>
    <p>${esc(l.blurb)}</p>
  </a>`
    )
    .join("\n  ")}
</div>`;
}

function buildPageGraph(page, url, pageDateModified) {
  const graph = [
    {
      "@type": "WebPage",
      "@id": url + "#webpage",
      url,
      name: page.title,
      description: page.metaDescription,
      isPartOf: { "@id": SITE + "#website" },
      about: { "@id": SITE + "#artist" },
      datePublished: page.datePublished,
      dateModified: pageDateModified,
      primaryImageOfPage: { "@id": url + "#heroimage" },
    },
    {
      "@type": "ImageObject",
      "@id": url + "#heroimage",
      url: abs(page.heroImage),
      contentUrl: abs(page.heroImage),
      caption: page.heroImageAlt,
    },
    {
      "@type": "BreadcrumbList",
      "@id": url + "#breadcrumb",
      itemListElement: [{ name: "Home", path: "/" }, ...(page.breadcrumb || [])].map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: abs(it.path),
      })),
    },
  ];
  if (page.serviceType) {
    graph.push({
      "@type": "Service",
      "@id": url + "#service",
      name: page.serviceType,
      serviceType: page.serviceType,
      provider: { "@id": SITE + "#artist" },
      areaServed: {
        "@type": "GeoCircle",
        geoMidpoint: { "@type": "GeoCoordinates", ...SERVICE_GEO },
        geoRadius: SERVICE_RADIUS_METERS,
      },
      url,
    });
  }
  if (page.faqs && page.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": url + "#faq",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return graph;
}

function renderSubPage(page, pageDateModified) {
  const url = SITE + page.path;
  const ogImageUrl = abs(page.heroImage);
  const graph = buildPageGraph(page, url, pageDateModified);
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.metaDescription)}">
<link rel="canonical" href="${url}">

<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.metaDescription)}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:alt" content="${esc(page.heroImageAlt)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Conor Pederson">
<meta property="article:published_time" content="${page.datePublished}">
<meta property="article:modified_time" content="${pageDateModified}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.metaDescription)}">
<meta name="twitter:image" content="${ogImageUrl}">

${HEAD_ASSETS}
<script type="application/ld+json">
${jsonLd}
</script>
</head>
<body>

<div class="noise" aria-hidden="true"></div>

${NAV_HTML}

<section class="page-hero">
  ${renderCrumbs(page.breadcrumb)}
  <p class="hero__kicker reveal">${esc(page.kicker)}</p>
  <h1 class="page-hero__title reveal">${esc(page.h1)}</h1>
</section>

<section class="section page-content">
  <figure class="page-content__photo reveal">
    <img src="${esc(page.heroImage)}" alt="${esc(page.heroImageAlt)}" loading="lazy">
  </figure>
  <div class="about__copy">
    ${page.intro}
    ${(page.sections || [])
      .map((s) => `<h2 class="page-content__h2 reveal">${esc(s.heading)}</h2>\n    ${s.body}`)
      .join("\n    ")}
  </div>
  ${page.links ? renderHubGrid(page.links) : ""}
</section>

${renderFaqSection(page.faqs)}

${renderBookingCta(page)}

${FOOTER_HTML}

<script src="/assets/js/main.js" defer></script>
</body>
</html>
`;
}

const pageEntries = readdirSync("data/pages")
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({
    file: `data/pages/${f}`,
    data: JSON.parse(readFileSync(`data/pages/${f}`, "utf8")),
  }));
const pages = pageEntries.map((e) => e.data);

for (const { file, data: page } of pageEntries) {
  const pageDateModified = lastModifiedISO([file]).slice(0, 10);
  const outDir = `.${page.path}`; // e.g. "./booking/weddings/"
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}index.html`, renderSubPage(page, pageDateModified));
}

/* sitemap.xml generated from the content directory, never hand-edited
 * (SOP-AGENTIC-SEO-WEBSITES.md §4). */
const sitemapUrls = [
  { loc: SITE + "/", changefreq: "weekly", priority: "1.0" },
  ...pages.map((p) => ({
    loc: SITE + p.path,
    changefreq: "monthly",
    priority: p.path === "/booking/" ? "0.8" : "0.7",
  })),
];
const sitemapXml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemapUrls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join("\n") +
  `\n</urlset>\n`;
writeFileSync("sitemap.xml", sitemapXml);

console.log(
  `build: og:image -> ${featured ? abs(featured.artwork) : "(no releases)"}, ` +
    `dateModified -> ${dateModified}, ${visibleShows.length} visible show(s), ` +
    `${sortedReleases.length} release(s) in JSON-LD, ` +
    `${pages.length} sub-page(s) generated, sitemap.xml has ${sitemapUrls.length} url(s)`
);
