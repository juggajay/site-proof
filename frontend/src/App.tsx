import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/lib/auth'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { KeyboardShortcutsHelp, useKeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp'
import { OnboardingTour } from '@/components/OnboardingTour'
import { ChangelogNotification } from '@/components/ChangelogNotification'
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import { RoleSwitcher } from '@/components/dev/RoleSwitcher'
import { PageSkeleton } from '@/components/ui/Skeleton'

// Layouts (keep static - used everywhere)
import { MainLayout } from '@/components/layouts/MainLayout'
import { AuthLayout } from '@/components/layouts/AuthLayout'

// Lazy load Auth Pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })))
const MagicLinkPage = lazy(() => import('@/pages/auth/MagicLinkPage').then(m => ({ default: m.MagicLinkPage })))
const OAuthCallbackPage = lazy(() => import('@/pages/auth/OAuthCallbackPage').then(m => ({ default: m.OAuthCallbackPage })))
const OAuthMockPage = lazy(() => import('@/pages/auth/OAuthMockPage').then(m => ({ default: m.OAuthMockPage })))

// Landing Page
const LandingPage = lazy(() => import('@/pages/LandingPage').then(m => ({ default: m.LandingPage })))

// Lazy load Main Pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ProjectsPage = lazy(() => import('@/pages/projects/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })))
const ProjectSettingsPage = lazy(() => import('@/pages/projects/settings/ProjectSettingsPage').then(m => ({ default: m.ProjectSettingsPage })))
const ProjectUsersPage = lazy(() => import('@/pages/projects/settings/ProjectUsersPage').then(m => ({ default: m.ProjectUsersPage })))
const ProjectAreasPage = lazy(() => import('@/pages/projects/settings/ProjectAreasPage').then(m => ({ default: m.ProjectAreasPage })))
const LotsPage = lazy(() => import('@/pages/lots/LotsPage').then(m => ({ default: m.LotsPage })))
const LotDetailPage = lazy(() => import('@/pages/lots/LotDetailPage').then(m => ({ default: m.LotDetailPage })))
const LotEditPage = lazy(() => import('@/pages/lots/LotEditPage').then(m => ({ default: m.LotEditPage })))
const ITPPage = lazy(() => import('@/pages/itp/ITPPage').then(m => ({ default: m.ITPPage })))
const HoldPointsPage = lazy(() => import('@/pages/holdpoints/HoldPointsPage').then(m => ({ default: m.HoldPointsPage })))
const TestResultsPage = lazy(() => import('@/pages/tests/TestResultsPage').then(m => ({ default: m.TestResultsPage })))
const NCRPage = lazy(() => import('@/pages/ncr/NCRPage').then(m => ({ default: m.NCRPage })))
const DailyDiaryPage = lazy(() => import('@/pages/diary/DailyDiaryPage').then(m => ({ default: m.DailyDiaryPage })))
const DelayRegisterPage = lazy(() => import('@/pages/diary/DelayRegisterPage').then(m => ({ default: m.DelayRegisterPage })))
const DocketApprovalsPage = lazy(() => import('@/pages/dockets/DocketApprovalsPage').then(m => ({ default: m.DocketApprovalsPage })))
const ClaimsPage = lazy(() => import('@/pages/claims/ClaimsPage').then(m => ({ default: m.ClaimsPage })))
const DocumentsPage = lazy(() => import('@/pages/documents/DocumentsPage').then(m => ({ default: m.DocumentsPage })))
const DrawingsPage = lazy(() => import('@/pages/drawings/DrawingsPage').then(m => ({ default: m.DrawingsPage })))
const SubcontractorsPage = lazy(() => import('@/pages/subcontractors/SubcontractorsPage').then(m => ({ default: m.SubcontractorsPage })))
const MyCompanyPage = lazy(() => import('@/pages/subcontractors/MyCompanyPage').then(m => ({ default: m.MyCompanyPage })))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))
const CostsPage = lazy(() => import('@/pages/costs/CostsPage').then(m => ({ default: m.CostsPage })))
const CompanySettingsPage = lazy(() => import('@/pages/company/CompanySettingsPage').then(m => ({ default: m.CompanySettingsPage })))
const PortfolioPage = lazy(() => import('@/pages/portfolio/PortfolioPage').then(m => ({ default: m.PortfolioPage })))

// Lazy load Foreman Mobile Components
const ForemanMobileShell = lazy(() => import('@/components/foreman').then(m => ({ default: m.ForemanMobileShell })))
const TodayWorklist = lazy(() => import('@/components/foreman').then(m => ({ default: m.TodayWorklist })))

// Lazy load Legal Pages
const PrivacyPolicyPage = lazy(() => import('@/pages/legal/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })))
const TermsOfServicePage = lazy(() => import('@/pages/legal/TermsOfServicePage').then(m => ({ default: m.TermsOfServicePage })))

// Lazy load Support Pages
const SupportPage = lazy(() => import('@/pages/support/SupportPage').then(m => ({ default: m.SupportPage })))

// Lazy load Admin Pages
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })))

// Lazy load Subcontractor Portal Pages
const AcceptInvitePage = lazy(() => import('@/pages/subcontractor-portal/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })))
const SubcontractorDashboard = lazy(() => import('@/pages/subcontractor-portal/SubcontractorDashboard').then(m => ({ default: m.SubcontractorDashboard })))
const DocketEditPage = lazy(() => import('@/pages/subcontractor-portal/DocketEditPage').then(m => ({ default: m.DocketEditPage })))
const DocketsListPage = lazy(() => import('@/pages/subcontractor-portal/DocketsListPage').then(m => ({ default: m.DocketsListPage })))
const AssignedWorkPage = lazy(() => import('@/pages/subcontractor-portal/AssignedWorkPage').then(m => ({ default: m.AssignedWorkPage })))
const SubcontractorITPsPage = lazy(() => import('@/pages/subcontractor-portal/SubcontractorITPsPage').then(m => ({ default: m.SubcontractorITPsPage })))
const SubcontractorLotITPPage = lazy(() => import('@/pages/subcontractor-portal/SubcontractorLotITPPage').then(m => ({ default: m.SubcontractorLotITPPage })))
const SubcontractorHoldPointsPage = lazy(() => import('@/pages/subcontractor-portal/SubcontractorHoldPointsPage').then(m => ({ default: m.SubcontractorHoldPointsPage })))
const SubcontractorTestResultsPage = lazy(() => import('@/pages/subcontractor-portal/SubcontractorTestResultsPage').then(m => ({ default: m.SubcontractorTestResultsPage })))
const SubcontractorNCRsPage = lazy(() => import('@/pages/subcontractor-portal/SubcontractorNCRsPage').then(m => ({ default: m.SubcontractorNCRsPage })))
const SubcontractorDocumentsPage = lazy(() => import('@/pages/subcontractor-portal/SubcontractorDocumentsPage').then(m => ({ default: m.SubcontractorDocumentsPage })))

// Admin-only roles
const ADMIN_ROLES = ['owner', 'admin', 'project_manager']

// Commercial data roles (can view claims, costs, budgets)
const COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager']

// Management roles (can manage subcontractors)
const MANAGEMENT_ROLES = ['owner', 'admin', 'project_manager', 'site_manager']

// Subcontractor roles
const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin']

function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, closeHelp } = useKeyboardShortcutsHelp()
  return (
    <>
      {children}
      <KeyboardShortcutsHelp isOpen={isOpen} onClose={closeHelp} />
      <OnboardingTour />
      <ChangelogNotification />
      <SessionTimeoutWarning />
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <KeyboardShortcutsProvider>
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
          {import.meta.env.DEV && <Route path="/auth/oauth-mock" element={<OAuthMockPage />} />}
        </Route>

        {/* Landing Page (public) */}
        <Route path="/landing" element={<LandingPage />} />

        {/* Legal Pages (public, no layout) */}
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />

        {/* Subcontractor Portal - Accept Invite (public/hybrid auth) */}
        <Route path="/subcontractor-portal/accept-invite" element={<AcceptInvitePage />} />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />

          {/* Foreman Mobile Views - nested under ForemanMobileShell for 5-tab nav */}
          <Route path="/projects/:projectId/foreman" element={<ForemanMobileShell />}>
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
          <Route path="/projects/:projectId/lots" element={<LotsPage />} />
          <Route path="/projects/:projectId/lots/:lotId" element={<LotDetailPage />} />
          <Route path="/projects/:projectId/lots/:lotId/edit" element={<LotEditPage />} />

          {/* ITP */}
          <Route path="/projects/:projectId/itp" element={<ITPPage />} />

          {/* Hold Points */}
          <Route path="/projects/:projectId/hold-points" element={<HoldPointsPage />} />

          {/* Test Results */}
          <Route path="/projects/:projectId/tests" element={<TestResultsPage />} />

          {/* NCR */}
          <Route path="/projects/:projectId/ncr" element={<NCRPage />} />

          {/* Daily Diary */}
          <Route path="/projects/:projectId/diary" element={<DailyDiaryPage />} />
          <Route path="/projects/:projectId/delays" element={<DelayRegisterPage />} />

          {/* Docket Approvals */}
          <Route path="/projects/:projectId/dockets" element={<DocketApprovalsPage />} />

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
          <Route path="/projects/:projectId/documents" element={<DocumentsPage />} />

          {/* Drawings */}
          <Route path="/projects/:projectId/drawings" element={<DrawingsPage />} />

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
          <Route path="/projects/:projectId/reports" element={<ReportsPage />} />

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

          {/* Support */}
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
      <OfflineIndicator />
      <CookieConsentBanner />
      {import.meta.env.DEV && <RoleSwitcher />}
      </KeyboardShortcutsProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
