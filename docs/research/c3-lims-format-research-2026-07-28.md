# C3.0 — TfNSW LIMS format confirmation pass

**Date:** 28 July 2026 · **Pass type:** primary-source research, no code · **Gate:** `docs/plans/wave-c3-spatial-tests-lims-spec-2026-07-28.md` §3.4 (7 questions), spec merged #1639.

## VERDICT

**The arrow points laboratory → TfNSW. It is a submission format, and CIVOS is not a party to the flow.**

The document specifies what a **NATA-accredited, TfNSW-registered laboratory** must upload **to TfNSW**, fortnightly, over TfNSW's own eMFT file-transfer portal, as a condition of staying on the Construction Industry Contractor register (Category L). It is not a format labs emit to their clients, and there is **no mandate anywhere requiring a lab to give these files to the head contractor**.

**Recommendation: build NEITHER an import nor an export. Do not open Phase C as scoped.**

- **Export is wrong and should be closed permanently.** CIVOS cannot produce a compliant submission: files are keyed on the *laboratory's* NATA accreditation site number, and the mandatory fields are raw laboratory instrument data CIVOS never holds (nuclear gauge calibration constants A/B/C, mould and container masses, standard counts, and a complete audit trail of every field change made *inside the lab's LIMS*). A head contractor submitting this would be fabricating a lab record.
- **Import is not backed by the mandate the program cited, but it is the only survivable version of the idea.** These files provably exist in a stable, published, versioned schema, and the lab already generates them fortnightly. A contractor *could* ask for a copy. Nothing obliges the lab to hand one over. That makes it a commercial-access question, not a format question — so it cannot be scheduled until someone confirms with a real lab that the files will be provided. **Re-scope, do not build.**
- **The real prize from this pass is not a feature at all.** Table 1 of the current format is a published, mandated, government-standard schema for **lot and sample spatial location** — `UniqueLotNumber`, `LotLocationStartChainageGPSCoordinates`, `LotLocationFinishChainageGPSCoordinates`, `LotLocationLeftOffsetsGPSCoordinates` / `...RightOffsets...`, `ControlLine`, `LotLocationLayerNumber`, `LayerLocationRL`, `SampleLocationChainageGPSCoordinates`, `SampleLocationOffsetGPSCoordinates`. This directly validates C3 Phase B's test-pin work and gives it grade-A vocabulary for free, with no LIMS feature and no import pipeline. **That is what C3 should take from this document.**

**Two corrections the program must absorb:** the appendix's cited URL is a **superseded** edition (a v1/v2-era 2023 PDF); the current edition is **v6, an XLSX, published 29 Aug 2024 / distributed 5 Nov 2024**. And the program's phrase *"LIMS tabulated ingestion"* (plan line 77) describes a flow that does not exist as described.

---

## The seven answers

### 1. What the document actually specifies — file type(s), column schema, delimiters, versioning

A **specification workbook**, not a blank template. Six data tables, each submitted as a **separate file**:

| Table | Name | Fields | Cardinality |
|---|---|---|---|
| 1 | Metadata | **34** | one row per test (sampling metadata denormalised on) |
| 2 | Audit Trail | **15** | one row per field change inside the lab's LIMS |
| 3a | Specific Test Data — T173 field nuclear density | **21** | one row per test, parameters as columns |
| 3b | Specific Test Data — T120/T162/T166 compaction control | **56** | " |
| 3c | Specific Test Data — T108/T109 Atterberg limits | **51** | " |
| 3d | Specific Test Data — T106 particle size distribution | **82** | " |
| 3e | Specific Test Data — T111/T117 CBR | **84** | " |

Field counts measured directly from the v6 workbook's sheet XML.

- **Field names are machine identifiers** — PascalCase, no spaces, no special characters (`MoistureContentOfSoilGauge`, `CommentsRemarksTestReport`, `LotLocationStartChainageGPSCoordinates`). v2 explicitly *"Removed all special characters and spaces"*.
- **Per-field metadata published:** every field carries a `Definition`, a `Mandatory input (cannot be blank)` flag (`Yes` / `No` / `Yes - where applicable`), and — on the 3a–3e test tables — a `Rounding - Decimal places` column (e.g. `0.01t/m3 and 0.001t/m3 if used in subsequent calculations`).
- **Formats fixed:** dates `DD/MM/YYYY`, times `hh:mm`, timestamps `DD/MM/YYYY hh:mm`.
- **File naming convention is mandated:** `*SiteNumber_Table1_Metadata_Date_Version number`, where `SiteNumber` is the lab's NATA accreditation site number and `Date` is `DDMMYYYY` fixed to the fortnight end (15th, or last day of month). Initial submission `V1`, re-submissions `V2`, `V3`…
- **Cadence is fortnightly.** Tests in progress are excluded *"until completed and authorised"* by a NATA signatory.
- **Versioning of the spec itself:** a `Version Control` sheet, v1 → v6, each with published and distribution dates.
- **NOT FOUND: the physical file type, delimiter, and encoding of the submitted files.** Neither the workbook nor the eMFT upload procedure states whether labs upload CSV, XLSX, or anything else; the mandated file-name convention carries no extension. This is a genuine gap, not an oversight in my reading — I searched the workbook's entire shared-string table for `csv`, `xlsx`, `excel`, `delimit`, `encod`, `utf`, `comma`, `file type`, `file format` and the only hits were the words "worksheet or workbook" inside unrelated field definitions.

### 2. Direction of the arrow — **the program has it backwards**

**Laboratory → TfNSW.** Three independent primary sources agree, and none of them describes a lab-to-contractor delivery:

1. It is a **registration criterion for laboratories**. Criterion 3 under *"L Construction Industry Laboratories"* requires the applicant lab to possess a conforming LIMS.
2. **TfNSW collects it.** MTIP: *"Initiated mandatory collection of test data for all TfNSW Projects…"* — TfNSW is the collector.
3. **The transport channel is TfNSW's own portal, provisioned to labs.** A dedicated procedure exists — *"eMFT Access & File upload procedure for Pre-Qualified Laboratories"* — in which the **lab** whitelists its own public IP with TfNSW's eMFT team, is issued credentials via `SmartIDConnect@transport.nsw.gov.au`, and uploads files to `emft.aws.hosting.transport.nsw.gov.au`. User add/remove requests go to `mtip.data.assessment@transport.nsw.gov.au` naming *"the Laboratory the user is employed at"*.

The head contractor appears nowhere in this pipeline. Corroborating detail: the workbook's `List` sheet contains TfNSW's **internal** data-platform handling codes (`Do not upload onto data platform`, `Upload onto data platform for use`, `Data masking`, `Data hashing`) and NSW Government security classifications (`OFFICIAL: Sensitive – NSW Cabinet`, etc.) — this is a schema designed for ingestion into a TfNSW analytics platform.

**The one ambiguity, stated honestly:** registration criterion 3 says the LIMS must be capable of providing *"any requested test results and data"* in the format — it does not say *requested by whom*. That wording is the only textual hook on which a contractor could argue entitlement to the same files. It is not a mandate, and I found nothing elsewhere that resolves it.

### 3. Who is mandated, on which contracts, since when

- **Who:** NATA-accredited laboratories accredited to AS ISO/IEC 17025 and registered under the TfNSW Registration Scheme for Construction Industry Contractors, **Category L**. Each Base, Branch and Annex facility is assessed separately.
- **Which contracts:** *"all TfNSW Projects awarded to pre-qualified laboratories post 1st September 2023"*.
- **Since when:** mandatory collection commenced for projects awarded **after 1 September 2023**, following a proof-of-concept trial on two TfNSW projects. The driver was MTIP, launched after technical audits found *"instances of non-compliant practices… at construction materials testing laboratories"* — i.e. this is a **testing-fraud control**, which explains why the audit trail (Table 2, every original value, who changed it, when, and why) is mandatory.

### 4. Do NATA labs commonly emit this format to their clients? — **NOT FOUND**

No evidence found, at any grade, that laboratories emit TfNSW LIMS-format files to their clients, or that any LIMS vendor documents a TfNSW-format export.

What *is* established: TfNSW *"Completed comprehensive engagement with… Laboratory Information Management System (LIMs) providers"* (grade A), so vendors were consulted and presumably built submission support. But engagement with vendors is not evidence of client-facing delivery. Spectra QEST's QESTLab — the dominant AU construction-materials LIMS — publicly documents **AGS** and generic **CSV** export, with no mention of a TfNSW LIMS format (grade C, vendor marketing pages). **This is the question that decides whether an import is ever viable, and it is unanswered.**

### 5. Current edition / version and where the authoritative copy lives

**Current: v6.** Published **29 August 2024**, distributed **5 November 2024**, filed as `20241119v6-lims-data-submission-requirements.xlsx`.

Authoritative location: the TfNSW *Registration scheme for Construction Industry Contractors* page, `https://www.transport.nsw.gov.au/operations/roads-and-waterways/business-and-industry/partners-and-suppliers/tenders-and-16`, which serves the v6 XLSX directly.

**The cited 2023 PDF is superseded.** Proof is structural, not inferred: the v6 `Version Control` sheet records that **v3 (30 Jan 2024)** *"Combined Table 1 (Test Metadata) and Table 2 (Sample Metadata) into one Metadata Table (Table 1)… Renamed specific test data Tables from 4a-4e to 3a-3e."* The 2023 PDF still has the **pre-v3** structure — separate Table 1/Table 2, audit trail at Table 3, tests at 4a–4e — so it is v1 or v2 (v1 published 24 May 2023).

**Currency-proof note, and a caveat on the §3.4 control.** The spec expected a `SUPERSEDED` watermark in the retired edition's text layer. **That control does not apply here**: the 2023 PDF carries **no version, edition, revision or date marker of any kind**, and no watermark — I grepped its full text layer. Worse, **TfNSW itself still deep-links the superseded PDF**: the current *Registration Scheme* guidelines (Edition 5 Revision 22, Oct 2025) cite the 2023 PDF URL verbatim at page 8–9, while the same site's landing page offers v6. That stale official link is almost certainly how the research appendix acquired the wrong URL — the appendix author was not careless, the source was.

Full version history from the workbook:

| v | Published | Distributed | Change |
|---|---|---|---|
| 1 | 2023-05-24 | 2023-05-24 | N/A |
| 2 | — | — | Added fields to Tables 1, 3a, 3e, 3c; specified date/timestamp formats; removed all special characters and spaces; added report + test method number to all test tables |
| 3 | 2024-01-30 | 2024-01-30 | Merged Test + Sample metadata into Table 1; Table 2 → Audit Trail; 4a–4e → 3a–3e; mandatory-field column added; file/table naming convention added |
| 4 | 2024-05-23 | 2024-05-23 | File naming convention extended with date + version; all TS test method numbers added |
| 5 | 2024-06-06 | 2024-06-06 | Exclude testing in progress until completed and authorised |
| 6 | 2024-08-29 | 2024-11-05 | Rounding amendments; several mandatory fields relaxed to "where applicable"; standardised comments for abandoned/cancelled/non-compliance testing |

### 6. Sample / template files published

**Partly.** The v6 **XLSX is itself the published artifact** — it is a specification workbook (per-table sheets of `Field | Definition | Mandatory | Rounding`), and it is machine-readable, so the column schema is directly extractable. Supporting published material: the eMFT upload procedure PDF, and the registration application DOCX.

**NOT FOUND:** any populated worked example, any blank data-entry template with the columns laid out as a submission grid, and any validation schema. A builder would have to construct the submission layout from the field lists.

### 7. Adjacent states (VIC / QLD) — **NOT FOUND**

No equivalent mandatory electronic laboratory-data submission format found for VicRoads/DTP Victoria or QLD TMR. Both publish extensive **test method** documentation (QLD *Materials Testing Manual*; VicRoads Code of Practice RC 500.16 *Selection of Test Methods*), but nothing analogous to a mandated tabulated LIMS submission schema. Searched directionally only, as instructed — treat as "not found in a directional search", not as "confirmed absent".

---

## Evidence table

| # | Claim | Source | Grade | Quote (≤15 words) |
|---|---|---|---|---|
| 1 | The 2023 PDF exists and was read in full (15 pp) | `transport.nsw.gov.au/system/files/media/documents/2023/LIMS-data-submission-requirements.pdf`, p1 | **A** | "LIMS Data Submission Requirements - Specified Tabulated Format" |
| 2 | Conforming LIMS is a laboratory **registration** criterion | Registration Scheme for Construction Industry Contractors, Ed 5 Rev 22 (Oct 2025), pp8–9 | **A** | "Possess a LIMS capable of providing any requested test results and data" |
| 3 | The registration scheme cites this exact document | ibid., p9 | **A** | "Further details on the specified format can be found at:" |
| 4 | Applies to Category L, NATA/ISO 17025 accredited labs | ibid., p8 | **A** | "The testing facility must be accredited by NATA in accordance with AS ISO/IEC 17025" |
| 5 | TfNSW **collects**; mandatory since 1 Sep 2023 | MTIP July 2024 update, p1 | **A** | "Initiated mandatory collection of test data for all TfNSW Projects" |
| 6 | Format is a mandatory requirement, not guidance | ibid., p1 | **A** | "As a mandatory requirement, a LIMs capable of providing meta-data and test-specific data" |
| 7 | Driver was detected testing non-compliance | ibid., p1 | **A** | "identified instances of non-compliant practices taking place at construction materials testing laboratories" |
| 8 | LIMS vendors were engaged by TfNSW | ibid., p1 | **A** | "Completed comprehensive engagement with Construction Industry Laboratories… LIMs providers" |
| 9 | **Labs upload to TfNSW** — direction confirmed by channel | eMFT Access & File upload procedure for Pre-Qualified Laboratories, p1 | **A** | "File upload process for Materials Testing Integrity (MTIP) by registered Construction Industry Laboratories" |
| 10 | Lab-side provisioning (IP whitelisting) | ibid., p1 | **A** | "eMFT team will then whitelist the IPs and will provide access to your IPs" |
| 11 | Portal is TfNSW-hosted | ibid., p1–2 | **A** | "emft-np.aws.hosting.transport.nsw.gov.au" |
| 12 | Current edition is v6 | `…/2025/20241119v6-lims-data-submission-requirements.xlsx`, `Version Control` sheet | **A** | "6 \| 45533 \| 45601" (published 2024-08-29, distributed 2024-11-05) |
| 13 | 2023 PDF is pre-v3, therefore superseded | ibid., `Version Control` v3 | **A** | "Renamed specific test data Tables from 4a-4e to 3a-3e" |
| 14 | Fortnightly submission cadence | ibid., `Summary` sheet | **A** | "the 15th of the month for the 1st fortnight and the last day" |
| 15 | File naming keyed on the **lab's** NATA site number | ibid., `Summary` | **A** | "The Site number is the unique accreditation site number provided by NATA" |
| 16 | Re-submission versioning | ibid., `Summary` | **A** | "For all initial submissions the version number to be used is V1" |
| 17 | Only authorised, completed tests are submitted | ibid., `Summary` | **A** | "Not to be submitted until test is completed and authorized by a NATA signatory" |
| 18 | Table 1 carries mandatory **lot** identity | ibid., `Table 1 - Metadata` | **A** | "UniqueLotNumber \| \| Yes" |
| 19 | Table 1 carries lot + sample **spatial** fields | ibid., `Table 1 - Metadata` | **A** | "LotLocationStartChainageGPSCoordinates", "SampleLocationChainageGPSCoordinates" |
| 20 | Offsets are control-line relative | ibid., `Table 1` notes | **A** | "The 'offset' is relative to the Control Line." |
| 21 | Format carries lab identity + accreditation (→ C4) | ibid., `Table 1` | **A** | "AccreditationSiteNumber \| Laboratory's NATA accreditation site number \| Yes" |
| 22 | Wide, parameter-per-column cardinality | ibid., `Table 3b` (56 fields) | **A** | "WetDensityPoint1", "WetDensityPoint2", "WetDensityPoint3" as separate columns |
| 23 | Per-field rounding is specified | ibid., `Table 3a` | **A** | "MoistureContentOfSoilGauge … nearest 0.1%" |
| 24 | Audit trail is full field-level change history | ibid., `Table 2 - Audit trail` | **A** | "OriginalValue", "NewValue", "OriginalValueChangedBy", "ChangeDateTimeStamp" |
| 25 | Schema targets a TfNSW internal data platform | ibid., `List` sheet | **A** | "02 Upload onto data platform for use" |
| 26 | Format ties to Q6 and R44 (C1 pack territory) | 2023 PDF p7; v6 `Summary` | **A** | "Specified minimum characteristic value of relative compaction in TfNSW R44" |
| 27 | Physical file type / delimiter / encoding | v6 workbook + eMFT procedure, exhaustive string search | **NOT FOUND** | — |
| 28 | Labs emit this format to clients | Web search; vendor documentation | **NOT FOUND** | — |
| 29 | QESTLab documents AGS/CSV export, not TfNSW format | spectraqest.com solutions pages | **C** | "built to support AGS data export, with minimum configuration" |
| 30 | VIC / QLD equivalent submission format | Directional search of TMR + VicRoads publications | **NOT FOUND** | — |

**Method note.** `pdftotext -layout` misaligned the 2023 PDF's two-column field/definition tables by one row — the exact failure recorded at `docs/research/c1-q6-pavements-2026-07-27.md:95`. Under `-layout`, "Laboratory Name" appeared paired with "Laboratory's NATA accreditation number". `-table` mode resolved it correctly (that definition belongs to `Accreditation / Site Number`). **All schema claims above are taken from the v6 XLSX sheet XML, not from PDF text extraction**, so they are not exposed to this class of error. The XLSX was parsed with a stdlib `zipfile` + `ElementTree` reader (`scratchpad/xlsxdump.py`); `openpyxl` is unavailable and pip cannot reach PyPI through this box's TLS proxy.

**Access note.** `transport.nsw.gov.au` returns CloudFront **403** to default `curl`. A browser `User-Agent` fetches all documents fine. `WebFetch` is also 403'd on this host — use `curl -A "<browser UA>"`.

---

## Explicit NOT FOUNDs

1. **Physical file type, delimiter, encoding of submitted files.** Not stated anywhere in the v6 workbook or the eMFT procedure.
2. **Whether labs supply these files to head contractors.** No evidence at any grade. This is the load-bearing unknown for any future import.
3. **Populated worked example / blank submission template / validation schema.** Not published.
4. **VIC and QLD equivalents.** None found in a directional search.
5. **Whether TfNSW Q6 places any test-data obligation on the *contractor*** (as opposed to the lab). The v6 workbook references Q6 clause 5.1.4 for abandoned-sample declarations, and MTIP records that Q6 was amended, but I did not obtain the current Q6 text — it sits behind the TfNSW Standards portal. **This is the one open thread that could change the export recommendation**, and it is the natural next pass if anyone wants to reopen Phase C.

---

## Recommended actions

1. **Correct the appendix row** (`CIVOS-Research-Appendix-2026-07-24.md:27`): replace the superseded URL with the v6 XLSX, set edition `v6`, published `2024-08-29`, checked `2026-07-28`, and rewrite the *"Decision supported"* cell — it currently reads *"C3 lab ingestion format"*, which this pass disproves.
2. **Amend program plan line 77.** *"TfNSW LIMS tabulated ingestion"* describes a flow that does not exist. There is no lab-to-contractor LIMS feed to ingest.
3. **Close Phase C as scoped.** Keep `[C3S-B6]` in force; it did its job. Nothing in `IMPORT_KINDS`, `TARGETS_BY_KIND`, `DryRunRow.unit`, `sourceFormat` or the frontend `ImportKind` union should change. The `'test_register'` kind stays parked — but now parked on a *named* blocker (NOT FOUND #2) rather than on an unread document.
4. **Harvest Table 1 into C3 Phase B.** Use the mandated field vocabulary as the grade-A authority for the test-pin and lot-location work: lot start/finish chainage, left/right offsets, control line, layer number, RL, and sample chainage/offset. This is the pass's actual deliverable and it needs no LIMS feature.
5. **Never claim LIMS compatibility in user-facing copy.** `[C3S-B6]`'s prohibition on *"LIMS-ready" / "LIMS-compatible"* should become permanent, not provisional — CIVOS is not in this pipeline, and a NSW civil buyer will know that.

## Sources

- [LIMS Data Submission Requirements — Specified Tabulated Format (2023 PDF, superseded)](https://www.transport.nsw.gov.au/system/files/media/documents/2023/LIMS-data-submission-requirements.pdf)
- [LIMS data submission requirements v6, 19 Nov 2024 (XLSX, current)](https://www.transport.nsw.gov.au/system/files/media/documents/2025/20241119v6-lims-data-submission-requirements.xlsx)
- [Registration Scheme for Construction Industry Contractors — Guidelines and Conditions, Ed 5 Rev 22, Oct 2025](https://www.transport.nsw.gov.au/system/files/media/documents/2025/Registration-Scheme-for-Construction%20Industry-Contractors-Guidelines-and-Conditions.pdf)
- [Registration scheme for Construction Industry Contractors (landing page — authoritative copy)](https://www.transport.nsw.gov.au/operations/roads-and-waterways/business-and-industry/partners-and-suppliers/tenders-and-16)
- [eMFT Access & File upload procedure for Pre-Qualified Laboratories](https://www.transport.nsw.gov.au/system/files/media/documents/2024/eMFT-Access-File-upload-procedure-for-Pre-Qualified-Laboratories.pdf)
- [Construction Materials Testing Integrity Project (MTIP) — July 2024 update](https://media.caapp.com.au/pdf/bqw55q/63633b9c-b471-4297-8c8b-b495e69d2171/Materials%20Testing%20Integrity%20Project%20July%202024.pdf)
- [Spectra QEST — Laboratory Management (LIMS) / QESTLab](https://www.spectraqest.com/solutions/laboratory-management-lims/)
