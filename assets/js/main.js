/* Conor Pederson — site logic
   Shows + music render from /data/*.json so they can be edited
   from the CMS (/admin) without touching code. */

/** A show stays visible through the END of the month it occurs in.
 *  e.g. a 2026-08-25 show displays until 2026-08-31 23:59, then disappears.
 *  Pure function so it can be unit-tested. */
function isShowVisible(dateStr, now) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return false; // malformed date: hide rather than show stale info
  var showYm = m[1] * 12 + (+m[2] - 1);
  var nowYm = now.getFullYear() * 12 + now.getMonth();
  return showYm >= nowYm;
}

function fmtShowDate(dateStr) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  var months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return { day: m[3].replace(/^0/, ""), mon: months[+m[2] - 1], year: m[1] };
}

function fmtReleaseDate(dateStr) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return months[+m[2] - 1] + " " + (+m[3]) + ", " + m[1];
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ---------- shows ---------- */
function renderShows(data) {
  var list = document.getElementById("shows-list");
  var empty = document.getElementById("shows-empty");
  if (!list) return;
  var now = new Date();
  var shows = (data.shows || [])
    .filter(function (s) { return isShowVisible(s.date, now); })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

  if (!shows.length) { empty.hidden = false; return; }

  list.innerHTML = shows.map(function (s) {
    var d = fmtShowDate(s.date);
    var cta = s.ticket_url
      ? '<a class="btn btn--ghost" href="' + esc(s.ticket_url) + '" target="_blank" rel="noopener">Tickets</a>'
      : '<span class="badge">' + esc(s.ticket_label || "FREE") + "</span>";
    return (
      '<article class="show reveal">' +
        '<div class="show__date"><b>' + d.day + "</b><span>" + d.mon + "</span><em>" + d.year + "</em></div>" +
        '<div><h3 class="show__venue">' + esc(s.venue) + "</h3>" +
        '<p class="show__meta">' + esc(s.city) + (s.time ? " · " + esc(s.time) : "") + "</p></div>" +
        '<div class="show__cta">' + cta + "</div>" +
      "</article>"
    );
  }).join("");
  observeReveals(list);
}

/* ---------- music ---------- */
function renderMusic(data) {
  var featBox = document.getElementById("music-featured");
  var grid = document.getElementById("music-grid");
  if (!grid) return;
  var releases = (data.releases || []).slice()
    .sort(function (a, b) { return a.released > b.released ? -1 : 1; });

  var featured = releases.filter(function (r) { return r.featured; })[0] || releases[0];
  var rest = releases.filter(function (r) { return r !== featured; });

  if (featured && featBox) {
    featBox.innerHTML =
      '<div class="feat reveal">' +
        '<div class="feat__art"><span class="feat__label">Latest Release</span>' +
        '<img src="' + esc(featured.artwork) + '" alt="' + esc(featured.title) + ' artwork" loading="lazy"></div>' +
        "<div>" +
          '<p class="feat__kicker">' + esc(featured.type) + " · " + fmtReleaseDate(featured.released) + "</p>" +
          '<h3 class="feat__title">' + esc(featured.title) + "</h3>" +
          '<p class="feat__meta">Out now on all platforms.</p>' +
          '<a class="btn btn--primary" href="' + esc(featured.link) + '" target="_blank" rel="noopener">Listen Now</a>' +
        "</div>" +
      "</div>";
  }

  grid.innerHTML = rest.map(function (r) {
    return (
      '<a class="release reveal" href="' + esc(r.link) + '" target="_blank" rel="noopener">' +
        '<div class="release__art"><img src="' + esc(r.artwork) + '" alt="' + esc(r.title) + ' artwork" loading="lazy"></div>' +
        '<div class="release__body">' +
          '<h3 class="release__title">' + esc(r.title) + "</h3>" +
          '<p class="release__meta">' + esc(r.type).toUpperCase() + " · " + fmtReleaseDate(r.released) + "</p>" +
          '<span class="release__listen">Listen</span>' +
        "</div>" +
      "</a>"
    );
  }).join("");
  if (featBox) observeReveals(featBox);
  observeReveals(grid);
}

/* Structured data (JSON-LD) is generated at build time, not here — see
   scripts/build.mjs. AI crawlers don't reliably execute client-side JS
   (SOP-AGENTIC-SEO-WEBSITES.md §3.1), so injecting it from this file would
   be invisible to them; it's baked into index.html's raw HTML instead. */

/* ---------- reveal-on-scroll ---------- */
var io = null;
function observeReveals(root) {
  var els = (root || document).querySelectorAll(".reveal:not(.is-in)");
  if (!("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }
  if (!io) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
  }
  els.forEach(function (el) { io.observe(el); });
}

/* ---------- boot ---------- */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("year").textContent = new Date().getFullYear();
    observeReveals(document);

    fetch("/data/shows.json").then(function (r) { return r.json(); }).then(renderShows)
      .catch(function () { document.getElementById("shows-empty").hidden = false; });
    fetch("/data/music.json").then(function (r) { return r.json(); }).then(renderMusic)
      .catch(function () {});
  });
}

/* export for tests (node) */
if (typeof module !== "undefined") { module.exports = { isShowVisible: isShowVisible }; }
