# Downloadable Files Improvement Plan — 2026-07-05

Owner-requested after live-testing the HP batch release flow (#1329) and
reviewing `HP-Evidence-Package-LOT-003-2026-07-05.pdf`. Goal: every
downloadable file is a defensible, branded, complete record — and the fix
is systemic (shared building blocks) so it stays consistent as files change.

## Findings — HP Evidence Package (the reviewed PDF)

1. **No signature on the PDF** even though the release was signed.
   Signature IS captured and stored (`HoldPoint.releaseSignatureUrl`,
   written by `publicReleaseExecution.ts:88,131`) but the evidence-package
   payload never includes it and `holdPointEvidencePdf.ts` has no
   signature block. Data plumbing gap + missing render.
2. **Released-by identity is thin**: PDF shows `Released By: super` — no
   organisation (stored in `releasedByOrg`, not plumbed), no recipient
   email of record, no release notes.
3. **Company identity effectively absent.** Branding helper exists
   (`frontend/src/lib/pdf/branding.ts`) and `holdPointEvidencePdf` calls
   it (8pt grey top-right name), but the downloaded PDF shows no company
   at all — trace whether the public payload path (`publicReleasePayload.ts`)
   omits `company`, whether the company name/logo are unset, or whether
   `buildCompanyLogoDisplayUrl` points at dead storage. Logo has never
   rendered for the owner.
4. **Checklist table is hollow**: `Completed By` column empty, no
   completed/verified dates or verifier names — the actual evidence.
5. **Placeholder noise**: "(Full photo images available in CIVOS system)",
   "(Survey coordinates … available in CIVOS system)" — reads unfinished.
   Empty sections should state "None recorded for this lot." Photos, when
   present, should embed thumbnails (already supported? verify).
6. **No document identity**: no page X of Y, no doc reference (project /
   lot / HP id), generated-by user missing.

## Findings — signature capture UX

7. **Desktop signing is awkward** (mouse-drawn). `SignaturePad` consumers:
   `PublicHoldPointReleasePage`, `BatchReleaseIdentityPanel`,
   `RecordReleaseModal`. Add a **typed-signature mode** (Draw | Type
   toggle; typed full name rendered in a cursive font to the same canvas →
   same dataURL pipeline; include "signed electronically by {name}"
   caption). No schema change.
8. Verify the manual-release path (`RecordReleaseModal`) also persists
   its signature to `releaseSignatureUrl` (it uses SignaturePad — confirm
   it lands in the same column and the PDF).

## Findings — the other generators (`frontend/src/lib/pdf/`)

All import branding EXCEPT `testCertificatePdf.ts`. Each generator hand-
rolls headers/footers/empty states → drift. Sweep each of
claimEvidencePackagePdf, conformanceReportPdf, dailyDiaryPdf, dashboardPdf,
docketDetailPdf, ncrDetailPdf, testCertificatePdf against the checklist:
- [ ] Branded header (company name + logo when set) via shared helper
- [ ] Footer: page X of Y, generated timestamp + by-whom, doc reference
- [ ] Empty sections say "None recorded", never "(available in CIVOS)"
- [ ] Every accountability field populated (who/when for each record)
- [ ] CSV exports (e.g. hold points Export CSV) — same completeness lens

## Constraint (memory: pdfGenerator is jurisdictional — DO NOT refactor)

Improvements are **additive**: shared `pdfChrome.ts`-style helpers
(header/footer/section/signature-block/empty-state) that generators call;
never rewrite jurisdiction-specific content logic. Reuse the existing
characterization harness (`JsPdfRecorder`, TZ-stable assertions) to pin
current content before touching each generator.

## Company logo dependency

Memory: logo uploads live on ephemeral Railway disk → logos vanish on
redeploy. Verify `company/logoStorage.ts`; if ephemeral, move logo storage
to Supabase (backend-mediated access per storage rules) or the logo half
of branding stays broken. Scope as its own slice if large.

## Slices

- **PR A — HP evidence package**: payload adds releasedByOrg,
  releaseSignatureUrl, releaseNotes, recipient-of-record, company branding
  on BOTH authed + public paths; PDF gets Release Authorisation section
  (name, org, method, timestamp, notes, signature image), filled checklist
  columns (completed by/at, verified by/at), branded header, doc footer,
  empty-state cleanups.
- **PR B — signature capture**: typed-signature mode in SignaturePad (all
  3 consumers get it free); confirm manual-release persistence.
- **PR C — generator sweep**: shared chrome helpers + per-generator audit
  fixes + testCertificatePdf branding + CSV completeness pass +
  characterization coverage. Logo storage fix included here or split.

Sequence: A → B (one agent, sequential) → my QA with real downloads →
C after A/B merge.

## Status 2026-07-05 + follow-up (PR D)

Shipped: PR A = #1330 (merged), PR B = #1331 (merged), PR C1 = #1332
(chrome sweep, in review), PR C2 = logo storage (in build).

PR D — backend payload gaps found in the C1 sweep (data exists
server-side; PDFs print blank blocks):
1. Test certificate: add verifiedBy/verifiedAt to TestCertificateData
   ("Verified By / Date" block prints empty today).
2. Docket detail: add approvedBy/submittedBy identities (payload carries
   only timestamps; "Approved By" prints blank).
Backend-only additive payload change + template fill; small PR.

Corrections vs original findings: testCertificatePdf was already branded
(stale premise — it only lacked footers); conformance contractor/
superintendent signature lines are intentional wet-ink blocks, not gaps.
