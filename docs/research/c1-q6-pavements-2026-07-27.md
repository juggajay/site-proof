# C1 pavements pass — what owns TfNSW pavement test frequency

> **Provenance of this document.** Produced on **2026-07-27** by a primary-source
> research agent, commissioned by Jay's **J4 approval** of the pavement pass
> proposed in `docs/plans/d14-q6-pack-spec-2026-07-27.md` Rev 1 §16.0 J4 and
> §17.2 R2. Reproduced here essentially verbatim as the authority for that
> spec's **§5.6** (the `tfnsw-q6.v1` pavement extension) and **phase D14.5**.
> The only edits to the agent's text are this header — the body, including its
> working-file paths in §7, is unchanged.
>
> **The binding findings are §2.1 and §3.2:** Q6 cl. 3.8.3 makes Annexure Q6/L
> own pavement sampling frequency (no separate pavement table), and every
> R71/R73 specified relative compaction is ≥ 100 %, so TfNSW pavement lots land
> on Table Q6/L.1's single `> 100.0` row — which R71's own heavy-duty table
> republishes cell-for-cell as an independent cross-check.
>
> **Three corrections found when folding this into the spec.** They were checked
> against shipped code at `d1cc44ed` and are recorded here so the body is not
> read as binding on these three points. Everything else in §2–§5 was re-derived
> and held.
>
> 1. **§6.3 gap 1 — "`QuantityUnit` has no tonnes and no linear metres" is
>    wrong.** `backend/src/lib/readiness/sufficiency/types.ts:37` ships
>    `QUANTITY_UNITS = ['m2', 'm3', 't', 'm', 'each']`, and
>    `frontend/src/lib/testSufficiency.ts:33-39` already offers all five in the
>    lot form. Rules #8, #11, #13 and #14 are not blocked on a vocabulary
>    addition. The real blocker is that a lot records **one** quantity in **one**
>    unit, so a lot measured in m² cannot also supply the tonnage a binder rule
>    needs — a per-unit resolution problem (spec §4.6), not a missing enum member.
> 2. **§4.2 option 2 — shipping pavements as a separate `tfnsw-q6-pavement.v1`
>    ruleset is not implementable.** The recommendation assumes "resolution keys
>    on `activitySlug`". It does not: `resolveRuleset`
>    (`backend/src/lib/readiness/sufficiency/registry.ts:46-66`) selects exactly
>    **one** ruleset per `(state, specSet, date window)` and breaks ties on newest
>    `effectiveFrom` then `id`. Two live NSW/TfNSW packs would **shadow** each
>    other, silently deleting either the earthworks or the pavement rules from
>    every NSW project. The spec takes a third route (§5.6.2): the pavement rules
>    join `tfnsw-q6.v1`, scoped by `appliesTo.activitySlugs`, and carry
>    **scale-independent** bands so no band selection is demanded of the user.
>    §4.2's rejection of option 1 (`defaultScale`) is correct and stands.
> 3. **§7 limit 3's pin example is half wrong.** "a 3,000 m² Class 1 DGB subbase
>    lot requires **5** tests" — the `> 100.0` row's `> 1,000, ≤ 5,000 m²` cell
>    publishes *1 per 500 m² (min 5)*, so 3,000 m² requires
>    `max(5, ceil(3000/500)) =` **6**, not 5. The second half is right: 6,000 m²
>    requires `max(10, ceil(6000/1000)) =` **10**, not 6. The corrected pair is
>    what spec §14 AT-55 pins.

**Researcher:** subagent `d14-q6-pavements`
**Date:** 2026-07-27
**Scope:** extract Q6's PAVEMENT test-frequency content at the same rigour as the earthworks pass, so a pavements extension of `tfnsw-q6.v1` can be encoded at grade A.
**Parent authority:** `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` (earthworks); vocabulary from `docs/plans/d14-q6-pack-spec-2026-07-27.md` §4.3, §5.

---

## 0. Verdict up front

**Q6 owns pavement compaction sampling frequency, through the very same Table Q6/L.1 the earthworks pack already encodes.** There is no separate pavement table. Annexure Q6/L's own scope line settles it:

> "This Clause generally applies only to constructed earthworks **or pavements** which are areal in nature."
> — Q6 Ed 2/Rev 0, Annexure Q6/L opening, **PDF p. 42**

The R-series pavement specs (R71, R73, R75) supply the **acceptance thresholds**, not the frequencies, and each one points back at Q6 with the literal phrase *"As per TfNSW Q for specified relative compaction"* in its own Annexure /L. That is the same delegation pattern R44 uses for earthworks — confirmed a second time, on four more documents.

**The finding that makes this cheap to encode:** every specified relative compaction value published by R71, R73 and R75 is **≥ 100 %**, so TfNSW pavement lots land on **one single row** of Table Q6/L.1 — the `> 100.0` row — in every case but one (R75 courses thicker than 250 mm). R71 independently republishes that exact row as its own heavy-duty table, which is a primary-source cross-check that the row is right.

**Counts:** 18 frequency rules extracted across 5 documents. **9 encodable against the shipped D14 vocabulary with no new field at all**, 4 more encodable once a `QuantityUnit` for tonnes / linear metres exists (13 total), and 5 not expressible in the sufficiency counter as designed. **Evidence grade A** for everything below except two items explicitly flagged NOT FOUND / NOT FETCHED in §6.

**One correction to the prior pass** is recorded in §5.1: its item 7 ("Q6 publishes no reduced-frequency regime — NOT FOUND, correctly absent") is **wrong**. Q6 cl. 3.8.3 publishes one, with a numeric cap.

---

## 1. Documents identified

All fetched fresh on 2026-07-27 and read from the extracted text, not from search snippets. The TfNSW portal burns a diagonal `SUPERSEDED` watermark into the text layer of retired editions — that is the currency test, and it is applied to every row below.

| Document | Identity | Ed / Rev | Date | Source | `SUPERSEDED` hits |
|---|---|---|---|---|---|
| **Q6 — Quality Management (Major Works)** | `TS 01572.1` / `IC-QA-Q6` | **Ed 2 / Rev 0** | **Feb 2024** | [portal `d7d76f7e-…`](https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b) | **0** → current |
| **R71 — Construction of Unbound and Modified Pavement Course** | `IC-QA-R71` | **Ed 5 / Rev 1** | **June 2020** | [portal `b5ef3024-…`](https://standards.transport.nsw.gov.au/_entity/annotation/b5ef3024-b635-ed11-9db2-000d3ae019e0) | **0** → current |
| **R73 — Plant Mixed Heavily Bound Pavement Course** | `IC-QA-R73` | **Ed 3 / Rev 3** | **Dec 2021** | [portal `6352092b-…`](https://standards.transport.nsw.gov.au/_entity/annotation/6352092b-b635-ed11-9db2-000d3ae019e0) | **0** → current |
| **R75 — Insitu Pavement Stabilisation Using Slow Setting Binders** | `IC-QA-R75` | **Ed 3 / Rev 1** | **June 2020** | [portal `6452092b-…`](https://standards.transport.nsw.gov.au/_entity/annotation/6452092b-b635-ed11-9db2-000d3ae019e0) | **0** → current |
| **3051 — Granular Pavement Base and Subbase Materials** | `IC-QA-3051` | **Ed 7 / Rev 1** | **June 2020** | [transport.nsw.gov.au media PDF](https://www.transport.nsw.gov.au/system/files/media/documents/2023/tfnsw-specification-3051-granular-base-and-subbase-materials-for-surfaced-road-pavements.pdf) — **not the portal** | **0**, but see §6.2 |
| **R76 — Insitu Pavement Stabilisation Using Foamed Bitumen** | — | — | — | **NOT FETCHED** — see §6.1 | — |

### 1.1 Currency evidence for Q6, restated independently

I did not inherit the prior pass's conclusion. I re-downloaded Q6 from the same portal record and extracted it fresh: the new extraction is **byte-identical** to the prior pass's cached `q.txt` (`diff` clean, 2,385 lines). The only occurrence of the string "superseded" anywhere in the document is at line 54, inside the revision register's prose ("requirements associated with superseded…") — **not a watermark**. Q6 Ed 2/Rev 0 is confirmed current, and the earthworks pack's citation of it stands unchanged.

### 1.2 A note on the R-series migration

Q6 carries a `TS` number (`TS 01572.1`). R71, R73, R75 and 3051 carry **none** — they are pre-migration `IC-QA-` documents. TfNSW is progressively re-issuing the R-series under `TS` numbers (R44 is already dual-numbered `TS 02158.1`), so the pavement specs are the ones most likely to be re-issued during the pack's life. That is the revalidation risk, and it argues for the 12-month `revalidateBy` the earthworks pack already uses.

### 1.3 Extraction method — and why `-layout` was not trusted

The available `pdftotext` is **Xpdf 4.00**, which offers a `-table` mode. This matters: on Annexure R71/L, the ordinary `-layout` extraction **drifted the Test Method and Minimum Frequency columns out of alignment with their Characteristic rows**, which would have produced a plausible-looking but wholly wrong transcription (it read "Relative compaction → T173", "Maximum wet or dry density → T111, T112 or T162" against the wrong rows, and mangled the five lot-area band headings into an unreadable smear). Every table in this document was re-extracted with `-table` and, where the result was load-bearing, cross-checked against a second signal. The same drift corrupts Q6's own Annexure Q6/M spec list under `-layout` — §2.4 records what it says correctly.

**Page citations were verified by direct single-page extraction,** not by counting form feeds. A form-feed count put Table Q6/L.1 on PDF p. 39; extracting p. 39, 40, 41 and 42 individually shows it is on **p. 42**, which confirms the prior pass's and the D14 spec's `pdfPage: 42` rather than contradicting it.

---

## 2. What Q6 says about pavements

### 2.1 The routing clause — cl. 3.8.3 "Frequency of Testing" (PDF p. 20, doc p. 10)

Transcribed in full, because it is the clause that decides which document owns which number:

> "For work output which is areal in nature such as constructed earthworks **or pavements**, frequency of sampling and testing, including determination of sampling locations, must comply with Annexure Q6/L. For other cases such as loose granular material in stockpiles, or individual discrete components, or any other type of work output which is not areal in nature, frequency of sampling and testing will be stated in the respective specifications.
>
> As part of your management review (refer to Clause 3.14), review the appropriateness of the frequency of testing nominated in the ITPs, taking into account the frequency of nonconformity detected, including nonconformities remedied by simple reworking.
>
> **You may propose to the Principal a reduced minimum frequency of testing, by up to 50 % unless limited otherwise in the relevant specification. Any such proposal must be supported by a statistical analysis verifying consistent process capability and product characteristics.**
>
> The Principal may vary or restore the specified minimum frequency of testing, either provisionally or permanently, at any time."

Q6's own revision register (Ed 2/Rev 0, global) records this as a deliberate Ed 2 clarification:

> "Clarification added that for work output which is areal in nature, sampling frequency and sampling locations must comply with Annex L; for other cases, sampling frequency is stated in respective specs."

So the split is not an inference — TfNSW wrote it down as the point of the edition.

**This is a clean, two-way ownership map:**

| Work output | Frequency owner |
|---|---|
| Constructed pavement layers (areal) — compaction, moisture, density | **Q6 Annexure Q6/L, Table Q6/L.1** |
| Granular material supply / stockpiles (not areal) | **TfNSW 3051 Annexure 3051/L** |
| Everything else on a pavement (thickness, level, ride, width, binder) | the respective **R-spec's** Annexure /L |

### 2.2 Lot definition for pavements — cl. 5.4 (PDF pp. 31–32, doc pp. 21–22)

Identical to earthworks; the clause is scoped to both. Cl. 5.4.1: *"Clause 5.4 generally applies only to work output which is areal in nature such as constructed earthworks or pavements."* The definitions section (PDF p. 12, doc p. 2) says the same of the term **Lot** itself: *"For work output which is areal in nature, such as constructed earthworks or pavements, each Lot must be a continuous portion and essentially homogeneous (except as provided for in Clause 5.4.3)."*

Cl. 5.4.2 constraints, in full, apply unchanged to pavements:

- *"The size of a Lot must not exceed one shift's output, except that the one shift period may be extended by agreement with the Principal where the process cannot be completed in one shift."*
- *"Lots which are less than 2 m wide must not be longer than 150 m."*
- *"Lots must not comprise more than one layer except as provided in Clause 5.4.3 (b) below, or specifically permitted by the relevant specification."*

One pavement-specific note: R71 cl. 8.4.1 adds *"Where multiple layers are constructed to obtain the course thickness specified in Annexure R71/A, test each layer separately."*

### 2.3 A derived finding: both Q6 lot exceptions are structurally unavailable to pavements

This is worth stating because it removes work from the encoding.

- Cl. 5.4.3 **(a)** — non-contiguous areas up to 1,000 m² as one Lot — applies only *"where the specified relative compaction is **less than 100.0 %**"*.
- Cl. 5.4.3 **(b)** — a Lot comprising more than one layer, and Table Q6/L.1's note (1) that depends on it — applies only *"where the specified relative compaction is **below 98.0 %**"*.

Every specified relative compaction published by R71, R73 and R75 is **100 % or 102 %** (§3.2). Neither exception can ever engage on a TfNSW pavement lot. **Consequence: a pavement rule needs no multi-layer minimum logic — Table Q6/L.1 note (1) is unreachable for pavements**, and there is no non-contiguous-lot case to model.

### 2.4 Sampling location method — cl. L2 (PDF pp. 42–43)

**No pavement/earthworks difference exists.** Cl. 5.4.5 sends all areal work to the same cl. L2 method, and cl. L2 is written without reference to material or layer type: represent the Lot as a rectangle, subdivide lengthwise into `n` equal-area sub-Lots, establish six equally spaced grid lines, order them from a six-digit random set in Table Q6/L.2 nominated by the Principal (or derived from the month/day if not nominated). The width-dependent grid-line reductions (< 2.4 m → fewer lines at ≥ 400 mm spacing; < 1.2 m → random offsets) are geometric, not material-dependent.

Searched for and **NOT FOUND**: any pavement-specific sampling-location rule, anywhere in Q6.

### 2.5 Characteristic values — cl. L3 (PDF p. 44, doc p. 37)

**Pavement acceptance uses the identical characteristic-value machinery as earthworks.** All three pavement specs say so explicitly and in the same words:

- R71 cl. 8.4.4: *"Conformity of a Lot for compaction is achieved if the Characteristic Value of Relative Compaction of the Lot, reported to one decimal place, is not less than that specified in Table R71.1"*
- R73 cl. 8.4.3 and R75 cl. 7.4.3: *"Determine the characteristic value of relative compaction **in accordance with TfNSW Q** and report to one decimal place."*

Q6 cl. L3.1: sample size 1 → `QL = QU =` the single result; size 2 → lower / higher of the two; size ≥ 3 → `QL = x̄ − ks`, `QU = x̄ + ks`.

**Table Q6/L.3 — Acceptance Constant k** (re-extracted with `-table`, matching the prior pass exactly):

| Sample Size | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 to 14 | 15 to 19 | 20 or more |
|---|---|---|---|---|---|---|---|---|---|---|
| **k** (1) | 0.52 | 0.62 | 0.67 | 0.72 | 0.75 | 0.78 | 0.81 | 0.83 | 0.90 | 0.95 |

Note (1): *"Based on 10 % producer's risk, and 10 % proportion defective."*

Cl. L3.2 Conformity: *"A Lot achieves conformity if: QL ≥ specified minimum (lower limit) characteristic value of attribute Q; or QU ≤ specified maximum (upper limit) for characteristic value of the attribute Q."*

### 2.6 Table Q6/L.1 — the pavement count table (PDF p. 42, doc p. 32)

The same table, reproduced here because it is the pavement table too:

| Specified relative compaction (%) | ≤ 50 m² | > 50, ≤ 500 m² | > 500, ≤ 1,000 m² | > 1,000, ≤ 5,000 m² | > 5,000 m² |
|---|---|---|---|---|---|
| ≤ 90.0 | 1 | 1 | 1 | 1 per 2,000 m² (min 2) | 1 per 3,000 m² |
| > 90.0, ≤ 95.0 | 1 | 2 | 1 per 250 m² (min 3) | 1 per 1,000 m² (min 3) | 1 per 2,000 m² |
| > 95.0, ≤ 98.0 | 1 | 3 | 4 | 5 | 1 per 2,000 m² (min 6) |
| > 98.0, ≤ 100.0 | 1 | 3 | 4 | 5 | 1 per 2,000 m² (min 6) |
| **> 100.0** | **1** | **3** | **4** | **1 per 500 m² (min 5)** | **1 per 1,000 m² (min 10)** |

The bolded row is the one that matters for pavements (§3.2).

---

## 3. What the R-series pavement specs own

### 3.1 They own the acceptance threshold, and they delegate the frequency

Each pavement spec carries a "Frequency of Testing" clause that defers twice — once to its own Annexure /L, and once to TfNSW Q. R71 cl. 1.2.5 (PDF p. 12), verbatim:

> "The Inspection and Test Plan must nominate the proposed frequency of testing to verify conformity of the work, which must not be less than the frequency specified in Annexure R71/L. Where a minimum frequency is not specified, nominate an appropriate frequency. **Frequency of testing must conform to the requirements of TfNSW Q.**
>
> You may propose to the Principal a reduced minimum frequency of testing. The proposal must be supported by a statistical analysis verifying consistent process capability and product characteristics. The Principal may vary or restore the specified minimum frequency of testing, either provisionally or permanently, at any time."

R73 and R75 carry the same clause, plus in their compaction sections: *"A reduced testing frequency may be permitted in accordance with TfNSW Q."*

#### Annexure R71/L — Frequency of Testing, in full (PDF p. 41, doc p. 31)

| Clause | Characteristic | Test Method / Specification | Minimum Frequency of Testing |
|---|---|---|---|
| 2.1 | Properties of unbound material and Material To Be Modified | TfNSW 3051 | **As per TfNSW 3051** |
| 3.1.1 | Quality of binder | TfNSW 3211 | As per TfNSW 3211 |
| 3.2 | Quality of water: Chloride ion concentration | TfNSW T1004 | 1 per contract per source |
| 3.2 | Sulfate ion concentration | TfNSW T1014 | 1 per contract per source |
| 3.2 | Undissolved solids | AS 3550.4 | 1 per contract per source |
| 3.2 | Concentration of thermo-tolerant coliforms | TfNSW T1015 | 1 per contract per source |
| 8.2 | Unconfined compressive strength | TfNSW T116 | One pair per 400 tonnes or part thereof |
| 8.3 | Spread rate of binder | As per Clause 8.3 | 1 per 200 metres for each spreader run |
| 8.3 | Percentage of binder | As per Clause 8.3 | 1 per 200 tonnes or part thereof |
| **8.4.2** | **Insitu density** | TfNSW T119 or T173 | **As per TfNSW Q for specified relative compaction** |
| **8.4.3** | **Maximum wet or dry density** | TfNSW T111, T112 or T162 | **As per TfNSW Q for specified relative compaction** |
| **8.4.4** | **Relative compaction** | TfNSW T166 | **As per TfNSW Q for specified relative compaction** |
| **8.4.5** | **Field moisture content** | TfNSW T120, T121 or T180 | **As per TfNSW Q for specified relative compaction** |
| 8.5 | Pavement course thickness | As per Clause 8.5 | At least one site per 75 metres, with a minimum of 2 per Lot |
| 8.6 | Surface level | As per Clause 8.6 | As per Clause 7 |
| 8.7 | Deviation from straight edge | As per Clause 8.7 | Minimum 1 per 20 m² |
| 8.8 | Ride quality | TfNSW T182 or T188 | Continuous reading per Lot |
| 8.9 | Pavement width | As per Clause 8.9 | Minimum of 1 per 20 linear metres |

#### The R71 heavy-duty override (PDF p. 42, doc p. 32)

> "For heavy duty materials placed in the base (refer Clause 8.4.4), use Modified Compaction and substitute the Minimum Testing Frequency in Clause L3.1 of TfNSW Q with the value specified below:"

| Material (1) | > 5,000 m² | 1,000 – 5,000 m² | 500 – 1,000 m² | 50 – 500 m² | ≤ 50 m² |
|---|---|---|---|---|---|
| Class 1 DGB placed in base course (Traffic Category A) | 1 per 1,000 m² (min. 10) | 1 per 500 m² (min. 5) | 4 | 3 | 1 |

Note (1): *"For Material Designation, refer to TfNSW 3051."*

**These are, cell for cell, Table Q6/L.1's `> 100.0` row.** R71 does not invent a pavement frequency — it pins one material/location combination to Q6's strictest row despite that material's acceptance threshold (100 %) sitting one row lower. Two independent primary documents publishing the same five numbers is the strongest cross-check available here.

*(The cross-reference "Clause L3.1 of TfNSW Q" is stale: R71 Ed 5/Rev 1 is June 2020, and Q6's Feb 2024 rewrite moved that content — its revision register records "Previously Annex L3, on sampling frequency… rewritten" — to Annexure Q6/L cl. L1. The pointer is to the sample-count table, which is now cl. L1 / Table Q6/L.1. Recorded so a future agent does not chase cl. L3.1 and find the k-value table instead.)*

#### Annexure R75/L — Minimum Frequency of Testing (PDF p. 46, doc p. 34)

| Clause | Characteristic Tested | Test Method | Minimum Frequency of Testing |
|---|---|---|---|
| 2.2 | Properties of imported MTBB | TfNSW 3051 | As per TfNSW 3051 |
| 3.1.1 | Quality of binder | TfNSW 3211 | As per TfNSW 3211 |
| 3.1.2 | Proportion of blended binder | Verify proportion of constituents | 1 per binder delivery |
| 3.2 | Quality of water (4 determinands, as R71) | T1004 / T1014 / AS 3550.4 / T1015 | 1 per contract per source |
| 3.3 | Quality of retarder | Conformity with AS 1478 or other appropriate standard | 1 per contract per source |
| **7.2** | **Unconfined compressive strength** | TfNSW T116 | **As per TfNSW Q for specified relative compaction** |
| 7.3 | Spread rate | As per Clause 7.3 | As per Clause 7.3 |
| **7.4.1** | **Insitu density** | TfNSW T173 | **As per TfNSW Q for specified relative compaction** |
| **7.4.2** | **Maximum wet density** | TfNSW T162 | **As per TfNSW Q for specified relative compaction** |
| **7.4.3** | **Relative compaction** | TfNSW T166 | **As per TfNSW Q for specified relative compaction** |
| **7.4.4** | **Field moisture content** | TfNSW T120, T121 or T180 | **As per TfNSW Q for specified relative compaction** |
| 7.5 | Pavement course thickness | As per Clause 6.3 | At each location as defined in Clause 6.3 |
| 7.7 | Deviation from straight edge | As per Clause 7.7 | Minimum 1 per 20 m² |
| 7.8 | Ride quality | TfNSW T182 or T188 | Continuous reading per Lot |
| 7.9 | Width | As per Clause 7.9 | Minimum of 1 per 20 linear metres |

#### Annexure R73/L — Minimum Frequency of Testing (PDF p. 46, doc p. 32)

| Clause | Characteristic Tested | Test Method | Minimum Frequency of Testing |
|---|---|---|---|
| 2.1 | Properties of MTBB | TfNSW 3051 | As per TfNSW 3051 |
| 3.1.3 | Quality of binder | TfNSW 3211 | As per TfNSW 3211 |
| 3.2 | Quality of water (4 determinands, as R71) | T1004 / T1014 / AS 3550.4 / T1015 | 1 per Contract per source |
| 3.3 | Quality of retarder | Conformity with AS 1478 or other appropriate standard | 1 per Contract per source |
| 5.3 | Proportion of binder incorporated in pavement material | As per Clause 5.3 | 1 per 200 tonnes of plant mixed material |
| 8.2 | Integrity of pavement course, where placed in more than one layer | As per Clause 8.2 | **1 core per 250 m²** |
| 8.3 | Unconfined compressive strength | TfNSW T116 | One pair per 400 tonnes or part thereof |
| **8.4.1** | **Insitu density** | TfNSW T173 | **As per TfNSW Q for specified relative compaction** |
| **8.4.2** | **Maximum wet density** | TfNSW T162 | **As per TfNSW Q for specified relative compaction** |
| **8.4.3** | **Relative compaction** | TfNSW T166 | **As per TfNSW Q for specified relative compaction** |
| **8.4.4** | **Field moisture content** | TfNSW T120, T121 or T180 | **As per TfNSW Q for specified relative compaction** |
| 8.5 | Pavement course thickness | As per Clause 8.5 | At each location as defined in Clause 8.4 |
| 8.7 | Deviation from straight edge | As per Clause 8.7 | Minimum 1 per 20 m² |
| 8.8 | Ride quality | TfNSW T182 or T188 | Continuous reading per Lot |
| 8.9 | Width | As per Clause 8.9 | Minimum of 1 per 20 linear metres |

### 3.2 The row selectors — and why they collapse to one row

**R71 Table R71.1 — Relative Compaction Requirements** (PDF p. 30, doc p. 20). This is R71's analogue of R44 Table R44.7:

| Material Designation (1) | Compaction Type | Compaction Level |
|---|---|---|
| Class 1 DGB in Traffic Category A base course | Modified | **100 %** |
| Class 1 DGB other than in Traffic Category A base course | Standard | **102 %** |
| Material other than Class 1 DGB | Standard | **102 %** |

Note (1): *"Refer to TfNSW 3051 for material designation."*

**R73 cl. 8.4.3** (PDF pp. 35–36, doc p. 21): course ≤ 250 mm thick → characteristic value **≥ 102 %**. Course > 250 mm placed in two layers → **≥ 102 %** for both layers where the lower is measured before the upper is placed; where measured after both are placed, ≥ 102 % at depth "X" **and** an *individual* (not characteristic) value ≥ 95 % for the lower part.

**R75 cl. 7.4.3** (PDF p. 33): course ≤ 250 mm thick → characteristic value **≥ 102 %**. Course > 250 mm → **≥ 100 %** based on wet density measured as close to the bottom of the stabilised course as the probe allows (or at 300 mm max extension), **and** an *individual* value ≥ 95 % for the lower part.

Mapping each onto Table Q6/L.1:

| Spec | Layer / material | Specified relative compaction | Table Q6/L.1 row | Counts used |
|---|---|---|---|---|
| R71 | Class 1 DGB, Traffic Category A base | 100 % (Modified) | *overridden* by R71/L heavy-duty table | **`> 100.0` numbers** |
| R71 | Class 1 DGB, elsewhere | 102 % (Standard) | `> 100.0` | `> 100.0` |
| R71 | Material other than Class 1 DGB (incl. subbase) | 102 % (Standard) | `> 100.0` | `> 100.0` |
| R73 | course ≤ 250 mm | ≥ 102 % | `> 100.0` | `> 100.0` |
| R73 | course > 250 mm, two layers | ≥ 102 % | `> 100.0` | `> 100.0` |
| R75 | course ≤ 250 mm | ≥ 102 % | `> 100.0` | `> 100.0` |
| **R75** | **course > 250 mm** | **≥ 100 %** | **`> 98.0, ≤ 100.0`** | **the only divergent case** |

R71 and R73 therefore need **no user-selected compaction band at all** — the specification fixes the row. R75 needs one bit: is the course thicker than 250 mm?

### 3.3 TfNSW 3051 — the material-supply table (a different lot concept)

3051 owns the *"not areal in nature"* limb of cl. 3.8.3: granular material as supplied, lotted **by mass**, not by area.

**Annexure 3051/L** (PDF p. 42, doc p. 26) preamble:

> "Minimum sampling and testing requirements are shown in Table 3051/L.1. **The maximum Lot size is 4,000 tonnes.**
>
> Where process control has achieved a consistent product as demonstrated by **six consecutive Lots** conforming to specification requirements, or **two consecutive Lots** for permeability testing to AS 1289.6.7.2, the Principal may allow a reduced frequency of testing as specified in Table 3051/L.1."

**Table 3051/L.1 — Minimum Sampling and Testing Requirements.** Values in parentheses are the permitted **reduced** frequency.

*Minimum number of samples to be taken:*

| Total Size of Lot Represented (tonnes) | 1 – 500 | 501 – 1000 | 1001 – 2000 | 2001 – 4000 |
|---|---|---|---|---|
| Minimum Number of Bulk Samples per Lot | 2 | 3 | 4 | 5 |

*Minimum total number of tests to be carried out on each Lot:*

| Property | Test Method | 1–500 | 501–1000 | 1001–2000 | 2001–4000 |
|---|---|---|---|---|---|
| Coarse Particle Distribution | TfNSW T106 | 2 | 3 | 4 | 5 |
| Fine Particle Distribution | TfNSW T107 | 2 | 3 | 4 | 5 |
| Particle Size Distribution | AS 1289.3.6.1 | 2 | 3 | 4 | 5 |
| Permeability – Falling Head Method (i) | AS 1289.6.7.2 | 1 (–) | 1 (–) | 1 (–) | 1 (–) |
| Liquid Limit | TfNSW T108 | 2 (1) | 3 (2) | 4 (2) | 5 (2) |
| Plasticity Index (PI) | TfNSW T109 | 2 (1) | 3 (2) | 4 (2) | 5 (2) |
| Maximum Dry Compressive Strength (ii) | TfNSW T114 | 1 (–) | 1 (–) | 2 (–) | 3 (–) |
| Unconfined Compression Strength | TfNSW T116 | 2 | 3 | 4 | 5 |
| Texas Triaxial Compression Test (ii) | TfNSW T171 | 1 (–) | 1 (–) | 2 (–) | 3 (1) |
| Particle Shape (ii) | TfNSW T213 | 1 (–) | 1 (–) | 2 (1) | 3 (1) |
| Aggregate Wet Strength (iii) | TfNSW T215 | 1 (–) | 1 (–) | 2 (1) | 3 (1) |
| Wet/Dry Strength Variation (iii) | TfNSW T215 | 1 (–) | 1 (–) | 2 (1) | 3 (1) |
| Acid Soluble Sulphate (iv), (v) | TfNSW T219 | 1 (–) | 1 (–) | 1 (–) | 1 |
| Fractured Faces of Coarse Aggregate (ii), (v) | TfNSW T239 | 1 (–) | 1 (–) | 2 (–) | 3 (1) |
| Foreign Materials Content (ii) | TfNSW T276 | 1 (–) | 1 (–) | 2 (1) | 3 (1) |

Notes, transcribed:

> "The number or symbol shown within brackets '( )' in the second part of the table represents the permitted reduced frequency of testing.
> Where the minimum total number of tests for each Lot is the same as the minimum number of samples to be taken, then each test must be done on a different sample.
> Where the reduced rate of testing under Table 3051/L.1 is shown as (–), then, regardless of Lot size, the following minimum frequencies of testing apply:
> (i) for AS 1289.6.7.2 Permeability of a Soil – Falling Head Method: **1 per 8,000 tonnes**
> (ii) for Test Methods TfNSW T114, T171, T213, T239, T276: **1 per 4,000 tonnes**
> (iii) for Test Method TfNSW T215, provided that for the six previous Lots actually tested, all tests have met specification requirements for both Wet Strength and Wet/Dry Strength Variation, then: where all Wet/Dry Strength Variation results are ≤ 25 %: **1 per 10,000 tonnes**; where all Wet/Dry Strength Variation results are ≤ 30 %: **1 per 4,000 tonnes**; in all other cases: **1 per 2,000 tonnes**
> (iv) for Test Method TfNSW T219: where test results are ≤ 0.1 %: **1 per 10,000 tonnes**; where test results are ≤ 0.3 %: **1 per 4,000 tonnes**
> (v) for Test Methods TfNSW T219 and T239, the Principal may grant an exemption to carry out test upon request in accordance with the footnotes for Table 3051.3."

R71 cl. 2.4(h) adds the matching stockpile rule: *"For the purposes of this Specification, the maximum Lot size Certified Stockpiles is 4,000 tonnes."*

### 3.4 Test-method numbering — checked, and consistent

I checked whether R71/R73/R75 (2020–2021) and Q6 Ed 2 (2024) use the same test-method numbers, because a silent renumbering would poison any mapping. They agree. Q6 Annexure Q6/M (PDF p. 49, `-table`): T108 Liquid limit · T109 Plastic limit and PI · T111 Dry density/moisture relationships · T112 same (Modified compaction) · T116 UCS · T117 CBR · T119 Field density (sand replacement) · T120 Moisture content (standard) · T162 Compaction control test (rapid) · T166 Relative compaction · T173 Field wet density (nuclear). Every R-spec citation above resolves correctly against that list. **No inconsistency found** — recorded because the `-layout` extraction of the same list falsely suggested one.

---

## 4. Encodability against the D14 vocabulary

Vocabulary per `docs/plans/d14-q6-pack-spec-2026-07-27.md` §4.3: `FrequencyRule.countByAreaBand = { unit, byScale: Record<scaleKey, AreaBand[]> }`, `AreaBand = { upToInclusive?, minCount, every? }`, combined by the shipped `requiredTestCount(minCount, perQuantity, quantity)` = `max(minCount, ceil(q/every))`.

### 4.1 The seven rules that need no new field

R71 and R73 compaction-family rules (insitu density, maximum wet/dry density, relative compaction, field moisture content — 4 rules on R71, 4 on R73, minus overlap counted per spec) all resolve to the **same** band list, because §3.2 collapses them to Table Q6/L.1's `> 100.0` row:

```ts
// Table Q6/L.1 row "> 100.0" — the only row TfNSW pavement can reach under R71/R73.
// Cross-checked against R71 Annexure R71/L heavy-duty table (PDF p. 42), which
// republishes these five cells verbatim.
unit: 'm2',
bands: [
  { upToInclusive: 50,    minCount: 1 },
  { upToInclusive: 500,   minCount: 3 },
  { upToInclusive: 1000,  minCount: 4 },
  { upToInclusive: 5000,  minCount: 5,  every: 500 },
  {                       minCount: 10, every: 1000 },
]
```

This satisfies every §4.3.1 validation rule: `upToInclusive` strictly ascending, exactly one open band, it is last, all `minCount` integers ≥ 1, all `every` > 0.

**Verdict: ENCODABLE TODAY.** Maps onto existing CIVOS fields with nothing new — `activitySlug` selects the rule, `quantityValue` / `quantityUnit` = m² supplies the area. It needs **no** new lot attribute, and notably **not** the specified-compaction band that the earthworks rule depends on.

### 4.2 The one blocker: `byScale` still demands a scale, even when the answer is constant

This is the real gap, and it is a spec gap rather than a research gap.

`countByAreaBand.byScale` is keyed by scale key and must declare a non-empty band list for **every** `Ruleset.scaleKeys` entry (§4.3.1). The evaluator (§4.3.2) checks `scaleValue == null` **first** and yields `scale_not_selected` → `unknown` before it ever looks at the bands. `tfnsw-q6.v1` deliberately declares **no** `defaultScale` (D14 §5.1, §3.3), because Q6 publishes none for earthworks.

So a pavement rule on `tfnsw-q6.v1` would sit in an awkward spot: its counts do not depend on the band at all, but a lot still cannot evaluate until the user picks one. Declaring all five `scaleKeys` → the same `> 100.0` band list makes the selection *inert but still mandatory* — the user is asked a question whose answer cannot change the number, and the lot reads `unknown` until they answer.

**Two ways out; I recommend the second.**

1. Add `defaultScale: '>100.0%'` to `tfnsw-q6.v1`. **Do not do this** — `defaultScale` is a Ruleset-level field, so it would also silently default *earthworks* lots to the strictest row, inventing a compaction band the user never declared. That is exactly the failure mode the earthworks pass flagged as "under-strict/over-strict in both directions".
2. **Ship pavements as a separate ruleset** (`tfnsw-q6-pavement.v1`) sharing Q6's provenance but declaring `scaleKeys: ['>100.0%']`, `defaultScale: '>100.0%'`, `scaleLabel: 'Specified relative compaction'`. The band is then correct by construction, requires no user input, and the R-spec that fixes it (R71 Table R71.1 / R73 cl. 8.4.3) is recorded as the companion acceptance source — the same pattern D14 §5.1 already uses for R44 Table R44.7. Resolution keys on `activitySlug`, which already distinguishes pavement from earthworks work.

Whichever is chosen, it is a **decision for the D14 spec author, not a research finding**, and I have not assumed one.

### 4.3 R75 — needs one new attribute

R75's row depends on course thickness (≤ 250 mm → 102 % → `> 100.0` row; > 250 mm → 100 % → `> 98.0, ≤ 100.0` row). Those two rows differ only in the top two area bands (`1 per 500 (min 5)` vs `5`; `1 per 1,000 (min 10)` vs `1 per 2,000 (min 6)`), but they differ materially.

**Verdict: ENCODABLE with a named gap.** Two options, cheapest first:
- Ride the existing `testScale` slot with pavement-appropriate keys — `scaleKeys: ['<=250mm', '>250mm']`, `scaleLabel: 'Stabilised course thickness'` — and let `byScale` carry the two band lists. This is exactly the reuse D14 §3.2 argues for (the slot is "the per-lot specification-declared parameter that selects the count row"), and it needs **no migration**.
- Or a new `Lot.courseThicknessMm`. More precise, costs a migration and a form field. Not warranted on current evidence.

**Gap named:** CIVOS has no course-thickness concept today; option 1 borrows a slot rather than closing that gap.

### 4.4 Per-rule verdict table

| # | Rule | Source | Encodable? | How / what's missing |
|---|---|---|---|---|
| 1 | R71 insitu density count | R71/L cl. 8.4.2 → Q6 Table Q6/L.1 `> 100.0` | **Yes** | `countByAreaBand`, m², no new field |
| 2 | R71 maximum wet/dry density count | R71/L cl. 8.4.3 | **Yes** | as #1 |
| 3 | R71 relative compaction count | R71/L cl. 8.4.4 + R71 heavy-duty table | **Yes** | as #1 |
| 4 | R71 field moisture content count | R71/L cl. 8.4.5 | **Yes** | as #1 |
| 5 | R73 compaction family (4 characteristics) | R73/L cl. 8.4.1–8.4.4 | **Yes** | as #1 |
| 6 | R75 compaction family, course ≤ 250 mm | R75/L cl. 7.4.1–7.4.4 + cl. 7.4.3 | **Yes** | as #1, gated on thickness (§4.3) |
| 7 | R75 compaction family, course > 250 mm | as above | **Yes** | `> 98.0, ≤ 100.0` band list; needs thickness attribute |
| 8 | R71 pavement course thickness — 1 per 75 m, min 2 per Lot | R71/L cl. 8.5 | **Partly** | `minCount: 2` + `every: 75` — needs a **linear-metre** `QuantityUnit`; CIVOS has m² |
| 9 | R71/R73/R75 deviation from straight edge — min 1 per 20 m² | R71/L 8.7, R73/L 8.7, R75/L 7.7 | **Yes** | `perQuantity` 1 per 20 m² on existing area |
| 10 | R73 course integrity — 1 core per 250 m² | R73/L cl. 8.2 | **Yes** | `perQuantity` 1 per 250 m²; conditional on multi-layer placement (not modelled) |
| 11 | R71/R73/R75 pavement width — 1 per 20 linear m | R71/L 8.9, R73/L 8.9, R75/L 7.9 | **Partly** | needs linear-metre unit |
| 12 | R71 binder spread rate — 1 per 200 m per spreader run | R71/L cl. 8.3 | **No** | "per spreader run" is a process event CIVOS does not model |
| 13 | R71 binder % — 1 per 200 t; R73 — 1 per 200 t plant mixed | R71/L 8.3, R73/L 5.3 | **Partly** | needs a **tonnes** `QuantityUnit` |
| 14 | R71/R73 UCS — one pair per 400 t | R71/L 8.2, R73/L 8.3 | **Partly** | tonnes unit; "one pair" = 2 tests per 400 t |
| 15 | Water quality — 1 per contract per source | R71/L 3.2, R73/L 3.2, R75/L 3.2 | **No** | contract-scoped, not lot-scoped; outside the per-lot counter |
| 16 | Ride quality — continuous reading per Lot | R71/L 8.8 etc. | **No** | not a count |
| 17 | 3051 material-supply counts | Table 3051/L.1 | **No** (as designed) | tonnes-lotted, **per-property** table (15 properties × 4 mass bands) — a different rule shape from the per-lot counter; plus a genuine `reduced` regime |
| 18 | Q6 lot-size constraints (one shift; < 2 m wide → ≤ 150 m) | Q6 cl. 5.4.2 | **No** | unevaluable in CIVOS today — identical to the earthworks finding (C1 spec §2.5, C2) |

**Tally: 9 Yes / 4 Partly / 5 No.** The 9 unqualified `Yes` rows (1–7, 9, 10) need nothing CIVOS does not already have. The 4 `Partly` rows (8, 11, 13, 14) are blocked only on a new `QuantityUnit` for tonnes and linear metres — a small, well-scoped addition rather than a modelling gap — taking the encodable total to 13 of 18. The 5 `No` rows (12, 15, 16, 17, 18) are genuinely outside the per-lot counter and should stay outside it.

### 4.5 Rules that are correctly ABSENT

- **Multi-layer minimum counts** (Q6 cl. 5.4.3(b) / Table Q6/L.1 note 1): unreachable for pavements — §2.3 proves it from the compaction levels. Do not encode.
- **Non-contiguous lot aggregation** (Q6 cl. 5.4.3(a)): likewise unreachable. Do not encode.
- **A `maxLotSize` area cap for pavements:** **NOT FOUND** in Q6, R71, R73 or R75. Q6 caps by *shift output* and *width/length*, not area. 3051's 4,000 t cap applies to material supply lots, not constructed pavement lots — do not transplant it onto an areal rule.

---

## 5. Corrections to the prior pass

### 5.1 Q6 *does* publish a reduced-frequency regime

The earthworks report's §3 item 7 reads: *"Q6 Ed 2 publishes no reduced-frequency regime for earthworks sampling that I located — **NOT FOUND — correctly absent**."*

**That is wrong.** Q6 cl. 3.8.3 (PDF p. 20) publishes one, with a number: *"You may propose to the Principal a reduced minimum frequency of testing, **by up to 50 %** unless limited otherwise in the relevant specification. Any such proposal must be supported by a statistical analysis verifying consistent process capability and product characteristics."* R71 cl. 1.2.5, R73 and R75 each restate it, and 3051 publishes a fully quantified reduced column (§3.3).

**But the pack's `reduced` limb should still stay absent, for a different and better reason.** The shipped `ReducedFrequencyEligibility` models *self-executing* eligibility — a condition the engine can evaluate (as VicRoads 204.14(c) does). Q6's reduction is **not** self-executing: it requires a contractor proposal, a supporting statistical analysis, and the Principal's approval, and the Principal may revoke it "at any time". Nothing in a CIVOS lot record can establish that those things happened.

**Recommendation:** correct the earthworks report's item 7 from "NOT FOUND — correctly absent" to "**FOUND (Q6 cl. 3.8.3, up to 50 %) — deliberately not encoded, because it is Principal-approved and revocable, not lot-evaluable**." The distinction matters: a future agent reading "NOT FOUND" may go looking again and re-derive it, or worse, encode 3051's quantified reduced column as if it were generally available.

### 5.2 Two spec-name traps, recorded so they are not re-hit

- The `-layout` extraction of Q6's Annexure Q6/M **misaligns spec codes against titles by several rows**, which makes R75 look like "Unbound and Modified Pavement Course". Under `-table` (PDF p. 48) the true mapping is: **R71** = Unbound and Modified Pavement Course · **R73** = Construction of Plant Mixed Heavily Bound Pavement Course · **R75** = Insitu Pavement Stabilisation Using Slow Setting Binders · **R76** = Insitu Pavement Stabilisation Using Foamed Bitumen. Independently confirmed against each document's own cover page. The task brief's guess ("R71 granular base, R75") was right about R71 and wrong about R75.
- Web search returned portal GUID `c8c8199f-6249-ef11-a317-00224811a2ef` under an R71 result heading; downloading it shows it is **TS 03323.1 (3211) Cementitious Materials, Binders and Fillers**, a different specification. Portal GUIDs must be resolved and the cover page read — search result titles are not identity. (This is the same class of error that caused the original R44/Q6 misattribution.)

---

## 6. Named gaps and NOT FOUND items

### 6.1 R76 — NOT FETCHED

TfNSW R76 (Insitu Pavement Stabilisation Using Foamed Bitumen) could not be retrieved. The QA (`IC-QA-R76`) portal record was not located by search or by probing adjacent GUIDs in the R71/R73/R75 block (`…-b635-ed11-9db2-000d3ae019e0`); the two candidate GUIDs I tried returned HTTP 404. The historical `roads-waterways.transport.nsw.gov.au` URL no longer resolves, and the `transport.nsw.gov.au` media path 404s. Only a **D&C R76** record was found ([`1a3837dc-…`](https://standards.transport.nsw.gov.au/_entity/annotation/1a3837dc-b735-ed11-9db2-000d3ae019e0)), which is the Design & Construct variant — a different contract family from Q6 (Major Works), so I did not substitute it.

**Consequence:** foamed-bitumen stabilisation is **out of scope** for the pack until R76 is obtained. Given R71, R73 and R75 all delegate identically, R76 very probably does too — but that is a prediction, not evidence, and it must not be encoded.

### 6.2 3051's currency evidence is weaker than the rest

3051 Ed 7/Rev 1 came from a `transport.nsw.gov.au` media path, **not** the standards portal, so the portal's watermark test does not strictly apply to it (the file carries no watermark, but a non-portal mirror would not necessarily have one). Every other document here is portal-sourced. Since nothing in §4 encodes a 3051 number, this does not affect the pack — but if 3051's table is ever encoded, **re-fetch it from the portal first**.

### 6.3 Gaps in CIVOS, named

1. **`QuantityUnit` has no tonnes and no linear metres.** Four extracted rules (#8, #11, #13, #14) are blocked on this alone. Small, well-scoped addition.
2. **No course-thickness concept**, needed to pick R75's row (§4.3). Workaround via `testScale` costs nothing.
3. **`countByAreaBand.byScale` cannot express "band is fixed by the specification"** (§4.2). This is the one that needs a D14 decision.
4. **Per-property frequency tables** (3051 Table 3051/L.1: 15 properties × 4 mass bands, each with its own reduced value) have no home in a counter that counts tests per lot per activity.
5. **Contract-scoped and process-event-scoped frequencies** ("1 per contract per source", "per spreader run") are outside the lot model entirely, and should stay there.

---

## 7. Evidence-grade honesty note

**Grade A for §2, §3 and §5.** Every number, clause, table cell and page citation above was read from a primary PDF downloaded in this session from `standards.transport.nsw.gov.au` (Q6, R71, R73, R75) or `transport.nsw.gov.au` (3051), extracted locally, and — for every table — re-extracted with `-table` after the default `-layout` mode was caught misaligning columns on Annexure R71/L. Page numbers were confirmed by extracting the individual page and reading it, not by counting form feeds (a form-feed count was wrong by three on Q6). Where a web search offered a fact, I fetched the underlying document and read it: the search claim that R73 is "Ed 2/Rev 3" is wrong (it is **Ed 3/Rev 3, December 2021**), and the search claim that a given GUID served R71 was wrong (§5.2). No secondary source contributed a load-bearing number.

**Three honest limits.**

1. **Currency is behavioural, not absolute** — the same caveat the earthworks pass recorded, and it binds harder here. R71, R75 and 3051 are **June 2020** and R73 is **December 2021**; none carries a `SUPERSEDED` watermark, which is good evidence, but the portal exposes documents through opaque GUIDs with no stable per-document page, so I cannot prove from a URL that no newer revision exists. These four are also pre-`TS`-migration documents (§1.2), which makes them *more* likely than Q6 to be re-issued. A human should confirm against the portal's document listing before any of this blocks a claim.
2. **R76 is missing** (§6.1), so "TfNSW pavements" in the pack means *unbound/modified, plant-mixed heavily bound, and slow-setting-binder insitu stabilisation* — not foamed bitumen. The pack's scope note must say so.
3. **The `> 100.0`-row collapse is a derivation, not a transcription.** Table Q6/L.1 and Table R71.1 are transcribed; the *conclusion* that every R71/R73 pavement lot lands on the `> 100.0` row is my reasoning across the two. It is strongly corroborated — R71's heavy-duty table independently republishes that row's five cells verbatim — but it is an inference, and §14-style acceptance tests should pin it directly (e.g. a 3,000 m² Class 1 DGB subbase lot requires **5** tests; a 6,000 m² one requires **10**, not 6) so that a future edition change breaks a test rather than passing silently.

**What this does and does not license.** A pavements extension of `tfnsw-q6.v1` built from §2, §3.2 and §4.1 would qualify on evidence grade for `confirmed` under the C1 spec §8.3 rule (`evidenceGrade === 'A'`). The remaining blocker is **not research** — it is the §4.2 scale-selection decision, which is the D14 author's call.

---

## Sources

Primary documents, all read in full in this session:

- [TfNSW QA Specification Q6 — Quality Management (Major Works), Ed 2/Rev 0, February 2024 (TS 01572.1 / IC-QA-Q6)](https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b) — cl. 3.8.3 (p. 20), cl. 5.4 (pp. 31–32), Annexure Q6/L (pp. 42–44), Annexure Q6/M (pp. 48–49)
- [TfNSW QA Specification R71 — Construction of Unbound and Modified Pavement Course, Ed 5/Rev 1, June 2020](https://standards.transport.nsw.gov.au/_entity/annotation/b5ef3024-b635-ed11-9db2-000d3ae019e0) — cl. 1.2.5 (p. 12), Table R71.1 (p. 30), Annexure R71/L (pp. 41–42)
- [TfNSW QA Specification R73 — Plant Mixed Heavily Bound Pavement Course, Ed 3/Rev 3, December 2021](https://standards.transport.nsw.gov.au/_entity/annotation/6352092b-b635-ed11-9db2-000d3ae019e0) — cl. 8.4.3 (pp. 35–36), Annexure R73/L (p. 46)
- [TfNSW QA Specification R75 — Insitu Pavement Stabilisation Using Slow Setting Binders, Ed 3/Rev 1, June 2020](https://standards.transport.nsw.gov.au/_entity/annotation/6452092b-b635-ed11-9db2-000d3ae019e0) — cl. 7.4.3 (p. 33), Annexure R75/L (p. 46)
- [TfNSW QA Specification 3051 — Granular Pavement Base and Subbase Materials, Ed 7/Rev 1, June 2020](https://www.transport.nsw.gov.au/system/files/media/documents/2023/tfnsw-specification-3051-granular-base-and-subbase-materials-for-surfaced-road-pavements.pdf) — Annexure 3051/L, Table 3051/L.1 (p. 42) — **non-portal source, see §6.2**

Identified but not used:

- [TfNSW Specification D&C R76 — Insitu Pavement Stabilisation Using Foamed Bitumen](https://standards.transport.nsw.gov.au/_entity/annotation/1a3837dc-b735-ed11-9db2-000d3ae019e0) — D&C variant, wrong contract family for Q6 Major Works (§6.1)

In-repo context read first:

- `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` (earthworks pass — corrected at §5.1)
- `docs/plans/d14-q6-pack-spec-2026-07-27.md` §4.3, §4.4, §5 (rule vocabulary)

Working files (session scratchpad, **not durable** — re-fetch from the URLs above rather than relying on these):
`q6-fresh.pdf`/`.txt`, `r71b.pdf`/`.txt`, `r73.pdf`/`.txt`, `r75.pdf`/`.txt`, `s3051.pdf`/`.txt` in
`C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3--claude-worktrees-wave1-lotbreakdown\eb519d0e-493c-4bcc-b7f7-41fdef8e1077\scratchpad\`
