# RG-2 / RG-7 research pass — how AU road authorities express surface and level tolerance

**Date of pass:** 2026-07-31
**Researcher:** subagent `rg-tolerance`, at Jay's direction, resolving research gaps **RG-2** (and
opportunistically **RG-7**) of `docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §3.1.
**Blocks:** RG-2 blocks **C5.4**; the answer also determines the shape of **C5.5**'s design-vs-as-built
comparison model. RG-7 blocks **C5.2's state names** (pilot gate `[C5S-B4]`).

**Verdict up front:** **per-point rows, with lot-level aggregates computed from them.** Every authority
read expresses tolerance as a **per-point deviation from a design value**, and the conformance decision
is made at the **Lot**. Two of the three jurisdictions additionally impose a **statistical** limb over the
same points (VIC: mean *and* standard deviation of departures; QLD: a lot-average tolerance alongside
the individual-result tolerance). NSW imposes no statistical limb on level at all. **A model that stores
only lot-level summaries cannot represent any of the three; a model that stores per-point rows can
represent all three, because every lot-level figure in every spec read is derived from the points.**

---

## 0. How to read this document

Grades follow the program §10 scale: **A** primary authority/specification/legal; **B** official
vendor/competitor documentation; **C** customer or independent secondary; **D** marketing/directional.

Per the spec's own rule for RG-2 (`§3.1`, RG-2 row: *"Nothing below A is admissible"*), **every
load-bearing claim in §2–§4 below is grade A** — read out of the authority's own published document,
downloaded from the authority's own domain, with currency evidence recorded. Where I could only reach a
document through a non-authority channel, it is graded **B** and marked, and **nothing structural rests
on it**.

**Copyright.** TfNSW and DTP (VicRoads) assert copyright and the documents carry use restrictions.
Nothing here reproduces spec prose wholesale. Clause and table numbers, the *structure* of tolerance
tables, and the numeric tolerance values (which are facts, and are what CIVOS would have to model) are
recorded; narrative prose is paraphrased or given as short attributed fragments only. **TMR MRTS04 and
MRTS56 are published under CC BY 4.0** and carry no such restriction.

**Consistency with prior passes.** `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md` and
`docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` established the current editions of
VicRoads Section 204 and TfNSW R44/Q6 on 2026-07-27. **This pass re-verified both independently and
found no contradiction** — see §6.

---

## 1. Documents read, and the currency evidence for each

| # | Document | Identity | Edition / date | Source (all fetched or re-verified 2026-07-31) | Currency evidence | Grade |
|---|---|---|---|---|---|---|
| 1 | **VicRoads / DTP Section 204 — Earthworks** | — | **v8.0, November 2025** | `https://content.vic.gov.au/Section-204-Earthworks-v8.docx` | **Re-downloaded fresh today, HTTP 200, 123,994 bytes.** Version string `v8.0` present in body. Matches the C1 pass's edition finding exactly. | **A** |
| 2 | **VicRoads Section 173 — Examination and Testing of Materials and Work (Roadworks)** | — | **© VicRoads October 2008** (v4 per the DTP index) | Authority copy **NOT REACHED** — `webapps.vicroads.vic.gov.au` does not resolve from this machine (`ENOTFOUND`), and `content.vic.gov.au` returns 404 for every Section-173 URL pattern tried. Text read from a **council reproduction**: `https://www.wyndham.vic.gov.au/sites/default/files/2021-11/Technical%20Specification%20Section%20173%20-%20Examination%20and%20Testing%20of%20Materials%20and%20Work%20(Roadworks).pdf` | Page footers carry `© VicRoads October 2008 / Section 173 (Page n of 4)`, matching the DTP index entry (`1/10/2008`, version 4). But this is a **council republication**, not the authority's own copy. | **B** — see §5.2 |
| 3 | **TfNSW QA Specification R44 — Earthworks** | `TS 02158.1` / `IC-QA-R44` | **Ed 6 / Rev 0, June 2023** | `https://standards.transport.nsw.gov.au/_entity/annotation/bf827ada-5615-ee11-9cbd-002248e414c7` | **Re-downloaded fresh today**, 1,746,664 bytes. **Zero `SUPERSEDED` hits** in the text layer. (The portal burns a `SUPERSEDED` watermark into retired editions' text layer — demonstrated by the C1 pass.) Same edition as the C1 pass found. | **A** |
| 4 | **TfNSW QA Specification G71 — Construction Surveys** | `IC-QA-G71` | **Ed 2 / Rev 4** | `https://standards.transport.nsw.gov.au/_entity/annotation/a61076d5-af35-ed11-9db2-000d3ae019e0` | **Downloaded fresh today**, 551,073 bytes. Zero `SUPERSEDED` watermark hits (the one `superseded` string in the file is body text about retaining superseded copies of a mark register, at cl. 3.3.1 — not a watermark, and it appears once, not on every page). | **A** |
| 5 | **TfNSW QA Specification R71 — Construction of Unbound and Modified Pavement Course** | `IC-QA-R71` | **Ed 5 / Rev 1** | TfNSW standards portal (PDF present in this session's shared scratchpad from a sibling research pass; **I did not re-fetch it from the portal myself**) | Zero `SUPERSEDED` watermark hits — the same currency heuristic the C1 pass established. **But I did not independently re-resolve its portal record**, so the *channel* is weaker than #3/#4. | **A for the text; currency B** — see §5.3 |
| 6 | **TMR MRTS04 — General Earthworks** | — | **March 2025** | `https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/3-Roadworks-Drainage-Culverts-and-Geotechnical/MRTS04.pdf` | **Downloaded fresh today**, 2,763,810 bytes, from the *current* (non-`Superseded-Specifications`) path. Cover reads `March 2025`. TMR files superseded editions under a distinct `/Superseded-Specifications/` path, so the path itself is currency evidence. | **A** |
| 7 | **TMR MRTS56 — Construction Surveying** | — | **March 2022** | `https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/1-Overarching-Specifications/MRTS56.pdf?la=en` | **Downloaded fresh today**, 1,430,113 bytes, from the current (non-superseded) path. Cover reads `March 2022`. | **A** |

**Not read** (named in the brief, not reached — see §7): SA DIT Master Specification; IPWEA / council
standards beyond the Wyndham reproduction of #2; TMR MRTS05 Unbound Pavements (not in the category path
tried; MRTS56 §10.2 confirms it is the governing pavement-geometry spec).

**A note on `curl` from this machine.** `tmr.qld.gov.au` returns **403 to a default `curl` user-agent**
and 200 with a browser UA; `webapps.vicroads.vic.gov.au` does not resolve at all. Both are environment
facts, not evidence about the documents. Recorded so the next agent does not read a 403 as "withdrawn".

---

## 2. RG-2 — the findings, by authority

### 2.1 Victoria — VicRoads/DTP Section 204 v8.0 (grade A)

The tolerance clause is **cl. 204.03**, and its title is the first finding: **"CONFORMITY WITH
DRAWINGS"**. Level conformity in Victoria is framed as *agreement with the drawing*, not as a survey
deliverable (see §3.1).

Clause 204.03 has eleven sub-clauses (a)–(k), and **they do not share one tolerance form**. Three
distinct forms coexist inside a single clause:

**Form 1 — per-point absolute, asymmetric one-sided pair.** A measured point must not differ from the
specified level by more than X above *or* Y below, with X ≠ Y:

| Sub-clause | Dimension measured | Tolerance form | Value |
|---|---|---|---|
| 204.03(e) | Type B material immediately below capping/selected material | per-point, asymmetric pair | **+15 mm / −30 mm** |
| 204.03(f) | Cut Floor Level immediately below capping/selected material | per-point, asymmetric pair | **+15 mm / −30 mm** |
| 204.03(g) | Subgrade, **where Scale C is nominated** | per-point, asymmetric pair | **+10 mm / −30 mm** |
| 204.03(b) | Surface outside paved areas, before and after topsoil | per-point, **symmetric** | **±50 mm** |
| 204.03(k) | Surface drain invert levels and side slopes | per-point, symmetric | **±50 mm** |
| 204.03(c) | Boxing edge offset from centreline/design line | per-point, symmetric, **horizontal** | **±50 mm** |

Both (e) and (f) carry an explicit escape: *unless assessment by random levelling is specified*, in which
case Form 3 applies instead. **The same physical surface can be judged by either form depending on what
the project schedule nominates.**

**Form 2 — one-sided minimum / "not less than".** No upper bound at all:

| Sub-clause | Dimension | Form |
|---|---|---|
| 204.03(a) | Formation width to tops/toes of batters | **not less than** specified |
| 204.03(d) | Type A material thickness, width and shape | **not less than** specified, **at any point** |

**Form 3 — statistical, over the lot.** This is the form that matters most for C5.5. Clause 204.03(h),
*Random Level Assessment*: measurements are taken at **random locations over the area of the lot**, the
count per lot must not be less than Table 204.031's minimum, and **the mean and standard deviation of
the departures from the theoretical surface level within each lot** must meet Table 204.031.

**Table 204.031 — structure and values (three columns, two rows):**

| Scale of Surface Level Measurement | Minimum number of measurements per Lot | Tolerance: x̄ range (mm) | Tolerance: maximum S (mm) |
|---|---|---|---|
| **Scale A** | **80** | **+5 to −15** | **12** |
| **Scale B** | **40** | **+5 to −25** | **15** |

Table notes, per the document: x̄ is the mean of all level readings in the lot; S is the standard
deviation of all level readings in the lot; **negative = measured departure below design level, positive
= above**.

Three structural facts fall out of this table and are the load-bearing ones:

1. **The conformance unit is the Lot**, and the lot is size-capped for this purpose: random level
   assessment *"shall be undertaken in lots not exceeding 4000 m²"* (cl. 204.03(h)).
2. **There is no per-point acceptance limit under Scale A or B for the surface itself.** A single point
   at −40 mm does not fail the lot; it moves x̄ and S. Conformance is a property of the *distribution*,
   not of any point. (One per-point limit still applies in parallel — the straightedge, Form 4 below.)
3. **The mean has a *range*, not a maximum.** x̄ must fall between +5 and −15 mm (Scale A). Being too
   *high* on average fails, as does being too low. This is not a one-sided "±" and cannot be stored as
   a single magnitude.

**Form 4 — relative / local shape, per-point, one-sided.** Independent of Forms 1–3 and applied on top
of them: no point on the subgrade may lie more than **20 mm below a 3 m straightedge** laid in any
direction (except across a crown), and no point outside paved areas more than **25 mm below a 3 m
straightedge**. This measures *shape against a local datum*, not deviation from design. **A design-vs-
as-built comparison cannot produce it** — it needs the neighbouring points, not the design surface.

**Form 5 — proportional.** Cl. 204.03(j): cut batter points and fill batter toes not more than **10% of
the batter height** outside the calculated batter line; batter rounding dimensions within **10%** of
drawing dimensions — with an absolute override of **300 mm** under bridges and in constrained sections.
A tolerance whose value is a function of another measured dimension.

**Form 6 — non-numeric.** Repeatedly, and always alongside a numeric limit: the surface must be *free
from depressions capable of retaining water*; *water shall not pond at any point* (cl. 204.03(b), (g),
(k)). A conformance criterion with no number, that a level dataset alone does not decide.

**Which form applies is a project-schedule selection, by road class.** Clause 204.16, Table 204.161,
assigns a Scale of Surface Level Measurement per road: **Freeway M → A, Arterial A → A, Arterial B → B,
Arterial C → C**, with the note *where no level of testing is nominated, Scale A applies* (also stated
at cl. 204.03(g)). So the same subgrade is judged statistically (A/B) or per-point (C) purely by what
the contract schedules.

### 2.2 Victoria — Section 173 (grade B channel; see §5.2)

Section 173 is the method spec that 204.03(h) invokes by name. It supplies the definitions the tolerance
clause assumes:

- **cl. 173.02 Lot Testing** — the lot is *a single layer, batch or area of like work* constructed under
  essentially uniform conditions and essentially homogeneous in material and appearance; **the extent of
  each lot shall not exceed one day's production** unless otherwise specified. Non-homogeneous portions
  are excluded and treated as separate lots or reworked — and **where excluded areas exceed 10% of the
  total lot area, the whole lot is rejected**. A lot is therefore a *judged* grouping, not a geometric
  one, and it has a rejection rule of its own before any measurement is considered.
- **cl. 173.05 Random level measurement procedure** — measurement instrument accuracy **±3 mm per 50 m
  of reading distance**, levels recorded to the **nearest 1 mm**; the per-point departure is defined as
  **xᵢ = measured level − design level (mm)**; the mean of departures is determined to the **nearest
  0.1 mm**; S is the standard deviation of the xᵢ. This is the explicit reduction: **per-point
  deviations in, two lot statistics out.**
- **cl. 173.06 Non-random level measurement procedure** (Scale C, and where a non-random method is
  permitted) — a **fixed-interval grid**, not random sampling: longitudinally at intervals **not
  exceeding 20 m**, plus at **all changes in gradient**, at **edges** and at **designated lane lines**,
  and transversely at intervals **not exceeding 2 m**.

So Victoria has **two different sampling regimes** for the same dimension — random (statistical
acceptance) and fixed-interval (per-point acceptance) — and which one applies is the Scale nomination.

### 2.3 New South Wales — TfNSW R44 Ed 6/Rev 0 (grade A)

**Clause 7.7.1, Table R44.8 — "Level Tolerances".** The structure is: **one row per named surface, one
asymmetric `+X mm / −Y mm` per-point pair.** There is **no sample count, no statistic, no lot-area
banding, and no percentile** anywhere in the table. Rows cover: Designed Floor Level in cutting before
each foundation treatment type (C1, C3(I), C4); Foundation Level in cutting before treatment types C2,
C3(II), C5 (drainage layer, split rock cutting / other than rock cutting); Foundation Level at Shallow
Embankment and Cut/Fill Transition Zone; floor of benches in cutting; top of formation at underside of
Selected Material Zone (split: underlying drainage layer in a cutting / all other cases); top of lower
layer of Selected Material Zone; top of upper 150 mm layer of SMZ (or top of formation where there is
no SMZ); surface of verges.

**The distinct tolerance values in the table are:** `+10/−40`, `+0/−40`, `+10/−150`, `+50/−150`,
`+50/−50`, `+20/−40`, `+0/−20`.

> **Caveat, stated rather than papered over.** In the `pdftotext -layout` text layer, Table R44.8's
> tolerance column renders **offset by roughly one row** from its location column, so **I cannot certify
> the exact location→value pairing for every row from the text extraction.** What *is* certain, and what
> this document relies on: the **set of location rows**, the **set of tolerance values**, and — the only
> structurally load-bearing fact — that **every row is a per-point asymmetric `+X/−Y` pair with no
> statistical limb**. Anyone encoding individual R44 rows must read the rendered PDF page (doc p. 54),
> not a text extraction.

**How often, and over what unit?** Not in Table R44.8 — in **Annexure R44/L, Table R44/L.1** ("Control
of Earthworks Process"). There, rows whose test type is **`Survey`** carry a "Minimum Frequency" that is
a **geometric feature, not a count**: `Each section`, `Each batter`, `Each bench`, `Each area`,
`Each Lot` — with the acceptance criterion cell pointing at **`Table R44.8`** (or `Table R44.9` for
batter dimensions). This contrasts sharply, *in the same table*, with the **compaction** rows, whose
Minimum Frequency cell is the single character **`Q`** — a pointer to Specification TfNSW Q, where the
frequency is an area-banded sample count and the acceptance criterion is a *characteristic value*
statistic (established at grade A by the C1 pass: Q6 Ed 2/Rev 0 Annexure Q6/L, Table Q6/L.1 and
Table Q6/L.3).

**This is the single sharpest structural finding of the pass:** *inside one authority's one annexure,
level/geometry is per-feature and per-point, while compaction is per-area and statistical.* Tolerance
shape is a property of **the dimension measured**, not of the authority.

**An acceptance path that is not pass/fail.** Cl. 7.7.2: where the overlying pavement is not part of the
Contract and the top of the SMZ is below the −20 mm lower limit but not above the +0 mm upper limit, the
work **may be accepted by the Principal** subject to (a) **deductions at the rate in Annexure R44/A4 for
the volume outside the lower limit**, and (b) the Principal accepting the contractor's method of
determining that volume **by survey and calculation**. So a level nonconformity can resolve to a
**priced volume**, not a rejection — and the quantity that prices it is derived from the survey.

### 2.4 New South Wales — TfNSW G71 Ed 2/Rev 4, Construction Surveys (grade A)

**This is the document that answers RG-2 most directly, and it was not in the spec's list of expected
sources.** It is the cross-cutting survey specification that R44 cl. 1.6.1 and R71 both defer to.

**Clause 5.6.5 — Survey Report.** Paraphrasing closely: a Survey Report must be submitted **for each Lot
or component** where design levels, position and/or tolerances have been specified. The report **must
show the actual value versus the specified value** for **position** (defined *either* by grid
coordinates *or* by chainage and offset) **and level, and the applicable tolerance**. It must be
**certified by the Surveyor** responsible for the verification survey, and must **highlight any results
that are outside of tolerance (nonconformities)**.

**That clause is, in effect, a published row schema.** Read as a data model, a conformance-survey record
row is:

| Field | Per G71 cl. 5.6.5 |
|---|---|
| Position | grid Easting/Northing **or** chainage + offset (the spec permits either — so a model must carry both, or carry which one is in use) |
| Design/specified value | required |
| Actual measured value | required |
| Applicable tolerance | required, **carried on the row** |
| Verdict | derived; nonconformities must be **highlighted** |
| Scope | **per Lot or component** |
| Attribution | **certified by the named Surveyor** |

**Clause 5.6.4 — a lot-level aggregate computed from the points.** For pavement thickness: *calculate
the mean thickness for each Lot using all results for the Lot*. Thickness itself is derived by comparing
**two surveyed points on top of each other within a 0.5 m tolerance**, taking the level difference, and
**adjusting for design longitudinal and transverse slope between the two points**. An alternative —
comparing points to **triangulated surfaces** — is permitted with the Principal's prior approval of the
methodology. So: **point pairs → adjusted per-point thickness → lot mean**, and the authority explicitly
contemplates a **point-to-TIN-surface** comparison as the alternative method.

**Clause 5.6.2 — sampling must be independent and unbiased.** Sampling for conformity verification must
**not** be restricted to the locations used to set out the works; take enough points *to provide a valid
representation of the product's spatial qualities*. Cl. 5.6.1 adds that conformity survey methods must
be **independent of the set-out methods**, measuring from survey control marks where possible.

**Clause 5.6.3 — timing.** For bound pavement layers, concrete subbase and concrete base: not later than
**one working day after the pavement Lot has become accessible for survey**, unless the Principal
agrees otherwise. A survey record therefore has a *deadline relative to a lot event*, which is a real
workflow fact for C5.2.

**Clause 5.3.3 + Tables G71.9/G71.10 — the sampling grid is fully specified.** Sampling points come from
a **grid**: strings running approximately parallel to the pavement centreline, points spaced along each
string at the "Sampling Plan Chainage Difference" from Table G71.9, with the **number of strings set by
pavement width** (Table G71.10):

| Pavement width W | Number of strings |
|---|---|
| W ≤ 1.5 m | 1 |
| 1.5 m < W ≤ 6.0 m | 2 |
| 6.0 m < W ≤ 11.0 m | 3 |
| 11.0 m < W ≤ 16.0 m | 4 |
| each additional 5 m (or part) above 16.0 m | +1 |

with a **maximum 5 m between strings**, outer strings placed **0.5–1.0 m from each pavement edge**, and
sampling points selected **to within 0.7 m** of the computed location with **actual field coordinates
determined by survey**. (That last point matters: the *planned* location and the *as-measured* location
are different values, and the spec expects both to exist.)

**Table G71.9** ties Order of Accuracy, allowable survey-control differences, allowable common-point
difference between abutting surveys, and sampling chainage interval to each surface:

| Surface | Orders of accuracy (Hz/Vt) | Common points difference | Sampling chainage difference | Reference spec |
|---|---|---|---|---|
| Cut floor surface | 3H / 5V | N.A. | 10 m | — |
| Earthworks other than SMZ; Selected Material Zone | 3H / 4V | 10 mm | 10 m | R44 |
| Unbound and modified subbase and base | 3H / 3V | 5 mm | 10 m | R71 |
| Heavily bound subbase and base | 3H / 3V | 5 mm | 5 m | R73, R75 |
| Plain or reinforced concrete subbase and base | 3H / 2V | 5 mm | 5 m | R81/R82/R83 |

Orders of accuracy resolve to numbers in Tables G71.3/G71.4, all expressed as **local uncertainty at the
95% confidence level relative to adjacent survey control marks** — horizontal 1H…5H = 5, 12, 25, 125,
500 mm; vertical 1V…6V = 0.7, 1.5, 3, 6, 20, 100 mm. So **an as-built point carries a stated
uncertainty, and the uncertainty is a function of which surface it is on.**

**Clause 5.1.3(b) — batters are compared perpendicular to a plane, not vertically.** For batter planes,
cross-sections normal to the edge of formation at **10–15 m** spacing, at least one point ≥1 m from the
top and one ≥1 m from the bottom (to negate rounding), with additional points by slope distance
(Table G71.7). And explicitly: *the Survey Report must show the distance between the design and actual
positions measured **perpendicularly to the design batter plane*** unless otherwise specified. **The
deviation axis is not always vertical.**

**Clauses 2.4.2–2.4.3, 2.6.x — provenance (bears on RG-4, not RG-2).** Total stations must meet stated
error standard deviations (**< 5 mm ± 5 ppm** distance; **< 3″** angular), must be calibrated per
Surveyor General's Directions No. 5 before use and after any repair/service/**firmware upgrade**, and
must hold a **current calibration certificate recorded in an equipment register**. Conformity
verification field book pages must be **labelled, dated, signed by the Surveyor, and cross-indexed to
the equipment used and to Lot/component identification**; where automatic data recording is used, **both
raw (field) and reduced data** must be retained. Survey reports must carry the **Surveyor's name, date
and signature** and reference **field book page numbers**. The surveyor must maintain a **register of
Nonconformity Reports** raised on conformity survey work (cl. 2.6.8).

### 2.5 New South Wales — TfNSW R71 Ed 5/Rev 1 (text grade A, currency grade B — §5.3)

R71 shows what the pavement-course case looks like, and it is materially different from R44's:

- **Cl. 8.1** states the unit without ambiguity: *each **Lot** must comply*; nonconforming lots are dealt
  with under cl. 8.12.
- **Cl. 8.6 Surface Levels** — per-point, one-sided, and **the sign flips between layers**: base course
  **−0 mm / +10 mm**; subbase course **−10 mm / +0 mm**. (A model cannot assume "tolerance" means a
  symmetric band, nor that the permissive direction is consistent within one spec.)
- **Cl. 8.7 Surface Deviation** — **5 mm** under a 3 m straightedge laid in any direction, plus a
  non-numeric criterion: no abrupt change of levels at transitions to fixed structures such as a bridge
  deck, and no adverse changes affecting surface drainage.
- **Cl. 8.8 Ride Quality** — a **third conformance unit**: NAASRA roughness over a **100 m survey
  interval** (measured per TfNSW T182, or a laser profilometer per T188), where a value below 65
  counts/km (≈ IRI 2.5 m/km) means the pavement *for that length* may be accepted, **with incentives or
  deductions per Annexure R71/B2**. Neither a point nor a lot — a *linear interval* — and the outcome is
  a **payment adjustment**, not a binary verdict.
- **Cl. 7.3** — where design finished surface levels are specified, submit **a schedule of the pavement
  course finished surface levels for each Lot within 6 working days of completion of final trimming**,
  and **highlight in the schedule all levels which are nonconforming**. The contractor self-declares
  nonconforming points inside a per-lot schedule.
- **Cl. 7.2** — before work: submit a **schedule of levels of the underlying surface** at least 7 working
  days before programmed commencement, **highlighting all locations where actual levels are higher than
  design levels**. The Principal may then **redesign the pavement finished levels** and must advise
  within 5 working days. This one is a **HOLD POINT** (process held: placement of pavement course).
  *Design is not immutable — an as-built survey can cause the design to change.*
- **Cl. 7.4** — thickness: a per-lot schedule within 6 working days; survey point locations selected
  **on a random basis**; levels for thickness determined to an accuracy of **±5 mm**, with each survey
  point's location **recoverable in the horizontal plane to within ±50 mm**.

### 2.6 Queensland — TMR MRTS04, March 2025 (grade A, CC BY 4.0)

MRTS04 puts both limbs in **one table**, which is the clearest single illustration of the RG-2 answer.

**Clause 6.3.1 Primary vertical tolerances**, prefaced by: heights measured **anywhere on a layer
surface** must not vary from drawing/derived values by more than Table 6.3.1, and — decisively —
***"Average tolerances shall apply to the results for a completed Lot."***

**Table 6.3.1 — structure: one row per location, one symmetric `±` value, and *two rows for the same
surface* distinguished by whether the value is an individual result or the lot average:**

| Location | Tolerance (mm) |
|---|---|
| **Subgrade Level (individual results)** | **± 25** |
| **Subgrade Level (average)** | **± 10** |
| Top of Embankment, other than Subgrade Level | ± 50 |
| Top of insitu material below Subgrade (in cuttings other than rock) | ± 25 |
| Top of insitu material below Subgrade in cuttings that cannot be trimmed with a grader (cl. 18.3.3.1) | **+ 25 / − 75** |
| Top of high permeability Drainage Layer | ± 15 |
| Inverts of drains | ± 40 |
| Top of benches and berms | ± 35 |
| Other interfaces between earthworks materials | ± 50 |

> **Caveat.** As with Table R44.8, several rows in the middle of this table (Top of Rock Fill; Top of
> insitu material below Subgrade in rock cuttings; Top of verge, which carries a *"provided the verge is
> free draining"* qualifier) render with **misaligned columns** in the text layer, and I do not certify
> their individual values. The two rows this document actually relies on — **Subgrade Level (individual
> results) ± 25** and **Subgrade Level (average) ± 10** — sit at the top of the table, are unambiguous
> in the extraction, and are corroborated by independent secondary summaries. The `+25/−75` row is
> reported because it is the only asymmetric entry and is clearly paired with its own clause reference.

**Clause 6.2 Horizontal tolerances** — the horizontal location of **any point** on a surface or
interface between material types must not differ from the drawing/derived point by more than **± 50 mm**,
except **edges not adjacent to a structure: −50 mm / +250 mm**, where the + direction is the one that
*increases* the width of the earthworks. (Asymmetric *and* directionally defined in terms of a physical
consequence, not a sign convention.)

**Clause 6.3.2 Additional tolerances** — the gap beneath a **3 m straight-edge placed anywhere** on the
surface at Subgrade Level must not exceed **25 mm**, *due allowance being made for design shape where
relevant*; and all embankments, subgrade, benches, berms and drains **must not pond water and must be
free draining**. Same Form 4 and Form 6 as Victoria, at different values.

**Clause 5.5 Conformance requirements** — three different conformance units named in five lines:

| Property | Conformance unit and form |
|---|---|
| Geometrics (cl. 5.5.1) | per Clause 6 → **per-point** *and* **lot-average** |
| Compaction (cl. 5.5.2) | **characteristic value** (min or max) of the Lot's results, per Test Method **Q020** |
| Moisture content (cl. 5.5.2) | assessed using **individual values** |

**Clause 5.6** — maximum **Lot sizes** and minimum testing frequencies live in **Appendix A, Tables A.1
(source/stockpile) and A.2 (construction)**. Note the split: the lot-size cap is a *contractual/table*
value, not a geometric derivation.

### 2.7 Queensland — TMR MRTS56, March 2022 (grade A, CC BY 4.0)

QLD's G71 analogue. Two clauses matter here:

- **Clause 10 "Compliance / conformance testing"** does **not** define tolerances. It **delegates**:
  earthworks/subgrade geometry → MRTS04 and MRTS07A (cl. 10.1); pavement layers → MRTS05, MRTS07B/C,
  MRTS08/09/10, MRTS30, MRTS32, MRTS39, MRTS40 (cl. 10.2). The survey spec owns *method and accuracy*;
  the material spec owns *the tolerance*. Same division as NSW (G71 method / R44+R71 tolerance).
- **Clause 11 "As Constructed Survey"** defines a distinct named deliverable — detailed site survey
  measurements providing *an accurate geospatial record and validation compliance of completed works*,
  explicitly framed as feeding a **3D object model / BIM**. **Cl. 11.1: as a condition precedent to the
  issue of the Certificate of Practical Completion**, the contractor must provide the Administrator with
  the As Constructed Survey deliverables.

**Table 11.2** specifies, per earthworks element, a **methodology** and an **accuracy** — and the
methodology is a *sampling geometry*, not a count:

| Element (cl.) | Methodology (structure) | Accuracy Hz & Vt |
|---|---|---|
| Top of embankment incl. batters, prior to subgrade (11.2.5) | all edges and interfaces; **10 m × 10 m grid minimum**; sufficient point density to give shape to interpolated average accuracy ±25 mm | ± 25 mm |
| Top of subgrade (11.2.6) | **10 m cross sections minimum**, including bottom of batters, the crown, longitudinal breaklines, changes in grade, and crests/dips in vertical curve geometry | ± 10 mm |
| Bottom of excavations for channels and drains (11.2.7) | full width, **minimum 10 m intervals** and at changes in direction (horizontal and vertical) | ± 25 mm |
| Top of every pavement layer (11.3.1) | **10 m cross sections minimum** | ± 10 mm |

Table footnote, verbatim in substance: ***accuracies are stated in terms of 'relative uncertainty' at
95% confidence level*** — the same statistical framing as G71's Orders of Accuracy.

> **Caveat.** Table 11.2's row/value alignment is also degraded in the text layer (the 11.2.6 row's
> methodology cell renders adjacent to 11.2.7's). The **structure** — methodology expressed as a
> sampling geometry, accuracy as a ±mm relative uncertainty at 95% CL, one row per element — is certain
> and is what this document relies on. Individual element values should be re-read from the rendered PDF
> before encoding.

---

## 3. RG-7 — is "survey acceptance" a distinct contractual act?

The brief asked this opportunistically. **The sources answered it clearly, and the answer is: it depends
on the jurisdiction, and CIVOS must not assume a single universal act.** Grade A throughout (all three
findings are read out of primary documents).

### 3.1 Victoria — no, and it is not even a survey

**VicRoads Section 204 v8.0 contains the string "survey" exactly zero times.** I verified this on the
freshly downloaded v8.0 `.docx` today: `survey count: 0` over the full stripped document body. The
clause that governs level conformity is titled **"CONFORMITY WITH DRAWINGS"**, and the acceptance
machinery is *lot testing* under Section 173 — the same machinery as compaction and material properties.
Section 204 does have hold points (marked `HP` in the text) for material classification, for presenting
rock subgrade to the Superintendent for acceptance, for groundwater/unsuitable-material treatments, and
for placing fill — **but none of them is a survey or level submission**, and the only clause requiring a
named procedural hold point is **test rolling** (cl. 204.13, requiring the contractor's quality plan to
include test rolling as a hold point with the Superintendent present).

**In Victoria, level conformance is a lot test result, not a survey deliverable, and there is no
"survey accepted" act to model.**

### 3.2 New South Wales — yes, and it is a HOLD POINT

**G71 cl. 5.6.6** is unambiguous:

- **Process held:** covering up of work subject to a conformity verification survey.
- **Submission details:** Survey Report verifying conformity.
- **Release:** the Principal will consider the submitted documents prior to authorising release.

So the certified per-Lot Survey Report of cl. 5.6.5 is submitted, and **the Principal's release of that
hold point is the acceptance act**. It gates *covering up the work* — which is exactly the irreversible
step evidence exists to protect.

There are **two further survey-specific hold points** in G71 cl. 2.10 (Joint Surveys): one on
**commencement** of each joint survey (submit date, location, surveyor's name, methods and equipment, at
least 3 working days prior), and one on **disturbing or covering up the area of a joint survey** (submit
the Survey Report including any quantity calculations, at least one working day prior). R44 Annexure
R44/A1 is the schedule that nominates *which* surveys are joint surveys, per area/clause, with a
"Model File" Yes/No column; R44 cl. 1.6.1 defines a joint survey as one carried out in the presence of,
or in conjunction with, the Principal's surveyor.

And R71 cl. 7.2 adds a hold point on **placement of the pavement course**, released after the Principal
considers the schedule of underlying-surface levels — the one where the Principal may **redesign** in
response.

**In NSW, "survey accepted" is a real, named, dated act with an identified releasing party. It is not a
byproduct of lot conformance — but neither is it separate from the hold-point machinery: it *is* a hold
point.** That matters for C5.2: an `accepted` state on a survey record in a NSW context **would**
duplicate a hold-point release, if CIVOS models both.

### 3.3 Queensland — a WITNESS POINT, plus a completion precondition

MRTS56 cl. 11.2.1–11.2.6 each gate the next activity on the As Constructed Survey requirements having
been met **and notice of such works provided to the Administrator** — and each is tagged **Witness Point
4** through **Witness Point 10** respectively (topsoil stripped area; bottom of excavation; excavated
area of unsuitable material, and again after backfilling; bottom of excavated areas for end structures;
top of embankment prior to subgrade; top of subgrade). MRTS04 mirrors these gates in its own clauses
(e.g. *construction of the pavement shall not commence until an As Constructed Survey of the Subgrade
has been met... and notice provided*).

**A Witness Point is not a Hold Point.** The Administrator may attend; the process is not held pending
an authorised release. I confirmed the As Constructed Survey gates do **not** appear as Hold Points in
MRTS04's Table 5.1 (Hold Points, Witness Points and Milestones).

Separately, **MRTS56 cl. 11.1** makes the As Constructed Survey deliverable set a **condition precedent
to the issue of the Certificate of Practical Completion** — a project-level acceptance act, not a
lot-level one.

**In Queensland, the act is "survey done + notice given" (contractor-side, witnessed), plus a
project-level completion precondition. There is no per-lot "Principal accepted the survey" event.**

### 3.4 The RG-7 verdict for C5.2

| Jurisdiction | Is there a distinct survey-acceptance act? | What it actually is | Would C5.2's `accepted` duplicate a hold-point release? |
|---|---|---|---|
| **VIC** | **No** | Level conformity is a lot test result under "Conformity with Drawings"; the word "survey" does not appear in Section 204 v8.0 | No — there is nothing to duplicate, and nothing to populate an `accepted` state with |
| **NSW** | **Yes** | Certified per-Lot Survey Report → **Hold Point** on covering up, released by the Principal (G71 5.6.5/5.6.6); plus joint-survey hold points (2.10) and R71's pre-placement hold point (7.2) | **Yes, directly.** In NSW an `accepted` survey state *is* a hold-point release |
| **QLD** | **Partly** | **Witness Points 4–10** — survey done + notice to Administrator, no release; plus As Constructed deliverables as a **condition precedent to Practical Completion** | No — but `accepted` has no releasing party to attribute, so it would be a state nobody sets |

**Recommendation for C5.2 (a research finding, not a build instruction):** the spec's `accepted` state
is defensible **only** as "the contractor recorded that the customer's own acceptance act occurred",
never as an act CIVOS confers or infers. In NSW it is a hold-point release that CIVOS already models
elsewhere; in QLD there is no counterpart party; in VIC there is no act at all. This is exactly the
kind of thing `[C5S-B4]`'s pilot round-trip should settle, and this pass **strengthens** the case for
keeping the state-name decision behind that gate rather than encoding it now.

---

## 4. What this means for C5.5's comparison model

The brief said the prize is the **shape of the data**. Here it is, as design constraints. Each is
traceable to §2.

**4.1 Per-point rows, not lot summaries. This is settled.**
G71 cl. 5.6.5 publishes the row schema outright: *actual value vs specified value vs applicable
tolerance*, per point, positioned by grid coordinates or chainage+offset, per Lot, certified, with
nonconformities flagged. VicRoads 173 cl. 173.05 defines the per-point departure `xᵢ = measured − design`
as the input to the lot statistics. MRTS04 has an explicit "individual results" tolerance row. **Every
lot-level number in every spec read is derived from points.** A summary-only model can represent none of
them; a per-point model can produce every summary. → **C5.5 stores rows.**

**4.2 A tolerance is not a number. It is a small object, and it has at least six forms.**
Observed, all grade A: (1) symmetric `±X`; (2) **asymmetric `+X/−Y`, which is the norm, not the
exception**, and whose permissive direction flips between layers within a single spec (R71 8.6: base
`−0/+10`, subbase `−10/+0`); (3) one-sided "not less than" with no upper bound (204.03(a),(d));
(4) **statistical over the lot** — and note VicRoads' is a **mean *range* (+5 to −15) plus a maximum
standard deviation**, which is two constraints on a distribution, not a band on a value; (5) proportional
to another dimension (204.03(j): 10% of batter height, capped at 300 mm); (6) relative-to-local-datum
(3 m straightedge — 20 mm VIC subgrade, 5 mm NSW pavement, 25 mm QLD subgrade). Plus (7) **non-numeric**
("shall not pond water", "free draining", "no abrupt change of levels") appearing *alongside* numeric
limits, not instead of them. → **Any `tolerance` field that is a single signed number is wrong. And
CIVOS must be able to store a tolerance it cannot evaluate.**

**4.3 The same surface can be judged by different forms on different projects.**
VicRoads Table 204.161 selects Scale A/B (statistical, n≥80 or ≥40) or Scale C (per-point +10/−30, no
random levelling) **by road class**, defaulting to Scale A when unspecified. 204.03(e)/(f) switch form
"unless assessment by random levelling is specified". → **The tolerance rule is a property of the
(project × surface) pair, not of the surface. It cannot be a constant in code, and it cannot be inferred
from the lot alone.** This is the same shape as the C1 finding that a Q6 row is selected by *specified
relative compaction band × lot area band* — a project attribute CIVOS does not hold today.

**4.4 The conformance unit is the Lot — but not only the Lot, and lots are capped.**
Lot is the unit in all three (R71 8.1 "each Lot must comply"; 204.03(h) per-lot mean and S; MRTS04
"average tolerances shall apply to the results for a completed Lot"). But R71 8.8 uses a **100 m linear
interval** for ride quality, R44 Annexure L uses **"each section" / "each batter" / "each bench"** for
survey rows, and MRTS56 gates on **elements** (top of subgrade, bottom of excavation). Lot size is
capped independently: **≤ 4000 m²** for VicRoads random level assessment, **≤ one day's production**
generally (VicRoads 173.02), **Table A.2** maxima in QLD, **one shift's output** in NSW (Q6 5.4.2, per
the C1 pass). → **A survey record's scope is `lot | section | interval | element`, and lot-level rollups
must not be assumed to be the only rollup.**

**4.5 Deviation is not always vertical, and position has two coordinate idioms.**
G71 5.1.3(b): batter deviation is measured **perpendicular to the design batter plane**. G71 6.2/5.6.5
and MRTS04 6.2 both carry **horizontal** tolerances as first-class (±50 mm; edges −50/+250). Position is
recorded **either as grid E/N or as chainage + offset**, at the spec's option. → **A row needs a
deviation *axis* (vertical / horizontal / normal-to-plane) as well as a magnitude, and needs both
position idioms — which is also the honest reason `[C5S-B6]`'s datum warning matters: chainage+offset is
a local, design-relative frame with no datum problem at all, while grid E/N has one.**

**4.6 Points carry a stated uncertainty, and it is comparable in size to the tolerance.**
G71 Orders of Accuracy: vertical 3V = 3 mm, 4V = 6 mm at 95% CL; MRTS56: ±10 mm at 95% CL for top of
subgrade. Against tolerances of ±10 mm (MRTS04 lot average) and S ≤ 12 mm (VicRoads Scale A), **the
measurement uncertainty is the same order of magnitude as the limit.** → **A verdict computed without
carrying uncertainty is not defensible. This is a strong argument for CIVOS transcribing the surveyor's
verdict rather than computing one — which is exactly what §3.3 of the C5 spec already concluded, and
this pass supplies the quantitative reason.**

**4.7 A verdict is not always binary.** R44 cl. 7.7.2: out-of-tolerance SMZ level **may be accepted with
a volumetric deduction**. R71 cl. 8.8: ride quality resolves to **incentives or deductions**. → **The
outcome vocabulary is at minimum `conforming | nonconforming | accepted-with-deduction`, and the third
one carries a quantity. CIVOS must be able to record it without computing the money** (consistent with
`product_claims_data_compiler_not_financial`).

**4.8 The design surface is not immutable.** R71 cl. 7.2: the contractor submits underlying-surface
levels **before** work, highlighting where actual exceeds design, and **the Principal may redesign the
pavement finished levels** in response, advising within 5 working days. → **A comparison is against a
*design revision*, not "the design". Any stored comparison must name which design version it was
computed against** — which lands squarely in Wave G's revision-governance territory.

**4.9 The sampling plan is itself specified data, and planned ≠ actual location.**
G71 5.3.3 and Tables G71.9/G71.10 define strings, spacing and counts by pavement width and surface type;
MRTS56 Table 11.2 defines 10 m grids and cross-sections; VicRoads 173.06 defines ≤20 m longitudinal /
≤2 m transverse for the non-random regime. And G71 5.3.3 requires points be selected **within 0.7 m** of
the planned grid location with **actual field coordinates determined by survey**. → **If CIVOS ever
computes anything, "were enough points taken, in the right pattern?" is a far safer and more valuable
computation than "is this point in tolerance" — it is a counting/geometry question with no datum and no
uncertainty exposure. That is the C1 sufficiency pattern applied to survey.** Flagging it as the
highest-value cheap win in this area; it is not proposed for C5.5 here.

**4.10 What C5.5 must NOT do.** Nothing above licenses CIVOS to compute a conformance verdict. Three of
the six tolerance forms (statistical, proportional, straightedge) need inputs CIVOS does not hold — the
project's nominated Scale, the design batter height, the neighbouring points' levels — and the seventh
form has no number at all. §4.6 shows even the simple per-point case needs an uncertainty CIVOS is not
told. **The model is a filing structure for a verdict somebody else made, per the C5 spec §3.3 line.
This research reinforces that line; it does not soften it.**

---

## 5. Claim table

Load-bearing claims only. "Date checked" is 2026-07-31 for every row (this pass).

| # | Claim | Source (clause/table) | Grade | Caveat |
|---|---|---|---|---|
| 1 | Surface/level tolerance is expressed **per point as a deviation from a design value**, in every authority read | VicRoads 204 cl. 204.03; R44 cl. 7.7.1 Tbl R44.8; R71 cl. 8.6; MRTS04 cl. 6.3.1 | **A** | — |
| 2 | The **conformance unit is the Lot** | R71 cl. 8.1; VicRoads 204 cl. 204.03(h); MRTS04 cl. 6.3.1; VicRoads 173 cl. 173.02 | **A** (VicRoads 173 limb is B — §5.2) | Other units coexist: 100 m interval (R71 8.8), "each section/batter/bench" (R44 Annex L), element (MRTS56 Tbl 11.2) |
| 3 | VicRoads judges Scale A/B subgrade level **statistically**: mean of departures in a *range* and standard deviation ≤ a max, over the lot | 204 cl. 204.03(h), **Table 204.031**: Scale A n≥80, x̄ +5 to −15 mm, S ≤ 12 mm; Scale B n≥40, x̄ +5 to −25 mm, S ≤ 15 mm | **A** | Values re-verified today in the freshly downloaded v8.0 `.docx` |
| 4 | VicRoads caps the lot for random level assessment at **4000 m²** | 204 cl. 204.03(h) | **A** | String verified verbatim in fresh download |
| 5 | Which form applies is **selected by road class in the project schedule**, defaulting to Scale A | 204 cl. 204.16 **Table 204.161** (Freeway M→A, Arterial A→A, B→B, C→C) + cl. 204.03(g) | **A** | — |
| 6 | TfNSW expresses level tolerance as **per-surface asymmetric `+X/−Y`, with no statistical limb** | R44 cl. 7.7.1 **Table R44.8**; values incl. +10/−40, +0/−40, +10/−150, +50/−150, +50/−50, +20/−40, +0/−20 | **A** | **Row→value pairing not certified** — the table's tolerance column is offset in the text layer. Shape and value set are certain; read the rendered PDF before encoding individual rows |
| 7 | Within one TfNSW annexure, **survey/level frequency is per-feature** ("each section/batter/bench/area/Lot") while **compaction frequency is per-area/statistical** (`Q` → Q6) | R44 **Annexure R44/L Table R44/L.1** | **A** | Consistent with, and explains, the C1 pass's Q6 finding |
| 8 | **G71 cl. 5.6.5 publishes the survey-report row schema**: actual vs specified vs applicable tolerance, per Lot or component, position as grid coords **or** chainage+offset, certified by the Surveyor, nonconformities highlighted | G71 Ed 2/Rev 4 cl. 5.6.5 | **A** | The single most decisive finding of this pass |
| 9 | Lot-level aggregates are **computed from the points**: mean thickness per Lot from all results, thickness from point pairs within 0.5 m, slope-adjusted; point-to-triangulated-surface permitted as an approved alternative | G71 cl. 5.6.4 | **A** | — |
| 10 | Conformity survey sampling is a **specified grid**, sized by surface type and pavement width | G71 cl. 5.3.3, Tables G71.9 / G71.10; MRTS56 Table 11.2; VicRoads 173 cl. 173.06 | **A** (VicRoads limb B) | — |
| 11 | As-built points carry a **stated uncertainty at 95% CL**, of the same order as the tolerances | G71 Tables G71.3/G71.4 (Hz 5–500 mm, Vt 0.7–100 mm); MRTS56 Tbl 11.2 footnote (±10/±25 mm) | **A** | Basis of §4.6 |
| 12 | The permissive direction of an asymmetric tolerance **flips between layers within one spec** | R71 cl. 8.6: base **−0/+10 mm**, subbase **−10/+0 mm** | **A** (text); currency **B** (§5.3) | — |
| 13 | QLD publishes **individual-result and lot-average tolerances for the same surface, in one table** | MRTS04 cl. 6.3.1 **Table 6.3.1**: Subgrade Level (individual) **±25 mm**; Subgrade Level (average) **±10 mm**; and cl. 6.3.1 text "average tolerances shall apply to the results for a completed Lot" | **A** | Mid-table rows have column misalignment; the two relied-on rows are unambiguous |
| 14 | QLD applies **three different conformance forms to three properties** in one clause: geometry per-point + lot-average; compaction lot characteristic value (Q020); moisture individual values | MRTS04 cl. 5.5 | **A** | — |
| 15 | A **relative/straightedge** limb applies on top of the design-comparison limb, everywhere | VicRoads 204 cl. 204.03(b),(g) (25 mm / 20 mm under 3 m); R71 cl. 8.7 (5 mm); MRTS04 cl. 6.3.2 (25 mm) | **A** | Cannot be derived from a design-vs-as-built comparison |
| 16 | **Non-numeric conformance criteria** sit alongside numeric ones | VicRoads 204 cl. 204.03(b),(g),(k); MRTS04 cl. 6.3.2; R71 cl. 8.7 | **A** | — |
| 17 | A level nonconformity can resolve to a **priced deduction**, not a rejection | R44 cl. 7.7.2 (volume below −20 mm, rate per Annexure R44/A4, method accepted by Principal); R71 cl. 8.8 (ride-quality incentives/deductions per Annexure R71/B2) | **A** | — |
| 18 | **An as-built survey can cause the design to be changed**, before work proceeds | R71 cl. 7.2 (Principal may redesign finished levels; advises within 5 working days) | **A** (text); currency **B** | Basis of §4.8 |
| 19 | Deviation is measured **perpendicular to the design plane** for batters, not vertically | G71 cl. 5.1.3(b) | **A** | — |
| 20 | **RG-7 / VIC: no survey-acceptance act exists.** Section 204 v8.0 contains zero occurrences of "survey"; the tolerance clause is titled "Conformity with Drawings" | VicRoads 204 v8.0, full-document string search on fresh download | **A** | Verified programmatically today: `survey count: 0` |
| 21 | **RG-7 / NSW: survey acceptance is a HOLD POINT.** Process held = covering up work subject to conformity verification survey; submission = Survey Report; released by the Principal | G71 cl. 5.6.6; plus cl. 2.10.1/2.10.2 (joint surveys) and R71 cl. 7.2 | **A** | Means an `accepted` survey state **would** duplicate a hold-point release in NSW |
| 22 | **RG-7 / QLD: As Constructed Survey gates are WITNESS POINTS (4–10) + notice**, not hold points; and the deliverable set is a **condition precedent to the Certificate of Practical Completion** | MRTS56 cl. 11.1, 11.2.1–11.2.6; MRTS04 Table 5.1 (survey gates absent from the Hold Point column) | **A** | — |
| 23 | Instrument provenance is specified: total station error SDs (<5 mm ±5 ppm; <3″), calibration before use and after repair/service/**firmware upgrade**, current calibration certificate in an equipment register; conformity field books signed and **cross-indexed to equipment and Lot/component**; raw **and** reduced data retained | G71 cl. 2.4.2, 2.4.3, 2.6.4, 2.6.5, 2.6.7, 2.6.8 | **A** | **Bears on RG-4, which was not my slice** — recorded because it materially narrows that gap for NSW |
| 24 | QLD frames As Constructed Survey as feeding a **3D object model / BIM** | MRTS56 cl. 11 preamble | **A** | **Bears on RG-1/RG-3** — recorded, not relied on |

### 5.1 A note on what "grade A" is doing here

Grade A means *I read the authority's own document*. It does **not** mean the claim is safe to encode.
Claim 6 is grade A **and** carries an uncertified row pairing; claims 3 and 13 are grade A **and** are
useless to CIVOS without a project attribute (nominated Scale; whether a result is an individual or an
average) that CIVOS does not hold today. This is the same trap the C1 pass documented for Q6 — grade-A
evidence that a rule *exists* is not evidence that CIVOS can *evaluate* it.

### 5.2 The Section 173 channel weakness, stated plainly

I could not reach an authority-hosted copy of Section 173. `webapps.vicroads.vic.gov.au` does not
resolve from this machine and `content.vic.gov.au` 404s on every Section-173 URL pattern I tried. The
text I read is a **Wyndham City Council republication** carrying `© VicRoads October 2008` footers,
consistent with the DTP index entry (v4, 1/10/2008). **Graded B.** Nothing structural rests on it: the
*existence and role* of Section 173 is grade A from Section 204 v8.0 itself, which names it in
cl. 204.03(h); the *tolerance values* are grade A from Table 204.031. Section 173 supplies definitions
(lot, xᵢ, sampling intervals) that corroborate but do not carry the argument. **Anyone encoding the lot
definition or the 20 m/2 m intervals must obtain the authority copy first.**

### 5.3 The R71 currency weakness, stated plainly

The R71 Ed 5/Rev 1 PDF was already present in this session's shared scratchpad, downloaded by a sibling
research pass, not by me. It has **zero `SUPERSEDED` watermark hits**, which is the currency heuristic
the C1 pass established for the TfNSW portal — so the *document* is very likely current. But **I did not
re-resolve its portal record myself**, so I cannot name the annotation GUID it came from. Claims 12 and
18 are marked accordingly. R44 and G71 carry no such weakness — I downloaded both from named portal
records today.

---

## 6. Consistency with the prior C1 confirmations

Checked deliberately, per the brief. **No contradictions found.**

| Prior finding (2026-07-27) | This pass | Status |
|---|---|---|
| VicRoads Section 204 is **v8.0, November 2025**, at `content.vic.gov.au/Section-204-Earthworks-v8.docx` | Re-downloaded today, HTTP 200; `v8.0` present in body | **Confirmed** |
| TfNSW R44 is **Ed 6/Rev 0, June 2023**, at portal record `bf827ada-…`; currency evidenced by absence of the `SUPERSEDED` text-layer watermark | Re-downloaded today from that record; zero `SUPERSEDED` hits | **Confirmed, independently** |
| R44 **defers frequency** to TfNSW Q (cl. 1.2.5; Annexure R44/L "Q" cells), and the sampling numbers live in **Q6**, not R44 | Confirmed and **extended**: the deferral is limb-specific — the `Q` pointer is on the **compaction/moisture** rows, while the **`Survey`** rows carry their own per-feature frequency and point at **Table R44.8** | **Confirmed and sharpened** — claim 7 |
| The DTP/VicRoads document index is unreliable for currency | The index PDF in the scratchpad still lists Section 204 as v7, 29/12/2015 — stale by two editions | **Confirmed** |
| Q6 supplies **area-banded sample counts** and a **characteristic-value statistic** (k from Table Q6/L.3) for compaction | Not re-derived (out of slice). Nothing here contradicts it; claim 7 explains *why* compaction and level differ in shape | **Consistent** |

One cross-jurisdiction observation worth recording for whoever revisits C1: **VicRoads 173.04(c) uses
`x̄ − 0.92S` for the characteristic density ratio at six tests per lot, while TfNSW Q6 Table Q6/L.3 uses
`k = 0.72` at n = 6** (per the C1 pass, at 10% producer's risk / 10% proportion defective). Same
statistic, different acceptance constant. Not a contradiction — different authorities, different risk
assumptions — but a trap for anyone tempted to treat "the characteristic value" as one formula. (The
VicRoads limb of this observation is grade B per §5.2.)

---

## 7. Unanswered — honestly

**Within RG-2:**

1. **Table R44.8's exact row→value pairing.** Not determinable from the text layer (§2.3). Needs the
   rendered PDF page read by eye. **Ten minutes' work, not a research pass** — but it must happen before
   any R44 level row is encoded.
2. **MRTS04 Table 6.3.1's middle rows** (Top of Rock Fill; insitu below subgrade in rock cuttings; top
   of verge and its "free draining" qualifier). Same problem, same fix.
3. **VicRoads Section 173 from an authority source.** Blocked by DNS/hosting from this machine (§5.2).
   Someone on a different network, or a phone, can likely fetch it in a minute.
4. **TMR MRTS05 Unbound Pavements** — not located in the category paths tried. MRTS56 cl. 10.2 confirms
   it is the governing spec for pavement-layer geometry in QLD, so **the QLD pavement (as opposed to
   earthworks) tolerance table is unread.** I have QLD earthworks only.
5. **SA DIT Master Specification** and **IPWEA / council standards** — not reached at all. Three
   jurisdictions (VIC, NSW, QLD) proved sufficient to answer the shape question decisively, and all
   three agreed on the shape while disagreeing on the values, which is the strongest possible signal.
   But **no SA or WA or council-tier evidence is in this document**, and councils are a real CIVOS
   segment. The A-SPEC/ADAC material already in the repo from the sibling pass is the natural next
   thread.
6. **TfNSW G71 Table G71.9's "Sampling Plan Chainage Difference" column** is captured (10 m / 5 m by
   surface), but **Table G71.6** (referenced for cut floor excavation) was not read.
7. **What a "Scale" nomination looks like on a real contract**, i.e. how a contractor actually learns
   that a lot is Scale A vs Scale C. Table 204.161 is a schedule the tender documenter fills in — I have
   the blank form's structure, not a completed one. **This is the attribute §4.3 says CIVOS would need,
   and it is not publicly determinable — it needs a real project's schedule.**

**Within RG-7:**

8. **What actually happens in practice**, as opposed to what the specs require. All three findings in §3
   are *contractual*. Whether a NSW contractor experiences the G71 5.6.6 hold point as a distinct event
   with its own paperwork, or as one line inside a lot conformance pack, is **not publicly determinable
   and needs the surveyor/contractor conversations RG-7 already called for.** The specs tell you the act
   exists and who performs it; they do not tell you whether anyone would recognise "survey accepted" as
   a state in their own workflow.
9. **Whether NSW's hold-point release and CIVOS's existing hold-point model are the same object.** §3.4
   says they would be. Confirming that is a code question about the shipped HoldPoint flow, not
   research, and it belongs to whoever specs C5.2's states.

**Adjacent gaps this pass touched but did not own:**

10. **RG-4 (instrument provenance)** is now materially narrowed for NSW — claim 23 lists what G71
    requires the *surveyor* to hold. **What survives to the head contractor is still unknown**, which is
    precisely what RG-4 said. The spec-side half is done; the practice-side half is not.
11. **RG-1 / RG-3 (deliverable format, machine-readable design)** — three concrete pointers surfaced and
    are recorded but not pursued: R44 Annexure R44/A1's **"Model File"** Yes/No column (an electronic
    survey-data file in a format suitable for TfNSW CADD modelling, submitted *with* the Survey Report);
    G71 cl. 5.8.2 / Annexure G71/A's **Work-As-Executed survey model** (MX GENIO / MX-compatible, with
    named Survey Pick Up Code style sets, per TfNSW G73); and MRTS56 cl. 11's explicit **3D/BIM object
    model** framing. **All three say a machine-readable surface deliverable is contractually
    contemplated in AU civil today.** That is a genuinely useful signal for RG-1 and RG-3 and it came
    free — but it is spec-side evidence, and RG-1/RG-3 both correctly demand *real deliverables from
    real jobs*. Nothing here substitutes for that.

---

## 8. Sources

All fetched or re-verified **2026-07-31**.

- [VicRoads/DTP Section 204 — Earthworks, v8.0, November 2025](https://content.vic.gov.au/Section-204-Earthworks-v8.docx) — grade A
- [TfNSW QA Specification R44 — Earthworks, Ed 6/Rev 0, June 2023 (TS 02158.1 / IC-QA-R44)](https://standards.transport.nsw.gov.au/_entity/annotation/bf827ada-5615-ee11-9cbd-002248e414c7) — grade A
- [TfNSW QA Specification G71 — Construction Surveys, Ed 2/Rev 4 (IC-QA-G71)](https://standards.transport.nsw.gov.au/_entity/annotation/a61076d5-af35-ed11-9db2-000d3ae019e0) — grade A
- [TMR MRTS04 — General Earthworks, March 2025 (CC BY 4.0)](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/3-Roadworks-Drainage-Culverts-and-Geotechnical/MRTS04.pdf) — grade A
- [TMR MRTS56 — Construction Surveying, March 2022 (CC BY 4.0)](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/1-Overarching-Specifications/MRTS56.pdf?la=en) — grade A
- TfNSW QA Specification R71 — Construction of Unbound and Modified Pavement Course, Ed 5/Rev 1 — text grade A, **portal record not re-resolved by this pass** (§5.3); re-locate on the [TfNSW Transport Standards portal](https://standards.transport.nsw.gov.au/) before relying on claims 12 or 18
- [VicRoads Section 173 — Examination and Testing of Materials and Work (Roadworks), © VicRoads October 2008 — **council republication**](https://www.wyndham.vic.gov.au/sites/default/files/2021-11/Technical%20Specification%20Section%20173%20-%20Examination%20and%20Testing%20of%20Materials%20and%20Work%20(Roadworks).pdf) — grade **B** (§5.2). Authority copy at `webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/322CAF4485EC30A8CA2574DD001BD7A0/$File/Sec173.doc` — **URL recorded from search results, NOT successfully fetched by this pass; treat as unverified until someone resolves it**
- Prior passes relied on for consistency, not re-derived: `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md`, `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md`

**Local extracted text — historical record only, not in the repo and not durable.** Working extracts for
this pass live in the session scratchpad at
`C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3--claude-worktrees-wave1-lotbreakdown\eb519d0e-493c-4bcc-b7f7-41fdef8e1077\scratchpad\`
(`s204fresh.docx`, `r44fresh.pdf`/`.txt`, `g71.pdf`/`.txt`, `mrts04.pdf`/`.txt`, `mrts56.pdf`/`.txt`,
`r71b.pdf`/`.txt`). That directory is session-scoped temp and **should be assumed gone** — re-fetch from
the URLs above, not from those paths.

**Revalidation.** MRTS04 (March 2025) is the youngest document here and TMR revises on a roughly annual
cycle; VicRoads 204 v8.0 (Nov 2025) is also recent. G71 Ed 2/Rev 4 and R44 Ed 6/Rev 0 are older and
stable. Set **`revalidateBy` at 12 months (2027-07-31)**, and re-check the TfNSW portal annotation GUIDs
first — the C1 pass established that the portal's opaque per-document GUIDs are the volatile part.
