import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { CLAIM_SUBMISSION_OPTIONS } from '../src/pages/claims/submissionOptions';
import { getPhotoLocationLinks } from '../src/pages/lots/components/photoLocationLinks';
import { formatDateKey, getCalendarDaysSince } from '../src/lib/localDate';

async function collectSourceFiles(dir: URL): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
      if (entry.isDirectory()) {
        return collectSourceFiles(entryUrl);
      }
      return Promise.resolve(/\.[cm]?[tj]sx?$/.test(entry.name) ? [entryUrl] : []);
    }),
  );

  return nested.flat();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectProjectRouteGuard(
  appSource: string,
  routePath: string,
  pageComponent: string,
  allowedRolesExpression = 'INTERNAL_ROLES',
  routeGuardPropsPattern = '',
) {
  expect(appSource).toMatch(
    new RegExp(
      `<Route\\s+path="${escapeRegExp(routePath)}"\\s+element=\\{\\s*` +
        `<RoleProtectedRoute\\s+allowedRoles=\\{${escapeRegExp(allowedRolesExpression)}\\}${routeGuardPropsPattern}>\\s*` +
        `<${pageComponent}\\s*/>\\s*` +
        `</RoleProtectedRoute>\\s*` +
        `\\}\\s*/>`,
      's',
    ),
  );
}

test.describe('production readiness guardrails', () => {
  test('claim submission exposes only implemented methods', () => {
    expect(CLAIM_SUBMISSION_OPTIONS.map((option) => option.method)).toEqual(['download']);
  });

  test('user-facing frontend branding does not reference the retired v2 product name', async () => {
    const frontendSources = ['../index.html', '../src/index.css', '../src/lib/pdfGenerator.ts'];

    for (const relativePath of frontendSources) {
      const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');

      expect(source, `${relativePath} should not expose retired versioned branding`).not.toMatch(
        /SiteProof\s+v2/i,
      );
    }
  });

  test('subcontractor register does not fall back to bundled demo records', async () => {
    const pageSource = await readFile(
      new URL('../src/pages/subcontractors/SubcontractorsPage.tsx', import.meta.url),
      'utf8',
    );
    const typesSource = await readFile(
      new URL('../src/pages/subcontractors/types.ts', import.meta.url),
      'utf8',
    );

    expect(pageSource).not.toContain('DEMO_SUBCONTRACTORS');
    expect(typesSource).not.toContain('DEMO_SUBCONTRACTORS');
  });

  test('lot conformance reports do not synthesize missing project or evidence data', async () => {
    // The report-generation workflow moved into useConformanceReportGeneration;
    // guard both the page and the hook so neither can re-introduce synthesized
    // project/evidence data.
    const conformanceSources = await Promise.all(
      [
        '../src/pages/lots/LotDetailPage.tsx',
        '../src/pages/lots/hooks/useConformanceReportGeneration.ts',
      ].map((relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')),
    );

    for (const source of conformanceSources) {
      expect(source).not.toContain('fallbackProjectData');
      expect(source).not.toContain("name: 'Unknown Project'");
      expect(source).not.toContain('catch(() => ({ testResults: [] }))');
      expect(source).not.toContain('catch(() => ({ ncrs: [] }))');
    }

    // Positive half of the same invariant: a missing project name aborts report
    // generation instead of being defaulted. The matching runtime behavior is
    // pinned in useConformanceReportGeneration.test.ts.
    const [, reportHookSource] = conformanceSources;
    expect(reportHookSource).toContain('if (!project?.name)');
    expect(reportHookSource).toContain(
      'Project details are required before generating a conformance report.',
    );
  });

  test('lot detail keeps readiness navigation, comments, and commercial gating wired through extracted hooks', async () => {
    const lotDetailPage = await readFile(
      new URL('../src/pages/lots/LotDetailPage.tsx', import.meta.url),
      'utf8',
    );
    // The tab-panel markup moved verbatim into LotDetailTabPanel; guards on
    // strings that moved with it are asserted against the panel source, while
    // the page keeps the hook delegation and the panel wiring.
    const lotDetailTabPanel = await readFile(
      new URL('../src/pages/lots/components/LotDetailTabPanel.tsx', import.meta.url),
      'utf8',
    );

    // Readiness-driven tab navigation lives in the PR #582 hook. The page must
    // keep delegating to it — and must not re-grow its own tab/action URL-param
    // handling, which would silently fork the navigation behavior.
    expect(lotDetailPage).toContain("from './hooks/useLotReadinessNavigation'");
    expect(lotDetailPage).toContain(
      'useLotReadinessNavigation({ searchParams, setSearchParams, tabSectionRef })',
    );
    expect(lotDetailPage).toContain('onTabChange={handleReadinessTabChange}');
    expect(lotDetailPage).toContain('onTabChange={handleTabChange}');
    // The page must keep forwarding the assign-itp action wiring and the panel
    // ref into the extracted panel, and the panel must keep passing both
    // through to ITPChecklistTab.
    expect(lotDetailPage).toContain("from './components/LotDetailTabPanel'");
    expect(lotDetailPage).toContain('tabSectionRef={tabSectionRef}');
    expect(lotDetailPage).toContain('shouldOpenAssignItp={shouldOpenAssignItp}');
    expect(lotDetailPage).toContain('handleAssignItpActionHandled={handleAssignItpActionHandled}');
    expect(lotDetailTabPanel).toContain('autoOpenAssignTemplate={shouldOpenAssignItp}');
    expect(lotDetailTabPanel).toContain(
      'onAutoOpenAssignTemplateHandled={handleAssignItpActionHandled}',
    );
    expect(lotDetailTabPanel).toContain('data-testid="lot-tab-panel"');
    expect(lotDetailPage).not.toContain("searchParams.get('tab')");
    expect(lotDetailPage).not.toContain("searchParams.get('action')");
    expect(lotDetailTabPanel).not.toContain("searchParams.get('tab')");
    expect(lotDetailTabPanel).not.toContain("searchParams.get('action')");

    // The conformance report PDF stays dynamically imported via the extracted
    // hook; neither the page nor the tab panel may statically pull the PDF
    // bundle back in.
    expect(lotDetailPage).toContain("from './hooks/useConformanceReportGeneration'");
    expect(lotDetailPage).not.toContain("'@/lib/pdfGenerator'");
    expect(lotDetailTabPanel).not.toContain("'@/lib/pdfGenerator'");

    // Lot comments stay mounted for the Lot entity.
    expect(lotDetailTabPanel).toContain('<CommentsSection entityType="Lot" entityId={lotId} />');

    // Budget-gated editability goes through the commercial-access hook, not a
    // raw role-string check.
    expect(lotDetailPage).toContain("from '@/hooks/useCommercialAccess'");
    expect(lotDetailPage).toContain('const { canViewBudgets } = useCommercialAccess()');
    expect(lotDetailPage).toContain("lot.status !== 'conformed' || Boolean(canViewBudgets)");
  });

  test('force conforming a lot requires a written reason', async () => {
    const lotDetailPage = await readFile(
      new URL('../src/pages/lots/LotDetailPage.tsx', import.meta.url),
      'utf8',
    );
    const lotConformanceActions = await readFile(
      new URL('../src/pages/lots/hooks/useLotConformanceActions.ts', import.meta.url),
      'utf8',
    );
    const conformDialogs = await readFile(
      new URL('../src/pages/lots/components/ConformLotDialogs.tsx', import.meta.url),
      'utf8',
    );

    // Page-level guard: no force-conform API call without a >= 5 character
    // trimmed reason, and the reason travels in the request body.
    expect(lotDetailPage).toContain('useLotConformanceActions');
    expect(lotConformanceActions).toContain('if (force && trimmedReason.length < 5)');
    expect(lotConformanceActions).toContain("title: 'Reason required'");
    expect(lotConformanceActions).toContain(
      'body: JSON.stringify({ force: true, reason: trimmedReason })',
    );

    // Dialog-level guard: the destructive confirm stays disabled until the
    // trimmed reason is long enough. Runtime behavior is pinned in
    // ConformLotDialogs.test.tsx.
    expect(conformDialogs).toContain(
      'confirmDisabled={forceConformReason.trim().length < 5 || isConforming}',
    );
    expect(conformDialogs).toContain('htmlFor="force-conform-reason"');
  });

  test('foreman diary finish flow can acknowledge backend submission warnings', async () => {
    const source = await readFile(
      new URL('../src/components/foreman/DiaryFinishFlow.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('extractErrorDetails');
    expect(source).toContain('requiresAcknowledgement');
    expect(source).toContain('acknowledgeWarnings: true');
    expect(source).toContain('Submit with warnings');
  });

  test('paid-product actions do not expose known dead-end alerts', async () => {
    const companySettings = await readFile(
      new URL('../src/pages/company/CompanySettingsPage.tsx', import.meta.url),
      'utf8',
    );
    const companySettingsSections = await readFile(
      new URL('../src/pages/company/components/CompanySettingsSections.tsx', import.meta.url),
      'utf8',
    );
    const claimsPage = await readFile(
      new URL('../src/pages/claims/ClaimsPage.tsx', import.meta.url),
      'utf8',
    );
    const createClaimModal = await readFile(
      new URL('../src/pages/claims/components/CreateClaimModal.tsx', import.meta.url),
      'utf8',
    );
    const disputeModal = await readFile(
      new URL('../src/pages/claims/components/DisputeModal.tsx', import.meta.url),
      'utf8',
    );
    const completenessModal = await readFile(
      new URL('../src/pages/claims/components/CompletenessCheckModal.tsx', import.meta.url),
      'utf8',
    );
    const documentsPage = await readFile(
      new URL('../src/pages/documents/DocumentsPage.tsx', import.meta.url),
      'utf8',
    );
    const documentFiltersPanel = await readFile(
      new URL('../src/pages/documents/components/DocumentFiltersPanel.tsx', import.meta.url),
      'utf8',
    );
    const documentGrid = await readFile(
      new URL('../src/pages/documents/components/DocumentGrid.tsx', import.meta.url),
      'utf8',
    );
    const drawingsPage = await readFile(
      new URL('../src/pages/drawings/DrawingsPage.tsx', import.meta.url),
      'utf8',
    );
    const drawingRegisterTable = await readFile(
      new URL('../src/pages/drawings/components/DrawingRegisterTable.tsx', import.meta.url),
      'utf8',
    );
    const testResultsPage = await readFile(
      new URL('../src/pages/tests/TestResultsPage.tsx', import.meta.url),
      'utf8',
    );
    const uploadCertificateModal = await readFile(
      new URL('../src/pages/tests/components/UploadCertificateModal.tsx', import.meta.url),
      'utf8',
    );
    const batchUploadModal = await readFile(
      new URL('../src/pages/tests/components/BatchUploadModal.tsx', import.meta.url),
      'utf8',
    );

    expect(companySettings).not.toContain("alert('Contact sales@siteproof.com");
    expect(companySettings).not.toContain("alert('Contact billing@siteproof.com");
    expect(companySettings).not.toContain('sales@siteproof.com');
    expect(companySettings).not.toContain('billing@siteproof.com');
    expect(companySettings).toContain('/api/support/contact');
    expect(companySettingsSections).toContain('supportMailtoHref');
    expect(claimsPage).not.toContain('alert(');
    expect(createClaimModal).not.toContain('alert(');
    expect(disputeModal).not.toContain('alert(');
    expect(documentsPage).not.toContain('alert(');
    expect(documentFiltersPanel).not.toContain('alert(');
    expect(documentGrid).not.toContain('alert(');
    expect(drawingsPage).not.toContain('alert(');
    expect(drawingRegisterTable).not.toContain('alert(');
    expect(testResultsPage).not.toContain('alert(');
    expect(uploadCertificateModal).not.toContain('alert(');
    expect(batchUploadModal).not.toContain('alert(');
    expect(claimsPage).not.toContain('Lot exclusion must be handled');
    expect(completenessModal).not.toContain('Exclude Problem Lots');
  });

  test('claim creation requires explicit lot percentages instead of backend defaults', async () => {
    const createClaimModal = await readFile(
      new URL('../src/pages/claims/components/CreateClaimModal.tsx', import.meta.url),
      'utf8',
    );
    const claimsWorkflowRoute = await readFile(
      new URL('../../backend/src/routes/claims/workflowRoutes.ts', import.meta.url),
      'utf8',
    );
    const claimsWorkflowValidation = await readFile(
      new URL('../../backend/src/routes/claims/workflowValidation.ts', import.meta.url),
      'utf8',
    );

    // Cumulative claiming: the modal seeds an explicit per-lot percentage from
    // each lot's remaining (still-claimable) percentage instead of a hardcoded
    // 100. The guard still proves the modal sends an explicit percentage rather
    // than leaving it blank for the backend to default.
    expect(createClaimModal).toContain(
      'percentComplete: String(Number(remainingPercentage.toFixed(2)))',
    );
    expect(createClaimModal).toContain('required');
    expect(createClaimModal).toContain('Percent complete is required for every selected lot.');
    expect(claimsWorkflowValidation).toContain('Each claimed lot must include percentageComplete');
    expect(claimsWorkflowRoute).not.toContain('percentageComplete: lot.percentageComplete ?? 100');
    expect(claimsWorkflowRoute).not.toContain('percentageComplete: 100,');
  });

  test('claim evidence review uses deterministic wording instead of AI branding', async () => {
    const claimsTable = await readFile(
      new URL('../src/pages/claims/components/ClaimsTable.tsx', import.meta.url),
      'utf8',
    );
    const completenessModal = await readFile(
      new URL('../src/pages/claims/components/CompletenessCheckModal.tsx', import.meta.url),
      'utf8',
    );

    expect(claimsTable).not.toContain('AI Completeness Check');
    expect(completenessModal).not.toMatch(/\bAI\b|Brain|Completeness Analysis|AI Suggestions/);
    expect(completenessModal).toContain('Claim Evidence Review');
    expect(completenessModal).toContain('Reviewing claim evidence');
    expect(completenessModal).toContain('Recommended actions');
  });

  test('Australia/Sydney date keys do not roll back to the UTC day', () => {
    const earlySydneyMorning = new Date('2026-05-20T14:30:00.000Z');

    expect(formatDateKey(earlySydneyMorning)).toBe('2026-05-21');
    expect(getCalendarDaysSince('2026-05-21', '2026-05-20T14:30:00.000Z')).toBe(0);
  });

  test('date-only defaults and export filenames avoid UTC ISO day slicing', async () => {
    const criticalDateSources = [
      '../src/pages/DashboardPage.tsx',
      '../src/pages/diary/hooks/useDiaryData.ts',
      '../src/pages/diary/components/DiaryDateSelector.tsx',
      '../src/pages/tests/TestResultsPage.tsx',
      '../src/pages/tests/constants.ts',
      '../src/pages/ncr/hooks/useNCRActions.ts',
      '../src/lib/csv.ts',
    ];

    for (const relativePath of criticalDateSources) {
      const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');

      expect(source, `${relativePath} should use local date helpers`).not.toContain(
        "toISOString().split('T')[0]",
      );
    }
  });

  test('landing page avoids unverifiable claims and unmounted CTA routes', async () => {
    // The early-access landing is a single namespaced page (no fabricated
    // stats, logos or testimonials, by design). Guard the source against
    // invented proof and dead CTA routes.
    const joinedSource = await readFile(
      new URL('../src/pages/LandingPage.tsx', import.meta.url),
      'utf8',
    );

    // No invented social proof, customer names, or unsourced figures.
    expect(joinedSource).not.toContain('50+');
    expect(joinedSource).not.toContain('Pacific Civil');
    expect(joinedSource).not.toContain('Georgiou');
    expect(joinedSource).not.toContain('Unlimited data storage');
    expect(joinedSource).not.toContain('Support via email & phone');
    expect(joinedSource).not.toContain('Setup in one week');
    expect(joinedSource).not.toContain('Most teams');
    expect(joinedSource).not.toContain('1300 555 123');
    // No CTA points at a route that is not mounted in App.tsx.
    expect(joinedSource).not.toContain('to="/contact"');
    expect(joinedSource).not.toContain('to="/pricing"');
    expect(joinedSource).not.toContain('to="/about"');
    expect(joinedSource).not.toContain('to="/mobile"');
    expect(joinedSource).not.toContain('href="#"');
    // The primary CTA is wired to a real endpoint, and the sample readiness
    // board is always disclosed as illustrative — never presented as a real
    // customer figure.
    expect(joinedSource).toContain('formspree.io/f/');
    expect(joinedSource).toContain('Illustrative data');
  });

  test('preview object URLs are revoked in upload flows', async () => {
    const uploadCertificateModal = await readFile(
      new URL('../src/pages/tests/components/UploadCertificateModal.tsx', import.meta.url),
      'utf8',
    );
    const commentsSection = await readFile(
      new URL('../src/components/comments/CommentsSection.tsx', import.meta.url),
      'utf8',
    );
    const commentThreadItem = await readFile(
      new URL('../src/components/comments/CommentThreadItem.tsx', import.meta.url),
      'utf8',
    );
    const quickPhotoCapture = await readFile(
      new URL('../src/components/QuickPhotoCapture.tsx', import.meta.url),
      'utf8',
    );
    const offlinePhotoCompression = await readFile(
      new URL('../src/lib/offlinePhotoCompression.ts', import.meta.url),
      'utf8',
    );

    expect(uploadCertificateModal).toContain('URL.revokeObjectURL(pdfUrlRef.current)');
    expect(commentsSection).toContain('revokeAttachmentPreviews(pendingAttachmentsRef.current)');
    expect(commentsSection).toContain('revokeAttachmentPreviews(replyAttachmentsRef.current)');
    expect(commentsSection).toContain('const clearPendingDraft = useCallback');
    expect(commentsSection).toContain('const clearReplyDraft = useCallback');
    expect(commentsSection).toContain('const beginReply = useCallback');
    expect(commentsSection).toContain('[entityType, entityId, clearPendingDraft, clearReplyDraft]');
    // The draft-clearing callbacks are wired into the extracted thread item,
    // whose reply controls invoke them on cancel and on switching reply targets.
    expect(commentsSection).toContain('onClearReplyDraft={clearReplyDraft}');
    expect(commentsSection).toContain('onBeginReply={beginReply}');
    expect(commentThreadItem).toContain('onClick={onClearReplyDraft}');
    expect(commentThreadItem).toContain('onClick={() => onBeginReply(comment.id)}');
    expect(quickPhotoCapture).toContain('URL.revokeObjectURL(previewUrlRef.current)');
    expect(quickPhotoCapture).not.toContain('alert(');
    expect(offlinePhotoCompression).toContain('URL.revokeObjectURL(objectUrl)');
  });

  test('blob downloads use centralized delayed URL revocation', async () => {
    const downloads = await readFile(new URL('../src/lib/downloads.ts', import.meta.url), 'utf8');
    const csv = await readFile(new URL('../src/lib/csv.ts', import.meta.url), 'utf8');
    const commentsSection = await readFile(
      new URL('../src/components/comments/CommentsSection.tsx', import.meta.url),
      'utf8',
    );
    const lotQrCode = await readFile(
      new URL('../src/components/lots/LotQRCode.tsx', import.meta.url),
      'utf8',
    );
    const printLabelsModal = await readFile(
      new URL('../src/components/lots/PrintLabelsModal.tsx', import.meta.url),
      'utf8',
    );
    const delayRegister = await readFile(
      new URL('../src/pages/diary/DelayRegisterPage.tsx', import.meta.url),
      'utf8',
    );
    const settingsPage = await readFile(
      new URL('../src/pages/settings/SettingsPage.tsx', import.meta.url),
      'utf8',
    );

    expect(downloads).toContain('BLOB_URL_REVOKE_DELAY_MS');
    expect(downloads).toContain('window.setTimeout(() => URL.revokeObjectURL(url)');
    expect(csv).toContain('downloadBlob(blob');

    for (const source of [
      commentsSection,
      lotQrCode,
      printLabelsModal,
      delayRegister,
      settingsPage,
    ]) {
      expect(source).toContain('downloadBlob(');
      expect(source).not.toContain('URL.createObjectURL(blob)');
      expect(source).not.toContain('window.URL.createObjectURL(blob)');
    }
  });

  test('comment attachment downloads go through the authenticated API', async () => {
    const commentsSection = await readFile(
      new URL('../src/components/comments/CommentsSection.tsx', import.meta.url),
      'utf8',
    );

    expect(commentsSection).toContain('attachment.downloadUrl ??');
    expect(commentsSection).toContain('`/api/comments/attachments/${attachment.id}/download`');
    expect(commentsSection).toContain('authFetch(downloadUrl)');
    expect(commentsSection).toContain("downloadBlob(blob, attachment.filename, 'attachment')");
    expect(commentsSection).not.toContain('window.open(attachment.fileUrl');
    expect(commentsSection).not.toContain('SUPABASE_URL');
    expect(commentsSection).not.toContain('isSupabaseCommentAttachmentUrl');
  });

  test('comment submissions with files use a single multipart create request', async () => {
    const commentsSection = await readFile(
      new URL('../src/components/comments/CommentsSection.tsx', import.meta.url),
      'utf8',
    );
    const commentsSectionHelpers = await readFile(
      new URL('../src/components/comments/commentsSectionHelpers.ts', import.meta.url),
      'utf8',
    );

    expect(commentsSection).not.toContain('/api/comments/attachments/upload');
    expect(commentsSectionHelpers).toContain('function buildCommentFormData');
    expect(commentsSectionHelpers).toContain("formData.append('files', file)");
    expect(commentsSection).toContain("authFetch('/api/comments'");
  });

  test('frontend public URL config rejects unsafe production values', async () => {
    const configSource = await readFile(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
    const viteConfig = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
    const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

    expect(configSource).toContain('VITE_API_URL');
    expect(configSource).toContain('VITE_SUPABASE_URL');
    expect(configSource).toContain('must use HTTPS in production');
    expect(configSource).toContain('cannot point to localhost in production');
    expect(configSource).toContain('must not use placeholder values in production');
    expect(configSource).toContain("withoutTrailingSlash.startsWith('/')");
    expect(viteConfig).toContain('validateProductionPublicEnv');
    expect(viteConfig).toContain("mode === 'production'");
    expect(viteConfig).toContain("validateProductionPublicBaseUrl('VITE_API_URL'");
    expect(viteConfig).toContain("validateProductionPublicBaseUrl('VITE_SUPABASE_URL'");
    expect(viteConfig).toContain('must be an absolute HTTP(S) URL or a same-origin path');
    expect(viteConfig).toContain('must use HTTPS in production');
    expect(viteConfig).toContain('cannot point to localhost in production');
    expect(viteConfig).toContain('must not use placeholder values in production');
    expect(envExample).toContain('Local development backend API URL');
    expect(envExample).toContain('Production builds must use /api or a public HTTPS origin');
    expect(envExample).toContain('Leave VITE_SUPABASE_URL blank in production');
  });

  test('frontend API URL helper avoids duplicate API prefixes for same-origin bases', async () => {
    const configSource = await readFile(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
    const sourceFiles = await collectSourceFiles(new URL('../src/', import.meta.url));

    expect(configSource).toContain('const API_PATH_PREFIX');
    expect(configSource).toContain('normalizedBaseUrl.endsWith(API_PATH_PREFIX)');
    expect(configSource).toContain('normalizedPath.startsWith(`${API_PATH_PREFIX}/`)');

    for (const file of sourceFiles) {
      const source = await readFile(file, 'utf8');

      expect(
        source,
        `${file.pathname} should use apiUrl() instead of direct API_URL + /api concatenation`,
      ).not.toMatch(/\$\{(?:API_URL|apiUrl)\}\/api/);
      expect(
        source,
        `${file.pathname} should not copy API_URL into a local apiUrl string`,
      ).not.toMatch(/const\s+apiUrl\s*=\s*API_URL/);
      expect(
        source,
        `${file.pathname} should use apiUrl() for relative backend assets`,
      ).not.toMatch(/\$\{API_URL\}\$\{/);
    }
  });

  test('comment attachment downloads force safe MIME response headers', async () => {
    const commentAttachmentStorage = await readFile(
      new URL('../../backend/src/routes/comments/attachmentStorage.ts', import.meta.url),
      'utf8',
    );

    expect(commentAttachmentStorage).toContain('function getSafeAttachmentMimeType');
    expect(commentAttachmentStorage).toContain(
      "res.setHeader('Content-Type', getSafeAttachmentMimeType(attachment.mimeType))",
    );
    expect(commentAttachmentStorage).toContain(
      "res.setHeader('X-Content-Type-Options', 'nosniff')",
    );
    expect(commentAttachmentStorage).toContain('getSafeAttachmentMimeType(attachment.mimeType)');
  });

  test('document downloads only redirect to configured Supabase storage URLs', async () => {
    const documentsRoute = await readFile(
      new URL('../../backend/src/routes/documents.ts', import.meta.url),
      'utf8',
    );
    const documentFileHelpers = await readFile(
      new URL('../../backend/src/routes/documents/fileHelpers.ts', import.meta.url),
      'utf8',
    );
    const supabaseSource = await readFile(
      new URL('../../backend/src/lib/supabase.ts', import.meta.url),
      'utf8',
    );

    expect(documentFileHelpers).toContain('function isSafeExternalDocumentUrl');
    expect(documentFileHelpers).toContain(
      'getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET) !== null',
    );
    expect(documentFileHelpers).toContain('if (!isSafeExternalDocumentUrl(document.fileUrl))');
    expect(documentsRoute).toContain('sendDocumentFile');
    expect(supabaseSource).toContain('parsedFileUrl.origin !== parsedSupabaseUrl.origin');
    expect(supabaseSource).toContain('parsedFileUrl.username || parsedFileUrl.password');
  });

  test('private static uploads are blocked after path decoding in production', async () => {
    const staticUploads = await readFile(
      new URL('../../backend/src/lib/staticUploads.ts', import.meta.url),
      'utf8',
    );

    expect(staticUploads).toContain('decodeURIComponent(normalizedPath)');
    expect(staticUploads).toContain("res.setHeader('X-Content-Type-Options', 'nosniff')");
    expect(staticUploads).toContain(
      "res.status(404).json({ error: { message: 'File not found' } })",
    );
    expect(staticUploads).toContain("'documents'");
    expect(staticUploads).toContain("'drawings'");
    expect(staticUploads).toContain("'certificates'");
    expect(staticUploads).toContain("'comments'");
  });

  test('comment API requests and timestamps are guarded for production inputs', async () => {
    const commentsSection = await readFile(
      new URL('../src/components/comments/CommentsSection.tsx', import.meta.url),
      'utf8',
    );
    const commentsData = await readFile(
      new URL('../src/components/comments/commentsData.ts', import.meta.url),
      'utf8',
    );
    const commentsSectionHelpers = await readFile(
      new URL('../src/components/comments/commentsSectionHelpers.ts', import.meta.url),
      'utf8',
    );

    // The comments path builder now lives in the Query-backed data module; assert
    // the safe String() coercion there, while the timestamp guard and the error
    // extraction call site remain in the component.
    expect(commentsData).toContain('function buildCommentsPath');
    expect(commentsData).toContain('page: String(page)');
    expect(commentsData).toContain('limit: String(COMMENTS_PAGE_LIMIT)');
    expect(commentsData).not.toContain(
      '`/api/comments?entityType=${entityType}&entityId=${entityId}`',
    );
    expect(commentsSectionHelpers).toContain("return 'Unknown date'");
    expect(commentsSection).toContain('extractResponseError(responseText');
    expect(commentsSection).not.toContain(
      '`/api/comments?entityType=${entityType}&entityId=${entityId}`',
    );
  });

  test('QR print and download markup sanitizes generated SVG', async () => {
    const printLabelsModal = await readFile(
      new URL('../src/components/lots/PrintLabelsModal.tsx', import.meta.url),
      'utf8',
    );
    const lotQrCode = await readFile(
      new URL('../src/components/lots/LotQRCode.tsx', import.meta.url),
      'utf8',
    );

    expect(printLabelsModal).toContain('DOMPurify.sanitize(printContent.innerHTML)');
    expect(printLabelsModal).toContain('DOMPurify.sanitize(downloadQrSvgs[lot.id] ??');
    expect(printLabelsModal).toContain('printWindow.opener = null');
    expect(lotQrCode).toContain('function sanitizeQrDownloadFilename');
    expect(lotQrCode).toContain('DOMPurify.sanitize(printQrSvg)');
    expect(lotQrCode).toContain('const safeDownloadQrSvg = DOMPurify.sanitize(downloadQrSvg)');
    expect(lotQrCode).toContain(
      'downloadBlob(blob, sanitizeQrDownloadFilename(`qr-${lotNumber}.svg`),',
    );
    expect(lotQrCode).toContain('printWindow.opener = null');
    expect(printLabelsModal).not.toContain('alert(');
    expect(lotQrCode).not.toContain('alert(');
  });

  test('rich text rendering uses a narrow sanitizer policy', async () => {
    const sanitizer = await readFile(
      new URL('../src/lib/sanitizeRichText.ts', import.meta.url),
      'utf8',
    );
    const richTextEditor = await readFile(
      new URL('../src/components/ui/RichTextEditor.tsx', import.meta.url),
      'utf8',
    );
    const weatherTab = await readFile(
      new URL('../src/pages/diary/components/WeatherTab.tsx', import.meta.url),
      'utf8',
    );

    expect(sanitizer).toContain('ALLOWED_URI_REGEXP: SAFE_RICH_TEXT_URI_PATTERN');
    expect(sanitizer).toContain('https?:|mailto:|tel:');
    expect(sanitizer).toContain('|\\/(?!\\/)|#');
    expect(sanitizer).toContain('ALLOW_ARIA_ATTR: false');
    expect(sanitizer).toContain('ALLOW_DATA_ATTR: false');
    expect(sanitizer).not.toContain('ALLOW_UNKNOWN_PROTOCOLS: true');
    expect(richTextEditor).toContain(
      "document.execCommand('insertHTML', false, sanitizeRichTextHtml(html))",
    );
    expect(weatherTab).toMatch(
      /dangerouslySetInnerHTML=\{\{\s*__html:\s*sanitizeRichTextHtml\(weatherForm\.generalNotes\),?\s*\}\}/,
    );
  });

  test('mock OAuth remains development-only and explicitly gated', async () => {
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const authRoute = await readFile(
      new URL('../../backend/src/routes/auth.ts', import.meta.url),
      'utf8',
    );
    const oauthRoute = await readFile(
      new URL('../../backend/src/routes/oauth.ts', import.meta.url),
      'utf8',
    );
    const oauthHelpers = await readFile(
      new URL('../../backend/src/routes/oauth/helpers.ts', import.meta.url),
      'utf8',
    );
    const runtimeConfig = await readFile(
      new URL('../../backend/src/lib/runtimeConfig.ts', import.meta.url),
      'utf8',
    );

    expect(appSource).toContain(
      "import.meta.env.DEV && import.meta.env.VITE_ALLOW_MOCK_OAUTH === 'true'",
    );
    expect(appSource).toContain('const OAuthMockPage = ENABLE_MOCK_OAUTH_ROUTE');
    expect(appSource).toContain('{ENABLE_MOCK_OAUTH_ROUTE && OAuthMockPage && (');
    expect(oauthHelpers).toContain(
      "process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_OAUTH === 'true'",
    );
    expect(oauthRoute).toContain('if (!isMockOAuthEnabled())');
    expect(oauthRoute).toContain("throw AppError.notFound('Resource')");
    expect(oauthRoute).toContain(
      'return res.redirect(`${frontendUrl}/login?error=oauth_not_configured`)',
    );
    expect(runtimeConfig).toContain('isExplicitlyEnabled(process.env.ALLOW_MOCK_OAUTH)');
    expect(runtimeConfig).toContain('ALLOW_MOCK_OAUTH=true is not allowed in production');
    expect(authRoute).toContain("process.env.NODE_ENV === 'production'");
    expect(authRoute).toContain("process.env.ALLOW_TEST_AUTH_ENDPOINTS !== 'true'");
    expect(runtimeConfig).toContain('isExplicitlyEnabled(process.env.ALLOW_TEST_AUTH_ENDPOINTS)');
    expect(runtimeConfig).toContain('ALLOW_TEST_AUTH_ENDPOINTS=true is not allowed in production');
  });

  test('authenticated app overlays are scoped to the protected route shell', async () => {
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const protectedShellSource = await readFile(
      new URL('../src/components/layouts/ProtectedAppShell.tsx', import.meta.url),
      'utf8',
    );
    const errorBoundarySource = await readFile(
      new URL('../src/components/ErrorBoundary.tsx', import.meta.url),
      'utf8',
    );

    expect(appSource).toContain('const ProtectedAppShell = lazy(() =>');
    expect(appSource).toContain('<Route element={<ProtectedAppShell />}>');
    expect(appSource).not.toContain("import { MainLayout } from '@/components/layouts/MainLayout'");
    expect(appSource).not.toContain("from '@/components/OnboardingTour'");
    expect(appSource).not.toContain("from '@/components/ChangelogNotification'");
    expect(appSource).not.toContain("from '@/components/SessionTimeoutWarning'");
    expect(protectedShellSource).toMatch(
      /<ProtectedRoute>\s*<KeyboardShortcutsProvider>\s*<CompanyOnboardingGate>\s*<MainLayout\s*\/>\s*<\/CompanyOnboardingGate>\s*<\/KeyboardShortcutsProvider>\s*<\/ProtectedRoute>/,
    );
    expect(appSource).not.toMatch(/<KeyboardShortcutsProvider>\s*<Suspense/);
    expect(protectedShellSource).toContain(
      '<OnboardingTour enabled={showGeneralOnboarding} autoShow={autoShowGeneralOnboarding} />',
    );
    expect(protectedShellSource).not.toContain('ChangelogNotification');
    expect(protectedShellSource).toContain('<SessionTimeoutWarning />');
    expect(errorBoundarySource).toContain('useNavigate');
    expect(errorBoundarySource).toContain("navigate('/dashboard', { replace: true })");
    expect(errorBoundarySource).toContain('reportClientError');
    expect(errorBoundarySource).toContain("reportStatus: 'pending'");
    expect(errorBoundarySource).not.toContain('Our team has been notified');
    expect(errorBoundarySource).not.toContain('window.location.reload');
    expect(errorBoundarySource).not.toContain('window.location.href');
  });

  test('general onboarding tour is not forced onto subcontractor portal users', async () => {
    const protectedShellSource = await readFile(
      new URL('../src/components/layouts/ProtectedAppShell.tsx', import.meta.url),
      'utf8',
    );
    const onboardingSource = await readFile(
      new URL('../src/components/OnboardingTour.tsx', import.meta.url),
      'utf8',
    );

    expect(protectedShellSource).toContain('const showGeneralOnboarding =');
    expect(protectedShellSource).toContain('Boolean(user?.companyId)');
    expect(protectedShellSource).toContain('!SUBCONTRACTOR_ROLES.includes(userRole)');
    expect(protectedShellSource).toContain('!isCompanySetupRoute');
    // First-run auto-show excludes foremen (desktop-oriented steps); replay
    // from the header stays available to them.
    expect(protectedShellSource).toContain('const autoShowGeneralOnboarding =');
    expect(protectedShellSource).toContain('!isForemanDashboardUser(user)');
    expect(protectedShellSource).toContain(
      '<OnboardingTour enabled={showGeneralOnboarding} autoShow={autoShowGeneralOnboarding} />',
    );
    expect(onboardingSource).toContain('enabled = true');
    expect(onboardingSource).toContain('if (!enabled && !forceShow)');
    // The claims/costs step never reaches roles without commercial access.
    expect(onboardingSource).toContain('!step.commercial || hasCommercialAccess');
  });

  test('root app overlay persistence uses safe storage helpers', async () => {
    const onboardingSource = await readFile(
      new URL('../src/components/OnboardingTour.tsx', import.meta.url),
      'utf8',
    );
    const changelogSource = await readFile(
      new URL('../src/components/ChangelogNotification.tsx', import.meta.url),
      'utf8',
    );
    const joinedSource = `${onboardingSource}\n${changelogSource}`;

    expect(onboardingSource).toContain('readLocalStorageItem(onboardingStorageKey(userId))');
    expect(onboardingSource).toContain(
      "writeLocalStorageItem(onboardingStorageKey(userId), 'true')",
    );
    expect(onboardingSource).toContain('removeLocalStorageItem(onboardingStorageKey(userId))');
    expect(changelogSource).toContain('readLocalStorageItem(CHANGELOG_STORAGE_KEY)');
    expect(changelogSource).toContain('writeLocalStorageItem(CHANGELOG_STORAGE_KEY, APP_VERSION)');
    expect(changelogSource).toContain('removeLocalStorageItem(CHANGELOG_STORAGE_KEY)');
    expect(joinedSource).not.toContain('localStorage.getItem');
    expect(joinedSource).not.toContain('localStorage.setItem');
    expect(joinedSource).not.toContain('localStorage.removeItem');
  });

  test('development-only frontend helpers are gated out of production', async () => {
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const authSource = await readFile(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
    const sessionTimeoutSource = await readFile(
      new URL('../src/components/SessionTimeoutWarning.tsx', import.meta.url),
      'utf8',
    );

    expect(appSource).not.toContain('import { RoleSwitcher }');
    expect(appSource).toContain('const ENABLE_DEV_TOOLS = import.meta.env.DEV');
    expect(appSource).toContain('const RoleSwitcher = ENABLE_DEV_TOOLS');
    expect(appSource).toContain('{ENABLE_DEV_TOOLS && RoleSwitcher && <RoleSwitcher />}');
    expect(authSource).toContain('if (!import.meta.env.DEV) return null');
    expect(sessionTimeoutSource).toMatch(/const\s+isTestMode\s*=\s*import\.meta\.env\.DEV\s*&&/);
  });

  test('protected route and lot error states use the shared icon system', async () => {
    const roleProtectedRoute = await readFile(
      new URL('../src/components/auth/RoleProtectedRoute.tsx', import.meta.url),
      'utf8',
    );
    const lotDetailPage = await readFile(
      new URL('../src/pages/lots/LotDetailPage.tsx', import.meta.url),
      'utf8',
    );
    const lotDetailPageStates = await readFile(
      new URL('../src/pages/lots/components/LotDetailPageStates.tsx', import.meta.url),
      'utf8',
    );

    expect(roleProtectedRoute).toContain("import { ShieldAlert } from 'lucide-react'");
    expect(roleProtectedRoute).toContain('<ShieldAlert className="h-8 w-8" aria-hidden="true" />');
    expect(lotDetailPage).toContain("from './components/LotDetailPageStates'");
    expect(lotDetailPageStates).toContain(
      "import { AlertTriangle, SearchX, ShieldAlert } from 'lucide-react'",
    );
    expect(lotDetailPageStates).toContain('<ErrorIcon className="h-8 w-8" aria-hidden="true" />');
    expect(roleProtectedRoute).not.toContain('className="text-6xl"');
    expect(lotDetailPage).not.toContain('className="text-6xl"');
    expect(lotDetailPageStates).not.toContain('className="text-6xl"');
  });

  test('backend diagnostic endpoints are gated out of production', async () => {
    const notificationEmailRoutesSource = await readFile(
      new URL('../../backend/src/routes/notifications/emailRoutes.ts', import.meta.url),
      'utf8',
    );
    const notificationsAccessSource = await readFile(
      new URL('../../backend/src/routes/notifications/access.ts', import.meta.url),
      'utf8',
    );
    const pushSource = await readFile(
      new URL('../../backend/src/routes/pushNotifications.ts', import.meta.url),
      'utf8',
    );
    const webhooksSource = await readFile(
      new URL('../../backend/src/routes/webhooks.ts', import.meta.url),
      'utf8',
    );

    // The non-production diagnostics guard was extracted to
    // notifications/access.ts; assert it still lives there and gates on
    // NODE_ENV === 'production' by throwing the forbidden error.
    expect(notificationsAccessSource).toContain('function requireNonProductionDiagnostics');
    expect(notificationsAccessSource).toContain("process.env.NODE_ENV === 'production'");
    expect(notificationsAccessSource).toContain(
      "throw AppError.forbidden('Not available in production')",
    );
    // The diagnostic email/digest routes were relocated to
    // notifications/emailRoutes.ts; that child router must still import and call
    // the guard on its diagnostic routes.
    expect(notificationEmailRoutesSource).toContain('requireNonProductionDiagnostics');
    for (const route of ['email-queue', 'add-to-digest', 'send-digest', 'digest-queue']) {
      expect(notificationEmailRoutesSource).toContain(route);
    }
    expect(pushSource).toContain("process.env.NODE_ENV === 'production'");
    expect(pushSource).toContain("throw AppError.forbidden('Not available in production')");
    expect(webhooksSource).toContain('function assertTestReceiverAvailable');
    expect(webhooksSource).toContain('Test webhook receiver is not available in production');
    expect(webhooksSource).toContain("router.post('/test-receiver'");
  });

  test('registration verification hints are gated to development builds', async () => {
    const registerPage = await readFile(
      new URL('../src/pages/auth/RegisterPage.tsx', import.meta.url),
      'utf8',
    );

    expect(registerPage).toContain('{import.meta.env.DEV && (');
    expect(registerPage).toContain('Development Mode:');
  });

  test('support and legal pages do not hardcode placeholder contact details', async () => {
    const supportPage = await readFile(
      new URL('../src/pages/support/SupportPage.tsx', import.meta.url),
      'utf8',
    );
    const termsPage = await readFile(
      new URL('../src/pages/legal/TermsOfServicePage.tsx', import.meta.url),
      'utf8',
    );
    const privacyPage = await readFile(
      new URL('../src/pages/legal/PrivacyPolicyPage.tsx', import.meta.url),
      'utf8',
    );
    const legalContactCard = await readFile(
      new URL('../src/pages/legal/LegalContactCard.tsx', import.meta.url),
      'utf8',
    );
    const contactLinks = await readFile(
      new URL('../src/lib/contactLinks.ts', import.meta.url),
      'utf8',
    );
    const myCompanyPage = await readFile(
      new URL('../src/pages/subcontractors/MyCompanyPage.tsx', import.meta.url),
      'utf8',
    );
    const supportRoute = await readFile(
      new URL('../../backend/src/routes/support.ts', import.meta.url),
      'utf8',
    );

    expect(supportPage).not.toContain('1800 SITE PROOF');
    expect(supportPage).not.toContain('0419 748 377');
    expect(termsPage).not.toContain('123 Construction Street');
    expect(privacyPage).not.toContain('123 Construction Street');
    expect(termsPage).not.toContain('ABN 12 345 678 901');
    expect(legalContactCard).toContain('/api/support/contact');
    expect(legalContactCard).toContain('supportMailtoHref(email)');
    expect(supportPage).toContain('supportMailtoHref(contactInfo.email)');
    expect(contactLinks).toContain('normalizeSupportEmail');
    expect(contactLinks).toContain('telHref');
    expect(supportRoute).not.toContain('123 Construction Street');
    expect(myCompanyPage).not.toContain('ABC Earthmoving Pty Ltd');
    expect(myCompanyPage).not.toContain('Demo data');
    expect(myCompanyPage).not.toContain('12 345 678 901');
  });

  test('emailed hold-point secure release links resolve to a public route', async () => {
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const publicReleasePage = await readFile(
      new URL('../src/pages/holdpoints/PublicHoldPointReleasePage.tsx', import.meta.url),
      'utf8',
    );
    const holdPointRequestReleaseRoute = await readFile(
      new URL('../../backend/src/routes/holdpoints/requestReleaseRoutes.ts', import.meta.url),
      'utf8',
    );

    expect(holdPointRequestReleaseRoute).toContain(
      'buildFrontendUrl(`/hp-release/${recipient.secureToken}`)',
    );
    expect(appSource).toContain('PublicHoldPointReleasePage');
    expect(appSource).toContain(
      '<Route path="/hp-release/:token" element={<PublicHoldPointReleasePage />} />',
    );
    expect(publicReleasePage).toContain('/api/holdpoints/public/${encodeURIComponent(token)}');
    expect(publicReleasePage).toContain(
      '/api/holdpoints/public/${encodeURIComponent(token)}/release',
    );
  });

  test('copied quality register links resolve to mounted project routes', async () => {
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const holdPointsPage = await readFile(
      new URL('../src/pages/holdpoints/HoldPointsPage.tsx', import.meta.url),
      'utf8',
    );
    const ncrPage = await readFile(
      new URL('../src/pages/ncr/NCRPage.tsx', import.meta.url),
      'utf8',
    );
    const ncrActions = await readFile(
      new URL('../src/pages/ncr/hooks/useNCRActions.ts', import.meta.url),
      'utf8',
    );
    const testResultsRoute = await readFile(
      new URL('../../backend/src/routes/testResults.ts', import.meta.url),
      'utf8',
    );
    const testResultsNotifications = await readFile(
      new URL('../../backend/src/routes/testResults/statusNotifications.ts', import.meta.url),
      'utf8',
    );

    expectProjectRouteGuard(
      appSource,
      '/projects/:projectId/hold-points',
      'HoldPointsPage',
      'INTERNAL_ROLES',
      '\\s+allowProjectScopedRole',
    );
    expectProjectRouteGuard(
      appSource,
      '/projects/:projectId/ncr',
      'NCRPage',
      'INTERNAL_ROLES',
      '\\s+allowProjectScopedRole',
    );
    expectProjectRouteGuard(
      appSource,
      '/projects/:projectId/tests',
      'TestResultsPage',
      'INTERNAL_ROLES',
      '\\s+allowProjectScopedRole',
    );
    expect(holdPointsPage).toContain(
      '/projects/${encodeURIComponent(projectId)}/hold-points?hp=${encodeURIComponent(hpId)}',
    );
    expect(holdPointsPage).not.toContain('/projects/${projectId}/holdpoints?hp=${hpId}');
    expect(ncrActions).toContain(
      "/projects/${encodeURIComponent(projectId || '')}/ncr?ncr=${encodeURIComponent(ncrId)}",
    );
    expect(ncrActions).not.toContain('/projects/${projectId}/ncrs?ncr=${ncrId}');
    // The copied links must also be consumed: each register reads its own
    // deep-link param and surfaces the linked record (fix for links that
    // previously landed on the unfiltered register).
    expect(holdPointsPage).toContain('useRegisterDeepLink');
    expect(holdPointsPage).toContain("param: 'hp'");
    expect(ncrPage).toContain('useRegisterDeepLink');
    expect(ncrPage).toContain("param: 'ncr'");
    expect(testResultsNotifications).toContain('/projects/${projectId}/tests');
    expect(testResultsRoute).not.toContain('/projects/${testResult.projectId}/test-results');
    expect(testResultsNotifications).not.toContain('/projects/${projectId}/test-results');
  });

  test('internal project module routes show role-denied UI before API fallback errors', async () => {
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const internalProjectRoutes = [
      ['/projects/:projectId/itp', 'ITPPage'],
      ['/projects/:projectId/hold-points', 'HoldPointsPage'],
      ['/projects/:projectId/tests', 'TestResultsPage'],
      ['/projects/:projectId/ncr', 'NCRPage'],
      ['/projects/:projectId/diary', 'DailyDiaryPage'],
      ['/projects/:projectId/documents', 'DocumentsPage'],
    ] as const;

    for (const [routePath, pageComponent] of internalProjectRoutes) {
      expectProjectRouteGuard(
        appSource,
        routePath,
        pageComponent,
        'INTERNAL_ROLES',
        '\\s+allowProjectScopedRole',
      );
    }
    expectProjectRouteGuard(
      appSource,
      '/projects/:projectId/dockets',
      'DocketApprovalsPage',
      'INTERNAL_ROLES',
      '\\s+allowProjectScopedRole',
    );
  });

  test('foreman mobile quick navigation resolves to mounted routes', async () => {
    const diaryMobileHandlers = await readFile(
      new URL('../src/pages/diary/hooks/useDiaryMobileHandlers.ts', import.meta.url),
      'utf8',
    );
    const foremanDashboard = await readFile(
      new URL('../src/components/foreman/ForemanMobileDashboard.tsx', import.meta.url),
      'utf8',
    );
    const ncrPage = await readFile(
      new URL('../src/pages/ncr/NCRPage.tsx', import.meta.url),
      'utf8',
    );
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

    expect(appSource).toContain('path="/projects/:projectId/ncr"');
    expect(appSource).toContain('path="/projects/:projectId/dockets"');
    expect(diaryMobileHandlers).toContain('dockets?status=pending_approval');
    expect(diaryMobileHandlers).not.toContain('/foreman?tab=approve');
    expect(foremanDashboard).toContain('ncr?create=1');
    expect(foremanDashboard).not.toContain('ncr/new');
    expect(ncrPage).toContain("searchParams.get('create') !== '1'");
    expect(ncrPage).toContain("openModal('create')");
  });

  test('destructive document and mobile diary deletes require confirmation dialogs', async () => {
    const documentsPage = await readFile(
      new URL('../src/pages/documents/DocumentsPage.tsx', import.meta.url),
      'utf8',
    );
    const documentsPageChrome = await readFile(
      new URL('../src/pages/documents/components/DocumentsPageChrome.tsx', import.meta.url),
      'utf8',
    );
    const diaryPage = await readFile(
      new URL('../src/pages/diary/DailyDiaryPage.tsx', import.meta.url),
      'utf8',
    );

    expect(documentsPage).toContain('DeleteDocumentDialog');
    expect(documentsPageChrome).toContain(
      "import { ConfirmDialog } from '@/components/ui/ConfirmDialog'",
    );
    expect(documentsPage).toContain('const [documentPendingDelete, setDocumentPendingDelete]');
    expect(documentsPage).toContain('setDocumentPendingDelete(doc)');
    expect(documentsPageChrome).toContain('title="Delete Document"');

    expect(diaryPage).toContain("import { ConfirmDialog } from '@/components/ui/ConfirmDialog'");
    expect(diaryPage).toContain('const [entryPendingDelete, setEntryPendingDelete]');
    expect(diaryPage).toContain('onDeleteEntry={(entry) => setEntryPendingDelete(entry)}');
    expect(diaryPage).toContain('title="Delete Diary Entry"');
    expect(diaryPage).toContain('mobile.handleDeleteEntry(entryPendingDelete)');
    expect(diaryPage).not.toContain('onDeleteEntry={mobile.handleDeleteEntry}');
  });

  test('delay register export does not download failed API responses as CSV files', async () => {
    const delayRegisterPage = await readFile(
      new URL('../src/pages/diary/DelayRegisterPage.tsx', import.meta.url),
      'utf8',
    );

    expect(delayRegisterPage).toContain('if (!response.ok)');
    expect(delayRegisterPage).toContain("setError('Failed to export delays. Please try again.')");
    expect(delayRegisterPage).not.toContain('.then(res => res.blob())');
    expect(delayRegisterPage).not.toContain("alert('Failed to export delays')");
  });

  test('backend delay CSV export guards spreadsheet formula prefixes', async () => {
    const diaryReporting = await readFile(
      new URL('../../backend/src/routes/diary/diaryReporting.ts', import.meta.url),
      'utf8',
    );
    const csvSafe = await readFile(
      new URL('../../backend/src/lib/csvSafe.ts', import.meta.url),
      'utf8',
    );

    expect(csvSafe).toContain('const CSV_FORMULA_PREFIX_PATTERN = /^[\\t\\r\\n ]*[=+\\-@]/');
    expect(csvSafe).toContain('export function escapeCsvFormulaValue(value: string): string');
    expect(csvSafe).toContain('CSV_FORMULA_PREFIX_PATTERN.test(normalizedValue)');
    expect(csvSafe).toContain("row.map(formatCsvCell).join(',')");
    expect(diaryReporting).toContain("import { buildCsv } from '../../lib/csvSafe.js'");
    expect(diaryReporting).toContain('const csv = buildCsv([csvHeaders, ...csvRows]);');
  });

  test('scheduled reports are capped per project across API and UI', async () => {
    const reportsRoute = await readFile(
      new URL('../../backend/src/routes/reports.ts', import.meta.url),
      'utf8',
    );
    const scheduledReportsRoute = await readFile(
      new URL('../../backend/src/routes/reports/scheduleRoutes.ts', import.meta.url),
      'utf8',
    );
    const scheduledReportsLib = await readFile(
      new URL('../../backend/src/lib/scheduledReports.ts', import.meta.url),
      'utf8',
    );
    const scheduledReportsCore = await readFile(
      new URL('../../backend/src/lib/scheduledReports/core.ts', import.meta.url),
      'utf8',
    );
    const backendServer = await readFile(
      new URL('../../backend/src/server.ts', import.meta.url),
      'utf8',
    );
    const backendPackage = await readFile(
      new URL('../../backend/package.json', import.meta.url),
      'utf8',
    );
    const scheduleModal = await readFile(
      new URL('../src/components/reports/ScheduleReportModal.tsx', import.meta.url),
      'utf8',
    );
    const scheduleModalHelpers = await readFile(
      new URL('../src/components/reports/scheduleReportModalHelpers.ts', import.meta.url),
      'utf8',
    );

    expect(scheduledReportsCore).toContain('export const MAX_SCHEDULED_REPORTS_PER_PROJECT = 25');
    expect(scheduledReportsLib).toContain('MAX_SCHEDULED_REPORTS_PER_PROJECT');
    expect(reportsRoute).toContain('createScheduledReportRouter');
    expect(scheduledReportsRoute).toContain('take: MAX_SCHEDULED_REPORTS_PER_PROJECT');
    expect(scheduledReportsRoute).toContain(
      'existingScheduleCount >= MAX_SCHEDULED_REPORTS_PER_PROJECT',
    );
    expect(scheduledReportsLib).toContain('processDueScheduledReports');
    expect(scheduledReportsLib).toContain('claimScheduledReport');
    expect(scheduledReportsLib).toContain('sendScheduledReportEmail');
    expect(scheduledReportsLib).toContain('pdfBuffer');
    expect(backendServer).toContain('startScheduledReportWorker');
    expect(backendPackage).toContain('reports:send-due');
    expect(scheduleModalHelpers).toContain('export const DEFAULT_MAX_SCHEDULED_REPORTS = 25');
    expect(scheduleModal).toContain('DEFAULT_MAX_SCHEDULED_REPORTS');
    expect(scheduleModal).toContain('disabled={hasReachedScheduleLimit}');
    expect(scheduleModal).toContain('A project can have up to ${maxSchedules} scheduled reports');
  });

  test('notification digest queue has a production sender', async () => {
    const notificationJobs = await readFile(
      new URL('../../backend/src/lib/notificationJobs.ts', import.meta.url),
      'utf8',
    );
    const notificationsDelivery = await readFile(
      new URL('../../backend/src/routes/notifications/delivery.ts', import.meta.url),
      'utf8',
    );
    const backendServer = await readFile(
      new URL('../../backend/src/server.ts', import.meta.url),
      'utf8',
    );
    const backendPackage = await readFile(
      new URL('../../backend/package.json', import.meta.url),
      'utf8',
    );

    expect(notificationsDelivery).toContain("timing === 'digest' && preferences.dailyDigest");
    expect(notificationJobs).toContain('processDueNotificationDigests');
    expect(notificationJobs).toContain('sendDailyDigestEmail');
    expect(notificationJobs).toContain('NOTIFICATION_DIGEST_TIME_OF_DAY');
    expect(backendServer).toContain('startNotificationDigestWorker');
    expect(backendPackage).toContain('notifications:send-digests');
  });

  test('notification automation has a production worker', async () => {
    const notificationAutomation = await readFile(
      new URL('../../backend/src/lib/notificationAutomation.ts', import.meta.url),
      'utf8',
    );
    const notificationAutomationRunner = await readFile(
      new URL('../../backend/src/lib/notificationAutomation/runner.ts', import.meta.url),
      'utf8',
    );
    const backendServer = await readFile(
      new URL('../../backend/src/server.ts', import.meta.url),
      'utf8',
    );
    const backendPackage = await readFile(
      new URL('../../backend/package.json', import.meta.url),
      'utf8',
    );

    expect(notificationAutomation).toContain('processNotificationAutomation');
    expect(notificationAutomation).toContain('processDueDiaryReminders');
    expect(notificationAutomation).toContain('processDocketBacklogAlerts');
    expect(notificationAutomation).toContain('processSystemAlerts');
    expect(notificationAutomation).toContain('processAlertEscalations');
    expect(notificationAutomation).not.toContain("from '../routes/notifications");
    expect(notificationAutomationRunner).toContain('NOTIFICATION_AUTOMATION_WORKER_ENABLED');
    expect(notificationAutomationRunner).toContain('NOTIFICATION_AUTOMATION_WORKER_INTERVAL_MS');
    expect(notificationAutomationRunner).toContain('NotificationAutomationProcess');
    expect(backendServer).toContain('startNotificationAutomationWorker');
    expect(backendPackage).toContain('notifications:process-automation');
  });

  test('seeded local E2E wiring follows configured backend environment', async () => {
    const seedScript = await readFile(
      new URL('../../backend/scripts/seed-e2e.mjs', import.meta.url),
      'utf8',
    );
    const viteConfig = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');

    expect(seedScript).toContain("import 'dotenv/config'");
    expect(viteConfig).toContain('loadEnv');
    expect(viteConfig).toContain('env.VITE_API_URL');
    expect(viteConfig).toContain('target: apiProxyTarget');
    expect(viteConfig).not.toContain("target: 'http://localhost:3001'");
  });

  test('backend production smoke exercises compiled startup and HTTPS redirects', async () => {
    const backendPackage = await readFile(
      new URL('../../backend/package.json', import.meta.url),
      'utf8',
    );
    const smokeScript = await readFile(
      new URL('../../backend/scripts/smoke-production.mjs', import.meta.url),
      'utf8',
    );

    expect(backendPackage).toContain('"smoke:production"');
    expect(smokeScript).toContain('../dist/index.js');
    expect(smokeScript).toContain("NODE_ENV: 'production'");
    expect(smokeScript).toContain("TRUST_PROXY: '1'");
    expect(smokeScript).toContain("SCHEDULED_REPORT_WORKER_ENABLED: 'false'");
    expect(smokeScript).toContain("NOTIFICATION_DIGEST_WORKER_ENABLED: 'false'");
    expect(smokeScript).toContain("NOTIFICATION_AUTOMATION_WORKER_ENABLED: 'false'");
    expect(smokeScript).toContain("headers: { 'X-Forwarded-Proto': 'https' }");
    expect(smokeScript).toContain("redirect: 'manual'");
    expect(smokeScript).toContain('expectedRedirectLocation');
    expect(smokeScript).toContain('/ready');
  });

  test('backend bootstrap validates runtime config before loading application modules', async () => {
    const bootstrapSource = await readFile(
      new URL('../../backend/src/index.ts', import.meta.url),
      'utf8',
    );
    const serverSource = await readFile(
      new URL('../../backend/src/server.ts', import.meta.url),
      'utf8',
    );

    expect(bootstrapSource).toContain("process.on('uncaughtException'");
    expect(bootstrapSource).toContain("await import('dotenv/config')");
    expect(bootstrapSource).toContain("await import('./lib/runtimeConfig.js')");
    expect(bootstrapSource).toContain('validateRuntimeConfig()');
    expect(bootstrapSource).toContain("await import('./server.js')");
    expect(bootstrapSource.indexOf('validateRuntimeConfig()')).toBeLessThan(
      bootstrapSource.indexOf("await import('./server.js')"),
    );
    expect(bootstrapSource).not.toContain('import { authRouter }');
    expect(bootstrapSource).not.toContain("import express from 'express'");
    expect(serverSource).toContain('export async function startServer()');
  });

  test('deployment docs match enforced production environment requirements', async () => {
    const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
    const migrationGuide = await readFile(new URL('../../MIGRATION.md', import.meta.url), 'utf8');
    const securityGuide = await readFile(new URL('../../SECURITY.md', import.meta.url), 'utf8');
    const readinessAudit = await readFile(
      new URL('../../docs/production-readiness-audit.md', import.meta.url),
      'utf8',
    );
    const runtimeConfig = await readFile(
      new URL('../../backend/src/lib/runtimeConfig.ts', import.meta.url),
      'utf8',
    );
    const migrationDriftScript = await readFile(
      new URL('../../backend/scripts/check-migration-drift.mjs', import.meta.url),
      'utf8',
    );
    const integrationPreflightScript = await readFile(
      new URL('../../backend/scripts/preflight-production-integrations.ts', import.meta.url),
      'utf8',
    );
    const productionPreflightWorkflow = await readFile(
      new URL('../../.github/workflows/production-preflight.yml', import.meta.url),
      'utf8',
    );
    const backendPackage = await readFile(
      new URL('../../backend/package.json', import.meta.url),
      'utf8',
    );

    for (const doc of [readme, migrationGuide]) {
      expect(doc).toContain('DATABASE_URL');
      expect(doc).toContain('JWT_SECRET');
      expect(doc).toContain('ENCRYPTION_KEY');
      expect(doc).toContain('FRONTEND_URL');
      expect(doc).toContain('BACKEND_URL');
      expect(doc).toContain('VITE_API_URL');
      expect(doc).toContain('VITE_SUPABASE_URL');
      expect(doc).toContain('/api');
      expect(doc).toContain('RESEND_API_KEY');
      expect(doc).toContain('EMAIL_FROM');
      expect(doc).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(doc).toContain('SUPPORT_RATE_LIMIT_MAX');
      expect(doc).toContain('WEBHOOK_DELIVERY_TIMEOUT_MS');
      expect(doc).toContain('ERROR_LOG_MAX_BYTES');
      expect(doc).toContain('GOOGLE_REDIRECT_URI');
      expect(doc).toContain('VAPID_SUBJECT');
      expect(doc).toContain('pg_dump');
      expect(doc).toContain('pg_restore');
      expect(doc).toContain('db:backup');
      expect(doc).toContain('smoke:production');
      expect(doc).toContain('preflight:integrations');
      expect(doc).toContain('CONFIRM_RESTORE');
      expect(doc).not.toContain('JWT_EXPIRY');
      expect(doc).not.toContain('BCRYPT_ROUNDS');
      expect(doc).not.toContain('your-secure-secret-key-here');
    }

    expect(runtimeConfig).toContain('validateRuntimeConfig');
    expect(runtimeConfig).toContain("assertOptionalPositiveInteger('SUPPORT_RATE_LIMIT_MAX')");
    expect(runtimeConfig).toContain("assertOptionalPositiveInteger('WEBHOOK_DELIVERY_TIMEOUT_MS')");
    expect(runtimeConfig).toContain("assertOptionalPositiveInteger('ERROR_LOG_MAX_BYTES')");
    expect(runtimeConfig).toContain('assertProductionEmailFrom');
    expect(runtimeConfig).toContain('assertProductionVapidConfig');
    expect(runtimeConfig).toContain('assertProductionGoogleOAuthConfig');
    expect(runtimeConfig).toContain('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    expect(securityGuide).toContain('bearer JWTs');
    expect(securityGuide).toContain('RATE_LIMIT_STORE=memory');
    expect(securityGuide).toContain('preflight:integrations');
    expect(securityGuide).toContain('Production Preflight');
    expect(securityGuide).toContain('GOOGLE_REDIRECT_URI');
    expect(securityGuide).toContain('VITE_API_URL=/api');
    expect(securityGuide).toContain('VITE_SUPABASE_URL');
    expect(securityGuide).toContain('DOMPurify');
    expect(securityGuide).toContain('pg_dump');
    expect(securityGuide).not.toContain('HTTP-only cookies');
    expect(securityGuide).not.toContain('No raw SQL queries');
    expect(readme).toContain('docs/production-readiness-audit.md');
    expect(readme).toContain('Production Preflight');
    expect(readinessAudit).toContain('Status: codebase/local readiness complete');
    expect(readinessAudit).toContain(
      'Live third-party verification was explicitly marked out of scope',
    );
    expect(readinessAudit).toContain('Latest local `npm run preflight:integrations` result');
    expect(readinessAudit).toContain('.github/workflows/production-preflight.yml');
    expect(readinessAudit).toContain('Resend live email');
    expect(readinessAudit).toContain('Supabase Storage live uploads');
    expect(readinessAudit).toContain('Google OAuth live sign-in');
    expect(readinessAudit).toContain('partial or malformed Google OAuth');
    expect(readinessAudit).toContain('Push notification delivery');
    expect(readinessAudit).toContain('GitHub Environment Secrets');
    expect(readinessAudit).toContain('DATABASE_URL');
    expect(readinessAudit).toContain('RESEND_API_KEY');
    expect(readinessAudit).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(readinessAudit).toContain('VAPID_PRIVATE_KEY');
    expect(migrationGuide).toContain('SHADOW_DATABASE_URL');
    expect(migrationDriftScript).toContain('SHADOW_DATABASE_URL is required');
    expect(migrationDriftScript).toContain('mainDatabaseIdentity === shadowDatabaseIdentity');
    expect(migrationDriftScript).toContain(
      'must not point to the same PostgreSQL database as DATABASE_URL',
    );
    expect(backendPackage).toContain('"preflight:integrations"');
    expect(integrationPreflightScript).toContain('RESEND_DOMAINS_ENDPOINT');
    expect(integrationPreflightScript).toContain('Supabase Storage bucket');
    expect(integrationPreflightScript).toContain('GOOGLE_OPENID_CONFIGURATION_ENDPOINT');
    expect(integrationPreflightScript).toContain('safeUrlForLog');
    expect(integrationPreflightScript).toContain('runNetworkRequest');
    expect(integrationPreflightScript).toContain('request failed for');
    expect(integrationPreflightScript).toContain('setVapidDetails');
    expect(productionPreflightWorkflow).toContain('workflow_dispatch');
    expect(productionPreflightWorkflow).toMatch(/permissions:\s*\r?\n\s+contents:\s+read/);
    expect(productionPreflightWorkflow).toContain('validate-dispatch:');
    expect(productionPreflightWorkflow).not.toContain('push:');
    expect(productionPreflightWorkflow).not.toContain('schedule:');
    expect(productionPreflightWorkflow).toContain(
      'Production preflight can only run from refs/heads/master.',
    );
    expect(productionPreflightWorkflow).toContain('needs: validate-dispatch');
    expect(productionPreflightWorkflow).toContain(
      'name: ${{ needs.validate-dispatch.outputs.environment }}',
    );
    expect(productionPreflightWorkflow).toContain('Check production preflight configuration');
    expect(productionPreflightWorkflow).toContain('DATABASE_URL_PRESENT');
    expect(productionPreflightWorkflow).toContain(
      'Production preflight is not configured; missing GitHub secrets',
    );
    expect(productionPreflightWorkflow).toContain('echo "::error::$message"');
    expect(productionPreflightWorkflow).not.toContain(
      'Skipping integration checks for this automatic run',
    );
    expect(productionPreflightWorkflow).not.toContain('configured=false');
    expect(productionPreflightWorkflow).toContain(
      "if: steps.preflight-config.outputs.configured == 'true'",
    );
    expect(productionPreflightWorkflow).toContain('npm run migrate:status');
    expect(productionPreflightWorkflow).toContain('npm run preflight:integrations');
    expect(productionPreflightWorkflow).toContain('secrets.RESEND_API_KEY');
    expect(productionPreflightWorkflow).toContain('secrets.SUPABASE_SERVICE_ROLE_KEY');
    expect(productionPreflightWorkflow).toContain('secrets.GOOGLE_CLIENT_SECRET');
    expect(productionPreflightWorkflow).toContain('secrets.VAPID_PRIVATE_KEY');
  });

  test('database backup helper targets PostgreSQL instead of retired local SQLite files', async () => {
    const backupScript = await readFile(
      new URL('../../backend/scripts/backup.ts', import.meta.url),
      'utf8',
    );
    const packageJson = await readFile(
      new URL('../../backend/package.json', import.meta.url),
      'utf8',
    );

    expect(backupScript).toContain('pg_dump');
    expect(backupScript).toContain('pg_restore');
    expect(backupScript).toContain('DATABASE_URL');
    expect(backupScript).toContain('CONFIRM_RESTORE');
    expect(backupScript).not.toContain('dev.db');
    expect(backupScript).not.toContain('copyFileSync(DB_PATH');
    expect(packageJson).toContain('"db:backup"');
  });

  test('backend container runs as a non-root service with a readiness healthcheck', async () => {
    const dockerfile = await readFile(new URL('../../backend/Dockerfile', import.meta.url), 'utf8');
    const dockerignore = await readFile(
      new URL('../../backend/.dockerignore', import.meta.url),
      'utf8',
    );
    const npmignore = await readFile(new URL('../../backend/.npmignore', import.meta.url), 'utf8');
    const serverSource = await readFile(
      new URL('../../backend/src/server.ts', import.meta.url),
      'utf8',
    );
    const readinessSource = await readFile(
      new URL('../../backend/src/lib/readiness.ts', import.meta.url),
      'utf8',
    );
    const ciWorkflow = await readFile(
      new URL('../../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    );

    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('/ready');
    expect(dockerfile).toContain('# syntax=docker/dockerfile:1.7');
    expect(dockerfile).not.toContain('id=npm_extra_ca');
    expect(dockerfile).not.toContain('NODE_EXTRA_CA_CERTS=/tmp/npm_extra_ca.pem');
    expect(dockerfile).toContain('FROM deps AS prod-deps');
    expect(dockerfile).toContain('npm prune --omit=dev');
    expect(dockerfile).toContain('COPY --from=prod-deps /app/node_modules ./node_modules');
    expect(dockerfile).toContain('openssl ca-certificates');
    expect(dockerfile).toContain('mkdir -p uploads/avatars');
    expect(dockerfile).toContain('chown -R node:node /app');
    expect(dockerignore).toContain('scripts');
    expect(dockerignore).toContain('src/**/*.test.ts');
    expect(dockerignore).toContain('src/**/__tests__');
    expect(dockerignore).toContain('prisma/*.db');
    expect(dockerignore).toContain('/*.js');
    expect(dockerignore).toContain('/*.cjs');
    expect(dockerignore).toContain('/*.mjs');
    expect(dockerignore).toContain('/*.sql');
    expect(dockerignore).toContain('start-debug.js');
    expect(dockerignore).toContain('test-*.mjs');
    expect(npmignore).toContain('scripts');
    expect(npmignore).toContain('src');
    expect(npmignore).toContain('.env');
    expect(npmignore).toContain('uploads');
    expect(npmignore).toContain('logs');
    expect(npmignore).toContain('coverage');
    expect(npmignore).toContain('prisma/*.db');
    expect(npmignore).toContain('Dockerfile');
    expect(npmignore).toContain('eslint.config.mjs');
    expect(npmignore).toContain('tsconfig*.json');
    expect(npmignore).toContain('vitest.config.ts');
    expect(npmignore).toContain('/*.js');
    expect(npmignore).toContain('/*.cjs');
    expect(npmignore).toContain('/*.mjs');
    expect(npmignore).toContain('/*.sql');
    expect(npmignore).toContain('start-debug.js');
    expect(npmignore).toContain('test-*.mjs');
    expect(serverSource.indexOf("app.get('/ready'")).toBeLessThan(
      serverSource.indexOf('app.listen'),
    );
    expect(serverSource).toContain('createReadinessHandler(() => isShuttingDown)');
    expect(serverSource).toContain("Readiness check: ${buildBackendUrl('/ready')}");
    expect(serverSource).toContain("express.json({ limit: '1mb' })");
    expect(serverSource).toContain(
      "express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 })",
    );
    expect(readinessSource).toContain('prisma.$queryRaw`SELECT 1`');
    expect(readinessSource).toContain('Database unavailable');
    expect(ciWorkflow).toContain('http://localhost:3001/ready');
    expect(ciWorkflow).toContain('docker build -t siteproof-backend-ci .');
    expect(ciWorkflow).toContain('DOCKER_BUILDKIT: "1"');
  });

  test('CI gates cover audits, formatting, migrations, lint, types, build, and tests', async () => {
    const workflowFiles = await readdir(new URL('../../.github/workflows/', import.meta.url));
    const ciWorkflow = await readFile(
      new URL('../../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    );
    const productionPreflightWorkflow = await readFile(
      new URL('../../.github/workflows/production-preflight.yml', import.meta.url),
      'utf8',
    );
    const frontendPackage = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(frontendPackage.scripts.lint).toContain('eslint src/ e2e/ "scripts/**/*.{js,mjs}"');
    expect(frontendPackage.scripts.lint).toContain('vite.config.ts');
    expect(frontendPackage.scripts.lint).toContain('vitest.config.ts');
    expect(frontendPackage.scripts.format).toContain('"e2e/**/*.{ts,tsx}"');
    expect(frontendPackage.scripts.format).toContain('"scripts/**/*.{js,mjs}"');
    expect(frontendPackage.scripts.format).toContain('vite.config.ts');
    expect(frontendPackage.scripts.format).toContain('vitest.config.ts');
    expect(frontendPackage.scripts['format:check']).toContain('"e2e/**/*.{ts,tsx}"');
    expect(frontendPackage.scripts['format:check']).toContain('"scripts/**/*.{js,mjs}"');
    expect(frontendPackage.scripts['format:check']).toContain('vite.config.ts');
    expect(frontendPackage.scripts['format:check']).toContain('vitest.config.ts');
    expect(frontendPackage.scripts['test:unit']).toBe('vitest run');
    expect(frontendPackage.scripts['test:coverage']).toBe('vitest run --coverage');
    expect(workflowFiles).not.toContain('test.yml');

    // Frontend unit coverage floor: the vitest config must keep v8 coverage
    // with ratchet thresholds, and the PR-gating workflow must run the coverage
    // variant so the thresholds actually enforce.
    const frontendVitestConfig = await readFile(
      new URL('../vitest.config.ts', import.meta.url),
      'utf8',
    );
    expect(frontendVitestConfig).toContain("provider: 'v8'");
    expect(frontendVitestConfig).toContain('thresholds');

    expect(ciWorkflow).toContain('run: npm audit --audit-level=moderate');
    expect(ciWorkflow).toContain('run: npm run format:check');
    expect(ciWorkflow).toContain('Validate Prisma migrations');
    expect(ciWorkflow).toContain('Verify database migration status');
    expect(ciWorkflow).toContain('run: npm run lint');
    expect(ciWorkflow).toContain('run: npm run type-check');
    expect(ciWorkflow).toContain('run: npm run test:coverage');
    expect(ciWorkflow).toContain('run: npm run build');
    expect(ciWorkflow).toContain('run: docker build -t siteproof-backend-ci .');
    expect(ciWorkflow).toContain('DOCKER_BUILDKIT: "1"');
    expect(ciWorkflow).toContain('name: Frontend PR E2E smoke');
    expect(ciWorkflow).toContain("if: github.event_name == 'pull_request'");
    expect(ciWorkflow).toContain('npx playwright test --grep @pr-smoke');
    expect(ciWorkflow).toContain('name: Frontend E2E');
    expect(ciWorkflow).toContain('needs: [backend, frontend]');
    expect(ciWorkflow).toContain('POSTGRES_DB: siteproof_e2e');
    expect(ciWorkflow).toContain('npm run seed:e2e');
    expect(ciWorkflow).toContain('run: npm run test:e2e');
    expect(ciWorkflow).toContain('name: backend-coverage-report');
    expect(ciWorkflow).toContain('name: frontend-coverage-report');
    expect(ciWorkflow).toContain('name: playwright-report');
    expect(ciWorkflow).toContain('executeRawUnsafe|queryRawUnsafe');
    expect(ciWorkflow).toContain('new PrismaClient');
    expect(ciWorkflow).not.toContain('run: npm test');
    expect(ciWorkflow).not.toContain('cd backend &&');
    expect(ciWorkflow).not.toContain('cd frontend &&');

    expect(ciWorkflow).not.toContain('run: npm run preflight:integrations');
    expect(ciWorkflow).toContain('production-preflight\\.yml$');
    expect(ciWorkflow.split('production-preflight\\.yml$').length - 1).toBeGreaterThanOrEqual(2);
    expect(productionPreflightWorkflow).toContain('workflow_dispatch:');
    expect(productionPreflightWorkflow).not.toContain('push:');
    expect(productionPreflightWorkflow).not.toContain('schedule:');
    expect(productionPreflightWorkflow).not.toContain('branches: [main, master]');
    expect(productionPreflightWorkflow).not.toContain("inputs.environment || 'production'");
    expect(productionPreflightWorkflow).toContain('github.event.inputs.environment');
    expect(productionPreflightWorkflow).toContain('run: npm run preflight:integrations');
    expect(productionPreflightWorkflow).toContain('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}');
    expect(productionPreflightWorkflow).toContain(
      'SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}',
    );
    expect(productionPreflightWorkflow).toContain('ALLOW_LOCAL_FILE_STORAGE: "false"');
  });

  test('Playwright screenshot captures skip font-ready waits for deterministic QA evidence', async () => {
    const playwrightConfig = await readFile(
      new URL('../playwright.config.ts', import.meta.url),
      'utf8',
    );

    expect(process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY).toBe('1');
    expect(playwrightConfig).toContain('PW_TEST_SCREENSHOT_NO_FONTS_READY');
    expect(playwrightConfig).toContain("process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= '1'");
  });

  test('sensitive document and API errors use the production-safe logger', async () => {
    const loggerSource = await readFile(new URL('../src/lib/logger.ts', import.meta.url), 'utf8');
    const errorHandlingSource = await readFile(
      new URL('../src/lib/errorHandling.ts', import.meta.url),
      'utf8',
    );
    const documentsPage = await readFile(
      new URL('../src/pages/documents/DocumentsPage.tsx', import.meta.url),
      'utf8',
    );
    const secureDocumentImage = await readFile(
      new URL('../src/components/documents/SecureDocumentImage.tsx', import.meta.url),
      'utf8',
    );
    const commentsSection = await readFile(
      new URL('../src/components/comments/CommentsSection.tsx', import.meta.url),
      'utf8',
    );
    const authSource = await readFile(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
    const registerPage = await readFile(
      new URL('../src/pages/auth/RegisterPage.tsx', import.meta.url),
      'utf8',
    );
    const oauthMockPage = await readFile(
      new URL('../src/pages/auth/OAuthMockPage.tsx', import.meta.url),
      'utf8',
    );
    const sharedSafeLoggerFiles = [
      '../src/hooks/useOnlineStatus.ts',
      '../src/hooks/usePullToRefresh.tsx',
      '../src/lib/pushNotifications.ts',
      '../src/lib/useSpeechToText.ts',
      '../src/components/ErrorBoundary.tsx',
      '../src/components/QuickPhotoCapture.tsx',
      '../src/components/SyncConflictModal.tsx',
      '../src/components/settings/PushNotificationSettings.tsx',
      '../src/pages/diary/hooks/useDiaryData.ts',
      '../src/pages/diary/DelayRegisterPage.tsx',
      '../src/pages/diary/components/ActivitiesTab.tsx',
      '../src/pages/diary/components/DelaysTab.tsx',
      '../src/pages/diary/components/DiaryDateSelector.tsx',
      '../src/pages/diary/components/WeatherTab.tsx',
      '../src/pages/diary/components/PersonnelTab.tsx',
      '../src/pages/diary/components/PlantTab.tsx',
      '../src/pages/diary/components/DiarySubmitSection.tsx',
      '../src/components/foreman/DiaryFinishFlow.tsx',
      '../src/components/foreman/CaptureModal.tsx',
    ];

    expect(loggerSource).toContain('export function logError');
    expect(loggerSource).toContain('export async function reportClientError');
    expect(loggerSource).toContain('if (import.meta.env.DEV)');
    expect(loggerSource).toContain("apiUrl('/api/support/client-error')");
    expect(loggerSource).toContain('?[redacted]');
    expect(errorHandlingSource).toContain("import { logError } from './logger'");
    expect(errorHandlingSource).not.toContain('console.error');
    expect(documentsPage).toContain("import { logError } from '@/lib/logger'");
    expect(documentsPage).not.toContain('console.error');
    expect(secureDocumentImage).toContain("import { logError } from '@/lib/logger'");
    expect(secureDocumentImage).not.toContain('console.error');
    expect(commentsSection).toContain("import { devLog, logError } from '@/lib/logger'");
    expect(commentsSection).not.toContain('console.error');
    expect(authSource).toContain("import { logError } from './logger'");
    expect(authSource).not.toContain('console.error');
    expect(registerPage).toContain("import { logError } from '@/lib/logger'");
    expect(registerPage).not.toContain('console.error');
    expect(oauthMockPage).toContain("import { devLog, logError } from '@/lib/logger'");
    expect(oauthMockPage).not.toContain('console.error');

    for (const relativePath of sharedSafeLoggerFiles) {
      const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
      expect(source, relativePath).toContain('logError');
      expect(source, relativePath).not.toContain('console.error');
    }

    const frontendSourceFiles = await collectSourceFiles(new URL('../src/', import.meta.url));
    for (const sourceFile of frontendSourceFiles) {
      if (sourceFile.pathname.endsWith('/lib/logger.ts')) {
        continue;
      }

      const source = await readFile(sourceFile, 'utf8');
      expect(source, sourceFile.pathname).not.toContain('console.error');
    }
  });

  test('backend operational logs go through the sanitized server logger', async () => {
    const serverLogger = await readFile(
      new URL('../../backend/src/lib/serverLogger.ts', import.meta.url),
      'utf8',
    );
    const errorHandler = await readFile(
      new URL('../../backend/src/middleware/errorHandler.ts', import.meta.url),
      'utf8',
    );
    const emailSource = await readFile(
      new URL('../../backend/src/lib/email.ts', import.meta.url),
      'utf8',
    );
    const backendIndex = await readFile(
      new URL('../../backend/src/index.ts', import.meta.url),
      'utf8',
    );
    const backendServer = await readFile(
      new URL('../../backend/src/server.ts', import.meta.url),
      'utf8',
    );
    const backendSourceFiles = (
      await Promise.all([
        collectSourceFiles(new URL('../../backend/src/routes/', import.meta.url)),
        collectSourceFiles(new URL('../../backend/src/lib/', import.meta.url)),
        collectSourceFiles(new URL('../../backend/src/middleware/', import.meta.url)),
      ])
    ).flat();
    const directConsoleOffenders: string[] = [];

    expect(serverLogger).toContain('import { sanitizeLogText, sanitizeLogValue }');
    expect(serverLogger).toContain('sanitizeLogText(message)');
    expect(serverLogger).toContain('sanitizeLogValue(value)');
    expect(serverLogger).toContain("process.env.NODE_ENV === 'development'");
    expect(errorHandler).toContain('sanitizeLogText');
    expect(errorHandler).toContain('ERROR_LOG_MAX_BYTES');
    expect(errorHandler).toContain('trimErrorLogContent');
    expect(errorHandler).toContain('enforceErrorLogSizeLimit');
    expect(errorHandler).toContain('function ensureErrorLogDirectory');
    expect(errorHandler).toContain('shouldWriteErrorLogFile() && ensureErrorLogDirectory()');
    expect(emailSource).not.toContain('console.');
    expect(emailSource).not.toContain('Invite URL');
    expect(emailSource).not.toContain('Password reset URL');
    expect(emailSource).not.toContain('Magic link URL');

    for (const file of backendSourceFiles) {
      const pathname = file.pathname.replace(/\\/g, '/');
      if (
        pathname.endsWith('/backend/src/lib/serverLogger.ts') ||
        pathname.endsWith('/backend/src/middleware/errorHandler.ts') ||
        pathname.endsWith('.test.ts')
      ) {
        continue;
      }

      const source = await readFile(file, 'utf8');
      if (/console(?:\.(?:error|warn|log|info)|\s*\[)/.test(source)) {
        directConsoleOffenders.push(pathname);
      }
    }

    if (/console(?:\.(?:error|warn|log|info)|\s*\[)/.test(backendIndex)) {
      directConsoleOffenders.push('/backend/src/index.ts');
    }
    if (/console(?:\.(?:error|warn|log|info)|\s*\[)/.test(backendServer)) {
      directConsoleOffenders.push('/backend/src/server.ts');
    }

    expect(directConsoleOffenders).toEqual([]);
  });

  test('client error support emails sanitize reported secrets before delivery', async () => {
    const supportRoute = await readFile(
      new URL('../../backend/src/routes/support.ts', import.meta.url),
      'utf8',
    );

    expect(supportRoute).toContain('function sanitizeClientErrorReport');
    expect(supportRoute).toContain('message: sanitizeLogText(report.message)');
    expect(supportRoute).toContain(
      'stack: report.stack ? sanitizeLogText(report.stack) : undefined',
    );
    expect(supportRoute).toContain(
      'componentStack: report.componentStack ? sanitizeLogText(report.componentStack) : undefined',
    );
    expect(supportRoute).toContain('const report = sanitizeClientErrorReport(parsed.data)');
    expect(supportRoute).toContain('subject: buildClientErrorSubject(report)');
    expect(supportRoute).toContain('message: buildClientErrorMessage(reportId, report)');
  });

  test('backend local upload directories are created lazily at upload time', async () => {
    const uploadPaths = await readFile(
      new URL('../../backend/src/lib/uploadPaths.ts', import.meta.url),
      'utf8',
    );
    const uploadSourceFiles = [
      '../../backend/src/routes/auth.ts',
      '../../backend/src/routes/auth/profileRoutes.ts',
      '../../backend/src/routes/company.ts',
      '../../backend/src/routes/company/logoStorage.ts',
      '../../backend/src/routes/comments.ts',
      '../../backend/src/routes/comments/attachmentStorage.ts',
      '../../backend/src/routes/documents.ts',
      '../../backend/src/routes/drawings.ts',
      '../../backend/src/routes/drawings/storage.ts',
      '../../backend/src/routes/testResults.ts',
      '../../backend/src/routes/testResults/certificateStorage.ts',
    ];
    const uploadSources = await Promise.all(
      uploadSourceFiles.map((relativePath) =>
        readFile(new URL(relativePath, import.meta.url), 'utf8'),
      ),
    );
    const joinedUploadSources = uploadSources.join('\n');

    expect(uploadPaths).toContain('export function getUploadSubdirectoryPath');
    expect(uploadPaths).toContain('export function ensureUploadSubdirectory');
    expect(uploadPaths).toContain('export async function ensureUploadSubdirectoryAsync');
    expect(joinedUploadSources).not.toContain('fs.mkdirSync');
    expect(joinedUploadSources).toContain("ensureUploadSubdirectory('avatars')");
    expect(joinedUploadSources).toContain("ensureUploadSubdirectory('company-logos')");
    expect(joinedUploadSources).toContain("ensureUploadSubdirectoryAsync('comments')");
    expect(joinedUploadSources).toContain("ensureUploadSubdirectory('documents')");
    expect(joinedUploadSources).toContain("ensureUploadSubdirectory('drawings')");
    expect(joinedUploadSources).toContain("ensureUploadSubdirectory('certificates')");
    expect(joinedUploadSources).toContain('Failed to delete old company logo');
  });

  test('dashboard export creates a real PDF instead of opening the print dialog', async () => {
    const dashboardPage = await readFile(
      new URL('../src/pages/DashboardPage.tsx', import.meta.url),
      'utf8',
    );
    const pdfGeneratorSource = await readFile(
      new URL('../src/lib/pdfGenerator.ts', import.meta.url),
      'utf8',
    );
    const dashboardPdfSource = await readFile(
      new URL('../src/lib/pdf/dashboardPdf.ts', import.meta.url),
      'utf8',
    );

    expect(dashboardPage).toContain("await import('@/lib/pdfGenerator')");
    expect(dashboardPage).toContain('generateDashboardPDF');
    expect(dashboardPage).not.toContain('window.print');
    expect(dashboardPage).not.toContain('dashboard-print-styles');
    expect(pdfGeneratorSource).toContain(
      "export { generateDashboardPDF } from './pdf/dashboardPdf'",
    );
    expect(dashboardPdfSource).toContain('export async function generateDashboardPDF');
    expect(dashboardPdfSource).toContain('siteproof-dashboard-');
  });

  test('project report generated timestamps use date and timezone preferences', async () => {
    const reportFormatting = await readFile(
      new URL('../src/pages/reports/reportFormatting.ts', import.meta.url),
      'utf8',
    );
    const reportFiles = [
      '../src/pages/reports/ReportsPage.tsx',
      '../src/pages/reports/components/LotStatusTab.tsx',
      '../src/pages/reports/components/NCRReportTab.tsx',
      '../src/pages/reports/components/TestResultsTab.tsx',
      '../src/pages/reports/components/DiaryReportTab.tsx',
    ];

    expect(reportFormatting).toContain('export function formatReportDateTime');
    expect(reportFormatting).toContain('dateFormat');
    expect(reportFormatting).toContain('timeZone: timezone');
    expect(reportFormatting).toContain('formatToParts');
    expect(reportFormatting).toContain("'en-AU'");

    for (const relativePath of reportFiles) {
      const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
      expect(source).toContain('formatReportDateTime');
      expect(source).not.toMatch(/Generated:\s*\{new Date\([^)]*\)\.toLocaleString\(\)\}/);
    }
  });

  test('frontend date-time displays avoid raw browser locale formatting', async () => {
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const rawBrowserLocaleDateTimePattern = /new Date\([^)]*\)\.toLocaleString\(\)/;
    const rawDateHelperFallbackPattern = /return\s+\w+\.toLocaleString\(\);/;
    const offenders: string[] = [];

    for (const file of files) {
      const pathname = file.pathname.replace(/\\/g, '/');
      const source = await readFile(file, 'utf8');
      if (
        rawBrowserLocaleDateTimePattern.test(source) ||
        rawDateHelperFallbackPattern.test(source)
      ) {
        offenders.push(pathname);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('unauthorized API responses clear stale auth state', async () => {
    const apiSource = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
    const authSource = await readFile(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
    const authStorageSource = await readFile(
      new URL('../src/lib/authStorage.ts', import.meta.url),
      'utf8',
    );

    expect(apiSource).toContain('notifySessionExpired');
    expect(apiSource).toContain('response.status === 401');
    expect(authSource).toContain('type CurrentUserResult');
    expect(authSource).toContain('async function fetchCurrentUser');
    expect(authSource).toContain("return { status: 'unauthorized' }");
    expect(authSource).toContain("return { status: 'unavailable' }");
    expect(authSource).toContain('setActualUser(storedAuth.auth.user)');
    expect(authSource).toContain('Failed to verify stored session; using cached user');
    expect(authSource.match(/\/api\/auth\/me/g) ?? []).toHaveLength(1);
    expect(authStorageSource).toContain('AUTH_SESSION_EXPIRED_EVENT');
    expect(authStorageSource).toContain('clearAuthFromAllStorages()');
    expect(authSource).toContain(
      'window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)',
    );
  });

  test('authenticated raw API requests go through the session-aware fetch helper', async () => {
    const apiSource = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const allowedRawFetchFiles = [
      '/src/lib/api.ts',
      '/src/lib/auth.tsx',
      '/src/pages/auth/OAuthMockPage.tsx',
    ];
    const rawApiFetchPattern =
      /fetch\(\s*(?:apiUrl\(|`\$\{(?:API_URL|apiUrl|API_BASE)\}\/api|[`'"][^`'"]*\/api\/)/;
    const offenders: string[] = [];

    expect(apiSource).toContain('export async function authFetch');
    expect(apiSource).toContain(
      'const response = await fetchWithTimeout(resolveApiRequestUrl(path)',
    );
    expect(apiSource).toContain('function assertAllowedApiRequestUrl');
    expect(apiSource).toContain('url.origin !== apiRoot.origin');
    expect(apiSource).toContain('!url.pathname.startsWith(apiRoot.pathname)');
    expect(apiSource).toContain('assertAllowedApiRequestUrl(parseConfiguredApiUrl(path))');
    expect(apiSource).toContain('if (response.status === 401)');
    expect(apiSource).toContain('const response = await authFetch(path, {');

    for (const file of files) {
      const pathname = file.pathname.replace(/\\/g, '/');
      if (allowedRawFetchFiles.some((allowedPath) => pathname.endsWith(allowedPath))) {
        continue;
      }

      const source = await readFile(file, 'utf8');
      if (rawApiFetchPattern.test(source)) {
        offenders.push(pathname);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('production network calls have bounded timeouts', async () => {
    const frontendApiSource = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
    const frontendAuthSource = await readFile(
      new URL('../src/lib/auth.tsx', import.meta.url),
      'utf8',
    );
    const frontendFetchSource = await readFile(
      new URL('../src/lib/fetchWithTimeout.ts', import.meta.url),
      'utf8',
    );
    const backendFetchSource = await readFile(
      new URL('../../backend/src/lib/fetchWithTimeout.ts', import.meta.url),
      'utf8',
    );
    const diaryReportingSource = await readFile(
      new URL('../../backend/src/routes/diary/diaryReporting.ts', import.meta.url),
      'utf8',
    );
    const oauthSource = await readFile(
      new URL('../../backend/src/routes/oauth.ts', import.meta.url),
      'utf8',
    );
    const documentClassificationSource = await readFile(
      new URL('../../backend/src/routes/documents/classificationRoutes.ts', import.meta.url),
      'utf8',
    );
    const testCertificateExtractionSource = await readFile(
      new URL('../../backend/src/routes/testResults/certificateExtraction.ts', import.meta.url),
      'utf8',
    );
    const webhookDeliverySource = await readFile(
      new URL('../../backend/src/routes/webhooks/delivery.ts', import.meta.url),
      'utf8',
    );

    expect(frontendFetchSource).toContain('DEFAULT_FETCH_TIMEOUT_MS = 30000');
    expect(frontendFetchSource).toContain('new AbortController()');
    expect(frontendFetchSource).toContain('RequestTimeoutError');
    expect(frontendApiSource).toContain('fetchWithTimeout(resolveApiRequestUrl(path)');
    expect(frontendAuthSource).toContain('fetchWithTimeout(apiUrl');

    expect(backendFetchSource).toContain('DEFAULT_FETCH_TIMEOUT_MS = 15000');
    expect(backendFetchSource).toContain('new AbortController()');
    expect(backendFetchSource).toContain('FetchTimeoutError');
    expect(diaryReportingSource).toContain('fetchWithTimeout(weatherUrl, undefined, 10000)');
    expect(oauthSource).toMatch(/fetchWithTimeout\(\s*'https:\/\/oauth2\.googleapis\.com\/token'/);
    expect(oauthSource).toMatch(
      /fetchWithTimeout\(\s*'https:\/\/www\.googleapis\.com\/oauth2\/v2\/userinfo'/,
    );
    expect(oauthSource).toMatch(
      /fetchWithTimeout\(\s*`https:\/\/oauth2\.googleapis\.com\/tokeninfo/,
    );
    expect(documentClassificationSource).toContain(
      "fetchWithTimeout('https://api.anthropic.com/v1/messages'",
    );
    expect(testCertificateExtractionSource).toContain(
      "fetchWithTimeout('https://api.anthropic.com/v1/messages'",
    );
    expect(webhookDeliverySource).toContain('const timeout = setTimeout(');
    expect(webhookDeliverySource).toContain('new AbortController()');
    expect(webhookDeliverySource).toContain('clearTimeout(timeout)');

    const frontendSourceFiles = await collectSourceFiles(new URL('../src/', import.meta.url));
    const backendSourceFiles = await collectSourceFiles(
      new URL('../../backend/src/', import.meta.url),
    );
    const allowedRawFetchFiles = [
      '/frontend/src/lib/fetchWithTimeout.ts',
      // The offline photo_upload executor reads its base64 photo dataUrl via a
      // bare fetch() (dataUrl is in-memory, not a network request that needs a
      // timeout). It moved here from useOfflineStatus.ts with the executor.
      '/frontend/src/lib/offline/syncWorker.ts',
      '/backend/src/lib/fetchWithTimeout.ts',
      '/backend/src/routes/webhooks.ts',
      '/backend/src/routes/webhooks/delivery.ts',
    ];
    const rawFetchOffenders: string[] = [];

    for (const file of [...frontendSourceFiles, ...backendSourceFiles]) {
      const pathname = file.pathname.replace(/\\/g, '/');
      if (
        pathname.includes('.test.') ||
        allowedRawFetchFiles.some((allowed) => pathname.endsWith(allowed))
      ) {
        continue;
      }

      const source = await readFile(file, 'utf8');
      if (/\bfetch\(/.test(source)) {
        rawFetchOffenders.push(pathname);
      }
    }

    expect(rawFetchOffenders).toEqual([]);
  });

  test('offline sync data is scoped to auth user lifecycle', async () => {
    const authSource = await readFile(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
    const authStorageSource = await readFile(
      new URL('../src/lib/authStorage.ts', import.meta.url),
      'utf8',
    );
    const settingsSource = await readFile(
      new URL('../src/pages/settings/SettingsPage.tsx', import.meta.url),
      'utf8',
    );

    expect(authStorageSource).toContain('OFFLINE_OWNER_STORAGE_KEY');
    expect(authSource).toContain('prepareOfflineDataForUser');
    expect(authSource).toContain('clearOfflineDataForSignOut');
    expect(authSource).toContain("await import('./offlineDb')");
    expect(settingsSource).toContain('await signOut()');
  });

  test('offline sync indicator does not pull Dexie into the initial app bundle', async () => {
    const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const deferredIndicatorSource = await readFile(
      new URL('../src/components/DeferredOfflineIndicator.tsx', import.meta.url),
      'utf8',
    );
    const offlineIndicatorSource = await readFile(
      new URL('../src/components/OfflineIndicator.tsx', import.meta.url),
      'utf8',
    );

    expect(appSource).toContain('DeferredOfflineIndicator');
    expect(appSource).not.toContain("from '@/components/OfflineIndicator'");
    expect(deferredIndicatorSource).toContain("import('./OfflineIndicator')");
    expect(deferredIndicatorSource).toContain('requestIdleCallback');
    expect(offlineIndicatorSource).toContain("from '@/lib/useOfflineStatus'");
  });

  test('offline lot conflict sync does not overwrite unresolved conflicts', async () => {
    const offlineDbSource = await readFile(
      new URL('../src/lib/offlineDb.ts', import.meta.url),
      'utf8',
    );
    // The lot_edit sync executor (including its stale-skip guards) moved from
    // useOfflineStatus.ts into offline/syncWorker.ts; the conflict-safety
    // literals are asserted against the worker module they now live in.
    const syncWorkerSource = await readFile(
      new URL('../src/lib/offline/syncWorker.ts', import.meta.url),
      'utf8',
    );
    const conflictModalSource = await readFile(
      new URL('../src/components/SyncConflictModal.tsx', import.meta.url),
      'utf8',
    );

    expect(offlineDbSource).toContain('async function queueLatestLotEditSync');
    expect(offlineDbSource).toContain("localLot.syncStatus !== 'pending'");
    expect(offlineDbSource).toContain("localLot.syncStatus !== 'error'");
    expect(offlineDbSource).toContain('await removeQueuedLotEditSyncs(lotId);');
    expect(syncWorkerSource).toContain("lot.syncStatus === 'conflict'");
    expect(syncWorkerSource).toContain("lot.syncStatus === 'synced'");
    expect(syncWorkerSource).toContain('Removing stale lot edit queue item for conflicted lot');
    expect(conflictModalSource).toContain('function pickConflictForReview');
    expect(conflictModalSource).toContain('formatConflictValue');
    expect(conflictModalSource).toContain("key: 'chainageStart'");
    expect(conflictModalSource).toContain("key: 'chainageEnd'");
    expect(conflictModalSource).toContain("key: 'offset'");
    expect(conflictModalSource).toContain("key: 'offsetLeft'");
    expect(conflictModalSource).toContain("key: 'offsetRight'");
    expect(conflictModalSource).toContain("key: 'budget'");
    expect(conflictModalSource).not.toContain('setSelectedConflict(null);');
  });

  test('offline photo sync sends the upload metadata required by the documents API', async () => {
    const offlineDbSource = await readFile(
      new URL('../src/lib/offlineDb.ts', import.meta.url),
      'utf8',
    );
    // The OfflinePhoto record type lives in the offline database core module;
    // the capture options and their defaults moved with the photo behavior
    // into offline/photos.ts, which offlineDb.ts re-exports.
    const offlineCoreSource = await readFile(
      new URL('../src/lib/offline/core.ts', import.meta.url),
      'utf8',
    );
    const offlinePhotosSource = await readFile(
      new URL('../src/lib/offline/photos.ts', import.meta.url),
      'utf8',
    );
    // The photo_upload sync executor moved from useOfflineStatus.ts into
    // offline/syncWorker.ts; its upload-metadata literals are asserted against
    // the worker module they now live in.
    const syncWorkerSource = await readFile(
      new URL('../src/lib/offline/syncWorker.ts', import.meta.url),
      'utf8',
    );
    const captureModalSource = await readFile(
      new URL('../src/components/foreman/CaptureModal.tsx', import.meta.url),
      'utf8',
    );
    const quickPhotoCaptureSource = await readFile(
      new URL('../src/components/QuickPhotoCapture.tsx', import.meta.url),
      'utf8',
    );

    expect(offlineCoreSource).toContain('documentType: string;');
    expect(offlineCoreSource).toContain('category?: string;');
    // offlineDb.ts must keep forwarding the photo behavior so callers can
    // keep importing it from '@/lib/offlineDb'.
    expect(offlineDbSource).toContain('capturePhotoOffline,');
    expect(offlineDbSource).toContain("} from './offline/photos';");
    expect(offlinePhotosSource).toContain('documentType?: string;');
    expect(offlinePhotosSource).toContain("documentType: options.documentType ?? 'photo'");
    expect(offlinePhotosSource).toContain('category?: string;');
    expect(syncWorkerSource).toContain("formData.append('documentType', photo.documentType);");
    expect(syncWorkerSource).toContain("formData.append('category', photo.category);");
    expect(syncWorkerSource).toContain('photo.gpsLatitude !== undefined');
    expect(syncWorkerSource).toContain('photo.gpsLongitude !== undefined');
    expect(captureModalSource).toContain(
      "documentType: captureType === 'ncr' ? 'ncr_evidence' : 'photo'",
    );
    expect(quickPhotoCaptureSource).toContain("documentType: 'photo'");
  });

  test('offline sync queue has a single opted-in worker with a shared lock', async () => {
    const offlineStatusSource = await readFile(
      new URL('../src/lib/useOfflineStatus.ts', import.meta.url),
      'utf8',
    );
    const syncClientSource = await readFile(
      new URL('../src/lib/offline/syncClient.ts', import.meta.url),
      'utf8',
    );
    const offlineIndicatorSource = await readFile(
      new URL('../src/components/OfflineIndicator.tsx', import.meta.url),
      'utf8',
    );

    expect(offlineStatusSource).toContain('enableSyncWorker?: boolean');
    expect(offlineStatusSource).toContain('enableSyncWorker = false');
    expect(offlineStatusSource).toContain(
      'if (!enableSyncWorker || !isOnline || isSyncing) return;',
    );
    expect(syncClientSource).toContain('activeOfflineSyncPromise');
    expect(syncClientSource).toContain('siteproof-offline-sync');
    expect(syncClientSource).toContain('getBrowserLockManager()');
    expect(offlineIndicatorSource).toContain('enableSyncWorker: true');
  });

  test('auth session storage is validated and accessed through safe helpers', async () => {
    const authSource = await readFile(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
    const authStorageSource = await readFile(
      new URL('../src/lib/authStorage.ts', import.meta.url),
      'utf8',
    );
    const storagePreferences = await readFile(
      new URL('../src/lib/storagePreferences.ts', import.meta.url),
      'utf8',
    );

    expect(storagePreferences).toContain('function getBrowserStorage');
    expect(storagePreferences).toContain('readSessionStorageItem');
    expect(storagePreferences).toContain('writeSessionStorageItem');
    expect(storagePreferences).toContain('removeSessionStorageItem');
    expect(authStorageSource).toContain('readAuthFromStorage');
    expect(authStorageSource).toContain('writeAuthToStorage');
    expect(authStorageSource).toContain('removeSessionStorageItem(AUTH_STORAGE_KEY)');
    expect(authSource).toContain('function parseStoredAuth');
    expect(authSource).toContain('function readStoredAuth');
    expect(authSource).toContain('function persistSignedInSession');
    expect(authSource).toContain('isStoredUser(data.user)');
    expect(authSource).not.toContain('localStorage.getItem(AUTH_STORAGE_KEY)');
    expect(authSource).not.toContain('sessionStorage.getItem(AUTH_STORAGE_KEY)');
    expect(authSource).not.toContain('localStorage.setItem(REMEMBER_ME_KEY');
    expect(authSource).not.toContain('storage.setItem(AUTH_STORAGE_KEY');
  });

  test('frontend browser storage access goes through safe helpers', async () => {
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const allowedStorageFiles = ['/src/lib/storagePreferences.ts'];
    const offenders: string[] = [];

    for (const file of files) {
      const pathname = file.pathname.replace(/\\/g, '/');
      if (allowedStorageFiles.some((allowed) => pathname.endsWith(allowed))) {
        continue;
      }

      const source = await readFile(file, 'utf8');
      if (
        /\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)\b/.test(source)
      ) {
        offenders.push(pathname);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('frontend console output is centralized behind the dev logger', async () => {
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const offenders: string[] = [];

    for (const file of files) {
      const pathname = file.pathname.replace(/\\/g, '/');
      if (pathname.endsWith('/src/lib/logger.ts')) {
        continue;
      }

      const source = await readFile(file, 'utf8');
      if (/console\.(?:debug|log|info|warn|error)\b|\bdebugger\b/.test(source)) {
        offenders.push(pathname);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('persisted UI preferences validate parsed localStorage data before render', async () => {
    const storagePreferences = await readFile(
      new URL('../src/lib/storagePreferences.ts', import.meta.url),
      'utf8',
    );
    const dashboardPage = await readFile(
      new URL('../src/pages/DashboardPage.tsx', import.meta.url),
      'utf8',
    );
    const dashboardWidgetsHook = await readFile(
      new URL('../src/hooks/useDashboardWidgets.ts', import.meta.url),
      'utf8',
    );
    const lotsPage = await readFile(
      new URL('../src/pages/lots/LotsPage.tsx', import.meta.url),
      'utf8',
    );
    const lotFiltersBar = await readFile(
      new URL('../src/pages/lots/components/LotFiltersBar.tsx', import.meta.url),
      'utf8',
    );
    const lotColumnSettingsMenu = await readFile(
      new URL('../src/pages/lots/components/LotColumnSettingsMenu.tsx', import.meta.url),
      'utf8',
    );
    const lotFilterConfig = await readFile(
      new URL('../src/pages/lots/components/lotFilterConfig.ts', import.meta.url),
      'utf8',
    );
    const lotTable = await readFile(
      new URL('../src/pages/lots/components/LotTable.tsx', import.meta.url),
      'utf8',
    );
    const lotActions = await readFile(
      new URL('../src/pages/lots/hooks/useLotsActions.ts', import.meta.url),
      'utf8',
    );
    const uiStore = await readFile(new URL('../src/stores/uiStore.ts', import.meta.url), 'utf8');
    const foremanMobileStore = await readFile(
      new URL('../src/stores/foremanMobileStore.ts', import.meta.url),
      'utf8',
    );

    expect(storagePreferences).toContain('validator(parsed) ?? fallback');
    expect(storagePreferences).toContain('safeLocalStateStorage');
    expect(dashboardPage).toContain('useDashboardWidgets()');
    expect(dashboardWidgetsHook).toContain('readLocalStorageItem(WIDGET_STORAGE_KEY)');
    expect(dashboardWidgetsHook).toContain('writeLocalStorageItem(WIDGET_STORAGE_KEY');
    expect(dashboardWidgetsHook).toContain('parseVisibleWidgetsPreference');
    expect(dashboardWidgetsHook).not.toContain('return JSON.parse(stored) as WidgetId[]');
    expect(dashboardPage).not.toContain('localStorage.getItem(WIDGET_STORAGE_KEY)');
    expect(dashboardPage).not.toContain('localStorage.setItem(WIDGET_STORAGE_KEY');
    expect(dashboardWidgetsHook).not.toContain('localStorage.getItem(WIDGET_STORAGE_KEY)');
    expect(dashboardWidgetsHook).not.toContain('localStorage.setItem(WIDGET_STORAGE_KEY');
    expect(lotsPage).toContain('readLocalStorageItem(LOT_VIEW_MODE_STORAGE_KEY)');
    expect(lotsPage).toContain('readLocalStorageItem(COLUMN_STORAGE_KEY)');
    expect(lotsPage).toContain('readLocalStorageItem(COLUMN_ORDER_STORAGE_KEY)');
    expect(lotsPage).toContain('parseColumnPreference');
    expect(lotsPage).toContain('parseColumnOrderPreference');
    expect(lotsPage).not.toContain('return JSON.parse(stored) as ColumnId[]');
    expect(lotsPage).not.toContain("localStorage.getItem('siteproof_lot_view_mode')");
    expect(lotActions).toContain("writeLocalStorageItem('siteproof_lot_view_mode', mode)");
    expect(lotActions).not.toContain("localStorage.setItem('siteproof_lot_view_mode'");
    expect(lotFiltersBar).toContain('readLocalStorageItem(SAVED_FILTERS_STORAGE_KEY)');
    expect(lotFiltersBar).toContain('writeLocalStorageItem(SAVED_FILTERS_STORAGE_KEY');
    expect(lotFiltersBar).toContain('parseSavedFiltersPreference');
    expect(lotFiltersBar).not.toContain('return JSON.parse(stored) as SavedFilter[]');
    expect(lotFiltersBar).not.toContain('localStorage.getItem(SAVED_FILTERS_STORAGE_KEY)');
    expect(lotFiltersBar).not.toContain('localStorage.setItem(SAVED_FILTERS_STORAGE_KEY');
    expect(lotColumnSettingsMenu).toContain('writeLocalStorageItem(COLUMN_STORAGE_KEY');
    expect(lotColumnSettingsMenu).toContain('writeLocalStorageItem(COLUMN_ORDER_STORAGE_KEY');
    expect(lotColumnSettingsMenu).not.toContain('localStorage.setItem(COLUMN_STORAGE_KEY');
    expect(lotColumnSettingsMenu).not.toContain('localStorage.setItem(COLUMN_ORDER_STORAGE_KEY');
    expect(lotFilterConfig).toContain("COLUMN_STORAGE_KEY = 'siteproof_lot_columns'");
    expect(lotFilterConfig).toContain("COLUMN_ORDER_STORAGE_KEY = 'siteproof_lot_column_order'");
    expect(lotFilterConfig).toContain("SAVED_FILTERS_STORAGE_KEY = 'siteproof_lot_saved_filters'");
    expect(lotTable).toContain('readLocalStorageItem(COLUMN_WIDTH_STORAGE_KEY)');
    expect(lotTable).toContain('writeLocalStorageItem(COLUMN_WIDTH_STORAGE_KEY');
    expect(lotTable).toContain('parseColumnWidthsPreference');
    expect(lotTable).not.toContain('...JSON.parse(stored)');
    expect(lotTable).not.toContain('localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY)');
    expect(lotTable).not.toContain('localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY');
    expect(uiStore).toContain('safeLocalStateStorage');
    expect(uiStore).toContain('createJSONStorage(() => safeLocalStateStorage)');
    expect(uiStore).not.toContain('createJSONStorage(() => localStorage)');
    expect(foremanMobileStore).toContain('safeLocalStateStorage');
    expect(foremanMobileStore).toContain('createJSONStorage(() => safeLocalStateStorage)');
    expect(foremanMobileStore).not.toContain('createJSONStorage(() => localStorage)');
  });

  test('startup preference providers use safe storage helpers', async () => {
    const themeSource = await readFile(new URL('../src/lib/theme.tsx', import.meta.url), 'utf8');
    const dateFormatSource = await readFile(
      new URL('../src/lib/dateFormat.tsx', import.meta.url),
      'utf8',
    );
    const timezoneSource = await readFile(
      new URL('../src/lib/timezone.tsx', import.meta.url),
      'utf8',
    );

    expect(themeSource).toContain('function isTheme');
    expect(themeSource).toContain('readLocalStorageItem(THEME_STORAGE_KEY)');
    expect(themeSource).toContain('writeLocalStorageItem(THEME_STORAGE_KEY, newTheme)');
    expect(dateFormatSource).toContain('function isDateFormat');
    expect(dateFormatSource).toContain('readLocalStorageItem(DATE_FORMAT_STORAGE_KEY)');
    expect(dateFormatSource).toContain('writeLocalStorageItem(DATE_FORMAT_STORAGE_KEY, newFormat)');
    expect(timezoneSource).toContain('function isValidTimezone');
    expect(timezoneSource).toContain("new Intl.DateTimeFormat('en-AU', { timeZone: value })");
    expect(timezoneSource).toContain('readLocalStorageItem(TIMEZONE_STORAGE_KEY)');
    expect(timezoneSource).toContain('writeLocalStorageItem(TIMEZONE_STORAGE_KEY, nextTimezone)');
    expect(`${themeSource}\n${dateFormatSource}\n${timezoneSource}`).not.toContain(
      'localStorage.getItem',
    );
    expect(`${themeSource}\n${dateFormatSource}\n${timezoneSource}`).not.toContain(
      'localStorage.setItem',
    );
  });

  test('cookie consent validates persisted data and tolerates unavailable localStorage', async () => {
    const cookieConsent = await readFile(
      new URL('../src/components/CookieConsentBanner.tsx', import.meta.url),
      'utf8',
    );
    const storagePreferences = await readFile(
      new URL('../src/lib/storagePreferences.ts', import.meta.url),
      'utf8',
    );

    expect(storagePreferences).toContain('function getBrowserStorage');
    expect(storagePreferences).toContain("typeof window === 'undefined'");
    expect(storagePreferences).toContain('readLocalStorageItem');
    expect(storagePreferences).toContain('writeLocalStorageItem');
    expect(storagePreferences).toContain('removeLocalStorageItem');
    expect(cookieConsent).toContain('function isConsentState');
    expect(cookieConsent).toContain('function readStoredConsent');
    expect(cookieConsent).toContain('function hasCurrentConsent');
    expect(cookieConsent).toContain('setConsent(hasCurrentConsent(storedConsent)');
    expect(cookieConsent).not.toContain('setConsent(JSON.parse(consentData))');
    expect(cookieConsent).not.toContain('localStorage.getItem(CONSENT_KEY)');
    expect(cookieConsent).not.toContain('localStorage.setItem(CONSENT_KEY');
  });

  test('service worker does not runtime-cache API responses', async () => {
    const viteConfig = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');

    expect(viteConfig).not.toContain('api-cache');
    expect(viteConfig).not.toContain('urlPattern: /^https:\\/\\/api\\./i');
  });

  test('PDF export code loads only when users request a PDF', async () => {
    const viteConfig = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
    const pdfGeneratorSource = await readFile(
      new URL('../src/lib/pdfGenerator.ts', import.meta.url),
      'utf8',
    );
    const pdfViewerSource = await readFile(
      new URL('../src/components/ui/PDFViewer.tsx', import.meta.url),
      'utf8',
    );
    const frontendPackage = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> };
    // The conformance report's lazy PDF import moved from LotDetailPage into the
    // useConformanceReportGeneration hook; assert the dynamic import there.
    const reportHookSource = await readFile(
      new URL('../src/pages/lots/hooks/useConformanceReportGeneration.ts', import.meta.url),
      'utf8',
    );
    const claimsSource = await readFile(
      new URL('../src/pages/claims/ClaimsPage.tsx', import.meta.url),
      'utf8',
    );
    const dashboardSource = await readFile(
      new URL('../src/pages/DashboardPage.tsx', import.meta.url),
      'utf8',
    );

    expect(viteConfig).toContain("'**/assets/pdfGenerator*.js'");
    expect(viteConfig).toContain("'**/assets/PDFViewer*.js'");
    expect(viteConfig).toContain("'**/assets/PDFViewer*.css'");
    expect(viteConfig).toContain("'**/assets/jspdf*.js'");
    expect(viteConfig).toContain("'**/assets/vendor-pdf*.js'");
    expect(viteConfig).toContain("'**/assets/BarChart*.js'");
    expect(viteConfig).toContain("'**/assets/ClaimsCharts*.js'");
    expect(viteConfig).toContain("'**/assets/HoldPointsChart*.js'");
    expect(viteConfig).toContain('deferredHtmlModulePreloadPrefixes');
    expect(viteConfig).toContain('resolveModulePreloadDependencies');
    expect(viteConfig).toContain('matchesOptimizedDependency');
    expect(viteConfig).toContain('isCoreReactRuntimeModule');
    expect(viteConfig).toContain("context.hostType !== 'html'");
    expect(viteConfig).toContain("nextCharacter === '_'");
    expect(viteConfig).toContain("'vendor-pdf'");
    expect(viteConfig).toContain("'vendor-pdf-viewer'");
    expect(viteConfig).toContain("'vendor-charts'");
    expect(viteConfig).toContain("'BarChart'");
    expect(viteConfig).toContain("'jspdf'");
    expect(viteConfig).toContain("'html2canvas'");
    expect(viteConfig).toContain("'pdf.worker'");
    expect(viteConfig).not.toContain("'vendor-charts': ['recharts']");
    expect(viteConfig).not.toContain("'vendor-pdf': ['jspdf']");
    expect(viteConfig).not.toContain("'vendor-pdf-viewer': ['react-pdf', 'pdfjs-dist']");
    expect(frontendPackage.scripts['copy:pdf-assets']).toBe('node scripts/copy-pdf-assets.mjs');
    expect(frontendPackage.scripts.build).toContain('npm run copy:pdf-assets');
    expect(frontendPackage.scripts.dev).toContain('npm run copy:pdf-assets');
    expect(pdfViewerSource).toContain('PDFJS_ASSET_BASE_URL');
    expect(pdfViewerSource).toContain('cMapUrl: `${PDFJS_ASSET_BASE_URL}cmaps/`');
    expect(pdfViewerSource).toContain(
      'standardFontDataUrl: `${PDFJS_ASSET_BASE_URL}standard_fonts/`',
    );
    expect(pdfViewerSource).not.toContain('unpkg.com');
    expect(pdfGeneratorSource).not.toContain('getJsPDF().catch');
    expect(pdfGeneratorSource).not.toContain('getJsPDFSync');
    expect(reportHookSource).toContain("await import('@/lib/pdfGenerator')");
    expect(claimsSource).toContain("await import('@/lib/pdfGenerator')");
    expect(dashboardSource).toContain("await import('@/lib/pdfGenerator')");
    expect(reportHookSource).not.toMatch(/import \{[^}]*generateConformanceReportPDF/);
    expect(claimsSource).not.toMatch(/import \{[^}]*generateClaimEvidencePackagePDF/);
    expect(dashboardSource).not.toMatch(/import \{[^}]*generateDashboardPDF/);
  });

  test('push notifications fail visibly and route notification clicks safely', async () => {
    const pushSource = await readFile(
      new URL('../src/lib/pushNotifications.ts', import.meta.url),
      'utf8',
    );
    const settingsSource = await readFile(
      new URL('../src/components/settings/PushNotificationSettings.tsx', import.meta.url),
      'utf8',
    );
    const serviceWorkerSource = await readFile(
      new URL('../public/sw-push.js', import.meta.url),
      'utf8',
    );
    const backendPushSource = await readFile(
      new URL('../../backend/src/routes/pushNotifications.ts', import.meta.url),
      'utf8',
    );
    const backendPushVapidSource = await readFile(
      new URL('../../backend/src/routes/pushNotifications/vapid.ts', import.meta.url),
      'utf8',
    );

    expect(pushSource).toContain("'Notification' in window");
    expect(pushSource).toContain('function readPushResponseError');
    expect(pushSource).toContain('function getReadyServiceWorkerRegistration');
    expect(pushSource).toContain('function getSubscriptionIdForEndpoint');
    expect(pushSource).toContain('function unsubscribeBrowserSubscription');
    expect(pushSource).toContain('data.success !== true');
    expect(pushSource).toContain('currentDeviceSubscribed === true');
    expect(pushSource).toContain('throw new Error(await readPushResponseError(response))');
    expect(settingsSource).toContain('Push Notifications Not Configured');
    expect(settingsSource).toContain('!status.configured');
    expect(settingsSource).toContain("event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED'");
    expect(serviceWorkerSource).toContain('function getNotificationNavigationUrl');
    expect(serviceWorkerSource).toContain("type: 'PUSH_SUBSCRIPTION_CHANGED'");
    expect(serviceWorkerSource).toContain("normalized.startsWith('//')");
    expect(serviceWorkerSource).toContain('url.origin === self.location.origin');
    expect(serviceWorkerSource).not.toContain('console.');
    expect(serviceWorkerSource).not.toContain('client.navigate(url)');
    expect(serviceWorkerSource).not.toContain('clients.openWindow(url)');
    expect(backendPushVapidSource).toContain('function getConfiguredVapidKeys');
    expect(backendPushSource).toContain('parseOptionalSubscriptionId');
    expect(backendPushSource).toContain('currentDeviceSubscribed');
    expect(backendPushVapidSource).toContain('process.env.VAPID_PUBLIC_KEY?.trim()');
    expect(backendPushSource).not.toContain(
      'const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY',
    );
    expect(backendPushSource).not.toContain('// Initialize on module load');
  });

  test('advanced analytics does not show fabricated KPI values', async () => {
    const advancedAnalyticsSource = await readFile(
      new URL('../src/pages/reports/components/AdvancedAnalyticsTab.tsx', import.meta.url),
      'utf8',
    );

    expect(advancedAnalyticsSource).not.toContain('94%');
    expect(advancedAnalyticsSource).not.toContain('4.2 days');
    expect(advancedAnalyticsSource).not.toContain('$1.2M');
    expect(advancedAnalyticsSource).not.toContain('Monthly Claims');
    expect(advancedAnalyticsSource).not.toContain('[30, 45, 35');
    expect(advancedAnalyticsSource).toContain('backed by live project analytics');
    expect(advancedAnalyticsSource).toContain('verified analytics source');
  });

  test('subcontractor invite acceptance preserves locked email submissions', async () => {
    const acceptInviteSource = await readFile(
      new URL('../src/pages/subcontractor-portal/AcceptInvitePage.tsx', import.meta.url),
      'utf8',
    );

    expect(acceptInviteSource).toContain('encodeURIComponent(invitationId)');
    expect(acceptInviteSource).toContain('readOnly={!!invitation.primaryContactEmail}');
    expect(acceptInviteSource).toContain('aria-readonly={!!invitation.primaryContactEmail}');
    expect(acceptInviteSource).toContain('await setToken(result.token)');
    expect(acceptInviteSource).not.toContain('disabled={!!invitation.primaryContactEmail}');
    expect(acceptInviteSource).not.toContain("window.location.href = '/subcontractor-portal'");
  });

  test('subcontractor portal modules enforce access switches on direct routes', async () => {
    const portalAccessSource = await readFile(
      new URL('../src/pages/subcontractor-portal/portalAccess.tsx', import.meta.url),
      'utf8',
    );
    const assignedWorkSource = await readFile(
      new URL('../src/pages/subcontractor-portal/AssignedWorkPage.tsx', import.meta.url),
      'utf8',
    );
    const itpSource = await readFile(
      new URL('../src/pages/subcontractor-portal/SubcontractorITPsPage.tsx', import.meta.url),
      'utf8',
    );
    const holdPointsSource = await readFile(
      new URL('../src/pages/subcontractor-portal/SubcontractorHoldPointsPage.tsx', import.meta.url),
      'utf8',
    );
    const testResultsSource = await readFile(
      new URL(
        '../src/pages/subcontractor-portal/SubcontractorTestResultsPage.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const ncrSource = await readFile(
      new URL('../src/pages/subcontractor-portal/SubcontractorNCRsPage.tsx', import.meta.url),
      'utf8',
    );
    const documentsSource = await readFile(
      new URL('../src/pages/subcontractor-portal/SubcontractorDocumentsPage.tsx', import.meta.url),
      'utf8',
    );
    const lotItpSource = await readFile(
      new URL('../src/pages/subcontractor-portal/SubcontractorLotITPPage.tsx', import.meta.url),
      'utf8',
    );
    const projectAccessSource = await readFile(
      new URL('../../backend/src/lib/projectAccess.ts', import.meta.url),
      'utf8',
    );

    expect(portalAccessSource).toContain('PortalAccessDenied');
    expect(assignedWorkSource).toContain("isPortalModuleEnabled(company, 'lots')");
    expect(assignedWorkSource).toContain('portalModule=lots');
    expect(itpSource).toContain("isPortalModuleEnabled(company, 'itps')");
    expect(itpSource).toContain('portalModule=itps');
    expect(holdPointsSource).toContain("isPortalModuleEnabled(company, 'holdPoints')");
    expect(testResultsSource).toContain("isPortalModuleEnabled(company, 'testResults')");
    expect(ncrSource).toContain("isPortalModuleEnabled(company, 'ncrs')");
    expect(documentsSource).toContain("isPortalModuleEnabled(company, 'documents')");
    expect(lotItpSource).toContain('portalModule=itps');
    expect(lotItpSource).toContain('subcontractorView=true');
    expect(projectAccessSource).toContain('requireSubcontractorPortalModuleAccess');
    expect(projectAccessSource).toContain('hasSubcontractorPortalModuleAccess');
  });

  test('photo GPS map URLs are built from validated coordinates', async () => {
    const photoLocationMapSource = await readFile(
      new URL('../src/pages/lots/components/PhotoLocationMap.tsx', import.meta.url),
      'utf8',
    );
    const photoLocationLinksSource = await readFile(
      new URL('../src/pages/lots/components/photoLocationLinks.ts', import.meta.url),
      'utf8',
    );
    const photosTabSource = await readFile(
      new URL('../src/pages/lots/components/PhotosTab.tsx', import.meta.url),
      'utf8',
    );
    const photoViewerModalSource = await readFile(
      new URL('../src/pages/lots/components/PhotoViewerModal.tsx', import.meta.url),
      'utf8',
    );
    const itpPhotoLightboxSource = await readFile(
      new URL('../src/pages/lots/components/ITPPhotoLightbox.tsx', import.meta.url),
      'utf8',
    );

    expect(photoLocationLinksSource).toContain('Number.isFinite(latitude)');
    expect(photoLocationLinksSource).toContain('Number.isFinite(longitude)');
    expect(photoLocationLinksSource).toContain('latitude < -90');
    expect(photoLocationLinksSource).toContain('longitude > 180');
    expect(photoLocationLinksSource).toContain('new URLSearchParams');
    expect(photoLocationMapSource).toContain('referrerPolicy="no-referrer"');
    expect(photosTabSource).toContain('<PhotoViewerModal');
    expect(photoViewerModalSource).toContain('<PhotoLocationMap');
    expect(itpPhotoLightboxSource).toContain('<PhotoLocationMap');
    expect(photosTabSource).not.toContain('openstreetmap.org/export/embed.html?bbox=${Number');
    expect(photoViewerModalSource).not.toContain(
      'openstreetmap.org/export/embed.html?bbox=${Number',
    );
    expect(itpPhotoLightboxSource).not.toContain(
      'openstreetmap.org/export/embed.html?bbox=${Number',
    );
  });

  test('photo GPS link builder rejects missing coordinates without dropping valid zeros', () => {
    expect(getPhotoLocationLinks(null, 151.2093)).toBeNull();
    expect(getPhotoLocationLinks(-33.8688, undefined)).toBeNull();
    expect(getPhotoLocationLinks(91, 151.2093)).toBeNull();
    expect(getPhotoLocationLinks(-33.8688, 181)).toBeNull();

    const equatorOriginLinks = getPhotoLocationLinks(0, 0);

    expect(equatorOriginLinks).not.toBeNull();
    expect(equatorOriginLinks?.latitudeLabel).toBe('0.000000');
    expect(equatorOriginLinks?.longitudeLabel).toBe('0.000000');
    expect(equatorOriginLinks?.openStreetMapEmbedUrl).toContain('marker=0.000000%2C0.000000');
    expect(equatorOriginLinks?.googleMapsUrl).toContain('query=0.000000%2C0.000000');
  });

  test('frontend source does not use blocking browser dialogs', async () => {
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (source.includes('alert(') || source.includes('confirm(')) {
        offenders.push(file.pathname);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('buttons in files with forms declare explicit button types', async () => {
    const sharedButton = await readFile(
      new URL('../src/components/ui/button.tsx', import.meta.url),
      'utf8',
    );
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const offenders: string[] = [];

    expect(sharedButton).toContain("type: type ?? 'button'");

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (!source.includes('<form')) {
        continue;
      }

      const buttonTags = source.match(/<button\b[\s\S]*?>/g) ?? [];
      const untypedButtons = buttonTags.filter((tag) => !/\btype\s*=/.test(tag));
      if (untypedButtons.length > 0) {
        offenders.push(file.pathname.replace(/\\/g, '/'));
      }
    }

    expect(offenders).toEqual([]);
  });

  test('frontend generated identifiers avoid Math.random', async () => {
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (source.includes('Math.random(')) {
        offenders.push(file.pathname);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('backend runtime identifiers avoid Math.random', async () => {
    const files = await collectSourceFiles(new URL('../../backend/src/', import.meta.url));
    const offenders: string[] = [];

    for (const file of files) {
      const pathname = file.pathname.replace(/\\/g, '/');
      if (pathname.endsWith('.test.ts') || pathname.includes('/__tests__/')) {
        continue;
      }

      const source = await readFile(file, 'utf8');
      if (source.includes('Math.random(')) {
        offenders.push(pathname);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('new-tab links prevent opener access', async () => {
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const targetBlankTags = source.match(/<[^>]*target="_blank"[^>]*>/g) ?? [];

      for (const tag of targetBlankTags) {
        if (!/\brel=/.test(tag) || !/\bnoopener\b/.test(tag)) {
          offenders.push(file.pathname);
          break;
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test('programmatic new-tab opens prevent opener access', async () => {
    const files = await collectSourceFiles(new URL('../src/', import.meta.url));
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const lines = source.split(/\r?\n/);

      lines.forEach((line, index) => {
        if (/window\.open\([^)]*['_"]_blank['_"]/.test(line)) {
          const context = lines.slice(index, index + 12).join('\n');
          if (!context.includes('noopener') && !/\.opener\s*=\s*null/.test(context)) {
            offenders.push(`${file.pathname}:${index + 1}`);
          }
        }

        if (/\.target\s*=\s*['_"]_blank['_"]/.test(line)) {
          const context = lines.slice(index, index + 5).join('\n');
          if (!/\.rel\s*=.*noopener/.test(context)) {
            offenders.push(`${file.pathname}:${index + 1}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
