import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { CLAIM_SUBMISSION_OPTIONS } from '../src/pages/claims/submissionOptions';
import { getPhotoLocationLinks } from '../src/pages/lots/components/photoLocationLinks';

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

test.describe('production readiness guardrails', () => {
  test('claim submission exposes only implemented methods', () => {
    expect(CLAIM_SUBMISSION_OPTIONS.map((option) => option.method)).toEqual(['download']);
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
    const source = await readFile(
      new URL('../src/pages/lots/LotDetailPage.tsx', import.meta.url),
      'utf8',
    );

    expect(source).not.toContain('fallbackProjectData');
    expect(source).not.toContain("name: 'Unknown Project'");
    expect(source).not.toContain('catch(() => ({ testResults: [] }))');
    expect(source).not.toContain('catch(() => ({ ncrs: [] }))');
  });

  test('paid-product actions do not expose known dead-end alerts', async () => {
    const companySettings = await readFile(
      new URL('../src/pages/company/CompanySettingsPage.tsx', import.meta.url),
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
    const drawingsPage = await readFile(
      new URL('../src/pages/drawings/DrawingsPage.tsx', import.meta.url),
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
    expect(companySettings).toContain('supportMailtoHref');
    expect(claimsPage).not.toContain('alert(');
    expect(createClaimModal).not.toContain('alert(');
    expect(disputeModal).not.toContain('alert(');
    expect(documentsPage).not.toContain('alert(');
    expect(drawingsPage).not.toContain('alert(');
    expect(testResultsPage).not.toContain('alert(');
    expect(uploadCertificateModal).not.toContain('alert(');
    expect(batchUploadModal).not.toContain('alert(');
    expect(claimsPage).not.toContain('Lot exclusion must be handled');
    expect(completenessModal).not.toContain('Exclude Problem Lots');
  });

  test('landing page avoids unverifiable claims and unmounted CTA routes', async () => {
    const landingSources = await Promise.all(
      [
        '../src/components/landing/Hero.tsx',
        '../src/components/landing/Header.tsx',
        '../src/components/landing/Pricing.tsx',
        '../src/components/landing/FinalCTA.tsx',
        '../src/components/landing/SocialProof.tsx',
        '../src/components/landing/Footer.tsx',
        '../src/components/landing/FAQ.tsx',
        '../src/components/landing/MobileShowcase.tsx',
      ].map((relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')),
    );
    const joinedSource = landingSources.join('\n');

    expect(joinedSource).not.toContain('50+');
    expect(joinedSource).not.toContain('Pacific Civil');
    expect(joinedSource).not.toContain('Georgiou');
    expect(joinedSource).not.toContain('Unlimited data storage');
    expect(joinedSource).not.toContain('Support via email & phone');
    expect(joinedSource).not.toContain('Setup in one week');
    expect(joinedSource).not.toContain('Most teams');
    expect(joinedSource).not.toContain('1300 555 123');
    expect(joinedSource).not.toContain('to="/contact"');
    expect(joinedSource).not.toContain('to="/pricing"');
    expect(joinedSource).not.toContain('to="/about"');
    expect(joinedSource).not.toContain('to="/mobile"');
    expect(joinedSource).not.toContain('to="#"');
    expect(joinedSource).toContain('supportMailtoHref');
    expect(joinedSource).toContain('id="mobile"');
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
    const quickPhotoCapture = await readFile(
      new URL('../src/components/QuickPhotoCapture.tsx', import.meta.url),
      'utf8',
    );
    const offlineDb = await readFile(new URL('../src/lib/offlineDb.ts', import.meta.url), 'utf8');

    expect(uploadCertificateModal).toContain('URL.revokeObjectURL(pdfUrlRef.current)');
    expect(commentsSection).toContain('revokeAttachmentPreviews(pendingAttachmentsRef.current)');
    expect(commentsSection).toContain('revokeAttachmentPreviews(replyAttachmentsRef.current)');
    expect(commentsSection).toContain('const clearPendingDraft = useCallback');
    expect(commentsSection).toContain('const clearReplyDraft = useCallback');
    expect(commentsSection).toContain('const beginReply = useCallback');
    expect(commentsSection).toContain('[entityType, entityId, clearPendingDraft, clearReplyDraft]');
    expect(commentsSection).toContain('onClick={clearReplyDraft}');
    expect(commentsSection).toContain('onClick={() => beginReply(comment.id)}');
    expect(quickPhotoCapture).toContain('URL.revokeObjectURL(previewUrlRef.current)');
    expect(quickPhotoCapture).not.toContain('alert(');
    expect(offlineDb).toContain('URL.revokeObjectURL(objectUrl)');
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

  test('comment attachment direct opens are restricted to the configured Supabase origin', async () => {
    const commentsSection = await readFile(
      new URL('../src/components/comments/CommentsSection.tsx', import.meta.url),
      'utf8',
    );
    const configSource = await readFile(new URL('../src/lib/config.ts', import.meta.url), 'utf8');

    expect(configSource).toContain('export const SUPABASE_URL');
    expect(commentsSection).toContain("import { SUPABASE_URL } from '@/lib/config'");
    expect(commentsSection).toContain('if (!SUPABASE_URL) return false');
    expect(commentsSection).toContain('if (url.origin !== expectedOrigin) return false');
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
    const commentsRoute = await readFile(
      new URL('../../backend/src/routes/comments.ts', import.meta.url),
      'utf8',
    );

    expect(commentsRoute).toContain('function getSafeAttachmentMimeType');
    expect(commentsRoute).toContain(
      "res.setHeader('Content-Type', getSafeAttachmentMimeType(attachment.mimeType))",
    );
    expect(commentsRoute).toContain("res.setHeader('X-Content-Type-Options', 'nosniff')");
    expect(commentsRoute).toContain('getSafeAttachmentMimeType(attachment.mimeType)');
  });

  test('document downloads only redirect to configured Supabase storage URLs', async () => {
    const documentsRoute = await readFile(
      new URL('../../backend/src/routes/documents.ts', import.meta.url),
      'utf8',
    );
    const supabaseSource = await readFile(
      new URL('../../backend/src/lib/supabase.ts', import.meta.url),
      'utf8',
    );

    expect(documentsRoute).toContain('function isSafeExternalDocumentUrl');
    expect(documentsRoute).toContain('getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET) !== null');
    expect(documentsRoute).toContain('if (!isSafeExternalDocumentUrl(document.fileUrl))');
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

    expect(commentsSection).toContain('function buildCommentsPath');
    expect(commentsSection).toContain('page: String(page)');
    expect(commentsSection).toContain('limit: String(COMMENTS_PAGE_LIMIT)');
    expect(commentsSection).toContain("return 'Unknown date'");
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
    const runtimeConfig = await readFile(
      new URL('../../backend/src/lib/runtimeConfig.ts', import.meta.url),
      'utf8',
    );

    expect(appSource).toContain(
      "import.meta.env.DEV && import.meta.env.VITE_ALLOW_MOCK_OAUTH === 'true'",
    );
    expect(appSource).toContain('const OAuthMockPage = ENABLE_MOCK_OAUTH_ROUTE');
    expect(appSource).toContain('{ENABLE_MOCK_OAUTH_ROUTE && OAuthMockPage && (');
    expect(oauthRoute).toContain(
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
      /<ProtectedRoute>\s*<KeyboardShortcutsProvider>\s*<MainLayout\s*\/>\s*<\/KeyboardShortcutsProvider>\s*<\/ProtectedRoute>/,
    );
    expect(appSource).not.toMatch(/<KeyboardShortcutsProvider>\s*<Suspense/);
    expect(protectedShellSource).toContain('<OnboardingTour enabled={showGeneralOnboarding} />');
    expect(protectedShellSource).toContain('<ChangelogNotification />');
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

    expect(protectedShellSource).toContain(
      'const showGeneralOnboarding = !SUBCONTRACTOR_ROLES.includes(userRole)',
    );
    expect(protectedShellSource).toContain('<OnboardingTour enabled={showGeneralOnboarding} />');
    expect(onboardingSource).toContain('enabled = true');
    expect(onboardingSource).toContain('if (!enabled && !forceShow)');
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

    expect(onboardingSource).toContain('readLocalStorageItem(ONBOARDING_STORAGE_KEY)');
    expect(onboardingSource).toContain("writeLocalStorageItem(ONBOARDING_STORAGE_KEY, 'true')");
    expect(onboardingSource).toContain('removeLocalStorageItem(ONBOARDING_STORAGE_KEY)');
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

    expect(roleProtectedRoute).toContain("import { ShieldAlert } from 'lucide-react'");
    expect(roleProtectedRoute).toContain('<ShieldAlert className="h-8 w-8" aria-hidden="true" />');
    expect(lotDetailPage).toContain(
      "import { AlertTriangle, SearchX, ShieldAlert, Users } from 'lucide-react'",
    );
    expect(lotDetailPage).toContain('<ErrorIcon className="h-8 w-8" aria-hidden="true" />');
    expect(roleProtectedRoute).not.toContain('className="text-6xl"');
    expect(lotDetailPage).not.toContain('className="text-6xl"');
  });

  test('backend diagnostic endpoints are gated out of production', async () => {
    const notificationsSource = await readFile(
      new URL('../../backend/src/routes/notifications.ts', import.meta.url),
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

    expect(notificationsSource).toContain('function requireNonProductionDiagnostics');
    expect(notificationsSource).toContain("process.env.NODE_ENV === 'production'");
    for (const route of ['email-queue', 'add-to-digest', 'send-digest', 'digest-queue']) {
      expect(notificationsSource).toContain(route);
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
    const holdpointsRoute = await readFile(
      new URL('../../backend/src/routes/holdpoints.ts', import.meta.url),
      'utf8',
    );

    expect(holdpointsRoute).toContain('buildFrontendUrl(`/hp-release/${recipient.secureToken}`)');
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
    const ncrActions = await readFile(
      new URL('../src/pages/ncr/hooks/useNCRActions.ts', import.meta.url),
      'utf8',
    );
    const testResultsRoute = await readFile(
      new URL('../../backend/src/routes/testResults.ts', import.meta.url),
      'utf8',
    );

    expect(appSource).toContain(
      '<Route path="/projects/:projectId/hold-points" element={<HoldPointsPage />} />',
    );
    expect(appSource).toContain('<Route path="/projects/:projectId/ncr" element={<NCRPage />} />');
    expect(appSource).toContain(
      '<Route path="/projects/:projectId/tests" element={<TestResultsPage />} />',
    );
    expect(holdPointsPage).toContain(
      '/projects/${encodeURIComponent(projectId)}/hold-points?hp=${encodeURIComponent(hpId)}',
    );
    expect(holdPointsPage).not.toContain('/projects/${projectId}/holdpoints?hp=${hpId}');
    expect(ncrActions).toContain(
      "/projects/${encodeURIComponent(projectId || '')}/ncr?ncr=${encodeURIComponent(ncrId)}",
    );
    expect(ncrActions).not.toContain('/projects/${projectId}/ncrs?ncr=${ncrId}');
    expect(testResultsRoute).toContain('/projects/${testResult.projectId}/tests');
    expect(testResultsRoute).not.toContain('/projects/${testResult.projectId}/test-results');
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

    expect(diaryReporting).toContain('const CSV_FORMULA_PREFIX_PATTERN = /^[\\t\\r ]*[=+\\-@]/');
    expect(diaryReporting).toContain('const safeValue = CSV_FORMULA_PREFIX_PATTERN.test(rawValue)');
    expect(diaryReporting).toContain("row.map(formatCsvCell).join(',')");
  });

  test('scheduled reports are capped per project across API and UI', async () => {
    const reportsRoute = await readFile(
      new URL('../../backend/src/routes/reports.ts', import.meta.url),
      'utf8',
    );
    const scheduledReportsLib = await readFile(
      new URL('../../backend/src/lib/scheduledReports.ts', import.meta.url),
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

    expect(scheduledReportsLib).toContain('export const MAX_SCHEDULED_REPORTS_PER_PROJECT = 25');
    expect(reportsRoute).toContain('take: MAX_SCHEDULED_REPORTS_PER_PROJECT');
    expect(reportsRoute).toContain('existingScheduleCount >= MAX_SCHEDULED_REPORTS_PER_PROJECT');
    expect(scheduledReportsLib).toContain('processDueScheduledReports');
    expect(scheduledReportsLib).toContain('claimScheduledReport');
    expect(scheduledReportsLib).toContain('sendScheduledReportEmail');
    expect(scheduledReportsLib).toContain('pdfBuffer');
    expect(backendServer).toContain('startScheduledReportWorker');
    expect(backendPackage).toContain('reports:send-due');
    expect(scheduleModal).toContain('const DEFAULT_MAX_SCHEDULED_REPORTS = 25');
    expect(scheduleModal).toContain('disabled={hasReachedScheduleLimit}');
    expect(scheduleModal).toContain('A project can have up to ${maxSchedules} scheduled reports');
  });

  test('notification digest queue has a production sender', async () => {
    const notificationJobs = await readFile(
      new URL('../../backend/src/lib/notificationJobs.ts', import.meta.url),
      'utf8',
    );
    const notificationsRoute = await readFile(
      new URL('../../backend/src/routes/notifications.ts', import.meta.url),
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

    expect(notificationsRoute).toContain("timing === 'digest' && preferences.dailyDigest");
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
    expect(notificationAutomation).toContain('NOTIFICATION_AUTOMATION_WORKER_ENABLED');
    expect(notificationAutomation).not.toContain("from '../routes/notifications");
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
    expect(smokeScript).toContain("TRUST_PROXY: 'true'");
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
    expect(productionPreflightWorkflow).toContain(
      'environment: ${{ github.event.inputs.environment }}',
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
    const testWorkflow = await readFile(
      new URL('../../.github/workflows/test.yml', import.meta.url),
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
    expect(testWorkflow).toContain('http://localhost:3001/ready');
    expect(testWorkflow).toContain('docker build -t siteproof-backend-ci .');
    expect(testWorkflow).toContain('DOCKER_BUILDKIT: "1"');
  });

  test('CI gates cover audits, formatting, migrations, lint, types, build, and tests', async () => {
    const ciWorkflow = await readFile(
      new URL('../../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    );
    const testWorkflow = await readFile(
      new URL('../../.github/workflows/test.yml', import.meta.url),
      'utf8',
    );
    const frontendPackage = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(frontendPackage.scripts.lint).toBe(
      'eslint src/ e2e/ "scripts/**/*.{js,mjs}" playwright.config.ts vite.config.ts',
    );
    expect(frontendPackage.scripts.format).toContain('"e2e/**/*.{ts,tsx}"');
    expect(frontendPackage.scripts.format).toContain('"scripts/**/*.{js,mjs}"');
    expect(frontendPackage.scripts.format).toContain('vite.config.ts');
    expect(frontendPackage.scripts['format:check']).toContain('"e2e/**/*.{ts,tsx}"');
    expect(frontendPackage.scripts['format:check']).toContain('"scripts/**/*.{js,mjs}"');
    expect(frontendPackage.scripts['format:check']).toContain('vite.config.ts');

    expect(ciWorkflow).toContain('run: npm audit --audit-level=moderate');
    expect(ciWorkflow).toContain('run: npm run format:check');
    expect(ciWorkflow).toContain('Validate Prisma migrations');
    expect(ciWorkflow).toContain('Verify database migration status');
    expect(ciWorkflow).toContain('run: npm run lint');
    expect(ciWorkflow).toContain('run: npm run type-check');
    expect(ciWorkflow).toContain('run: npm run build');
    expect(ciWorkflow).toContain('run: docker build -t siteproof-backend-ci .');
    expect(ciWorkflow).toContain('DOCKER_BUILDKIT: "1"');
    expect(ciWorkflow).toContain('run: npm run preflight:integrations');
    expect(ciWorkflow).toContain('run: npm test');

    expect(testWorkflow).toContain('run: cd backend && npm audit --audit-level=moderate');
    expect(testWorkflow).toContain('run: cd backend && npm run format:check');
    expect(testWorkflow).toContain('Validate Prisma migrations');
    expect(testWorkflow).toContain('Verify test database migration status');
    expect(testWorkflow).toContain('run: cd backend && npm run lint');
    expect(testWorkflow).toContain('run: cd backend && npm run type-check');
    expect(testWorkflow).toContain('run: cd backend && npm run build');
    expect(testWorkflow).toContain('run: cd backend && docker build -t siteproof-backend-ci .');
    expect(testWorkflow).toContain('DOCKER_BUILDKIT: "1"');
    expect(testWorkflow).toContain('run: cd backend && npm run preflight:integrations');
    expect(testWorkflow).toContain('run: cd backend && npm run test:coverage');
    expect(testWorkflow).toContain('run: cd frontend && npm audit --audit-level=moderate');
    expect(testWorkflow).toContain('run: cd frontend && npm run format:check');
    expect(testWorkflow).not.toContain('run: cd backend && npm test');
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
      '../src/components/foreman/PhotoCaptureModal.tsx',
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
    const uploadRouteFiles = [
      '../../backend/src/routes/auth.ts',
      '../../backend/src/routes/company.ts',
      '../../backend/src/routes/comments.ts',
      '../../backend/src/routes/documents.ts',
      '../../backend/src/routes/drawings.ts',
      '../../backend/src/routes/testResults.ts',
    ];
    const routeSources = await Promise.all(
      uploadRouteFiles.map((relativePath) =>
        readFile(new URL(relativePath, import.meta.url), 'utf8'),
      ),
    );
    const joinedRoutes = routeSources.join('\n');

    expect(uploadPaths).toContain('export function getUploadSubdirectoryPath');
    expect(uploadPaths).toContain('export function ensureUploadSubdirectory');
    expect(uploadPaths).toContain('export async function ensureUploadSubdirectoryAsync');
    expect(joinedRoutes).not.toContain('fs.mkdirSync');
    expect(joinedRoutes).toContain("ensureUploadSubdirectory('avatars')");
    expect(joinedRoutes).toContain("ensureUploadSubdirectory('company-logos')");
    expect(joinedRoutes).toContain("ensureUploadSubdirectoryAsync('comments')");
    expect(joinedRoutes).toContain("ensureUploadSubdirectory('documents')");
    expect(joinedRoutes).toContain("ensureUploadSubdirectory('drawings')");
    expect(joinedRoutes).toContain("ensureUploadSubdirectory('certificates')");
    expect(joinedRoutes).toContain('Failed to delete old company logo');
  });

  test('dashboard print styles do not use HTML parsing APIs', async () => {
    const dashboardPage = await readFile(
      new URL('../src/pages/DashboardPage.tsx', import.meta.url),
      'utf8',
    );

    expect(dashboardPage).toContain('printStyles.textContent');
    expect(dashboardPage).not.toContain('printStyles.innerHTML');
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
    const documentsSource = await readFile(
      new URL('../../backend/src/routes/documents.ts', import.meta.url),
      'utf8',
    );
    const testResultsSource = await readFile(
      new URL('../../backend/src/routes/testResults.ts', import.meta.url),
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
    expect(documentsSource).toContain("fetchWithTimeout('https://api.anthropic.com/v1/messages'");
    expect(testResultsSource).toContain("fetchWithTimeout('https://api.anthropic.com/v1/messages'");

    const frontendSourceFiles = await collectSourceFiles(new URL('../src/', import.meta.url));
    const backendSourceFiles = await collectSourceFiles(
      new URL('../../backend/src/', import.meta.url),
    );
    const allowedRawFetchFiles = [
      '/frontend/src/lib/fetchWithTimeout.ts',
      '/frontend/src/lib/useOfflineStatus.ts',
      '/backend/src/lib/fetchWithTimeout.ts',
      '/backend/src/routes/webhooks.ts',
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
    const offlineStatusSource = await readFile(
      new URL('../src/lib/useOfflineStatus.ts', import.meta.url),
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
    expect(offlineStatusSource).toContain("lot.syncStatus === 'conflict'");
    expect(offlineStatusSource).toContain("lot.syncStatus === 'synced'");
    expect(offlineStatusSource).toContain('Removing stale lot edit queue item for conflicted lot');
    expect(conflictModalSource).toContain('function pickConflictForReview');
    expect(conflictModalSource).toContain('formatConflictValue');
    expect(conflictModalSource).not.toContain('setSelectedConflict(null);');
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
    const lotsPage = await readFile(
      new URL('../src/pages/lots/LotsPage.tsx', import.meta.url),
      'utf8',
    );
    const lotFiltersBar = await readFile(
      new URL('../src/pages/lots/components/LotFiltersBar.tsx', import.meta.url),
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
    expect(dashboardPage).toContain('readLocalStorageItem(WIDGET_STORAGE_KEY)');
    expect(dashboardPage).toContain('writeLocalStorageItem(WIDGET_STORAGE_KEY');
    expect(dashboardPage).toContain('parseVisibleWidgetsPreference');
    expect(dashboardPage).not.toContain('return JSON.parse(stored) as WidgetId[]');
    expect(dashboardPage).not.toContain('localStorage.getItem(WIDGET_STORAGE_KEY)');
    expect(dashboardPage).not.toContain('localStorage.setItem(WIDGET_STORAGE_KEY');
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
    expect(lotFiltersBar).toContain('writeLocalStorageItem(COLUMN_STORAGE_KEY');
    expect(lotFiltersBar).toContain('writeLocalStorageItem(COLUMN_ORDER_STORAGE_KEY');
    expect(lotFiltersBar).toContain('parseSavedFiltersPreference');
    expect(lotFiltersBar).not.toContain('return JSON.parse(stored) as SavedFilter[]');
    expect(lotFiltersBar).not.toContain('localStorage.getItem(SAVED_FILTERS_STORAGE_KEY)');
    expect(lotFiltersBar).not.toContain('localStorage.setItem(SAVED_FILTERS_STORAGE_KEY');
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
    const lotDetailSource = await readFile(
      new URL('../src/pages/lots/LotDetailPage.tsx', import.meta.url),
      'utf8',
    );
    const claimsSource = await readFile(
      new URL('../src/pages/claims/ClaimsPage.tsx', import.meta.url),
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
    expect(lotDetailSource).toContain("await import('@/lib/pdfGenerator')");
    expect(claimsSource).toContain("await import('@/lib/pdfGenerator')");
    expect(lotDetailSource).not.toMatch(/import \{[^}]*generateConformanceReportPDF/);
    expect(claimsSource).not.toMatch(/import \{[^}]*generateClaimEvidencePackagePDF/);
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
    expect(backendPushSource).toContain('function getConfiguredVapidKeys');
    expect(backendPushSource).toContain('parseOptionalSubscriptionId');
    expect(backendPushSource).toContain('currentDeviceSubscribed');
    expect(backendPushSource).toContain('process.env.VAPID_PUBLIC_KEY?.trim()');
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
    const itpChecklistSource = await readFile(
      new URL('../src/pages/lots/components/ITPChecklistTab.tsx', import.meta.url),
      'utf8',
    );

    expect(photoLocationLinksSource).toContain('Number.isFinite(latitude)');
    expect(photoLocationLinksSource).toContain('Number.isFinite(longitude)');
    expect(photoLocationLinksSource).toContain('latitude < -90');
    expect(photoLocationLinksSource).toContain('longitude > 180');
    expect(photoLocationLinksSource).toContain('new URLSearchParams');
    expect(photoLocationMapSource).toContain('referrerPolicy="no-referrer"');
    expect(photosTabSource).toContain('<PhotoLocationMap');
    expect(itpChecklistSource).toContain('<PhotoLocationMap');
    expect(photosTabSource).not.toContain('openstreetmap.org/export/embed.html?bbox=${Number');
    expect(itpChecklistSource).not.toContain('openstreetmap.org/export/embed.html?bbox=${Number');
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
