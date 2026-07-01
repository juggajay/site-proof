import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';

const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  loading: false,
}));

const protectedShellRenderCount = vi.hoisted(() => ({
  value: 0,
}));

vi.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: authState.user, loading: authState.loading }),
}));

vi.mock('@/lib/offline/storagePersistence', () => ({
  requestPersistentStorage: vi.fn(),
}));

vi.mock('@/components/layouts/ProtectedAppShell', () => ({
  ProtectedAppShell: () => {
    protectedShellRenderCount.value += 1;
    return (
      <div data-testid="protected-app-shell">
        <Outlet />
      </div>
    );
  },
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

vi.mock('@/shell/ShellRoutes', () => ({
  ShellRoutes: () => <div>Foreman shell home</div>,
}));
vi.mock('@/shell/subbie/SubbieShellRoutes', () => ({
  SubbieShellRoutes: () => <div>Subbie shell home</div>,
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
  ClaimsPage: () => <div>Claims</div>,
  CostsPage: () => <div>Costs</div>,
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

import { removeLocalStorageItem } from '@/lib/storagePreferences';
import App from './App';

const FLAG_KEY = 'siteproof.shell.v2';
let mobileViewport = true;

function setMobileViewport(isMobile: boolean) {
  mobileViewport = isMobile;
}

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  protectedShellRenderCount.value = 0;
  authState.loading = false;
  authState.user = null;
  removeLocalStorageItem(FLAG_KEY);
  setMobileViewport(true);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: mobileViewport,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('role shell entry redirects', () => {
  it('sends mobile foremen from /dashboard to /m before ProtectedAppShell renders', async () => {
    authState.user = {
      id: 'foreman-1',
      email: 'foreman@example.com',
      role: 'foreman',
      roleInCompany: 'foreman',
      companyId: 'company-1',
    };

    renderAppAt('/dashboard');

    expect(await screen.findByText('Foreman shell home')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('protected-app-shell')).not.toBeInTheDocument();
    expect(protectedShellRenderCount.value).toBe(0);
  });

  it('sends mobile subcontractors from /subcontractor-portal to /p before ProtectedAppShell renders', async () => {
    authState.user = {
      id: 'subbie-1',
      email: 'subbie@example.com',
      role: 'subcontractor',
      roleInCompany: 'subcontractor',
      companyId: null,
      hasSubcontractorPortalAccess: true,
    };

    renderAppAt('/subcontractor-portal');

    expect(await screen.findByText('Subbie shell home')).toBeInTheDocument();
    expect(screen.queryByText('Subcontractor dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('protected-app-shell')).not.toBeInTheDocument();
    expect(protectedShellRenderCount.value).toBe(0);
  });

  it('keeps the classic dashboard when the shell is disabled in the URL', async () => {
    authState.user = {
      id: 'foreman-1',
      email: 'foreman@example.com',
      role: 'foreman',
      roleInCompany: 'foreman',
      companyId: 'company-1',
    };

    renderAppAt('/dashboard?shell=off');

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('protected-app-shell')).toBeInTheDocument();
    expect(screen.queryByText('Foreman shell home')).not.toBeInTheDocument();
  });

  it('keeps desktop foremen on the classic dashboard', async () => {
    setMobileViewport(false);
    authState.user = {
      id: 'foreman-1',
      email: 'foreman@example.com',
      role: 'foreman',
      roleInCompany: 'foreman',
      companyId: 'company-1',
    };

    renderAppAt('/dashboard');

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('protected-app-shell')).toBeInTheDocument();
    expect(screen.queryByText('Foreman shell home')).not.toBeInTheDocument();
  });
});
