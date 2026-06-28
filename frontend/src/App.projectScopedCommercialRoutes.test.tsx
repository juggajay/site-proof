import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

const authState = vi.hoisted(() => ({
  user: {
    id: 'project-pm-1',
    email: 'project-pm@example.com',
    role: 'member',
    roleInCompany: 'member',
    dashboardRole: 'project_manager',
    companyId: 'company-1',
  } as Record<string, unknown> | null,
  loading: false,
}));

vi.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: authState.user, loading: authState.loading }),
}));

vi.mock('@/lib/offline/storagePersistence', () => ({
  requestPersistentStorage: vi.fn(),
}));

vi.mock('@/components/layouts/ProtectedAppShell', () => ({
  ProtectedAppShell: () => <Outlet />,
}));

vi.mock('@/components/layouts/AuthLayout', () => ({
  AuthLayout: () => <Outlet />,
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
vi.mock('@/components/DeferredOfflineIndicator', () => ({ DeferredOfflineIndicator: () => null }));
vi.mock('@/components/UpdatePrompt', () => ({ UpdatePrompt: () => null }));
vi.mock('@/components/InstallNudge', () => ({ InstallNudge: () => null }));
vi.mock('@/components/CookieConsentBanner', () => ({ CookieConsentBanner: () => null }));
vi.mock('@/components/dev/RoleSwitcher', () => ({ RoleSwitcher: () => null }));
vi.mock('@/shell/shellFlag', () => ({ applyShellFlagFromUrl: vi.fn() }));
vi.mock('@/shell/ShellGuard', () => ({
  ShellGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/shell/ShellRoutes', () => ({ ShellRoutes: () => <div>Shell routes</div> }));
vi.mock('@/shell/SubbieShellGuard', () => ({
  SubbieShellGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/shell/subbie/SubbieShellRoutes', () => ({
  SubbieShellRoutes: () => <div>Subbie shell routes</div>,
}));

vi.mock('./appProjectRoutes', () => ({
  ProjectDetailRoute: () => <div>Project detail</div>,
}));

vi.mock('./appLazyPages', () => ({
  LoginPage: () => <div>Login</div>,
  RegisterPage: () => <div>Register</div>,
  ForgotPasswordPage: () => <div>Forgot password</div>,
  ResetPasswordPage: () => <div>Reset password</div>,
  VerifyEmailPage: () => <div>Verify email</div>,
  MagicLinkPage: () => <div>Magic link</div>,
  OAuthCallbackPage: () => <div>OAuth callback</div>,
  LandingPage: () => <div>Landing</div>,
  DashboardPage: () => <div>Dashboard</div>,
  ProjectsPage: () => <div>Projects</div>,
  ProjectSettingsPage: () => <div>Project settings</div>,
  ProjectUsersPage: () => <div>Project users</div>,
  ProjectAreasPage: () => <div>Project areas</div>,
  LotsPage: () => <div>Lots</div>,
  LotDetailPage: () => <div>Lot detail</div>,
  LotEditPage: () => <div>Lot edit</div>,
  ITPPage: () => <div>ITP</div>,
  HoldPointsPage: () => <div>Hold points</div>,
  PublicHoldPointReleasePage: () => <div>Public hold point release</div>,
  TestResultsPage: () => <div>Test results</div>,
  NCRPage: () => <div>NCR</div>,
  DailyDiaryPage: () => <div>Daily diary</div>,
  DelayRegisterPage: () => <div>Delays</div>,
  DocketApprovalsPage: () => <div>Docket approvals</div>,
  ClaimsPage: () => <div>Claims route reached</div>,
  CostsPage: () => <div>Costs route reached</div>,
  DocumentsPage: () => <div>Documents</div>,
  DrawingsPage: () => <div>Drawings</div>,
  SubcontractorsPage: () => <div>Subcontractors</div>,
  MyCompanyPage: () => <div>My company</div>,
  ReportsPage: () => <div>Reports</div>,
  SettingsPage: () => <div>Settings</div>,
  ProfilePage: () => <div>Profile</div>,
  NotificationsPage: () => <div>Notifications</div>,
  NotFoundPage: () => <div>Not found</div>,
  CompanySettingsPage: () => <div>Company settings</div>,
  CompanyOnboardingPage: () => <div>Company onboarding</div>,
  PortfolioPage: () => <div>Portfolio</div>,
  ForemanMobileShell: () => <Outlet />,
  TodayWorklist: () => <div>Today worklist</div>,
  PrivacyPolicyPage: () => <div>Privacy</div>,
  TermsOfServicePage: () => <div>Terms</div>,
  SupportPage: () => <div>Support</div>,
  DocumentationPage: () => <div>Docs</div>,
  AuditLogPage: () => <div>Audit log</div>,
  AcceptInvitePage: () => <div>Accept invite</div>,
  SubcontractorDashboard: () => <div>Subcontractor dashboard</div>,
  DocketEditPage: () => <div>Docket edit</div>,
  DocketsListPage: () => <div>Dockets list</div>,
  AssignedWorkPage: () => <div>Assigned work</div>,
  SubcontractorITPsPage: () => <div>Subcontractor ITPs</div>,
  SubcontractorLotITPPage: () => <div>Subcontractor lot ITP</div>,
  SubcontractorHoldPointsPage: () => <div>Subcontractor hold points</div>,
  SubcontractorTestResultsPage: () => <div>Subcontractor test results</div>,
  SubcontractorNCRsPage: () => <div>Subcontractor NCRs</div>,
  SubcontractorDocumentsPage: () => <div>Subcontractor documents</div>,
}));

import App from './App';

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.loading = false;
  authState.user = {
    id: 'project-pm-1',
    email: 'project-pm@example.com',
    role: 'member',
    roleInCompany: 'member',
    dashboardRole: 'project_manager',
    companyId: 'company-1',
  };
});

describe('project-scoped commercial routes', () => {
  it.each([
    ['/projects/project-1/claims', 'Claims route reached'],
    ['/projects/project-1/costs', 'Costs route reached'],
    ['/projects/project-1/lots/lot-1/edit', 'Lot edit'],
    ['/projects/project-1/subcontractors', 'Subcontractors'],
  ])('allows project-scoped project managers to open %s', async (path, expectedText) => {
    renderAppAt(path);

    expect(await screen.findByText(expectedText)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Access Denied' })).not.toBeInTheDocument();
  });

  it.each(['quality_manager', 'site_manager'])(
    'blocks project-scoped %s users from opening progress claims',
    async (dashboardRole) => {
      authState.user = {
        id: `project-${dashboardRole}-1`,
        email: `${dashboardRole}@example.com`,
        role: 'member',
        roleInCompany: 'member',
        dashboardRole,
        companyId: 'company-1',
      };

      renderAppAt('/projects/project-1/claims');

      expect(await screen.findByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
      expect(screen.queryByText('Claims route reached')).not.toBeInTheDocument();
    },
  );

  it('allows project-scoped quality managers to open the audit log', async () => {
    authState.user = {
      id: 'project-qm-1',
      email: 'project-qm@example.com',
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: 'quality_manager',
      companyId: 'company-1',
    };

    renderAppAt('/audit-log');

    expect(await screen.findByText('Audit log')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Access Denied' })).not.toBeInTheDocument();
  });
});
