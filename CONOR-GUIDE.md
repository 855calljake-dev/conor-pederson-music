# Running Your Site — Conor Pederson Music

Client-facing handoff. Plain-language version of what Conor can change and how.
A styled web version of this document is what gets sent to him.

---

## What you control

Two parts of the site are yours to edit whenever you want:

- **Upcoming Shows** — every date on your calendar.
- **Music** — every release, and which one gets the big spotlight at the top.

Everything else (photos, bio, layout, booking form) stays fixed unless you ask for a change.

## Getting your login — do this once

1. **Create a GitHub account.** Your site's editor uses GitHub to check it's really you. Free,
   two minutes: <https://github.com/signup>. Use an email you actually check, and write the
   username and password down. This is the only login you'll ever need for the site.
2. **Accept the invitation.** Send Jake your GitHub username. He'll send an invite to the email
   on your GitHub account — open it and click **Accept**. Without this the editor won't let you in.
3. **Log in.** Go to `conorpedersonmusic.com/admin`, click **Login with GitHub**, approve the
   permission screen the first time. Bookmark it.

If `conorpedersonmusic.com` doesn't load yet, `conorpedersonmusic.netlify.app/admin` is the
same place.

## Adding a show

**Upcoming Shows** → **Add Shows**.

| Field | What goes in it |
|---|---|
| Date | The night you're playing. |
| Time | Written how you'd say it — `6:00 PM`. Blank if not set. |
| Venue | The room. `Gray's on Main`. |
| City | City and state. `Franklin, TN`. |
| Ticket label | Shows when there's no ticket link. Usually `FREE`. |
| Ticket link | The ticket page address, or blank to use the label instead. |

**Save** (and **Publish** if that button appears). Live in about a minute.

## Adding a release

**Music** → **Add Releases**.

| Field | What goes in it |
|---|---|
| Title | Exactly how you want it spelled. |
| Type | Single, EP, or Album. |
| Release date | The day it drops. Sorts the catalog, newest first. |
| Smart link | The `ffm.to` link, or Spotify/Apple. |
| Artwork | The cover. Square, as large as you have it. |
| Featured | Tick for the release in the big spotlight. |

**Only one release can be featured at a time.** Tick Featured on the new drop, untick it on the
old one. Two featured releases makes the top of the page render wrong.

## Changing or removing something

Open **Upcoming Shows** or **Music** and everything currently on the site is listed.

- **Change** — click it, edit, Save.
- **Remove** — click the trash/minus icon next to it in the list, then Save.
- **Reorder releases** — not needed, release date sorts them.

Nothing in the editor can break the design. Worst case is a typo.

## What the site handles on its own

- **Old shows disappear automatically.** A show stays up through the end of the month it happens
  in, then drops off. An August 25 date is visible through August 31 and gone on September 1.
- **Booking requests arrive by email** at `conorpedersonmusic@gmail.com` — name, email, phone,
  event date, location, message. Reply like a normal email.

## If something looks wrong

| Symptom | Cause / fix |
|---|---|
| Saved a change, site unchanged | Wait two minutes, hard-refresh. Still nothing after five, tell Jake. |
| Won't let me log in | Invitation not accepted yet, or signed into a different GitHub account in that browser. |
| Wrong release in the spotlight | Two releases ticked Featured, or none. Exactly one. |
| My show is missing | Check the date — shows expire once their month ends, so a wrong year/month may already be gone. |
| Want a photo or bio changed | Not in the editor on purpose. Send Jake the change. |
