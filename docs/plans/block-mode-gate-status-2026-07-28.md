# §15.1 Block-Mode Acceptance Gate — Status at `82b5605d` (2026-07-28)

**Gate source:** `docs/plans/d14-q6-pack-spec-2026-07-27.md` §15.1 `[D14X-1]` — the external
reviewer's ten-item acceptance gate, adopted verbatim with owners. **Nothing sets
`testSufficiencyMode: 'block'` on any project until every item passes.**

**Assembled by:** orchestrator, overnight run 2026-07-27→28, after the D14 build chain
completed (D14.1 #1608, D14.2 #1611, D14.3 #1615, D14.5 #1616; D14.4 deferred per J3).

## The ten items

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Each shipped Victorian compaction ITP test type maps to the canonical rule | ✅ | F1.1 #1598 + F1.2 #1602. AT-29 (`testCategoriesEngine.db.test.ts`) drives every entry vocabulary — `Density Ratio`, `density_ratio`, linked VIC seed strings, legacy `compaction`, `Field Density Nuclear`, `Dry Density Ratio` — to **6 of 6** through the real production path. Prod classifier report (comment on #1602): 44/47 live test_results rows (94%) resolve `category:compaction`; the 3 unknowns are QA-artifact junk. |
| 2 | Actual UI choices such as Density Ratio count correctly | ✅ | Same AT-29 rows; independent gpt-5.6-sol adversarial review of the merged diff found **zero behavioural defects**; its two test-quality gaps closed by #1614 with proven-to-catch output. |
| 3 | Malformed/unsupported scale values rejected on every write path | ✅ | D14.1 #1608 — hoisted `assertLotSufficiencyAttributes` at all write paths (AT-50a), block-bypass case proven with a real `quality_manager` PATCH → 400, `canConform` stays false (AT-50b). Reverting the fix produced 5 test failures (recorded in #1608 body). |
| 4 | 499.99 m² vs 500.00 m² lots produce intentionally different, **domain-reviewed** outcomes | ⚠️ **JAY** | The *outcomes* ship and are pinned: strict `<` boundary (AT-47: 499.99 eligible, 500.0 not), caveat in the item text (AT-46a), mutation-checked (`<`→`<=` fails AT-47) — #1611. The **domain review of those outcomes is Jay's** and no test can close it `[D14X-3]`. |
| 5 | Three history lots with zero tests do not earn reduced-frequency eligibility | ✅ | D14.1 #1608 §6.4.1 + AT-49a. Ordering constraint honoured: landed **after** canonicalisation (F1.2 #1602), so the fix is evaluated with an attribution predicate that matches real data. Reverting produced 4 failures incl. the shipped-pack DB case. |
| 6 | A sufficiency-only force-conform snapshot records `insufficient_test_count` | ✅ | C1.2 #1594 (external F5 fold): V1 snapshot allowlist expanded; sufficiency key at all three decision points. |
| 7 | QM / site-manager / foreman / subcontractor role matrix matches UI visibility and API authorization | ✅ | External F8 fixed in #1597 (role-gate mismatch), all six mediums reproduced-then-fixed with tests proven to fail without each fix. D14's own fields unchanged across roles (AT-51, #1608). |
| 8 | Closing and reopening the bulk modal starts with no armed values | ✅ | External F9 fixed in #1597; **interaction with D14.1 verified 2026-07-28**: `BulkActionModals.tsx:298-304` resets `testScale`, `materialType` and quantity in the reset-on-open effect — the D14.1-added controls are covered. |
| 9 | Alert lists, summaries and check endpoints count the same supported rows | ✅ | D10 #1586/#1588 (tolerant `toAlert` + removal, AT-21 proven-catches) + external F10 fixed in #1597 (alert count consistency). |
| 10 | Audit records can reconstruct scale, quantity, activity classification and warn/block changes | ✅ | External F7 fixed in #1597 (audit from/to values); D14 §9.4 puts the new fields in `changes` (#1608, #1611). |

**Machine-verifiable items: 9 of 9 green. Human items: 1 open (item 4, Jay).**

## Items outside the table that still gate the pilot

| Item | Owner | Status |
| --- | --- | --- |
| §15 exit item 4 — Q6 portal-listing currency re-check (or residual risk explicitly accepted and recorded) | **Jay** | OPEN. Necessary per J1; ~15 minutes against the TfNSW portal. |
| §16.0 J5 — legal facts-only position re-confirmed for the widened surface (25-cell TfNSW table) | **Jay** | OPEN. Gates a pack reaching a **paying customer**; does not gate a pilot on CIVOS's own QA project. |
| §15.1 item 4 — domain review of the Section 173 boundary outcomes | **Jay** | OPEN (above). |

## Consequence

When Jay closes his two pilot-gating items (domain review + portal re-check), **one NSW
pilot project may be flipped to `testSufficiencyMode: 'block'`** — opt-in per project,
audited, instantly reversible with no deploy (J1). Everything else stays in warn.

## Standing ceilings (developer-facing records, §15 item 9)

The multi-layer, one-shift, <2 m-wide and minor-works ceilings live in pack headers and
rule labels and are **not** user-visible disclosures; user-visible surfaces carry only the
+2.0% non-computation, the small-area caveat, and the Major Works scope in the citation.
Straight-edge and core-integrity pavement rules are deliberately absent (#1616): the
test-category namespace has no canonical category for them yet, and shipping them would
have created permanently unsatisfiable zero-count rules — they return when the vocabulary
grows, as a pack-class change.
