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

// Layouts
import { MainLayout } from '@/components/layouts/MainLayout'
import { AuthLayout } from '@/components/layouts/AuthLayout'

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage'
import { MagicLinkPage } from '@/pages/auth/MagicLinkPage'  // Feature #415
import { OAuthCallbackPage } from '@/pages/auth/OAuthCallbackPage'  // Feature #414
import { OAuthMockPage } from '@/pages/auth/OAuthMockPage'  // Feature #414 (dev only)

// Main Pages
import { DashboardPage } from '@/pages/DashboardPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage'

// Foreman Mobile Components
import { ForemanMobileShell, TodayWorklist } from '@/components/foreman'
import { ProjectSettingsPage } from '@/pages/projects/settings/ProjectSettingsPage'
import { ProjectUsersPage } from '@/pages/projects/settings/ProjectUsersPage'
import { ProjectAreasPage } from '@/pages/projects/settings/ProjectAreasPage'
import { LotsPage } from '@/pages/lots/LotsPage'
import { LotDetailPage } from '@/pages/lots/LotDetailPage'
import { LotEditPage } from '@/pages/lots/LotEditPage'
import { ITPPage } from '@/pages/itp/ITPPage'
import { HoldPointsPage } from '@/pages/holdpoints/HoldPointsPage'
import { TestResultsPage } from '@/pages/tests/TestResultsPage'
import { NCRPage } from '@/pages/ncr/NCRPage'
import { DailyDiaryPage } from '@/pages/diary/DailyDiaryPage'
import { DelayRegisterPage } from '@/pages/diary/DelayRegisterPage'
import { DocketApprovalsPage } from '@/pages/dockets/DocketApprovalsPage'
import { ClaimsPage } from '@/pages/claims/ClaimsPage'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { DrawingsPage } from '@/pages/drawings/DrawingsPage'
import { SubcontractorsPage } from '@/pages/subcontractors/SubcontractorsPage'
import { MyCompanyPage } from '@/pages/subcontractors/MyCompanyPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CostsPage } from '@/pages/costs/CostsPage'
import { CompanySettingsPage } from '@/pages/company/CompanySettingsPage'
import { PortfolioPage } from '@/pages/portfolio/PortfolioPage'

// Legal Pages
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage'

// Support Pages
import { SupportPage } from '@/pages/support/SupportPage'

// Admin Pages
import { AuditLogPage } from '@/pages/admin/AuditLogPage'

// Subcontractor Portal Pages
import { AcceptInvitePage } from '@/pages/subcontractor-portal/AcceptInvitePage'
import { SubcontractorDashboard } from '@/pages/subcontractor-portal/SubcontractorDashboard'
import { DocketEditPage } from '@/pages/subcontractor-portal/DocketEditPage'
import { DocketsListPage } from '@/pages/subcontractor-portal/DocketsListPage'
import { AssignedWorkPage } from '@/pages/subcontractor-portal/AssignedWorkPage'
import { SubcontractorITPsPage } from '@/pages/subcontractor-portal/SubcontractorITPsPage'
import { SubcontractorLotITPPage } from '@/pages/subcontractor-portal/SubcontractorLotITPPage'
import { SubcontractorHoldPointsPage } from '@/pages/subcontractor-portal/SubcontractorHoldPointsPage'
import { SubcontractorTestResultsPage } from '@/pages/subcontractor-portal/SubcontractorTestResultsPage'
import { SubcontractorNCRsPage } from '@/pages/subcontractor-portal/SubcontractorNCRsPage'
import { SubcontractorDocumentsPage } from '@/pages/subcontractor-portal/SubcontractorDocumentsPage'

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
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/magic-link" element={<MagicLinkPage />} />  {/* Feature #415 */}
          <Route path="/auth/oauth-callback" element={<OAuthCallbackPage />} />  {/* Feature #414 */}
          <Route path="/auth/oauth-mock" element={<OAuthMockPage />} />  {/* Feature #414 dev mode */}
        </Route>

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
      <Toaster />
      <OfflineIndicator />
      <CookieConsentBanner />
      <RoleSwitcher />
      </KeyboardShortcutsProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
