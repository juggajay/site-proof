# C1.0 confirmation pass — `vicroads-204.v1`

> **Provenance of this document.** Produced on **2026-07-27** by a primary-source
> research agent (`vicroads-204-confirm`) at Jay's direction, resolving decision
> **D13** of `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` ("confirm
> before encoding"). Reproduced here essentially verbatim as the authority for
> the spec's **Rev 2.1** amendments `[C1C-1]`…`[C1C-6]`, `[C1C-8]`. Verdict:
> **CONFIRM WITH CORRECTIONS**. The only edits to the agent's text are this
> header and the retargeting of local scratchpad file references (§6), which
> pointed at a session-local directory that no longer exists.

**Date of pass:** 2026-07-27
**Spec under review:** `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` @ `origin/master`
**Pack status in repo:** not yet encoded (no ruleset file exists on `origin/master`) — this is a genuine pre-encoding confirmation, per §8.3 step 1.

---

## 1. Edition identified

**The pack's assumed edition is stale and its version/date pairing was never correct.**

| | Encoded / assumed by the spec | Actual, per the document's own Document History table |
|---|---|---|
| Current edition | "December 2015, Version 7" | **v8.0, November 2025** |
| What December 2015 actually was | v7 | **v6.0** |
| What v7.0 actually was | Dec 2015 | **February 2023** (name change DoT → DTP) |

**Current published document**

- **Title:** Section 204 – Earthworks
- **Version:** 8.0
- **Release date:** November 2025
- **Replaces:** Section 204 v7.0
- **Authorised by:** Senior Manager, Roads Engineering, Department of Transport and Planning (DTP), on behalf of Head, Transport for Victoria
- **Direct URL:** https://content.vic.gov.au/Section-204-Earthworks-v8.docx
- **Page footer on every page:** `Section 204 v8.0, November 2025 … Page N of 19`

**Document History table (verbatim, from the end of the v8 .docx):**

| Version | Date | Description |
|---|---|---|
| 8.0 | November 2025 | Updated to incorporate next-generation sprayed seal and foam bitumen stabilised material requirements, while restricting the use of thin asphalt surfacing on heavily trafficked granular pavements. |
| 7.0 | February 2023 | Updated to reflect name change from DoT to DTP |
| 6.0 | December 2015 | Tables 204.041 and 204.042 – suggested values added after ## marks. Clause 204.04(c) – suggested value added after ## mark for minimum Assigned CBR. |
| 5.0 | October 2013 | Section 204 reviewed based on feedback provided by stakeholders. |

_(The v8.0 description mentions sprayed seal / foam bitumen, which is not earthworks content — that reads like a copy-paste slip in DTP's own history table. Immaterial: I diffed the clauses that matter, see §3.)_

**How I established this is current:** DTP's own **Engineering Standards Catalogue, March 2026** (linked from https://www.vic.gov.au/search-dtp-technical-publications as "the latest engineering standards catalogue"), downloaded from https://content.vic.gov.au/Engineering-Standards-Catalogue-Mar-2026. Its *current publications* sheet row reads:

```
Geotechnical | Section 204 - Earthworks | Formation Specifications (200 Series) | 8 | 2025-11-24 |
https://content.vic.gov.au/Section-204-Earthworks-v8.docx
```

and its *archived* sheet carries the superseded `v7` row pointing at the old `2024-05/Section-204-Earthworks.docx`.

### Where the "December 2015, Version 7" belief came from (and why it's wrong)

Two dead ends fed it:

1. **The DTP Engineering Standards Index (idx-std-0001, dated 2/01/2024)** — the document the earlier research leaned on — literally lists `Section 204 - Earthworks.docx | 7 | 29/12/2015`. That index row is **internally inconsistent with the specification's own history table**, which puts v7.0 at February 2023 and December 2015 at v6.0. The index is the weaker artefact; the document wins.
2. **The legacy specification portal is decommissioned.** `webapps.vicroads.vic.gov.au` **no longer resolves in DNS** (`curl: (6) Could not resolve host`). The copy still sitting there as of the last Wayback capture (2 Jan 2026, server `Last-Modified: 13 Feb 2023`) carried **"© VicRoads October 2013"** page footers — i.e. VicRoads was serving a v5/v6-era rendering off a decommissioned host right up to shutdown. Any `sourceUrl` pointing at `webapps.vicroads.vic.gov.au` is now a dead link.
3. The `~/media/files/technical-documents-new/...` URLs on `www.vicroads.vic.gov.au` (including the one for RC 500.05) now **404**.

**Supporting document, also confirmed current:** VicRoads Code of Practice **RC 500.05 – Acceptance of Field Compaction, version 10, 1 June 2017** (catalogue row; PDF footer reads `RC 500.05 Page N of 6 — Final June 2017`). Current URL: https://content.vic.gov.au/sites/default/files/2024-05/Code-of-Practice-RC-500.05-Acceptance-of-Field-Compaction.pdf

---

## 2. Comparison table

| # | Encoded rule (per spec §3.2 / §3.3 / §4.4 / §8.2) | Published value (v8.0, Nov 2025) | Verdict |
|---|---|---|---|
| R1 | `minCountByScale` = { A: 6, B: 6, C: 3 }, scoped to compaction density | 6 for Scale A **or** Scale B; 3 for Scale C | **MATCHES** (number), **MISMATCH** (citation + missing small-lot exception) |
| R2 | `maxLotSize` 5,000 m² ("Type A") | 5,000 m² **Type A only**; Type B = 10,000 m² or one day's production; Type C = one day's production, **no area cap** | **MATCHES with mandatory scoping correction** |
| R3 | `maxLotSize` 500 m² "under paved areas" via `areaZoneAliases` | **No such rule anywhere in Section 204** | **NOT FOUND — do not encode** |
| R4 | 204.14(c) regime trigger: every lot until 3 consecutive conform → reduced; any failure reverts | Present, clause 204.14(c) — but with three qualifiers the model drops | **MATCHES in substance, MISMATCH in preconditions** |
| R5 | "No `reduced` limb — the source supplies no reduced figure" | Source **does** supply reduced figures (Table 204.142, Minimum Testing Frequency column) — but as a lot-sampling interval, not a per-lot count | **Right call, wrong stated reason** |
| R6 | `scaleKeys` A/B/C, `defaultScale` A | "either Compaction Scale A, Scale B or Scale C as nominated in clause 204.16. Where the compaction scale has not been specified, Compaction Scale A shall apply." | **MATCHES** |
| R7 | `perQuantity` absent (no per-area frequency in the source) | No "one test per X m²" figure exists in Section 204 | **MATCHES** |
| R8 | `provenance.edition` "December 2015, Version 7"; `sourceUrl`; `evidenceGrade: 'A'` | v8.0, November 2025; content.vic.gov.au | **MISMATCH** |

---

## 3. Per-rule verdicts with clause citations

### R1 — Minimum test count per lot: 6 (Scale A/B), 3 (Scale C) → **MATCHES, with two corrections**

**Citation:** Section 204 – Earthworks, **v8.0, November 2025, clause 204.13(a) "Test Lots"**, page 13 of 19.
URL: https://content.vic.gov.au/Section-204-Earthworks-v8.docx

Verbatim:

> For work to be tested for compliance with Scale A or Scale B compaction requirements, the number of tests per lot shall be six, unless the lot is to be treated as a small lot in accordance with Section 173.
> For work to be tested for compliance with Scale C compaction requirements, the number of tests per lot shall be three.

The **numbers are correct and unchanged** from the legacy (v5/v6-era) text I also retrieved — identical wording. `{A: 6, B: 6, C: 3}` is confirmed.

**Correction 1 — the clause citation in the spec is wrong.** The spec's §4.4 specimen user-facing sentence reads:

> Requires **6** density tests (VicRoads Sec 204, **Table 204.142**, Scale B — 2015 edition, unconfirmed).

Table 204.142 does **not** contain test counts. It contains acceptable **lot size** and the **reduced lot-sampling** frequency. Citing it for the count is a mis-citation that would appear on every user-facing sufficiency message and on every immutable decision snapshot. The correct citation is **clause 204.13(a)**.

_(The same mis-citation exists in the repo's ITP research at `C:\Users\jayso\site-proofv3\docs\research\vic-itp\01-earthworks-pavements.md:78`, which attributes the 6/3 counts to "Section 204.14, Table 204.142, RC 500.05". All three are wrong for the count. RC 500.05 v10 does **not** define per-scale test counts at all — I read all 6 pages; it defines lot bounds, test-site selection, test depth, density measurement, and characteristic-value calculation, and it references "6 test site lot" and "3 test site lot" only in §7 as *given* lot shapes when handling invalid results.)_

**Correction 2 — the small-lot exception is not encoded.** "…unless the lot is to be treated as a small lot in accordance with Section 173." The pack has no small-lot limb, so a small lot will be told it needs six tests when the specification does not require six. This over-states the requirement — the failure direction §3.4 exists to prevent, just inverted. Either encode a small-lot escape or state the limitation in the citation text.

---

### R2 — `maxLotSize` 5,000 m² → **MATCHES for Type A only; MISMATCH if applied generally**

**Citation:** v8.0, **Table 204.142 "Minimum Frequency of Testing for Compaction and Moisture Content"**, page ~17 of 19, reached from clause 204.13(a) ("The lot size for Type A, Type B and Type C material shall be as specified in Table 204.142").

Table 204.142, verbatim, column "Acceptable Lot Size in a Single Layer of Work":

| Material | Acceptable Lot Size in a Single Layer of Work | Minimum Testing Frequency |
|---|---|---|
| Type A Material | One day's production or **5,000 m²**, whichever is the lesser | Every second lot of like material and work |
| Type B — ripped and re-compacted below Cut Floor Level | One day's production or **10,000 m²**, whichever is the lesser | Every second lot of like material and work |
| Type B — placed within 400 mm of top of Type B Material | One day's production or **10,000 m²**, whichever is the lesser | Every second lot of like material and work |
| Type B — placed more than 400 mm below top of Type B material | **One day's production** | Every third lot of like material and work |
| Type C Material | **One day's production** | Every sixth lot of like material and work |

The spec's §3.3 reading — that "whichever is the lesser" is a **lot-sizing** rule, not a count rule — is **correct** and its warning copy quotes the right table. But:

- The 5,000 m² figure is **Type A material only**. Two Type B rows are **10,000 m²**; one Type B row and Type C have **no area cap at all** (day's production only).
- `FrequencyRule.appliesTo` offers `activitySlugs`, `layerAliases`, `areaZoneAliases` — **no material-type discriminator**. As specified, the pack cannot express "Type A". Encoding 5,000 m² without one produces a false `lot_exceeds_max_lot_size` warning on any 5,000–10,000 m² Type B lot, and a spurious cap on Type C, which has none.
- The spec is honest that CIVOS cannot check the day's-production limb. Fine — but note that for **Type B >400 mm below top and for Type C, the day's-production limb is the *only* limb**, so those materials get **no evaluable lot-size rule at all**. The warning must not fire for them.

**Required correction:** either add a material-type discriminator (`Lot.materialType` or a `materialAliases` limb) and key the cap to it, or restrict the rule to a Type A-identified layer alias and say so in the label. Do not ship a bare 5,000 m² cap.

---

### R3 — `maxLotSize` 500 m² "under paved areas" → **NOT FOUND. Do not encode.**

**This limb does not exist in VicRoads/DTP Section 204, in any version I read.**

- v8.0 (Nov 2025), clause 204.13(a), verbatim: *"A test lot shall be as defined in Section 173. The lot size for Type A, Type B and Type C material shall be as specified in Table 204.142."* — full stop. No paved-area qualifier.
- Grep across the whole v8 document for `500 m`, `500m`, `paved area`: **zero hits** in any lot-sizing context (the only "paved" hits are the topsoil clauses 204.02/204.03, unrelated).
- The legacy (v5/v6-era) copy retrieved from the decommissioned portal is identical on this point: **zero hits for "500 m2"**.

**Where it actually comes from:** the **Wyndham City Council** republication (`Technical Specification Section 204 - Earthworks (170424).pdf`, Wyndham City Council Specification MAR 2024, https://www.wyndham.vic.gov.au/sites/default/files/2024-04/Technical%20Specification%20Section%20204%20-%20Earthworks%20(170424).pdf). Wyndham's clause 204.13(a) reads:

> The lot size for Type A, Type B and Type C material shall be a maximum of **500m² under paved areas** or as specified in Table 204.142 in all other areas.

That is a **council amendment layered over the VicRoads text** — the same document also contains Wyndham's other insertions ("Superintendent**Council**", `##:` markers, "unless otherwise approved by Council"). It is exactly the "council republication" that §8.3 step 1 explicitly forbids relying on, and it is the source of the contamination.

This is the single most important finding in this pass: **an encoded 500 m² cap attributed to VicRoads would be a fabricated authority requirement on a document that can eventually gate a progress claim.**

_(Same contamination is present in `docs\research\vic-itp\01-earthworks-pavements.md` at lines 44 and 78, which state "max 500 m2 under paved areas (Table 204.142)". That research file should be corrected too.)_

---

### R4 — The 204.14(c) regime trigger → **MATCHES in substance; three preconditions are missing**

**Citation:** v8.0, **clause 204.14(c) "Compaction and Moisture Content Testing Frequency"**, page ~16–17 of 19. Verbatim:

> Every lot shall be tested initially to demonstrate compliance with the requirements for compaction and moisture content. Testing of every lot shall continue until three consecutive lots of like material and work have achieved the specified requirements **in the first test**. After satisfying this requirement **and establishing a compaction procedure to the satisfaction of the Superintendent**, the Contractor **may seek the Superintendent's agreement** to reduce the frequency of testing of subsequent lots to the minimum requirements specified in Table 204.142.
>
> If the Contractor has obtained the Superintendent's agreement to test for compaction and moisture content at the minimum testing frequency and any lot fails to achieve the specified requirements, testing of all subsequent lots shall be undertaken until three consecutive lots of like material and work have achieved the specified requirements in the first test. After satisfying this requirement, the Contractor **may submit changes to the compaction procedure for the Superintendent's review and may again seek approval** to reduce the frequency of testing to the minimum requirements.
>
> For the purposes of this subclause, **small areas as defined in Section 173 shall not be included** in the initial consecutive lots tested for compliance, nor any subsequent set of consecutive lots.

Clause number **204.14(c) is correct**. `consecutiveConformingLots: 3` is **correct**. `escalationShape: 'reset_on_any_failure'` is **correct in direction**. Three qualifiers the encoded model does not capture:

1. **"in the first test"** — a lot that failed and then passed on retest does **not** count toward the streak. §3.4.1's fold over a lot's *current* conformance status will over-credit, flipping to `reduced` when the specification would not. (RC 500.05 §8 reinforces this: *"Repeat testing should not be undertaken merely because, on the basis of the results of the first testing, the lot was deemed to have failed."*) The regime evaluator needs first-test conformance, not final conformance.
2. **Reduction is not automatic — it requires the Superintendent's agreement**, *and* a compaction procedure established to the Superintendent's satisfaction. Three conforming lots is a **precondition to asking**, not an entitlement. A purely computed `reduced` regime would assert a lower required count that the contract does not grant. Re-entry after a failure needs a **fresh** approval, not merely three more passes.
3. **Small areas (Section 173) must be excluded from the streak** — the pack has no small-area concept.

**Recommendation:** keep the regime **computed and displayed as an advisory** ("eligible to *request* reduced frequency"), never as an automatic reduction of `requiredCount`, unless and until a recorded Superintendent approval exists as an input. This strengthens §3.4.1's computed-not-stored argument rather than weakening it.

---

### R5 — "No `reduced` limb because the source supplies no reduced figure" → **right decision, wrong stated reason**

§8.2 asserts: *"the appendix supplies the 204.14(c) trigger and no reduced figure."* **That is factually wrong.** The reduced figures are the third column of Table 204.142, quoted in full under R2: every second / second / second / third / sixth lot of like material and work.

They are, however, **the wrong shape for the encoded model**. `reduced.minCountByScale` reduces *how many tests within a lot*; Table 204.142 reduces *which lots get tested at all*. A lot that **is** tested under the reduced regime still requires **six** tests — clause 204.13(a) is unconditional and scale-keyed, with no reduced variant. So:

- Omitting `reduced` is **operationally correct** — there is no reduced per-lot count to encode, and inventing one would produce the confident-wrong-number defect §3.4 exists to prevent.
- The **stated justification must be corrected** in §8.2, or a future agent reading "no reduced figure exists" will go looking, find Table 204.142, and encode `{A: 2, B: 2, C: 6}` into `minCountByScale` — which would be catastrophically wrong (it would read as "2 tests per lot").
- The genuine gap is that **C1's rule vocabulary has no lot-sampling-interval dimension**. "Test every second lot" is not expressible in `minCountByScale` / `perQuantity` / `reduced` as specified. If the reduced regime is ever to be encoded, that's a new limb (e.g. `lotSamplingInterval: { everyNthLot: 2 }`), gated on recorded Superintendent approval per R4.

---

### R6 — `scaleKeys` and `defaultScale` → **MATCHES**

**Citation:** v8.0, clause 204.13 opening, page 13 of 19:

> Fills shall be compacted to either Compaction Scale A, Scale B or Scale C as nominated in clause 204.16. Where the compaction scale has not been specified, **Compaction Scale A shall apply**. Testing for compaction shall be undertaken in accordance with VicRoads Code of Practice 500.05.

`scaleKeys: ['A','B','C']` and `defaultScale: 'A'` are both confirmed for the **compaction** rule, and Table 204.161 (clause 204.16) confirms the schedule column is "Scale of Compaction (A, B or C)".

**Caveat for any future rule:** clause **204.14** opening restricts *material property* testing to **Scale A or Scale B only** ("testing shall be undertaken at either Scale A or Scale B level of testing… Where the scale of testing has not been specified, Scale A shall apply"), and Table 204.161 has a separate column "Scale of Material Property Testing (A or B)". So `scaleKeys` is per-rule-family, not per-ruleset — if a CBR/PI/grading rule is ever added to this pack, its scale key set is `['A','B']`, which the `Ruleset`-level `scaleKeys` field (spec §3.2) cannot express.

---

### R7 — `perQuantity` absent → **MATCHES**

No per-area or per-volume testing frequency figure exists anywhere in Section 204 v8.0. The only area figures are the lot-size caps of Table 204.142. §3.2.1's conclusion — that `max()` is a no-op for everything this pack ships, and that Rev 1's illustrative "1 test per 500 m²" was invented and is withdrawn — is **confirmed correct**.

_(Arithmetically, 6 tests over a maximum 5,000 m² Type A lot implies at most one test per ~833 m². That is a **consequence**, not a specified frequency, and must not be encoded as one.)_

---

### R8 — Provenance → **MISMATCH; replace wholesale**

| Field | Encoded / assumed | Corrected |
|---|---|---|
| `authority` | `'VicRoads'` | `'VicRoads'` is defensible as the trading brand, but the document is issued by the **Department of Transport and Planning (DTP)** on behalf of **Head, Transport for Victoria**, authorised by Senior Manager, Roads Engineering. Consider `'DTP (VicRoads)'`. |
| `document` | `'Section 204 — Earthworks'` | `'Section 204 – Earthworks'` ✓ |
| `edition` | `'December 2015, Version 7'` | **`'v8.0, November 2025'`** |
| `clause` | `'204.14(c)'` (and §4.4's `'Table 204.142'`) | **`'204.13(a)'`** for counts; `'Table 204.142'` for lot size; `'204.14(c)'` for the regime. These are three different rules and need three different `clause` values. |
| `pdfPage` | — | It is a **.docx**, not a PDF. Clause 204.13(a) = page 13 of 19; clause 204.14(c) + Table 204.142 = pages 16–17 of 19. The `pdfPage?: number` field name is a misnomer for this source. |
| `sourceUrl` | legacy `webapps.vicroads.vic.gov.au` (DNS dead) or `www.vicroads.vic.gov.au/~/media/...` (404) | **`https://content.vic.gov.au/Section-204-Earthworks-v8.docx`** |
| `evidenceGrade` | `'A'` | **`'A'` is now genuinely earned** — see §5. It was *not* earned before this pass (the numbers came from a council republication). |
| `checkedOn` | — | `2026-07-27` |
| `revalidateBy` | 12 months | `2027-07-27`. Note v7.0 → v8.0 was Feb 2023 → Nov 2025 (~33 months), so 12 months is comfortably conservative. |

---

### Out of scope for the pack, but found and worth flagging

The repo's ITP research at `C:\Users\jayso\site-proofv3\docs\research\vic-itp\01-earthworks-pavements.md` states density ratio requirements as **"≥95.0% lower zone / ≥98.0% upper zone / ≥100.0% subgrade"** (lines 74–76), attributed to Table 204.131. **That is not what Table 204.131 says.** The actual table is keyed by **material type × compaction scale**, not by depth zone:

| Material Type and Location | Scale A (min. characteristic DR %) | Scale B (min. characteristic DR %) | Scale C (min. **mean** DR %) |
|---|---|---|---|
| All Type A Material | 99.0 | 98.0 | 100.0 |
| Type B (within 400 mm of top / ripped & re-compacted below CFL / >400 mm below top / top 150 mm of fill areas) | 97.0 | 95.0 | 95.0 |
| Type C Material | 95.0 | 93.0 | 92.0 |

Note also that **Scale C is assessed on the mean, Scale A/B on the characteristic value** — a different acceptance statistic, not just a different threshold. That file's line 643 already flags the values as "requiring confirmation against current table"; they are now confirmed **wrong**. None of this is encoded in the C1 pack (which encodes counts only), so it does not change any verdict above — but it feeds seeded ITP templates and should be corrected separately.

_(Caveat on my own extraction: Table 204.131 has merged/blank cells for the Type B sub-rows, so the row-to-value mapping for the Type B block is reconstructed from cell order and is the one place I'd want a human eye on the rendered document. Table 204.142 has no such ambiguity — every row carries its own values inline.)_

---

## 4. Overall recommendation

### **CONFIRM WITH CORRECTIONS** — the count rule is confirmable at grade A today; three things must change before encoding, and one must be dropped entirely.

**Encode, at `status: 'confirmed'`:**

1. `minCountByScale: { A: 6, B: 6, C: 3 }`, scoped to compaction density — citing **clause 204.13(a)**, not Table 204.142 or RC 500.05. Add the "small lot per Section 173" exception to the rule or to its label.
2. `maxLotSize: { unit: 'm2', value: 5000 }` — **only** with a Type A material discriminator. Without one, do not encode it.
3. `scaleKeys: ['A','B','C']`, `defaultScale: 'A'`.
4. `perQuantity`: absent. Confirmed correct.
5. Provenance per the R8 table: edition **v8.0, November 2025**, sourceUrl `https://content.vic.gov.au/Section-204-Earthworks-v8.docx`, `evidenceGrade: 'A'`, `checkedOn: 2026-07-27`, `revalidateBy: 2027-07-27`.

**Do not encode:**

6. The **500 m² "under paved areas"** cap. It is a Wyndham City Council amendment, not a VicRoads/DTP requirement. Delete it from §3.3, from §8.2, and from `docs/research/vic-itp/01-earthworks-pavements.md`.

**Correct in the spec text before building:**

7. §4.4's specimen sentence cites the wrong table ("Table 204.142" for a test count → should be "clause 204.13(a)").
8. §8.2's justification for omitting `reduced` is factually wrong — the source **does** supply reduced figures, they are just a lot-sampling interval that C1's vocabulary cannot express. Restate it that way so a future agent doesn't "fix" it by encoding `{A:2, B:2, C:6}` into `minCountByScale`.
9. §3.4's regime must not auto-grant `reduced`: the specification requires the **Superintendent's agreement** plus an established compaction procedure, counts only lots that conformed **in the first test**, and excludes Section 173 small areas from the streak. Present the regime as "eligible to request reduced frequency", not as a reduced `requiredCount`.

**Why not KEEP DRAFT:** the numbers that actually gate anything in C1 — the 6/3 per-lot counts — are verified verbatim against the current primary document, and they are **unchanged across v5.0 (Oct 2013) through v8.0 (Nov 2025)**. The defects found are citation accuracy, scope, and provenance, all fixable before encoding. Holding the pack at draft would leave the gate inert for a rule that is, on its numbers, solid.

**Why not CONFIRM outright:** shipping the 500 m² paved-areas cap would put a **fabricated authority requirement** in front of users and into immutable decision snapshots, on a surface that can eventually block a progress claim. That alone is disqualifying until removed. The un-scoped 5,000 m² cap and the wrong clause citation are the same class of defect, one degree milder.

---

## 5. Evidence-grade honesty note

**I read the actual current specification text. This is a primary-source pass.**

What I actually did, in order:

1. Extracted the encoded rules from `origin/master:docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` (1,097 lines; §3.2, §3.3, §3.4, §4.4, §8.2, §8.3, §17.1 are the load-bearing sections).
2. Found the legacy VicRoads specification portal **decommissioned** (`webapps.vicroads.vic.gov.au` — DNS does not resolve) and the `www.vicroads.vic.gov.au/~/media/...` document paths **404**. So the URLs the earlier research used are all dead. Stated plainly because it means no one can re-verify the old citations.
3. Retrieved a **Wayback capture** (2026-01-02, server `Last-Modified: 2023-02-13`) of the legacy `Sec204.doc` and read it — it turned out to be a **v5/v6-era rendering** (© VicRoads October 2013 footers), i.e. the decommissioned portal was serving stale content. Useful only for confirming the 6/3 counts are long-standing.
4. Downloaded the Wyndham City Council 2024 republication and read it — **identified it as the source of the 500 m² contamination** by diffing it against the primary.
5. Followed DTP's current publications route (`vic.gov.au/dtp-technical-publications` → `vic.gov.au/search-dtp-technical-publications`) to the **DTP Engineering Standards Catalogue, March 2026**, downloaded the .xlsx, and parsed its current/archived sheets to establish that **v8 exists and v7 is archived**.
6. Downloaded **Section 204 – Earthworks v8.0 (November 2025)** from the official `content.vic.gov.au` URL in that catalogue and read the clause text directly: 204.13, 204.13(a), Table 204.131, 204.14, 204.14(c), Table 204.142, 204.16, and the Document History table.
7. Downloaded and read all 6 pages of **RC 500.05 v10 (June 2017)** to confirm it does *not* define per-scale test counts.

**Grade: A (primary).** Every quoted clause above is verbatim from the current published document, retrieved from the department's own catalogue link.

**Honest caveats:**

- The v8 document is a **.docx**; I extracted its text via direct XML parsing rather than reading a rendered page. Prose clauses (204.13(a), 204.14(c)) are unambiguous. **Table 204.142's** mapping is unambiguous (each row carries its own values inline). **Table 204.131's** Type B block has merged/blank cells and its row-to-value mapping is reconstructed from cell order — that's the one item I'd want a human eye on. It affects nothing encoded in this pack.
- Page numbers come from the document's own footer/`NUMPAGES` fields (19 pages) and section position; I did not paginate a rendered copy, so treat "page 13 of 19" as approximate for the `pdfPage` field.
- I did **not** obtain Section 173 (which defines "small lot" and "small areas"). Both exceptions are named in Section 204 and both are unencoded; quantifying them needs Section 173, a separate lookup.
- I did not diff v7.0 (Feb 2023) against v8.0 clause-by-clause — v7.0 is archived and its download URL now serves the superseded file. Given the Document History describes v7.0 as a DoT→DTP naming update and I verified the 6/3 counts are identical in both the v5/v6-era text and v8.0, I'm confident the compaction clauses were untouched, but that specific v7→v8 diff is inference, not observation.
- The **DTP Engineering Standards Index (Jan 2024) contradicts the specification's own Document History** on the v7 date (index: v7 = 29/12/2015; document: v7.0 = Feb 2023, v6.0 = Dec 2015). I resolved in favour of the document. If that resolution matters to anyone, it's worth an email to `StandardsManagementRD@transport.vic.gov.au`.

---

## 6. Source list

| Document | Version / date | URL | Retrieved |
|---|---|---|---|
| **Section 204 – Earthworks** (primary) | **v8.0, November 2025** | https://content.vic.gov.au/Section-204-Earthworks-v8.docx | 2026-07-27, HTTP 200 |
| DTP Engineering Standards Catalogue | March 2026 | https://content.vic.gov.au/Engineering-Standards-Catalogue-Mar-2026 | 2026-07-27, HTTP 200 |
| DTP technical publications landing | current | https://www.vic.gov.au/dtp-technical-publications · https://www.vic.gov.au/search-dtp-technical-publications | 2026-07-27 |
| Code of Practice RC 500.05 – Acceptance of Field Compaction | v10, 1 June 2017 | https://content.vic.gov.au/sites/default/files/2024-05/Code-of-Practice-RC-500.05-Acceptance-of-Field-Compaction.pdf | 2026-07-27 (read via Wayback 2025-04-09 capture of the old `~/media` URL; catalogue confirms v10/June 2017 and the current content.vic.gov.au path) |
| DTP Engineering Standards Index (idx-std-0001) | 2/01/2024, published 01/05/2024 | https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/accepted-safety-barrier-products/idx-std-0001-engineering-standards-index--01052024.ashx (403 direct; read via Wayback 2024-09-19) | 2026-07-27 |
| Legacy VicRoads Sec204.doc (v5/v6-era, superseded) | © VicRoads October 2013 footers | Wayback 2026-01-02 capture of `webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/.../Sec204.doc` — **host now DNS-dead** | 2026-07-27 |
| Wyndham City Council Technical Specification Section 204 (**council republication — source of the 500 m² contamination, do not cite as VicRoads**) | Wyndham Spec MAR 2024 | https://www.wyndham.vic.gov.au/sites/default/files/2024-04/Technical%20Specification%20Section%20204%20-%20Earthworks%20(170424).pdf | 2026-07-27, HTTP 200 |

**Local copies (historical record only — not in the repo, not durable).** At the
time of the pass, everything retrieved was written to the research session's
scratchpad,
`C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3--claude-worktrees-wave1-lotbreakdown\eb519d0e-493c-4bcc-b7f7-41fdef8e1077\scratchpad\`
(`sec204v8.docx` / `sec204v8.txt`, `catalogue.xlsx`, `rc50005.pdf` / `rc50005.txt`, `sec204.doc` / `sec204.txt` (legacy), `wyndham204.pdf` / `wyndham204.txt`, `dtpindex.pdf` / `dtpindex.txt`).
That directory is session-scoped temp and should be assumed **gone**. Re-verify
from the URLs in the table above, not from those paths.
