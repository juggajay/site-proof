# C1 confirmation pass — `tfnsw-r44.v1`

> **Provenance of this document.** Produced on **2026-07-27** by a primary-source
> research agent (`tfnsw-r44-confirm`) at Jay's direction, resolving decision
> **D13** of `docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` ("confirm
> before encoding"). Reproduced here essentially verbatim as the authority for
> the spec's **Rev 2.1** amendment `[C1C-7]` (and `[C1C-8]`). Verdict: **KEEP
> DRAFT and re-author as a Q6 pack**. The only edits to the agent's text are
> this header and the retargeting of local scratchpad file references
> (Sources), which pointed at a session-local directory that no longer exists.

**Researcher:** subagent `tfnsw-r44-confirm`
**Date:** 2026-07-27
**Scope:** verify the encoded `tfnsw-r44.v1` rules pack against the current published TfNSW edition.
**Verdict up front:** **KEEP DRAFT and re-author.** The numbers are real, but they are **not R44 numbers** — they belong to **TfNSW Q6**, and the single encoded figure (`n = 6`) is a **conditional** floor that the pack encodes as unconditional.

---

## 1. Editions identified

Both documents were downloaded as **primary PDFs from the official TfNSW Transport Standards Portal** and read in full via `pdftotext -layout`. The portal stamps a diagonal `SUPERSEDED` watermark into the text layer of retired editions; neither current document carries it, and a retired R44 copy fetched from a different portal record does — that is the currency evidence.

| Document | Identity | Edition / Rev | Date | Portal URL | Watermark |
|---|---|---|---|---|---|
| **TfNSW QA Specification R44 — Earthworks** | `TS 02158.1` / `IC-QA-R44` | **Edition 6 / Revision 0** | **June 2023** | https://standards.transport.nsw.gov.au/_entity/annotation/bf827ada-5615-ee11-9cbd-002248e414c7 | none → **current** |
| **TfNSW QA Specification Q6 — Quality Management (Major Works)** | `TS 01572.1` / `IC-QA-Q6` | **Edition 2 / Revision 0** | **February 2024** | https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b | none → **current** |
| R44 (retired, for contrast) | — | Edition 5 / Revision 1 | June 2023 auth. 28.06.23 | https://standards.transport.nsw.gov.au/_entity/annotation/ba8134c3-b235-ed11-9db1-000d3ae011f9 | `SUPERSEDED` on every page |
| D&C R44 (retired) | `TS 02158.2` | — | — | https://standards.transport.nsw.gov.au/_entity/annotation/c18134c3-b235-ed11-9db1-000d3ae011f9 | `SUPERSEDED` |

R44 Ed 6/Rev 0 states in its foreword: *"This document has been revised from Specification TfNSW R44 Edition 5 Revision 1."*
Q6 Ed 2/Rev 0 states: *"This document has been revised from Specification TfNSW Q6 Edition 1 Revision 12."*

### 1.1 The finding that reframes everything

The research appendix's R44 row cites two sources:

> `https://www.aetg.au/testing/bulk-earthworks-conformance` (secondary) ; `https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b` (TfNSW standards portal record — **resolve to the current R44 document page** and record edition/clause at revalidation)

I resolved that portal record. **It is not R44.** `d7d76f7e-d6c3-ee11-9079-000d3ad2920b` serves **Q6 — Quality Management (Major Works), Ed 2/Rev 0, February 2024**. So the appendix's grade-`A` limb was pointing at the *right numbers under the wrong specification name* the whole time. The appendix's own caveat ("must be resolved to the current R44 document page") was correct to flag it, and resolving it shows it never was an R44 page.

---

## 2. What R44 Ed 6/Rev 0 actually says about testing frequency

**R44 Ed 6 specifies no minimum number of tests per lot for compaction, moisture, or any earthworks acceptance property.** It delegates, twice:

- **Clause 1.2.5 "Minimum Frequency of Testing"** (PDF p. 26, doc p. 1):
  > "The Inspection and Test Plan must nominate the proposed testing frequency to verify conformity of the item, which must not be less than the frequency specified in Annexure R44/L. Where a minimum frequency is not specified, nominate an appropriate frequency. **Frequency of testing must also conform to the requirements of TfNSW Q.**"

- **Annexure R44/L, Table R44/L.1 "Control of Earthworks Process"** (PDF p. 99 ff., doc p. 74 ff.): for every *Relative compaction* and *Moisture content* work-activity row, the **"Minimum Frequency" cell contains the literal single character `Q`** — a pointer to Specification TfNSW Q, not a number. (Non-test rows read "Each section", "Each Lot", "Each area".)

- **Clause 7.2.3 / 7.2.4** (PDF p. 49): "Determine by calculation the minimum (lower limit) characteristic value of relative compaction **in accordance with TfNSW Q**." Conformity is judged against **Table R44.7 — Minimum Characteristic Values of Relative Compaction** (90.0 / 95.0 / 98.0 / 100.0 / 102.0 % by location). Those are **acceptance thresholds, not frequencies**.

The **only** numeric sampling frequency published inside R44 Ed 6 is:

- **Table R44/L.2 — Sampling Frequency for Material in Stockpiles** (PDF p. 110, doc p. 86):

  | Total mass of lot represented (t) | 1–500 | 501–1,000 | 1,001–2,000 | 2,001–4,000 |
  |---|---|---|---|---|
  | Minimum samples per lot | 2 | 3 | 4 | 5 |

  This is stockpiled *material* sampling (Cl. 2.8 / Annexure R44/A2), **not** in-situ compaction control, and it is **not** what the pack encodes.

Also searched and **absent from R44 Ed 6**: the phrase "one shift", the "150 m" narrow-lot rule (all `150` hits are millimetre particle/tolerance dimensions), "minimum number of samples", and the term "Characteristic Density Ratio" (0 hits — see §3, rule 4).

---

## 3. Rule-by-rule comparison

Encoded rules taken from `origin/master:docs/plans/wave-c1-test-sufficiency-spec-2026-07-26.md` §7.2, §8.1, §8.2, §16 D8, and the appendix row it cites. The pack is deliberately thin — spec §8.2: *"Encodes the **n = 6 minimum sample count** only; no CDR statistic."*

| # | Encoded value | Published value | Verdict | Citation |
|---|---|---|---|---|
| 1 | `minCount: 6` per lot, presented as a flat minimum sample count | **6 is the floor only for lot area > 5,000 m² at specified relative compaction > 95.0 % to ≤ 100.0 %**, within a rate of 1 per 2,000 m². Small-lot floors are 1–5; > 100.0 % compaction on > 5,000 m² has a floor of **10** | **MISMATCH — correction required** | Q6 Ed 2/Rev 0, **Annexure Q6/L, cl. L1, Table Q6/L.1 "Minimum Number of Samples Per Lot"**, PDF p. 42–44 (doc p. 31) |
| 2 | Attribution: jurisdiction NSW, `specSet: tfnsw`, **spec `R44`**, edition unpinned | The figure is published in **Q6 (TS 01572.1)**, not R44 (TS 02158.1). R44 Ed 6 cl. 1.2.5 and Table R44/L.1 both defer to "TfNSW Q" | **MISMATCH — wrong source document** | R44 Ed 6/Rev 0 cl. 1.2.5 (PDF p. 26); Annexure R44/L Table R44/L.1 (PDF p. 99 ff.) |
| 3 | *(appendix claim, not encoded)* "lot ≤ one shift" | "The size of a Lot must not exceed one shift's output, except that the one shift period may be extended by agreement with the Principal where the process cannot be completed in one shift." | **MATCHES** — but sourced to **Q6**, not R44 | Q6 Ed 2/Rev 0 **cl. 5.4.2**, PDF p. 32 (doc p. 22) |
| 4 | *(appendix claim, not encoded)* "narrow lots ≤ 150 m" | "Lots which are less than 2 m wide must not be longer than 150 m." | **MATCHES with a missing qualifier** (the ≤ 150 m cap applies **only** to lots < 2 m wide) — sourced to **Q6** | Q6 Ed 2/Rev 0 **cl. 5.4.2**, PDF p. 32 (doc p. 22) |
| 5 | *(appendix claim, deliberately not encoded per §16 D8)* "Characteristic Density Ratio with k-values based on n = 6" | The term **"Characteristic Density Ratio" does not appear in R44 Ed 6 or Q6 Ed 2** (0 hits in both). The real statistic is the *characteristic value of relative compaction*, `Q_L = x̄ − ks`, with **k from Table Q6/L.3 for sample sizes 3 → ≥ 20**: 0.52, 0.62, 0.67, **0.72 (n = 6)**, 0.75, 0.78, 0.81, 0.83 (10–14), 0.90 (15–19), 0.95 (≥ 20). n = 6 is **one row of ten**, not a basis | **MISMATCH in framing** (harmless — nothing is encoded; but the appendix's wording should be corrected so a future agent does not encode it) | Q6 Ed 2/Rev 0 **Annexure Q6/L, cl. L3.1 + Table Q6/L.3**, PDF p. 47 (doc p. 37); note (1): "Based on 10 % producer's risk, and 10 % proportion defective" |
| 6 | `perQuantity` limb ships **unexercised** — spec §3.2.1/§7.2: *"no cited authority supplies a per-area frequency figure"* | **False once Q6 is the source.** Q6 Table Q6/L.1 is a per-area frequency table throughout: 1 per 250 m², 1 per 500 m², 1 per 1,000 m², 1 per 2,000 m², 1 per 3,000 m² | **NOT FOUND as encoded → the stated justification no longer holds** | Q6 Table Q6/L.1, PDF p. 42–44 |
| 7 | No `reduced` limb (CI-asserted absent on draft rulesets) | Q6 Ed 2 publishes no reduced-frequency regime for earthworks sampling that I located | **NOT FOUND — correctly absent** | — |
| 8 | No `maxLotSize` on the R44 pack | Q6 imposes lot-size constraints, but as **shift output** and **width/length**, not a single area cap (cl. 5.4.2); cl. 5.4.3(a) allows non-contiguous areas totalling ≤ 1,000 m² as one Lot where compaction < 100.0 % | **NOT FOUND as an area cap — correctly absent**; the shift limb is unevaluable in CIVOS today (spec §2.5, C2) | Q6 cl. 5.4.2–5.4.3, PDF p. 32 |

### 3.1 Table Q6/L.1 transcribed in full (the correction)

**Minimum number of samples per Lot (n)** — Q6 Ed 2/Rev 0, Annexure Q6/L cl. L1:

| Specified relative compaction (%) | ≤ 50 m² | > 50, ≤ 500 m² | > 500, ≤ 1,000 m² | > 1,000, ≤ 5,000 m² | > 5,000 m² |
|---|---|---|---|---|---|
| ≤ 90.0 | 1 | 1 | 1 | 1 per 2,000 m² (min 2) | 1 per 3,000 m² |
| > 90.0, ≤ 95.0 | 1 | 2 | 1 per 250 m² (min 3) | 1 per 1,000 m² (min 3) | 1 per 2,000 m² |
| > 95.0, ≤ 98.0 | 1 | 3 | 4 | 5 | 1 per 2,000 m² **(min 6)** |
| > 98.0, ≤ 100.0 | 1 | 3 | 4 | 5 | 1 per 2,000 m² **(min 6)** |
| > 100.0 | 1 | 3 | 4 | 1 per 500 m² (min 5) | 1 per 1,000 m² **(min 10)** |

Table note (1): *"Where the Lot comprises more than one layer (refer to Clause 5.4.3 (b)), the minimum number of samples must also conform to Clause 5.4.3 (b). Where there is a conflict between the two values, the greater of the two will apply."*

Cl. 5.4.3(b) multi-layer minimums (compaction < 98.0 % only): total layer area ≤ 100 m² → max 5 layers, **min 1 test**; > 100–500 m² → max 3 layers, **min 2 tests**; > 500–1,000 m² → max 2 layers, **min 3 tests**. Total lot thickness ≤ 600 mm.

**Why the encoded `n = 6` is wrong in both directions:**
- **Over-strict** for the common case. R44 Table R44.7 sets 95.0 % for most fill and 98.0 % for the Selected Material Zone — so a typical 3,000 m² SMZ lot legally needs **5** tests, and the pack would flag a compliant lot insufficient at 5.
- **Under-strict** at the top end. A > 5,000 m² lot specified at 102.0 % (SMZ top layer, R44 Table R44.7) needs **1 per 1,000 m², minimum 10**. The pack would pass such a lot at 6.

Note also the "6" that shows up in Q6's *sampling-location* method (cl. L2: "Establish **six** equally spaced grid lines within the Lot"; figure note "based on the number of samples per Lot (n) = 6") is **six grid lines and an illustrative figure**, not a minimum count. That is a plausible origin for the secondary source's flat "n = 6".

---

## 4. Recommendation

**KEEP DRAFT.** Do not flip `tfnsw-r44.v1` to `confirmed`, and do not ship it as authored. Concretely:

1. **Do not encode a flat `minCount: 6` under the name R44.** It is wrong for four of the five compaction bands and misattributed.
2. **Re-author as a Q6 pack, not an R44 pack.** The authority for earthworks sampling frequency in NSW is `TfNSW Q6, TS 01572.1, Ed 2/Rev 0, February 2024, Annexure Q6/L cl. L1, Table Q6/L.1, PDF p. 42`. R44 supplies the *acceptance thresholds* (Table R44.7) that select which Q6 row applies — the two are a pair, and a correct pack needs both. Suggested identity: `tfnsw-q6.v1` (or keep `specSet: 'tfnsw'` with `spec: 'Q6'`), with R44 Ed 6/Rev 0 recorded as the companion acceptance-criteria source.
3. **The correct rule shape is two-dimensional** — `(specified relative compaction band) × (lot area band) → minCount and/or per-area rate`. The pack's existing `perQuantity` + `minCount` limbs can express it: e.g. for > 95.0–100.0 %, `perQuantity: 1 per 2,000 m²` with `minCount: 6`; for > 100.0 %, `1 per 1,000 m²` with `minCount: 10`. **Spec §3.2.1's statement that "no cited authority supplies a per-area frequency figure" is now false and should be corrected** — the `max(perQuantity, minCount)` arithmetic is exactly right for Q6 and stops being a no-op.
4. **Blocker:** CIVOS has no *specified relative compaction* field on a lot today, and no lot area in m² unless Wave C1's `quantityValue`/`quantityUnit` is populated. Without the compaction band you cannot pick a row, so a faithful Q6 pack needs a new lot attribute (or an ITP-derived one). **That is a real scope item, and it is the honest reason this pack cannot ship correct in C1.1.** A defensible interim is to encode only the two rules that need no new field: lot ≤ one shift's output (unevaluable in C1 per §2.5 — record it, don't evaluate) and lots < 2 m wide ≤ 150 m long.
5. **Appendix corrections** (`C:\Users\jayso\Documents\CIVOS-Research-Appendix-2026-07-24.md`, line 25 and §H item 5): the portal record `d7d76f7e-…` is **Q6**, not R44; "Characteristic Density Ratio" is not TfNSW terminology; "k-values based on n=6" should read "acceptance constant k from Table Q6/L.3, sample sizes 3 to ≥ 20"; "narrow lots ≤ 150 m" needs its "< 2 m wide" qualifier. §H item 5 ("resolve Q6 and R44 to their current document pages") is now **done** — the editions and clause/page numbers are in §1 and §3 above.

**Revalidation:** R44 Ed 6/Rev 0 has stood since June 2023 and Q6 Ed 2/Rev 0 since February 2024; TfNSW is migrating the R-series to `TS`-numbered documents (R44 is already dual-numbered `TS 02158.1`), so set `revalidateBy` at **12 months (2027-07-27)** and re-check the portal records, which are the volatile part.

---

## 5. Evidence-grade honesty note

**I read the actual specification text, not secondary sources.** Both PDFs were fetched from `standards.transport.nsw.gov.au` and extracted locally with `pdftotext -layout`; every quotation, table cell, clause number and page number above was read out of that extracted text, and every "NOT FOUND" is a completed search of the full document (R44 Ed 6 = 113 PDF pages, Q6 Ed 2 = 50 PDF pages), not an assumption. I did **not** rely on the aetg secondary page at any point.

**This upgrades the evidence grade from `C` to `A` for the facts themselves** — the numbers now have a primary document, edition, revision, date, clause and PDF page.

**It does not make the pack confirmable, and the grade does not carry to the pack as encoded.** Two honest caveats:

1. **Currency is strong but not absolute.** The portal exposes documents through opaque annotation GUIDs rather than stable per-document pages, so I cannot prove from a URL that no newer revision exists. My evidence for currency is behavioural and good: the portal burns a `SUPERSEDED` watermark into the text layer of retired editions (demonstrated — the R44 Ed 5/Rev 1 and D&C R44 records both carry it), and neither of the two documents I cite does. A human should still confirm on the portal's document listing before anything blocks a claim.
2. **The pack as encoded is a mismatch, so its grade is irrelevant until it is re-authored.** Grade `A` evidence that the encoded rule is *wrong* is still a reason to keep it `draft`. Under spec §8.3's CI rule (`evidenceGrade === 'A'` required for `confirmed`), a re-authored Q6 pack built from §3.1 **would** qualify on evidence grade — the remaining blocker is item 4 above (no compaction-band field on a lot), not the research.

One residual ambiguity, stated rather than papered over: R44 Ed 6 cl. 1.2.5 refers to "**TfNSW Q**" generically, and I verified against **Q6 (Major Works)**. Q6 is the correct member of the Q-series for major works contracts, it is the document whose Annexure Q6/L cl. L1 is titled to that purpose, and its Ed 2/Rev 0 revision register records "Sampling and testing moved here from previous Annex L1 and L2" — but if a project is let under a different Q-type specification, the applicable table should be re-checked against that document.

---

## Sources

- [TfNSW QA Specification R44 Earthworks, Ed 6/Rev 0, June 2023 (TS 02158.1 / IC-QA-R44) — current](https://standards.transport.nsw.gov.au/_entity/annotation/bf827ada-5615-ee11-9cbd-002248e414c7)
- [TfNSW QA Specification Q6 Quality Management (Major Works), Ed 2/Rev 0, February 2024 (TS 01572.1 / IC-QA-Q6) — current](https://standards.transport.nsw.gov.au/_entity/annotation/d7d76f7e-d6c3-ee11-9079-000d3ad2920b)
- [TfNSW QA Specification R44 Earthworks, Ed 5/Rev 1 — SUPERSEDED (currency contrast)](https://standards.transport.nsw.gov.au/_entity/annotation/ba8134c3-b235-ed11-9db1-000d3ae011f9)
- [TfNSW Specification D&C R44 Earthworks — SUPERSEDED](https://standards.transport.nsw.gov.au/_entity/annotation/c18134c3-b235-ed11-9db1-000d3ae011f9)
- Local extracted text — **historical record only, not in the repo and not durable.** At the time of the pass the extracted text lived in the research session's scratchpad, `C:\Users\jayso\AppData\Local\Temp\claude\C--Users-jayso-site-proofv3--claude-worktrees-wave1-lotbreakdown\eb519d0e-493c-4bcc-b7f7-41fdef8e1077\scratchpad\`: `r44-current.txt` (R44 Ed 6/Rev 0), `q.txt` (Q6 Ed 2/Rev 0), `r44.txt` (R44 Ed 5/Rev 1, superseded). That directory is session-scoped temp and should be assumed **gone** — re-verify from the portal URLs above, not from those paths.
