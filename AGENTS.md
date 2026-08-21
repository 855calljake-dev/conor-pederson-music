# START HERE: the ByTomorrow gateway

**Before any work in this repo, read the ByTomorrow BOS. Nothing passes without going through it
first.**

- Repo: `855calljake-dev/bytomorrow-bos`
- On this Mac: `~/Projects/bytomorrow-bos/`
- Read: `CLAUDE.md` (or `AGENTS.md` if your harness prefers it). Conor Pederson Music's tenant
  record is in §6. Then `doctrine/SESSION-LEDGER.md` top rows.

That register holds the decisions, the canonical tech stack, and the tenant isolation model.
**Where it and this repo's code disagree, flag the disagreement rather than guessing.** Referenced by
repo name deliberately, never as a hardcoded filesystem path.

## NO EM DASHES. Ever.

Jake's ruling, 2026-08-13, standing and cross-tenant (`bytomorrow-bos` `CLAUDE.md` Hard Rule 7).
No em dash (the `—` character) in anything a reader sees: the page copy, `data/shows.json` and
`data/music.json`, meta descriptions, the docs in this repo. Replace with a comma, or a period,
colon, or parentheses where a comma will not carry the sentence.

- **A content rule, not a data rule.** An em dash inside a URL, a slug, a JSON key, or a stored
  literal value is data. Changing it breaks something and improves nothing. Leave it.
- **Never mass find-and-replace the repo to satisfy this.** Sweep by hand or not at all.
- **There is no code gate here.** Gold Water Fire enforces this in `worker/evidenceGate.mjs` because
  that tenant publishes autonomously. This site has no worker and no drafting pipeline: every word on
  it was written by a person, and this rule is kept by the person writing. Do not assume something is
  checking.

## ORIENT: before touching anything

**Step 0, every session, before reading or writing a single file:**

```bash
git fetch --all --prune && git status -sb && git branch --show-current
```

If the clone is behind, reconcile before reading. Reasoning correctly from a stale file and reaching
a confident wrong conclusion is the failure this prevents, and it is silent.

## What this repo is

**A Tier 1 client site, and deliberately nothing more.** Static HTML, no framework, no build step
beyond one dependency-free Node script, no database, no backend, no CRM. `bytomorrow-bos`
`CLAUDE.md` §3 is explicit that this is the correct engineering choice for a site edited a few times
a month, not a cheaper compromise. **Do not add a framework, a database, or a service to this repo.**
Every added layer is a layer that breaks and has to be maintained, bought for nothing.

- `index.html` is the whole site. `thanks.html` is the form success page.
- Shows and releases render at page load from `data/shows.json` and `data/music.json`.
- `scripts/build.mjs` runs on every Netlify deploy and bakes JSON-LD, freshness dates and
  `og:image` into `index.html`, so crawlers see them without executing JavaScript.
- Decap CMS at `/admin` is how Conor edits. Netlify Forms handles booking. Fonts are self hosted.

**No agentic SEO here.** `SOP-AGENTIC-SEO-WEBSITES.md` governs tenants with a content worker. This
one has no worker, no backlog, and no drafting pipeline, and that is correct for a single-page artist
site rather than a gap to close.

## Traps specific to this repo

**1. The publish directory is `.`, so any file at the repo root is served publicly.**
`netlify.toml` carries `force = true` 404 redirects for `README.md`, `CONOR-GUIDE.md`, `CLAUDE.md`
and this file, for exactly that reason. **Add a matching redirect for any new root-level document**,
or it goes live at `conorpedersonmusic.com/<name>`. `force = true` is required: without it Netlify
serves the real file and skips the rule, because a static file at that path wins by default.

**2. `data/shows.json` and `data/music.json` are Conor's, not yours.** He edits them through
`/admin`, and every save is a commit that triggers a redeploy. A session that rewrites either file
by hand can clobber an edit he made minutes ago. Pull immediately before touching them, and prefer
not touching them at all.

**3. This is a real person's public artist site.** Never invent a show, a venue, a date, a release,
a quote, or a credit. If a fact is not already in the repo or given by Jake or Conor, it does not go
on the page. There is no evidence gate here to catch it.

**4. Exactly one release carries `"featured": true`.** It gets the Latest Release spotlight;
everything else falls to the grid, newest first. Two featured releases is a bug.

**5. Shows expire on their own.** A show stays visible through the end of the month it occurs in,
then disappears via a client-side filter in `assets/js/main.js` (`isShowVisible`). Nobody deletes old
shows, and a session that "cleans up" past shows is undoing a designed behaviour.

**6. A show with a `ticket_url` renders a Tickets button.** Without one it renders the
`ticket_label` badge, which defaults to FREE.

## Where this tenant sits

Registered in `bytomorrow-bos` §6 as slug `conor-pederson-music`, Tier 1, **live since 2026-07-31,
the first Tier 1 client site.** The slug predates the short-slug convention and is deliberately not
renamed: renaming a live tenant's slug touches its repo, subdomain and storage prefix, and is not
worth the churn on a shipped tenant.
