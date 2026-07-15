import { lazy } from 'react';

export const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
export const RegisterPage = lazy(() =>
  import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
export const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
export const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
export const VerifyEmailPage = lazy(() =>
  import('@/pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
);
export const MagicLinkPage = lazy(() =>
  import('@/pages/auth/MagicLinkPage').then((m) => ({ default: m.MagicLinkPage })),
);
export const OAuthCallbackPage = lazy(() =>
  import('@/pages/auth/OAuthCallbackPage').then((m) => ({ default: m.OAuthCallbackPage })),
);

export const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
export const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
export const ProjectsPage = lazy(() =>
  import('@/pages/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
export const ProjectDetailPage = lazy(() =>
  import('@/pages/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })),
);
export const ProjectSettingsPage = lazy(() =>
  import('@/pages/projects/settings/ProjectSettingsPage').then((m) => ({
    default: m.ProjectSettingsPage,
  })),
);
export const ProjectUsersPage = lazy(() =>
  import('@/pages/projects/settings/ProjectUsersPage').then((m) => ({
    default: m.ProjectUsersPage,
  })),
);
export const ProjectAreasPage = lazy(() =>
  import('@/pages/projects/settings/ProjectAreasPage').then((m) => ({
    default: m.ProjectAreasPage,
  })),
);
export const ControlLinesPage = lazy(() =>
  import('@/pages/projects/settings/ControlLinesPage').then((m) => ({
    default: m.ControlLinesPage,
  })),
);
export const PlanSheetsPage = lazy(() =>
  import('@/pages/projects/settings/PlanSheetsPage').then((m) => ({
    default: m.PlanSheetsPage,
  })),
);
export const CopilotPage = lazy(() =>
  import('@/pages/projects/copilot/CopilotPage').then((m) => ({ default: m.CopilotPage })),
);
export const LotsPage = lazy(() =>
  import('@/pages/lots/LotsPage').then((m) => ({ default: m.LotsPage })),
);
export const LotDetailPage = lazy(() =>
  import('@/pages/lots/LotDetailPage').then((m) => ({ default: m.LotDetailPage })),
);
export const LotEditPage = lazy(() =>
  import('@/pages/lots/LotEditPage').then((m) => ({ default: m.LotEditPage })),
);
export const ITPPage = lazy(() =>
  import('@/pages/itp/ITPPage').then((m) => ({ default: m.ITPPage })),
);
export const HoldPointsPage = lazy(() =>
  import('@/pages/holdpoints/HoldPointsPage').then((m) => ({ default: m.HoldPointsPage })),
);
export const PublicHoldPointReleasePage = lazy(() =>
  import('@/pages/holdpoints/PublicHoldPointReleasePage').then((m) => ({
    default: m.PublicHoldPointReleasePage,
  })),
);
export const PublicHoldPointBatchReleasePage = lazy(() =>
  import('@/pages/holdpoints/PublicHoldPointBatchReleasePage').then((m) => ({
    default: m.PublicHoldPointBatchReleasePage,
  })),
);
export const TestResultsPage = lazy(() =>
  import('@/pages/tests/TestResultsPage').then((m) => ({ default: m.TestResultsPage })),
);
export const NCRPage = lazy(() =>
  import('@/pages/ncr/NCRPage').then((m) => ({ default: m.NCRPage })),
);
export const DailyDiaryPage = lazy(() =>
  import('@/pages/diary/DailyDiaryPage').then((m) => ({ default: m.DailyDiaryPage })),
);
export const DelayRegisterPage = lazy(() =>
  import('@/pages/diary/DelayRegisterPage').then((m) => ({ default: m.DelayRegisterPage })),
);
export const DocketApprovalsPage = lazy(() =>
  import('@/pages/dockets/DocketApprovalsPage').then((m) => ({ default: m.DocketApprovalsPage })),
);
export const ClaimsPage = lazy(() =>
  import('@/pages/claims/ClaimsPage').then((m) => ({ default: m.ClaimsPage })),
);
export const VariationsPage = lazy(() =>
  import('@/pages/variations/VariationsPage').then((m) => ({ default: m.VariationsPage })),
);
export const DocumentsPage = lazy(() =>
  import('@/pages/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
export const DrawingsPage = lazy(() =>
  import('@/pages/drawings/DrawingsPage').then((m) => ({ default: m.DrawingsPage })),
);
export const SubcontractorsPage = lazy(() =>
  import('@/pages/subcontractors/SubcontractorsPage').then((m) => ({
    default: m.SubcontractorsPage,
  })),
);
export const MyCompanyPage = lazy(() =>
  import('@/pages/subcontractors/MyCompanyPage').then((m) => ({ default: m.MyCompanyPage })),
);
export const ReportsPage = lazy(() =>
  import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
export const ScheduledReportArtifactPage = lazy(() =>
  import('@/pages/reports/ScheduledReportArtifactPage').then((m) => ({
    default: m.ScheduledReportArtifactPage,
  })),
);
export const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
export const ProfilePage = lazy(() =>
  import('@/pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
export const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
export const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
export const CostsPage = lazy(() =>
  import('@/pages/costs/CostsPage').then((m) => ({ default: m.CostsPage })),
);
export const CompanySettingsPage = lazy(() =>
  import('@/pages/company/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage })),
);
export const CompanyOnboardingPage = lazy(() =>
  import('@/pages/onboarding/CompanyOnboardingPage').then((m) => ({
    default: m.CompanyOnboardingPage,
  })),
);
export const PortfolioPage = lazy(() =>
  import('@/pages/portfolio/PortfolioPage').then((m) => ({ default: m.PortfolioPage })),
);

export const ForemanMobileShell = lazy(() =>
  import('@/components/foreman/ForemanMobileShell').then((m) => ({
    default: m.ForemanMobileShell,
  })),
);
export const TodayWorklist = lazy(() =>
  import('@/components/foreman/TodayWorklist').then((m) => ({ default: m.TodayWorklist })),
);

export const PrivacyPolicyPage = lazy(() =>
  import('@/pages/legal/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })),
);
export const TermsOfServicePage = lazy(() =>
  import('@/pages/legal/TermsOfServicePage').then((m) => ({ default: m.TermsOfServicePage })),
);
export const SupportPage = lazy(() =>
  import('@/pages/support/SupportPage').then((m) => ({ default: m.SupportPage })),
);
export const DocumentationPage = lazy(() =>
  import('@/pages/docs/DocumentationPage').then((m) => ({ default: m.DocumentationPage })),
);
export const AuditLogPage = lazy(() =>
  import('@/pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);

export const AcceptInvitePage = lazy(() =>
  import('@/pages/subcontractor-portal/AcceptInvitePage').then((m) => ({
    default: m.AcceptInvitePage,
  })),
);
export const SubcontractorDashboard = lazy(() =>
  import('@/pages/subcontractor-portal/SubcontractorDashboard').then((m) => ({
    default: m.SubcontractorDashboard,
  })),
);
export const DocketEditPage = lazy(() =>
  import('@/pages/subcontractor-portal/DocketEditPage').then((m) => ({
    default: m.DocketEditPage,
  })),
);
export const DocketsListPage = lazy(() =>
  import('@/pages/subcontractor-portal/DocketsListPage').then((m) => ({
    default: m.DocketsListPage,
  })),
);
export const AssignedWorkPage = lazy(() =>
  import('@/pages/subcontractor-portal/AssignedWorkPage').then((m) => ({
    default: m.AssignedWorkPage,
  })),
);
export const SubcontractorITPsPage = lazy(() =>
  import('@/pages/subcontractor-portal/SubcontractorITPsPage').then((m) => ({
    default: m.SubcontractorITPsPage,
  })),
);
export const SubcontractorLotITPPage = lazy(() =>
  import('@/pages/subcontractor-portal/SubcontractorLotITPPage').then((m) => ({
    default: m.SubcontractorLotITPPage,
  })),
);
export const SubcontractorHoldPointsPage = lazy(() =>
  import('@/pages/subcontractor-portal/SubcontractorHoldPointsPage').then((m) => ({
    default: m.SubcontractorHoldPointsPage,
  })),
);
export const SubcontractorTestResultsPage = lazy(() =>
  import('@/pages/subcontractor-portal/SubcontractorTestResultsPage').then((m) => ({
    default: m.SubcontractorTestResultsPage,
  })),
);
export const SubcontractorNCRsPage = lazy(() =>
  import('@/pages/subcontractor-portal/SubcontractorNCRsPage').then((m) => ({
    default: m.SubcontractorNCRsPage,
  })),
);
export const SubcontractorDocumentsPage = lazy(() =>
  import('@/pages/subcontractor-portal/SubcontractorDocumentsPage').then((m) => ({
    default: m.SubcontractorDocumentsPage,
  })),
);
