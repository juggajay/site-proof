# Stage 67 - Documents, Storage, Evidence, And Report Links QA

Date: 2026-06-28
Branch: `qa/stage67-documents-storage-qa`
Base: `b896bcac Fix docket QA scoping and submission guards (#1202)`

## Scope

This pass focused on customer-visible file access and email-delivered links:

- Owner/project Documents page and category filters.
- Classic subcontractor documents page.
- Subbie mobile shell documents.
- Foreman mobile shell drawings/docs and photos.
- Backend document read/upload authorization, especially evidence categories.
- Hold-point external superintendent release-request email links.
- Scheduled report email delivery.

## Fixes Made

1. Document lists no longer silently stop at the backend default of 20 rows.
   - Owner documents, classic subbie documents, subbie shell docs, and foreman photos now request `limit=100`.
   - Subbie shell docs also gained a retry action for failed loads.

2. Owner document category filtering now handles Uncategorized documents.
   - The UI sends `category=uncategorized`.
   - The backend maps that value to `category: null`.

3. Foreman lot-hub drawing links no longer show a false empty state.
   - `?lotId=` now keeps project-wide drawings visible while still filtering out drawings linked to other lots.

4. NCR evidence is separated from generic document access.
   - `ncr_evidence` is now a special document category mapped to the NCR portal module.
   - Generic subbie document listings exclude NCR evidence unless reached through NCR flows.
   - Linked NCR evidence read checks now delegate to `canReadNcr`.
   - A subbie with NCR access can stage NCR evidence before it is attached, without needing general Documents access or a lot link.

5. Scheduled report emails no longer expose recipient lists.
   - Immediate scheduled reports now send one email per recipient.
   - Immediate report emails use the PDF attachment as the delivery path and no longer include an auth-only "view online" link.
   - Digest items still keep the in-app report link for app users.

6. Initial hold-point release request emails now use the secure external release link as the primary CTA.
   - This aligns the first request email with chase emails and avoids sending an authenticated lot-page URL to an external superintendent.

## Verification

- Backend focused tests:
  - `npm test -- --run src/routes/documents/access.test.ts src/routes/documents/listRoutes.test.ts src/lib/scheduledReports.test.ts src/routes/holdpoints/requestReleaseRoutes.delivery.test.ts`
  - Result: 4 files, 24 tests passed.

- Frontend focused tests:
  - `npm run test:unit -- --run src/pages/documents/DocumentsPage.test.tsx src/pages/documents/components/DocumentsPageChrome.test.tsx src/pages/subcontractor-portal/SubcontractorDocumentsPage.test.tsx src/shell/subbie/screens/test/DocsScreen.test.tsx src/shell/screens/docs/test/DocsListScreen.test.tsx`
  - Result: 5 files, 32 tests passed.

- Type checks:
  - Backend `npm run type-check` passed.
  - Frontend `npm run type-check` passed.

## Follow-Up Candidates

- Public signed URL validation currently validates token pairing but does not re-check current access until download. Download remains protected; validation can be hardened later.
- ITP completion and claim certification document attachment flows should get stricter category/ownership allowlists in a future pass.
- Browser QA for file opening should be repeated in the final cross-role pass after this PR deploys.
