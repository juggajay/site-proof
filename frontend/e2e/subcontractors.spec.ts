import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type PortalAccess = {
  lots: boolean;
  itps: boolean;
  holdPoints: boolean;
  testResults: boolean;
  ncrs: boolean;
  documents: boolean;
};

type Employee = {
  id: string;
  name: string;
  phone?: string;
  role: string;
  hourlyRate: number;
  status: 'pending' | 'approved' | 'inactive';
};

type Plant = {
  id: string;
  type: string;
  description: string;
  idRego: string;
  dryRate: number;
  wetRate: number;
  status: 'pending' | 'approved' | 'inactive';
};

type Subcontractor = {
  id: string;
  companyName: string;
  abn: string;
  primaryContact: string;
  email: string;
  phone: string;
  status: 'pending_approval' | 'approved' | 'suspended' | 'removed';
  employees: Employee[];
  plant: Plant[];
  totalApprovedDockets: number;
  totalCost: number;
  portalAccess: PortalAccess;
};

type SeededSubcontractorsApiOptions = {
  failSubcontractorLoadsUntil?: number;
  inviteDelayMs?: number;
  statusDelayMs?: number;
  portalAccessDelayMs?: number;
};

type PortalNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  linkUrl?: string;
};

const invitedSubcontractorUser = {
  id: 'e2e-sub-user',
  email: 'site@subbie.example',
  fullName: 'Sally Subbie',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: 'e2e-sub-company',
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const approvedSubcontractor: Subcontractor = {
  id: 'e2e-sub-approved',
  companyName: 'E2E Civil Pty Ltd',
  abn: '53 004 085 616',
  primaryContact: 'Alice Civil',
  email: 'alice@e2ecivil.example',
  phone: '0400 111 222',
  status: 'approved',
  employees: [
    {
      id: 'e2e-employee-approved',
      name: 'Sam Operator',
      role: 'Operator',
      hourlyRate: 95,
      status: 'approved',
    },
    {
      id: 'e2e-employee-pending',
      name: 'Pat Labourer',
      role: 'Labourer',
      hourlyRate: 75,
      status: 'pending',
    },
  ],
  plant: [
    {
      id: 'e2e-plant-approved',
      type: 'Excavator',
      description: '20T excavator',
      idRego: 'EX-201',
      dryRate: 180,
      wetRate: 240,
      status: 'approved',
    },
  ],
  totalApprovedDockets: 4,
  totalCost: 12850,
  portalAccess: {
    lots: true,
    itps: true,
    holdPoints: false,
    testResults: false,
    ncrs: false,
    documents: false,
  },
};

const pendingSubcontractor: Subcontractor = {
  id: 'e2e-sub-pending',
  companyName: 'E2E Pending Works',
  abn: '11 222 333 444',
  primaryContact: 'Penny Pending',
  email: 'penny@pending.example',
  phone: '0400 333 444',
  status: 'pending_approval',
  employees: [],
  plant: [],
  totalApprovedDockets: 0,
  totalCost: 0,
  portalAccess: {
    lots: true,
    itps: false,
    holdPoints: false,
    testResults: false,
    ncrs: false,
    documents: false,
  },
};

const removedSubcontractor: Subcontractor = {
  id: 'e2e-sub-removed',
  companyName: 'E2E Removed Earthworks',
  abn: '22 333 444 555',
  primaryContact: 'Riley Removed',
  email: 'riley@removed.example',
  phone: '0400 555 666',
  status: 'removed',
  employees: [],
  plant: [],
  totalApprovedDockets: 1,
  totalCost: 1200,
  portalAccess: {
    lots: false,
    itps: false,
    holdPoints: false,
    testResults: false,
    ncrs: false,
    documents: false,
  },
};

async function mockSeededSubcontractorsApi(
  page: Page,
  options: SeededSubcontractorsApiOptions = {},
) {
  const subcontractors: Subcontractor[] = [
    structuredClone(approvedSubcontractor),
    structuredClone(pendingSubcontractor),
    structuredClone(removedSubcontractor),
  ];
  const inviteRequests: unknown[] = [];
  const employeeRequests: Array<{ subcontractorId: string; body: unknown }> = [];
  const plantRequests: Array<{ subcontractorId: string; body: unknown }> = [];
  const statusRequests: Array<{ subcontractorId: string; status: string }> = [];
  let portalAccessRequest: { subcontractorId: string; portalAccess: PortalAccess } | null = null;
  let deleteRequestId: string | null = null;
  let subcontractorLoadCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: E2E_ADMIN_USER });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
        },
      });
      return;
    }

    if (url.pathname === `/api/subcontractors/project/${E2E_PROJECT_ID}`) {
      subcontractorLoadCount += 1;
      if (subcontractorLoadCount <= (options.failSubcontractorLoadsUntil ?? 0)) {
        await json({ message: 'Unable to load subcontractors' }, 500);
        return;
      }
      const includeRemoved = url.searchParams.get('includeRemoved') === 'true';
      await json({
        subcontractors: subcontractors.filter(
          (subcontractor) => includeRemoved || subcontractor.status !== 'removed',
        ),
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/directory') {
      await json({
        subcontractors: [
          {
            id: 'e2e-directory-subcontractor',
            companyName: 'Directory Concrete Pty Ltd',
            abn: '53 004 085 616',
            primaryContactName: 'Dana Directory',
            primaryContactEmail: 'dana@directory.example',
            primaryContactPhone: '0400 777 888',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/invite' && route.request().method() === 'POST') {
      inviteRequests.push(route.request().postDataJSON());
      if (options.inviteDelayMs) {
        await delay(options.inviteDelayMs);
      }
      const invited: Subcontractor = {
        id: 'e2e-sub-invited',
        companyName: 'Directory Concrete Pty Ltd',
        abn: '53 004 085 616',
        primaryContact: 'Dana Directory',
        email: 'dana@directory.example',
        phone: '0400 777 888',
        status: 'pending_approval',
        employees: [],
        plant: [],
        totalApprovedDockets: 0,
        totalCost: 0,
        portalAccess: {
          lots: true,
          itps: false,
          holdPoints: false,
          testResults: false,
          ncrs: false,
          documents: false,
        },
      };
      subcontractors.push(invited);
      await json({ subcontractor: invited }, 201);
      return;
    }

    if (
      url.pathname.match(/^\/api\/subcontractors\/[^/]+\/status$/) &&
      route.request().method() === 'PATCH'
    ) {
      const subcontractorId = url.pathname.split('/').at(-2)!;
      const body = route.request().postDataJSON() as { status: Subcontractor['status'] };
      statusRequests.push({ subcontractorId, status: body.status });
      if (options.statusDelayMs) {
        await delay(options.statusDelayMs);
      }
      const subcontractor = subcontractors.find((sub) => sub.id === subcontractorId);
      if (subcontractor) {
        subcontractor.status = body.status;
      }
      await json({ subcontractor });
      return;
    }

    if (
      url.pathname.match(/^\/api\/subcontractors\/[^/]+\/portal-access$/) &&
      route.request().method() === 'PATCH'
    ) {
      const subcontractorId = url.pathname.split('/').at(-2)!;
      const body = route.request().postDataJSON() as { portalAccess: PortalAccess };
      portalAccessRequest = { subcontractorId, portalAccess: body.portalAccess };
      if (options.portalAccessDelayMs) {
        await delay(options.portalAccessDelayMs);
      }
      const subcontractor = subcontractors.find((sub) => sub.id === subcontractorId);
      if (subcontractor) {
        subcontractor.portalAccess = body.portalAccess;
      }
      await json({ portalAccess: body.portalAccess });
      return;
    }

    if (
      url.pathname.match(/^\/api\/subcontractors\/[^/]+\/employees$/) &&
      route.request().method() === 'POST'
    ) {
      const subcontractorId = url.pathname.split('/').at(-2)!;
      const body = route.request().postDataJSON() as Employee;
      employeeRequests.push({ subcontractorId, body });

      const employee: Employee = {
        id: `e2e-added-employee-${employeeRequests.length}`,
        name: body.name,
        role: body.role,
        hourlyRate: body.hourlyRate,
        status: 'pending',
      };
      const subcontractor = subcontractors.find((sub) => sub.id === subcontractorId);
      subcontractor?.employees.push(employee);
      await json({ employee }, 201);
      return;
    }

    if (
      url.pathname.match(/^\/api\/subcontractors\/[^/]+\/plant$/) &&
      route.request().method() === 'POST'
    ) {
      const subcontractorId = url.pathname.split('/').at(-2)!;
      const body = route.request().postDataJSON() as Plant;
      plantRequests.push({ subcontractorId, body });

      const plant: Plant = {
        id: `e2e-added-plant-${plantRequests.length}`,
        type: body.type,
        description: body.description,
        idRego: body.idRego,
        dryRate: body.dryRate,
        wetRate: body.wetRate,
        status: 'pending',
      };
      const subcontractor = subcontractors.find((sub) => sub.id === subcontractorId);
      subcontractor?.plant.push(plant);
      await json({ plant }, 201);
      return;
    }

    if (
      url.pathname.match(/^\/api\/subcontractors\/[^/]+$/) &&
      route.request().method() === 'DELETE'
    ) {
      deleteRequestId = url.pathname.split('/').at(-1) || null;
      const index = subcontractors.findIndex((sub) => sub.id === deleteRequestId);
      if (index >= 0) {
        subcontractors.splice(index, 1);
      }
      await json({ success: true });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getInviteRequest: () => inviteRequests.at(-1),
    getInviteRequests: () => inviteRequests,
    getEmployeeRequest: () => employeeRequests.at(-1),
    getEmployeeRequests: () => employeeRequests,
    getPlantRequest: () => plantRequests.at(-1),
    getPlantRequests: () => plantRequests,
    getStatusRequest: () => statusRequests.at(-1) ?? null,
    getStatusRequests: () => statusRequests,
    getPortalAccessRequest: () => portalAccessRequest,
    getDeleteRequestId: () => deleteRequestId,
    getSubcontractorLoadCount: () => subcontractorLoadCount,
  };
}

async function mockInviteAcceptanceApi(page: Page) {
  let registerRequest: unknown = null;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/subcontractors/invitation/e2e-invite-token') {
      await json({
        invitation: {
          id: 'e2e-invite-token',
          companyName: 'E2E Subbie Pty Ltd',
          projectName: 'E2E Highway Upgrade',
          headContractorName: 'Head Contractor Pty Ltd',
          primaryContactEmail: invitedSubcontractorUser.email,
          primaryContactName: invitedSubcontractorUser.fullName,
          status: 'pending_approval',
        },
      });
      return;
    }

    if (
      url.pathname === '/api/auth/register-and-accept-invitation' &&
      route.request().method() === 'POST'
    ) {
      registerRequest = route.request().postDataJSON();
      await json({
        user: invitedSubcontractorUser,
        token: 'e2e-sub-token',
        company: {
          id: 'e2e-sub-company',
          companyName: 'E2E Subbie Pty Ltd',
          projectId: E2E_PROJECT_ID,
          projectName: 'E2E Highway Upgrade',
        },
      });
      return;
    }

    if (url.pathname === '/api/auth/me') {
      await json({ user: invitedSubcontractorUser });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      await json({
        company: {
          id: 'e2e-sub-company',
          companyName: 'E2E Subbie Pty Ltd',
          projectId: E2E_PROJECT_ID,
          projectName: 'E2E Highway Upgrade',
          employees: [],
          plant: [],
          portalAccess: {
            lots: true,
            itps: true,
            holdPoints: false,
            testResults: false,
            ncrs: false,
            documents: false,
          },
        },
      });
      return;
    }

    if (url.pathname === '/api/dockets') {
      await json({ dockets: [] });
      return;
    }

    if (url.pathname === '/api/lots') {
      await json({ lots: [] });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  return {
    getRegisterRequest: () => registerRequest,
  };
}

async function mockSubcontractorDashboardApi(page: Page, notifications: PortalNotification[]) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: invitedSubcontractorUser });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({
        notifications,
        unreadCount: notifications.filter((notification) => !notification.isRead).length,
      });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      await json({
        company: {
          id: 'e2e-sub-company',
          companyName: 'E2E Subbie Pty Ltd',
          projectId: E2E_PROJECT_ID,
          projectName: 'E2E Highway Upgrade',
          employees: [],
          plant: [],
          portalAccess: {
            lots: true,
            itps: true,
            holdPoints: false,
            testResults: false,
            ncrs: false,
            documents: false,
          },
        },
      });
      return;
    }

    if (url.pathname === '/api/dockets') {
      await json({ dockets: [] });
      return;
    }

    if (url.pathname === '/api/lots') {
      await json({ lots: [] });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, invitedSubcontractorUser);
}

async function mockPortalModuleAccessApi(page: Page, portalAccess: PortalAccess) {
  let lotRequests = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: invitedSubcontractorUser });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      await json({
        company: {
          id: 'e2e-sub-company',
          companyName: 'E2E Subbie Pty Ltd',
          projectId: E2E_PROJECT_ID,
          projectName: 'E2E Highway Upgrade',
          employees: [],
          plant: [],
          portalAccess,
        },
      });
      return;
    }

    if (url.pathname === '/api/lots') {
      lotRequests += 1;
      await json({
        lots: [
          {
            id: 'e2e-itp-lot',
            lotNumber: 'LOT-001',
            status: 'in_progress',
            itpInstances: [
              {
                id: 'e2e-itp-instance',
                status: 'not_started',
                template: {
                  id: 'e2e-itp-template',
                  name: 'Concrete ITP',
                  activityType: 'Concrete',
                },
              },
            ],
            subcontractorAssignments: [
              {
                id: 'e2e-itp-assignment',
                canCompleteITP: true,
                itpRequiresVerification: true,
              },
            ],
          },
        ],
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, invitedSubcontractorUser);

  return {
    getLotRequestCount: () => lotRequests,
  };
}

async function mockMyCompanyApi(page: Page) {
  const company = {
    id: 'e2e-sub-company',
    companyName: 'E2E Subbie Pty Ltd',
    abn: '53 004 085 616',
    primaryContactName: invitedSubcontractorUser.fullName,
    primaryContactEmail: invitedSubcontractorUser.email,
    primaryContactPhone: '0400 222 333',
    status: 'approved',
    employees: [] as Employee[],
    plant: [] as Plant[],
  };
  const employeeRequests: unknown[] = [];
  const plantRequests: unknown[] = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: invitedSubcontractorUser });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company' && route.request().method() === 'GET') {
      await json({ company });
      return;
    }

    if (
      url.pathname === '/api/subcontractors/my-company/employees' &&
      route.request().method() === 'POST'
    ) {
      const body = route.request().postDataJSON() as Employee & { phone?: string };
      employeeRequests.push(body);
      const employee: Employee = {
        id: `e2e-my-company-employee-${employeeRequests.length}`,
        name: body.name,
        phone: body.phone || '',
        role: body.role,
        hourlyRate: body.hourlyRate,
        status: 'pending',
      };
      company.employees.push(employee);
      await json({ employee }, 201);
      return;
    }

    if (
      url.pathname === '/api/subcontractors/my-company/plant' &&
      route.request().method() === 'POST'
    ) {
      const body = route.request().postDataJSON() as Plant;
      plantRequests.push(body);
      const plant: Plant = {
        id: `e2e-my-company-plant-${plantRequests.length}`,
        type: body.type,
        description: body.description,
        idRego: body.idRego,
        dryRate: body.dryRate,
        wetRate: body.wetRate,
        status: 'pending',
      };
      company.plant.push(plant);
      await json({ plant }, 201);
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, invitedSubcontractorUser);

  return {
    getEmployeeRequest: () => employeeRequests.at(-1),
    getEmployeeRequests: () => employeeRequests,
    getPlantRequest: () => plantRequests.at(-1),
    getPlantRequests: () => plantRequests,
  };
}

async function mockMyCompanyFailureApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: invitedSubcontractorUser });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      await json({ message: 'Company unavailable' }, 503);
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, invitedSubcontractorUser);
}

test.describe('Subcontractors seeded register contract', () => {
  test('invites subcontractors, manages portal access, and controls removed records', async ({
    page,
  }) => {
    const api = await mockSeededSubcontractorsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/subcontractors`);

    await expect(page.getByRole('heading', { name: 'Subcontractors' })).toBeVisible();
    await expect(
      page.getByText('Manage subcontractor companies, employees, and rates'),
    ).toBeVisible();
    await expect(page.getByText('Pending Approvals')).toBeVisible();
    await expect(page.getByText('1 subcontractor(s)')).toBeVisible();
    await expect(page.getByText('Total Subcontractors')).toBeVisible();
    await expect(page.getByText('Total Cost to Date')).toBeVisible();

    await expect(page.getByText('E2E Civil Pty Ltd')).toBeVisible();
    await expect(page.getByText('E2E Pending Works')).toBeVisible();
    await expect(page.getByText('E2E Removed Earthworks')).toBeHidden();

    await page.getByRole('button', { name: 'Invite Subcontractor' }).click();
    const inviteDialog = page.getByRole('dialog').filter({ hasText: 'Invite Subcontractor' });
    await expect(inviteDialog.getByText('Create New Subcontractor')).toBeVisible();
    await inviteDialog.getByLabel('Select from Directory').fill('Directory');
    await inviteDialog.getByRole('button', { name: /Directory Concrete Pty Ltd/ }).click();
    await expect(inviteDialog.getByLabel('Company Name *')).toHaveValue(
      'Directory Concrete Pty Ltd',
    );
    await expect(inviteDialog.getByLabel('Email *')).toHaveValue('dana@directory.example');
    await inviteDialog.getByRole('button', { name: 'Send Invitation' }).click();

    await expect(
      page.getByText('Directory Concrete Pty Ltd was added to this project.'),
    ).toBeVisible();
    expect(api.getInviteRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      globalSubcontractorId: 'e2e-directory-subcontractor',
    });
    await expect(
      page.getByRole('button', { name: /Toggle Directory Concrete Pty Ltd details/ }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Toggle E2E Civil Pty Ltd details' }).click();
    await expect(page.getByText('Employee Roster (2)')).toBeVisible();
    await expect(page.getByText('Sam Operator')).toBeVisible();
    await expect(page.getByText('Plant Register (1)')).toBeVisible();

    await page
      .getByRole('button', { name: 'Configure portal access for E2E Civil Pty Ltd' })
      .click();
    const portalDialog = page.getByRole('dialog').filter({ hasText: 'Portal Access' });
    await expect(portalDialog.getByRole('heading', { name: 'Portal Access' })).toBeVisible();
    await expect(
      portalDialog.getByRole('switch', { name: 'Documents portal access' }),
    ).toHaveAttribute('aria-checked', 'false');
    await portalDialog.getByRole('switch', { name: 'Documents portal access' }).click();
    await expect
      .poll(() => api.getPortalAccessRequest())
      .toEqual(
        expect.objectContaining({
          subcontractorId: 'e2e-sub-approved',
          portalAccess: expect.objectContaining({ documents: true }),
        }),
      );
    await expect(
      portalDialog.getByRole('switch', { name: 'Documents portal access' }),
    ).toHaveAttribute('aria-checked', 'true');
    await portalDialog.getByRole('button', { name: 'Close portal access' }).click();

    await page.getByRole('button', { name: 'Suspend' }).click();
    const suspendDialog = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Suspend Subcontractor' });
    await expect(
      suspendDialog.getByText('This subcontractor will lose access to the project'),
    ).toBeVisible();
    await suspendDialog.getByRole('button', { name: 'Confirm' }).click();
    await expect
      .poll(() => api.getStatusRequest())
      .toEqual(
        expect.objectContaining({ subcontractorId: 'e2e-sub-approved', status: 'suspended' }),
      );
    await expect(page.getByText('Status changed to suspended.')).toBeVisible();

    await page.getByRole('button', { name: 'Remove from Project' }).click();
    const removeDialog = page.getByRole('alertdialog').filter({ hasText: 'Remove Subcontractor' });
    await expect(
      removeDialog.getByText('This revokes project access while preserving historical dockets'),
    ).toBeVisible();
    await removeDialog.getByRole('button', { name: 'Confirm' }).click();
    await expect
      .poll(() => api.getStatusRequest())
      .toEqual(expect.objectContaining({ subcontractorId: 'e2e-sub-approved', status: 'removed' }));
    await expect(page.getByText('E2E Civil Pty Ltd')).toBeHidden();

    await page.getByRole('switch', { name: 'Show removed subcontractors' }).click();
    await expect(page.getByText('E2E Civil Pty Ltd')).toBeVisible();
    await expect(page.getByText('E2E Removed Earthworks')).toBeVisible();

    await page.getByRole('button', { name: 'Toggle E2E Civil Pty Ltd details' }).click();
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    const deleteDialog = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Permanently Delete Subcontractor' });
    await expect(
      deleteDialog.getByText('This will permanently delete E2E Civil Pty Ltd'),
    ).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete Permanently' }).click();
    expect(api.getDeleteRequestId()).toBe('e2e-sub-approved');
    await expect(page.getByText('E2E Civil Pty Ltd was permanently deleted.')).toBeVisible();
    await expect(page.getByText('E2E Civil Pty Ltd')).toBeHidden();
  });

  test('shows a retryable load error instead of a false empty subcontractor state', async ({
    page,
  }) => {
    const api = await mockSeededSubcontractorsApi(page, { failSubcontractorLoadsUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/subcontractors`);

    await expect(page.getByRole('alert')).toContainText('Unable to load subcontractors');
    await expect(page.getByText('No subcontractors found')).toHaveCount(0);
    await expect(page.getByText('Total Subcontractors')).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getSubcontractorLoadCount()).toBeGreaterThan(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('E2E Civil Pty Ltd')).toBeVisible();
    await expect(page.getByText('Total Subcontractors')).toBeVisible();
  });

  test('ignores duplicate invite submissions while the request is in flight', async ({ page }) => {
    const api = await mockSeededSubcontractorsApi(page, { inviteDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/subcontractors`);

    await page.getByRole('button', { name: 'Invite Subcontractor' }).click();
    const inviteDialog = page.getByRole('dialog').filter({ hasText: 'Invite Subcontractor' });
    await expect(inviteDialog.getByText('Create New Subcontractor')).toBeVisible();
    await inviteDialog.getByLabel('Select from Directory').fill('Directory');
    await inviteDialog.getByRole('button', { name: /Directory Concrete Pty Ltd/ }).click();

    await inviteDialog
      .getByRole('button', { name: 'Send Invitation' })
      .evaluate((button: HTMLElement) => {
        button.click();
        button.click();
      });

    await expect(
      page.getByText('Directory Concrete Pty Ltd was added to this project.'),
    ).toBeVisible();
    expect(api.getInviteRequests()).toHaveLength(1);
    expect(api.getInviteRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      globalSubcontractorId: 'e2e-directory-subcontractor',
    });
  });

  test('rejects encoded rate inputs in admin roster modals before posting', async ({ page }) => {
    const api = await mockSeededSubcontractorsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/subcontractors`);

    await page.getByRole('button', { name: 'Toggle E2E Civil Pty Ltd details' }).click();
    await page.getByRole('button', { name: 'Add Employee' }).click();
    const employeeDialog = page.getByRole('dialog', { name: 'Add Employee' });
    await employeeDialog.getByLabel('Employee Name *').fill('E2E Added Operator');
    await employeeDialog.getByLabel('Role').fill('Operator');
    await employeeDialog.getByLabel('Hourly Rate *').fill('1e2');
    await employeeDialog.getByRole('button', { name: 'Add Employee', exact: true }).click();

    await expect(
      page.getByText(
        'Name and an hourly rate greater than 0 with up to 2 decimal places are required.',
      ),
    ).toBeVisible();
    expect(api.getEmployeeRequests()).toHaveLength(0);

    await employeeDialog.getByLabel('Hourly Rate *').fill('82.25');
    await employeeDialog.getByRole('button', { name: 'Add Employee', exact: true }).click();
    await expect.poll(() => api.getEmployeeRequests()).toHaveLength(1);
    expect(api.getEmployeeRequest()).toMatchObject({
      subcontractorId: 'e2e-sub-approved',
      body: {
        name: 'E2E Added Operator',
        role: 'Operator',
        hourlyRate: 82.25,
      },
    });

    await page.getByRole('button', { name: 'Add Plant' }).click();
    const plantDialog = page.getByRole('dialog', { name: 'Add Plant' });
    await plantDialog.getByLabel('Type *').fill('Roller');
    await plantDialog.getByLabel('Description').fill('Padfoot roller');
    await plantDialog.getByLabel('ID/Rego').fill('ROL-123');
    await plantDialog.getByLabel('Dry Rate ($/hr) *').fill('150.123');
    await plantDialog.getByLabel('Wet Rate ($/hr)').fill('0');
    await plantDialog.getByRole('button', { name: 'Add Plant', exact: true }).click();

    await expect(
      page.getByText('Type and valid plant rates with up to 2 decimal places are required.'),
    ).toBeVisible();
    expect(api.getPlantRequests()).toHaveLength(0);

    await plantDialog.getByLabel('Dry Rate ($/hr) *').fill('150.25');
    await plantDialog.getByRole('button', { name: 'Add Plant', exact: true }).click();
    await expect.poll(() => api.getPlantRequests()).toHaveLength(1);
    expect(api.getPlantRequest()).toMatchObject({
      subcontractorId: 'e2e-sub-approved',
      body: {
        type: 'Roller',
        description: 'Padfoot roller',
        idRego: 'ROL-123',
        dryRate: 150.25,
        wetRate: 0,
      },
    });
  });
});

test.describe('Subcontractor invite acceptance', () => {
  test('submits the read-only invitation email when creating a new account', async ({ page }) => {
    const api = await mockInviteAcceptanceApi(page);

    await page.goto('/subcontractor-portal/accept-invite?id=e2e-invite-token');

    await expect(page.getByRole('heading', { name: "You've been invited!" })).toBeVisible();
    await expect(page.getByText('E2E Subbie Pty Ltd')).toBeVisible();

    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveValue(invitedSubcontractorUser.email);
    await expect(emailInput).not.toBeDisabled();
    await expect(emailInput).toHaveAttribute('readonly', '');
    await expect(emailInput).toHaveAttribute('aria-readonly', 'true');

    await page.getByLabel('Password', { exact: true }).fill('SecureP@ssword123!');
    await page.getByLabel('Confirm Password').fill('SecureP@ssword123!');
    await page.getByLabel(/I agree to the Terms of Service/).check();
    await page.getByRole('button', { name: 'Create Account & Accept' }).click();

    await expect
      .poll(() => api.getRegisterRequest())
      .toMatchObject({
        email: invitedSubcontractorUser.email,
        fullName: invitedSubcontractorUser.fullName,
        invitationId: 'e2e-invite-token',
        tosAccepted: true,
      });
    await expect(page).toHaveURL(/\/subcontractor-portal$/);
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sally/ }),
    ).toBeVisible();
  });
});

test.describe('Subcontractor portal module access', () => {
  test('shows only unread rate counter notifications in the dashboard attention list', async ({
    page,
  }) => {
    await mockSubcontractorDashboardApi(page, [
      {
        id: 'read-rate-counter',
        type: 'rate_counter',
        title: 'Read counter proposal',
        message: 'This counter proposal was already handled',
        isRead: true,
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'unread-rate-counter',
        type: 'rate_counter',
        title: 'Unread counter proposal',
        message: 'Please review this counter proposal',
        isRead: false,
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    ]);

    await page.goto('/subcontractor-portal');

    await expect(page.getByRole('heading', { name: 'Needs Attention (1)' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Unread counter proposal/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read counter proposal/ })).toHaveCount(0);
  });

  test('blocks direct portal module routes when access is disabled', async ({ page }) => {
    const api = await mockPortalModuleAccessApi(page, {
      lots: true,
      itps: false,
      holdPoints: false,
      testResults: false,
      ncrs: false,
      documents: false,
    });

    await page.goto('/subcontractor-portal/itps');

    await expect(page.getByRole('alert')).toContainText('ITPs portal access is not enabled');
    await expect(page.getByRole('link', { name: 'Back to Portal' })).toBeVisible();
    expect(api.getLotRequestCount()).toBe(0);
  });
});

test.describe('Subcontractor company profile', () => {
  test('rejects encoded My Company rates before posting roster changes', async ({ page }) => {
    const api = await mockMyCompanyApi(page);

    await page.goto('/my-company');

    await page.getByRole('button', { name: 'Add Employee' }).click();
    const employeeDialog = page.getByRole('dialog', { name: 'Add Employee' });
    await employeeDialog.getByLabel('Name *').fill('Sally Operator');
    await employeeDialog.getByLabel('Role *').selectOption('Operator');
    await employeeDialog.getByLabel('Proposed Hourly Rate *').fill('1e2');
    await employeeDialog.getByRole('button', { name: 'Add Employee', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(
      'hourly rate greater than 0 with up to 2 decimal places',
    );
    expect(api.getEmployeeRequests()).toHaveLength(0);

    await employeeDialog.getByLabel('Proposed Hourly Rate *').fill('95.50');
    await employeeDialog.getByRole('button', { name: 'Add Employee', exact: true }).click();
    await expect.poll(() => api.getEmployeeRequests()).toHaveLength(1);
    expect(api.getEmployeeRequest()).toMatchObject({
      name: 'Sally Operator',
      role: 'Operator',
      hourlyRate: 95.5,
    });
    await expect(page.getByText('Sally Operator')).toBeVisible();

    await page.getByRole('button', { name: 'Add Plant' }).click();
    const plantDialog = page.getByRole('dialog', { name: 'Add Plant' });
    await plantDialog.getByLabel('Type *').selectOption('Roller');
    await plantDialog.getByLabel('Description *').fill('Smooth drum roller');
    await plantDialog.getByLabel('ID/Rego').fill('ROL-456');
    await plantDialog.getByLabel('Dry Rate *').fill('180.123');
    await plantDialog.getByLabel('Wet Rate').fill('0');
    await plantDialog.getByRole('button', { name: 'Add Plant', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('dry rate greater than 0');
    expect(api.getPlantRequests()).toHaveLength(0);

    await plantDialog.getByLabel('Dry Rate *').fill('180.25');
    await plantDialog.getByRole('button', { name: 'Add Plant', exact: true }).click();
    await expect.poll(() => api.getPlantRequests()).toHaveLength(1);
    expect(api.getPlantRequest()).toMatchObject({
      type: 'Roller',
      description: 'Smooth drum roller',
      idRego: 'ROL-456',
      dryRate: 180.25,
      wetRate: 0,
    });
    await expect(page.getByText('Smooth drum roller')).toBeVisible();
  });

  test('shows an error instead of bundled demo company data when loading fails', async ({
    page,
  }) => {
    await mockMyCompanyFailureApi(page);

    await page.goto('/my-company');

    await expect(page.getByRole('alert')).toContainText('Unable to Load Company');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByText('ABC Earthmoving Pty Ltd')).toHaveCount(0);
    await expect(page.getByText('Subcontractor Admin')).toHaveCount(0);
    await expect(page.getByText('12 345 678 901')).toHaveCount(0);
  });
});
