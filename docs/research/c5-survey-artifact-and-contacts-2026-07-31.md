# RG-1 research pass — what a conformance-survey deliverable actually *is*, how it travels, and who to ask

**Date of pass:** 2026-07-31
**Researcher:** subagent `rg-survey-artifact`, at Jay's direction.
**Closes:** **RG-1** of `docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §3.1 — *"What a conformance-survey deliverable actually is when it reaches a head contractor."* RG-1 blocks **C5.5**.
**Also bears materially on:** **RG-7** (§3.1 — whether survey acceptance is a distinct contractual act) and **RG-4** (instrument provenance). Both are addressed in §5 and §6; neither is closed.
**Companion pass:** `docs/research/c5-survey-tolerance-research-2026-07-31.md` (RG-2), same day. This document is the **practice** side of the same question; that one is the **specification** side. §7 records where they agree.

---

## Verdict up front

**The artifact is a PDF, and there is no prescribed format — the dominant QLD road authority says so in as many words.** TMR MRTS56 cl. 12, verbatim:

> "There are no prescribed methods of how conformance results should be represented. The examples shown under this clause may be accepted by the Administrator."

That sentence appears **twice** in MRTS56 (cl. 12 opening, and again as a note under Table 12.2.1). NSW G71 likewise names **no file format** for the conformity Survey Report. So the format is set per-job by the surveyor and the client, not by the spec.

**But the *row semantics* are prescribed, and they are stable across jurisdictions.** G71 cl. 5.6.5 mandates what the report must *mean*; MRTS56 Table 12.2.1 shows what it typically *looks like*; MRWA independently converges on the same shape. All three describe: **position · design value · as-built value · difference · in/out of tolerance**, keyed to chainage.

**The consequence for C5.5 is a split verdict:**

| | Verdict |
| --- | --- |
| **Is a structured per-point import realistic?** | **No, not as a general-case importer.** The data schema is stable; the *container* is not. Building a parser against "the conformance report" means building a parser against a different file every job, with no header standard, no delimiter standard, no sign convention and no pass/fail encoding standard. |
| **Is the attachment-plus-transcription design (C5.1–C5.3) right?** | **Yes, and it is better-supported than the spec claimed.** The verdict CIVOS transcribes is *in the report* by mandate — G71 cl. 5.6.5 requires the report to "highlight any results that are outside of tolerance (nonconformities)", and MRTS56 Table 12.2.1 carries an explicit **In tolerance / Out of tolerance** legend. `SurveyRecord.surveyorVerdict` is transcribing something the source document is *required to state*. |

**The finding with the largest product consequence is not about file formats at all.** It is a jurisdictional split in *what the report gates*, and it lands on RG-7 and on C5.2's state names — see §5.1. NSW gates cover-up on the **report arriving**. QLD gates cover-up on the **field event plus a notice**, and explicitly excludes delivery of the data from the gate.

---

## 0. How to read this document

Grades follow the program §10 scale: **A** primary authority/specification/legal; **B** official vendor/firm/competitor documentation; **C** customer or independent secondary (job ads, forums, training material — legitimate for *practice* questions where independent sources converge); **D** marketing/directional, never load-bearing alone.

RG-1's own admissibility bar is the loosest in the register — the spec says *"Grade C is sufficient here — this is practice, not specification."* **This pass came in well above that bar.** The core artifact findings are grade **A**, read out of TfNSW and TMR primary specifications. That is a better result than RG-1 asked for and it means §1–§3 do not need a pilot to be relied on. What still needs the pilot is §5.2 and §6.

**Verification standard.** Every grade-A claim below was **independently re-verified by the orchestrating agent** against the extracted PDF text, not accepted from a subagent's summary. The greps are recorded inline. Two of the firm entries in §8 were independently re-fetched. Where a claim rests only on a search snippet or a page that returned 403, it says so and is graded down.

**Copyright.** TfNSW asserts copyright over G71. TMR MRTS56 is published under CC BY 4.0. Clause numbers, table *structure*, and short attributed fragments are recorded; nothing is reproduced wholesale.

---

## 1. What the specifications actually require the report to contain

### 1.1 NSW — TfNSW QA Specification G71 *Construction Surveys*, Ed 2 / Rev 4 (grade A)

Source: `https://standards.transport.nsw.gov.au/_entity/annotation/a61076d5-af35-ed11-9db2-000d3ae019e0`, downloaded 2026-07-31, 551,073 bytes. Same document and edition the RG-2 pass used, so the currency evidence carries over: **zero `SUPERSEDED` watermark hits** (the one `superseded` string is body text at cl. 3.3.1 about retaining superseded mark-register copies, and it appears once rather than on every page — the portal burns retirement watermarks into every page's text layer).

**Clause 5.6.5 *Survey Report* — the row schema, verbatim:**

> "Submit a Survey Report for **each Lot or component** where design levels, position and/or tolerances have been specified. The Survey Report must show the **actual value versus the specified value for position (defined either by grid coordinates, or chainage and offset) and level, and the applicable tolerance** as appropriate.
>
> Submit survey reports for pavements showing values for calculated thickness as detailed in the PROJECT QUALITY PLAN.
>
> The report **must be certified by the Surveyor** responsible for the verification survey and **highlight any results that are outside of tolerance (nonconformities)**."

Three things fall out, and all three matter to C5:

1. **The unit of the report is the Lot.** Not the project, not the layer, not the day. G71 says "for each Lot or component". CIVOS's `SurveyRecord`→`Lot` FK is the correct grain, confirmed by primary source.
2. **The report is a comparison table, not a narrative.** Actual vs specified vs tolerance, per position.
3. **The report must state its own nonconformities.** This is the mandate that makes `surveyorVerdict` a transcription rather than an inference.

**What G71 mandates as fields:**

| Field | Clause |
| --- | --- |
| Position — specified value (grid E/N **or** chainage + offset) | 5.6.5 |
| Position — actual value | 5.6.5 |
| Level — specified value | 5.6.5 |
| Level — actual value | 5.6.5 |
| Applicable tolerance | 5.6.5 |
| Out-of-tolerance highlight (nonconformities) | 5.6.5 |
| Calculated thickness (pavements only, method per PQP) | 5.6.5 |
| Surveyor name, date, **signature** | 2.6.5 |
| Field book page references | 2.6.5 |
| Lot / component identification | 2.6.4 |
| Equipment used (cross-indexed) | 2.6.4 |

**File format: G71 names none for the conformity report.** Clauses 2.6.4/2.6.5 say only "whether in paper or electronic format". Format is named exclusively for the *CADD/WAE model* deliverables, in Annexure G71/A as a tender-time pick-list (`MX GENIO / MX major option SURVEY / MX compatible / Not applicable`). **No LandXML, no 12d, no IFC anywhere in G71.**

**Retention vs submission — an asymmetry that validates the C5 design.** Clause 2.6.6: provide paper copies of electronically collected survey data *"when requested by the Principal."* So the **underlying survey data stays with the surveyor and is produced on demand**; only the **Survey Report** routinely travels. That is exactly the shape C5.2 assumes — one summary artifact attached to the lot, raw data behind it, held by someone else.

### 1.2 QLD — TMR MRTS56 *Construction Surveying*, March 2022 (grade A, CC BY 4.0)

Source: `https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/1-Overarching-Specifications/MRTS56.pdf?la=en` (note: `tmr.qld.gov.au` returns **403 to a default curl UA**, 200 with a browser UA — an environment fact, not evidence about the document). Fetched from the current, non-`/Superseded-Specifications/` path; cover reads March 2022.

**Clause 12 — the format non-mandate, verified by direct grep (two occurrences):**

> "There are no prescribed methods of how conformance results should be represented. The examples shown under this clause may be accepted by the Administrator."

> "Table 12.2.1 is an example only. There are no prescribed methods of how As Constructed Survey and conformance results should be represented."

**Table 12.2.1 — the example pavement conformance table.** Columns, read from the extracted text:

`Design Ch | As Con Ch | Design O/S | As Con O/S | Diff O/S | Design height | As Con height | Height diff | Design cross fall | As Con cross fall | Diff in cross fall | Subgrade height | Pavement thickness`

with a two-state legend **In tolerance / Out of tolerance** (colour-coded in the rendered PDF). The worked example rows carry values like `95.105 / 95.102 / -0.003` — metres to three decimals, i.e. **millimetre-resolution differences expressed in metres**. Table 12.1.2 (excavations, channels and drains) is the reduced form: `Ch | Design O/S | As Con O/S | Diff O/S | Design Height | As Con Height | Height Diff`.

**Reporting interval, cl. 12.2 note:** *"Although conformance reporting results are generally only required at 20 m intervals, it may be more practical to report these at 10 m intervals to align with the As Constructed Survey information if this is acceptable to the Administrator."*

**Minimum content, cl. 12.2.1:** *"The minimum requirement is to provide conformance results for location, height, crossfall and pavement thickness of the constructed pavement layers."*

**Alternative representations are explicitly blessed.** Clause 12 note: where 3D laser scanning was used, *"conformance reporting results to produce heat mapping techniques using surveying and design software, may be used as an additional visual tool to compare between the As Constructed Survey surface and the design"*. And cl. 12.2.1: *"Graphical representations for turnouts intersections including roundabouts maybe more suitable."* **An image can be a conformance artifact in QLD, by spec.** Any C5 design that assumes tabular data would reject a compliant deliverable.

### 1.3 WA — Main Roads WA *Construction Surveying Guideline* (grade A)

Source: `https://www.mainroads.wa.gov.au/technical-commercial/technical-library/surveying-and-geospatial-services/engineering-surveys-guidelines/construction-surveying-guideline/`

> "For compliance testing of formations and pavement layers, **a tabulated spreadsheet** is an effective means of presentation and should include as a minimum:
> - Sample point location by **Easting, Northing, Chainage and offset**.
> - **As constructed elevation and corresponding design elevation.**
> - **Elevation differences and a status of compliance for each sample point** relative to design tolerances.
> - Straight edge delineations."

Plus: *"Additional diagrammatic representation may be required if the tabulated output is inappropriate."* Audit surveys require *"a digital MX genio file together with a tabulated spreadsheet."*

**This is the third independent authority converging on the same row shape** — and the only one that names a container ("a tabulated spreadsheet"), and even then as advice, not mandate.

### 1.4 The convergence, stated plainly

Three road authorities, three states, no coordination between the documents, and the same row:

> **position (chainage + offset, and/or E/N) · design value · as-built value · difference · in/out-of-tolerance status**

**That schema is real, stable, and grade A.** It is the thing worth modelling in CIVOS if C5.5 ever runs. What is *not* stable is anything about how those columns are laid out, ordered, labelled, delimited, signed or encoded — because MRTS56 says out loud that nobody prescribes it.

---

## 2. What the tools actually emit

### 2.1 12d Model — the dominant AU civil package (grade B)

12d has a **purpose-built conformance reporting engine**: `Survey => Conformance => Pavement Report` and `Survey => Conformance => Batter slope report`.

Source: Extra Dimension Solutions (12d's AU distributor) training handouts —
`https://www.exds.com.au/html_content/EXDS_PDF_Information/Survey/Pavement_Conformance.pdf` and `.../Batter_Conformance.pdf`

> "The Pavement Report option generates a report on surveyed points representing the top of an as-built layer in the formation of a road, compared against string/tin data representing the top of the designed pavement. There is also an option to compare the same surveyed points against a tin representing the bottom of an as-built layer to obtain the layer thickness."

**The output is a paginated plain-text file.** Three independent tells in the same document:

> "To view the report, select the folder icon in the Results area and then select 'open', this will open the report in **notepad**."

> "Report file tab, **Max lines per page**: this number is needed so that page breaks can be inserted into the report file at the appropriate places."

> "**Header info**, the information that will appear at the top of the report file. … **Footer info, surveyors details to be applied at the bottom of the report.**"

Fixed-width, line-printer pagination, a header block and a **surveyor-details footer** — designed to be *printed*, not parsed. Every N lines carries a page-break artifact.

**Positional reference is chainage + offset from a control string**, not coordinates: *"Control string (usually centre line) will be the reference for chainage and offset of the surveyed points."* Eastings/Northings were **not originally in the report** — from the official 12d support forum (`https://forums.12dmodel.com/viewtopic.php?t=9707`), a user asks how to get E/N into a Pavement conformance report *"as client requires both in report"*, and 12d's answer is that E/N *"have been added as an option in V12."*

**That exchange is the single most useful vendor finding in this pass**, for three reasons: it confirms per-point rows; it confirms **clients dictate the column set**; and it confirms the column set **varies by 12d version**. There is no stable 12d report schema to parse against.

Tolerance configuration lives in a separate `.tol` file. The function also emits colour-coded graphical "result models" into the 12d project — those become plots, not files the contractor receives.

**12d Field** (the controller software) exports: `IFC, KML, PTS, TAB, Land XML, MOS, MS Excel, DXF, DWG, DGN, GRD, OEM, ASCII, SHP, TXT, 12DA, 4DA, TN3, LN3, RD3, PT3, TTM` (`https://12d.co/12d-field/features/`). **MS Excel and TXT are both in that list** — an Excel-shaped conformance output is reachable from the field.

### 2.2 Trimble (grade B)

Reports are **XSLT stylesheets transforming a JobXML-format XML file** — confirmed verbatim from Trimble's own *Defining Stakeout Reports for Trimble Access* PDF (`https://help.fieldsystems.trimble.com/trimble-access/latest/en/pdfs/access-custom-stakeout-reports.pdf`):

> "The content and format of the stakeout reports is controlled by **XSLT style sheets**. Translated default **Stakeout Style Sheet (*.sss)** files are included with the language files…"

Shipped report stylesheets include Stakeout report, Survey report, Quality control report, Check shot report, **Surface inspection report**, Volume computation report, Traverse deltas report. Output formats across the set: **HTML, PDF, CSV, Microsoft Word XML**.

**The modern scan-based conformance artifact is PDF-only** (`https://help.fieldsystems.trimble.com/trimble-access/latest/en/cogo-surface-inspection.htm`):

> "The Surface inspection function … compares the scan point cloud of the as-built surface with a reference surface and calculates the distance to the reference surface for each scan point."
> "**You can create a Surface inspection report PDF file** … includes a summary of the surface inspection parameters, **any screen captures** of the surface inspection, and any inspection points stored with the surface inspection."

As-staked deltas record ΔN/ΔE/ΔElevation (or hDist/vDist/azimuth), cut/fill to design, and station+offset; a stakeout tolerance drives an in/out flag recorded in the report.

**Trimble Business Center (desktop) is unverified.** A `help.tbcanz.com` page titled *"Pavement Conformance Report"* surfaced in search — which would be Trimble's ANZ answer to 12d's conformance module and is directly relevant — but the page **returned HTTP 403 and could not be read. Un-captured, needs re-location.**

### 2.3 Leica (grade B/C)

Architecture is identical to Trimble: raw dataset → **HEXML** intermediate → stylesheet → output, with outputs *"CSV, PDF, HTML, FLD, TXT etc."* Captivate v3.0 exports user-configured **cutsheet** data direct from the field. Infinity reports on stakeout and checks *"with tolerance flags"* (that last is grade D marketing).

Worth noting for the 12d-dominance question: the NZ Leica stylesheet pack ships an **"FLD – Exports to 12D"** stylesheet, and Infinity ships 12d export variants. Competing hardware vendors write exporters *into* 12d.

### 2.4 Topcon / Carlson / MAGNET — **not established**

MAGNET Field/Office has "Stake Reports" (a Topcon webinar by that title exists); MAGNET Office workflows end in a `TP3` machine-control surface. **Format not confirmed. Un-captured, needs re-location.** The research ran out of WebSearch budget here. Low materiality: the architecture across every other vendor is identical (stylesheet → CSV/PDF/TXT) and Topcon/Carlson are a minority share in AU civil relative to 12d + Trimble + Leica.

### 2.5 What each interchange format can and cannot carry

**LandXML carries geometry, never a result.** Its schema covers `CgPoints`, Survey Monuments, Survey Reduced Observations, `Surfaces` (TIN), `Alignments`, `Parcels`, `PipeNetworks`. **There is no conformance-result concept in LandXML.** A LandXML file is an *input* to a comparison — it is never the *output* of one. If a LandXML file arrives at CIVOS, it is a surface, not a verdict.

**CSV point files are a live footgun.** PENZD = Point, Easting, Northing, Elevation, Description. PNEZD = Point, Northing, Easting, Elevation, Description. The **only** difference is E/N column order, both are in common use, and there is no header-row convention. A PENZD file parsed as PNEZD produces points transposed across the diagonal, **silently, with no error**. (Grade C — multiple independent secondary sources converge; no single authority publishes this.)

---

## 3. What actually reaches the head contractor — ranked

| Rank | Format | Why | Confidence |
| --- | --- | --- | --- |
| **1** | **PDF** — multi-page, colour-coded table, often with embedded plan screenshots or scan heat maps | The whole downstream compliance chain is PDF; Trimble's surface inspection report is PDF-only; any 12d text report gets printed-to-PDF before it leaves the office, because that is how a header/footer/signature survives | **High** |
| **2** | **Excel / CSV** | MRWA *specifies* "a tabulated spreadsheet"; 12d Field exports MS Excel natively; Trimble stylesheets output CSV. Because MRTS56 prescribes nothing, most survey offices maintain their own Excel template with the client's required columns and conditional-format pass/fail. Expect `.xlsx` over `.csv`, and expect the header row to start on row 5–8 under a logo and job-details block | **High** |
| **3** | **Plain text `.txt`** — raw 12d Pavement/Batter Report, fixed-width, paginated, header + surveyor footer | Lands unedited more often on smaller jobs and from subcontract survey outfits that don't reformat | Medium |
| **4** | **Images (JPG/PNG)** — screenshots of a 12d result model, scan heat maps, photos of a marked-up printed report | **MRTS56 cl. 12 explicitly blesses heat maps and graphical representations as conformance results** | Medium-high |
| **5** | **DWG/DXF** — marked-up as-constructed / WAE drawings | Arrives at lot closeout and handover, not per-layer conformance | Medium |
| **6** | **ADAC XML** | End-of-project asset handover, passing *through* the contractor to council. Not a conformance report — see §4.3 | Medium |
| **7** | **`.12da` archive** | On TMR-spec jobs specifically, because MRTS56 cl. 15 mandates it. It is a data drop, not a report — but a site engineer may well attach it because the surveyor emailed it | Medium |
| **8** | **LandXML** | Occasional, usually flowing the *other* direction (design out to the surveyor) | Low |
| **9** | `.dbx`, `.job`, `.tp3`, `.tol`, `.sss`, HEXML, JobXML, `.12dpj` | Survey-office internals. If one lands in CIVOS, someone attached the wrong file | Low |

---

## 4. How it travels, and when

### 4.1 Channel — email, and a road authority that anticipates the attachment being too big

**The only AU specification found that names a transmission mechanism names email.** MRTS56 cl. 15 *Deliverables*, verbatim:

> "As Constructed Survey information, including an updated Survey Control Register, shall be submitted **on a monthly basis** to the Administrator and **emailed copies** to TMR_Spatial_Enquiry@tmr.qld.gov.au"
> "Survey information in electronic format shall be provided in **12D archive file format** using the current TMR Surveying Standards."
> "**Large email attachments can be sent via a file hosting service (such as OneDrive).**"

A 2022 state road authority specification writing a contingency for *"the attachment is too big to email"* is the strongest available evidence that **email-plus-link is the real default**, not a document-control platform.

G71 says only "Submit" / "Provide … when requested by the Principal", with paper or electronic both permitted. MRWA routes compliance results to the superintendent's representative, who releases hold points on that evidence. **No spec reached names a platform.**

**Honest gap — the Aconex question is unresolved.** Despite targeted searching, **no** job-ad body, tender scope, subcontract survey scope or contractor procedure was captured naming **Aconex, Teambinder, InEight, Procore, ProjectWise or Asite** as the channel for survey conformance specifically. Every hit was vendor marketing (grade D). Likewise **zero evidence** of a surveyor uploading directly into a contractor QA system. **Un-captured, needs re-location** — this is a genuine white space in the evidence, not a proven absence.

The one contrary-direction signal that *is* documented points the opposite way from the intuition: **CivilPro pushes compiled lot documents *outward* to Teambinder/InEight** as a handover destination. Document control is where the contractor's *assembled package* goes, downstream of the QA system — not where the surveyor's raw report arrives. (Grade B*, see §4.4.)

### 4.2 Timing — one hard number, and it clocks the wrong thing

**G71 cl. 5.6.3 *Timing*, verbatim (grade A):**

> "Perform conformity verification surveys for the bound pavement layers, concrete subbase and concrete base as soon as practicable, but in any event **not later than one working day after the pavement Lot has become accessible for survey**, unless otherwise agreed by the Principal."

Note precisely what that clocks: **survey performance**, not report delivery — and only for bound pavement and concrete. Unbound layers and earthworks carry no stated deadline in G71.

The one place G71 *does* clock a report is the joint survey, cl. 2.10.2: results to the Principal *"within 5 working days of completion of the survey, and at least one working day before disturbing or covering up the area of the joint survey."*

**Cadence elsewhere:** TMR survey data stream is **monthly** (MRTS56 cl. 15). TMR's per-lot Conformance Report is due *"on completion of the relevant lot and prior to substantial progress on subsequent lots"* (MRTS50 cl. 10.1.1) — a work-front deadline, not an elapsed-time one.

**No turnaround SLA exists in the evidence.** AU survey firms advertise "fast turnaround" and "guaranteed turnaround times" but **not one** publishes a same-day or 24-hour figure. That is grade D. Do not build a claim, a UI expectation, or an overdue-alert default on it.

### 4.3 Per-lot conformance vs WAE / as-constructed — **different artifacts, confirmed**

**Yes, distinct. The contrast passes *within single documents* in three jurisdictions** — which is the strongest form of this evidence, because it rules out the two terms being regional synonyms.

| | Per-lot artifact | End-of-job artifact |
| --- | --- | --- |
| Name | Conformity **Survey Report** (NSW) / **Conformance Report** (QLD, VIC) | **As Constructed** drawings & surveys (QLD/WA) / **Work-As-Executed** drawings + WAE model (NSW) |
| Cadence | Per lot, during construction | Once, at completion (captured progressively) |
| Gate | Cover-up hold point / progress payment | Certificate of Practical Completion; council asset acceptance |
| Recipient | Superintendent / Administrator (contract-life) | Principal → council / asset owner (asset-life) |

Within-document evidence:
- **G71** splits cl. 5.6 *Product Conformity Survey* from cl. 5.8 *WAE Drawings* (per TfNSW G2) and *WAE Model* (per TfNSW G73) — the latter separately priced as **Lump Sum Pay Item G71P3**. Its Schedule of Identified Records lists `5.6.6 Survey Reports verifying conformity` and `5.8.2 Work-As-Executed survey model` as **separate line items**.
- **MRTS50** separates cl. 10.1.1 per-lot Conformance Report from §12 As Constructed drawings, the latter *"a condition precedent to the issue of the Certificate of Practical Completion."*
- **City of Melbourne** civil works spec has the line that names the relationship: *"Each lot or groups of lots of the Works shall be subject to assessment for compilation onto as-built records."* **Lots are the input; the as-built set is the compiled output.**

**Terminology correction worth carrying forward:** *"conformance survey"* is **not** a term of art — the string appears **zero times** in MRTS56. TMR splits it into the **As Constructed Survey** (the measurement) and **"conformance reporting results"** (the tolerance comparison). NSW says **"conformity verification survey"** and **"Survey Report"**. WA says **"compliance surveys"**. All four map to the same artifact. CIVOS's user-facing label matters less than not assuming a customer will search for the word CIVOS chose.

**ADAC is not a conformance format — do not conflate them.** ADAC (Asset Design and As Constructed) is an XSD-validated XML **asset-register handover** standard governed by IPWEA Queensland, current schema v6.0.0, legally mandated in SEQ by the SEQ Water Supply and Sewerage Design and Construction Code. It records pipes, pits, kerbs, their attributes and levels — *what was built and where*. **It does not record "design was 95.105, actual was 95.102, difference −0.003, within tolerance."** It is the end-of-project asset drop; the conformance report is the per-lot QA evidence. This is consistent with `docs/research/d0-adac-handover-research-2026-07-28.md` having already killed the D2 XML-writer limb — nothing here reopens it.

Councils/utilities verified from primary text as mandating ADAC XML: **Gold Coast, Sunshine Coast, Unitywater** (Sunshine Coast accepts v5.02 or v6.00 until 1 Sep 2026, then v6.00 only). Logan, Moreton Bay, Rockhampton, Whitsunday, Mackay and Brisbane City Council returned 403/WAF to every fetch method tried — **title-level evidence only, do not cite as mandates.**

### 4.4 What the contractor does with it — it lands in three places, not one

**1. As an ITP row that gates physical work.** MRTS50 cl. 8.2 requires an ITP to include *"(g) all Witness and Hold Points"*, and MRTS56 defines **14 Hold Points and 22 Witness Points**, nearly all survey-conformance gates. Because 8.2(g) forces every HP/WP into the ITP, survey conformance **necessarily** appears as ITP rows. Same in NSW via G71 Annexure C1.

**2. As a named component of the per-lot Conformance Report.** MRTS50 cl. 10.1.1, verbatim:

> "A Conformance Report shall be prepared for each lot and shall include the following:
> a) completed inspection and test records
> b) analysis of the results to demonstrate compliance with the relevant Technical Specification
> c) where there has been an engineering variation to the design … captured in a design revision drawing certified by the Registered Professional Engineer Queensland (RPEQ), and
> **d) As Constructed surveys in accordance with MRTS56 Construction Surveying.**"

**The surveyor's report is an ingredient of the contractor's lot conformance record, not the record itself.** MRTS50 cl. 7.1(c) says why lots exist at all: *"submission of work to the Administrator under cover of a conformance report."* And cl. 7.2(c) requires the lot register to record *"the location, including where necessary three-dimensional surveyed position of the lot"* — **spatial position is a lot register field by spec**, which is independent support for the program's spatial-modality thesis.

**3. As a separate spatial deliverable stream** — MRTS56 cl. 15, monthly, 12d archive, to a spatial inbox; then the pre-PC bundle with signed Surveyor Certification (Witness Point 22).

**What the physical artifact looks like** (grade C, a real controlled contractor form): two pages. Page 1 "Lot Summary" = job/chainage header plus a **document manifest table** with `APPLICABLE Yes/No` and `ATTACHED Yes/No` columns per row (Product Test Reports, Authorisation To Proceed, NCRs, ITPs, "Statement of Conformity (NSW only)"). Page 2 "Lot Conformance" = chainage-indexed control table, certificate rows with Report No., and the declaration **"This Lot is: ☐ Conforming ☐ Nonconforming ☐ Conformance Guaranteed"**. Source: `https://www.trainingrpq.com.au/uploads/1/1/5/3/115329109/f_8.1.2.2_1p_-_1c_conformance_report_-_spray_sealing.pdf`

**The real lot conformance report is a manifest plus a declaration, not a document dump.** That is a useful shape check for D1's folio.

**Competitor note — CivilPro is further along than assumed; do not claim they have nothing.** Their KB defines a Lot as *"a specific, discrete section of the physical work … [with] all of the testing, inspection, conformance checks and valuation of work completed … referenced back to the Lot"*, with statuses **Conformed / Guaranteed / Rejected** — which match MRTS50's conformance/indicative-conformance model *and* the RPQ form's three checkboxes exactly. That is a three-way triangulation from spec → real form → product. They already ship a **Survey Request register** parallel to Test Requests, with a Lots field, lot-derived geometry, a "Request To (authorised surveyor)" field, **tolerance levels and commentary** fields, and a create → Notify Surveyor → Notify Result workflow.

**The seam:** *"as-constructed"* / *"as-built"* appears **nowhere** in any CivilPro article retrieved, including their Project Completion and Handover page. Their survey concept reads as verification-to-tolerance with no evidence of As Constructed spatial data capture — which is exactly what MRTS50 cl. 10.1.1(d) and the MRTS56 monthly/12d/WP22 stream demand. Grade **B\*** — `civilpro.zendesk.com` 403s on direct fetch; content recovered via an `r.jina.ai` text proxy, self-consistent and cross-referenced but not verified against the live page.

Others: **CONQA** — thin lot object, no lot conformance report, no survey concept. **Dashpivot/Sitemate** — lots are form records, not objects; their own docs say *"Linking to forms that already exist isn't supported yet"*, i.e. create-only one-directional linking, which structurally rules out assembling a conformance dossier. **Procore** — no lot, no ITP object. **FTQ360's "Phase/Lot"** is a US residential subdivision lot, a different concept entirely.

---

## 5. The findings that change something in the C5 spec

### 5.1 **The NSW/QLD gate split — bears directly on RG-7 and on C5.2's state names** (grade A)

This is the most product-consequential finding in the pass, and it is not about file formats.

**NSW — the report arriving IS the production gate.** G71 cl. 5.6.6, verified verbatim by direct grep:

> **5.6.6 Submission of Survey Report**
> **HOLD POINT**
> **Process Held:** Covering up of work subject to a conformity verification survey.
> **Submission Details:** Survey Report verifying conformity.
> **Release of Hold Point:** The Principal will consider the submitted documents…

You cannot cover up until the Principal *has the report document*.

**QLD — the field event plus a notice is the gate, and delivery of the data is explicitly excluded.** MRTS56 cl. 11.5.1, verbatim (this construction appears **6 times** in MRTS56 — verified by grep count — across HP9/10/11/12/14 and WP11/13/20/21):

> "backfilling shall not be undertaken until the As Constructed Survey requirements have been met and notice of such Works **(excludes delivery of As Constructed Survey information)** provided to the Administrator."

**So NSW blocks cover-up on a *document*; QLD blocks cover-up on a *field event plus a notice*, with the data following monthly.**

**What this means for C5.2.** The spec's §0.1 lifecycle is `requested → in progress → received → accepted`, and `[C5S-B4]` correctly pilot-gates the state *names*. This finding says something sharper than "the names need validating": **`received` and `accepted` are not the same act in the two jurisdictions, and in QLD the gate fires before `received` is even possible.** A single boolean "survey done?" cannot serve both. A design that treats "the report is attached" as the readiness signal models NSW correctly and QLD incorrectly.

The cheap, honest disposition — and this is a recommendation, not a finding — is that C5.2 should be able to record **"survey performed and notified"** as distinct from **"report received"**. The states already in the spec nearly support this (`in progress` vs `received`); what needs to be true is that the *folio and hold-point surfaces* can show the first without the second, rather than treating an absent document as an absent survey.

**RG-7 status: substantially informed, not closed.** RG-7 asks whether survey acceptance is a distinct contractual act or a byproduct of the superintendent releasing a hold point. The answer from primary sources is **jurisdiction-dependent**: in NSW the survey report submission *is* a Hold Point in its own right (cl. 5.6.6), released by the Principal — so acceptance is a distinct act with a distinct release. In QLD the survey feeds a Witness/Hold Point on the physical work and the data delivery is severed from it. RG-7's stated unblock condition ("one contractor + one surveyor, grade C") still stands for the *practice* question of whether contractors actually track these separately, but the *contractual* question now has grade-A evidence and it says: **NSW yes, QLD no.**

### 5.2 Certification — "Surveyor" is a competency, not a registration (grade A)

**No Australian statute requires a construction/engineering survey conformance report to be signed by anyone holding any registration.** The registration statutes in all three target states are **cadastral-only**:

- **QLD** — `Surveyors Act 2003` s75 is the only carrying-out offence and it is cadastral-only; sch 3 defines cadastral survey as *"a survey to identify a boundary of a particular area of land."* The Surveyors Board of Queensland states it plainly: *"An engineering surveyor is **not required by legislation** to be registered with the Surveyors Board of Queensland. However, many engineering surveyors seek an engineering endorsement … as a sign of their professionalism."* (grade B — `https://sbq.com.au/registration/when-is-registration-required/`)
- **NSW** — `Surveying and Spatial Information Act 2002` s21's offence is limited to *"a land survey for fee or reward"*, and s3 ties "land survey" to boundaries and interests in land. Construction survey is not caught.
- **VIC** — the most on-point, because it regulates *signing*. `Surveying Act 2004` s37(1): a person not registered as a licensed surveyor must not *"(a) certify to the accuracy of a **cadastral** survey; or (b) sign or initial a plan purporting to be the plan of a **cadastral** survey."* Signing a construction conformance report is untouched.

**Contractually, NSW requires certification — but defines the certifier by qualification.** G71 cl. 5.6.5 requires the report be *"certified by the Surveyor responsible for the verification survey"*, and cl. 2.6.5 requires **name, date and signature** on the report. But G71 cl. 2.2.1, verified verbatim:

> "Surveyors engaged by the Contractor must hold as a minimum a **Diploma in Surveying**, or equivalent qualification, from a recognised tertiary institution, and have at least **two (2) subsequent years** of practical experience in surveying satisfactory to TfNSW.
> Surveyors undertaking activities specified to be by Registered Land Surveyors must be land surveyors registered under the Surveying Act."

Registration is invoked **only where the specification names it**. And technician-under-supervision is the *designed* model, not a workaround — TMR Surveying Standards Part 1 §2.4.3: *"'Surveyor' shall mean a competent person who personally undertakes the survey **or elects instead to supervise another person/s** to undertake the survey … and takes personal responsibility for the survey."*

**The end-of-job as-constructed plan is a different story** — that *is* registration-gated. Gold Coast requires as-constructed info *"endorsed by a Licensed Surveyor"*; Unitywater requires **RPEQ-signed** as-constructed drawings; Shellharbour requires *"Signed Certifications … on each and all pages … by the Registered Surveyor."* And the Surveyors Board of Queensland has published **twice in twelve months** complaining that under-qualified people are signing As-Constructed certifications (grade B, snippet-only — both SBQ article pages 403'd, **needs re-location**).

**Implication for C5.2, and it is a caution:** the spec's `surveyorName` free-text field is **correct and should stay free text**. Hard-requiring a registration number, or offering a dropdown of registered surveyors, would misrepresent the law and block the majority legitimate case. If a registration number is captured it must be **optional**, stored as claimed-not-verified, and never rendered in a way implying CIVOS validated it. This is the same class of honesty rule as `[C5S-B1]`.

**MRTS56 also shows the certifier is not always a surveyor** — cl. 10.9 (pile set-up/restrike) requires certification *"by the Surveyor **or** Registered Professional Engineer of Queensland."* An optional second-certifier slot is defensible; a surveyor-only model is not universally correct.

### 5.3 RG-4 (instrument provenance) — the spec's decision is vindicated

`[C5S-c]` rejected a nullable `instrumentNote` column on the reasoning that *"a field that is empty on every real record is a claim the product cannot keep."*

**This pass found no evidence contradicting that, and some supporting it.** G71 cl. 2.6.4 requires the contractor's *records* to be cross-indexed to *"equipment used"* — but that is a retention obligation on the surveyor's own records, and cl. 2.6.6 makes those produced **only on request**. The instrument identity is **not** among the fields G71 cl. 5.6.5 requires the *Survey Report* to show, and it does not appear in MRTS56's Table 12.2.1 columns or in MRWA's minimum list. **Instrument provenance is retained by the surveyor and does not travel with the report.** RG-4 remains open for the "what does it carry" half, but the "does it reach a head contractor" half now has a grade-A negative answer: **routinely, no.**

---

## 6. Recommendation for C5.5 and for the survey attachment

**1. RG-1 is closed. C5.5 remains blocked — on RG-2's applicability, RG-3, and the datum gap — but RG-1 no longer contributes to the block, and its answer argues for *narrowing* C5.5 rather than unblocking it.**

**2. Keep the attachment format-agnostic. This is already what C5.1–C5.3 do, and the evidence now backs it explicitly.** MRTS56 says no format is prescribed; MRTS56 blesses heat maps and graphical representations as valid conformance results; G71 names no format at all. **Any file-type whitelist narrower than "what the document upload path already accepts" would reject a spec-compliant deliverable.** Do not add a survey-specific MIME restriction.

**3. Do not build a PDF table extractor.** These reports carry merged header cells, colour-as-data (MRTS56's In/Out of tolerance legend is *colour*), and page-break artifacts every N lines from 12d's max-lines-per-page. Extraction accuracy will be poor and the failure mode is **silent-and-wrong on a compliance record** — the worst possible failure class for this product, and the one `[C5S-B1]` exists to prevent.

**4. If structured import is ever built, it is `.xlsx`/`.csv` only, with explicit per-project column mapping — never auto-detection.** The row schema is stable (§1.4) but every job's container differs in column set, order, labels, units, sign convention and pass/fail encoding. A one-time per-project mapping step the engineer performs and reuses is honest; auto-detection is not. **PENZD-vs-PNEZD is the specific reason auto-detection is unsafe** — a transposed file produces plausible-looking wrong coordinates with no error, and the output would be a certified lot.

**5. Capture the metadata the human already knows, alongside the opaque file.** Layer/lot, chainage from–to, surveyor name, survey date, the surveyor's stated verdict. **Three or four typed fields beat a parser**, and they give a queryable conformance state without CIVOS asserting anything it did not receive. This is what C5.2 already specifies; the finding is that it is not a compromise — it is the correct design given the evidence.

**6. Separate "survey performed and notified" from "report received"** (§5.1). Without it, the readiness/hold-point logic is right in NSW and wrong in QLD.

**7. Keep `surveyorName` free text with registration optional and unverified** (§5.2).

**One thing this pass did *not* find and that the C5 spec should not assume:** any evidence that a surveyor will ever log into CIVOS. Every transmission path found is the surveyor sending a file to a human at the contractor. The C5.2 design (a CIVOS user files the surveyor's report against a lot) matches the observed workflow; an "invite your surveyor" flow does not, and §1.2 was right to push outbound requests to Wave E.

---

## 7. Consistency with the RG-2 pass

`docs/research/c5-survey-tolerance-research-2026-07-31.md` concluded **per-point rows, with lot-level aggregates computed from them**, from VicRoads Section 204, TfNSW R44, and TMR MRTS04/MRTS56.

**This pass agrees and adds a practice-side qualification that matters:**

- **Agreement:** every artifact found is per-point. 12d's conformance report is per-point rows keyed on chainage+offset; MRTS56 Table 12.2.1 is per-point rows; MRWA specifies per-sample-point rows with a per-point compliance status; Trimble's as-staked deltas are per-point. **Nothing found produces only lot-level summaries.** RG-2's structural conclusion is independently confirmed from the practice side.
- **The qualification:** RG-2 found VicRoads Section 204 Form 3 (Table 204.031) accepts a lot **statistically** — mean and standard deviation of departures, with *no per-point acceptance limit* under Scale A or B. **No tool or authority artifact found in this pass emits x̄ and S.** 12d's report emits per-point deviations against a tolerance band; MRTS56's table emits per-point differences with an in/out flag. The Victorian statistical reduction (Section 173 cl. 173.05: per-point departures in, two lot statistics out) appears to be performed **by the surveyor, off-report, or in a separate Victorian-specific sheet.** Neither pass located a Victorian conformance artifact.
- **Combined implication:** a per-point data model can represent everything both passes found — which is RG-2's conclusion. But **the artifact CIVOS receives may already be reduced**, and in Victoria it may be reduced to two numbers that no per-point model can reconstruct. This is a further argument for filing the artifact and transcribing the verdict rather than importing points.
- **No contradiction was found between the two passes.** Both read MRTS56 independently; both found the March 2022 edition on the current path; the tolerance pass read cl. 10 and the reporting pass read cl. 12 and 15.

---

## 8. Contact path — AU civil surveying firm shortlist

**Selection:** the firm's public site describes construction/engineering/conformance/as-constructed surveying (not cadastral-only, not drone-only), **and** the firm looks small enough that a founder's call reaches a practitioner. Nationals excluded by design (RPS, Cardno/Stantec, Aurecon, SMEC, Veris, Aptella, C.R. Kennedy, GHD) — their switchboards eat cold calls.

**Contact details below are public business contact information published on each firm's own website.** No personal emails or personal mobiles of named individuals are recorded, with one flagged exception (Bang On Surveying, a sole trader who publishes no generic channel — noted rather than included silently).

**Grade B throughout** — every row was verified by fetching the firm's own site. The two starred rows were **independently re-fetched by the orchestrating agent**, with quotes and contacts confirmed at the URL shown.

### Queensland

| Firm | Location | Size signal | Quote from their site | Contact | URL | Why this one |
| --- | --- | --- | --- | --- | --- | --- |
| **Orion Spatial Solutions** ★ | Brisbane / Gold Coast / Moreton Bay | Team page shows **4 named people**; three small offices | *"We have extensive experience conducting as-constructed surveys and ADAC submissions for Master Planned Land Developments and Infrastructure projects."* — and *"practical completion or 'on maintenance' approvals cannot be gained unless the ADAC submission is approved by the Local Council."* | admin@orionss.com.au · 07 3902 8160 (Bris) · 07 5619 5190 (GC) · 07 3902 8161 (MB) | `https://orionss.com.au/engineering-surveys/` | Best conformance copy found anywhere in the search. They articulate the commercial consequence of a bad pack unprompted, on their own site. Local to Jay. |
| **BJNorth Surveys** | Northgate, Brisbane | Team page lists **5 people**; single office | *"As-Construct Surveys (including ADAC compliance)"* · *"Construction Surveys for all Civil and Mining projects including Machine Guidance control"* · *"Compliance Surveys / Audit Surveys"* | enquiries@bjnorthsurveys.com.au · 07 3102 0860 | `https://bjnorthsurveys.com.au/engineering-and-construction-surveys/` | Holds an SBQ **Engineering endorsement** (verified on the statutory register). Five people means the MD answers. Brisbane Airport parallel runway on their project list — real civil scale. 20 min from Jay. |
| **CDAM Survey** | Woodford (Moreton Bay hinterland) | Single-page site, PO Box only, no staff page — reads as owner-operator | Named service line: *"As Constructed and Conformance (ADAC)"*; also *"Final Trim Earthworks"*, *"Machine Control & Guidance"* | survey@cdam.com.au · **no phone published** — email/contact form only | `https://www.cdam.com.au/` | Pure machine-control/civil-earthworks shop, no cadastral distraction. Closest on this list to a working field surveyor doing conformance daily. |
| **Atkinson Surveys** | Kirwan, Townsville | Team page lists **9 people** | *"Construction Surveys"*, *"Engineering & Builders Set-out Surveys"* (service-list items, not prose) | info@atkinsonsurveys.com.au · 07 4723 4885 | `https://www.atkinsonsurveys.com.au/` | SBQ Engineering-endorsed; director is himself the endorsed engineering surveyor. Regional North QLD contrast. **Weaker evidence than the three above — a service list, not a conformance description.** |
| **East Coast Surveys (Aust)** | Capalaba, Brisbane | Team page lists **8 people**; single office | *"We can provide accurate positioning from design information, from which a builder or contractor can construct your project."* | 07 3823 1029 · **no email published** — contact form only | `https://www.eastcoastsurveys.com.au/services` | SBQ Engineering-endorsed, 8 staff. **Honest caveat: their public copy is set-out, not conformance** — the endorsement is the evidence, not the marketing. |
| **Brazier Motti** | Townsville / Cairns / Ayr | 3 North QLD offices, *"For over 70-years"* — **no head-count published, size risk** | *"Engineering Construction Survey — Supporting construction projects with precise layout and measurement services"* | townsville@braziermotti.com.au · 07 4772 1144 · cairns@braziermotti.com.au · 07 4054 0400 | `https://www.braziermotti.com.au/surveying` | SBQ Engineering-endorsed, regional roads/tunnels/bridges. Per-office generic emails make contact clean. **Highest size risk of the six — may exceed 30 staff.** |

### New South Wales

| Firm | Location | Size signal | Quote from their site | Contact | URL | Why this one |
| --- | --- | --- | --- | --- | --- | --- |
| **de Witt Consulting** | Charlestown (Newcastle), Gosford, Gulgong, Gloucester | 4 small regional offices — **no head-count published, could be 30–50** | *"Set out and conformance of stormwater drainage, underground services, earthworks"* · *"Bridge modelling, setout and conformance"* · *"Conformance surveys"* · *"Work-as-executed surveys"* | 02 4942 5441 (Newcastle) · 02 4314 6249 (Central Coast) · 02 6374 2911 · 02 6558 3082. **Email obfuscated on page, not extractable** | `https://dewittconsulting.com.au/surveying/civil-surveyor/` | Sells *conformance* as a named line item for three separate work types, and separately lists WAE — i.e. they distinguish the two artifacts §4.3 describes. |
| **Rivland Surveyors** | Wagga Wagga (also Albury) | Est. 2004, one named director, two regional offices | *"Work As Executed Survey (WAE) or As-Built Surveys are usually required by council once construction work is completed"* — comparing *"the constructed positions and levels with the design plan"*, and they *"must be signed by a Registered Land Surveyor."* | admin@rivland.com.au · 02 6971 8811 | `https://rivland.com.au/services/engineering-construction-surveys/` | The signed-deliverable framing is exactly the §5.2 question. Riverina civil — roads, sewer, water. Owner-operated. |
| **Conolly Surveying** | Chatswood West, Sydney | *"the feel of a family business"*; *"One person to see your project from inception to completion"* | *"Survey plans documenting the level and position of constructed structures compared to design plans"* | 1300 339 607 · **no email** — contact form only | `https://conollysurveying.com.au/construction-survey/` | Their as-built deliverable *is* a design-vs-constructed comparison document. Their one-person-end-to-end model means whoever answers also writes the report. |
| **MCS Surveyors** | Sydney (no street address published) | *"over 30 years' combined experience"* — implies a handful | *"Final survey plans documenting the completed infrastructure for council or client submission"* | info@mcsurveyors.com.au · 0422 398 044 (**published as the business number; no landline on site**) | `https://www.mcsurveyors.com.au/services/roadworks-surveys` | Aimed at civil contractors + local authorities. **Weakest quote of the four** — service fragments, not a conformance description. |

### Victoria

| Firm | Location | Size signal | Quote from their site | Contact | URL | Why this one |
| --- | --- | --- | --- | --- | --- | --- |
| **5D Surveying** ★ | East Bendigo (serves Bendigo, Echuca, Shepparton) | About page names exactly **3 people**; single office | *"A conformance report confirms that constructed works, such as pavement layers or fill, meet the design tolerances and specifications."* Also lists *"Pavement conformance"* as a service | quotes@5dsurveying.com.au · 1300 470 700 | `https://www.5dsurveyingvic.com.au/engineering-surveying.php` | **The only firm found that sells a "conformance report" as a named product with explicit design-tolerance language.** Three principals — the call reaches the person who writes it. |
| **Bang On Surveying** | Somerville (Mornington Peninsula) | One named principal, one number, one email, no staff page — sole operator. *"24 years experience in civil construction and engineering surveying"* | *"As Built vs Design plan or heat-map showing differences between as built and design."* | **Caveat: the only published channels are a named personal email and mobile.** No generic info@ or landline. Contact details deliberately not reproduced here — they are on the site | `https://www.bangonsurveying.com.au/` | He already produces a **design-vs-as-built heat map** — the exact artifact MRTS56 cl. 12 blesses. Will have strong opinions on report format. |
| **Smith Land Consulting** | South Geelong; also Melbourne, Torquay, Warrnambool | Founded 2010, director-led, 3 named leaders, 4 offices. **Caveat: acquired Surfcoast Survey & Drafting in 2025 — growing** | *"As-Built Surveys verify that construction matches approved plans, helping to identify discrepancies and ensure compliance before project handover."* | survey@smithls.com.au · quotes@smithls.com.au · 03 5222 1234 | `https://www.smithlandconsulting.com.au/our-services/construction-engineering` | Frames as-built as *"identify discrepancies… before project handover"* — the conformance-pack-at-handover problem in their own words. |
| **Base Surveys** | Melbourne (no street address published) | Director named, *"over 20 years"*, member of Consulting Surveyors Victoria, single mobile + admin@ — owner-operated | *"We carry out detailed as-built surveys to verify that constructed elements match design requirements"* · *"reducing errors, preventing costly rework, and maintaining alignment between design and construction"* | admin@basesurveys.com · 0402 857 150 (**published as the business number; no landline**) | `https://basesurveys.com.au/construction-surveying-melbourne/` | Owner-operator whose pitch is literally *"preventing costly rework"* via design-vs-as-built alignment. |

**Weighting: QLD 6 / NSW 4 / VIC 4.** ★ = independently re-fetched and confirmed by the orchestrating agent.

### Top 3 for a first call

1. **Orion Spatial Solutions** (Brisbane, admin@orionss.com.au, 07 3902 8160). No one else writes about the problem this precisely. They state on their own site that practical completion is gated on council approving the ADAC submission — the commercial consequence of a bad conformance pack, unprompted, in their words. Four-person team, generic admin@ inbox, local. Opening line: *"Your site says PC is gated on ADAC approval — how much gets bounced back, and what does the conformance report you hand the contractor actually look like?"*
2. **BJNorth Surveys** (Northgate Brisbane, enquiries@bjnorthsurveys.com.au, 07 3102 0860). Five people, SBQ Engineering endorsement verified on the statutory register, a dedicated survey manager for civil engineering, and airport-runway-scale conformance experience. Small enough that the MD answers, senior enough to have opinions. 20 minutes from Jay — a coffee beats a call.
3. **5D Surveying** (East Bendigo VIC, quotes@5dsurveying.com.au, 1300 470 700). The only firm selling a conformance report as a named product with design-tolerance framing. Three principals. Regional VIC gives the contrast that matters most: **it tests whether the Victorian statistical reduction (§7) is real in practice, and whether the SEQ ADAC-shaped problem is a Queensland artefact.**

**What to ask, given §1–§5.** Ask for a real (redacted) deliverable — three of them closes the "one real sample" gap in §9 and is worth more than another research pass. Ask whether they emit x̄ and S in Victoria. Ask whether they've ever been asked to upload into a contractor's system, or whether it's always email.

### Community channels — **and a correction to the brief's premise**

**SSSI no longer exists.** SSSI merged with SIBA|GITA in March 2023 into the **Geospatial Council of Australia**; GCA was placed into **voluntary administration on 26 May 2025** (~2,300 members — verified from the administrators' media release, `https://www.rsm.global/australia/news/media-release-voluntary-administrators-appointed-geospatial-council-australia`) and into **liquidation on 21 August 2025**. `sssi.org.au` no longer resolves. **There are no SSSI QLD/NSW/VIC branches to attend.** Two bodies are splitting the vacuum.

| Channel | What it is | Access | Grade |
| --- | --- | --- | --- |
| **Surveyors Australia — Gold Coast Seminar** | Full-day QLD technical seminar, **Mon 24 Aug 2026**, Novotel Surfers Paradise. Agenda includes *TMR Standards Update*, *Connected Workflows*, *Scanning data flow to increase productivity* | *"Who Can Register? **Anyone.**"* Members $250 / **non-members $350**. `https://www.surveyorsaustralia.org.au/eventdetails/40601/gold-coast-seminar` | B |
| **Surveyors Board of Queensland registrant register** | Statutory QLD register, **filterable by registration type including "Engineering"**, and by postcode + radius | Public, no login. `https://sbq.com.au/find-a-surveyor/` — 403s to automated fetchers, 200 in a normal browser. **This is how four of the six QLD firms above were found** | B |
| **Surveyors Australia — National Register of Certified Engineering Surveyors** | Public table of CES credential holders: surname, first name, state, cert number (~200+) | Publicly browsable, no login. Names only — pair with LinkedIn. `https://www.surveyorsaustralia.org.au/get-certified/national-register-of-certified-engineering-surveyors/` | B |
| **Locus Alliance** | New national body for *individual* practitioners, formed mid-2025, seed-funded by Institution of Surveyors NSW. Public webinars via Humanitix | Members free, **non-members $75 + GST**. Runs an Early Careers Network Mentoring Program — the de-facto YP arm. `https://locusalliance.org.au/` | B |
| **Young Surveyors Network (YSN) Australia** | Launched **8 July 2026** — three weeks old. Run by Surveyors Australia, plugged into FIG's global YSN. Six online meet-ups/year plus capital-city gatherings | Register interest: ceo@surveyorsaus.org.au. Membership requirement **unverified**. Brand new and unformed — **highest leverage per unit of effort on this list** | B |
| **APAS** (Association of Public Authority Surveyors) | NSW/ACT public-authority surveyors — i.e. the people *receiving* conformance reports. **The other side of the transaction** | **APAS2027, 15 March 2027, Crowne Plaza Terrigal.** Conference explicitly *"open to both members and non-members."* Pricing not published — email them. `https://www.apas.org.au/events.html` | B |
| **Consulting Surveyors NSW** | 220+ NSW surveying firms, "Find a Surveyor" directory. Events: Practice Managers Forum 21 Aug, Point Cloud upskilling 1 Sep 2026 | Directory login requirement and non-member pricing both **unverified**. `https://www.acsnsw.com.au/` | B org / D access |
| **Consulting Surveyors Victoria** | Victorian private-sector body, four seminars/year | Find-a-Surveyor searches by name or postcode, no login. `https://www.acsv.com.au/` | B |
| **Locate26** | Flagship ANZ geospatial conference, **24–26 Nov 2026, MCEC Melbourne**, 1,000+ expected | **Organiser UNVERIFIED and this matters** — Locate was a GCA asset and GCA is liquidated. Canonical URL fails DNS. **Confirm who runs it before booking anything.** | C |

**Verified negatives — don't spend time here:**
- **LinkedIn groups: zero verified.** Every search returned company *pages*, not groups; direct `/groups/` probes hit a login wall. **No group is named because none could be confirmed.** Follow the Locus Alliance and Surveyors Australia company pages instead.
- **Reddit: unverifiable from this environment** — WebFetch is blocked for reddit.com at the tool level and WebSearch refuses the domain. No evidence found of an AU-specific surveying subreddit, but that absence is weak given the tooling block. Check r/Surveying manually in a browser.
- **Land Surveyors United — dead.** Their Australia hub shows 56 members and most recent dated comment 2011–2012.
- **Facebook groups** — *The Field Crew*, *SURVEY EQUIPMENT FOR SALE* surfaced but none confirmed AU-specific or construction-focused. Grade D.

**One thing to carry into every conversation:** this profession just lost its national body to liquidation, watched its skills-assessment pathway break, and is being courted by two competing replacement organisations. **Expect institutional fatigue. Lead with the workflow problem, not the platform.**

### Firms dropped, and why

Too big, verified on their own sites: CMS Surveyors (*"80+ strong team"*), **Masters Surveying** (Chermside QLD — painful drop, their service list literally says *"As-constructed and ADAC Surveys"*, but *"over 40 people"*), Aspect Development & Survey (40+), Spiire, Landair, HR Surveyors. **Swanson Surveying** (Geelong/Ballarat/Melbourne, *"over 30 employees"*) is just over the line with excellent copy (*"turbine base set out and conformance"*) — **reinstate this one first if a 15th is wanted.** **Leigh Surveyors** (Ashgrove, Brisbane) is verified real and a single practitioner, but publishes only a named personal email and mobile — held as a QLD reserve rather than listed. **J A Liddle Pty Ltd** (Ferny Hills QLD) appeared on the SBQ engineering-endorsed list but **no website could be located — unverified, not included.**

---

## 9. What this pass could NOT establish — the honest list

1. **No real-world sample conformance report was obtained.** Everything in §2–§3 about what the artifact physically looks like is inferred from tool documentation and authority *example* tables. **This is the single biggest remaining gap, and it is the one the firm shortlist exists to close** — three redacted real deliverables would be worth more than another research pass. RG-1's own unblock condition named exactly this.
2. **The Aconex/Teambinder/InEight channel question is unresolved** (§4.1). No primary or grade-C source captured naming a document-control platform as the survey-conformance channel, and zero evidence of a surveyor uploading directly into a contractor QA system. Genuine white space, unproven either way. Next searches to run: state tender attachments (`filetype:pdf "survey" "conformance" "Aconex"`), and actual Seek/Indeed job-ad *bodies* — the search API returned only category listing pages, never individual ad text.
3. **`help.tbcanz.com` "Pavement Conformance Report"** — 403. Likely Trimble's ANZ answer to 12d's conformance module, directly relevant. **Needs re-location.**
4. **Trimble Business Center desktop** report/export formats — everything verified is Trimble Access (field software). TBC claims are unverified.
5. **Topcon / Carlson / MAGNET** — barely covered (§2.4).
6. **The 12d conformance report's file extension** — every source says "report file" and "opens in Notepad"; whether it defaults to `.txt`, `.rpt` or no extension is un-captured. The 12d Model Reference Manual would settle it.
7. **No Victorian conformance artifact was located** (§7). Whether the Section 204 statistical reduction appears on a report, in a separate sheet, or only in the surveyor's spreadsheet is unknown. **Ask 5D Surveying.**
8. **Council ADAC mandate list is short by necessity** — only Gold Coast, Sunshine Coast and Unitywater verified from primary text. Logan, Moreton Bay, Rockhampton, Whitsunday, Mackay and Brisbane City Council all returned 403/WAF to both WebFetch and curl-with-browser-UA. Title-level evidence only.
9. **SBQ certification-enforcement articles** (§5.2) rest on search snippets only — both pages 403'd. Consistent across two separate SBQ articles, but not fetched evidence.
10. **TfNSW G71 portal status page un-captured.** Ed 2/Rev 4 currency rests on the absence of a watermark in the PDF text layer, not on a portal listing. A guessed search URL 404'd and no alternative was fabricated.
11. **No firm publishes a staff count.** Every size signal in §8 is inferred from named-principal counts, team-page headcounts, single-office footprints or self-description; the basis is stated per row. **de Witt Consulting and Brazier Motti carry the most size risk.**
12. **QLD firm discovery ran off the SBQ statutory register rather than open search** (WebSearch hit its 200-call session cap partway through). That filters on the actual Engineering endorsement — arguably better targeting — but **systematically misses construction-survey firms operating without an SBQ engineering endorsement, which is most of them.** Gold Coast, Sunshine Coast, Toowoomba and Cairns are under-represented. A second pass with search budget would widen the QLD half materially.
13. **RG-3 was not addressed** and remains fully open — whether a head contractor holds a machine-readable design surface, and in what datum. It independently blocks C5.5.

---

## 10. Source index for load-bearing claims

| # | Claim | Grade | Source |
| --- | --- | --- | --- |
| 1 | G71 cl. 5.6.5: Survey Report **per Lot or component**; actual vs specified position (grid **or** chainage+offset) and level, plus applicable tolerance | **A** ✔re-verified | `https://standards.transport.nsw.gov.au/_entity/annotation/a61076d5-af35-ed11-9db2-000d3ae019e0` |
| 2 | G71 cl. 5.6.5: report *"must be certified by the Surveyor"* and *"highlight any results that are outside of tolerance (nonconformities)"* | **A** ✔re-verified | same |
| 3 | **G71 cl. 5.6.6 HOLD POINT — Process Held: "Covering up of work subject to a conformity verification survey"; Submission: "Survey Report verifying conformity"** | **A** ✔re-verified | same |
| 4 | G71 cl. 5.6.3: bound pavement/concrete conformity survey *"not later than one working day after the pavement Lot has become accessible for survey"* | **A** ✔re-verified | same |
| 5 | G71 cl. 2.2.1: Surveyor = min. **Diploma in Surveying + 2 years**; registration only where the spec names a Registered Land Surveyor | **A** ✔re-verified | same |
| 6 | G71 cl. 2.6.5: Surveyor name, date, signature on reports + field book page references; cl. 2.6.4 cross-index to equipment and Lot identification | **A** | same |
| 7 | G71 cl. 2.6.6: paper copies of electronic survey data *"when requested by the Principal"* — retained, not routinely submitted | **A** | same |
| 8 | G71 names **no file format** for the conformity report; MX GENIO pick-list (Annexure G71/A) applies to CADD/WAE model only | **A** | same |
| 9 | G71 cl. 5.8 splits WAE Drawings (per G2) from WAE Model (per G73, Pay Item G71P3), both distinct from cl. 5.6 | **A** ✔re-verified | same |
| 10 | **MRTS56 cl. 12: "There are no prescribed methods of how conformance results should be represented"** (2 occurrences) | **A** ✔re-verified | `https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/1-Overarching-Specifications/MRTS56.pdf?la=en` |
| 11 | MRTS56 Table 12.2.1 columns (Design/AsCon Ch, O/S, height, crossfall, subgrade height, pavement thickness) + In/Out of tolerance legend | **A** ✔re-verified | same |
| 12 | MRTS56 cl. 12.2: results *"generally only required at 20 m intervals"*, 10 m may be more practical; cl. 12.2.1 minimum = location, height, crossfall, thickness | **A** ✔re-verified | same |
| 13 | MRTS56 cl. 12 permits **scan-derived heat maps**; cl. 12.2.1 permits graphical representations for intersections/roundabouts | **A** ✔re-verified | same |
| 14 | MRTS56 cl. 15: monthly submission, **emailed** to a named TMR inbox, **12D archive** format, *"Large email attachments can be sent via a file hosting service (such as OneDrive)"*, + signed Surveyor Certification | **A** ✔re-verified | same |
| 15 | **MRTS56 HP/WP gates exclude delivery of the As Constructed Survey information** — *"(excludes delivery of As Constructed Survey information)"*, **6 occurrences** | **A** ✔re-verified | same |
| 16 | MRTS56 cl. 10.9: pile report certified *"by the Surveyor **or** Registered Professional Engineer of Queensland"* | A | same |
| 17 | MRWA: compliance testing presented as *"a tabulated spreadsheet"* with E, N, Ch, offset, as-con + design elevation, difference and **compliance status per sample point** | **A** | `https://www.mainroads.wa.gov.au/technical-commercial/technical-library/surveying-and-geospatial-services/engineering-surveys-guidelines/construction-surveying-guideline/` |
| 18 | MRTS50 cl. 10.1.1: per-lot Conformance Report, components (a)–(d), **(d) As Constructed surveys per MRTS56**; cl. 7.1(c) lots exist for submission under cover of it; cl. 7.2(c) lot register records 3D surveyed position | A | `https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/1-Overarching-Specifications/MRTS50.pdf?la=en` |
| 19 | MRTS50 cl. 8.2(g): ITP must include all Witness and Hold Points; cl. 10.1.2 Indicative Conformance covers six named test types and **survey is not among them** | A | same |
| 20 | City of Melbourne: *"Each lot or groups of lots … subject to assessment for compilation onto as-built records"*; conformance reports before any Progress Claim; covering up first is a Hold Point | A | `https://www.melbourne.vic.gov.au/sites/default/files/SiteCollectionDocuments/technical-specification-civil-works.pdf` |
| 21 | 12d `Survey => Conformance => Pavement Report` / `Batter slope report`; compares surveyed points to design strings/TIN; output is a paginated text file opened in Notepad with header + surveyor footer; tolerances in a `.tol` file | B | `https://www.exds.com.au/html_content/EXDS_PDF_Information/Survey/Pavement_Conformance.pdf` |
| 22 | 12d conformance report keyed on chainage + offset from a control string; **E/N added as an option in V12** after a client demanded both | B/C | above + `https://forums.12dmodel.com/viewtopic.php?t=9707` |
| 23 | 12d Field exports include MS Excel, TXT, 12DA, LandXML, DXF, DWG | B | `https://12d.co/12d-field/features/` |
| 24 | Trimble Access reports = XSLT stylesheets (`.sss`) over a JobXML-format file; outputs HTML, PDF, CSV, Word XML | B | `https://help.fieldsystems.trimble.com/trimble-access/latest/en/pdfs/access-custom-stakeout-reports.pdf` |
| 25 | **Trimble Surface inspection report is PDF-only**, containing parameters, screen captures and inspection points | B | `https://help.fieldsystems.trimble.com/trimble-access/latest/en/cogo-surface-inspection.htm` |
| 26 | Trimble as-staked deltas: ΔN/ΔE/ΔElev (or hDist/vDist/azimuth), cut/fill, station+offset, tolerance flag recorded in the report | B | `https://help.fieldsystems.trimble.com/trimble-access/latest/en/stakeout-as-staked-point-details.htm` |
| 27 | Leica: raw → HEXML → stylesheet → CSV/PDF/HTML/FLD/TXT; NZ pack includes an *"FLD – Exports to 12D"* stylesheet | C | `https://globalsurvey.co.nz/surveying-gis-news/how-to-use-stylesheets-with-leica-captivate-leica-infinity-file-export-formats/` |
| 28 | LandXML carries CgPoints, Surfaces (TIN), Alignments, Parcels, PipeNetworks — **no conformance-result concept** | B | LandXML 1.2 schema (content from search; XSD not directly fetched) |
| 29 | PENZD vs PNEZD differ only in E/N column order; both in common use; no header convention | C | multiple independent secondary sources converge |
| 30 | QLD `Surveyors Act 2003` s75 offence is cadastral-only; sch 3 defines cadastral survey as boundary identification | A | `https://www.legislation.qld.gov.au/view/whole/html/inforce/current/act-2003-070` |
| 31 | SBQ: *"An engineering surveyor is not required by legislation to be registered with the Surveyors Board of Queensland"* | B | `https://sbq.com.au/registration/when-is-registration-required/` |
| 32 | NSW `SSI Act 2002` s21 limited to *"a land survey for fee or reward"*; s3 defines it by boundaries/interests in land | A | `https://legislation.nsw.gov.au/view/whole/html/inforce/current/act-2002-083` |
| 33 | VIC `Surveying Act 2004` s37(1): only a licensed surveyor may certify accuracy of / sign a **cadastral** survey plan | A | `https://content.legislation.vic.gov.au/sites/default/files/2020-04/04-47aa015%20authorised.pdf` |
| 34 | TMR Surveying Standards Pt1 §2.4.3: Surveyor may *"elect instead to supervise another person/s"*; §2.4.3.1 complaint attaches to the supervisor | A | `https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/surveying/surveying-standards/surveying_standards_part1.pdf` |
| 35 | Gold Coast mandates ADAC XML, *"endorsed by a Licensed Surveyor"* | A | `https://www.goldcoast.qld.gov.au/gcplanningscheme_policies/attachments/policies/policy11/section_10_as_constructed_requirements.pdf` |
| 36 | Unitywater: ADAC XML accompanies **RPEQ-signed** As Constructed drawings; ADAC v6.0; XSD-validated; `Surveyor.Name` / `Engineer.Name` carry registration numbers | A | `https://www.unitywater.com/-/media/unitywater/pdf-accreditation-certification-documents/adac-xml-data-capture-guidelines-version-3-2.pdf` |
| 37 | Sunshine Coast requires ADAC XML before assets accepted on maintenance; v5.02/v6.00 until 1 Sep 2026 then v6.00 only | A | `https://www.sunshinecoast.qld.gov.au/development/development-tools-and-guidelines/infrastructure-guidelines-and-standards/as-constructed-data-standards-and-guidelines` |
| 38 | Shellharbour WAE: DWG + PDF marked-up plans, ADAC XML, signed Registered Surveyor certification on **every page** | A | `https://www.shellharbour.nsw.gov.au/plan-and-build/planning-controls-and-guidelines/work-executed-guidelines` |
| 39 | Real lot conformance report = page 1 document manifest (Applicable/Attached Yes-No) + page 2 declaration *"Conforming / Nonconforming / Conformance Guaranteed"* | C | `https://www.trainingrpq.com.au/uploads/1/1/5/3/115329109/f_8.1.2.2_1p_-_1c_conformance_report_-_spray_sealing.pdf` |
| 40 | CivilPro: lot statuses Conformed/Guaranteed/Rejected; Lot Register generates Conformance Report / Declaration / Lot Summary; handover = single indexed PDF to Teambinder/InEight; Survey Request register with lot link and tolerance fields; **"as-constructed" appears nowhere** | B\* | `civilpro.zendesk.com` articles via `r.jina.ai` proxy (direct = 403) |
| 41 | Dashpivot: *"Linking to forms that already exist isn't supported yet"* — create-only form linking | B | `https://help.sitemate.com/en/articles/15371843-how-to-set-up-form-linking-in-your-templates` |
| 42 | GCA (successor to SSSI) entered voluntary administration 26 May 2025, liquidation 21 Aug 2025; `sssi.org.au` no longer resolves | B | `https://www.rsm.global/australia/news/media-release-voluntary-administrators-appointed-geospatial-council-australia` |
| 43 | Surveyors Australia Gold Coast Seminar 24 Aug 2026 — *"Who Can Register? Anyone."* Non-members $350 | B | `https://www.surveyorsaustralia.org.au/eventdetails/40601/gold-coast-seminar` |
| 44 | Orion Spatial Solutions conformance/ADAC copy and contacts | B ✔re-fetched | `https://orionss.com.au/engineering-surveys/` |
| 45 | 5D Surveying *"A conformance report confirms that constructed works … meet the design tolerances and specifications"* and contacts | B ✔re-fetched | `https://www.5dsurveyingvic.com.au/engineering-surveying.php` |

✔re-verified = independently confirmed by the orchestrating agent against the extracted PDF text or by re-fetching the page, not accepted from a subagent summary.
