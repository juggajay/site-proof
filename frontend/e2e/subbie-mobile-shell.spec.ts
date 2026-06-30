import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedUserState } from './helpers';

const PROJECT_ID = 'project/alpha & beta';
const PROJECT_NAME = 'Awkward Query Project';
const SUBCONTRACTOR_COMPANY_ID = 'e2e-subbie-mobile-shell-company';

const SUBBIE_USER = {
  id: 'e2e-subbie-mobile-shell-user',
  email: 'subbie-mobile-shell@example.com',
  fullName: 'Morgan Mobile Subbie',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: null,
  companyName: null,
  hasSubcontractorPortalAccess: true,
  hasPassword: true,
};

const PORTAL_ACCESS = {
  lots: true,
  itps: true,
  holdPoints: true,
  testResults: true,
  ncrs: true,
  documents: true,
};

const TODAY = '2026-06-22';

const assignedLot = {
  id: 'lot-1',
  lotNumber: 'QA-001',
  activity: 'Drainage',
  activityType: 'Drainage',
  status: 'in_progress',
  area: 42,
  projectId: PROJECT_ID,
  description: 'Subcontractor drainage run',
  subcontractorAssignments: [{ canCompleteITP: true, itpRequiresVerification: true }],
  itpInstances: [
    {
      id: 'itp-instance-1',
      status: 'in_progress',
      completionPercentage: 50,
      template: { id: 'itp-template-1', name: 'Drainage ITP', activityType: 'Drainage' },
    },
  ],
};

const itpInstance = {
  id: 'itp-instance-1',
  template: {
    id: 'itp-template-1',
    name: 'Drainage ITP',
    checklistItems: [
      {
        id: 'check-1',
        description: 'Confirm pipe bedding is compacted',
        category: 'Drainage',
        responsibleParty: 'subcontractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'photo',
        order: 1,
        acceptanceCriteria: 'Bedding is compacted to the specified level.',
      },
    ],
  },
  completions: [
    {
      id: 'completion-1',
      checklistItemId: 'check-1',
      status: 'pending',
      isCompleted: false,
      isNotApplicable: false,
      isFailed: false,
      notes: null,
      completedAt: null,
      completedBy: null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
      holdPointRelease: null,
    },
  ],
};

const docket = {
  id: 'docket-1',
  docketNumber: 'DKT-SUB-001',
  date: TODAY,
  status: 'draft',
  notes: 'Drainage works complete.',
  totalLabourSubmitted: 480,
  totalPlantSubmitted: 320,
  totalLabourApprovedCost: null,
  totalPlantApprovedCost: null,
  labourEntryCount: 1,
  plantEntryCount: 1,
  labourEntries: [
    {
      id: 'labour-1',
      employee: {
        id: 'emp-1',
        name: 'Worker One',
        role: 'Operator',
        hourlyRate: 80,
      },
      startTime: '07:00',
      finishTime: '13:00',
      submittedHours: 6,
      hourlyRate: 80,
      submittedCost: 480,
      lotAllocations: [{ lotId: assignedLot.id, lotNumber: assignedLot.lotNumber, hours: 6 }],
    },
  ],
  plantEntries: [
    {
      id: 'plant-entry-1',
      plant: {
        id: 'plant-1',
        type: 'Excavator',
        description: 'Mini Excavator',
        dryRate: 80,
        wetRate: 120,
      },
      hoursOperated: 4,
      wetOrDry: 'wet',
      hourlyRate: 80,
      submittedCost: 320,
    },
  ],
};

type MockSubbieShellOptions = {
  dockets?: (typeof docket)[];
};

function selectedProjectId(url: URL): string {
  return url.searchParams.get('projectId') || PROJECT_ID;
}

function selectedSubcontractorCompanyId(url: URL): string {
  return url.searchParams.get('subcontractorCompanyId') || SUBCONTRACTOR_COMPANY_ID;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockSubbieShellApi(page: Page, options: MockSubbieShellOptions = {}) {
  const myCompanyProjectIds: Array<string | null> = [];
  const lotsProjectIds: Array<string | null> = [];
  const lotsSubcontractorCompanyIds: Array<string | null> = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await fulfillJson(route, { user: SUBBIE_USER });
      return;
    }

    if (url.pathname === '/api/notifications/unread-count') {
      await fulfillJson(route, { count: 0 });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await fulfillJson(route, { notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await fulfillJson(route, { projects: [] });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      const requestedProjectId = url.searchParams.get('projectId');
      myCompanyProjectIds.push(requestedProjectId);
      await fulfillJson(route, {
        company: {
          id: selectedSubcontractorCompanyId(url),
          companyName: 'Mobile Shell Civil',
          abn: '12 345 678 901',
          projectId: selectedProjectId(url),
          projectName: PROJECT_NAME,
          primaryContactName: 'Morgan Mobile Subbie',
          primaryContactEmail: 'subbie-mobile-shell@example.com',
          primaryContactPhone: '0400 000 000',
          status: 'approved',
          employees: [
            {
              id: 'emp-1',
              name: 'Worker One',
              phone: '0400 111 111',
              role: 'Operator',
              hourlyRate: 80,
              status: 'approved',
            },
          ],
          plant: [
            {
              id: 'plant-1',
              type: 'Excavator',
              description: 'Mini Excavator',
              idRego: 'EX-01',
              dryRate: 80,
              wetRate: 120,
              status: 'approved',
            },
          ],
          portalAccess: PORTAL_ACCESS,
          availableProjects: [
            {
              id: 'portal-company-1',
              subcontractorCompanyId: SUBCONTRACTOR_COMPANY_ID,
              companyName: 'Mobile Shell Civil',
              projectId: PROJECT_ID,
              projectName: PROJECT_NAME,
              status: 'approved',
              portalAccess: PORTAL_ACCESS,
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/lots') {
      lotsProjectIds.push(url.searchParams.get('projectId'));
      lotsSubcontractorCompanyIds.push(url.searchParams.get('subcontractorCompanyId'));
      await fulfillJson(route, {
        lots: [assignedLot],
      });
      return;
    }

    if (url.pathname === `/api/lots/${assignedLot.id}`) {
      await fulfillJson(route, { lot: assignedLot });
      return;
    }

    if (url.pathname === `/api/itp/instances/lot/${assignedLot.id}`) {
      await fulfillJson(route, { instance: itpInstance });
      return;
    }

    if (url.pathname === '/api/dockets') {
      await fulfillJson(route, { dockets: options.dockets ?? [] });
      return;
    }

    if (url.pathname === `/api/dockets/${docket.id}`) {
      await fulfillJson(route, { docket });
      return;
    }

    if (url.pathname === `/api/holdpoints/project/${encodeURIComponent(PROJECT_ID)}`) {
      await fulfillJson(route, {
        holdPoints: [
          {
            id: 'hp-1',
            lotId: assignedLot.id,
            lotNumber: assignedLot.lotNumber,
            description: 'Superintendent release before backfill',
            status: 'released',
            releasedAt: '2026-06-22T09:30:00.000Z',
            releasedByName: 'Sam Superintendent',
            releasedByOrg: 'Principal Certifiers',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/test-results') {
      await fulfillJson(route, {
        testResults: [
          {
            id: 'test-1',
            lotId: assignedLot.id,
            lot: { lotNumber: assignedLot.lotNumber },
            testType: 'Compaction',
            passFail: 'pass',
            resultValue: 98,
            resultUnit: '%',
            requirement: '>= 95%',
            createdAt: '2026-06-22T10:00:00.000Z',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/ncrs') {
      await fulfillJson(route, {
        ncrs: [
          {
            id: 'ncr-1',
            ncrNumber: 'NCR-SUB-001',
            description: 'Bedding failed compaction on one section',
            category: 'workmanship',
            severity: 'major',
            status: 'open',
            raisedAt: '2026-06-22T11:00:00.000Z',
            raisedBy: { fullName: 'E2E Foreman' },
            responsibleSubcontractorId: selectedSubcontractorCompanyId(url),
            responsibleSubcontractor: {
              id: selectedSubcontractorCompanyId(url),
              companyName: 'Mobile Shell Civil',
            },
            ncrLots: [{ lot: { lotNumber: assignedLot.lotNumber } }],
            ncrEvidence: [],
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/documents/${encodeURIComponent(PROJECT_ID)}`) {
      await fulfillJson(route, {
        documents: [
          {
            id: 'doc-1',
            filename: 'SWMS-drainage.pdf',
            fileUrl: '/mock/swms.pdf',
            category: 'Safety',
            description: 'Drainage SWMS',
            uploadedAt: '2026-06-22T08:00:00.000Z',
            fileSize: 128000,
          },
        ],
      });
      return;
    }

    await fulfillJson(route, { message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, SUBBIE_USER);

  return {
    myCompanyProjectIds: () => myCompanyProjectIds,
    lotsProjectIds: () => lotsProjectIds,
    lotsSubcontractorCompanyIds: () => lotsSubcontractorCompanyIds,
  };
}

test.describe('Subbie mobile shell direct routes', () => {
  test('desktop direct /p/work falls back to the classic portal and preserves project scope', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const api = await mockSubbieShellApi(page);

    await page.goto(`/p/work?projectId=${encodeURIComponent(PROJECT_ID)}`);

    await expect.poll(() => new URL(page.url()).pathname).toBe('/subcontractor-portal/work');
    expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
    await expect(page.getByRole('heading', { name: 'Assigned Work' })).toBeVisible();
    await expect(page.getByText('QA-001')).toBeVisible();
    expect(api.myCompanyProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsProjectIds()).toContain(PROJECT_ID);
  });

  test('mobile direct /p/work stays in the shell and preserves project scope', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const api = await mockSubbieShellApi(page);

    await page.goto(`/p/work?projectId=${encodeURIComponent(PROJECT_ID)}`);

    await expect.poll(() => new URL(page.url()).pathname).toBe('/p/work');
    expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
    await expect(page.getByRole('heading', { name: 'My Work' })).toBeVisible();
    await expect(page.getByText('QA-001')).toBeVisible();
    expect(api.myCompanyProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsProjectIds()).toContain(PROJECT_ID);
  });

  test('mobile direct /p/docket scopes assigned lots to the selected subcontractor company', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const api = await mockSubbieShellApi(page);
    const selectedCompanyId = 'subbie/company & two';

    await page.goto(
      `/p/docket?projectId=${encodeURIComponent(PROJECT_ID)}&subcontractorCompanyId=${encodeURIComponent(
        selectedCompanyId,
      )}`,
    );

    await expect.poll(() => new URL(page.url()).pathname).toBe('/p/docket');
    await expect(page.getByRole('heading', { name: "Today's Docket" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add crew hours' })).toBeVisible();
    expect(api.myCompanyProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsSubcontractorCompanyIds()).toContain(selectedCompanyId);
  });

  test('mobile direct nested /p routes load the intended shell screens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await mockSubbieShellApi(page, { dockets: [docket] });
    const projectQuery = `?projectId=${encodeURIComponent(
      PROJECT_ID,
    )}&subcontractorCompanyId=${encodeURIComponent(SUBCONTRACTOR_COMPANY_ID)}`;

    const directRoutes: Array<{ path: string; heading: string | RegExp; text?: string | RegExp }> =
      [
        {
          path: `/p${projectQuery}`,
          heading: /^(Morning|Afternoon|Evening), Morgan$/,
          text: 'Mobile Shell Civil',
        },
        { path: `/p/dockets${projectQuery}`, heading: 'My Dockets', text: '2 entries · $800' },
        {
          path: `/p/docket/${encodeURIComponent(docket.id)}${projectQuery}`,
          heading: 'Docket DKT-SUB-001',
          text: 'Worker One',
        },
        { path: `/p/itps${projectQuery}`, heading: 'Inspections', text: 'Drainage ITP' },
        {
          path: `/p/lots/${encodeURIComponent(assignedLot.id)}/itp${projectQuery}`,
          heading: 'Inspection',
          text: 'Confirm pipe bedding is compacted',
        },
        { path: `/p/quality${projectQuery}`, heading: 'Holds & Tests', text: 'Compaction' },
        { path: `/p/ncrs${projectQuery}`, heading: 'NCRs', text: 'NCR-SUB-001' },
        { path: `/p/docs${projectQuery}`, heading: 'Documents', text: 'SWMS-drainage.pdf' },
        { path: `/p/company${projectQuery}`, heading: 'My Company', text: 'Worker One' },
      ];

    for (const route of directRoutes) {
      await page.goto(route.path);
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(new URL(route.path, 'http://x').pathname);
      expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
      expect(new URL(page.url()).searchParams.get('subcontractorCompanyId')).toBe(
        SUBCONTRACTOR_COMPANY_ID,
      );
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      if (route.text) {
        await expect(page.getByText(route.text).first()).toBeVisible();
      }
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('mobile classic portal deep links redirect to matching /p shell routes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSubbieShellApi(page, { dockets: [docket] });
    const projectQuery = `?projectId=${encodeURIComponent(
      PROJECT_ID,
    )}&subcontractorCompanyId=${encodeURIComponent(SUBCONTRACTOR_COMPANY_ID)}`;

    const classicRoutes: Array<{
      from: string;
      to: string;
      heading: string;
      text?: string | RegExp;
    }> = [
      {
        from: `/subcontractor-portal/tests${projectQuery}`,
        to: '/p/quality',
        heading: 'Holds & Tests',
        text: 'Compaction',
      },
      {
        from: `/subcontractor-portal/holdpoints${projectQuery}`,
        to: '/p/quality',
        heading: 'Holds & Tests',
        text: 'Superintendent release before backfill',
      },
      {
        from: `/subcontractor-portal/ncrs${projectQuery}`,
        to: '/p/ncrs',
        heading: 'NCRs',
        text: 'NCR-SUB-001',
      },
      {
        from: `/subcontractor-portal/documents${projectQuery}`,
        to: '/p/docs',
        heading: 'Documents',
        text: 'SWMS-drainage.pdf',
      },
      {
        from: `/subcontractor-portal/lots/${encodeURIComponent(assignedLot.id)}/itp${projectQuery}`,
        to: `/p/lots/${encodeURIComponent(assignedLot.id)}/itp`,
        heading: 'Inspection',
        text: 'Confirm pipe bedding is compacted',
      },
      {
        from: `/my-company${projectQuery}`,
        to: '/p/company',
        heading: 'My Company',
        text: 'Worker One',
      },
    ];

    for (const route of classicRoutes) {
      await page.goto(route.from);
      await expect.poll(() => new URL(page.url()).pathname).toBe(route.to);
      expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
      expect(new URL(page.url()).searchParams.get('subcontractorCompanyId')).toBe(
        SUBCONTRACTOR_COMPANY_ID,
      );
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      if (route.text) {
        await expect(page.getByText(route.text).first()).toBeVisible();
      }
    }
  });
});
