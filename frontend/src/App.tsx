import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth';
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DeferredOfflineIndicator } from '@/components/DeferredOfflineIndicator';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
  ADMIN_ROLES,
  COMMERCIAL_ROLES,
  INTERNAL_ROLES,
  MANAGEMENT_ROLES,
  PROJECT_WORKSPACE_ROLES,
  REPORT_ROLES,
  SUBCONTRACTOR_ROLES,
} from './appRouteRoles';
import {
  AcceptInvitePage,
  AssignedWorkPage,
  AuditLogPage,
  ClaimsPage,
  CompanyOnboardingPage,
  CompanySettingsPage,
  CostsPage,
  DailyDiaryPage,
  DashboardPage,
  DelayRegisterPage,
  DocketApprovalsPage,
  DocketEditPage,
  DocketsListPage,
  DocumentationPage,
  DocumentsPage,
  DrawingsPage,
  ForemanMobileShell,
  ForgotPasswordPage,
  HoldPointsPage,
  ITPPage,
  LandingPage,
  LoginPage,
  LotDetailPage,
  LotEditPage,
  LotsPage,
  MagicLinkPage,
  MyCompanyPage,
  NCRPage,
  NotFoundPage,
  NotificationsPage,
  OAuthCallbackPage,
  PortfolioPage,
  PrivacyPolicyPage,
  ProfilePage,
  ProjectAreasPage,
  ProjectsPage,
  ProjectSettingsPage,
  ProjectUsersPage,
  PublicHoldPointReleasePage,
  RegisterPage,
  ReportsPage,
  ResetPasswordPage,
  SettingsPage,
  SubcontractorDashboard,
  SubcontractorDocumentsPage,
  SubcontractorHoldPointsPage,
  SubcontractorITPsPage,
  SubcontractorLotITPPage,
  SubcontractorNCRsPage,
  SubcontractorTestResultsPage,
  SubcontractorsPage,
  SupportPage,
  TermsOfServicePage,
  TestResultsPage,
  TodayWorklist,
  VerifyEmailPage,
} from './appLazyPages';
import { ProjectDetailRoute } from './appProjectRoutes';

const ENABLE_DEV_TOOLS = import.meta.env.DEV;
const ENABLE_MOCK_OAUTH_ROUTE =
  import.meta.env.DEV && import.meta.env.VITE_ALLOW_MOCK_OAUTH === 'true';

// Layouts
import { AuthLayout } from '@/components/layouts/AuthLayout';
const ProtectedAppShell = lazy(() =>
  import('@/components/layouts/ProtectedAppShell').then((m) => ({
    default: m.ProtectedAppShell,
  })),
);

const OAuthMockPage = ENABLE_MOCK_OAUTH_ROUTE
  ? lazy(() => import('@/pages/auth/OAuthMockPage').then((m) => ({ default: m.OAuthMockPage })))
  : null;
const RoleSwitcher = ENABLE_DEV_TOOLS
  ? lazy(() => import('@/components/dev/RoleSwitcher').then((m) => ({ default: m.RoleSwitcher })))
  : null;

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/auth/magic-link" element={<MagicLinkPage />} />
              <Route path="/auth/oauth-callback" element={<OAuthCallbackPage />} />
              {ENABLE_MOCK_OAUTH_ROUTE && OAuthMockPage && (
                <Route path="/auth/oauth-mock" element={<OAuthMockPage />} />
              )}
            </Route>

            {/* Landing Page (public) */}
            <Route path="/landing" element={<LandingPage />} />

            {/* Legal Pages (public, no layout) */}
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />

            {/* Subcontractor Portal - Accept Invite (public/hybrid auth) */}
            <Route path="/subcontractor-portal/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />

            {/* Public secure hold-point release link */}
            <Route path="/hp-release/:token" element={<PublicHoldPointReleasePage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedAppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/onboarding" element={<CompanyOnboardingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Portfolio - Admin Only */}
              <Route
                path="/portfolio"
                element={
                  <RoleProtectedRoute allowedRoles={ADMIN_ROLES}>
                    <PortfolioPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Projects */}
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/reports" element={<Navigate to="/projects" replace />} />
              <Route path="/subcontractors" element={<Navigate to="/projects" replace />} />
              <Route path="/projects/:projectId" element={<ProjectDetailRoute />} />

              {/* Foreman Mobile Views - nested under ForemanMobileShell for 5-tab nav */}
              <Route
                path="/projects/:projectId/foreman"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <ForemanMobileShell />
                  </RoleProtectedRoute>
                }
              >
                <Route index element={<Navigate to="today" replace />} />
                <Route path="today" element={<TodayWorklist />} />
              </Route>

              {/* Project Settings - Admin Only */}
              <Route
                path="/projects/:projectId/settings"
                element={
                  <RoleProtectedRoute allowedRoles={ADMIN_ROLES}>
                    <ProjectSettingsPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/users"
                element={
                  <RoleProtectedRoute allowedRoles={ADMIN_ROLES}>
                    <ProjectUsersPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/areas"
                element={
                  <RoleProtectedRoute allowedRoles={ADMIN_ROLES}>
                    <ProjectAreasPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Lots */}
              <Route
                path="/projects/:projectId/lots"
                element={
                  <RoleProtectedRoute allowedRoles={PROJECT_WORKSPACE_ROLES}>
                    <LotsPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/lots/:lotId"
                element={
                  <RoleProtectedRoute allowedRoles={PROJECT_WORKSPACE_ROLES}>
                    <LotDetailPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/lots/:lotId/edit"
                element={
                  <RoleProtectedRoute allowedRoles={MANAGEMENT_ROLES}>
                    <LotEditPage />
                  </RoleProtectedRoute>
                }
              />

              {/* ITP */}
              <Route
                path="/projects/:projectId/itp"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <ITPPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Hold Points */}
              <Route
                path="/projects/:projectId/hold-points"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <HoldPointsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Test Results */}
              <Route
                path="/projects/:projectId/tests"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <TestResultsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* NCR */}
              <Route
                path="/projects/:projectId/ncr"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <NCRPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Daily Diary */}
              <Route
                path="/projects/:projectId/diary"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <DailyDiaryPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/delays"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <DelayRegisterPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Docket Approvals */}
              <Route
                path="/projects/:projectId/dockets"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <DocketApprovalsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Progress Claims - Commercial roles only */}
              <Route
                path="/projects/:projectId/claims"
                element={
                  <RoleProtectedRoute allowedRoles={COMMERCIAL_ROLES}>
                    <ClaimsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Costs - Commercial roles only */}
              <Route
                path="/projects/:projectId/costs"
                element={
                  <RoleProtectedRoute allowedRoles={COMMERCIAL_ROLES}>
                    <CostsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Documents */}
              <Route
                path="/projects/:projectId/documents"
                element={
                  <RoleProtectedRoute allowedRoles={INTERNAL_ROLES}>
                    <DocumentsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Drawings */}
              <Route
                path="/projects/:projectId/drawings"
                element={
                  <RoleProtectedRoute allowedRoles={REPORT_ROLES}>
                    <DrawingsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Subcontractors - Management roles only */}
              <Route
                path="/projects/:projectId/subcontractors"
                element={
                  <RoleProtectedRoute allowedRoles={MANAGEMENT_ROLES}>
                    <SubcontractorsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Reports */}
              <Route
                path="/projects/:projectId/reports"
                element={
                  <RoleProtectedRoute allowedRoles={REPORT_ROLES}>
                    <ReportsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Settings */}
              <Route path="/settings" element={<SettingsPage />} />

              {/* Company Settings - Admin Only */}
              <Route
                path="/company-settings"
                element={
                  <RoleProtectedRoute allowedRoles={ADMIN_ROLES}>
                    <CompanySettingsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Profile */}
              <Route path="/profile" element={<ProfilePage />} />

              {/* Notifications */}
              <Route path="/notifications" element={<NotificationsPage />} />

              {/* In-app invitation acceptance */}
              <Route path="/invitations" element={<AcceptInvitePage />} />

              {/* Support */}
              <Route path="/docs" element={<DocumentationPage />} />
              <Route path="/documentation" element={<Navigate to="/docs" replace />} />
              <Route path="/support" element={<SupportPage />} />

              {/* Audit Log - Admin Only */}
              <Route
                path="/audit-log"
                element={
                  <RoleProtectedRoute allowedRoles={ADMIN_ROLES}>
                    <AuditLogPage />
                  </RoleProtectedRoute>
                }
              />

              {/* My Company - Subcontractor admins only */}
              <Route
                path="/my-company"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <MyCompanyPage />
                  </RoleProtectedRoute>
                }
              />

              {/* Subcontractor Portal - Protected routes */}
              <Route
                path="/subcontractor-portal"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <SubcontractorDashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/docket/new"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <DocketEditPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/docket/:docketId"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <DocketEditPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/dockets"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <DocketsListPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/work"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <AssignedWorkPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/itps"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <SubcontractorITPsPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/lots/:lotId/itp"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <SubcontractorLotITPPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/holdpoints"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <SubcontractorHoldPointsPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/tests"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <SubcontractorTestResultsPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/ncrs"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <SubcontractorNCRsPage />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/subcontractor-portal/documents"
                element={
                  <RoleProtectedRoute allowedRoles={SUBCONTRACTOR_ROLES}>
                    <SubcontractorDocumentsPage />
                  </RoleProtectedRoute>
                }
              />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Toaster />
        <DeferredOfflineIndicator />
        <CookieConsentBanner />
        {ENABLE_DEV_TOOLS && RoleSwitcher && <RoleSwitcher />}
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
