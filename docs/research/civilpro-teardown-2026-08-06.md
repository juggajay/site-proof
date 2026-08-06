# CivilPro full product teardown — 2026-08-06

**Method.** CivilPro's Zendesk help centre blocks browsers via Cloudflare but its JSON API is open.
We crawled all **336 KB articles** (~159k words, every section, web + desktop trees), extracted all
embedded video IDs, and pulled **auto-caption transcripts for 23 of 24 tutorial/webinar videos**
(~38.5k words), including their **Spatial Introductory Webinar** (9.5k words, founder on record about
roadmap) and both Progress Claim tutorials. One Vimeo video was also downloaded and frame-sampled to
verify UI reading works. Six module analyses were then produced from the full corpus.

**Detailed per-module findings** (feature mechanics, UX flows, data models, full steal/exploit lists)
live in [`civilpro-teardown-2026-08-06/`](civilpro-teardown-2026-08-06/):

| File | Covers |
|---|---|
| [spatial.md](civilpro-teardown-2026-08-06/spatial.md) | Plans, registration, control lines, snapshots, GeoPDF, 3D/4D roadmap |
| [lots-qa-registers.md](civilpro-teardown-2026-08-06/lots-qa-registers.md) | Lot numbering, lifecycle, Lot Review, sub-lots, QA setup, REPO |
| [itp-holdpoints-tests.md](civilpro-teardown-2026-08-06/itp-holdpoints-tests.md) | ITP import/AI prompt, checklists, hold points, QR release, tests, signatures |
| [ncr-punchlist-field.md](civilpro-teardown-2026-08-06/ncr-punchlist-field.md) | NCR lifecycle, punchlists, site diary, instructions, incidents |
| [claims-payment-cost.md](civilpro-teardown-2026-08-06/claims-payment-cost.md) | Schedule, quantities, claims, certification, cost mgmt, forecasts |
| [platform-ux-admin.md](civilpro-teardown-2026-08-06/platform-ux-admin.md) | Architecture, roles/seats, views, notifications, API, SSO, billing |

Relation to prior work: extends `international-competitor-research-2026-07-14.md` (feature-list
level) down to mechanics, workflows and documented weaknesses, all cited to their own KB/videos.

---

## 1. What CivilPro actually is

- **Two clients over one single-tenant Azure SQL database per customer**: a .NET Windows Desktop app
  (ClickOnce, connects directly to SQL) and an Angular web app ("Cloud"). Nearly every KB article is
  duplicated as `Article` / `Article (D)` with drifting content. Neither client is complete: cost
  management, transmittals, site diary review, and admin password reset are **Desktop-only**; email
  invites and project custom views are **web-only**.
- **The product's real moat is a dependency chain, not a screen**:
  `lot conformance status → lot % complete → effective quantity (× RPF × NC) → claim snapshot →
  claim value/budget → cost-code rollup → forecast/P&L`. A site engineer conforming a lot moves
  reported gross margin with no accountant in the loop.
- **Second moat: seeded content.** Every subscription ships a `REPO` template project with Work
  Types, Test Methods and an ITP library **based on QLD TMR specs** (single-jurisdiction).
- **Commercially**: part of the Herga group (Trimble reseller ecosystem — BuildingPoint, Sitech,
  UPG). Tier-1 reference list (TMR, RMS, Fulton Hogan, Georgiou, Ventia, councils). Annual
  invoice-based billing, nothing self-serve, à-la-carte upsells everywhere (SAML $500+$500/yr,
  Power BI $550–950/yr, signatures $495–995/yr after free tier, Azure DB tier passed through at
  S0 $1,980 → S2 $5,940/yr — every customer starts on the slowest tier). Exit is hostile: no
  self-serve export; cancellation options are ~$50/mo data hosting, paid dev-time backup, or
  irrecoverable deletion.
- **Free-seat model mirrors ours**: "Associate" users (view-only roles + "Collaborate" authorities)
  are free and unlimited ("for now"), which is how approvers, testers and client reps get in. Their
  seat class is *derived from the role's permission matrix* and shown at invite time.

## 2. Spatial — the direct moat collision (shipped 10 Mar 2026)

What they shipped: register multi-sheet PDF drawing sets with 2–3 manual registration points per
sheet (or GeoPDF auto-registration), control lines imported by clipboard, lots defined by
chainage+offset that **auto-generate polygons**, geometry stored in world coordinates with plans as
swappable backdrops, spatial find/search, plan snapshots embedded in conformance/TR reports, Google
Maps + drone imagery layers.

**Their setup path is the weakness** — a nine-step manual ladder: read CRS off the title block,
**screenshot setout tables into ChatGPT/Gemini for OCR** (their official *preferred* method),
clipboard-import, per-sheet registration clicks with zero accuracy feedback, hand-traced perimeter
per sheet (required even for GeoPDFs), post-hoc curve smoothing by dragging vertices. AutoCAD/Civil
3D **cannot produce GeoPDFs** per their own support matrix, so manual registration is the real
workflow for most of the AU market. Drone imagery requires customers to install and learn **QGIS**.
They productised the friction: drawing import and training are sold as quoted services.

**Only Lots, Test Requests and Photos are spatial.** No hold points, NCRs, defects, diary entries or
dockets on the map. Photos locate via EXIF only (~6 months of history). No GPS "you are here", no
field capture, no offline plans.

**Roadmap (founder, on record, March 2026):** procedurally generated **3D/4D "how-constructed
models"** — 2D lot geometry cookie-cut through a TIN, IFC-only output with conformance metadata,
links to design-model UIDs, lot dates as the 4th dimension. Driver: **TMR requiring conformance data
in handover models**. Alpha targeted mid-April, GA "early second half" of 2026. This is where they
are heading; 2D was explicitly a stepping stone.

## 3. Field / mobile / offline — their kill zone (our wedge)

The single largest structural gap, consistent across all six modules:

- "Mobile" = the web app in a phone browser. **No offline anything** — their own advice: go offline
  (Desktop local DB, unsyncable) only if >70% of the project has no connectivity.
- Documented best-practice defect capture is **paper**: print A3 drawings, mark defects with a pen,
  scan to PDF, attach the scan as a dummy punchlist line item with all approval gates switched off.
  They recommend a third-party app (**Solocator**) for photo geotagging.
- Pre/post punchlist photos are a **naming convention** (" - Pre"/" - Post" suffixes, Windows
  folders), not a data model. Nothing gates Check on a post photo existing.
- Diary is created on web but **reviewed on Desktop only** — no cost data reaches any report until
  someone opens a Windows app.
- No NCR-from-the-field story anywhere: failures found on site are recorded at a desk, from memory.

Everything SiteProof has already shipped here — GPS lot detection, photo pins, fail-photo gate,
offline stage 1, voice capture, one web app on any device — attacks this directly. It is a
positioning line, not just parity.

## 4. Steal list (ranked, cross-module)

Things they got right that we should adopt or match:

1. **Lot Review as a second, configurable status axis** orthogonal to lot status — project-authored
   statuses with 7 behaviour flags (incl. `Is Public` vs `Is Reported`, `Allows Synch` as an
   integration trigger), immutable attributed history, client-collaborator seat. Solves "who has the
   ball" — the best single idea in the corpus.
2. **Guaranteed lot status + Unguarantee-by-Age** — first-class "complete and compliant, awaiting
   28-day results" state that claims at 100%, with a bulk decay sweep (and a claim-time prompt).
   Honest modelling of real contractor behaviour; we have no equivalent.
3. **ITP test frequencies with auto-calculated counts** — per-ITP-row test methods carry freq
   (normal/reduced), min-per-lot floor, and quantity basis (lot length/area/volume); test request
   counts compute from lot geometry with the floor honoured. Needs exactly the spatial data we
   already hold.
4. **Effective Quantity as one visible formula** (`Qty × Eff% × RPF × NC`) — with **Reduced Payment
   Factor** (numeric consequence of conditional acceptance; bridges NCR → claim) and
   **Non-Claimable** (track for QA, exclude from claim). Pure data-compiler mechanics — no dollars
   needed.
5. **Conform gate as computed precondition** — outstanding NCRs/TRs block conformance (their
   sufficiency gate, shipped). Ours must be non-defeatable-silently: their gate can be switched off
   in project settings with no visible marker on bypassed conforms.
6. **Three-gate Check → Verify → Approve with per-item "Not Required"** + strict reverse-order undo
   (can't unverify until approval removed). Maps exactly to AU civil sign-off.
7. **QR hold-point release** — approver scans, signs in, one Approve button. We should ship it *with*
   a first-class register record (theirs deliberately creates none — thin traceability).
8. **Handover gates + revocable cryptographic PDF signatures** — status/review transitions embed
   real PKI signatures in conformance reports; un-conforming revokes them from future exports.
9. **Chainage definition auto-generating real polygons** (control line + ch range + offsets) and
   **world-coordinate geometry with plans as swappable backdrops** — copy both invariants verbatim
   into our spatial model.
10. **Snapshot/lot-map embedded in the test request PDF sent to the testing subbie** — highest
    value-per-line-of-code spatial feature; analogous for NCRs and hold-point notices.
11. **Magic view names (`Default`, `Mobile`) + push-a-saved-view-to-a-user + per-user Start
    Register** — zero-UI personalisation that turns a reluctant client rep into a functioning user.
12. **Standing approvals** (mix designs/quarry certs approved once, referenced by many checklists) —
    but built properly: theirs still needs a manual per-row release with the approval number typed
    into free text. Auto-satisfy + structural reference + expiry-aware revocation beats it.
13. **Comment templates with tables** as default review comments; **compliance text carried
    ITP → checklist → TR PDF → result review**.
14. **Conformance Folio** — handover as a structured folder tree (ours should be a stored artefact /
    share link, not a path on someone's laptop).
15. **"Costs come from field capture, not invoices"** — their daycost-over-invoice philosophy is our
    diary/docket argument, made on the cost side; adopt the argument, not the module.
16. **Revenue is never forecast** ("it is already known" = QAC × sell rate) — derive everything,
    estimate exactly one thing. A principle worth keeping even though we stay off the money side.

## 5. Exploit list (positioning wedges, all citable to their own docs)

1. **ITP import.** Their official method: un-merge cells by hand, Alt+Enter per row, CSV-UTF8,
   manual column mapping, then set Item Type + Check Type **manually on every row** (both default
   silently). Their escape hatch is a 2,000-word ChatGPT prompt (updated 2026-08-04) whose output
   must be saved via **Notepad** and never opened in Excel. Server-side AI ingest with a review diff
   is a direct migration pitch — and aligns with the Wave 2 ITP work.
2. **No lot hierarchy.** "How to Manage Sub Lots" opens by admitting it doesn't exist; workarounds
   are display-only links and typing the parent's name into a filter row. Native parent/child with
   roll-up is a straight win.
3. **No spatial QA state and no coverage validation.** Nothing renders open hold points/NCRs/tests
   on a map; nothing detects lot overlap or chainage gaps. Same data, missing modality — the exact
   hole our spatial map fills.
4. **Claims drift silently.** Claims are frozen schedule copies; lot changes don't propagate until
   someone runs Renew Quantity Snapshot through two confirm prompts. **Variations are NOT added to
   claims** — their own tutorial shows three variations silently excluded as $0 overheads. An
   approved variation that is claimable-by-construction, plus live-computed claims with explicit
   freeze at submission, beats this.
5. **No SOPA awareness, no client certification portal, no Xero.** Retention/security are free-typed
   numbers; certification is the client marking up a PDF and someone retyping it; accounting
   integration is CSV round-trips with MYOB/Quicken/Dynamics (Xero absent, in the AU market).
6. **Setup burden productised.** ~13 registers before the first lot; a 5×50 permission matrix + 20
   authority flags with documented footguns; their own docs sell "configuration time" twice. Their
   2026-07 doc-refresh wave is all admin onboarding — they know.
7. **Report fragility.** Conformance reports **stop downloading under photo load** (official fix:
   turn photos off); custom reports silently break digital signing. Our server-side thumbnails +
   backend-mediated storage make photos-in-the-pack a selling point.
8. **Commercial friction.** Nothing self-serve (seats, billing, export); slow-by-default DB tier
   with a price list attached to "your app is slow"; data hostage on exit. "Self-serve, flat, your
   data is exportable" is a clean SME counter-position.
9. **Security posture talking points** (use carefully): Desktop connects directly to SQL; API
   passwords base64; no API versioning; MFA is email-code only, all-or-nothing; the documented
   Power BI SSO workaround is creating a non-SSO account outside the enforced domain list.

## 6. Threats / watch list

- **3D/4D IFC handover models** (alpha ~Apr 2026, GA target H2 2026) — if TMR-style handover-model
  requirements spread to NSW/VIC authorities, this becomes a tender checkbox. Check which of our
  target customers' principals are imposing equivalent requirements; our ADAC XML work is adjacent.
- **Registration friction is being engineered away** (3→2 registration points already; the QGIS
  image-layer flow was replaced by in-app plan registration once before).
- **Web transmittals "under development"** (stale since 2026-02) and diary/instructions web parity
  "TBA" — the desktop/web chasm is their acknowledged priority; the wedge narrows over time.
- **The free Associate tier carries an explicit "may change in the future"** — if they charge for
  collaborators, our free-subbie model becomes a louder differentiator; if they keep it, it's table
  stakes.

## 7. Terminology quick map (theirs → ours)

Work Lot/Lot → Lot · Checklist → ITP completion · Inspection Item → checklist item ·
Specifications → ITP templates · Filestore → documents · Daycost → docket/cost line ·
Contract Notice → (no equivalent — umbrella RFI/correspondence) · Punchlist → (no equivalent) ·
Lot Review → (no equivalent) · Related Items → linked records panel · Register → list page ·
Guaranteed → (no equivalent) · RPF/Non-Claimable → (no equivalent) · Conformance Folio → handover
export (no equivalent) · Associate → free collaborator seat.

---

*Corpus and raw transcripts were collected on 2026-08-06 from civilpro.zendesk.com (public API),
YouTube auto-captions, and one Vimeo tutorial. All claims above trace to named articles/transcripts
in the appendix files.*
