# Running Your Site — Conor Pederson Music

Client-facing handoff. Plain-language version of what Conor can change and how.
A styled web version of this document is what gets sent to him.

---

## What you control

Four parts of the site are yours to edit whenever you want:

- **Upcoming Shows** — every date on your calendar.
- **Music** — every release, and which one gets the big spotlight at the top.
- **Videos (home page)**: the two YouTube videos in the Watch section.
- **About section**: your bio text and the two photos next to it.

Everything else (layout, hero photo, booking form) stays fixed unless you ask for a change.

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

## Changing the videos

**Videos (home page)**. Two slots: **Left video** and **Right video**. On a phone the left one shows first.

| Field | What goes in it |
|---|---|
| YouTube link | Paste the link straight from YouTube. The Share link (`youtu.be/...`), the normal address (`youtube.com/watch?v=...`), or a Shorts link all work. |
| Title | What shows under the video. Leave blank and the site uses the title from YouTube. |
| Label | Small tag above the title: `Original`, `Cover`, `Live`. Optional. |

**Section heading** and **Intro line** are the text above the two videos. **Save** and the new video is live in about a minute.

Videos play right on your page when someone presses play. They don't get sent off to YouTube. On a phone the two sit side by side, and an **Expand** button under each one takes it full screen.

## Editing your About section

**About section**.

| Field | What goes in it |
|---|---|
| Opening line | The big first sentence. |
| Paragraphs | The rest of the bio. One paragraph per item. **Add Paragraph** for a new one, the arrows reorder, the trash icon removes. |
| Tag line | The small boxed label under the bio (`VOCALS + ACOUSTIC GUITAR`). Blank hides it. |
| Portrait photo (left) | Upload a tall/upright photo. The site crops it to fit, keeping the top-middle in view, so photos where you're centred and not tiny work best. |
| Wide photo (bottom right) | Upload a landscape photo. |
| Describe the photo | A short plain description of each photo. It's read out by screen readers and read by search engines. |

## Changing or removing something

Open **Upcoming Shows** or **Music** and everything currently on the site is listed. **Videos** and **About section** open straight to their fields.

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
| Video shows a black box or "unavailable" | The link isn't a YouTube video link, or the video is private/unlisted-off on YouTube. Paste the Share link from the video page and make sure the video is Public or Unlisted. |
| About photo looks cropped wrong | Upload a photo where you're near the centre. Tall/upright for the left slot, wide for the right slot. |
| Want the hero photo or layout changed | Not in the editor on purpose. Send Jake the change. |
