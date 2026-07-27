# Section 173 small-lot exception — quantified

> **Provenance of this document.** Produced on **2026-07-27** by a primary-source
> research agent at Jay's direction, resolving the open caveat left by
> `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md` §5 ("I did
> **not** obtain Section 173 … quantifying them needs Section 173, a separate
> lookup"). Reproduced here essentially verbatim as the authority for
> `docs/plans/d14-q6-pack-spec-2026-07-27.md` §6.2 (the `smallLot` rule limb) and
> §3.3 (`Lot.smallAreaElected`). The only edits to the agent's text are this
> header and the retargeting of the local scratchpad file references (§6), which
> point at a session-local directory that no longer exists.
>
> **The binding finding is §3.1:** the exception is *permissive* ("**may** be
> treated as a small area"), so an area-triggered automatic reduction would
> under-state the requirement — the unsafe direction. Eligibility is computed;
> application requires an explicit election.

**Date of pass:** 2026-07-27
**Agent:** research pass at team-lead's direction, resolving the open caveat in
`docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md` §"I did **not** obtain Section 173".
**Verdict:** **FOUND AND QUANTIFIED.** Threshold is **surface area < 500 m²**;
substitute requirement is **3 tests, assessed on the mean, with the acceptance
threshold raised by 2.0%**. Partially encodable — the count limb is encodable,
the acceptance shift is not, and the trigger is an **election**, not an
area-derived automatic reduction.

---

## 1. Edition identified

**Section 173 — Examination and Testing of Materials and Work (Roadworks)**

| Field | Value |
|---|---|
| Catalogue entry | "Section 173 - Examination and Testing of Materials and Work (Roadworks)", group *General Construction & Maintenance*, series *General Specifications (100 Series)* |
| Version (per catalogue) | **5** |
| Date (per catalogue) | **2025-03-19** (Excel serial 45735) |
| Direct URL | `https://content.vic.gov.au/sites/default/files/2025-03/Section-173-Examination-and-Testing-of-Materials-and-Work-%28Roadworks%29.docx` |
| Page footer (verbatim) | `© Department of Transport and Planning 2025 — Section 173 , March 2025` |
| docProps last-modified | `2025-03-19T05:07:00Z` |
| Author metadata | Company `VicRoads`, last modified by `Daniel P Walton (DTP)` |

Route used, exactly as the prior pass documented: `content.vic.gov.au` →
**DTP Engineering Standards Catalogue (March 2026)**
(`https://content.vic.gov.au/Engineering-Standards-Catalogue-Mar-2026`, an
`.xlsx`) → the **"Current Standards"** sheet → direct `content.vic.gov.au` file
URL. The workbook has three sheets: `Introduction`, `Current Standards`,
`Archived Standards`. Section 173 v5 is on **Current Standards**; v4
(`.../2024-05/...docx`) is on **Archived Standards**. The old
`webapps.vicroads.vic.gov.au` portal remains DNS-dead — the copy that surfaces
in web search results at that host, and the Wyndham City Council reproduction,
were **not** used for any load-bearing claim here.

### 1.1 Honesty note on the version number

**Section 173 v5 contains no Document History table and no version stamp in its
own text.** Unlike Section 204 v8.0 — whose every page footer reads
`Section 204 v8.0, November 2025` and which carries a Document History table —
Section 173's footer reads only `Section 173 , March 2025`. The **"version 5"
designation comes from the catalogue spreadsheet's version column, not from the
document**. The *date* (March 2025) is corroborated three ways: catalogue date
column, page footer, and docProps `modified` timestamp. Cite the edition as
**"Section 173, March 2025 (catalogue v5)"** rather than "v5.0" — the document
does not call itself v5.

### 1.2 Stability check

I downloaded the **archived v4** (`.../2024-05/...docx`) and compared clause
173.04(d). The text is **byte-identical apart from inter-sentence spacing**.
The 500 m² / 3-test / +2.0% rule is stable across at least the last two
editions, and matches the pre-2015 VicRoads text visible in third-party
reproductions. This is a long-settled clause, not a recent change.

---

## 2. Verbatim extractions

### (a) Definition of a test lot — clause 173.02 LOT TESTING

> **173.02 LOT TESTING**
>
> Unless otherwise specified, acceptance of material and work will be based on
> testing of the material or work in lots. A lot will consist of a single layer,
> batch or area of like work which has been constructed or produced under
> essentially uniform conditions and is essentially homogeneous with respect to
> material and appearance. Unless otherwise specified, the extent of each lot
> shall not exceed one day's production. Discrete portions of a lot which are
> nonhomogeneous with respect to material and appearance shall be excluded from
> the lot and shall be either treated as separate lots, or reworked. Where the
> areas excluded from a lot as nonhomogeneous exceed 10% of the total lot area
> or at other specified percentages of the total lot area, the whole of the lot
> shall be rejected.

*(Section 173, March 2025 — clause 173.02, p. 1. This is what Section 204
clause 204.13(a)'s "A test lot shall be as defined in Section 173" resolves to.)*

Three encodable-adjacent facts here, none currently in the pack:

1. **A lot is one layer** of like work under uniform conditions — the pack's
   `layer` attribute is doing exactly the right job.
2. **Default lot extent ≤ one day's production** — this is the *general* cap;
   Section 204 Table 204.142 then adds area caps per material type.
3. **Nonhomogeneous exclusions > 10% of lot area → reject the whole lot.**
   Note this is a **different percentage** from Section 204 clause 204.13(b)(i),
   which excludes *unstable* areas found by test rolling and rejects at **> 20%**.
   Two distinct exclusion tests with two distinct thresholds. Neither is encoded;
   neither is a counting rule, so neither blocks C1.

### (b) Definition / threshold of a "small lot" — clause 173.04(d)

> **(d) Testing Small Areas**
>
> For earthworks and pavement construction any lot which has a surface area less
> than 500 m2 may be treated as a small area. When testing a small area as a lot
> and where test requirements are based on characteristic values of density ratio
> and/or moisture ratio, acceptance of the lot shall be based on the mean values
> of 3 individual tests. In this case the lot will be accepted as far as
> compaction is concerned if the mean value of the individual tests exceeds by
> 2.0% or more the appropriate compaction scale requirement for the
> characteristic value of density ratio for a lot of six tests.

*(Section 173, March 2025 — clause 173.04(d), under 173.04 COMPACTION AND
MOISTURE CONTENT TESTING, p. 2.)*

**Terminology reconciliation — important, and a trap for the next agent.**
Section 173 **never uses the phrase "small lot"**. I grepped the full document:
the only occurrences of "small" are the heading "Testing Small Areas" and the
body of 173.04(d). Section 204 uses **two different phrases** that both resolve
to this one clause:

| Section 204 phrase | Clause | Resolves to |
|---|---|---|
| "…treated as a **small lot** in accordance with Section 173" | 204.13(a) | 173.04(d) |
| "**small areas** as defined in Section 173" | 204.14(c) | 173.04(d) |

There is exactly **one** small-* concept in Section 173, with **one** threshold.
Do not go looking for a separate "small lot" definition — it does not exist.

### (c) What a small lot requires INSTEAD of the standard count

Three changes, not one. The prior pass's framing ("encode a small-lot escape")
under-counts what the clause actually does:

1. **Count: 6 → 3.** "acceptance of the lot shall be based on the mean values of
   **3 individual tests**."
2. **Statistic: characteristic value → mean.** Standard Scale A/B acceptance uses
   the characteristic value `x̄ − 0.92S` (clause 173.04(c)). Small-area acceptance
   uses the plain **mean** of the 3 values. The standard deviation term drops out.
3. **Acceptance threshold: raised by 2.0 percentage points.** The mean must exceed
   "by 2.0% or more the appropriate compaction scale requirement for the
   characteristic value of density ratio for a lot of six tests."

Change 3 is the one that matters for safety and is easy to miss. The small-area
route is **not a free reduction** — you trade three tests for a 2.0-point harder
target. Worked against Section 204 v8.0 Table 204.131 (derived arithmetic,
labelled as such in §5):

| Material / location (Table 204.131) | Scale A char. | → small-area mean | Scale B char. | → small-area mean |
|---|---|---|---|---|
| All Type A Material *(+ Type B within 400 mm of top; ripped & re-compacted below Cut Floor Level)* | 99.0 % | **≥ 101.0 %** | 98.0 % | **≥ 100.0 %** |
| Type B placed > 400 mm below top of Type B *(+ top 150 mm of areas where fill is to be constructed)* | 97.0 % | **≥ 99.0 %** | 95.0 % | **≥ 97.0 %** |
| Type C Material | 95.0 % | **≥ 97.0 %** | 93.0 % | **≥ 95.0 %** |

The three value-triples are verbatim from Table 204.131. The **row grouping**
shown in parentheses is **inferred** from merged/blank cells in the extracted
table and was not visually confirmed against a rendered page — treat the
grouping as provisional, the numbers as confirmed.

**Scale C is untouched, confirmed two independent ways.** (i) Clause 204.13(a)
scopes the exception explicitly: "For work to be tested for compliance with
**Scale A or Scale B** compaction requirements, the number of tests per lot
shall be six, unless the lot is to be treated as a small lot…", with the
following sentence — "For work to be tested for compliance with Scale C
compaction requirements, the number of tests per lot shall be three" — carrying
**no** small-lot qualifier. (ii) Clause 173.04(d) engages only "where test
requirements are based on **characteristic values** of density ratio and/or
moisture ratio", and Table 204.131's Scale C column is headed "Minimum **Mean**
Value of Density Ratio", not characteristic. So 173.04(d) does not engage for
Scale C by its own terms either. Scale C already is 3-tests-on-the-mean; there
is nothing left to reduce.

### (d) The "small areas" definition behind clause 204.14(c)'s streak exclusion

Same clause — **173.04(d)**, same **< 500 m²** threshold. Section 204's own
words:

> For the purposes of this subclause, **small areas as defined in Section 173
> shall not be included** in the initial consecutive lots tested for compliance,
> nor any subsequent set of consecutive lots.

*(Section 204 v8.0, November 2025 — clause 204.14(c).)*

So the reduced-frequency streak of clause 204.14(c) counts only lots of
**≥ 500 m²**. A small area is neither a conforming lot nor a breaking lot for
streak purposes — it is invisible to the streak.

### (e) RC 500.05 checked — NOT a source of any small-lot threshold

Clause 204.13 says "Testing for compaction shall be undertaken in accordance
with VicRoads Code of Practice 500.05", so I read it in full to rule it in or
out.

- **Code of Practice RC 500.05 — Acceptance of Field Compaction**, catalogue
  version **10**, dated **2017-06-01**, page footer `RC 500.05 Page N of 6 Final
  June 2017`, URL
  `https://content.vic.gov.au/sites/default/files/2024-05/Code-of-Practice-RC-500.05-Acceptance-of-Field-Compaction.pdf`
- It uses "small" twice, both non-quantified: clause **2.4 Testing in Trenches**
  ("Test sites within a trench shall be assessed as a **small test lot**, with
  test sites selected in accordance with RC 316.10") and clause **5.3** ("For
  **small areas of work** where limited quantities of consistent and uniform
  processed materials are used, when so permitted by the specification, a single
  reference dry density value may be used for a number of field density tests" —
  a *laboratory reference density* concession, not a test-count rule).
- **RC 500.05 supplies no area threshold and no test count.** It is a
  test-method / site-selection document. The single quantified small-lot rule in
  the VicRoads corpus is **Section 173 clause 173.04(d)**.

Worth noting for a future pack: 2.4 means **trench** work is small-test-lot
work by nature, independent of the 500 m² area test. CIVOS has no trench
discriminator; not encodable, not a C1 blocker.

---

## 3. Encodability verdict

**Short answer: the eligibility test is encodable from area alone. The rule is
not, because eligibility ≠ application, and because the clause changes the
acceptance criterion as well as the count.**

Answering the question as put — "can 'small lot' be determined from lot area
(`quantityValue`/`quantityUnit` in m²) alone?" — **yes, the < 500 m² test is a
pure area comparison with no other input.** But determining that a lot *may* be
treated as a small area is not the same as determining that it *is*, and the
count is not the only thing that changes.

### 3.1 The blocking issue: "may be treated" is an election

> "any lot which has a surface area less than 500 m2 **may** be treated as a
> small area"

Permissive, not automatic. A 300 m² lot is a perfectly valid ordinary lot
requiring six tests; it *becomes* a small area only when the contractor elects
to test it as one — and that election buys a harder acceptance target, so it is
a real choice, not a formality.

**Consequence: an area-triggered auto-reduction would be wrong and dangerous.**
If CIVOS sees `area = 300 m²` and silently emits `requiredCount = 3`, it
**under-states** the requirement for every small lot the project chose to test
normally — telling a user "3 of 3, sufficient" on a lot the Superintendent
expects six tests on. That is precisely the failure direction spec §3.4 exists
to prevent, and it is the *unsafe* direction. The current unqualified "requires
6" **over-states** for an elected small lot, which is annoying but safe.

This is the same shape as `[C1C-6]`'s ruling on the reduced-frequency regime:
**compute eligibility, never auto-grant.** The small-lot limb must follow the
identical pattern.

### 3.2 Proposed rule shape

An additive optional limb on `FrequencyRule`, applied **only** when the lot
carries an explicit election:

```ts
/**
 * VicRoads Section 173, March 2025, cl. 173.04(d) "Testing Small Areas".
 * PERMISSIVE ("may be treated as a small area") — NEVER applied automatically
 * from area. Fires only when the lot carries an explicit small-area election.
 * Area alone determines ELIGIBILITY, not application.
 */
smallLot?: {
  /** STRICTLY less than. 173.04(d): "surface area less than 500 m2". */
  maxArea: { unit: "m2"; value: 500 };
  /**
   * Replaces minCountByScale for the listed scales ONLY. Scale C is absent
   * deliberately: cl. 204.13(a) scopes the exception to Scale A/B, and
   * 173.04(d) engages only where acceptance is on CHARACTERISTIC values —
   * Scale C is already mean-of-three. Do not add C: 3 "for completeness";
   * it would imply a reduction that does not exist.
   */
  minCountByScale: { A: 3; B: 3 };
  /**
   * 173.04(d) ALSO shifts acceptance: the MEAN of the 3 tests must exceed the
   * scale's characteristic density-ratio requirement by >= 2.0 percentage
   * points, and the statistic changes from characteristic (x̄ − 0.92S) to plain
   * mean. CIVOS does not evaluate density-ratio VALUES, so this is carried as
   * citation text and NOT computed. See §3.4 gap G3 — this is the gap that can
   * mislead.
   */
  acceptanceShiftPct: 2.0;
};
```

Evaluation order in `requiredCount` (§3.2.1 of the spec):

```
eligible   = smallLot && area != null && area < smallLot.maxArea.value
applied    = eligible && lot.smallAreaElected === true
countByScale = applied ? smallLot.minCountByScale[scale] ?? minCountByScale[scale]
                       : minCountByScale[scale]
requiredCount = max( countByScale,
                     perQuantity ? ceil(quantity / perQuantity.every) : 0 )
```

Note `?? minCountByScale[scale]` — a Scale C lot that somehow carries the
election still requires 3 (its normal count), not an error and not a further
reduction.

Where area comes from: the spec already has the right plumbing.
`Lot.quantityValue` where `quantityUnit === 'm2'`, with `LotGeometry.areaM2`
(`schema.prisma:492`) as the documented read-time fallback for `m2` rules
(spec §4.1, §3.3). No new sourcing needed.

**Strictly less than.** A lot of exactly 500.0 m² is **not** eligible. Use `<`,
not `<=`, and give the boundary a test.

### 3.3 Knock-on: this overturns a stated spec conclusion

Spec §3.2.1 currently states, in bold:

> **`Lot.quantityValue` / `quantityUnit` are dead weight for C1 counting** —
> they serve only the lot-size advisory of §3.3.

With a small-lot limb that is **no longer true**: area becomes load-bearing for
a *count*, on the very first pack C1 ships. Worth a numbered amendment
(`[C1C-9]`-ish) so the next agent does not read §3.2.1 and conclude the field is
optional or droppable.

Also amendable: §8.2's "No small-lot / small-area concept (Section 173)" entry
in the known-gaps list, and the §4.4 citation text — the exception is now
quantified rather than merely named, and the citation can say so:
*"6 tests per lot for Scale A/B compaction; a lot under 500 m² may instead be
tested as a Section 173 small area — 3 tests, accepted on the mean, which must
beat the scale requirement by 2.0%."*

### 3.4 Named gaps (things CIVOS lacks — not guesses)

**G1 — The election is not data CIVOS has.** Needs a new per-lot boolean
(`Lot.smallAreaElected`, default `false`). It cannot be inferred from anything
in the model. Without it the limb cannot ship *applied*; it can still ship as
**eligibility advisory** ("this lot is under 500 m² — it may be tested as a
Section 173 small area: 3 tests instead of 6, but the mean must beat the scale
requirement by 2.0%"), which is genuinely useful on its own and carries zero
under-statement risk. **Recommendation: ship the advisory first, add the flag
when someone asks for it.** The advisory needs no schema change at all.

**G2 — Area is unavailable for non-area lots.** 173.04(d) says *surface area*.
A lot recorded in `m3`, `t`, `m`, or `each` has no derivable surface area
without layer thickness or width, neither of which CIVOS holds. Earthworks lots
are commonly recorded as volume or chainage length, so this is not a corner
case. Behaviour must be: **area unknown → not eligible → standard count**, never
a guess. `LotGeometry.areaM2` rescues geometry-mapped lots only.

**G3 — The +2.0% acceptance shift is not computable, and this is the one that
can mislead.** CIVOS's test-sufficiency engine counts tests; it does not
evaluate density-ratio values against Table 204.131. So a small-area lot can
show "3 of 3 — sufficient" while its mean is 99.5% against a required 101.0%.
The count limb is *correct* and the verdict is still only about sufficiency of
*count*, but a user will read "sufficient" as "passing". Mitigation without new
capability: when the small-area limb is applied, the verdict text must state the
shifted threshold explicitly rather than silently reducing the count. Computing
it properly needs material type × scale × density-ratio values — a C2/C3-scale
capability, not a C1 one.

**G4 — Statistic change (characteristic → mean) is unmodelled.** Same root as
G3. Recorded separately because even if CIVOS later evaluates values, it must
switch formula, not just shift the threshold.

**G5 — Trench work (RC 500.05 cl. 2.4) is small-test-lot work by nature**,
independent of the area test. No trench discriminator exists in the model. Low
priority; noted so it is not rediscovered as a surprise.

### 3.5 The 204.14(c) streak exclusion becomes encodable — conditionally

Once `smallAreaElected` exists (G1), the exclusion is mechanical: when computing
the 204.14(c) consecutive-conforming-lots streak, **skip** lots flagged as small
areas — in the initial set and every subsequent set. Until then, the spec's
existing `[C1C-6]` caveat stands unchanged and correctly: the computed streak is
an **upper bound** on the specification's streak. Nothing here weakens the
"regime output is advisory" ruling — 204.14(c) still requires the
Superintendent's agreement and an established compaction procedure, neither of
which CIVOS can observe.

---

## 4. Summary table

| Question asked | Answer | Source |
|---|---|---|
| Test lot definition | Single layer/batch/area of like work, uniform conditions, homogeneous; extent ≤ one day's production | 173.02, verbatim |
| "Small lot" threshold | **Surface area < 500 m²** (strictly), earthworks **and** pavement | 173.04(d), verbatim |
| Mandatory or optional? | **Optional** — "may be treated as a small area" | 173.04(d), verbatim |
| Count instead of 6 | **3 individual tests** | 173.04(d), verbatim |
| Statistic instead of characteristic | **Mean** of the 3 | 173.04(d), verbatim |
| Acceptance instead of scale value | Mean must exceed scale characteristic value **by ≥ 2.0%** | 173.04(d), verbatim |
| Applies to Scale C? | **No** — 204.13(a) scopes to Scale A/B; Scale C is already mean-of-3 | 204.13(a) + Table 204.131, verbatim |
| 204.14(c) "small areas" definition | Same clause, same < 500 m² | 173.04(d) + 204.14(c), verbatim |
| Determinable from area alone? | **Eligibility yes; application no** (needs the election) | analysis |
| RC 500.xx source of a threshold? | **No** — RC 500.05 has no numeric small-lot rule | RC 500.05 §2.4, §5.3, verbatim |

---

## 5. Evidence grade

**Grade A** for everything in §2, with the §1.1 version-number caveat.

**Primary text actually read, in full, from `content.vic.gov.au`:**

- Section 173 (March 2025, catalogue v5) — `.docx` downloaded and XML-extracted
  in full; all six clauses (173.01–173.06) read; grepped exhaustively for
  "small", "lot", "500", "history", "version".
- Section 173 (May 2024, catalogue v4, archived) — downloaded and compared,
  clause 173.04(d) identical modulo whitespace.
- Section 204 — Earthworks v8.0, November 2025 — re-downloaded and re-extracted
  independently of the prior pass; clauses 204.13(a), 204.13(b)(i), 204.14(c),
  Table 204.131 and Table 204.142 read directly. Every Section 204 quotation
  above is from my own extraction, not carried over from the prior document.
- Code of Practice RC 500.05 — Acceptance of Field Compaction (June 2017,
  catalogue v10) — PDF downloaded, all 6 pages text-extracted, read in full.
- DTP Engineering Standards Catalogue (March 2026) — `.xlsx` downloaded, all
  three sheets parsed programmatically; Section 173 and RC 500.05 rows read from
  the `Current Standards` sheet, v4 row confirmed on `Archived Standards`.

**Secondary sources consulted but NOT relied on for any claim:** a web search
returned a Wyndham City Council reproduction of Section 173 and a
`webapps.vicroads.vic.gov.au` copy. Both were used only as an initial pointer to
the document's existence and title. Every number, threshold and quotation above
comes from the current `content.vic.gov.au` primary files.

**Explicitly derived, not verbatim** (flagged so it is not mistaken for source
text):

- The §2(c) table of shifted acceptance values (101.0 / 100.0 / 99.0 / 97.0 /
  95.0 %) is **arithmetic** — verbatim Table 204.131 values plus the verbatim
  2.0% shift. The values are confirmed; the **row grouping** is inferred from
  merged cells in a text extraction and is provisional.
- The Scale-C-is-untouched conclusion is a **derivation**, but from two
  independent verbatim routes that agree (204.13(a) explicit scoping; 173.04(d)
  "characteristic values" precondition vs Table 204.131's "Mean" heading for
  Scale C). High confidence.
- All of §3 (encodability, rule shape, gaps) is **analysis**, not source.

**Nothing is guessed.** No number in this document is unverifiable, and no
threshold, count or percentage appears that I did not read in a primary file.
Where CIVOS lacks data (§3.4 G1–G5) it is named as a gap rather than filled.

**Residual risk:** the catalogue I used is the **March 2026** edition, four
months old at time of writing. Its `Current Standards` sheet lists Section 173
at March 2025. If DTP published a Section 173 revision between March 2026 and
now, this pass would not see it. Given the clause is unchanged across v4 → v5
and matches pre-2015 text, the risk of the 500 m² / 3-test / +2.0% rule having
moved is very low. Suggest `revalidateBy` of 12 months, as for the 204 pack.

---

## 6. Sources

**Primary (all read directly):**

1. **Section 173 — Examination and Testing of Materials and Work (Roadworks)**,
   March 2025 (catalogue v5), Department of Transport and Planning —
   `https://content.vic.gov.au/sites/default/files/2025-03/Section-173-Examination-and-Testing-of-Materials-and-Work-%28Roadworks%29.docx`
2. **Section 173**, May 2024 (catalogue v4, archived) —
   `https://content.vic.gov.au/sites/default/files/2024-05/Section-173-Examination-and-Testing-of-Materials-and-Work-(Roadworks).docx`
3. **Section 204 — Earthworks**, v8.0, November 2025, DTP —
   `https://content.vic.gov.au/Section-204-Earthworks-v8.docx`
4. **Code of Practice RC 500.05 — Acceptance of Field Compaction**, June 2017
   (catalogue v10) —
   `https://content.vic.gov.au/sites/default/files/2024-05/Code-of-Practice-RC-500.05-Acceptance-of-Field-Compaction.pdf`
5. **DTP Engineering Standards Catalogue**, March 2026 —
   `https://content.vic.gov.au/Engineering-Standards-Catalogue-Mar-2026`

**Repo context read:**

6. `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md` @ `origin/master`
7. `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` @ `origin/master`
   (§3.2, §3.2.1, §3.3, §3.4, §4.1, §8.2 and the `FrequencyRule` / `Ruleset`
   type definitions)

**Secondary, consulted as pointers only, not relied upon:**

8. Wyndham City Council reproduction of VicRoads Technical Specification
   Section 173 (pre-2021 text)
9. `webapps.vicroads.vic.gov.au` legacy `Sec173.doc` (host DNS-dead; search
   index only)

**Local artefacts from this pass — historical record only, not in the repo and
not durable.** At the time of the pass the downloads and extracted text lived in
the research session's scratchpad
(`sec173.docx` / `sec173.txt` — Section 173 March 2025; `sec173_v4.docx` /
`sec173_v4.txt` — Section 173 May 2024 archived; `sec204.docx` / `sec204.txt` —
Section 204 v8.0 November 2025; `rc50005.pdf` / `rc50005.txt` — RC 500.05 June
2017; `cat.xlsx` — DTP Engineering Standards Catalogue March 2026). That
directory is session-scoped temp and should be assumed **gone** — re-verify from
the `content.vic.gov.au` URLs above, not from those paths.
