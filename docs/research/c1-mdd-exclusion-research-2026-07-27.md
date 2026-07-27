# Decision J2 — Does a laboratory MDD determination count toward the per-lot test frequency N?

**Research date:** 2026-07-27
**Question:** When VicRoads Sec 204 cl 204.13(a) says "six tests per lot" (Scale A/B) / "three" (Scale C), or TfNSW Q6 Ed 2 Table Q6/L.1 specifies a minimum number per lot — does an AS 1289.5.1.1 / AS 1289.5.2.1 / TMR Q142A laboratory Maximum Dry Density determination count toward that N?

---

## VERDICT: **CONFIRMED** (grade A, unambiguous, both jurisdictions)

The shipped position is correct. N is counted in **field density-ratio determinations only**. A laboratory MDD determination is the *reference denominator* used to compute a density ratio — it is never one of the counted N.

**A lot with 6 MDD results and 0 field density tests has ZERO countable tests.** Confirmed by the definitional clause: VicRoads Section 173 defines n as "the number of tests per lot" where each x_i is "the individual density ratio or moisture ratio test value". An MDD is not a density ratio value; it is the denominator of one.

Scope of the verdict:
- **VIC (VicRoads/DTP Sec 204 v8.0 Nov 2025 + Sec 173 + RC 500.05):** CONFIRMED, grade A, directly on point.
- **NSW (TfNSW Q6 Ed 2 / Rev 0):** CONFIRMED, grade A. Q6 counts *samples at semi-random locations within the lot area*, indexed by specified relative compaction — a lab MDD has no in-lot sampling location and no relative-compaction value, so it structurally cannot be one of the n.
- **QLD (TMR Q142A):** NOT FOUND as a primary source in this pass. Not researched to grade A. The VIC/NSW principle is near-certainly identical (same AS 1289 machinery), but treat QLD as **directionally supported, grade D** until confirmed.

---

## Evidence table

| # | Claim | Source | Grade | Quote / paraphrase (<=15 words) |
|---|-------|--------|-------|--------------------------------|
| 1 | N is defined as the count of individual **density ratio** values | VicRoads **Section 173** — Examination and Testing of Materials and Work (Roadworks) | **A** | "x_i ... is the individual density ratio or moisture ratio test value and n is the number of tests per lot" (verbatim) |
| 2 | Characteristic value is computed from the six density-ratio values, not from MDDs | VicRoads **Section 173** | **A** | "calculated as x̄ − 0.92S for six tests per lot" (verbatim) |
| 3 | Per-lot count is 6 (Scale A/B) / 3 (Scale C) | **Sec 204 v8.0 Nov 2025, cl 204.13(a) Test Lots** | **A** | "the number of tests per lot shall be six ... shall be three" (verbatim) |
| 4 | The lab MDD is the **basis of the calculation**, not a counted test | **Sec 204 v8.0, cl 204.13(a)** | **A** | "calculation of density ratio ... shall be based on laboratory values determined using standard compactive effort" (verbatim) |
| 5 | Acceptance criterion is a density-ratio statistic, confirming what is counted | **Sec 204 v8.0, Table 204.131** | **A** | Table column header: "Minimum Characteristic Value of Density Ratio (%)" (verbatim) |
| 6 | MDD is explicitly labelled the **reference density** for the ratio | **RC 500.05** (Acceptance of Field Compaction, Final June 2017), §5.1 | **A** | "The reference density is obtained from ... the maximum dry density (when field dry density is compared)" (verbatim) |
| 7 | **One MDD can serve many field tests** — proves MDD is not 1:1 countable | **RC 500.05** §5.1 | **A** | "a single reference dry density value may be used for a number of field density tests" (verbatim) |
| 8 | MDD is required **per field density test site**, not per lot | **RC 500.05** §5.1 | **A** | "A laboratory compaction test must be performed for each individual field density test site unless ... assigned" (verbatim) |
| 9 | Assigned MDD values (AS 1289.5.4.2) can replace per-site lab tests entirely | **RC 500.05** §5.1 and §5.1 method list | **A** | "AS 1289.5.4.2 Assignment of maximum dry density and optimum moisture content values" (verbatim) |
| 10 | Field density methods are the countable instruments | **RC 500.05** method list | **A** | Lists AS 1289.5.4.1 (dry density ratio), 5.7.1 (Hilf), 5.8.1 (nuclear field density) |
| 11 | Test *sites* are randomly selected within the lot — a lab test has no site | **RC 500.05** §2.3 | **A** | "every point in the lot must have an equal chance of being selected" (verbatim) |
| 12 | TfNSW counts **samples per lot**, keyed to lot area and relative compaction | **TfNSW Q6 Ed 2 / Rev 0, Annexure Q6/L, cl L1, Table Q6/L.1** | **A** | Caption: "Minimum Number of Samples Per Lot"; axes "Specified Relative Compaction (%)" × "Lot Area (m2)" (verbatim) |
| 13 | Those samples are located by an in-lot semi-random grid — field positions | **TfNSW Q6 Ed 2, cl L2 + Figure Q6/L.1** | **A** | "Establish six equally spaced grid lines within the Lot"; "n Number of samples per Lot" (verbatim) |
| 14 | AS 1289.5.4.1 is the *ratio* method; AS 1289.5.1.1/5.2.1 are the *lab reference* methods | AS 1289 method titles as reproduced in RC 500.05 §5.1 | **A** | 5.4.1 "Dry density ratio…"; 5.1.1/5.2.1 "dry density/moisture content relation … compactive effort" |
| 15 | Australian labs schedule field density and laboratory MDD as separate services | TfNSW Technical Guides **L-G-002** (field density by nuclear gauge) and **L-G-004** (laboratory compaction) exist as two distinct guides | **B** | Structural corroboration: authority publishes them as separate testing disciplines |

### Sources actually read (not just cited)
Extracted primary-source text in the shared scratchpad (downloaded this session from the authority publishers):
- `...\scratchpad\sec204v8.txt` — Sec 204 **v8.0, November 2025** (footer verified in text)
- `...\scratchpad\sec173_v4.txt` — Section 173 (4 pages, verified)
- `...\scratchpad\rc50005.txt` — RC 500.05 **Final June 2017** (footer verified, 6 pages)
- `...\scratchpad\q6-fresh.txt` — TfNSW Q6 **Ed 2 / Rev 0** (footer verified)
- `...\scratchpad\LG002-field-density.pdf`, `...\scratchpad\LG004-lab-compaction.pdf` — TfNSW technical guides (fetched this session)

**Provenance caveat:** vicroads.vic.gov.au now 404s all `/technical-documents-new/` and `/~/media/` paths, and `webapps.vicroads.vic.gov.au` no longer resolves — the technical library has migrated (DTP now directs to iTRUST). The four text extracts above were pulled earlier in this session by sibling agents; I verified each carries the correct authority footer/version banner internally rather than re-downloading.

---

## Nuance that affects the engine

These are the parts that would cause a wrong implementation if the rule were applied as a naive "ignore all MDD rows".

**1. MDD is a *separate, paired* requirement — not zero requirement.**
RC 500.05 §5.1: a laboratory compaction test **must** be performed for **each individual field density test site**, *unless* an MDD/OMC has been assigned under AS 1289.5.4.2. So the correct model is not "MDD is irrelevant" but "MDD is a **dependent/reference** requirement keyed to a field density test, satisfiable either 1:1 per site or once via an assigned value." This is a distinct requirement *type*, and it is **per site, not per lot**.

**2. It is per SITE, not per LOT.** Do not add a "1 MDD per lot" requirement — no source supports that. In the unassigned default case a 6-test lot needs 6 lab compaction tests; with an assigned value it needs zero.

**3. The "single reference for many tests" exemption is conditional.**
RC 500.05 §5.1 permits one reference dry density for a number of field tests only "For small areas of work where limited quantities of consistent and uniform processed materials are used, **when so permitted by the specification**." Do not treat the shortcut as universally available.

**4. Assigned values decay and must be re-verified.**
RC 500.05 §7: assigned MDD/OMC values "shall be checked in accordance with that method if material has been reworked." The analogous moisture-offset monitoring runs at one sample per 10,000 t or per fortnight, whichever is fewer samples. If the engine ever tracks assigned-value validity, it needs a staleness trigger, not a permanent pass.

**5. Oversize sampling is another paired per-site requirement.**
RC 500.05 §4.6: where assigned MDD/OMC values are used and oversize is suspected, "a sample ... shall be taken from **each field density site**". Same shape as the MDD pairing.

**6. VicRoads has two orthogonal frequency dials — don't conflate them.**
- cl **204.13(a)** = how many tests *within* a tested lot (6 or 3).
- Table **204.142** = *which lots* get tested at reduced frequency (every 2nd / 3rd / 6th lot of like material), unlocked only after three consecutive conforming lots and with the Superintendent's agreement.
A lot that is skipped under 204.142 is not a failing lot. The engine's sufficiency gate must not flag untested lots without knowing the 204.142 state.

**7. Non-cohesive materials use a different instrument.**
Density *index* (AS 1289.5.6.1) rather than density *ratio* applies to cohesionless material. If the engine hard-codes "density ratio", cohesionless lots will mis-classify. Not researched further here — flagged only.

**8. QLD/TMR is unconfirmed.** TMR Q142A was not located as a primary source. Do not ship a QLD-specific claim citing this research.

---

## What was NOT found

- **TMR Q142A** primary text — **NOT FOUND** this pass.
- Any clause in Sec 204, Sec 173, RC 500.05 or Q6 that requires "one MDD per lot" as a standalone lot-level requirement — **NOT FOUND** (and RC 500.05 affirmatively contradicts it by keying MDD to the test *site*).
- Any clause permitting an MDD to substitute for a field density test — **NOT FOUND**.
