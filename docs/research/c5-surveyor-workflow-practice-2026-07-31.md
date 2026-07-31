# C5 research pass — how conformance/set-out surveying ACTUALLY works in AU civil practice

**Date of pass:** 2026-07-31
**Researcher:** subagent `rg-surveyor-workflow`, at Jay's direction.
**Scope:** the **PRACTICE** side of the C5 survey-record feature. The **SPEC** side is already settled at
grade A in [`c5-survey-tolerance-research-2026-07-31.md`](./c5-survey-tolerance-research-2026-07-31.md)
and is **not re-derived here**.
**Blocks:** the decision to turn the C5 survey-record flag ON, and specifically the state names
`requested → in_progress → received → accepted` (+ `rejected`).

---

## Verdict up front

**The five-state machine is two states too long and one state misplaced.**

| State | Verdict | One-line reason |
|---|---|---|
| `requested` | **KEEP** — with the requester fixed as the **site/project engineer**, never the foreman, and the state **optional** | A named AU competitor ships a first-class `Survey Request` object with `Raised By` / `Request To` / `Date Required`; MRWA names "survey requests" as a retained record class. But the *contractual* trigger is a lot **state** ("accessible for survey"), not a person, so a record must be creatable without one. |
| `in_progress` | **RESTRUCTURE — delete the state, keep the fact** | Nothing in AU practice tracks a survey as in progress: not one spec, not one council, not one training unit, and **not one piece of survey software on earth**. But partial pickup is the *norm* — a real AU conformance report I obtained spans three non-contiguous field days. What is partial is **coverage**, not the job. Model coverage as an attribute; delete the lifecycle state. |
| `received` | **KEEP** — strongest-evidenced state in the machine | Convergent across a road authority's own published `.xls` template, a real 2021 project artifact, five software vendors and a competitor's "Notify Result" step. The artifact is a per-point table with a chainage key and a per-row compliance column. |
| `accepted` | **RESTRUCTURE — remove from the survey record** | Acceptance is real but it happens **on the hold point and on the lot**, never on the survey document. The real conformance report I obtained has a surveyor signature block and **no engineer or QM approval field at all**. The competitor has no accept state on the survey request either — it has `Conformed` on the *Lot*. An `accepted` survey state duplicates machinery CIVOS already ships. |
| `rejected` | **RENAME → `returned_for_correction`, and make it non-terminal** | No captured AU document uses "reject" for a survey deliverable. The published act is *"referred back to the Surveyor responsible for correction or clarification… actioned within one business day"*. `Rejected` in AU civil is a **Lot** status, not a survey status. And the AU convention for a redo is a **new, renumbered artifact cross-referenced to its predecessor**, not a dead end. |

**Net effect:** the survey record is a piece of **evidence with a lifecycle of arrival**, not a workpiece with a
lifecycle of approval. `requested → received` (+ `returned_for_correction` looping back to a new version) is
the whole of it. Acceptance is consumed by the hold-point and lot-conformance machinery that CIVOS
already has.

**No contradiction with the spec pass was found.** Practice *strengthens* its §3.4 recommendation — see §8.

---

## 0. How to read this document, and an honesty note about grades

The program §10 grade scale is: **A** primary authority/specification/legal; **B** official vendor/
competitor/firm documentation; **C** customer or independent secondary; **D** marketing/directional.

**For workflow-practice questions, grade A mostly does not exist, and that is the correct answer rather
than a research failure.** No standards body publishes "here is how a site engineer asks a surveyor for a
pickup". The best available evidence is **B** (a road authority's own downloadable form, a competitor's own
help documentation, a vendor's own manual) and **C** (job ads, course material, named-practitioner posts,
and — the most valuable class found — **real project artifacts**). This pass therefore leans on **B and C,
grades them honestly, and relies on convergence**: where three or more independent sources of different
types say the same thing, that is called out explicitly and is the actual strength of the finding.

Two additional conventions used below:

- **[V]** marks a claim I fetched and read myself in this session, as opposed to one captured by a
  delegated researcher. The most load-bearing claims in §4 and §5 are all `[V]`.
- **A-spec** is used where a road-authority specification is cited for a *practice* fact (e.g. what a
  compliance report contains). The document is grade A; using it as evidence of behaviour rather than of
  obligation is the weaker move, and it is marked so.

**One methodology warning inherited from a delegated researcher, recorded because it matters for anyone
extending this work:** a WebFetch summariser was caught **fabricating plausible-but-false content** — it
invented "Client/Supervisor Acceptance" performance criteria for a training.gov.au unit that do not exist.
Every `[V]` claim below was extracted from raw text or raw HTML, not from a summariser.

### 0.1 What was blocked

Stated plainly so the next agent does not repeat the attempts:

| Source class | Status |
|---|---|
| **WebSearch** | Session-wide budget exhausted (200/200) partway through. Later work ran on direct `curl`, `lite.duckduckgo.com` and `r.jina.ai`. |
| **Reddit** | Direct fetch 403 on every route (reddit.com, old.reddit.com, r.jina.ai, redlib, safereddit). Archive APIs (pullpush, arctic-shift) yielded ~37 verbatim comments then hard-limited. **All AU voices captured are AU-identified commenters inside r/Surveying** — zero threads from AU-specific subreddits. |
| **YouTube / podcasts** | Effectively blocked; watch pages return footer nav only. **Zero AU surveyor video or audio captured.** |
| **LinkedIn** | Public `/posts/` URLs *are* fetchable (proven — claim 25), but with search dead they could not be enumerated. **The single highest-value unexplored channel.** |
| **AU trade press** | roadsonline.com.au and insideconstruction.com.au both 403. |
| **seek.com.au, jora, gradconnection, cgcrecruitment** | 403 to WebFetch throughout. LinkedIn `/jobs/view/` and Indeed AU worked. |
| **Contractor's own quality plans** | One real candidate found (Haslin Constructions SEQ-PR-063 ITP Procedure Rev6) — downloaded, **no text layer**, no OCR available. See §9. |

---

## 1. Q1 — Does someone REQUEST a survey, and who?

### 1.1 The decisive evidence: a direct AU competitor ships exactly this object

**CivilPro** is an Australian civil-construction QA product covering lots, ITPs, test requests and
conformance. It models a first-class **Survey Request**. I fetched and read its help documentation myself.

> "During your project, you may be required to request surveys from qualified surveyors, for example,
> set-out surveys, control surveys, etc. **Just like a Test Request**, you can easily create a Survey
> Request and attach all the relevant information to send it to your Surveyor for action, all within
> CivilPro."
> — CivilPro, *Create a Survey Request*, updated 23 Jan 2026 **[V]**

The published field list, verbatim:

| Field | Note |
|---|---|
| **Survey Type** | dropdown |
| **Request To** | "Select the **authorized surveyor** from the dropdown list" |
| **Date Required** | "Specify the date the survey needs to be **completed by**" |
| **Description** | free text |
| **Raised By** | *completed by default* |
| **Date Requested** | *completed by default* |
| **Linked Lot(s)** | "You can link **more than one Lot**" |
| **Geometry** | "Update Geometry from Lots" or add manually |
| **Tolerance levels** | entered on a dedicated step |
| Attached documents | "will **not** be sent to the surveyor" |

This matters more than any single spec clause, because it is **an AU vendor's answer to the same design
question CIVOS is asking**, shipped and documented. It confirms: (a) a per-lot survey request object is a
viable product shape; (b) the request carries **tolerances and geometry**, not just a date; (c) it is a
**sibling of the test request**, which is exactly the mental model CIVOS already has.

### 1.2 "Survey request" is a real, named record class in AU civil — at authority level

Main Roads WA's *Construction Surveying Guideline* (Ed 13, 20 Oct 2021) names it outright as a record to be
retained:

> "Copies of all details including **survey requests**, raw data hardcopies and MX genio files … should be
> retained by the superintendent's representative." — MRWA CSG §6.4

and closes the loop by making the requester the recipient:

> "Lodge this captured as-staked data to **the Main Roads officer that requested the survey**." — MRWA CSG §9.1

MRWA even publishes a **Survey Request form (C154_13)**, whose real fields are: MRWA Job No, Project
Description, Survey Brief, Special Requirements, Required Commencement Date, Required Completion Date,
Duration, Fee Type, and — tellingly — checkboxes for *"Survey Progress phone calls ☐ at 2 week intervals"*
and *"Survey Progress meetings ☐ at __ intervals"*.

**But read that form carefully: it is a procurement/engagement brief, not a per-lot ticket.** You engage a
survey company with it; you do not ask for tomorrow's subgrade pickup with it. TMR's equivalent is the
**survey brief**: *"The instrument that authorises or instructs a Surveyor to perform a survey… the only
instrument where the requirements of the Standards may be varied"* (TMR Surveying Standards Part 1 §4.1) —
again project-level.

### 1.3 Who does the requesting: the site/project engineer, and NOT the foreman

Job ads converge cleanly. **Six independent employers** put survey coordination in the *site engineer's*
duty list:

| Employer | Verbatim duty |
|---|---|
| MOITS | "**Coordinating surveys** and ensuring accurate set out" |
| Symal | "Support **survey set-out**, QA documentation, and ITPs" |
| Metro Project Services | "assisting with **site set-out**, supervising subcontractors" |
| SARJAN | "**Coordinated surveyors** for site set-out and verification works" |
| Maas Group | "Support as-built documentation and **survey activities**" |
| BMD (Earthworks) | "**Set out works and verify construction** against design and specifications" — the SE does it himself |

**The foreman appears in zero survey-tasking duty lists, in ~40 ads fetched.** That is a strong negative and
it is directly load-bearing for CIVOS's role gates, which already exclude foreman from lot setup
(`project_foreman_not_lot_setup_manager`). Consistent.

### 1.4 The counter-current, which is just as strong: surveyors self-schedule off the program

**Five independent employers** describe the surveyor forecasting and prioritising their own work:

- Tracc Civil: *"**Forecast survey requirements 1–2 weeks ahead**"*; *"Prioritise workloads"*
- SEE Group (two separate ads): *"**Plan and coordinate survey set out** taking into consideration continuity of projects and utilisation of machinery and contractors"* + *"Ability to work unsupervised"*
- Fulton Hogan (Graduate Surveyor): *"**planning site survey requirements with project staff**"*
- CPB (Survey Manager): *"Ensuring that a site explanation and **sketches of set outs are provided to relevant Project Team members**"* — instruction flowing **outward from** survey
- Pacific Survey: *"Coordinating and managing day-to-day survey activities"*

And the scheduling artefact people actually name is the **look-ahead program**, not a queue: Symal
*"Develop and maintain **3-week look-ahead programs**"*; Tracc's 1–2 week survey forecast.

### 1.5 The contractual trigger is a lot STATE, not a person

This is the finding that most constrains the design:

> "Perform verification surveys **not later than one working day after the lot or component has become
> accessible for survey**." — AUS-SPEC C02 cl. 2.7.1
>
> "…as soon as practicable, but in any event **not later than one working day after the pavement Lot has
> become accessible for survey**." — TfNSW G71 cl. 5.6.3

Nobody has to ask. The lot becoming accessible *is* the trigger. Two independent specification lineages
say it in near-identical words.

### 1.6 Practitioner voice: the channel is verbal, and practitioners know it is a weak point

The single most telling data point in this section. Asked to list the hazards of the job, a Brisbane
surveyor's **first** item is not traffic or weather:

> "**Unclear requests/communication; Confirm instructions. In writing where possible.**"

That is a practitioner describing a defence he builds himself because no channel provides it. Alongside:
ad-hoc verbal pulls (*"I just need 2 pegs replaced so my subbie can work"*), and an AU surveyor advising
others to route **around** the formal party entirely: *"Skip the engineers and go straight to the guys
building it. 9/10 the leading hands know more about what they need/want than the engineers."*

An AU/Melbourne surveyor also supplies the AU-specific structural fact: AU engineers *"have zero training
with total station and dont do any setout or asbuilts"*, unlike the UK where the site engineer sets out
himself. **So in AU every set-out is a handoff between two parties** — precisely where an untracked
request goes missing.

### 1.7 And no AU surveying firm publishes a booking mechanism

Across **~25 AU surveying-firm websites reached**, there is no request form, no call-up sheet, no booking
portal, no template. The booking payload is an email with a design file:

- Synergy Surveys: *"**Send through the site location, project type, required survey area** and any council, builder, designer or engineer requirements."*
- Axis Surveys: *"send us the approved building plans with the corners they want us to setout clearly marked, **preferably at least a week before** the setout work is required on site."*
- HR Surveyors, writing to builders: *"**Confirm availability with your surveyor when you programme the job. Do not wait until the week of fieldwork.**"*

Note that HR Surveyors is writing that article *because reality isn't programme-driven*.

### 1.8 Claim table — Q1

| # | Claim | Source | Grade | Date |
|---|---|---|---|---|
| 1 | CivilPro ships a first-class **Survey Request**: Survey Type, Request To (authorised surveyor), Date Required, Description, Raised By (default), Date Requested (default), linked Lots, geometry from lots, tolerance levels — explicitly framed as "**Just like a Test Request**" | https://civilpro.zendesk.com/hc/en-us/articles/5050842504079-Create-a-Survey-Request **[V]** | **B** | upd. 23 Jan 2026 |
| 2 | "Copies of all details including **survey requests**, raw data hardcopies and MX genio files … should be retained by the superintendent's representative" | MRWA Construction Surveying Guideline §6.4, https://www.mainroads.wa.gov.au/technical-commercial/technical-library/surveying-and-geospatial-services/engineering-surveys-guidelines/construction-surveying-guideline/ | **A-spec** | Ed 13, 20 Oct 2021 |
| 3 | "Lodge this captured as-staked data to **the Main Roads officer that requested the survey**" | MRWA CSG §9.1 | **A-spec** | 20 Oct 2021 |
| 4 | MRWA publishes a **Survey Request form C154_13** — but its fields (Project Description, Survey Brief, Fee Type, Required Commencement/Completion Date, "Survey Progress phone calls ☐ at 2 week intervals") make it a **procurement brief, not a per-lot ticket** | https://www.mainroads.wa.gov.au/49beb2/globalassets/technical-commercial/technical-library/surveying-and-geospatial-services/engineering-surveys-guidelines/survey-services-1-request-form-c154_13.docx | **A-spec** | linked from Ed 13 |
| 5 | TMR: the initiating instrument is a **"survey brief" — "The instrument that authorises or instructs a Surveyor to perform a survey"** | TMR Surveying Standards Part 1 §4.1 | **A** | — |
| 6 | **Six independent employers** put survey coordination in the **site engineer's** duty list (MOITS, Symal, Metro, SARJAN, Maas, BMD) | LinkedIn `/jobs/view/` + Indeed AU (URLs in §1.3 rows) | **C** | 2026-07-31 |
| 7 | **Foreman appears in zero survey-tasking duty lists** across ~40 AU ads fetched | negative finding across the ad corpus | **C** (negative) | 2026-07-31 |
| 8 | **Five independent employers** have the surveyor **forecasting and self-prioritising** (Tracc "1–2 weeks ahead", SEE Group ×2, Fulton Hogan, Pacific Survey); CPB has instruction flowing *outward from* survey | ad corpus, §1.4 | **C** | 2026-07-31 |
| 9 | The contractual trigger is a **lot state**: "not later than one working day after the lot or component has **become accessible for survey**" | AUS-SPEC C02 cl. 2.7.1; TfNSW G71 cl. 5.6.3 | **A** | — |
| 10 | Set-out is simply the **Contractor's** responsibility, unallocated between roles | TMR MRTS56 cl. 9.1 | **A** | Mar 2022 |
| 11 | A Brisbane surveyor's **#1 listed job hazard** is "Unclear requests/communication; Confirm instructions. In writing where possible." | r/Surveying g6cqx6 (AU-identified) | **C−** | 23 Apr 2020 |
| 12 | Ad-hoc verbal request in the wild: *"I just need 2 pegs replaced so my subbie can work"*; and *"Skip the engineers and go straight to the guys building it"* | r/Surveying rcfah5, 1aj86s7 (AU-identified) | **D+** | 2021, 2024 |
| 13 | **No AU surveying firm publishes a request/booking artefact** across ~25 firm sites; the payload is an email with a design file (Synergy, Axis, Avian converge) | firm site corpus | **B** (negative) | 2026-07-31 |
| 14 | Set-out lead time is roughly **a week**, not 24 hours: *"preferably at least a week before the setout work is required on site"* | https://www.axissurveys.com.au/faqs-for-builders/ | **B** | 2026-07-31 |
| 15 | AU-specific: AU engineers *"have zero training with total station and dont do any setout or asbuilts"* — so every set-out is a two-party handoff, unlike the UK | r/Surveying (AU/Melbourne, self-ID) | **D+** | — |

### 1.9 Convergence and verdict — Q1

**Convergence:** three independent evidence types agree that a request exists and the requester is on the
engineering side — a shipped competitor object (B), a road authority's retained record class and named
requester-recipient (A-spec), and six job ads (C). **Three independent types also agree that the channel is
undocumented** — no firm form (B, ~25 sites), no ad phrasing (C, ~40 ads), no spec below procurement level (A).

> **VERDICT: KEEP `requested`.**
> Evidence line: CivilPro ships `Survey Request{Raised By, Request To, Date Required, Lots, tolerances}`
> **[V, grade B]**; MRWA retains "survey requests" as a record class and routes the result back to *"the
> officer that requested the survey"* **[A-spec]**; six independent AU job ads assign survey coordination
> to the **site engineer** and **zero** assign it to the foreman **[C]**.
>
> **Two constraints that follow from the same evidence:**
> 1. **The requester is the site/project engineer, not the foreman.** Gate it that way.
> 2. **`requested` must be optional.** The contractual trigger is *"the lot has become accessible for
>    survey"* **[A]**, and firms/practitioners describe verbal, ad-hoc pulls **[B/C]**. The C5 design's
>    existing short-path edges (a record can be created at any state) are **correct and evidence-backed** —
>    do not remove them.

---

## 2. Q2 — Is there a meaningful IN PROGRESS state?

### 2.1 The negative is emphatic, and it comes from five independent directions

**(a) The competitor does not have one.** CivilPro's survey lifecycle, read from its own docs, is:

> Create Survey Request → **Notify Surveyor** → surveyor adds a **Result Set** (per-row Coordinates /
> **Non Compliance** / Comment) → **Notify Result** back to the requester. **[V]**

Two notification acts and a result. **No in-progress state, no partial state, no percentage.** And the docs
are explicit that creation ≠ dispatch: *"Please note that at this point the request has not been sent to the
Surveyor. You will still need to notify the Surveyor."* **[V]**

**(b) No survey or civil software on earth models state on a conformance job.** This was checked across six
vendors:

| Product | State on the conformance work? |
|---|---|
| 12d Model (AU-dominant) | **None.** `Survey => Conformance => Pavement Report` emits a file. |
| Trimble Business Center | **None** on the report. |
| Trimble Access / Siteworks | **None.** |
| Leica Infinity / Captivate | **None.** |
| Topcon MAGNET | **None** — and no conformance flagging at all. |
| Carlson / Civil 3D | **None**; Civil 3D has no native conformance report. |

State exists only in *adjacent* products, and never touching the conformance result. Trimble's **Work
Order** carries `Status`, Priority, Due date and *carries the tolerances out to the field* — and Trimble's
own help page documents the gap in one sentence:

> "**The Work Order Report does not show work order results.**"

12d Synergy has a full state machine (*"WIP, In Review, and Issued"*, actors *"Designer, Reviewer, Client"*)
— but it is a **generic ISO-19650-style document-control workflow over a file** that "knows nothing about
tolerances, points, or whether the pavement conformed", and it is bought separately from 12d Model.

**(c) No AU specification defines a partial state.** Confirmed absent from MRWA CSG, TMR MRTS56, TfNSW G71,
AUS-SPEC C02, Gold Coast Policy 11 and Melbourne Water's checklist. Weather appears in MRWA only as a
*method* constraint (*"The surveyor shall reduce the sight distances accordingly if weather conditions are
extreme"*), never as a job status.

**(d) The training package is binary.** CPPSSI4032 performance criteria run: *"Develop a job schedule with
allocated tasks and timeframes"* → *"Monitor surveying activities against planned schedules"* → **"Report
job completion"**. Plan, monitor, complete. No partial state.

**(e) The state of the art for progress tracking is a fortnightly phone call.** MRWA's own engagement form
offers exactly one progress mechanism: *"Survey Progress phone calls ☐ **at 2 week intervals**"*.

### 2.2 And yet partial work is the absolute norm — which is the actual finding

**The hard artifact.** A real AU subgrade conformance report — 549 points, CH94000–94840, issued 14 Dec 2021
— has field data spanning **three non-contiguous days**: Friday 10 Dec, Saturday 11 Dec, *skip Sunday*,
Monday 13 Dec, issued Tuesday 14 Dec. The report's own header carries **`From Date:` / `To Date:`** fields —
meaning the tool is built on the assumption that **points accumulate over time and a report is a slice of a
growing pool**, not the output of one discrete job.

**A named AU practitioner asking for exactly the missing capability.** On the 12d forums, 31 Aug 2021:

> "we have a DESIGN model … and then we **receive AS CON survey data** of the construction out on site …
> we're looking to get a bit of an automated check/report of **how much data is missing/still to be
> received**" — Darcy Richardson

Nobody answered him with a feature. The replies were "run a quantity report" and "there's a COMPARE tool".

**Supporting practice evidence:**

- **6–8 surveyor visits** to close out a single precast retaining wall: foundation setout + conformance → height pins for blinding → as-built of blinding + footing setout → pre-pour check → as-built of poured footing → final panel as-builts. *"Surveying isn't a one-off task."*
- A conformance **interrupted mid-job**: *"we were doing a conformance on a Friday afternoon and gust of wind picked up a sheet of plastic. Took out the total station **had to go grab a spare to finish the job**"*
- Self-reported **25% re-stake rate** in SE-QLD.
- A commercial AU conformance app that raises a warning when **chainage data gaps exceed 50 m** — a completeness check that only exists because partial coverage is routine.
- 12d, from vendor training material: **"Untested points do not appear on the conformance report."** Points outside a badly set edge extent **vanish rather than fail** — the report can read 100% conformant because the failing points were excluded by an operator setting.

### 2.3 Claim table — Q2

| # | Claim | Source | Grade | Date |
|---|---|---|---|---|
| 16 | CivilPro's survey lifecycle is Create → **Notify Surveyor** → Result Set → **Notify Result**. **No in-progress state.** Creation ≠ dispatch: *"at this point the request has not been sent to the Surveyor"* | https://civilpro.zendesk.com/hc/en-us/articles/5104036254991-Notify-Surveyor-for-Survey-Request , .../5104916336783-Notify-Result-for-Survey-Request , .../5050842504079-Create-a-Survey-Request **[V]** | **B** | upd. 23 Jan 2026 |
| 17 | **No survey/civil software models any state on a conformance job** — 12d Model, TBC, Trimble Access/Siteworks, Leica Infinity/Captivate/ConX, Topcon MAGNET, Carlson, Civil 3D all emit a file with no status | vendor doc corpus, §2.1(b) | **B** | 2026-07-31 |
| 18 | Trimble documents the gap outright: **"The Work Order Report does not show work order results."** | https://help.fieldsystems.trimble.com/tbc/335_1.htm | **B** | 2026-07-31 |
| 19 | The only real state machine in the AU-dominant stack (12d Synergy: *"WIP, In Review, and Issued"* / *"Designer, Reviewer, Client"*) is **generic document control that knows nothing about points or tolerances** | https://help.12dsynergy.com/docs/whatisaworkflow | **B** | 2026-07-31 |
| 20 | **No AU spec defines a partial/in-progress survey state** — absent from MRWA CSG, MRTS56, G71, AUS-SPEC C02, Gold Coast P11, Melbourne Water | negative across the spec corpus | **A** (negative) | 2026-07-31 |
| 21 | Training package is binary: *"Develop a job schedule…"* → *"Monitor surveying activities…"* → **"Report job completion"** | https://training.gov.au/TrainingComponentFiles/CPP/CPPSSI4032_R1.pdf | **C** | CPP Rel 12.0 |
| 22 | State of the art for progress: **"Survey Progress phone calls ☐ at 2 week intervals"** | MRWA form C154_13 | **A-spec** | — |
| 23 | **Real artifact**: a 549-point AU conformance report whose field data spans **three non-contiguous days** (10, 11, 13 Dec) and is issued 14 Dec; the report header carries **`From Date:` / `To Date:`** | https://civilgeospatial.com.au/wp-content/uploads/2022/02/CH94000-94840_SGConformance_211214.pdf | **C (artifact)** | 14 Dec 2021 |
| 24 | Named AU practitioner asking for **"how much data is missing/still to be received"** — no feature answer given | https://forums.12dmodel.com/viewtopic.php?t=14408 (Darcy Richardson) | **C** | 31 Aug 2021 |
| 25 | **6–8 surveyor visits** to close one precast retaining wall; *"Surveying isn't a one-off task."* | https://www.linkedin.com/posts/road-&-civil-surveys-pty-ltd_roadandcivilsurveys-surveying-foundationconformance-activity-7351883537832169472-oZGi | **C−** | ~18 Jul 2025 |
| 26 | Conformance interrupted mid-job by weather, crew fetched a spare instrument *"to finish the job"*; separately a **25% re-stake rate** in SE-QLD | r/Surveying yhry1t, sgkavm (AU-identified) | **D+** | 2022 |
| 27 | A commercial AU conformance app warns when **chainage data gaps exceed 50 m** | https://civilgeospatial.com.au/clients-conformance-application-for-reporting-simplicity/ | **C** | 25 Feb 2022 |
| 28 | **"Untested points do not appear on the conformance report"** — a badly set edge extent makes failing points vanish rather than fail | https://www.exds.com.au/html_content/EXDS_PDF_Information/Survey/Pavement_Conformance.pdf (12d course material) | **C** | Oct 2009 |

### 2.4 Convergence and verdict — Q2

**Convergence on the negative is the strongest in this study: five independent source types** — a shipped
competitor (B), six software vendors (B), five specifications (A), the national training package (C), and a
road authority's own form (A-spec) — **all lack an in-progress state**. Nothing this pass touched has one.

**Convergence on the positive is equally clear but is about a different noun:** four independent
sources — a real dated artifact (C), a named practitioner's unanswered feature request (C), a commercial
app's 50 m gap warning (C), and 12d's vanishing-untested-points behaviour (C) — all describe **incomplete
coverage**, not an in-progress job.

> **VERDICT: RESTRUCTURE — delete `in_progress`, keep the fact it was reaching for.**
> Evidence line: **no competitor, no survey software, no AU specification, and no training unit anywhere
> defines an in-progress survey state** (5 independent source types, all negative) — *but* a real AU
> conformance report spans **three non-contiguous field days** with `From Date`/`To Date` in its header
> **[C, artifact]**, and a named practitioner publicly asked for *"how much data is missing/still to be
> received"* and got no feature **[C]**.
>
> **What is partial is COVERAGE, not the job.** Model it as an attribute of the record (chainage/area
> extent picked up, gaps) rather than a lifecycle state. `in_progress` is a state nobody in the real
> workflow would ever set, because no counterpart system produces the signal to set it.
>
> **Note the convergence with the spec pass §4.9**, which — from pure specification analysis — independently
> concluded that *"were enough points taken, in the right pattern?"* is "a far safer and more valuable
> computation than 'is this point in tolerance'" and "the highest-value cheap win in this area". **The
> practice side reaches the identical conclusion from four different directions.** Two independent research
> passes converging on the same recommendation is the strongest signal in the C5 file.

---

## 3. Q3 — What does RECEIVED actually look like?

### 3.1 What arrives: a per-point table with a chainage key and a per-row compliance column

This is the most convergent finding in the study. Four wholly independent source types produce the same
row schema.

**(a) A road authority publishes a downloadable template.** Main Roads WA ships `compliance-report.xls`
with these columns:

> `CHAINAGE | EASTING | NORTHING | DESIGN | ASCON | RESIDUAL | EXCEEDING TOLERANCE`

and this header block:

> `CONTRACT | JOB # | LOCATION | SURVEYOR | DATE OF SURVEY | CONTROL UTILISED | SURFACE AUDITED`

plus a separate `STRAIGHT EDGE COMPLIANCE TEST` sub-table in mm. Its `EXCEEDING TOLERANCE` cell holds
either `Ok` or the numeric overrun. The guideline text states the minimum contents independently: Easting,
Northing, Chainage, offset, as-constructed elevation, design elevation, **elevation differences and a
status of compliance for each sample point** relative to design tolerances.

**(b) A real 2021 project artifact matches it.** The CH94000–94840 subgrade conformance report carries a
statistics header (upper/lower tolerance, chainage range, points tested, within/too high/too low with
percentages, max/min/average conformance, standard deviation) over a table of:

> `Date | Chainage | Offset | East | North | Asbuilt RL | Design RL | Conformance`

**(c) The software emits exactly this.** Convergent across vendors: 12d bands rows by **Chainage
Bandwidth** and offers design levels + non-conformance errors as tick-box columns; TBC's Pavement
Conformance Report (Advanced) prints point ID, code, easting/northing, thickness, cross-fall and — under
*"Show non-conformance errors"* — **"the tolerance and the amount outside of that tolerance"**; TBC's
Batter report has a literal **`Pass` column set to `False`**; Leica marks out-of-tolerance deltas red.
A 2017 12d forum thread exists precisely because a client wanted **Easting/Northing *as well as*
Chainage/Offset** in one report.

**(d) AU practitioners describe the same thing, layer by layer.** *"here in oz we have to report on **each
layer** and have to meet certain criteria"*; *"Each layer conformance against design height, conformance
against **layer thickness**, conformance against **crossfall**, conformance against **bump tests**, all on
one sheet."*

### 3.2 The format is negotiated, not standardised — and this is stated outright

> "**There are no prescribed methods of how conformance results should be represented.** The examples
> shown under this clause **may be accepted by the Administrator**." — TMR MRTS56 cl. 12

The reporting interval itself is negotiable: 20 m, or 10 m *"if this is acceptable to the Administrator"*.

The software industry has independently converged on the same conclusion: **every vendor stores the
client's report spec as a reloadable template** — 12d's `.tol` file (*"stores the details of every field on
the Tolerance tab, Edges tab, Report file tab and Results Model tab"*), TBC ANZ's saved tolerance
templates, Trimble Access `.sss` stylesheets, Carlson's Report Formatter layouts. **Five vendors solving
the same problem the same way is strong evidence that per-client format variance is the practitioner's real
pain.**

And that variance lands on the surveyor as friction. Verbatim from an AU practitioner:

> "Can you put that **QA report in pretty pdf**… I can't open this .rpt or .txt or .dxf can you look at it"

**Format by jurisdiction** (all A): TMR mandates **12d archive (.12da)** for electronic survey info; TfNSW
mandates **LandXML 1.2+** for string models plus MS Excel and PDF; NT accepts *"Microsoft Word, Microsoft
Excel, pdf, .dwg or .dgn"*; MRWA uses **MX Genio** for DTMs (likely legacy). For council handover the
format is **ADAC XML** — named independently by four AU surveying firms plus the ADAC body.

### 3.3 A structural warning: the report is often a trim instruction, not a verdict

The real 2021 artifact's pass rate is:

> `WithinTolerance: 110 (20.04%) | Too High: 388 (70.67%) | Too Low: 51 (9.29%)`

**A conformance report on a subgrade is not primarily a pass/fail certificate — it is a work instruction
telling the grader crew where to trim.** Modelling the received artifact as a binary verdict would misread
what it is 80% of the time.

### 3.4 To whom, and how fast

**To whom.** Two audiences off one field trip, and CIVOS should not conflate them:

| Document | Goes to | Purpose |
|---|---|---|
| **Conformance report** | Administrator / Superintendent / Principal — and internally back to **the requester** | release a hold point; unlock progress and payment |
| **As-constructed / WAE (ADAC XML)** | council / asset owner | asset record, on-maintenance certificate |

MRWA closes the internal loop explicitly (*"the Main Roads officer that requested the survey"*), and
CivilPro's **Notify Result** goes back to the requester by default **[V]**. **No source names "site
engineer" as the contractual recipient** — treat that as plausible-but-unevidenced.

**How fast.** No AU source states a contractual turnaround SLA for a conformance report after fieldwork.
What exists:

| Number | What it measures | Grade |
|---|---|---|
| **Next day** | last field day 13 Dec → issued 14 Dec (the hardest number in this study) | C (artifact) |
| **1–4 business days** | published turnaround from three firms (SurveyPlus 1–3 days field + 3 days plans; Axis 3–4 business days) | B |
| *"hours every day"* | the manual export/format/email loop *before* automation; clients *"had to wait for an email from an ever frustrated surveyor"* | C (named AU practitioner) |
| **Monthly** | the formal as-constructed lodgement cadence to the Administrator (TMR MRTS56 §15) | A |

**"Same day" is not established by any captured source.**

The commercial reason for speed is stated once, clearly, and it is the most product-relevant quote in the
corpus — SKS Surveys:

> "We understand the need for quick turn around of conformance reports and have developed processes to make
> sure that **construction progress and payment is not held up by conformance reporting**."

Corroborated contractually: NT requires as-constructed *"with or before the next progress payment claim"*;
TfNSW says as-built surveys *"support project milestone payments"*.

### 3.5 Claim table — Q3

| # | Claim | Source | Grade | Date |
|---|---|---|---|---|
| 29 | MRWA publishes `compliance-report.xls` with columns **`CHAINAGE / EASTING / NORTHING / DESIGN / ASCON / RESIDUAL / EXCEEDING TOLERANCE`** and header `CONTRACT / JOB # / LOCATION / SURVEYOR / DATE OF SURVEY / CONTROL UTILISED / SURFACE AUDITED` | https://www.mainroads.wa.gov.au/49be5e/globalassets/technical-commercial/technical-library/surveying-and-geospatial-services/engineering-surveys-guidelines/compliance-report.xls | **A-spec** | file metadata Jan 1999 |
| 30 | MRWA guideline states the same minimum independently: E/N/chainage/offset, ascon + design elevation, **elevation differences and a status of compliance for each sample point** | MRWA CSG §7 | **A-spec** | 20 Oct 2021 |
| 31 | Real artifact columns: `Date \| Chainage \| Offset \| East \| North \| Asbuilt RL \| Design RL \| Conformance` over a stats header | CH94000-94840_SGConformance_211214.pdf | **C (artifact)** | 14 Dec 2021 |
| 32 | Same artifact: **20.04% within tolerance, 70.67% too high** — the report is a **trim instruction**, not a pass/fail certificate | same | **C (artifact)** | 14 Dec 2021 |
| 33 | **"There are no prescribed methods of how conformance results should be represented."** Interval 20 m, or 10 m if acceptable to the Administrator | TMR MRTS56 cl. 12 | **A** | Mar 2022 |
| 34 | **Five vendors independently store the report spec as a reloadable template**: 12d `.tol`, TBC ANZ tolerance templates, Trimble Access `.sss`, Captivate stylesheets, Carlson Report Formatter | vendor doc corpus | **B** | 2026-07-31 |
| 35 | TBC Batter conformance has a literal **`Pass` column set to `False`**; Pavement Conformance (Advanced) prints "the tolerance and the amount outside of that tolerance"; summary prints Points Tested / Within Tolerance / % | https://help.fieldsystems.trimble.com/tbc/21410.htm , https://help.tbcanz.com/hc/en-au/articles/30016520658969-Pavement-Conformance-Report | **B** | 2026-07-31 |
| 36 | A 2017 12d forum thread exists because a client required **both** Easting/Northing **and** Chainage/Offset in the report; added as an option in V12 | https://forums.12dmodel.com/viewtopic.php?t=9707 | **C** | 23 Jan 2017 |
| 37 | AU practitioners: *"here in oz we have to report on **each layer**"*; *"design height, layer thickness, crossfall, bump tests, **all on one sheet**"* | r/Surveying vslrwr, dlx520 (AU-identified) | **D+** | 2019, 2022 |
| 38 | Format friction lands on the surveyor: *"Can you put that QA report in **pretty pdf**… I can't open this .rpt or .txt or .dxf"* | r/Surveying rcfah5 (AU-identified) | **D+** | 9 Dec 2021 |
| 39 | Mandated formats by jurisdiction: **12d archive** (TMR MRTS56 §15), **LandXML 1.2+** (TfNSW DMS-SD-142 §3.5.2), Word/Excel/pdf/dwg/dgn (NT SSRW §1.28), MX Genio (MRWA) | as cited | **A** | 2022–2024 |
| 40 | **ADAC XML** named as the council as-constructed format by **four independent AU firms** + the ADAC body | Nine Surveyors, HR Surveyors, Sunrise, QLD Surveying Solutions; https://adac.com.au/ | **B** | 2026-07-31 |
| 41 | Published turnaround: SurveyPlus *"site survey 1–2 business days, plans same or 1 day after"* / WAE *"1–3 days, plans 3 days after"*; Axis *"3 – 4 business days… once the onsite work is completed"* | https://surveyplus.com.au/surveying-services/building-and-construction-surveys/ , https://www.axissurveys.com.au/ | **B** | 2026-07-31 |
| 42 | Observed real turnaround: **next day** (last field day 13 Dec → issued 14 Dec) | CH94000-94840 artifact | **C (artifact)** | 14 Dec 2021 |
| 43 | The commercial reason for speed: *"…construction progress and **payment is not held up** by conformance reporting"*; NT ties as-constructed to *"with or before the next progress payment claim"*; TfNSW: as-builts *"support project milestone payments"* | https://www.skssurveys.com.au/services/Construction-Surveys ; NT SSRW §1.28; TfNSW DMS-SD-142 §3.2.4 | **B / A** | 2024–2026 |
| 44 | CivilPro's result payload is a **Result Set** of rows with **Coordinates / Non Compliance / Comment**, then **Notify Result** back to the requester | https://civilpro.zendesk.com/hc/en-us/articles/5104916336783-Notify-Result-for-Survey-Request **[V]** | **B** | upd. 23 Jan 2026 |
| 45 | **RTK GNSS is not to be used for vertical compliance checks** on drainage structures, culverts, sub-grade, sub-base, base-course, asphalt and bridge structures — *note: MRWA §5 and §7 disagree on whether subgrade is in or out* | MRWA CSG §5, §7 | **A-spec** | 20 Oct 2021 |

### 3.6 Convergence and verdict — Q3

**Convergence: four wholly independent types produce the same row schema** — a road authority's published
`.xls` template (A-spec), a real project artifact (C), five software vendors' report generators (B), and AU
practitioner descriptions (D+). This is the best-evidenced fact in the pass. It also **independently
corroborates the spec pass's §4.1 conclusion** (per-point rows, positioned by chainage+offset or grid,
with the tolerance carried on the row) from the artifact side rather than the specification side.

> **VERDICT: KEEP `received`.**
> Evidence line: the arriving artifact is a **per-point table keyed by chainage (+offset), carrying design
> value, measured value, deviation and a per-row compliance status**, converged on by MRWA's published
> `compliance-report.xls` **[A-spec]**, a real 2021 AU conformance report **[C, artifact]**, five software
> vendors **[B]** and CivilPro's Result Set **[V, B]** — turned around in **1–4 business days**, explicitly
> so that *"payment is not held up"* **[B]**.
>
> **Three design constraints that follow:**
> 1. **Format is negotiated, not fixed** — TMR states it outright **[A]** and five vendors ship reloadable
>    format templates **[B]**. Do not hard-code a report shape; store what arrived.
> 2. **Do not model the received report as a binary verdict.** The real artifact was 20% conforming and
>    70% high — it is a trim instruction **[C, artifact]**.
> 3. **Keep the conformance report and the as-constructed/ADAC deliverable separate.** Same field trip,
>    two documents, two audiences, two acceptance regimes **[B, 4 firms + A, specs]**.

---

## 4. Q4 — Is ACCEPTED a real act by the head contractor's engineer/QM?

**This is the sharpest verdict in the pass, and the answer is: acceptance is real, but it does not happen
on the survey record.**

### 4.1 The artifact settles it: there is no approval field on a conformance report

The real 2021 AU conformance report's signature block is:

> `Surveyor: T.Mathews` · `Date: 14/12/2021` · `Signature:`

**and there is no engineer, QM, superintendent or client approval field anywhere on the document.** The
certifying party is the surveyor, full stop.

That is not an accident of one document — in AU, certification is a **registration** matter:

- *"Usually, a WAE plan can only be **certified by a registered surveyor**."* (Eric Smith, Registered Surveyor)
- TMR prescribes the verbatim wording: *"I, … hereby certify that the vertical and horizontal locations and dimensions shown on this plan or as delivered electronic file outputs are **directly measured by me or under my direct supervision**."* (the bridge variant drops "or under my direct supervision")
- NT requires an *"**independent surveyor**… certify each of the drawings and/or documents labelled and provided as 'As Constructed'"*
- Melbourne Water requires sheets *"certified and signed by a licensed surveyor or VeriSign"*
- The **Surveyors Board of Queensland** treats it as **unprofessional conduct** *"if a person who is not a Registered Surveyor signs a certification headed 'Registered Surveyors Certification'"*

**A CIVOS "accept" button on a survey record would be asking a non-surveyor to countersign a document that,
by AU convention and in one state by regulator communique, only a registered surveyor signs.**

### 4.2 Acceptance is hold-point release, and it consumes the report as evidence

The single clearest sentence found on this question, from MRWA's own guideline:

> "**The compliance survey results provide the superintendent's representative with evidence for the release
> of hold points.**"

The report's job is to be **evidence**, and the acceptance act is **releasing the hold point**. TfNSW says
the same structurally (already grade A from the spec pass, restated here because practice confirms it):

> "**Process Held:** Covering up of work subject to a conformity verification survey.
> **Submission Details:** Survey Report verifying conformity.
> **Release of Hold Point:** The Principal will consider the submitted documents prior to authorising the
> release of the Hold Point." — TfNSW G71 cl. 5.6.6

And acceptance is **sampled, not per-report**: MRWA has the superintendent independently audit 5–15% of the
product, ≥3 points per lane, and the audit frequency **adapts to the contractor's track record** — it
*"will depend upon the confidence obtained from the contractor's compliance test results when compared with
audit results"*. NT gives the same right: *"The Superintendent **may choose to audit any level survey**
submitted to show conformance."* TMR permits the Audit Surveyor to establish separate project control.
**So the contractor's conformance survey is spot-checked by re-measurement, not desk-approved.**

### 4.3 The gate is on the LOT, not the survey — three independent confirmations

**(a) TfNSW NQ6** makes it explicit that lot close-out is the gate and the survey is a precondition:

> "Work Lots **must not be closed out** nor product released, dispatched, used or installed **until you have
> fully verified their conformity**…"
> "(c) **any specified verification survey has demonstrated conformity** before covering up the work;"

and it forces the ITP to name the reviewing person — of the *lot*, not the survey:

> "(d) who reviews inspection/test results, evaluates whether work conforms… and **closes out work Lots**;"
> "(g) who performs **final review** of all inspection/test results to confirm that all inspections and
> tests have been carried out to completely verify conformity **for each Lot**;"

**(b) A council ITP form** puts the survey and its approval on two *separate rows*. Mackay Regional Council
ITP Checklist 25 (Earthworks Excavation) has a **"Survey"** verification class of its own, defined in the
legend alongside Hold Point, Witness Point and Test. The survey line reads:

> "Geometrics / Batter slopes and floor levels / … / 1 cross section /20m / **Survey Sheet | Survey |
> Surveyor** / **Survey | HP | RPEQ or S/intendent**"

i.e. **Surveyor produces the Survey Sheet; a separate Hold Point is then released by the RPEQ or
Superintendent's Representative.** The lot-closure line is separate again:

> "Works Complete & Conforms, inspection and reports submitted, and all Non Conformance Reports have been
> reviewed, outcomes approved by Council / Approval to proceed (**Incl. Test Results if appl. And survey
> results**) … **Prior to Conformance Report being endorsed** — HP × RPEQ/Superintendent, HP × Council"

**(c) The competitor puts it on the lot too.** CivilPro has **no accept state on the Survey Request**. What
it has instead **[V]**:

- **Lot statuses**: `Pre-Opened` / `Open` / `Guaranteed` / `Conformed` / `Rejected` / `Closed`.
  - *"A **Conformed** Lot is a completed Lot for which all testing has been performed and results received demonstrating compliance, all Checklists are completed and any NCRs are closed out."*
  - *"A **Guaranteed** Lot is a completed Lot that complies with the Specification but is **waiting on some results of testing** (such as 28 day concrete tests) **or other information**."*
  - *"When you 'Close' a Lot, it does NOT mean that it is conformed."*
- **Lot Review** — a configurable review-status layer *on the lot*, whose documented worked example is:
  > "Each engineer administers the documents for each lot, **collecting test request, checklists, survey etc.** When the engineer thinks the lot is ready, they add a review with a status of '**Ready for conformance**'. The QA manager filters the lot register for items marked 'Ready for Conformance'… assign status of '**Conformance review complete**' or '**Conformance review issues**'… QA manager filters for 'Conformance Review Complete' and **bulk conforms**."

**Read that carefully — it is CIVOS's exact design question, answered by a shipping AU product.** The
engineer *collects* the survey; the QM reviews *the lot*; the survey itself never gets accepted. And
CivilPro's `Guaranteed` state is the honest answer to "the lot is done but evidence is outstanding" — an
**awaiting-evidence state on the lot**, not a lifecycle state on the evidence.

### 4.4 The one place a genuine approve/reject gate exists is downstream, at council

Not per-lot, and not the conformance report — the **as-constructed handover**:

> "all 'as constructed' information shall be **submitted and approved by Council** prior to any formal
> acceptance of the Works" — City of Gold Coast Policy 11 §10

Melbourne Water runs a 10-section, line-by-line initialled *Consultant's 'As Constructed' Survey
Certification Check List*. Moreton Bay: *"Submission of a conforming ADAC XML is required for the issue of
… an 'On Maintenance' Certificate."* See §5 for the rejection limb of this.

### 4.5 Claim table — Q4

| # | Claim | Source | Grade | Date |
|---|---|---|---|---|
| 46 | **A real AU conformance report has `Surveyor / Date / Signature` and NO engineer, QM or client approval field anywhere** | CH94000-94840_SGConformance_211214.pdf | **C (artifact)** | 14 Dec 2021 |
| 47 | *"**The compliance survey results provide the superintendent's representative with evidence for the release of hold points.**"* | MRWA CSG §7 | **A-spec** | 20 Oct 2021 |
| 48 | Acceptance is **sampled by re-measurement**: superintendent audits 5–15% of product, ≥3 points/lane, frequency adapting to the contractor's track record; NT *"may choose to audit any level survey"*; TMR allows the Audit Surveyor separate control | MRWA CSG §7; NT SSRW §1.26; TMR Surveying Standards Part 2 | **A** | 2021–2024 |
| 49 | Lot close-out is the gate: *"Work Lots must not be closed out… until you have fully verified their conformity"* + *"(c) any specified verification survey has demonstrated conformity before covering up the work"*; ITP must name who *"closes out work Lots"* and who does *"final review… for each Lot"* | TfNSW NQ6 cl. 8.2.4.3, 7.5.1, https://media.edapp.com/image/upload/v1692588273/briefcase-documents/NQ6_Transport_for_NSW_ejtbeo.pdf | **A** | Ed 1/Rev 9 |
| 50 | Council ITP has **"Survey" as its own verification class** (legend: *"Survey - Designated authority to carry out compliance to specification"*), performed by **Surveyor**, with a **separate** HP released by **RPEQ or Superintendent's Rep** | https://www.mackay.qld.gov.au/files/assets/public/v/1/3-business/documents/forms-and-fact-sheet/itp_checklist_25_-_earthworks_excavation.pdf | **B** | v1.0, pub. 10 Oct 2025 |
| 51 | Same ITP's closure line requires survey results in, *"Prior to Conformance Report being endorsed"*, dual HP (RPEQ/Superintendent **and** Council) | Mackay ITP 25 / 24 | **B** | v1.0 |
| 52 | **CivilPro has NO accept state on the Survey Request.** Acceptance lives on the **Lot**: statuses `Pre-Opened / Open / Guaranteed / Conformed / Rejected / Closed`, plus a configurable **Lot Review** layer (*'Ready for conformance' → 'Conformance review complete' / 'Conformance review issues' → bulk conform*) | https://civilpro.zendesk.com/hc/en-us/articles/4410780815247-Manage-Lot-Status , .../10158283845519-Manage-Lot-Status-Using-Lot-Review **[V]** | **B** | upd. 23 Jan 2026 |
| 53 | CivilPro's **`Guaranteed`** = *"a completed Lot that complies with the Specification but is **waiting on some results of testing**… **or other information**"* — an awaiting-evidence state **on the lot** | same **[V]** | **B** | upd. 23 Jan 2026 |
| 54 | In AU, certification is **registration-gated**: WAE plans *"can only be certified by a registered surveyor"*; TMR prescribes verbatim certification wording; NT requires an *"independent surveyor"*; Melbourne Water requires *"a licensed surveyor or VeriSign"* | Apollo Survey; TMR Surveying Standards Part 2 §6.7.7/§6.6.9.1; NT SSRW §1.28; Melbourne Water checklist | **B / A** | 2014–2026 |
| 55 | **Surveyors Board of QLD**: it is **unprofessional conduct** *"if a person who is not a Registered Surveyor signs a certification headed 'Registered Surveyors Certification'"* | https://www.spatialsource.com.au/providing-certifications-for-as-constructed-plans/ | **C** | 16 Jul 2024 |
| 56 | A genuine approve gate exists **downstream at council**: *"all 'as constructed' information shall be submitted and **approved by Council** prior to any formal acceptance of the Works"*; Melbourne Water's 10-section initialled checklist; Moreton Bay's ADAC-gated On-Maintenance Certificate | https://www.goldcoast.qld.gov.au/gcplanningscheme_policies/attachments/policies/policy11/section_10_as_constructed_requirements.pdf ; Melbourne Water; https://www.moretonbay.qld.gov.au/files/assets/public/v/1/services/building-development/development/adac-submission-checklist-5.0.pdf | **B** | 2013–2022 |
| 57 | Practitioner framing — the report's function is accountability, not permission: *"I never tell them to move the formwork. I just tell them it's out by whatever it is… if they don't then **it will show up in the as-constructed report**."* | r/Surveying 1483ww0 | **D** | 13 Jun 2023 |

### 4.6 Convergence and verdict — Q4

**Convergence is total and comes from four independent types**: a real artifact with no approval field (C),
a road authority stating the report is *evidence for hold-point release* (A-spec), a council ITP putting
survey and its approval on separate rows with different signatories (B), and a shipping AU competitor with
no accept state on the survey and `Conformed` on the lot (B, verified). **Nothing found anywhere accepts a
survey record itself.**

> **VERDICT: RESTRUCTURE — remove `accepted` from the survey record.**
> Evidence line: a **real AU conformance report has a surveyor signature block and no approval field at
> all** **[C, artifact]**; MRWA states the report is *"evidence for the release of hold points"* **[A-spec]**;
> TfNSW NQ6 puts the gate on **lot close-out** *"until you have fully verified their conformity"* **[A]**;
> a council ITP separates the **Surveyor's Survey Sheet** row from the **RPEQ/Superintendent HP** row
> **[B]**; and CivilPro — the closest AU competitor — has **no accept state on the Survey Request** and
> instead ships `Conformed` on the **Lot** plus a lot-level review layer **[V, B]**.
>
> **What to do instead:** let the survey record be **evidence that the hold-point release and lot
> conformance consume**. CIVOS already models both. An `accepted` state on the survey record duplicates
> them, invents a signatory AU practice does not have, and — worse — asks a non-surveyor to countersign a
> document that in Queensland is a registration matter **[C, regulator communique]**.
>
> **If an "awaiting evidence" concept is wanted, put it on the LOT, not the survey** — that is exactly what
> CivilPro's `Guaranteed` status is, and it is the one piece of the competitor's model worth copying
> directly **[V, B]**.

---

## 5. Q5 — Does REJECTED happen, and what triggers it?

### 5.1 The word "reject" is wrong; the published act is "referred back for correction"

**No captured AU document uses "reject" for a survey deliverable.** In AU civil, `Rejected` is a **Lot**
status (CivilPro's lot statuses **[V]**; MRTS50 cl. 7.1 lists *"d) rejection of work"* as a purpose of
lotting; NQ6 gives the Principal the right to reject a non-homogeneous Lot).

What happens to a *survey document* is published once, precisely, and it is a **correction loop with a
clock**:

> "Any errors, deficiencies or ambiguities identified by the Project Manager shall be **referred back to the
> Surveyor responsible for correction or clarification**. These must be **actioned within one business day**
> of the notice being given. The project will not be considered complete until all errors, deficiencies and
> ambiguities have been resolved… **to the satisfaction of the Project Manager**. Transport and Main Roads
> will not be responsible for any additional expense incurred in completing these corrections."
> — TMR Surveying Standards Part 1 §7.6.4

The set-out error case has its own one-day loop and is a **Hold Point**:

> "If the Contractor discovers an error in the position, level, dimensions or alignment of any work under
> the Contract, the Contractor shall **within one business day** notify the Administrator and, unless the
> Administrator otherwise directs, the Contractor shall rectify the error. **Hold Point 8.** If the error
> has been caused by **incorrect survey marks supplied by the Administrator**, the cost incurred by the
> Contractor in rectifying the error shall be **valued as a variation**."
> — TMR MRTS56 cl. 9.2

*(That last sentence is why mark provenance carries money — noted for whoever owns the survey-control side.)*

### 5.2 A genuine, industry-wide rejection loop exists — but downstream, at council handover

This is the strongest convergence in the whole pass on any single mechanism. **Three independent receiving
entities — two councils and a water utility — publish substantially identical wording**, because it is the
IPWEA-QNT generic guideline text adopted locally:

> **Rockhampton RC:** "Should significant anomalies, errors or missing information be identified during
> these checks, the ADAC XML file(s) **may be returned for correction and re-submission prior to Council
> acceptance**."
>
> **Ipswich CC:** "…the ADAC XML file(s) **will be returned to the provider for correction and resubmission
> potentially delaying the progress of the 'On-Maintenance' process and asset handover**."
>
> **Urban Utilities:** "…**This will typically include comparison with the associated drawings.** Should
> significant anomalies, errors or missing information be identified… the ADAC XML file(s) **may be returned
> to the provider for correction and resubmission**…"

**Resubmission is versioned and re-certified**, per Moreton Bay: *"**Each revision of an ADAC Submission must
be accompanied by a newly completed checklist.**"* And the AU convention for a redone lot is the same
shape — MRTS50 cl. 7.2: *"Reworked or subdivided lots shall be **renumbered and shall be cross referenced to
the original lot number**."*

**So the AU idiom for "this came back wrong" is: produce a new, identified artifact linked to its
predecessor — not flip a flag to a terminal dead state.**

### 5.3 The six evidenced triggers

Each has at least one documented source; five have more than one.

| # | Trigger | Evidence |
|---|---|---|
| 1 | **Format / openability** | Practitioner: *"Can you put that QA report in pretty pdf… I can't open this .rpt or .txt or .dxf"* **[D+, AU]**. Formally: TMR mandates 12d archive; councils mandate ADAC XML + DWG + A3-printable PDF; Melbourne Water: *"Each drawing shall be in a separate pdf file and oriented to landscape"* **[B]** |
| 2 | **Wrong method for the specified accuracy** | **"RTK GNSS is not to be used for vertical compliance checks"** on drainage structures, culverts, sub-grade, sub-base, base-course, asphalt and bridge structures — MRWA CSG §7 **[A-spec]**. *Internal inconsistency flagged: MRWA §5 says RTK complies "to sub-grade only", §7 excludes sub-grade. The two clauses disagree.* AU practitioners echo it: *"We couldnt use gps past foundation level."* |
| 3 | **Missing points / insufficient coverage** | MRWA: 3 points/lane, ≤20 m subgrade/sub-base, ≤10 m basecourse **[A-spec]**. TMR: 20 m (10 m by agreement) **[A]**. A commercial AU app warns at 50 m chainage gaps **[C]**. And the mechanical cause: 12d's **"Untested points do not appear on the conformance report"** — a badly set edge extent makes failing points **vanish rather than fail** **[C, vendor training]** |
| 4 | **Wrong datum** | GDA94 vs GDA2020 producing two coordinates for one point, read on site as *"that must be a survey fuckup!!! … we just need to know what we are supposed to use on site"* **[D+, AU]**. Formally: Gold Coast mandates GDA94/MGA94 Z56 + AHD 4th order Class D; MRWA §9.2 requires MGA2020 unless stipulated **[B/A-spec]** |
| 5 | **Wrong design surface** | 12d: a crowned road *"will need to be a tin or the conformance will have to be run in two separate operations"* **[C]**. Trimble/FDOT: *"Trimble may assume that the wrong one is correct, so it is the user's responsibility"* — same data reported **53,165.0 CY vs 3,480.9 CY** depending on modelling choice, a ~15× error the software does not flag **[C]** |
| 6 | **Content mismatch → resubmission** | The three-way ADAC convergence of §5.2 **[B ×3]**; Melbourne Water's numeric trigger: grades recomputed *"where significantly different to design by **15% or greater**"* **[B]** |

Plus the human one, which is not a document defect at all — the contractor disputing the *result*:

> *"I think these conformances are wrong cause we built it right"* **[D+, AU]**

### 5.4 And the software has no concept of any of it

No survey tool models rejection, because no survey tool models state. Worse, **nothing binds a conformance
report to the design surface version it was computed from**, and nothing prevents the issued spreadsheet
from being edited after issue — the "signature" is the surveyor's name typed into a footer field (12d's
*"Footer info… surveyors details to be applied at the bottom of the report"*; TBC ANZ's user-typed
*"reference number (job number) and surveyor name"*). **A wrong-surface report is, by construction,
invisible to the software that produced it.**

*(This corroborates the spec pass's §4.8: a comparison is against a design **revision**, and any stored
comparison must name which design version it was computed against. Practice shows nothing in the existing
toolchain does — which is a gap CIVOS could actually close.)*

### 5.5 Claim table — Q5

| # | Claim | Source | Grade | Date |
|---|---|---|---|---|
| 58 | The published act is **correction, not rejection**: *"Any errors, deficiencies or ambiguities identified by the Project Manager shall be **referred back to the Surveyor responsible for correction or clarification**… actioned **within one business day**… The project will not be considered complete until all errors… resolved to the satisfaction of the Project Manager."* | TMR Surveying Standards Part 1 §7.6.4 | **A** | — |
| 59 | Set-out error loop: notify Administrator **within one business day** → rectify → **Hold Point 8**; if caused by the Administrator's marks, rectification is **valued as a variation** | TMR MRTS56 cl. 9.2 | **A** | Mar 2022 |
| 60 | **`Rejected` is a LOT status in AU civil, not a survey status** — CivilPro lot statuses; MRTS50 cl. 7.1 *"d) rejection of work"*; NQ6 Principal's right to reject a non-homogeneous Lot | CivilPro Manage Lot Status **[V]**; MRTS50; NQ6 | **B / A** | 2022–2026 |
| 61 | **Three independent receiving entities publish near-identical ADAC rejection wording** (*"returned for correction and re-submission"*) — two councils + a water utility, i.e. the IPWEA-QNT generic text adopted locally | https://www.rockhamptonregion.qld.gov.au/files/assets/public/v/1/regional-services/strategic-planning/as-constructed-requirements-and-adac-xml-submission-guidelines-2024-v6.pdf §2.5 ; https://www.ipswich.qld.gov.au/Services/Planning-and-Building/Development-Assessment/Operational-Works-and-Construction/ADAC-As-Design-As-Constructed-As-Constructed-Information ; https://www.urbanutilities.com.au/sfsites/c/cms/delivery/media/MCPHLBEM43YJDLDJFPCDAJS5BBXI | **B ×3** | 2024–2025 |
| 62 | Resubmission is **versioned and re-certified**: *"**Each revision of an ADAC Submission must be accompanied by a newly completed checklist.**"* | https://www.moretonbay.qld.gov.au/files/assets/public/v/1/services/building-development/development/adac-submission-checklist-5.0.pdf | **B** | v2, 2 Dec 2022 |
| 63 | AU redo convention: *"**Reworked or subdivided lots shall be renumbered and shall be cross referenced to the original lot number.**"* | TMR MRTS50 cl. 7.2; mirrored AUS-SPEC C02 cl. 2.6.5 | **A / B** | Mar 2025 |
| 64 | **Trigger — wrong method**: *"RTK GNSS is not to be used for vertical compliance checks"* on drainage structures, culverts, sub-grade, sub-base, base-course, asphalt, bridge structures. **Source contains an internal inconsistency** (§5 vs §7 on sub-grade) | MRWA CSG §5, §7 | **A-spec** | 20 Oct 2021 |
| 65 | **Trigger — missing points**: *"Untested points do not appear on the conformance report"* — failing points **vanish rather than fail** | 12d course material (EDS Pavement Conformance) | **C** | Oct 2009 |
| 66 | **Trigger — wrong design surface**: crowned road needs a TIN *"or the conformance will have to be run in two separate operations"*; and Trimble/FDOT's 53,165.0 CY vs 3,480.9 CY on the same data — *"it is the user's responsibility to ensure that the model is correct"* | EDS 12d notes; https://fdotwww.blob.core.windows.net/sitefinity/docs/default-source/construction/econstruction/docs/trimblehandbook.pdf | **C** | 2009 / — |
| 67 | **Trigger — datum**: GDA94 vs GDA2020 dispute on site; Gold Coast mandates GDA94/MGA94 Z56 + AHD Class D; MRWA §9.2 requires MGA2020 unless stipulated | r/Surveying rcfah5 **[D+]**; Gold Coast P11 **[B]**; MRWA CSG **[A-spec]** | **D+ / B / A** | 2013–2021 |
| 68 | **Trigger — content mismatch, numeric**: grades recomputed *"where significantly different to design by **15% or greater**"* | Melbourne Water Consultant's As Constructed Survey Certification Check List | **B** | v2, Oct 2014 |
| 69 | **Nothing binds a conformance report to the design surface version it was computed from**, and nothing prevents post-issue edit — the "signature" is a typed footer field | 12d Footer info; TBC ANZ user-typed surveyor name; vendor doc corpus | **B** | 2026-07-31 |
| 70 | Human trigger, disputing the result not the document: *"I think these conformances are wrong cause we built it right"* | r/Surveying rcfah5 (AU-identified) | **D+** | 9 Dec 2021 |

### 5.6 Convergence and verdict — Q5

**Convergence:** the correction-not-rejection framing appears in a road authority's surveying standard (A),
in three independent receiving entities' ADAC wording (B ×3), and in a competitor's placement of `Rejected`
on the lot rather than the survey (B, verified). **Three independent types, one answer.** Six triggers are
evidenced, five of them by more than one source.

> **VERDICT: RENAME `rejected` → `returned_for_correction`, and make it non-terminal.**
> Evidence line: **no captured AU document uses "reject" for a survey deliverable**; the published act is
> *"referred back to the Surveyor responsible for correction or clarification… actioned within one business
> day"* **[A]**; three independent receiving entities publish *"returned for correction and re-submission"*
> **[B ×3]**; and in AU civil `Rejected` is a **Lot** status, which is exactly where the competitor puts it
> **[V, B]**.
>
> **Two structural constraints:**
> 1. **A correction produces a NEW version cross-referenced to its predecessor**, not a dead terminal state
>    — that is the AU idiom for both lots (*"renumbered and cross referenced to the original lot number"*
>    **[A]**) and ADAC submissions (*"Each revision… accompanied by a newly completed checklist"* **[B]**).
> 2. **Capture the reason.** Six distinct triggers are evidenced (format, wrong method for accuracy, missing
>    coverage, wrong datum, wrong design surface, content mismatch) and they demand different fixes. A bare
>    boolean is not useful; the return reason is the whole value of the state.

---

## 6. The competitor comparison, side by side

Because this is the most decisive single piece of evidence, here it is against the C5 design explicitly.
All CivilPro rows verified by me on 2026-07-31 **[V]**.

| Concept | CivilPro (shipping, AU) | C5 as specced | Verdict |
|---|---|---|---|
| Survey request object | **Yes** — `Survey Type, Request To, Date Required, Description, Raised By, Date Requested, Lots[], geometry, tolerances` | `requested` state | **Aligned.** Note CivilPro carries **tolerances and geometry on the request**, which C5 should consider. |
| Dispatch | **Explicit separate act** — "Notify Surveyor"; *"at this point the request has not been sent"* | — | C5 has no dispatch concept. Probably fine; note that creation ≠ the surveyor knowing. |
| In progress | **Absent** | `in_progress` state | **C5 has a state the market does not.** |
| Result arriving | **Result Set** — rows of `Coordinates / Non Compliance / Comment`, then "Notify Result" to the requester | `received` state | **Aligned**, and C5's per-point row model (spec pass §4.1) matches the Result Set shape. |
| Accepted | **Absent on the survey.** Lot has `Conformed`; a configurable **Lot Review** layer runs *'Ready for conformance' → 'Conformance review complete' / 'Conformance review issues'* | `accepted` state on the survey | **C5 puts acceptance in the wrong place.** |
| Awaiting evidence | **`Guaranteed`** on the **Lot** — *"complies with the Specification but is waiting on some results of testing… or other information"* | — | **Worth copying.** This is the honest model of "lot done, evidence outstanding". |
| Rejected | **Absent on the survey.** `Rejected` is a **Lot** status | `rejected` state on the survey | **C5 puts rejection in the wrong place**; rename to a correction loop (§5.6). |

---

## 7. What this means for the C5 build — constraints, not instructions

Each traceable to a section above. **None of these is a build decision; they are the evidence a build
decision should be made against.**

**7.1 The record's lifecycle is arrival, not approval.** `requested → received`, plus
`returned_for_correction` looping to a new version. Two states and a loop. (§1.9, §3.6, §4.6, §5.6)

**7.2 Acceptance is consumed by machinery CIVOS already ships.** The hold-point release and lot conformance
are the acceptance acts; the survey record is their evidence. Wiring the survey record *into* those, rather
than giving it a parallel accept, is both cheaper and the only thing practice supports. (§4)

**7.3 The requester is the site/project engineer.** Not the foreman — zero of ~40 AU job ads put survey
tasking in a foreman's duty list, which is consistent with CIVOS's existing lot-setup role gates. (§1.3)

**7.4 `requested` must be skippable.** The contractual trigger is *"the lot has become accessible for
survey"*, and real-world requests are verbal. The existing short-path edges are evidence-backed. (§1.5, §1.6)

**7.5 Coverage, not status, is the partial-work signal.** And "were enough points taken, in the right
pattern?" is independently the highest-value cheap computation per **both** research passes. (§2.4, spec
pass §4.9)

**7.6 Store what arrived; do not impose a report shape.** TMR states outright that no representation is
prescribed, and five vendors ship reloadable format templates precisely because every client wants
different columns. (§3.2)

**7.7 Do not model the received report as a binary verdict.** The one real artifact obtained was 20%
conforming and 70% high — it is a trim instruction. (§3.3)

**7.8 Keep conformance and as-constructed/ADAC separate.** Same field trip, two documents, two audiences,
two acceptance regimes — and only the ADAC one has a real rejection loop. (§3.4, §5.2)

**7.9 The return reason is the value of the return state.** Six distinct evidenced triggers, each demanding
a different fix. (§5.3)

**7.10 Nothing in the existing toolchain binds a conformance record to the design revision it was computed
against.** Both research passes independently flag this. It is a genuine gap, and a cheap one to close. (§5.4)

---

## 8. Consistency with the spec pass — checked deliberately

**No contradictions found.** Five points of contact:

| Spec pass finding (2026-07-31) | This pass | Status |
|---|---|---|
| §4.1 — per-point rows, positioned by chainage+offset **or** grid E/N, tolerance carried on the row, per Lot, certified, nonconformities flagged (from G71 cl. 5.6.5) | MRWA's published `compliance-report.xls` columns, a real 2021 artifact, five vendors' generators and CivilPro's Result Set all produce exactly this — **and the 2017 12d forum thread exists because a client demanded chainage/offset *and* E/N in one report**, which is the "carry both position idioms" constraint arriving from the artifact side | **Confirmed independently, and sharpened** |
| §3.4 — `accepted` is defensible **only** as "the contractor recorded that the customer's own acceptance act occurred"; NSW it duplicates a hold-point release, QLD has no counterpart party, VIC has no act | Practice goes **further**: nobody records acceptance on the survey document *at all*, in any jurisdiction. The real artifact has no approval field; the competitor has no accept state; the gate is on lot close-out | **Confirmed and strengthened** — the spec pass's caution was right and if anything understated |
| §4.9 — "were enough points taken, in the right pattern?" is the highest-value cheap computation, safer than evaluating tolerance | Reached independently from four practice directions: the 3-day artifact, a named practitioner's unanswered 2021 ask, a commercial 50 m gap warning, and 12d's vanishing untested points | **Independent convergence** — the strongest signal in the C5 file |
| §4.8 — a comparison is against a design **revision**; stored comparisons must name which version | Practice shows **nothing in the existing toolchain does this**, and the FDOT 15× volume error demonstrates the blast radius | **Confirmed, and the gap quantified** |
| §4.6 / §4.10 — measurement uncertainty is the same order as the tolerance, so CIVOS must transcribe the surveyor's verdict rather than compute one | Practice adds an independent reason: certification is **registration-gated** in AU, and QLD's regulator treats signing above your registration as unprofessional conduct. A computed CIVOS verdict would be a certification a non-surveyor issued | **Confirmed via a second, independent argument** |

**One observation for whoever revisits the spec side:** the spec pass established that G71 cl. 5.6.5's row
schema is NSW's. This pass found the **same clause text reproduced almost verbatim in the AUS-SPEC lineage**
(C02 cl. 2.7.2; CQC4 cl. 5, dated March 2002; replicated by Bega Valley, Tweed, Kempsey, Wingecarribee,
Cessnock, MidCoast councils) and in **Townsville SC6.4.23**. A FIG 2010 paper by an RTA NSW surveying author
confirms G71 originated as an RTA specification *intended for national adoption*. **So the "NSW" row schema
is in fact the de facto national AU convention, carried into council specs by AUS-SPEC.** That materially
widens the applicability of the spec pass's §4.1 finding beyond NSW.

---

## 9. Unanswered — honestly

**The one genuinely weak answer:**

1. **The day-to-day request CHANNEL (Q1) is not established at any grade.** No whiteboard, no WhatsApp, no
   prestart meeting, no look-ahead-program integration, no site-level set-out request form — from any
   source, in five parallel research streams. The AU vocabulary contains "survey request" as a **retained
   record class** (MRWA) and a shipping **product object** (CivilPro), but **no published artefact exists
   between the procurement brief and the verbal ask**. Whether AU site surveyors mostly self-schedule off
   the programme or mostly get pulled ad hoc is **unknown** — and the two AU signals point opposite ways
   (firms say "programme it"; practitioners describe verbal pulls). This is the honest state of the
   evidence, not a search failure to be papered over.

**Reachable with more budget:**

2. **LinkedIn practitioner posts.** Public `/posts/` URLs are fetchable (proven — claim 25) but could not be
   enumerated with search dead. **The single highest-value unexplored channel** for Q1 and Q2, and the one
   most likely to actually settle the request-channel question.
3. **A contractor's own quality plan / survey procedure with extractable text.** One real candidate found:
   **Haslin Constructions, "SEQ-PR-063 Inspection and Testing Procedure (ITP) Rev6"**,
   `https://haslin.com.au/wp-content/uploads/2026/01/SEQ-PR-063-Inspection-and-Testing-Procedure-ITP-Rev6.pdf`
   — 18 pp, downloaded, **no usable text layer**, no OCR available on this machine. Grade-B
   contractor-authored evidence sitting one `poppler` install away. **Worth a second pass.**
4. **Reddit at scale.** ~37 comments captured before both archive APIs hard-limited. Zero AU-specific
   subreddits reached.
5. **YouTube / podcasts.** Zero captured. "Day in the life of an AU construction surveyor" content almost
   certainly exists and would speak directly to Q1 and Q2.

**Known gaps that are probably low-value:**

6. **Quantified ADAC rejection rates** — how often submissions actually bounce, and how many resubmission
   cycles are typical. No published data found anywhere. Would sharpen §5 but changes no verdict.
7. **Any conformance-report turnaround SLA.** One observed next-day artifact and three firms' published
   1–4 business days is all that exists. No spec anywhere states "report due within N days of survey".
8. **Sydney Water, SA Water, Water Corporation WA, VIC water authorities** as-constructed rejection rules —
   not captured. Given the three-way template convergence already found (§5.2), marginal value is low.
9. **VicRoads/DTP and SA DIT** construction-survey specs — 403 throughout. Note the spec pass already
   established that VIC has **no survey-acceptance act at all**, so the VIC gap is less important than it
   looks.
10. **12d Model v15's current conformance output formats.** The only detailed workflow document reached is
    the Oct 2009 EDS course material, in which the report opens in Notepad. Whether current 12d emits
    Excel/PDF, and what v15's "General Conformance" option does, is **not captured**.
11. **Geospatial Council of Australia** — `geospatialcouncil.org.au` refused connection on every attempt
    from two independent researchers. **Zero evidence captured on CPSurv/RPSurv competency standards.** Do
    not assume the practice-directive material the brief hoped for exists in that form. The **Surveyors
    Board of Queensland Engineering Competency Framework** (competency E.4 *"Set out complex engineering
    works"*, which names *"conformance reports"* as acceptable evidence) turned out to be the best
    professional-body source available and is cited above.
