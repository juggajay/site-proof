# ITP Library Coverage Research — every jurisdiction, every activity

**Date:** 2026-07-17 · **Status:** AWAITING JAY'S REVIEW (gates the seeding wave)
**Method:** 5 parallel research agents (NSW gaps, WSA utilities, concrete flatwork,
WA/MRWA mapping, QLD/SA/VIC + small-jurisdiction audit), all working from
published specifications with per-claim confidence markers. Raw agent reports
archived in the session scratchpad; this document is the synthesis.

**Confidence convention:** ✓ = verified against the primary/official document or
register · † = spec identity confirmed, content detail from secondary sources ·
✗ = no dedicated spec exists (different regime or genuine absence).

**Honesty note that shapes the build:** every agent independently hit the same
wall — primary documents are paywalled (WSA ~$300–600/code, AUS-SPEC licensed)
or block automated fetching (TfNSW + MRWA PDFs 403 robots; QLD/SA/VIC index
pages 403 but individual PDFs verified). No spec numbers in this document are
fabricated; where a value could not be verified it is marked. **Template
drafting must start from the "documents needing human reads" list (§6), not
from this summary.**

---

## 1. Structural findings (change how templates are built)

1. **Safety barriers are ONE spec per state, not three.** TfNSW R132 (=TS 03291,
   read end-to-end ✓: exactly 3 hold points, Accepted Products gate, ±20 mm
   tolerances, 1 kN post test, T166 ≥95% RC on end-treatment backfill), MRWA 603,
   QLD MRTS14 all govern wire rope + W-beam + concrete barrier together. Build
   one barrier template per state with type branches — not three.
2. **Concrete flatwork is ONE national template.** AUS-SPEC **0282 Pathways &
   Cycleways** (NOT 0341, which is steelwork) + IPWEA backbone; VicRoads 703 /
   IPWEAQ PCD-101/102 / ACT SS06 converge on the same substance (25 MPa, SL72,
   pre-pour HOLD point, saw-cut + dowelled expansion joints, AS 3799 curing,
   4–7 day protection). Parameterise: grade, thickness (100/150 mm), mesh,
   joint spacings, curing days, compaction target, citation dropdown.
3. **Utilities are ONE national family with an agency-amendments selector.**
   WSAA codes are designed for localisation (supplements are clause deltas).
   Stages/hold-points/test-TYPES are national; acceptance NUMBERS and
   hold-point OWNERSHIP are agency-localised. Never hard-code numeric pass/fail
   as universal. Verified numbers via agency work instructions: water hydro
   test ≥1050 kPa (≤DN300) / ≥1200 kPa (≥DN375), fail >50 kPa loss, thrust
   blocks cured ≥3 days. **Trap: search results are polluted with US figures
   (AWWA chlorine 25 mg/L, psi air tests) — never use.**
4. **WA needs its own test-method vocabulary.** MRWA cites the "WA" test-method
   series (e.g. WA 133), not AS/Austroads methods — WA templates cannot copy
   east-coast test references. Also: kerb lives in the 400 Drainage series
   (407), fencing/noise in a 900 Misc series (903/904); crushed rock base +
   sprayed seals dominate; no rigid-pavement or EME2 spec (material reality).
5. **TAS/NT/ACT are label-changes, not new regimes.** Each publishes its own
   workmanship suite (TAS State Growth sections + TMSS municipal; NT DIPL one
   consolidated Standard Spec v5.4 2024; ACT MIS design + MITS construction)
   but all defer to AS/Austroads test methods. The 38-activity taxonomy maps
   cleanly; only the citation label differs.
6. **Water/sewer are NEVER road-authority specs** in any state — they belong to
   the WSA/utility-authority regime. Utilities templates are a separate family
   with `stateSpec` semantics TBD (likely a "WSA (national)" pseudo-spec-set +
   agency field), not per-road-authority rows.

## 2. Coverage matrix — 38 activities × jurisdictions

Legend: ● seeded today · S = spec exists, seedable · s = sub-clause of a parent
spec (template as part of parent, not standalone) · ✗ = no dedicated spec ·
blank = not researched this pass. NSW/QLD/SA/VIC show post-Wave-2 seeded state.

| Activity | NSW (TfNSW) | QLD (MRTS) | SA (DIT) | VIC (VicRoads) | WA (MRWA) |
|---|---|---|---|---|---|
| earthworks_general | ● R44 | ● MRTS04 | ● | ● 204 | S 302 |
| subgrade_prep | s R44+3051 | s MRTS04/05 | s RD-EW-C1 | s 204 | s 302 |
| geosynthetics | S R63 | ● | S RD-EW-S1 | ✗ inline | ✗ |
| pavement_unbound | ● 3051 | ● MRTS05 | ● | ● | S 501 |
| pavement_bound | S R73 | S MRTS08+10 | S RD-PV-S2 | S 306 | S 501/515 |
| pavement_concrete | S R83 | S MRTS40 | S RD-PV-D3 | S 503 | ✗ |
| pavement_stabilisation | S R75 | ● | ● | S 307+308 | S 515 |
| asphalt_dga | ● R116 | ● MRTS30 | ● RD-BP-S2/C3 | ● | S 504+510 |
| asphalt_sma | S R121 | ● | ● | ● | S 502 |
| asphalt_oga | S R119 | s MRTS30 | s RD-BP-S2/C3 | S 417 | S 516 (crumb) |
| asphalt_eme | S R126 | ● | ✗ | S 418 | ✗ |
| sprayed_seal | S R106+R107 | ● | S RD-BP-D2 | ● | S 503 |
| prime_primerseal | ● R106/107 | ● | S RD-BP-D2 | S 408 | s 503 |
| pipe_drainage | ● R11 | ● | ● | ● | S 401 |
| drainage_pits | ● | ● | ● | ● | S 405 |
| culverts | ● | ● | ● | ● | S 404 |
| subsoil_drainage | ● | ● | ● | ● | S 403 |
| kerb_channel | S R15 | ● | S RD-DK-C2 | S 703 | S 407 |
| structural_concrete | ● | S MRTS70* | ● | ● 610/614 | S 820 |
| reinforcement | ● | S MRTS71* | S ST-SC-S6 | ● 611 | S 822† |
| piling | ● | S MRTS63* | S ST-PI-* | ● 605-608 | S 810-814 |
| structural_steelwork | S B201 | S MRTS78* | ● | ● 630 | S 830 |
| bridge_bearings | S B284 | S MRTS81* | S ST-BF-C1 | ● 656 | ✗ |
| precast_elements | S B80 | S MRTS72* | S ST-SC-S3 | ● 620 | S 828 |
| post_tensioning | S B113+B119 | S MRTS73* | S ST-SC-C2 | ● 612 | S 824† |
| reinforced_soil_walls | S R57+R58/59 | ● | S ST-RE-* | S 682 | ✗ |
| bridge_deck_waterproofing | S B330 | s MRTS84 | s | ● 691 | S 875 |
| wire_rope_barrier | S R132 | ● MRTS14 | ● | S 711 | S 603 |
| w_beam_guardrail | S R132 | ● | ● | S 708 | S 603 |
| concrete_barrier | S R132 | ● MRTS14 | s RD-BF-* | s drawings | S 603 |
| pavement_marking | S R145+R142 | ● | S RD-LM-C1 | S 722 | S 604 |
| fencing_noise_walls | S R201+R271 | ● MRTS15 | S RD-BF-C4 | S 707 | S 903+904 |
| erosion_sediment_control | S G36+G38 | ● | ● | ● | ✗ EMP |
| landscaping | S R178+R179 | ● | ● | ● | S 304 |
| footpaths_flatwork | — national — | s MRTS03 | s | S 703 | — national — |
| water_reticulation | — WSA 03 national + agency selector — | | | | |
| sewer_reticulation | — WSA 02 (+04/07) national + agency selector — | | | | |
| conduit_trenching | S TfNSW conduit | S MRTS91 | S RD-EL-C3 | S 733 | (600s) |

\* QLD structures partially seeded already — verify against current seeders
before templating (audit flag). † = spec named via secondary source only.
TAS/NT/ACT: same taxonomy, citation label differs (§1.5); no per-activity
tables this pass.

## 3. Proposed seeding waves (for Jay's approval)

**Wave A — NSW catch-up + highest-frequency (Jay's projects are TfNSW/rms):**
NSW environmental (G36/G38, R178/R179, R63), NSW barrier template (R132 —
strongest-sourced spec in this research), NSW marking (R145+R142), NSW fencing
(R201) + noise walls (R271), NSW kerb (R15). SA sprayed seal + prime (RD-BP-D2
— SA's single biggest gap; seals dominate SA rural).

**Wave B — cross-state single-spec wins:** pavement_marking ×SA/VIC,
concrete pavement ×3 (MRTS40/RD-PV-D3/503), bound pavement ×3 (MRTS08+10/
RD-PV-S2/306), conduit ×3 (MRTS91/RD-EL-C3/733), kerb+footpath VIC 703 (two-
for-one), VIC surfacing trio (417/418/408), VIC stabilisation (307+308).

**Wave C — national families:** concrete flatwork (one template, AUS-SPEC 0282
backbone, parameterised); utilities (WSA 03 water first — most ITP-ready — then
WSA 02 sewer, then 04/07 as add-ons; agency-amendments selector).

**Wave D — new jurisdictions:** WA first wave = 501, 302, 503, 401+405+407,
820+822 (per WA agent's priority list; needs WA test-method vocabulary work).
TAS/NT/ACT after WA proves the "new jurisdiction" seeder pattern.

**Deliberate skips:** SA/VIC concrete_barrier as standalone (drawings-governed;
fold into barrier templates with a citation note) · VIC geosynthetics (inline
only) · standalone subgrade_prep / deck_waterproofing where they're sub-clauses
· rail (parked).

## 4. What Jay must decide

1. Approve wave order (or reorder) — Wave A is sized for immediate build.
2. Utilities `stateSpec` design: "WSA (national)" pseudo-spec-set + agency
   selector field (recommended) vs per-state duplication.
3. Flatwork: confirm ONE national template with parameter fields (recommended).
4. Any activities to add to the taxonomy from WA's beyond-taxonomy list
   (microsurfacing, segmental paving, sprayed concrete, signs, balustrades) —
   recommend NO for now (taxonomy stability beats completeness).

## 5. Spec corrections captured (do not re-derive)

- AUS-SPEC flatwork worksection is **0282** (0341 = structural steelwork).
- TfNSW fencing is **R201** (not R91); R141/R146 are the maintenance marking
  variants of R145; R84 withdrawn (R83 includes CRCP); R63 covers separation/
  filtration geotextiles only (reinforcement geogrids under R57/R58).
- VicRoads marking: Sec **722** current (721 legacy) — confirm live revision.
- Keep dual numbering on NSW templates (R/B legacy + TS modern, e.g.
  R132=TS 03291, B80=TS 01733, B201=TS 01744).

## 6. Documents needing human/browser reads before templating

Automated fetch fails on these; each is a 1-click browser download:
- **TfNSW controlled PDFs** (403 to robots, fine in browser):
  R121, R83, R145, R63, R178, R179, R271, R201, B80, B113, B201, B284, B330,
  R57/R58, G36 (hold-point schedule). R132 already fully read via ACT mirror.
- **MRWA PDFs** (image/compressed — need OCR or manual read): 302, 501, 503,
  401/405/407, 820/822 for Wave D.
- **AUS-SPEC 0282** adopted copy (MidCoast Council publishes free) + one IPWEAQ
  drawing (PCD-101) to confirm flatwork defaults.
- **WSA numeric acceptance values** (paywalled): cheapest legitimate path =
  purchase the two SEQ integrated eBook editions (WSA 03 + WSA 02 with SEQ
  amendments embedded). Until then, templates cite "per WSA 02/03 & agency
  supplement" for the paywalled numbers — never invent them.

## 7. Raw report archive

Agent reports (nsw, utilities, flatwork, wa, audit) saved in the orchestrating
session's scratchpad `research-reports/` — full source URL lists live there.
