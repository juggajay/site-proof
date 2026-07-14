# International competitor research — what the world's versions of CIVOS do

**Date:** 2026-07-14
**Method:** Four parallel research agents, each sweeping a different slice of the market — UK/Europe, North America (commercial + US DOT inspection niche), NZ/Asia-Pacific (CONQA deep-dive), and a cross-region spatial/map-centric category sweep. Every product claim below carries a source URL; anything the agents could not verify on-page is marked *unverified*. Synthesised by the orchestrating session; rankings re-weighted against what CIVOS has actually shipped (several agent suggestions were dropped because we already have them).

---

## Verdict up front

1. **The spatial lot map is a genuine global moat.** All four agents independently confirmed: nobody — not CONQA (closest cousin), not Dalux InfraField (closest technical analogue), not Procore Maps, not the US DOT tools — registers plan-sheet PDFs onto satellite imagery with a chainage/control-line engine inside the QA product. The DOT world hands spatial off to Esri; Dalux is BIM/GIS-context, not sheet-registration.
2. **But the map is a viewer, not yet a doer.** The highest-leverage next moves are about making the map the *fastest way to file* a docket/NCR/ITP in the field (GPS auto-select, auto-pinned photos), not about more rendering.
3. **CONQA validates the whole business model.** Subbie-first adoption ("clean QA pack = faster payment") pulling head contractors in, client-led land (Invercargill City Council brought Fulton Hogan onto CONQA), volume-based pricing with unlimited users from NZ$499/mo. Our GTM thesis is live-proven by the nearest competitor.
4. **Three CIVOS capabilities have no equivalent anywhere:** NATA/lab-cert AI extraction (everyone else stores certs as dumb documents), claims-as-data-compiler pushing draft invoices to Xero, and chainage coverage %. Lot-as-spine is shared only with CONQA (it's the AU/NZ conformance model — European/US tools organise around drawings or tickets).

---

## The unified steal list

Re-ranked across all four reports by value-to-a-civil-foreman ÷ build effort, cross-checked against what CIVOS already has. "×2/×3" = found independently by that many agents (strong signal).

### Tier 1 — small builds, high value (candidate next wave)

| # | Idea | Who does it | Why | Build |
|---|------|-------------|-----|-------|
| 1 | **Failed ITP item → forced photo/evidence + auto-drafted linked NCR** (×2: Procore "conditional evidence", Visibuild) | [Procore](https://www.procore.com/quality-safety/inspections) · [Visibuild](https://visibuild.com/product/quality-management/) | A fail answer requires evidence and auto-spawns a pre-linked NCR — "removes the manual step where things fall through the cracks". We have both ITPs and NCRs; this is wiring. | Small |
| 2 | **"You are here" + geofenced lot auto-select** (×3: Procore Maps, Esri Field Maps, Dalux InfraField) | [Esri geofence forms](https://community.esri.com/t5/arcgis-field-maps-blog/configure-an-editing-geofence-in-your-form-using/ba-p/1567096) · [Dalux](https://www.dalux.com/dalux-field/infrastructure/) | GPS dot on the lot map; point-in-polygon pre-selects the lot you're standing in when filing a docket/diary/ITP entry. Kills the #1 field annoyance (picking a lot from a list while standing in it). Boundaries + browser geolocation already exist. | Small–Med |
| 3 | **Auto-pin QA/diary photos on the map from GPS EXIF** (×3: Procore Maps populates this way, Dalux, HeadLight) | [Procore Maps](https://support.procore.com/faq/how-do-items-in-procore-appear-on-the-map) | Every docket/NCR/diary photo becomes a map pin for free — the daily photo habit becomes a spatial as-built record with zero extra field effort. | Small |
| 4 | **Voice-to-text field capture** for diary/docket/notes (×3 in NA: Procore Quick Capture, Raken, HeadLight) | [Raken](https://www.rakenapp.com/features/daily-reports) | Table stakes in the US field-UX race; cheap via browser SpeechRecognition. | Small |
| 5 | **Navigate-to-lot / hold-point** — tap pin → deep-link to phone maps with lot centroid | [Field Maps](https://www.esri.com/arcgis-blog/products/field-maps/field-mobility/5-things-to-try-in-field-maps) | Physically finding a specific hold point on a 2 km job. Nearly free to build. | Small |

### Tier 2 — medium builds, distinctive value

| # | Idea | Who does it | Why | Build |
|---|------|-------------|-----|-------|
| 6 | **Chainage-interval ITP/lot auto-generation** — "drainage inspection every 25 m from CH 0+000 to 1+200" spawns the lot/checklist grid | [Dalux InfraField](https://www.dalux.com/dalux-field/infrastructure/) ("create specific checklists at set distances along alignments") | **Top single steal of the campaign.** Attacks lot *setup* — the biggest onboarding friction — using the chainage engine we already own. No AU tool does this. | Medium |
| 7 | **Auto-compiled daily diary** — day's photos/dockets/ITP events/weather-by-GPS compile into the diary with one tap | [HeadLight](https://www.headlight.com/construction-oversight-inspection/) (measured 28% inspector productivity gain) | Foremen hate re-typing the diary at 5pm; we already capture the inputs. Auto weather-by-location is near-free. | Small–Med |
| 8 | **Metadata-burned evidence photos** ("electronic blackboard") — date, chainage, lot, work description, inspector burned onto the photo, tamper-evident | Japanese regulated standard: [Taiyo Kogyo](https://www.taiyokogyo.co.jp/en/news/54195/) · [Kuraemon](https://www.ipros.com/en/product/detail/2000250202/) | A conformance photo that self-documents chainage/RL/test value survives a superintendent dispute years later. Chainage engine auto-populates the card. | Medium |
| 9 | **Test-frequency compliance meter** — "placed 400 m³, spec requires 4 density tests, 2 logged" per lot | US DOT practice: [FHWA QA](https://www.fhwa.dot.gov/pavement/materials/qareview.cfm) · HeadLight | Turns test results + NATA extraction from a passive record into a live warning light. | Medium |
| 10 | **One-click project handover dossier** — indexed, auditable evidence pack (ITPs, NCR close-outs, certs, hold-point releases) per lot/project for the principal | UK Golden Thread products: [Zutec](https://zutec.com/solutions/digital-construction-handover-management-solutions) · [Operance](https://www.operance.app/digital-handover/) | AU handover to TfNSW/councils demands exactly this artefact, assembled manually today. Phase up from existing per-lot conformance packs. A wedge, not polish. | Med–Large |
| 11 | **Redline/markup layer on the registered plan** — sketch + notes on the sheet-over-satellite, saved as evidence GeoJSON | [Esri Field Maps markup](https://doc.arcgis.com/en/field-maps/android/use-maps/capture.htm) | "Rework this section" drawn on the actual plan. Overlay rendering already exists; add draw tool + persistence. | Small–Med |
| 12 | **Chainage strip view** — lot status as a horizontal band along the alignment (one-axis time-location chart) | [Turbo-Chart](https://turbo-chart.com/time-chainage-software) · [Tilos](https://construction.trimble.com/en/products/tilos) | Civil work is linear; "which chainages are open/in-test/conformed" is the view generic tools can't give. Chainage engine has the data. | Medium |
| 13 | **Offline graceful degradation** — cache last-viewed tiles + plan overlay + lot boundaries so the map degrades instead of going blank | Industry consensus: [field-app selection guides](https://www.dronedeploy.com/blog/how-to-choose-the-right-field-inspection-app-for-your-jobsite) call offline "non-negotiable" for field GIS | Full offline tiling stays parked (Jay's call), but a foreman on a rural job opening a grey void reads the whole feature as broken. This is the cheap insurance version. Revisit post-pilot. | Medium |

### Tier 3 — large/strategic, park until a customer pulls

| # | Idea | Who does it | Notes | Build |
|---|------|-------------|-------|-------|
| 14 | **External superintendent/client portal** for hold-point review + release/reject-with-reason | Gap — nobody markets one; CONQA sign-off is internal-only ([conqa.com/sign-offs](https://conqa.com/sign-offs), *unverified beyond public pages*) | We already have token-based external hold-point release by email — the portal is the upgrade, and a second network edge beyond subbies. | Medium |
| 15 | **Installed-quantity capture against pay items → claims** | DOT model: [Appia](https://infotechinc.zendesk.com/hc/en-us/articles/360048624154-Appia-Payments) · AASHTOWare · HCSS HeavyJob | Field-captured installed quantity per lot/item driving the claim, with overage auto-flags. Touches the claims/Xero path — needs care and a real customer asking. | Large |
| 16 | **RTK GPS antenna support** (Emlid Reach etc.) for cm-accurate field pins | [Dalux InfraField Pro](https://www.linkedin.com/posts/dalux_dalux-infrafield-location-based-platform-activity-7157689065478209536-hSfH) | AU civil crews already own RTK gear for setout. High-end extension once GPS features (#2/#3) exist. | Medium |
| 17 | **Element/asset lifecycle tracking** — serial-numbered precast/culverts/beams, pour→delivery→install, own ITP/cert trail, plottable on the map | [CONQA Element Tracking](https://conqa.com/civil-infrastructure) | The one product lane CONQA has that we don't. Plugs into the spatial layer they lack. | Large |
| 18 | **Materials e-ticketing** (digital supplier delivery tickets: quantity, mix, geofenced delivery) | [HaulHub](https://www.e-dot.com/haulhub-university/transforming-material-delivery-with-haulhubs-jobslip-e-ticketing-solution) · [Command Alkon](https://commandalkon.com/products/dispatch-and-scale-ticketing/) (*feature specifics unverified*) | The docket's richer cousin; manual ticket-capture MVP is medium, carrier integrations large. | Med–Large |
| 19 | **Per-project/per-lot chat thread** | [ANDPAD](https://play.google.com/store/apps/details?id=jp.andpad.android.andpadchat&hl=en-US) — 680k+ users, chat is the daily-habit anchor | Deepens stickiness; keep scoped (thread-per-lot), not a messaging platform. | Medium |
| 20 | **Reality capture / drone-ortho layers / cut-fill heatmaps** | [OpenSpace Track](https://www.openspace.ai/products/progress-tracking/) · [DroneDeploy](https://www.dronedeploy.com/blog/create-accurate-site-plans-without-a-surveyor-on-every-visit) · [Propeller](https://help.propelleraero.com/hc/en-us/articles/30544925967895-AI-Cut-Fill-Quick-Earthwork-Insights) | Powerful but survey/photogrammetry engines — partner territory, not build territory. | Large/park |

### Already have — agent suggestions dropped from the list

- **Traffic-light lot-status heatmap on the map** (SnagR) — our lot polygons already colour by status, with the time scrubber on top.
- **Reusable cross-site ITP template library** (CONQA) — global/company ITP template library with seeders already exists.
- **Free unlimited subcontractor access** (PlanRadar, Dalux Field Basic, CONQA) — our model already; validated, not missing.
- **Status time scrubber into evidence docs** — map snapshots to documents already shipped; the OpenSpace-style "split view then-vs-now" is a possible later polish of what exists.

---

## GTM intelligence (CONQA deep-dive highlights)

- **Pricing:** volume-based on $ of work managed, **not per-seat**; all plans unlimited users; from **NZ$499/month**, bands ~$5M / $5–10M / $10–20M / $20–40M+ of managed work. ([conqa.com/pricing](https://conqa.com/pricing)) Unlimited seats removes the "do I pay to invite this subbie" friction that kills network growth — directly relevant to CIVOS pricing design.
- **Adoption motion, live-proven:** subbies adopt to fast-track progress claims (clean QA pack = faster payment), pulling head contractors in; land is often **client-led** — Invercargill City Council brought Fulton Hogan Southland onto CONQA, and CONQA digitised FH's *existing* ITPs rather than replacing them. ([case study](https://conqa.com/cs-fulton-hogan-southland)) Named customers: Fulton Hogan, Downer, AE Smith.
- **Their gaps = our wedge:** no spatial anything, internal-only sign-offs, no AI extraction, no accounting integration.

## Confirmed differentiators (all four agents, independently)

1. **Registered plan-sheets on satellite + GeoPDF auto-registration + chainage/control-line engine inside the QA product** — no equivalent found anywhere.
2. **NATA/lab-certificate AI extraction tied to lot conformance** — everyone else does manual entry or dumb document storage.
3. **Claims as a Xero data-compiler off the conformance spine** — European quality tools are silent on payment; US tools tie to DOT pay estimates, not SME accounting.
4. **Chainage coverage %** — requires the control-line engine nobody else ships.
5. **Lot register as the spine** — shared only with CONQA; structural moat vs. drawing/ticket-organised US/EU tools.

## Table stakes to keep an eye on

Capabilities most serious competitors have that we should track honestly: full offline field capture (we have offline witness/dockets; the map is online-only — see #13), voice-to-text (#4), conditional evidence on inspection responses (#1), custom free-form inspection template builders beyond the ITP structure (Trimble Field View, Dalux, PlanRadar), and checklist import from PDF (Autodesk/Procore — our AI setout extraction is adjacent tech).

---

## Appendix — per-region landscape one-liners

**Europe:** Dalux (DK, InfraField = our closest technical analogue, free tier drives adoption) · PlanRadar (AT, volume leader, 120k+ teams, SiteView 360 capture) · Zutec (IE/UK, Golden Thread/Gateway 3 handover) · Trimble Field View (UK, ran Hinkley Point C's reinforced-concrete ITPs) · Ed Controls (NL, simple snagging) · Capmo (DE, mid-market diary+tickets) · Buildots (IL/UK, AI progress from 360 walks) · SnagR (UK, progress+quality on drawings) · Operance/Createmaster (UK, handover packs).

**North America — commercial:** Procore Quality & Safety (+ Unearth acquisition → Procore Maps) · Autodesk Build (checklists from smart-PDF import) · Fieldwire/Hilti (plan-first, calibrated take-offs, full offline) · Raken (daily-report specialist) · HCSS HeavyJob (heavy-civil quantities/costing). **North America — DOT niche (closest domain match):** HeadLight (photo-driven inspection → one-click daily work report) · Infotech Appia/Doc Express (pay-item quantities → payment vouchers, ArcGIS integration, GNSS rovers) · AASHTOWare Project (state-DOT standard) · HaulHub/Command Alkon (materials e-ticketing).

**NZ/APAC:** CONQA (NZ — closest cousin; ITPs, hold points, lots, element tracking, variations; no spatial) · Visibuild (AU, failed-inspection→auto-NCR) · Novade (SG, modular HSEQ incl. permit-to-work) · ANDPAD (JP, 680k+ users, chat-anchored) · Photoruction (JP, photo-centric, electronic blackboard) · Glaass (AU/global, client+contractor+subbie in one view).

**Spatial category:** Procore Maps (auto-pins from photo GPS) · Esri Field Maps/Survey123 (deep GIS field stack: geofences, navigate-to-feature, markup, offline) · Fulcrum (offline-first location forms) · Tilos/Turbo-Chart (time-chainage charts) · OpenSpace/DroneDeploy/Propeller (reality capture → progress %/cut-fill) · utility/pipeline apps (GPS route verification, per-segment condition history).
