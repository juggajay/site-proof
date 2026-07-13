# Feature Gap & Pain-Point Research — 2026-07-13

Three parallel Opus research agents (competitors, pain points, adoption/pilots), synthesized
and cross-checked against the actual codebase on master. Context: **first real test user
starts week of 2026-07-20.**

## Executive summary

1. **The product targets real, evidenced pain.** Every Tier-1 pain point found in the wild
   (paper ITPs failing in the field, hold-point sign-off bottlenecks, end-of-project
   conformance scramble, lost QA records, no at-a-glance lot status) maps onto a loop
   SiteProof already ships. Nothing found suggests a missing core loop.
2. **Two real gaps vs CivilPro (the direct AU comp)** are worth a shortlist, not a sprint:
   survey conformance workflow, and test-frequency rules (min tests per lot / testing rate).
   (A third, the lot map, turned out to already be shipped — see false gaps.)
3. **The highest-leverage work this week is pilot prep, not features.** Structured pilots
   with written success criteria convert 3.2x better; the proven wedge is daily diary +
   photos (already built). Playbook below.

## False gaps — claimed missing, actually built (verified in code)

| Claimed gap | Reality |
|---|---|
| Portfolio/multi-project analytics | `PortfolioPage` exists: cashflow, metrics, projects-at-risk, critical NCRs |
| Open API / webhooks | `backend/src/routes/apiKeys.ts` + `webhooks.ts` (493 lines) exist |
| Chainage-based lots | `Lot.chainageStart/chainageEnd` (+ lat/long) in schema, shown in lots UI and conformance/claim PDFs |
| Lot map / linear chainage view (CivilPro's signature) | **Shipped.** `LinearMapView.tsx` — third view toggle on Lot Register: lots positioned by chainage in activity rows, status colours, zoom/pan, print/export, project-area background highlighting. Initially mis-reported as a gap in this doc (correction 2026-07-13: the false-gap check covered schema + backend routes but not frontend components — check `frontend/src/components/` too) |
| Scheduled reporting | `ReportsPage` + `ScheduledReportArtifactPage` |
| Audit trail | `auditLog` routes exist |
| Client hold-point sign-off | Public token-release links (offline-tolerant) already shipped |
| Handover/conformance packs | Lot conformance PDF packs shipped |
| Accounting integration | Xero claim→draft-invoice + payment sync-back shipped |

## Real gaps — ranked

### A. Shortlist (direct-comp parity, civil-specific, build when pilot user confirms)
1. **Survey conformance workflow** — survey request → surveyor → conformance evidence back
   to the lot. TfNSW/TMR require survey conformance as QA evidence. Today it'd be shoehorned
   into documents/test results. (Verified: no survey models in schema.) Lean v1 reuses the
   hold-point token-link machinery for the surveyor hand-off; needs a reviewed migration.
2. **Test frequency rules** — per material/activity: min tests per lot, testing rate,
   auto-flag under-tested lots. Separates a "records app" from a civil QA system under
   TfNSW/TMR specs. (Currently only free-text requirements; `itpChecklistItemId` plumbing
   exists.) Rules are spec-set-specific — encode from the pilot user's real spec pages,
   not guesses.
3. **"Eagle-eye" lot/ITP status board** — a real Dashpivot user complaint: "no eagle eye
   view... cannot know at a glance the status of worklots, itps." (Verified: no matrix view
   in frontend.) We have lot register + linear map + dashboards; check with the test user
   whether those answer it in one glance before building a lots × ITP-stages matrix.

### B. Watch list (validated demand, bigger bets — need a paying user asking)
- **Native mobile / offline field checklists** — every competitor has it; #1 objection on
  remote civil sites. We're responsive web + partial offline (witness release, sync worker).
  Jay has already decided NO offline dockets; revisit only if the pilot user hits real
  signal problems.
- **Punch/snag list distinct from NCR** — minor defects need a fast list, not the full NCR
  process (Procore, Novade, Visibuild all split these).
- **Subbie scorecards** — repeat-issue trends by trade; objective subbie performance.
  Natural extension of our data spine; fits "continuous value to a buyer with admin staff".
- **Subcontractor compliance vault** — tickets/insurance/SWMS expiry reminders (BuildPass,
  HammerTech). Adjacent to our subbie portal; strong admin-staff value; scope expansion.
- **Material receiving inspection** — verify materials at delivery (Novade).
- **AI photo defect detection / voice quick-capture** — HammerTech + Procore ship it; cuts
  field data entry. We already do AI cert extraction; same muscle.
- **Power BI / Excel export integrations** — Dashpivot's Flowsite is the benchmark; our
  webhooks + API keys are the foundation. A CSV/Excel export of the lot register may cover
  80% for now.

### C. Deliberate NOs (scope decisions, don't relitigate)
- Safety/HSEQ module (inductions, incidents, SWMS) — HammerTech's turf; different buyer muscle.
- Scheduling / 3-week lookahead — Assignar's turf.
- RFI / correspondence / contract notices register — Aconex/RIB CX territory (enterprise doc control).
- Financial calcs (GST/retention/SOPA) — Xero owns money (settled).
- Post-completion/DLP module — vertical-building concern mostly; park.
- Offline dockets — Jay decision, settled.

## Pain-point coverage map (Tier 1–2 evidence vs product)

| Pain (evidence-backed) | Covered? |
|---|---|
| Paper ITPs fail in field / ticked in advance | ✅ digital ITP checklists |
| Hold-point sign-off bottlenecks whole day | ✅ token release links; **timestamped delay evidence is a selling point** (superintendent conflict-of-interest pain, AS 2124/4000) |
| End-of-project conformance scramble (60% of handover disputes = missing docs) | ✅ progressive lot conformance packs — **lead marketing message** |
| Lost/misfiled QA records | ✅ |
| No eagle-eye lot/ITP status | ⚠️ partially — validate with test user (gap A4) |
| Too expensive for SMEs (Procore $10–60k/yr) | ✅ positioning opportunity |
| Steep learning curve / field staff can't adapt | ⚠️ our risk too — pilot will tell |
| Slow clunky mobile data entry | ⚠️ responsive web; watch pilot user on-site |
| Offline dead zones | ⚠️ partial (watch list) |
| Claims prep manual/spreadsheet-bound | ✅ lot-based claims + Xero |
| NCRs overlooked / not chased to closure | ✅ (verification workflow, reopen guards) |
| Subbie onboarding pain / per-seat cost blocks field users | ✅ free subbie portal — matches CivilPro's 200-free-associates and CONQA's non-per-user pricing; **per-user pricing would be a mistake** |
| Test certs from labs stall conformance | ✅ cert register + AI extraction (chasing-labs reminder = possible later nicety) |
| Docket integrity (filled from memory next morning) | ✅ same-day dockets + photo evidence |

## Pilot playbook — week of 2026-07-20

Evidence-backed (sources in adoption appendix):

1. **Write success criteria with them before day one** (3.2x conversion lift) — e.g. "all
   diaries submitted same-day with photos for 4 of 5 weeks; one full lot conformed end-to-end."
2. **Baseline their current state now** — minutes per ITP sign-off on paper, time to
   assemble last conformance pack.
3. **One job, one crew, one workflow first** — lead with daily diary + photos (the proven
   wedge), layer ITPs/hold points week 2+. CONQA sequences onboarding exactly this way.
4. **YOU build their setup** — their ITP templates, lot register, project structure
   pre-loaded before they log in. Template pre-load is the single most repeated winner
   artifact (CONQA does the ITP digitisation for customers).
5. **Name a crew champion** (respected foreman, not head office) and make the *field user*
   the winner — "who benefits" mismatch is the #1 documented pilot killer.
6. **Kill double entry** — if they keep a parallel paper diary/spreadsheet, treat it as a
   failing pilot signal.
7. **Hard 6–8 week end date** with a decision meeting booked now.
8. **Daily champion touchpoint, weekly manager check-in; fix friction overnight** and say so
   at the next toolbox talk.
9. **Pick one activation metric** and watch it (e.g. diary+photos 5 days running).
10. **Don't lead with GPS/photo-location features** — surveillance framing kills field trust.
11. **Lean on founder-is-a-tradie credibility** — counters the "built by devs who've never
    been on site" failure mode.
12. **Pricing anchor if asked:** CivilPro is ~$4,400/yr platform + $528–792/seat (field
    users free); Dashpivot ~$29/user/mo; Fieldwire $39–89/user/mo. Structured pilots convert
    40–60% vs <10% for open-ended free trials.

---

# Appendix A — Competitor research (agent report)

[Full report as returned by the research agent; URLs verified as cited, feature claims
spot-checked against vendor docs where noted above.]

## Per-competitor summaries

### CivilPro — most direct AU competitor
- "Industry standard for lot-based QA," 10+ yrs AU/NZ civil. Desktop + web. Same buyer/workflow shape as SiteProof.
- Spatial/GIS module: lots by chainage/coordinates along a Control Line, Lot Map layers by work type/status, conformance colouring. (civilpro.zendesk.com — Lot Mapping)
- Survey conformance: Survey Request → surveyor → tracked back to lot. (civilpro.zendesk.com — Survey Request)
- Test frequency automation: conformance criteria, min tests/lot, testing frequency, Test Method Register, random test locations. (civilpro.zendesk.com — ITP Specifications Register, Test Request Register)
- Quantities→claims, Daycosts, Forecasts; Contract Notices register. (civilpro.com/solutions)
- Reviews: wins on civil depth + <1hr local support; knocked for learning curve, limited customisation, ITP/QVC model confusing clients. (capterra.com.au, softwareadvice.com.au)
- Pricing: ~$4,400/yr platform + per-seat $528–792 by tier; 200 free "Associate" field users; no lock-in. (civilpro.com/pricing)

### Visibuild (AU)
- Native mobile online+offline; infrastructure solution; portfolio dashboards 1–50 projects; repeat-issue trends by trade/location; subbie scorecards; post-completion/DLP module; company template libraries. (visibuild.com)

### CONQA (NZ/AU civil + precast)
- Team does setup + digitises your ITPs; offline mobile checklists; handover "in ~30 days"; client sees daily QA progress; 30-day trial; prices by work volume not per user. (conqa.com)

### Dashpivot / Sitemate (AU)
- Configurable templates, huge free template library; Flowsite integration layer: Xero, QuickBooks, Power BI, Power Platform, Excel, SharePoint + versioned public API. ~$29/user/mo. (sitemate.com)

### HammerTech (AU, safety-led)
- AI photo hazard analysis, auto-generated entries; full safety suite; flat-fee unlimited users. Review knocks: slow mobile app, slow checklists, one-at-a-time worker import. (hammertech.com, softwareadvice.com)

### Procore
- Observations vs Inspections split, spec/drawing linking, AI voice/video Quick Capture, RFI/submittals. Knocked as overkill/overpriced for mid-size ($10–60k+/yr, 3–6 months to proficiency). (procore.com)

### Novade
- RFWI/WIR workflow, Material Receiving Inspection, structured NCR root-cause, punch lists, supplier benchmarking, Power BI export. (novade.net)

### Assignar (AU heavy-civil ops)
- Master + 3-week lookahead schedules, Gantt/pull-planning, crew/plant scheduling with cert checks, field timesheets. (assignar.com)

### Fieldwire (Hilti)
- Task-board lookahead + punch lists; free ≤5 users; $39–89/user/mo. (fieldwire.com)

### Mastt / BuildPass / Aconex-RIB CX
- Mastt: owner-side cost dashboards, AI contract ingestion. BuildPass: subbie compliance vault (ticket/insurance/SWMS expiry reminders, prequal). Aconex/RIB CX: correspondence/RFI/submittal registers, defects linked to variations/claims.

## Why customers pick/leave
- CivilPro: wins civil depth + support; loses on learning curve/desktop-era feel → SiteProof wedge = same depth, modern mobile UX.
- Procore: abandoned by mid-size as overkill/overpriced.
- CONQA/Visibuild: chosen for field-first mobile-offline simplicity + fast handover.
- CONQA + CivilPro price by volume/tier, not per-user → free-subbie model is category-correct.

# Appendix B — Pain-point research (agent report, condensed)

Tier 1 (strongest): paper ITPs fail in field conditions (ticked in advance, filled next
morning); hold-point sign-offs hold up a day's work; end-of-project conformance scramble
(60% of handover disputes = missing docs; 52% of projects delayed by poor closeout); no
eagle-eye lot/ITP status view (real Dashpivot review); lost/misfiled records destroy audit
trail. Sources: holdpoint.co, sitemanagerai.com, long-intl.com, softwareadvice.com.

Tier 2: existing software too expensive for SMEs (Procore $10–60k/yr); steep learning
curves (Procore 3–6 months, Dashpivot "blue collar workers adapting", HammerTech "not
instinctual"); slow clunky mobile data entry (HammerTech reviews); offline dead-zone data
loss + sync-conflict failures (24–72hr offline needed on remote sites); claims prep manual/
spreadsheet-bound (irreconcilable cumulative totals); NCRs overlooked → rework + delayed
handovers.

Tier 3: superintendent dual-hat conflict under AS 2124/4000 — slow/biased certification,
courts found "undesirably close" principal–super relationships (carternewell.com) [AU];
no accounting integration → double entry (Fieldwire has no Xero); subbie onboarding pain
onto HC systems; portal fatigue across HCs (vendor-framed evidence only — validate with
test user); pay-when-paid squeeze/SOPA [AU]; template rigidity; late lab certs stall
conformance [AU]; dockets filled from memory next morning; photo management unusable at
scale (Procore endless scroll).

Caveat: Reddit/Whirlpool were unreachable by the agent's tooling — raw practitioner venting
under-sampled. The test user is the better primary source.

# Appendix C — Adoption & pilot research (agent report, condensed)

Pilot failure causes: "who benefits" mismatch (field enters data, office gets value) — the
#1 documented killer; double data entry (~40% of firms cite integration gaps); complexity +
offline gaps → field abandonment; champion problem (orphaned pilots); top-down mandates +
surveillance fear; contractual ambiguity spawning parallel systems.

Winning onboarding (CONQA, Dashpivot, Procore): vendor does the setup, pre-loads/digitises
templates, named human contact, phased feature layering, sandbox project, role-based
training.

Adoption wedge: daily field reports + photos ("one job, one crew, one workflow" — Fulcrum),
then expand. Photos validate progress; WhatsApp-simple capture wins.

Pricing: CivilPro $4,400/yr + $528–792/seat (200 free field users); Dashpivot ~$29/u/mo;
Fieldwire free tier then $39–89/u/mo; HammerTech flat-fee unlimited users; CONQA 30-day
trial, volume-priced; Procore/Visibuild quote-only.

Pilot-to-paid: predefined success criteria = 3.2x conversion (Forrester); 6–8 week fixed
term; structured pilots convert 40–60% vs <10% open-ended trials; define one activation
event hit in the first half; daily champion + weekly manager cadence; fix friction
overnight and announce at toolbox talk.

Key source URLs: fieldwire.com/blog, avicado.com, getresq.com, vitruvisoftware.com,
fulcrumapp.com, constructiononline.com, conqa.com, roadsonline.com.au, help.sitemate.com,
support.procore.com, civilpro.com/pricing, capterra.com, getmonetizely.com, saastr.com,
rhumbix.com.
