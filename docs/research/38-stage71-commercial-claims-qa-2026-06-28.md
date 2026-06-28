# Stage71 Commercial Claims and Docket QA

Date: 2026-06-28
Branch: `qa/stage71-commercial-claims-audit`

## Scope

This pass followed the paying-user readiness audit into the commercial workflow:

- Progress claim status transitions, SOPA deadline presentation, and reporting totals.
- Docket approval totals, commercial amount visibility, PDF/CSV output, and mobile cards.
- Legacy offline docket sync behavior.
- Lot-level docket cost splitting.

Three read-only subagent audits were used for breadth:

- Claims/SOPA: zero-dollar certification, partial-payment dispute flow, disputed-claim report totals.
- Access: docket commercial amounts exposed to non-commercial internal roles.
- Dockets: approval card mismatches, create-time hours, offline docket replay, and fractional lot costs.

## Findings Fixed

### Claims and SOPA

- Zero-dollar certified claims now settle immediately as `paid` with `paidAmount = 0` and `paidAt` set, instead of getting stuck as a certified claim with no payable balance.
- Partially paid claims can now be marked as disputed from both backend transition validation and the claims table action surface.
- Claims presentation preserves real zero amounts instead of converting zero certified/paid values to `null`.
- Claims report financial totals now align with the main claims page: disputed claims no longer inflate live certified/outstanding totals, while gross claimed/paid totals remain visible.
- VIC SOPA due-date chips are suppressed for claims submitted on or after 2026-04-15 until the post-reform timing model is legally verified.
- Payment due status no longer shows an overdue/payment due state when the certified balance is already settled.

### Dockets

- Approved docket costs are rounded to cents using the docket rounding helper, including prorated approved-cost fallback paths.
- Docket read APIs now redact commercial amounts for operational/read-only internal roles that should not see money:
  `foreman`, `quality_manager`, `site_manager`, `site_engineer`, `viewer`, and `member`.
- Owners, admins, project managers, and linked standalone subcontractors keep commercial amount visibility.
- Docket list/detail/labour-entry/plant-entry responses redact rates and cost totals consistently when the viewer lacks commercial access.
- Desktop table, mobile cards, approval modal, CSV export, and docket PDF output now show `Restricted` instead of presenting hidden money as `$0.00`.
- Mobile approved docket cards now show approved hours, with submitted hours struck through when adjusted, matching desktop behavior.
- Approval modal now shows approved-hour adjustments even when approved-cost totals are absent.
- Docket create API no longer accepts or echoes create-time labour/plant hours that are not persisted.
- Desktop create docket modal no longer asks for labour/plant hours; entries must be added through the entry workflow.

### Offline and Lot Cost Safety

- Legacy offline docket create/submit sync no longer attempts a lossy replay that can drop labour, plant, rates, and lot allocations.
- Offline docket queue items now stay visible with an explanatory sync error until a safe entry replay flow exists.
- Lot-level docket cost splitting now rounds to cents and deterministically assigns residual cents so split totals reconcile to the source cost.

## Follow-Ups Still Open

- Full VIC post-15-Apr-2026 SOPA reform timing still needs legal sign-off before hard statutory deadline chips are re-enabled.
- NSW/WA subcontract payment tiers still need a claim-direction model before precise subcontractor SOPA deadlines can be shown.
- A proper offline docket replay flow should eventually create the docket and then replay labour entries, plant entries, rates, and lot allocations through the normal entry endpoints.
- If the legacy desktop docket create flow remains important, consider adding a clearer entry-first next step after creating the docket.

## Verification

- Backend focused regressions: 9 files, 149 tests passed.
- Frontend focused regressions: 9 files, 201 tests passed.
- Backend type-check: passed.
- Frontend type-check: passed.
- Backend lint: passed with one existing warning in `backend/src/lib/dataRetention.test.ts`.
- Frontend lint: passed with one existing warning in `frontend/src/lib/theme.tsx`.
