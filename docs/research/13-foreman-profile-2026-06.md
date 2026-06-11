# The SiteProof Foreman — user profile (v1.1, owner-corrected)

Basis: market deep-dive (docs/ux-market-deep-dive-2026-06.md), field-app review
mining + field-worker research (docs/research/12-mobile-overhaul-playbook-2026-06.md §1),
UI lookbook (owner's research pass, 2026-06-11), and owner corrections (Jay,
2026-06-11). This profile is the contract for the foreman mobile shell rebuild:
every screen decision must be defensible against it.

## Who he is
35–55, trade background, 15+ years on civil sites, runs a crew of 4–12 plus
subcontractors. Personal iPhone or mid-range Android in a thick case. Confident
with Maps/WhatsApp/YouTube; not a "software user" — every office-issued app has
been a chore. He didn't choose SiteProof; the company did. His benchmark is a
$2 notebook and his camera roll: the notebook never crashed and never lost a page.

## Physical context
Australian sun (glare), gloves half the time, one hand usually occupied, uneven
ground, patchy/zero signal in cuttings and remote sites. Interrupted every
3–4 minutes. Any flow longer than ~30 seconds WILL be interrupted and must
survive it (autosave everything, resume exactly where he left off).

## His jobs in the app, by frequency (design for the top of this table)
| When | Job | Frequency |
|---|---|---|
| All day | Photos — progress, deliveries, defects, cover-my-arse | 10–30×/day, 5s each |
| All day | Quick diary entries — activity, delay, delivery | 5–15×/day (often deferred to arvo) |
| All day | **Manage lots** — status, what's next on each, the lot's ITP checks; hit hold/witness points with photo evidence | continuous; ITP checks 2–10×/day |
| Whenever | **Docket approvals** — must be ONE tap from home, batch or one-off, his choice | 1–5×/day |
| As needed | **Pull up documents** — drawings/plans/specs assigned to the project or lot, current revision, fast | several ×/day on drawing-heavy jobs |
| When things go wrong | Raise an issue/NCR — photo first, words later | 0–2×/week |
| ~4:30pm | Assemble + submit the diary — THE daily ritual, between him and the drive home | 1×/day |

## Motivations (in order)
1. **Protect himself.** Records are armour for the dispute/inquiry that eventually
   comes. This is the app's real value to HIM (not the office).
2. **Keep the job moving.** Paperwork must never hold up a pour or an inspector.
3. **Get home.** Every prefilled field is a gift; the diary stands between him
   and the ute.
4. **Not look like a fool** in front of crew/subbie/client rep. App freezing
   mid-signature or visible menu-hunting is a one-strike humiliation.

## Fears (violate these and he's back to the notebook forever)
- Losing entered work — once.
- Not knowing whether it saved (sync state must be visible always).
- Being made the office's data-entry clerk.
- Surprise UI reshuffles that break muscle memory.

## What he NEVER does — must not appear in his shell
Progress claims, costs, company settings, user management, ITP template
editing/administration, report configuration. Office surfaces in his UI =
"this app isn't for me."

## Owner corrections (2026-06-11)
- Dockets: approvable WHENEVER — one tap from home, no batching assumption.
- **Lots are central**, not occasional: he manages them; the ITP screens are the
  heart of the lot surface.
- **Documents matter**: he must be able to pull up drawings/plans etc. assigned
  to the project/lot, fast, current revision obvious.
- No prestart/toolbox features. **No new features at all** — the rebuild
  reassembles existing capabilities into a new shell.

## Design consequences
- Home = hub menu; Daily Diary is the hero tile (state-aware label), camera is
  a first-class tile; Lots, Dockets, Issues, Documents one tap away.
- Every flow interruption-proof: autosave + resume; nothing modal that loses
  state.
- Sync chip with exactly three states (Saved ✓ / N waiting ↑ / Syncing…) on
  every screen, same place.
- One filled action per screen, bottom-anchored, state in the label.
- Big titles (sun), ≥48px targets (gloves), back chevron ALWAYS one level up.
- Diary = guided path (weather → crew → work → review), current step glowing,
  submit is a swipe-to-confirm ceremony with honest offline copy.
- ITP run = one item per view, huge tri-state PASS/FAIL/N-A, photo attach inline.
- No FABs, no popovers, no floating chrome, max 2 levels deep.
