# D.0 — ADAC / as-constructed handover confirmation pass

**Date:** 28 July 2026 · **Pass type:** primary-source research, no code · **Gate:** `docs/plans/wave-d-handover-spec-2026-07-28.md` §3.4 (ten questions Q1–Q10), spec merged #1655.

**Provenance note.** The two load-bearing findings (Q1, Q2) were re-verified by the author directly, not accepted from a delegated researcher: the ADAC v6.00 XSD package was downloaded and grepped locally, and Logan City Council's Planning Scheme Policy 5 was downloaded, text-extracted and read. Claims sourced only from delegated fetches are marked **[del]**. Grades are never upgraded to make a decision possible.

---

## VERDICT

**D2 does not survive as scoped. We land in §3.3 outcome (c), and it is over-determined — two independent kills, either one sufficient.**

**Kill 1 — the contractor is not on the arrow (Q1).** On a Queensland developer Operational Works job, the duty to submit as-constructed information sits with *"the person who has the benefit of the development approval"* — the developer — and the operational interface with council is the **consulting engineer (RPEQ)**, with a Registered Surveyor certifying position and level. Across 14 councils, **no document names the civil head contractor as producer, holder or submitter of the ADAC XML.** Two councils state in near-identical words that officers will not deal with contractors at all. In Logan's entire 6,331-line infrastructure policy the word "contractor" appears 11 times, and **not once** within reach of *submit*, *as-constructed*, *certify* or *maintenance* — it appears at the pre-start meeting and the WHS principal-contractor notice, then disappears.

**Kill 2 — the file cannot carry our differentiator anyway (Q2).** The ADAC v6.00 schema has **1,006 unique element and attribute names and not one of them carries quality evidence.** Zero occurrences of `certificat`, `conform`, `evidence`, `warrant`, `defect`, `CCTV`, `NCR`, `hold point`, `witness`, `audit` anywhere in 951 KB of XSD. `Lot` is cadastral (survey-plan lot), not a construction lot. `DataQuality` is AS5488 positional confidence, not QA. The only carriers that exist are `SupportingFile` — a bare 254-character filename string with no type, no role, no hash, no URI — and `Notes`, 254 characters of free text.

So program clause 87 ("link assets to lots, ITP evidence, tests, NCRs, CCTV, approvals — this is the differentiator") **cannot be an exported claim**. Even in the counterfactual where a contractor did submit ADAC, the linkage would vanish at the schema boundary. It is a CIVOS-internal claim, and the spec must say so out loud.

**Recommendation: delete the XML-writer limb of D2 entirely. Do not build import → link → validate → export → council acceptance.** D2 collapses into D1, exactly as §3.3 predicted, and the folio is the product.

**But the pass returns something better than a deletion.** Logan PSP5 §5.6.5 is a published, mandatory, council-enforced list of exactly what must accompany the ADAC file — and read against CIVOS's shipped feature set it is close to a specification of the product we already have:

> an inspection and testing certificate; test results across 18 named categories (fill and trench compaction, sub-grade CBR and compaction, CBR 15 quality and compaction, sub-soil drain filter grading, bedding grading, base and sub-base course quality and compaction, prime/primer seal rates, AC core tests, concrete testing, sewer and water main pressure tests, water quality); **details of the retesting or rectification carried out where any test result fails**; CCTV video for stormwater; **date-stamped photographs of work that will not be visible after construction, taken prior to backfilling, with a chainage or exact location reference in the filename**; an asset list in editable spreadsheet format; and vendor O&M manuals.

That is the evidence pack, it is grade A, it is enforceable, it gates on-maintenance approval, and on-maintenance in turn gates plan sealing. It names CIVOS's failed-test rectification trail, its CCTV custody, and its chainage-tagged pre-backfill photo pins — features already shipped. **This is what D1's folio should be compiled against, and it is the requirement list §4.5 said did not exist yet.**

The one honesty check that must not be skipped: Logan assigns the *signature* on that pack to **the consultant**, not the contractor (§5.6.5(1)(a), *"an inspection and testing certificate signed by the consultant"*). The contractor produces the underlying evidence; the RPEQ certifies and lodges it. So the defensible product claim is **"produce a clean, certifiable evidence bundle your engineer can lodge"** — never "submit ADAC to council".

**Secondary verdicts:** D1d is **unblocked at Scope A** (CCTV is a file set, not a structured record) — a trivial rider on D1c. D3 has **no basis and should be closed**: TfNSW DE Part 2 is opt-in per contract, scoped to IP Major Works, and contains zero conformance-record requirements across 143 pages. Jay decision **J5 is void as framed** — A-SPEC is neither NSW nor a standards-body standard, so the "ADAC-QLD vs A-SPEC-NSW" fork is wrong on both arms.

---

## The ten answers

### Q1 — Who produces, holds and submits the ADAC file on a QLD Operational Works job? **Answer: (c), with a correction. Confidence HIGH.**

The contractor never holds the XML. But the pivot party is not the surveyor as §3.3(a) supposed — it is the **consulting engineer (RPEQ)**, with the developer legally responsible and the surveyor certifying position.

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| Duty holder is the developer, not the contractor | Logan PSP5 §5.6.1(1), 2019 Amendment — **read by author** | **A** | "The person who has the benefit of the development approval must, prior to the on-maintenance approval, submit" |
| ADAC XML is one line item in that bundle | Logan PSP5 §5.6.4(1)(b)(iii) — read by author | **A** | "XML format compliant with the current version of the ADAC schema" |
| Drawings certified by RPEQ | Logan PSP5 §5.6.2(1)(b) — read by author | **A** | "certified and signed as 'As Constructed' by a Registered Professional Engineer of Queensland (RPEQ)" |
| Even the testing certificate is signed by the consultant, not the builder | Logan PSP5 §5.6.5(1)(a) — read by author | **A** | "an inspection and testing certificate signed by the consultant" |
| "contractor" appears 11 times in 6,331 lines, never near submit/as-constructed/certify/maintenance | Logan PSP5, full-text grep — **verified by author** | **A** | (negative result, verified by grep) |
| Council corresponds only with the consulting engineer **[del]** | Logan As-constructed Submission Kit, 28 Feb 2025 | **A** | "Council will email the relevant consulting engineer advising of the approval or non-approval" |
| Dual sign-off block: RPEQ + Registered Surveyor, no contractor signature **[del]** | Logan Submission Kit §8 | **A** | "Consulting Engineer's Certification … RPEQ No. / Registered Surveyor's Certification … Reg. No." |
| Moreton Bay: submitter is the developer's representative **[del]** | MBCC PSP Operational works inspection v7 §4.1 | **A** | "the developer's representative must submit and have approved … final accepted ADAC compliant asset data files" |
| Moreton Bay excludes contractors from the interface **[del]** | same, §5 | **A** | "Council's officer will not deal directly with Contractors." |
| Ipswich excludes contractors, in near-identical words **[del]** | Ipswich City Plan 2025 SC6.2 PSP Part 9, Note 9.2.4A | **A** | "Local Government officers will not deal directly with Contractors." |
| Ipswich: supplied by the supervising consultant **[del]** | same, §9.2.3 | **A** | "required to be supplied by the Consultant engaged to supervise the works" |
| Gold Coast: consultant certifies, licensed surveyor endorses **[del]** | GCCC Policy 11 §10.2–10.3, amended June 2013 | **A** | "be endorsed by a Licensed Surveyor with an appropriate QA Standard" |
| Mackay: supervising RPEQ owns submission **[del]** | Mackay D20 GUI-72.001 v1.001, 20/03/2025 | **A** | "The supervising RPEQ Engineer shall be responsible for the completion of As-Constructed drawings – submission" |
| Toowoomba: RPEQ forwards it **[del]** | TRC Sched 6 PSP No. 2 v27.0, 25 Feb 2022 | **A** | "the RPEQ must forward to the Council a letter … must include … 'as constructed' information" |
| Redland: consulting engineer is the named submitter **[del]** | Redland PSP2 §6.4.2(3)(b), City Plan v14 | **A** | "the name of the consulting engineer submitting the information" |
| Unitywater: XML rides with RPEQ-signed drawings **[del]** | Unitywater ADAC XML Data Capture Guidelines v3.2, 21/04/2026 | **A** | "ADAC XML files are required to accompany RPEQ signed As Constructed civil survey drawings" |

**The one apparent counter-example, defused.** Rockhampton and Moreton Bay both carry a section addressed to contractors — but it is the **council capital-works** path, where the council is the client, running parallel to and separate from the Developers path. Contractors do submit ADAC when council is their customer. On developer OPW, they do not. A second near-miss worth naming because it is exactly the trap: Rockhampton stamps the **name of the principal contractor** onto the As Constructed stamp. The contractor is *named on* the document; the *signatories* are the RPEQ and the surveyor.

**Why (c) rather than (a).** Outcome (a) says CIVOS's linkage is internal-only with no exported artefact. That is true of the XML. But the councils demand a substantial evidence pack in the same submission, gated on the same approval — Logan §5.6.5 above, plus Gold Coast, Moreton Bay and Unitywater equivalents. The contractor demonstrably produces that evidence. It is (c): the contractor's obligation is the pack, the XML stays with the engineer and surveyor.

**The correction to (c) as the spec worded it.** The spec's (c) says the folio should be *"keyed to the surveyor's asset identifiers"*. The evidence does not support that as a requirement — no council asks for it, and the schema's `ADACId` is generated by whichever software wrote the file, so it is not a stable external key. What councils *do* publish is a stable join: `WorksApprovalID`, *"The works approval ID for the development that this information represents"* (verified in `ADAC_V600.xsd:141`), which is the OPW number — Logan's §5.6.2(2)(f) requires the same number on every drawing, e.g. `OW/254/2012`. **Key the folio to the OPW approval number, not to surveyor asset IDs.**

**NOT FOUND:** any council document naming the civil head contractor as producer, holder or submitter of the ADAC XML on a developer Operational Works job. Zero hits across 14 councils.

**NOT FOUND (re-verify before relying):** Logan's ADAC 5.01-from-1-July-2024 mandate. Logan's `/ADAC-information` page is Akamai-403 to WebFetch and to curl with a browser UA. The PSP5 edition I read is the **2019 Amendment**, which says only *"the current version of the ADAC schema"*. The appendix's grade-A claim of a 5.01 mandate with a 1 Jul 2024 date is **not re-confirmed by this pass**.

---

### Q2 — What is actually in an ADAC file, and can any field carry quality evidence? **Answer: NO FIELD EXISTS. Verified by author.**

Method: downloaded `ADAC_v600_XSD.zip` from the custodian (no authentication, no click-through), unzipped 16 XSDs totalling **951,365 bytes**, extracted all 1,006 unique `name="…"` element and attribute names, and grepped both the names and every `xs:documentation` string.

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| Root `<ADAC>` → one `<Project>`; 11 mandatory asset groups | `ADAC_V600.xsd` — read by author | **A** | "The ADAC element is the root element of an ADAC XML." |
| Asset groups: Sewerage, Transport, WaterSupply, StormWater, OpenSpace, Electrical, Communication, Cadastre, Surface, Enhancements, Supplementary | `ADAC_V600.xsd` lines 258–320 — read by author | **A** | (element list read directly) |
| Every asset inherits `ComponentInfo`: InfrastructureCode, Owner, DrawingNumber, DrawingRevision, ConstructionDate, Department, Surveyor, Engineer, Status, DataQuality, Notes, SupportingFiles | `ADACGlobalTypes.xsd` lines 44–110 — read by author | **A** | "Data container for generic asset information." |
| **`SupportingFile` is a bare filename string — no type, role, hash or URI** | `ADACGlobalTypes.xsd:105-107` — read by author | **A** | "Full path and filename of supporting information (e.g. drawing file, document file or image)." |
| `Notes` is 254 chars of free text | `ADACGlobalTypes.xsd:97-99` — read by author | **A** | "Free text notes particular to this feature." |
| **`DataQuality` is positional confidence, not QA** | `ADACGlobalTypes.xsd:92-95` — read by author | **A** | "Data Quality based on AS5488-2013. Classification of Subsurface Utility Information." |
| `WorksApprovalID` — the OPW approval number, the one stable external join | `ADAC_V600.xsd:141-144` — read by author | **A** | "The works approval ID for the development that this information represents." |
| `Lot` / `LotNo` are cadastral, not construction lots | `ADACGlobalTypes.xsd` `lot_plan_details` — read by author | **A** | "The lot number as described on the originating survey plan" |
| ~68 feature classes across the 11 groups (StormWater 11, Transport 17, OpenSpace 26, Sewerage 8, WaterSupply 9, Electrical 10, Communication 5, Cadastre 7, Surface 4, Supplementary 3) **[del]** | XSD set | **A** | "Represents a communication pit feature" |

**The killer sub-question, answered exhaustively.** Searched all 1,006 element/attribute names and all documentation strings for: `test, certific, conform, qualit, inspect, complian, attach, evidence, warrant, defect, cctv, ncr, hold.?point, audit, lot, document, support, witness, approv, sign`.

| Term | Element/attribute names | What the hits actually are |
|---|---|---|
| `certificat`, `conform`, `evidence`, `warrant`, `defect`, `CCTV`, `NCR`, `hold point`, `witness`, `audit` | **0** | — |
| `test` | 0 as a name; 1 in documentation | geotextile strength: "the geometric mean of the Drop Cone and CBR Burst test results" |
| `qualit` | `DataQuality`, `WaterQuality`, `data_quality`, `water_supply_water_quality` | AS5488 positional confidence; potable/recycled water |
| `inspect` | 0 as a name | documentation only: "Inspection Opening", "Inspection Shaft" — physical features |
| `complian` | `DDA_Compliance` | a boolean for Disability Discrimination Act accessibility |
| `lot` | `Lot`, `LotNo`, `CancelledLotPlan`, `lot_plan_details`, `Feature_Cadastre_Lot` | **cadastral survey-plan lots, not construction/test lots** |
| `sign` | `Sign`, `Signs`, `SignText`, `LidDesignation`, traffic-signal types | physical signage — not signatures |
| `support` | `SupportingFile`, `SupportingFiles` | the only file carrier; bare string |
| `approv` | `DateApproved`, `WorksApprovalID` | surveyor's final-survey approval date; OPW number |

**There is no test-certificate, ITP, checklist, inspection-record, conformance, NCR, hold-point-release, CCTV or QA-document field anywhere in ADAC v6.00, and no field carrying a document type, MIME type, checksum, URI or issuing party for a supporting file.**

Corroboration that this is deliberate rather than an oversight: councils demand the conformance evidence as **separate signed documents in the same bundle**. Rockhampton **[del]**: *"A Registered Engineer's Certificate & As Constructed Certification document for Operational Works"*. Unitywater treats CCTV as survey corroboration only **[del]**: *"such as photographs, CCTV or site records, can be used to verify intermediate points"*.

**What this means for clause 87, stated plainly:** the linkage between assets and ITP evidence, tests, NCRs, CCTV and approvals is real product value, but it is **CIVOS-internal**. It does not survive export, because there is nothing to export it into. The spec must not imply otherwise.

---

### Q3 — What is the CCTV deliverable under WSA 05? **Answer: Scope A. D1d is unblocked as a trivial rider.**

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| **Logan specifies CCTV as video files, with formats** | Logan PSP5 §5.7.1(1)(a) — **read by author** | **A** | "WINCAM (version 7 or later) or CCTV footage or DVD-ROM … or MPEG 4 for a video clip" |
| Logan requires CCTV as an as-constructed submission item | Logan PSP5 §5.6.5(1)(e) — read by author | **A** | "CCTV video for underground stormwater infrastructure work" |
| Logan specifies where the run must start and end | Logan PSP5 §5.7.1(1)(b) — read by author | **A** | "at the first drainage maintenance hole upstream and downstream of the local government infrastructure work" |
| Unitywater deliverable is a file set, RPEQ-certified **[del]** | Unitywater CCTV Review Technical Specification Rev 1, 20/05/2020 | **A** | "provided with the CCTV digital and hardcopy in accordance with the SEQ Code" |
| Unitywater: contractor commissions it; it gates on-maintenance **[del]** | same | **A** | "submitted for review and acceptance … prior to the works being approved for an On-Maintenance inspection" |
| Contractor owns the deliverable; authority receives it **[del]** | SA Water TS 0524 v2.1, 10 Feb 2021 | **A** | "The CCTV Operator engaged by either the Constructor or an SA Water Project Manager." |
| It is a construction hold point **[del]** | same, cl. 7.5 | **A** | "Practical completion can not be obtained without release of this Construction Hold Point" |
| WSA 05 *does* define an XML transfer format — but nobody mandates it by name **[del]** | WSA 05:2025 v4.2 public extract, Appendix A5 TOC | **A** | "A5 XML TRANSFER FORMAT … A5.1 Data structure" |
| Newer edition exists than the spec assumed **[del]** | same, Publication History | **A** | "redesignated as WSA 05:2020 Version 4.2 in December 2025" |
| Paywalled | WSAA shop listing **[del]** | **A** | "Discounted member price: 0.00 … Your price: 792.00" |

**Decisive framing.** WSA 05 sits at the structured end — Appendix A5 defines a per-survey, per-observation XML with `<PROJECT>`/`<SURVEYS>`/`<SURVEY>`/`<OBSERVATION>`/`<SCORES>`/`<IMAGE>`/`<VIDEO>`. But **no Australian authority was found mandating that file by name**, and the two QLD authorities that matter here ask for a file set: Logan names video container formats, Unitywater names digital plus hardcopy. Producing a conforming coded record is the specialist CCTV subcontractor's job, done in WinCan or PipeTech Auscodes. The head contractor's obligation is **custody, completeness and timely submission**.

Two authorities outside QLD (SA Water, Power & Water NT) additionally require a structured record in WinCan format — so Scope B exists in the market, but not in the jurisdiction D1 targets, and not as the contractor's authoring job.

**Build call: Scope A.** A `documentType` value, a lot association, a manifest category. Do not build a WSA-05 coding engine — that is re-implementing a specialist product.

**NOT FOUND:** the body text of WSA 05 Appendix A5 (field-level definitions) — paywalled at AUD $792; only the front matter and full TOC are public. **NOT FOUND:** any Australian authority mandating the Appendix A5 XML file by name.

---

### Q4 — How is a submission made, and what does "accepted" mean?

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| **ADAC gates on-maintenance approval** | Logan PSP5 §5.6.1(1) — read by author | **A** | "must, prior to the on-maintenance approval, submit to the local government" |
| On-maintenance gates plan sealing **[del]** | Logan PSP5 §5.4 | **A** | "before the local government approves a plan of survey: the … work is accepted on-maintenance" |
| Maintenance period 12 months (24 for pump stations) **[del]** | Logan PSP5 §5.5.1 | **A** | "must maintain the local government infrastructure work for 12 months" |
| Developer must rectify non-compliance | Logan PSP5 §5.6.1(2) — read by author | **A** | "is responsible to rectify any non-compliance unless otherwise agreed by the local government" |
| Sunshine Coast: submission precedes on-maintenance | SCC as-constructed page — **read by author** | **A** | "prior to assets being accepted on maintenance, a current version ADAC XML file … is to be submitted" |
| No portal at Logan — email plus ad-hoc file share **[del]** | Logan Submission Kit, 28 Feb 2025 | **A** | "Upload all required As-constructed documentation to the online file sharing folder, using the link provided by Council" |
| 15-business-day decision **[del]** | same | **A** | "advising of the approval or non-approval, within the relevant assessment timeframe (15 business days)" |
| Resubmission is chargeable after one free **[del]** | same, §5 | **A** | "a compliance checking fee will be incurred after one resubmission for further resubmissions" |
| Moreton Bay's blunt gating sentence **[del]** | MBCC PSP Appendix A §6.3 v7 | **A** | "As constructed information will not be accepted, or works placed 'on maintenance' until all … complies" |
| Moreton Bay 14-day re-certify clock **[del]** | same | **A** | "Material rejected by Council is to be duly revised, re-certified and re-submitted … within fourteen days" |
| Unitywater runs a conformance check on receipt **[del]** | Unitywater v3.2 | **A** | "will undertake a data format and conformance check to confirm the completeness and validity" |
| Failure delays handover **[del]** | same | **A** | "may be returned to the provider for correction and resubmission which can potentially delay … asset handover" |
| Cairns is the one real portal with machine validation **[del]** | Open Spatial ACDC manual, portal `asconstructed.com` | **B** | validator emits a CSV error report and error circles at fault coordinates |
| Bond exposure at Ipswich, Whitsunday, Redland **[del]** | Whitsunday ADAC Guidelines v3.0, 19 June 2019 | **A** | "can potentially delay the progress of asset handover, release of bonds or other related approvals" |

**"Accepted" formally means On Maintenance.** Queensland does not use a Certificate of Practical Completion here — no council tied ADAC to one. The chain is: as-constructed bundle accepted → **On Maintenance** → 12-month defects period → **Off Maintenance**. On-maintenance gates **plan sealing** (Logan §5.4, Mackay D20) and reaches **bonds** at Ipswich, Whitsunday and Redland.

**Portals are the exception.** Across 14 councils only two named systems surfaced — Cairns' `asconstructed.com` and Townsville's TOLS (which does no XML validation, because Townsville does not use ADAC). Everything else is email plus an ad-hoc file share, including Logan, our anchor council. Moreton Bay still accepts USB and CD. **Validation is usually a human officer reading a prose checklist, not a validator.**

**Certifications:** two independent signatures on the same drawing set — RPEQ for engineering, Registered/Licensed Surveyor for position and level. Form 15/16 is essentially absent from civil OPW; it is a building-work instrument.

---

### Q5 — Are the schema and a validator obtainable, and on what terms? **Schema: yes, free, ungated. Validator: there isn't an official one.**

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| **Schema downloads with no authentication** | `adac.com.au` → IPWEA-QNT → Dropbox; **downloaded by author with plain curl, 273 KB zip** | **A** | (verified by direct download) |
| Custodian is IPWEA-QNT running an ADAC Consortium **[del]** | IPWEA-QNT ADAC page | **A** | "The Consortium is managed by IPWEA-QNT and consists of three interdependent groups" |
| Custodian claims open-source status **[del]** | same | **A** | "It is open source and adopted widely by councils and utilities across Australia." |
| **No licence file or copyright notice ships with the XSD package** | XSD package contents — **verified by author** | **A** | (absence verified by full-package grep) |
| Mirror copies are marked all-rights-reserved **[del]** | IPWEAQ Knowledge Centre | **A** | "Items in the Knowledge Centre are protected by copyright, with all rights reserved" |
| Consortium membership is paid, and buys influence not access **[del]** | IPWEA-QNT ADAC page | **A** | "Consortium members are able to influence the development of the ADAC schema" |
| **Custodian distributes no validator** — refers you to vendors **[del]** | same, full page read | **A** | "we will match you with a recognised Software Vendor or an ADAC Implementation Partner" |
| Councils place the validation burden on the submitter **[del]** | SCC Guideline v6.0.0 §3 | **A** | "should be \"validated\" for compliance before being submitted to Council" |
| Validators are vendor products driven off the official XSD **[del]** | 12d.com/product/adac.html | **B** | "the 12d Model ADAC Editors and Validators are driven directly by the IPWEA ADAC XSD's" |

**"Open source" is a claim on a web page, not a licence.** There is no licence grant anywhere in the package or on the page, and mirrored copies are marked all-rights-reserved. In practice the schema is freely downloadable by anyone — I did it — so XSD validation would be *buildable*. It is simply no longer *needed*, given Q1 and Q2.

**NOT FOUND:** any published licence text (Creative Commons, MIT, custom) for the ADAC schema. **NOT FOUND:** an official IPWEA-QNT validator or its terms. A stale search-index entry titles a URL "Asset Design as Constructed Validation Tool", but that URL returns the site's HTML error page.

---

### Q6 — 12d ADAC vs LandXML export reality

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| 12d ADAC export is full-fidelity and free to maintained customers **[del]** | 12d.com/product/adac.html | **A** | "12d-ADAC is NOT an additional cost … included free of charge for all customers on annual maintenance" |
| No data loss across the schema **[del]** | 12d.com/product/12d_model_ADAC.html | **A** | "completely reflects the schema and its associated attributes and values so there is no data loss" |
| 12d reads *and* writes ADAC, and validates **[del]** | 12d.com/product/adac.html | **A** | "12d Model can write AND read ADAC XML files." |
| **LandXML is explicitly a lossy geometric subset** **[del]** | 12d.com/product/12d_model_Input_Output.html | **A** | "LandXML is a developing standard for transferring **some** geometric data between software packages" |
| …and 12d hedges on it **[del]** | same | **A** | "12d Model endeavours to support this evolving standard." |
| **DXF/DWG export carries geometry, not assets** **[del]** | same | **A** | "The DWG/DXF output module write out plots, three dimensional data and triangles in DWG/DXF format." |
| `.12da` carries full asset attributes (pit type, pipe diameter, us/ds levels) **[del]** | 12d A File Format v11, Aug 2015 | **A** | "pipe { name … type … diameter … us_level … ds_level }" |
| `.12da` is the correct 12d-to-12d hand-off **[del]** | EXDS (12d training partner) | **B** | "exporting the survey information in anything other than a 12da Ascii file will result in the loss" |
| Attributes reach DWG only via a fragile flattening **[del]** | 12D Wiki, 20 Nov 2021 | **B** | "Attributes need to be top level vertex attributes … so flat list of attributes only" |
| Logan requires both DWG and XML | Logan PSP5 §5.8(5)(a) — read by author | **A** | "must be provided electronically in .dwg and .xml formats according to the latest version of the ADAC schema" |

**Program clause 86's four formats are partly optimism.** ADAC XML is high-fidelity. LandXML out of 12d is, in 12d's own words, "some geometric data" — not a credible as-constructed asset carrier. **DXF and CSV should be treated as geometry plus layer names only**, unless the surveyor has been specifically briefed to configure attributed-block export, and even then nested structures (a pit with its connected pipes' inverts) do not survive the flattening. This retires the §2.5 concern about the shipped LandXML parser's elevation and spiral gaps as moot for asset geometry — LandXML was never going to carry it.

**NOT FOUND:** any 12d statement that it supports ADAC 5.1 or 6.00 — 12d's own page lists only 4.0/4.1/5.0 while Rockhampton mandates 6.00. Either the page is stale or there is a real version lag. **NOT FOUND:** any published, authoritative statement of the customary **surveyor → head contractor** deliverable set. Council-facing sets are documented; contractor-facing sets are commercial practice with no standard locatable at grade A or B.

---

### Q7 — A-SPEC. **The premise is wrong twice. J5 is void as framed.**

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| A-SPEC is a **commercial product of GISSA International Pty Ltd, Victoria** — not an NSW standards body **[del]** | R-Spec DDS v3.0.5, 31 May 2019 | **A** | "developed and is being managed by GISSA International Pty Ltd" |
| Victorian address **[del]** | same | **A** | "Suite 10, 476 Canterbury Road, Forest Hill Victoria, AUSTRALIA, 3131" |
| Current edition A-SPEC Version 5 **[del]** | a-specstandards.com.au/spec | **A** | "A-SPEC Version 5 … valid from 4 September 2023" |
| **A-SPEC is GIS layers plus attribute tables, NOT XML** **[del]** | R-Spec §1.3, §2 | **A** | "each asset class must be delivered on a separate level/layer" |
| Delivery is ad-hoc media **[del]** | R-Spec, Deliverables | **A** | "Email files … USB memory device … Cloud Mediums (FTP, Dropbox, Google Drive etc.)" |
| **Licence restricts use to consortium members** **[del]** | R-Spec, Intellectual Property | **A** | "only to be used for the delivery of As Constructed data to A-SPEC Consortium members only" |
| Victorian council mandates confirmed (Greater Dandenong, Melton, Mitchell, Ballarat, Yarra Ranges) **[del]** | e.g. Greater Dandenong A-SPEC page | **A** | "submit 'As Constructed' infrastructure asset information in the 'A-SPEC' Digital Data Specification format" |
| **NSW councils mandate ADAC, not A-SPEC** **[del]** | Wollondilly ADAC XML Data Capture Guidelines v2.3, March 2026 | **A** | "ADAC XML files are required to accompany the usual bundle of 'Work-as-Executed' (WAE) plans" |

**Both arms of J5 are misdescribed.** A-SPEC is not NSW — its verified adoption is **Victorian and Western Australian**, with **zero NSW councils** found mandating it across twelve tested. And the NSW councils that do mandate a structured format mandate **ADAC** (Tweed, Port Macquarie-Hastings, Shellharbour, Wollondilly, Queanbeyan-Palerang, Ballina appear in consortium membership). So the "network geography" argument for an NSW arm points at ADAC, not A-SPEC.

**The likely source of the confusion:** **AUS-SPEC** — NATSPEC's engineering specification suite, e.g. D14 Work-as-Executed Plans — genuinely *is* ubiquitous across NSW councils. AUS-SPEC and A-SPEC are unrelated products with near-identical names.

**A licence trap worth naming even though D2 is closing:** building A-SPEC export for a council that is not a consortium member is arguably outside GISSA's licence. ADAC has no such restriction.

**NOT FOUND:** any NSW council mandating A-SPEC or any sub-spec. **NOT FOUND:** any published crosswalk or interoperability document between ADAC and A-SPEC — neither side's documents acknowledge the other. **NOT FOUND:** any independently verifiable head-to-head council count (A-SPEC self-reports "65+ agencies", grade B vendor self-report, and their public member directory renders empty).

---

### Q8 — Is ADAC 6.00 a superset of 5.01? **Breaking change. Verified by author.**

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| **The version attribute is `fixed="6.0.0"` — hard validation failure before any structural difference** | `ADAC_V600.xsd:323` — **read by author** | **A** | "Only a value of 6.0.0 will validate against this schema." |
| The schema explicitly forbids cross-version validation | `ADAC_V600.xsd:325` — read by author | **A** | "should only be validated against the version of the ADAC schema to which they correspond" |
| Same lock existed in 5.01, so incompatibility is symmetric and deliberate **[del]** | ADAC_V501 documentation, Jan 2018 | **A** | "Only a value of 5.0.1 will validate against this schema." |
| `ProjectData` gained two new mandatory groups (Electrical, Communication) inside a sequence **[del]** | `ADAC_V600.xsd` vs diff report | **A** | (structural, read directly) |
| Element renames, not just additions **[del]** | Custodian HTML diff reports, Oct 2023 | **A** | "Area_sqm" → "Area_m2"; "WingWall" → "OutletProtection" |
| Enumeration deletions across modules **[del]** | same | **A** | Enumerated Types: "deleted (7)"; StormWater: "deleted (5)" |
| **Sunshine Coast 1 Sep 2026 cutover confirmed** | SCC as-constructed page — **read by author** | **A** | "After 1st September 2026 Sunshine Coast Council will move to ONLY accept ADAC version 6.00." |
| SCC transition window | same — read by author | **A** | "all submissions made after 1st March 2026 can be either ADAC Version 6.00 or … 5.02" |
| Not all councils are cutting over **[del]** | Rockhampton guidelines §2.2 | **A** | "will except older ADAC XML schema versions; 4.0, 4.1, 4.2 & 5.1" |

Semantically 6.00 is *close to* a superset — mostly added enumerations and asset groups, a handful of renames, ~15 deleted enumeration values. **Formally it is not**, and the `fixed` attribute alone guarantees that. Had D2 proceeded, versioned jurisdiction profiles would have been the minimum architecture, not future-proofing. **Moot now.**

**NOT FOUND:** any published 6.00 migration guide, upgrade tool or human-written change log — the only change documentation is the machine-generated HTML diff set. **NOT FOUND:** any ADAC **5.02** XSD published by the custodian; IPWEA-QNT publishes only 6.00 and 5.01. Sunshine Coast's "5.0.2" appears to be a council document revision, not a distinct schema version — treat "5.02 schema" as unverified.

---

### Q9 — Datum and accuracy. **A transform is NEVER CIVOS's to perform. Expected answer confirmed.**

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| **The schema mandates nothing — CRS is unconstrained free text** | `ADAC_V600.xsd:168-182`, all `String_64` — **read by author** | **A** | "Well known projections may be referred to by name only." |
| Horizontal datum is a label, e.g. GDA2020 | `ADAC_V600.xsd:173-176` — read by author | **A** | "To Specifiy the Datum that the Horizontal Coordinate System is based on. E.g. GDA2020." |
| Vertical datum is a label, e.g. AHD | `ADAC_V600.xsd:178-181` — read by author | **A** | "To Specifiy the Datum of Height values. E.g. AHD." |
| **Logan's survey tolerance is 20 mm, horizontal and vertical** | Logan PSP5 §5.6.2(1)(j) — read by author | **A** | "the tolerance for survey, alignment tolerance, is 0.02 metre and the level tolerance is 0.02 metre" |
| **Logan still accepts GDA94** | Logan PSP5 §5.6.4(1)(b)(i) — read by author | **A** | "in MGA (Zone 56) co-ordinates on the GDA 94 or GDA 2020 datum" |
| Logan requires ties to permanent survey marks | Logan PSP5 §5.6.2(1)(e) — read by author | **A** | "tied into at least 2 permanent survey marks … at least fourth order" |
| SCC mandates MGA56 / GDA2020 / AHD **[del]** | SCC Guideline v6.0.0 §5.1 | **A** | "Must be MGA56." / "Must be GDA2020." / "Must be AHD." |
| SCC per-asset-class tolerances (±50 mm kerb/stormwater, ±0.5 m structures, ±1 m furniture) **[del]** | SCC Guideline §5.5–5.11 | **A** | "The minimum accepted horizontal accuracy for Edging Lines is ± 50mm." |
| Rockhampton: ±80 mm XY / ±35 mm Z at 95% confidence **[del]** | Rockhampton Table 3 | **A** | "Positional Accuracy (XY) (95% confidence limit)" |
| **The transform obligation sits on the survey software, upstream** **[del]** | Unitywater §3, 21/04/2026 | **A** | "Your survey software should be configured to output coordinates in MGA2020 zones" |
| Wrong-datum files are bounced back, not converted **[del]** | SCC Guideline §2 | **A** | "may be returned to the provider for correction and resubmission" |
| The surveyor certifies, with named surveyor and approval date in-schema | `ADACGlobalTypes.xsd` `surveyor_details` — read by author | **A** | "The date of the final approval of survey." |

**Answer: the surveyor delivers already-correct coordinates.** The ADAC schema contains **no transformation, epoch, distortion-grid or reprojection element of any kind** — it records a datum *label* only (verified by author). No council or utility document found authorises or requests a datum transform by the software that receives or assembles the file; wrong-datum files are returned for correction. `[DH-B3]` holds, and `crs.ts:13-20` stays display-grade. **No stop-and-replan.**

Note for the folio, since it survives: Logan's 20 mm survey tolerance is explicitly *not* a construction tolerance — Rockhampton says so directly **[del]**: *"This is not to be confused with the construction tolerances and requirements specified"*. Do not conflate the two in any UI.

**NOT FOUND:** any accuracy tolerance published by the ADAC custodian itself. Every numeric tolerance comes from an individual council or utility; ADAC delegates accuracy entirely to the receiver, with AS5488 `DataQuality` the only in-schema hook.

---

### Q10 — TfNSW Digital Engineering. **v4.1 is current, opt-in per contract, and contains no conformance content. D3 closes.**

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| v4.1 is still current **[del]** | TfNSW DE Standard Part 2 publication page | **A** | "Current version … Published 5 Dec 2022" |
| Two parts, not three **[del]** | DMS-ST-207 v4.1 | **A** | "The DE Standard is provided in two parts" |
| Review date lapsed 19 months ago with no successor **[del]** | DMS-ST-207 v4.1 cover | **A** | "Next review date: December 2024" |
| Still operative Jan 2025 **[del]** | Technical Direction TD 00002:2025, 30 Jan 2025 | **A** | "projects that are managed under DMS-ST-202 … and DMS-ST-207" |
| **Applies only where the contract specifies DE** **[del]** | DMS-ST-207 v4.1 §1.4 | **A** | "where DE methodologies are specified for project delivery" |
| **Built for IP Major Works only** **[del]** | DMS-ST-208 v4.0 §1.3 | **A** | "developed to support IP Major Works and Professional Services Contracts" |
| Not mandatory across projects **[del]** | TfNSW DE FAQs (live page, stale content) | **A** (stale) | "Is it a requirement to use the DE Framework on all TfNSW projects? No." |
| Subcontractors handled via extra DEXPs, not flow-down **[del]** | DMS-ST-207 v4.1 §1.1 | **A** | "by various subcontractors, multiple project DEXPs may be required" |
| **Part 2 has zero ITP / hold-point / NCR requirements across 143 pages** **[del]** | DMS-ST-207 v4.1, full-text grep | **A** | (0 matches: ITP, hold point, non-conformance) |
| ITPs appear in Part 1 only as things that arrive at handover **[del]** | DMS-ST-202 v4.1 §4.3.2 | **A** | "completed Inspection and Test Plan (ITP)" |
| Only structured test data is geotechnical **[del]** | DMS-ST-207 v4.1 Table 54 | **A** | "Laboratory test results — *.ags (AGS data file)" |

**Answer to both halves: v4.1 is current, and no DE obligation reaches CIVOS's customer tier.** DE binds you only if you hold an IP Major Works or Professional Services contract **and** that contract specifies DE — opt-in, per project. A subcontractor's exposure arrives through the head contractor's DEXP and the subcontract, not through the Standard.

More decisively for D3: **TfNSW DE is a design-model-and-asset-data regime with nothing to say about conformance records.** Part 2 — the document that actually imposes obligations — contains zero occurrences of "ITP", "Inspection and Test", "hold point", "witness point", "non-conformance" or "NCR". This confirms §6's suspicion and goes further: DE alignment is not even a file-naming concern for us, because we are not in scope.

**Two corrections to the working assumptions:** there is no Part 3, and the document numbering is `DMS-ST-202` / `DMS-ST-207`, not `T MU DE 00009 ST`. The landing page also moved — `/industry/digital-engineering` now 404s.

**NOT FOUND:** any flow-down clause; any project-value threshold; any DE capability tiering table; any edition newer than v4.1.

---

### Also settled — VicRoads / DTP (Victoria). **No longer a NOT FOUND, and it strengthens the case against a Victorian arm.**

| Claim | Source | Grade | Quote (≤15 w) |
|---|---|---|---|
| Victoria has a current state DE standard covering as-built handover **[del]** | NTS 019:1.0 Victorian Transport Digital Engineering Standard v1.0, 10 Oct 2025 | **A** | "The Book In process is required for all final As-Built models of the project." |
| Handover format is IFC 4.3, not XML **[del]** | VIDA Transport EIR v3, 2 July 2025 | **A** | "IFC4.3Format (.ifc, Reference View MVD)" |
| Scoped to VIDA / Big Build lead appointed parties **[del]** | same | **A** | "The Lead Appointed Party must provide as-built asset information to the Appointing Party" |
| Regional Victorian councils elect A-Spec council-by-council **[del]** | Infrastructure Design Manual v5.60, LGIDA, released 1 Dec 2025 | **A** | "Selection Table 7.6(a) shows those Councils which require \"As Constructed\" plans … in A Spec Format." |
| Growth areas: D-Spec is the minimum **[del]** | VPA Engineering Design and Construction Manual, Dec 2019 | **A** | "Provision of digital drainage asset data under the \"D-Spec\" system has been adopted as the minimum requirement" |
| No statewide standard — only an aspiration **[del]** | same | **A** | "A longer term goal of the State Government is to establish state wide standards and procedures." |

**NOT FOUND — zero ADAC adoption anywhere in Victoria**: no council, water authority or state body, across the 286-page IDM, the VPA manual and the DTP EIR. Victoria is A-SPEC-or-nothing, roughly 30 councils on A-Spec and ~24 wanting only AutoCAD to GDA94 (including Greater Geelong; Moyne Shire explicitly disallows A-Spec). **Victoria remains out of scope, and the appendix's line 59 can be closed as answered rather than unverified.**

---

## What this changes about the spec

**1. §5 (D2) — delete the XML limb, do not defer it.** Both gates fail independently. Recommend the Rev 2 disposition be: clauses 2, 3, 5, 6, 8 (asset data model, import, versioned profiles, XSD validation, council acceptance exit gate) **closed permanently**; clause 4 (linkage) **survives as internal-only value inside D1**, with the spec stating out loud that it is not exported; clause 7 (surveyor/RPEQ boundary) **survives as the invariant `[DH-B3]` already says it is**, now with grade-A backing that the boundary is real and signed by named parties. Clause 1's validation conversations stay worth having — but as customer discovery for the folio, not as a gate on an XML build.

**2. §5.3 — the real-council acceptance gate is unreachable by design, and that is now a finding rather than a risk.** "One named authority has accepted one real submission" cannot be met by a head-contractor product, because the submitting party is the consulting engineer. Replace with a reachable equivalent: **one RPEQ consultant lodges an on-maintenance submission whose evidence pack was compiled in CIVOS.** That is the same value, measured at the party who actually exists in the pipeline.

**3. §4.5 — configurable requirements now has its requirement list, so `[DH-d]`'s condition is met.** The spec deferred D1e because *"there is no evidence yet for what to configure"*. There is now: Logan PSP5 §5.6.5 is an enumerated, mandatory, council-enforced evidence list, and Gold Coast, Moreton Bay, Rockhampton and Unitywater supply comparable ones. This does **not** mean build D1e — it means the deferral's stated blocker is gone and D1e can be specified when someone wants it. Everything else in §4.5 stands.

**4. §4.4 (D1d) — unblocked, Scope A, as a rider on D1c.** A `documentType`, a lot association, a manifest category. Logan additionally specifies the run endpoints (first maintenance hole upstream and downstream) and accepted container formats, which is worth surfacing as guidance text but is not a data model.

**5. §6 (D3) — close it.** Not "gated pending a newer edition" — closed. v4.1 is current, it is opt-in per contract, it is scoped to IP Major Works, and it has no conformance content at all. There is no version of D3 that serves CIVOS's customer.

**6. §16.1 J5 — withdraw the decision as framed and re-put it.** "ADAC-QLD vs A-SPEC-NSW" is wrong on both arms: A-SPEC is a Victorian commercial product with a member-restricted licence and no NSW adoption, and NSW's structured-format councils are on ADAC. With D2 closing, the jurisdiction question mostly evaporates — but if it returns for the folio, the real fork is **QLD/NSW ADAC councils vs Victorian A-SPEC councils**, and the licence restriction makes the Victorian arm materially worse.

**7. Two things to carry into D1's design.**
   - **Key the folio to `WorksApprovalID` (the OPW number), not to surveyor asset identifiers.** It is in the schema, it is on every council drawing, and it is stable. The spec's outcome-(c) wording should be corrected.
   - **`SupportingFile` is the seam, and it is a bare filename.** If CIVOS ever emits filenames that an engineer's ADAC file can reference, deterministic archive paths (§4.3.3) are exactly the right shape for it — that is a free consequence of D1c as already specified, not new work.

**8. One correction to the appendix, and one gap it leaves.** Appendix line 59 (VicRoads/DTP) can move from UNVERIFIED to answered — Victoria has NTS 019 (Oct 2025) and is A-SPEC territory with zero ADAC. But **appendix line 52's Logan "ADAC 5.01 since 1 Jul 2024" claim was not re-confirmed** by this pass: Logan's ADAC page is Akamai-403 to every method tried, and the PSP5 edition I read says only "the current version". It is not contradicted — it is unverified, and should be re-graded until someone opens that page in a real browser.

---

## NOT FOUND, collected

- Any council document naming the civil head contractor as producer, holder or submitter of the ADAC XML on a developer Operational Works job (14 councils checked).
- Any ADAC element, attribute or enumeration for a test certificate, ITP, checklist, inspection record, conformance report, NCR, hold-point release, CCTV reference or QA document link — in 5.01 or 6.00.
- Any ADAC field carrying a document type, MIME type, checksum, URI or issuing party for a supporting file.
- Any published licence text for the ADAC schema; any official IPWEA-QNT validator or its terms.
- Any published ADAC 6.00 migration guide, upgrade tool or human-written change log.
- Any ADAC 5.02 XSD published by the custodian.
- Any accuracy tolerance published by the ADAC custodian itself.
- Re-confirmation of Logan's ADAC 5.01 mandate and its 1 Jul 2024 date (page Akamai-blocked).
- The body text of WSA 05 Appendix A5 — paywalled at AUD $792; front matter and TOC only.
- Any Australian authority mandating the WSA 05 Appendix A5 XML file by name.
- Any 12d statement of support for ADAC 5.1 or 6.00.
- Any published statement of the customary surveyor → head contractor deliverable set.
- Any itemised spec of what 12d's LandXML export writes.
- Any NSW council mandating A-SPEC; any published ADAC ↔ A-SPEC crosswalk; any independently verifiable adoption count for either.
- Any TfNSW DE flow-down clause, value threshold, capability tiering table, or edition newer than v4.1.
- Any Victoria-specific as-constructed schema; any Local Government Victoria as-constructed data standard.

## Local evidence kept for re-verification

`C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3--claude-worktrees-wave1-lotbreakdown\eb519d0e-493c-4bcc-b7f7-41fdef8e1077\scratchpad\`

- `adacx/xsd/ADAC_v600_XSD/` — the full 16-file ADAC v6.00 XSD set (951,365 bytes) plus the custodian's XLS data dictionary
- `logan_psp5.pdf` / `logan_psp5.txt` — Logan City Council Planning Scheme Policy 5 – Infrastructure, 2019 Amendment (3.2 MB, 6,331 lines extracted)
- `rspec.pdf` / `rspec.txt`, `wolly.pdf` / `wolly.txt`, `pmhc_d14.pdf` / `pmhc_d14.txt` — A-SPEC R-Spec, Wollondilly ADAC guidelines, PMHC D14

**Fetch note for future .gov.au work:** many council sites 403 both WebFetch and curl (Akamai) — `https://r.jina.ai/<url>` and S3/CDN-hosted copies are the working paths. TfNSW PDFs serve once same-origin `Referer` and `Sec-Fetch-*` headers are sent.
