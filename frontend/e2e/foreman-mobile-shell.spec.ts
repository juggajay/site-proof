import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedUserState } from './helpers';
import { formatDateKey } from '../src/lib/localDate';

// This spec relies on exhaustive API route mocks. Blocking service workers keeps
// mocked fetches under Playwright's control during the full-suite CI run.
test.use({ serviceWorkers: 'block' });

const PROJECT_ID = 'project/alpha & beta';
const PROJECT_NAME = 'Awkward Foreman Project';
const DATE_KEY = formatDateKey();
const TODAY = '2026-06-22T08:00:00.000Z';

const FOREMAN_USER = {
  id: 'e2e-foreman-mobile-shell-user',
  email: 'foreman-mobile-shell@example.com',
  fullName: 'Frank Field',
  role: 'foreman',
  roleInCompany: 'foreman',
  dashboardRole: 'foreman',
  companyId: 'e2e-builder-company',
  companyName: 'Head Contractor Civil',
  hasPassword: true,
};

const lot = {
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: 'Culvert base slab',
  status: 'in_progress',
  activityType: 'Drainage',
  chainageStart: 10,
  chainageEnd: 25,
  offset: 'Left',
  layer: 'Base',
  areaZone: 'Zone A',
  assignedSubcontractorId: 'subbie-1',
  assignedSubcontractor: { companyName: 'Precision Drainage' },
  createdAt: TODAY,
  updatedAt: TODAY,
  itpCount: 1,
  testCount: 1,
  documentCount: 2,
  ncrCount: 1,
  holdPointCount: 1,
  notes: 'QA browser fixture',
};

const diary = {
  id: 'diary-1',
  projectId: PROJECT_ID,
  date: DATE_KEY,
  status: 'draft',
  weatherConditions: 'Fine',
  temperatureMin: 12,
  temperatureMax: 24,
  rainfallMm: 0,
  weatherNotes: '',
  generalNotes: '',
  personnel: [
    {
      id: 'personnel-1',
      name: 'Frank Field',
      company: 'Head Contractor Civil',
      role: 'Foreman',
      hours: 8,
      createdAt: TODAY,
    },
  ],
  plant: [
    {
      id: 'plant-1',
      description: 'Excavator',
      idRego: 'EX-42',
      company: 'Plant Co',
      hoursOperated: 6,
      createdAt: TODAY,
    },
  ],
  activities: [
    {
      id: 'activity-1',
      description: 'Installed subsoil drain',
      lotId: lot.id,
      lot: { id: lot.id, lotNumber: lot.lotNumber },
      quantity: 12,
      unit: 'm',
      createdAt: TODAY,
    },
  ],
  delays: [],
  deliveries: [],
  events: [],
  createdAt: TODAY,
  updatedAt: TODAY,
};

const timeline = [
  {
    id: 'timeline-personnel-1',
    type: 'personnel',
    description: 'Frank Field',
    data: { role: 'Foreman', company: 'Head Contractor Civil', hours: 8 },
    createdAt: TODAY,
  },
  {
    id: 'timeline-plant-1',
    type: 'plant',
    description: 'Excavator',
    data: { idRego: 'EX-42', company: 'Plant Co', hoursOperated: 6 },
    createdAt: TODAY,
  },
  {
    id: 'timeline-activity-1',
    type: 'activity',
    description: 'Installed subsoil drain',
    lot: { id: lot.id, lotNumber: lot.lotNumber },
    data: { quantity: 12, unit: 'm' },
    createdAt: TODAY,
  },
];

const dockets = [
  {
    id: 'docket-1',
    docketNumber: 'DKT-001',
    subcontractor: 'Precision Drainage',
    subcontractorId: 'subbie-1',
    date: '2026-06-22',
    status: 'pending_approval',
    notes: 'Crew completed drainage works.',
    labourHours: 8,
    plantHours: 6,
    totalLabourSubmitted: 960,
    totalLabourApproved: 0,
    totalPlantSubmitted: 720,
    totalPlantApproved: 0,
    totalLabourApprovedCost: null,
    totalPlantApprovedCost: null,
    adjustmentReason: null,
    submittedAt: TODAY,
    approvedAt: null,
    foremanNotes: null,
  },
];

const ncrs = [
  {
    id: 'ncr-1',
    ncrNumber: 'NCR-001',
    description: 'Honeycombing visible on culvert wall',
    category: 'workmanship',
    severity: 'major',
    status: 'open',
    qmApprovalRequired: true,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Frank Field', email: FOREMAN_USER.email },
    responsibleUserId: FOREMAN_USER.id,
    responsibleUser: {
      id: FOREMAN_USER.id,
      fullName: FOREMAN_USER.fullName,
      email: FOREMAN_USER.email,
    },
    responsibleSubcontractor: null,
    responsibleSubcontractorId: null,
    dueDate: '2026-06-24',
    createdAt: TODAY,
    project: { id: PROJECT_ID, name: PROJECT_NAME, projectNumber: 'QA-047' },
    ncrLots: [{ lot: { lotNumber: lot.lotNumber, description: lot.description } }],
  },
];

const documents = [
  {
    id: 'photo-1',
    documentType: 'photo',
    filename: 'unfiled-inlet.jpg',
    fileUrl: '/mock/unfiled-inlet.jpg',
    mimeType: 'image/jpeg',
    caption: 'Unfiled inlet photo',
    uploadedAt: TODAY,
    lotId: null,
    lot: null,
    gpsLatitude: '-33.8688',
    gpsLongitude: '151.2093',
  },
];

const drawings = [
  {
    id: 'drawing-1',
    drawingNumber: 'DRG-001',
    title: 'Drainage long section',
    revision: 'C',
    status: 'approved',
    document: { id: 'drawing-doc-1', fileUrl: '/mock/drawing.pdf' },
    supersededBy: null,
  },
];

function encodedProjectPath(path: string): string {
  return path.replace(PROJECT_ID, encodeURIComponent(PROJECT_ID));
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function pathProject(pathname: string, prefix: string, suffix = ''): string | null {
  if (!pathname.startsWith(prefix)) return null;
  if (suffix && !pathname.endsWith(suffix)) return null;
  const end = suffix ? pathname.length - suffix.length : pathname.length;
  return decodeURIComponent(pathname.slice(prefix.length, end));
}

function pathProjectDate(
  pathname: string,
  prefix: string,
  dateMarker: string,
): { projectId: string; date: string } | null {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const markerIndex = rest.lastIndexOf(dateMarker);
  if (markerIndex < 0) return null;

  const project = rest.slice(0, markerIndex);
  const date = rest.slice(markerIndex + dateMarker.length);
  if (!project || !date || date.includes('/')) return null;

  return { projectId: decodeURIComponent(project), date: decodeURIComponent(date) };
}

async function mockForemanShellApi(page: Page) {
  const fallbackProjectCalls: string[] = [];
  const todayPathnames: string[] = [];
  const lotsProjectIds: Array<string | null> = [];
  const docketProjectIds: Array<string | null> = [];
  const ncrProjectIds: Array<string | null> = [];
  const documentProjectIds: Array<string | null> = [];
  const drawingProjectIds: Array<string | null> = [];
  const signedUrlDocumentIds: string[] = [];
  const docketQueries: unknown[] = [];
  const ncrResponses: unknown[] = [];
  const photoRefileBodies: unknown[] = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/auth/me') {
      await fulfillJson(route, { user: FOREMAN_USER });
      return;
    }

    if (path === '/api/notifications/unread-count') {
      await fulfillJson(route, { count: 0 });
      return;
    }

    if (path === '/api/notifications') {
      await fulfillJson(route, { notifications: [], unreadCount: 0 });
      return;
    }

    if (path === '/api/dashboard/foreman') {
      fallbackProjectCalls.push(path);
      await fulfillJson(route, { project: { id: 'fallback-project' } });
      return;
    }

    const todayProject = pathProject(path, '/api/dashboard/projects/', '/foreman/today');
    if (todayProject) {
      todayPathnames.push(path);
      await fulfillJson(route, {
        blocking: [{ id: 'work-1', metadata: { lotId: lot.id } }],
        dueToday: [{ id: 'work-2', metadata: { lotId: lot.id } }],
        upcoming: [],
        summary: { totalBlocking: 1, totalDueToday: 1, totalUpcoming: 0 },
      });
      return;
    }

    if (path === '/api/lots') {
      lotsProjectIds.push(url.searchParams.get('projectId'));
      await fulfillJson(route, {
        lots: [lot],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasNextPage: false },
      });
      return;
    }

    if (path === `/api/itp/instances/lot/${encodeURIComponent(lot.id)}`) {
      await fulfillJson(route, {
        instance: {
          id: 'itp-instance-1',
          template: {
            id: 'itp-template-1',
            name: 'Drainage ITP',
            checklistItems: [
              {
                id: 'check-1',
                description: 'Survey setout confirmed',
                category: 'Survey',
                responsibleParty: 'contractor',
                isHoldPoint: false,
                pointType: 'standard',
                evidenceRequired: 'photo',
                order: 1,
                acceptanceCriteria: 'Setout matches latest drawings.',
              },
              {
                id: 'check-2',
                description: 'Superintendent hold point release recorded',
                category: 'Hold point',
                responsibleParty: 'superintendent',
                isHoldPoint: true,
                pointType: 'hold_point',
                evidenceRequired: 'document',
                order: 2,
                acceptanceCriteria: 'External superintendent has released the hold point.',
              },
            ],
          },
          completions: [
            {
              id: 'completion-1',
              checklistItemId: 'check-1',
              status: 'completed',
              isCompleted: true,
              isNotApplicable: false,
              isFailed: false,
              notes: null,
              completedAt: TODAY,
              completedBy: {
                id: FOREMAN_USER.id,
                fullName: FOREMAN_USER.fullName,
                email: FOREMAN_USER.email,
              },
              isVerified: false,
              verifiedAt: null,
              verifiedBy: null,
              attachments: [],
              holdPointRelease: null,
            },
            {
              id: 'completion-2',
              checklistItemId: 'check-2',
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
        },
      });
      return;
    }

    if (path === `/api/diary/${encodeURIComponent(PROJECT_ID)}`) {
      await fulfillJson(route, { data: [diary] });
      return;
    }

    const diaryByDate = pathProjectDate(path, '/api/diary/', '/');
    if (diaryByDate?.projectId === PROJECT_ID) {
      await fulfillJson(route, { ...diary, date: diaryByDate.date });
      return;
    }

    if (path === `/api/diary/${encodeURIComponent(diary.id)}/timeline`) {
      await fulfillJson(route, { timeline });
      return;
    }

    const docketSummaryByDate = pathProjectDate(path, '/api/diary/project/', '/docket-summary/');
    if (docketSummaryByDate?.projectId === PROJECT_ID) {
      await fulfillJson(route, {
        labourHours: 8,
        plantHours: 6,
        docketCount: 1,
        dockets: [],
      });
      return;
    }

    const weatherByDate = pathProjectDate(path, '/api/diary/', '/weather/');
    if (weatherByDate?.projectId === PROJECT_ID) {
      await fulfillJson(route, {
        weatherConditions: 'Fine',
        temperatureMin: 12,
        temperatureMax: 24,
        rainfallMm: 0,
        source: 'mock forecast',
      });
      return;
    }

    if (path === '/api/dockets') {
      docketProjectIds.push(url.searchParams.get('projectId'));
      await fulfillJson(route, { data: dockets, dockets });
      return;
    }

    if (path === '/api/projects' || path === `/api/projects/${encodeURIComponent(PROJECT_ID)}`) {
      await fulfillJson(route, {
        project: {
          id: PROJECT_ID,
          name: PROJECT_NAME,
          projectNumber: 'QA-047',
          currentUserRole: 'foreman',
        },
        projects: [{ id: PROJECT_ID, name: PROJECT_NAME }],
      });
      return;
    }

    if (path === `/api/dockets/${encodeURIComponent(dockets[0].id)}`) {
      await fulfillJson(route, {
        docket: {
          adjustmentReason: null,
          labourEntries: [
            {
              id: 'labour-1',
              employee: { name: 'Worker One', role: 'Drainage crew' },
              startTime: null,
              finishTime: null,
              submittedHours: 8,
              approvedHours: 8,
              hourlyRate: 120,
              submittedCost: 960,
              approvedCost: 960,
            },
          ],
          plantEntries: [
            {
              id: 'plant-entry-1',
              plant: { type: 'excavator', description: 'Excavator', idRego: 'EX-42' },
              hoursOperated: 6,
              wetOrDry: 'wet',
              hourlyRate: 120,
              submittedCost: 720,
              approvedCost: 720,
            },
          ],
        },
      });
      return;
    }

    if (path === `/api/dockets/${encodeURIComponent(dockets[0].id)}/query`) {
      const body = request.postDataJSON();
      await fulfillJson(route, {});
      docketQueries.push(body);
      return;
    }

    if (path === '/api/ncrs') {
      ncrProjectIds.push(url.searchParams.get('projectId'));
      await fulfillJson(route, { data: ncrs, ncrs, pagination: { page: 1, limit: 20, total: 1 } });
      return;
    }

    if (path === `/api/ncrs/check-role/${encodeURIComponent(PROJECT_ID)}`) {
      await fulfillJson(route, { role: 'foreman', isQualityManager: false, canApproveNCRs: false });
      return;
    }

    if (path === `/api/ncrs/${encodeURIComponent(ncrs[0].id)}/evidence`) {
      await fulfillJson(route, { evidence: [] });
      return;
    }

    if (path === `/api/ncrs/${encodeURIComponent(ncrs[0].id)}/respond`) {
      const body = request.postDataJSON();
      await fulfillJson(route, {});
      ncrResponses.push(body);
      return;
    }

    const signedUrlDocumentId = pathProject(path, '/api/documents/', '/signed-url');
    if (signedUrlDocumentId) {
      signedUrlDocumentIds.push(signedUrlDocumentId);
      await fulfillJson(route, {
        signedUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
      return;
    }

    if (path === `/api/documents/${encodeURIComponent(PROJECT_ID)}`) {
      documentProjectIds.push(pathProject(path, '/api/documents/'));
      await fulfillJson(route, { documents });
      return;
    }

    if (path === `/api/documents/${encodeURIComponent(documents[0].id)}`) {
      const body = request.postDataJSON();
      await fulfillJson(route, {});
      photoRefileBodies.push(body);
      return;
    }

    if (path === `/api/drawings/${encodeURIComponent(PROJECT_ID)}`) {
      drawingProjectIds.push(pathProject(path, '/api/drawings/'));
      await fulfillJson(route, { drawings });
      return;
    }

    await fulfillJson(route, { message: `Unhandled E2E API route: ${path}` }, 404);
  });

  await mockAuthenticatedUserState(page, FOREMAN_USER);

  return {
    fallbackProjectCalls,
    todayPathnames,
    lotsProjectIds,
    docketProjectIds,
    ncrProjectIds,
    documentProjectIds,
    drawingProjectIds,
    signedUrlDocumentIds,
    docketQueries,
    ncrResponses,
    photoRefileBodies,
  };
}

test.describe('Foreman mobile shell', () => {
  test('honours query project scope across core mobile surfaces', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const openedUrls: string[] = [];
      Object.defineProperty(window, '__siteProofOpenedUrls', {
        value: openedUrls,
        configurable: true,
      });

      window.open = ((url?: string | URL) => {
        openedUrls.push(String(url ?? ''));
        return {
          closed: false,
          opener: null,
          close: () => undefined,
          location: {
            set href(value: string) {
              openedUrls.push(String(value));
            },
            get href() {
              return '';
            },
          },
        } as unknown as Window;
      }) as typeof window.open;
    });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const api = await mockForemanShellApi(page);
    const scopedHome = `/m?projectId=${encodeURIComponent(PROJECT_ID)}`;

    await page.goto(scopedHome);
    await expect(page.getByRole('button', { name: /Daily diary/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Lots/i })).toBeVisible();
    await expect(api.fallbackProjectCalls).toEqual([]);
    expect(api.todayPathnames).toContain(
      encodedProjectPath('/api/dashboard/projects/project/alpha & beta/foreman/today'),
    );

    await page.getByRole('button', { name: /Lots/i }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/m/lots');
    expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
    await expect(page.getByText('LOT-001')).toBeVisible();
    expect(api.lotsProjectIds).toContain(PROJECT_ID);

    await page.getByRole('button', { name: /Lot LOT-001/i }).click();
    await expect(page.getByRole('heading', { name: 'LOT-001' })).toBeVisible();
    const inspectionsTile = page.getByRole('button', { name: /^Inspections/i });
    await expect(inspectionsTile).toBeVisible();

    await inspectionsTile.click();
    await expect(page.getByRole('heading', { name: 'Inspection' })).toBeVisible();
    await expect(page.getByText('Superintendent hold point release recorded')).toBeVisible();
    await expect(page.getByText('Awaiting hold point release').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pass this check' })).toHaveCount(0);

    await page.goto(`/m/diary?projectId=${encodeURIComponent(PROJECT_ID)}`);
    await expect(page.getByRole('heading', { name: 'Daily Diary' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Weather — complete/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Review & Submit — in progress/i }),
    ).toBeVisible();

    await page.goto(`/m/dockets?projectId=${encodeURIComponent(PROJECT_ID)}`);
    await expect(page.getByRole('heading', { name: 'Dockets' })).toBeVisible();
    await expect(page.getByText('DKT-001')).toBeVisible();
    expect(api.docketProjectIds).toContain(PROJECT_ID);
    await page.getByRole('button', { name: /Docket DKT-001/i }).click();
    await expect(page.getByRole('heading', { name: 'DKT-001' })).toBeVisible();
    await page.getByRole('button', { name: 'Query' }).click();
    await expect(page.getByRole('heading', { name: 'Query Docket' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send query' })).toBeDisabled();
    await page.getByLabel('What needs clarifying? *').fill('Please confirm the plant hours.');
    await page.getByRole('button', { name: 'Send query' }).click();
    await expect
      .poll(() => api.docketQueries)
      .toContainEqual({
        questions: 'Please confirm the plant hours.',
      });
    await expect(page.getByRole('heading', { name: 'Dockets' })).toBeVisible();

    await page.goto(`/m/issues?projectId=${encodeURIComponent(PROJECT_ID)}`);
    await expect(page.getByRole('heading', { name: 'Issues' })).toBeVisible();
    await expect(page.getByText('NCR-001')).toBeVisible();
    expect(api.ncrProjectIds).toContain(PROJECT_ID);
    await page.getByRole('button', { name: /Issue NCR-001/i }).click();
    await expect(page.getByRole('heading', { name: 'NCR-001' })).toBeVisible();
    await page.getByRole('button', { name: 'Respond to NCR-001' }).click();
    await expect(page.getByRole('heading', { name: 'Respond — NCR-001' })).toBeVisible();
    await page.getByLabel('Root cause').selectOption('process');
    await page.getByLabel('What happened').fill('Process control was missed.');
    await page.getByLabel('How you’ll fix it').fill('Rework and add hold-point witness.');
    await page.getByRole('button', { name: 'Submit response' }).click();
    await expect
      .poll(() => api.ncrResponses)
      .toContainEqual({
        rootCauseCategory: 'process',
        rootCauseDescription: 'Process control was missed.',
        proposedCorrectiveAction: 'Rework and add hold-point witness.',
      });

    await page.goto(`/m/photos?projectId=${encodeURIComponent(PROJECT_ID)}`);
    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    const unfiledPhoto = page.getByRole('button', {
      name: /Photo — Unfiled inlet photo\s*, unfiled/i,
    });
    await expect(unfiledPhoto).toBeVisible();
    expect(api.documentProjectIds).toContain(PROJECT_ID);
    await unfiledPhoto.click();
    await expect(page.getByRole('heading', { name: 'Photo' })).toBeVisible();
    await page.getByRole('button', { name: 'File to a lot' }).click();
    const lotFetchesBeforeRefile = api.lotsProjectIds.length;
    await page.getByRole('button', { name: /LOT-001/i }).click();
    await expect.poll(() => api.photoRefileBodies).toContainEqual({ lotId: lot.id });
    await expect.poll(() => api.lotsProjectIds.length).toBeGreaterThan(lotFetchesBeforeRefile);

    await page.goto(`/m/docs?projectId=${encodeURIComponent(PROJECT_ID)}`);
    await expect(page.getByRole('heading', { name: 'Drawings & Docs' })).toBeVisible();
    await expect(page.getByRole('button', { name: /DRG-001/i })).toBeVisible();
    expect(api.drawingProjectIds).toContain(PROJECT_ID);
    await page.getByRole('button', { name: /DRG-001/i }).click();
    await expect.poll(() => api.signedUrlDocumentIds).toContain('drawing-doc-1');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = window as Window & { __siteProofOpenedUrls?: string[] };
          return state.__siteProofOpenedUrls ?? [];
        }),
      )
      .toContain('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('direct nested mobile routes load the intended screens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await mockForemanShellApi(page);
    const projectQuery = `?projectId=${encodeURIComponent(PROJECT_ID)}`;

    const directRoutes: Array<{ path: string; heading?: string; text?: string | RegExp }> = [
      { path: `/m/diary/weather${projectQuery}`, heading: 'Weather' },
      { path: `/m/diary/crew${projectQuery}`, heading: 'Crew & Plant' },
      { path: `/m/diary/work${projectQuery}`, heading: "Today's Work" },
      { path: `/m/diary/work/activity${projectQuery}`, heading: 'Add Activity' },
      { path: `/m/diary/work/delay${projectQuery}`, heading: 'Add Delay' },
      { path: `/m/diary/work/delivery${projectQuery}`, heading: 'Add Delivery' },
      { path: `/m/diary/work/event${projectQuery}`, heading: 'Add Event' },
      { path: `/m/diary/review${projectQuery}`, heading: 'Review & Submit' },
      {
        path: `/m/diary/done?queued=1&projectId=${encodeURIComponent(PROJECT_ID)}`,
        text: 'Diary saved',
      },
      { path: `/m/lots/${encodeURIComponent(lot.id)}${projectQuery}`, heading: 'LOT-001' },
      { path: `/m/lots/${encodeURIComponent(lot.id)}/details${projectQuery}`, heading: 'Details' },
      { path: `/m/lots/${encodeURIComponent(lot.id)}/itp${projectQuery}`, heading: 'Inspection' },
      {
        path: `/m/dockets/${encodeURIComponent(dockets[0].id)}${projectQuery}`,
        heading: 'DKT-001',
      },
      {
        path: `/m/dockets/${encodeURIComponent(dockets[0].id)}/adjust${projectQuery}`,
        heading: 'Adjust Hours',
      },
      {
        path: `/m/dockets/${encodeURIComponent(dockets[0].id)}/query${projectQuery}`,
        heading: 'Query Docket',
      },
      {
        path: `/m/dockets/${encodeURIComponent(dockets[0].id)}/reject${projectQuery}`,
        heading: 'Reject Docket',
      },
      { path: `/m/issues/${encodeURIComponent(ncrs[0].id)}${projectQuery}`, heading: 'NCR-001' },
      { path: `/m/photos/${encodeURIComponent(documents[0].id)}${projectQuery}`, heading: 'Photo' },
    ];

    for (const route of directRoutes) {
      await page.goto(route.path);
      expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
      if (route.heading) {
        await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      }
      if (route.text) {
        await expect(page.getByText(route.text).first()).toBeVisible();
      }
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
