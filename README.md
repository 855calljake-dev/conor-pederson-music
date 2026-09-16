# Conor Pederson Music — conorpedersonmusic.com

Official artist site for Conor Pederson. Static site with one tiny prebuild step (`scripts/build.mjs`, plain Node, no deps), deployed on Netlify.
Tenant slug: `conor-pederson-music`.

## Stack

- Plain HTML/CSS/JS — `index.html` is the whole site; `thanks.html` is the form success page.
- **Shows** and **Music** render from `data/shows.json` and `data/music.json` at page load.
- **About** (`data/about.json`) and the two home-page **Videos** (`data/videos.json`) are baked
  into `index.html` at build time by `scripts/build.mjs`, between `BUILD:ABOUT` / `BUILD:VIDEOS`
  marker comments, so the bio text and video markup are in the raw HTML for crawlers. The same
  script bakes JSON-LD (incl. `VideoObject`), freshness dates, and og:image. Don't hand-edit
  between markers; edit the JSON and run `node scripts/build.mjs`.
- **Videos** are click-to-play: a YouTube poster image + play button; `main.js` swaps in the
  `youtube-nocookie.com` player on click. Nothing from YouTube loads until then. Any YouTube link
  shape works (`youtu.be/ID`, `watch?v=ID`, `shorts/ID`, `embed/ID`, or a bare ID); a blank title
  is filled from YouTube oEmbed at build time (best-effort, never fails the build).
- **Decap CMS** at `/admin` gives Conor a form-based editor for all four files (edits commit to
  this repo, which triggers a Netlify redeploy).
- **Netlify Forms** handles the booking form (`name="booking"`), no server needed.
- Fonts are self-hosted (`assets/fonts/`, via Fontsource) — no third-party font requests.

## Behavior rules

- A show stays on the site **through the end of the month it occurs in**, then disappears
  automatically (client-side filter in `assets/js/main.js` → `isShowVisible`). No one has to
  delete old shows.
- The release marked `"featured": true` gets the big "Latest Release" spotlight; all others
  go to the grid, newest first. Keep exactly one release featured.
- A show with a `ticket_url` shows a **Tickets** button; without one it shows the
  `ticket_label` badge (default **FREE**).

## One-time setup (Jake)

1. **Repo:** push this folder to GitHub as `<org>/conor-pederson-music`, default branch `main`.
2. **Netlify:** New site from Git → pick the repo. Build command: *none*. Publish directory: `.`
   (also declared in `netlify.toml`).
3. **Forms:** after the first deploy, Netlify auto-detects the `booking` form.
   Site configuration → Forms → Form notifications → add **Email notification** to
   `conorpedersonmusic@gmail.com`. Submit a test booking and confirm the email arrives —
   the form is not "done" until that email is in the inbox.
4. **CMS auth:** Site configuration → Access & security → OAuth → **Install provider** →
   GitHub (create the GitHub OAuth App when prompted; callback URL is
   `https://api.netlify.com/auth/done`). Then edit `admin/config.yml` and replace
   `REPO_PLACEHOLDER` with the real `org/repo`. Conor logs in at `/admin` with his GitHub
   account — add him as a collaborator on the repo (write access).
5. **Domain:** register `conorpedersonmusic.com` (matches all his @conorpedersonmusic
   handles). Netlify → Domain management → add domain → point DNS (CNAME `www` →
   `<site>.netlify.app`, ALIAS/A for apex per Netlify's instructions). HTTPS is automatic.
6. Update `site_url` in `admin/config.yml` if the domain differs.

## Editing (Conor)

Go to **conorpedersonmusic.com/admin**, log in with GitHub.

- **Upcoming Shows** → add a show: date, time, venue, city, and either a ticket link or a
  label like FREE. Save + publish. The site updates in ~1 minute. Old shows remove themselves
  after their month ends.
- **Music** → add a release: title, type, release date, the ffm.to smart link, artwork upload.
  Tick **Featured** on the new one and untick it on the previous one.
- **Videos (home page)** → paste a YouTube link into **Left video** / **Right video**. Optional
  title and label (Original / Cover). Heading + intro line above them are editable too.
- **About section** → opening line, paragraphs (list), tag line, portrait photo, wide photo.

## Later (already structured for it)

- **Merch**: add `data/merch.json`, a section in `index.html`, a render function in
  `main.js`, and a collection in `admin/config.yml`, the same pattern as shows/music.
- **More than two videos**: `data/videos.json` is two named slots on purpose (Conor asked for
  left/right). Turning it into a list is a small change in `admin/config.yml` + `build.mjs`.
- **Finnmax**: bio mention goes in the About section once the news is public.
